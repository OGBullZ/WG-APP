/* WG-Code wechseln (Ex-Mitbewohner raus) — zwei Geräte über den pfad-genauen Firebase-Stub.
   A wechselt: Daten ziehen unter den neuen Code um, nur A's eigene Push-Registrierung kommt mit, der alte
   Pfad wird durch einen Umzugs-Marker ersetzt, der Server (/api/rotate) erfährt den neuen Code — und vorher
   wird noch schnell gesichert (/api/backup). Scheitert der Server, bleibt ALLES beim Alten.
   B (hat noch den alten Code): sieht „Code geändert", schreibt NICHTS mehr auf den alten Pfad (sonst stünde
   die WG dort wieder — für genau den, der raus sollte) und kann per neuem Code wieder beitreten.
   Die DB-Regel „nach dem Umzug keine Writes mehr" prüft ein Lauf gegen die echte DB (CLAUDE.md). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const OLD = 'BLAU-MOND-ABC234';
const CODE_RE = /^[A-ZÄÖÜ]{2,8}-[A-ZÄÖÜ]{2,8}-[A-HJKMNP-Z2-9]{6}$/;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Tom', color: '#fbbf24', pp: 'y' }];
const today = (() => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();
const SEED = {
  users: USERS,
  hs: { h1: { id: 'h1', name: 'Klopapier', price: 5, paidBy: 'u1', date: today, settled: false, seq: 1 } },
  push: { devA: { endpoint: 'https://push.example/a', p256dh: 'a', auth: 'a', name: 'Torben' }, devX: { endpoint: 'https://push.example/ex', p256dh: 'x', auth: 'x', name: 'Ex' } },
  ls: { l1: { id: 'l1', svc: 'Netflix', by: 'u1', exp: Date.now() + 3600e3, ct: 'AAAA', s: 'AA', iv: 'AA' } },
};

const browser = await chromium.launch();
const errors = [];
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

/* Gerät: gestubbtes Firebase mit Startbaum, abgefangene Server-Aufrufe (rotateStatus steuert /api/rotate). */
async function device({ me, dev, seedTree, localData, rotateStatus = 200 }) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${dev}] ` + e.message));
  const calls = [];
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/rotate')) { calls.push({ api: 'rotate', body: JSON.parse(r.request().postData() || '{}') }); return r.fulfill({ status: rotateStatus, contentType: 'application/json', body: rotateStatus === 200 ? '{"ok":true}' : '{"error":"x"}' }); }
    // GET = Backup-Wächter (Liste), POST = „Jetzt sichern" vor dem Wechsel — beide auseinanderhalten
    if (u.includes('/api/backup')) { calls.push({ api: 'backup', method: r.request().method(), body: JSON.parse(r.request().postData() || '{}') }); return r.fulfill({ status: 200, contentType: 'application/json', body: r.request().method() === 'GET' ? '{"days":[]}' : '{"result":"ok"}' }); }
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '/* im app-Stub */' }));
  await page.addInitScript(([m, d, t, ld, day]) => {
    if (!localStorage.getItem('wg_code')) {
      localStorage.setItem('wg_code', JSON.stringify('BLAU-MOND-ABC234'));
      localStorage.setItem('wg_me', JSON.stringify(m));
      localStorage.setItem('wg_device', JSON.stringify(d));
      localStorage.setItem('wg_start_shown', JSON.stringify(day));
      if (ld) localStorage.setItem('wg_data', JSON.stringify(ld));
    }
    // ganzer Startbaum (mehrere WGs) statt nur einer WG — der Stub übernimmt ihn beim Laden
    window.__wgTreeSeed = t;
  }, [me, dev, seedTree, localData || null, today]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(900);
  return { page, calls, ctx };
}
const tree = page => page.evaluate(() => window.__wg.tree);
const openMehr = async page => { await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await page.waitForTimeout(400); };

// ── A) Wechsel klappt ──
{
  const { page, calls, ctx } = await device({ me: 'u1', dev: 'devA', seedTree: { wg: { [OLD]: SEED } } });
  await openMehr(page);
  await page.getByRole('button', { name: /WG-Code wechseln/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.sheet').getByRole('button', { name: 'Code wechseln' }).click();
  await page.locator('[data-testid="new-code"]').waitFor({ timeout: 8000 });
  const NEW = (await page.locator('[data-testid="new-code"]').innerText()).trim();
  check('A1 neuer Code im richtigen Format und anders als der alte', CODE_RE.test(NEW) && NEW !== OLD, NEW);
  check('A2 Gerät nutzt jetzt den neuen Code', (await page.evaluate(() => JSON.parse(localStorage.getItem('wg_code')))) === NEW);
  const t = await tree(page);
  const oldNode = t.wg[OLD] || {};
  check('A3 alter Pfad enthält NUR den Umzugs-Marker (keine Daten)', oldNode._moved === true && typeof oldNode._mt === 'number' && Object.keys(oldNode).length === 2, JSON.stringify(oldNode).slice(0, 120));
  const newNode = t.wg[NEW] || {};
  check('A4 Daten stehen unter dem neuen Code', newNode.hs?.h1?.name === 'Klopapier' && Array.isArray(newNode.users) || !!newNode.users);
  check('A5 nur die EIGENE Push-Registrierung zieht mit (Ex-Gerät nicht)', !!newNode.push?.devA && !newNode.push?.devX, JSON.stringify(Object.keys(newNode.push || {})));
  check('A6 Login-Freigaben ziehen nicht mit', !newNode.ls);
  const iBackup = calls.findIndex(c => c.api === 'backup' && c.method === 'POST'), iRotate = calls.findIndex(c => c.api === 'rotate');
  check('A7 vorher gesichert (Snapshot mit altem Code)', iBackup >= 0 && calls[iBackup].body.code === OLD && calls[iBackup].body.action === 'snapshot');
  check('A8 Server erfährt {old, new}', iRotate > iBackup && calls[iRotate].body.old === OLD && calls[iRotate].body.new === NEW, JSON.stringify(calls[iRotate]?.body));
  // Code-Sheet schließen, dann schreibt eine neue Ausgabe unter den NEUEN Code
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).click(); await page.waitForTimeout(300);
  await page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first().click(); await page.waitForTimeout(300);
  await page.locator('.sheet .field').first().fill('NachWechsel');
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await page.waitForTimeout(250);
  await page.locator('.sheet .f-euro .field').fill('4');
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await page.waitForTimeout(250);
  await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click(); await page.waitForTimeout(1200);
  const t2 = await tree(page);
  check('A9 neue Ausgabe landet unter dem neuen Code, nicht unter dem alten', Object.values(t2.wg[NEW]?.hs || {}).some(i => i.name === 'NachWechsel') && !JSON.stringify(t2.wg[OLD]).includes('NachWechsel'));
  await ctx.close();
}

// ── R) Server nicht erreichbar → nichts geändert ──
{
  const { page, ctx } = await device({ me: 'u1', dev: 'devA', seedTree: { wg: { [OLD]: SEED } }, rotateStatus: 500 });
  await openMehr(page);
  await page.getByRole('button', { name: /WG-Code wechseln/ }).click(); await page.waitForTimeout(300);
  await page.locator('.sheet').getByRole('button', { name: 'Code wechseln' }).click();
  await page.waitForTimeout(1500);
  const t = await tree(page);
  check('R1 Code unverändert', (await page.evaluate(() => JSON.parse(localStorage.getItem('wg_code')))) === OLD);
  check('R2 alte WG unangetastet (Daten da, kein Marker)', t.wg[OLD]?.hs?.h1 && !t.wg[OLD]?._moved);
  check('R3 halbe Kopie wieder entfernt (nur alte WG im Baum)', Object.keys(t.wg).length === 1, JSON.stringify(Object.keys(t.wg)));
  check('R4 Fehlermeldung sichtbar', /nicht erreichbar|nichts geändert/i.test(await page.locator('.content').innerText()));
  await ctx.close();
}

// ── B) Anderes Gerät mit altem Code ──
{
  const NEW = 'GRÜN-WALD-XYZ789';
  const local = { users: USERS, hs: [{ id: 'hB', name: 'LokalVonB', price: 3, paidBy: 'u2', date: today, settled: false, seq: 5 }] };
  const { page, ctx } = await device({ me: 'u2', dev: 'devB', localData: local,
    seedTree: { wg: { [OLD]: { _moved: true, _mt: Date.now() }, [NEW]: { users: USERS, hs: { h1: SEED.hs.h1 } } } } });
  check('B1 Hinweis „Code geändert" sichtbar', /WG-Code wurde geändert/.test(await page.locator('.moved-banner').innerText().catch(() => '')));
  check('B2 Status-Pille zeigt CODE ALT', /CODE ALT/.test(await page.locator('.nbar, .navbar, header').first().innerText().catch(async () => await page.locator('body').innerText())));
  check('B3 lokale Daten bleiben erhalten', (await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')).hs.map(i => i.name))).includes('LokalVonB'));
  await page.evaluate(() => { window.__wg.updates.length = 0; });
  await page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first().click(); await page.waitForTimeout(300);
  await page.locator('.sheet .field').first().fill('OffenAufB');
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await page.waitForTimeout(250);
  await page.locator('.sheet .f-euro .field').fill('2');
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await page.waitForTimeout(250);
  await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click(); await page.waitForTimeout(1200);
  const t = await tree(page);
  check('B4 KEIN Schreibversuch auf den alten Pfad', (await page.evaluate(() => window.__wg.updates.length)) === 0 && Object.keys(t.wg[OLD]).length === 2);
  // Beitritt mit dem neuen Code → zusammenführen
  await page.locator('.moved-banner').getByRole('button').click(); await page.waitForTimeout(400);
  await page.locator('input[placeholder="Anderen Code eingeben …"]').fill(NEW);
  await page.getByRole('button', { name: 'Beitreten' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Zusammenführen/ }).click(); await page.waitForTimeout(500);
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1500);
  const t3 = await tree(page);
  const names = Object.values(t3.wg[NEW]?.hs || {}).map(i => i.name);
  check('B5 nach Beitritt: lokale Einträge von B sind in der neuen WG', names.includes('LokalVonB') && names.includes('OffenAufB') && names.includes('Klopapier'), names.join(', '));
  check('B6 Hinweis verschwunden', !(await page.locator('.moved-banner').count()));
  await ctx.close();
}

check('F keine Seitenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
