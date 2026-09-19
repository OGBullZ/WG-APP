/* Einrichtungs-Assistent (wg-v72) im Browser, Firebase per Stub:
   A) Neue WG gründen: Personen → WG-Name → Bereiche → Putzplan/Müll → Geld → Push (später) → Einladen → Fertig
   B) Beitreten per Einladungslink ?join=CODE: Code geprüft, Server-Stand übernommen, „Wer bist du?"
   C) Falscher Code → Meldung, bleibt stehen
   D) Bestehendes Gerät (Code vorhanden): kein Assistent; Einladungslink mit fremdem Code wird ignoriert
   E) „Mehr → Mein Profil einrichten" öffnet den persönlichen Teil */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const OTHER = 'BLAU-MOND-ABC234';
const OTHER_WG = { users: { a: { id: 'x1', name: 'Anna', color: '#38bdf8' }, b: { id: 'x2', name: 'Ben', color: '#fbbf24' } },
  hs: { h: { id: 'h', seq: 1, name: 'Pizza', price: 20, paidBy: 'x1', date: T, settled: false } } };

// fresh = kein wg_code → das Gerät erzeugt selbst einen (wie ein neues Handy)
async function open({ fresh = true, query = '', init = {}, other = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([fr, ini, oth, otherCode, otherWg]) => {
    window.__wgSeed = {};                                   // eigene (neue) WG ist leer
    if (oth) window.__wgTreeSeed = { wg: { [otherCode]: otherWg } };
    if (localStorage.getItem('wg_boot')) return;
    localStorage.setItem('wg_boot', '1');
    if (!fr) { localStorage.setItem('wg_code', JSON.stringify('ALT-CODE-XYZ234')); localStorage.setItem('wg_me', JSON.stringify('u1')); }
    for (const k in ini) localStorage.setItem(k, JSON.stringify(ini[k]));
  }, [fresh, init, other, OTHER, OTHER_WG]);
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(900);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const onb = page.locator('[data-testid="onboarding"]');
  const nextBtn = () => onb.locator('[data-testid="onb-next"]').click().then(() => page.waitForTimeout(500));
  return { ctx, page, errs, data, onb, nextBtn };
}

// ── A: neue WG gründen ──
{
  const A = await open();
  const { page, onb, data, nextBtn } = A;
  check('A1 frisches Gerät → Assistent mit Willkommen', await onb.count() === 1 && /Willkommen/.test(await onb.innerText()));
  await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(500);
  check('A2 Weiter gesperrt ohne eigenen Namen', await onb.locator('[data-testid="onb-next"]').isDisabled());
  await onb.getByLabel('Dein Name').fill('Lena');
  await onb.getByLabel('Mitbewohner 1').fill('Max');
  await onb.getByRole('button', { name: '+ Weitere Person' }).click();
  await onb.getByLabel('Mitbewohner 2').fill('Kim');
  await nextBtn();
  let d = await data();
  const lena = d.users.find(u => u.name === 'Lena');
  check('A3 Personen ersetzen die Vorgabe (kein Torben/Tom), ich bin Lena', d.users.map(u => u.name).join() === 'Lena,Max,Kim' && await page.evaluate(() => JSON.parse(localStorage.getItem('wg_me'))) === lena?.id
    && new Set(d.users.map(u => u.color)).size === 3, JSON.stringify(d.users));
  await onb.getByLabel('Name der WG').fill('WG Sonnenallee');
  await onb.getByRole('button', { name: '🌿' }).click();
  await nextBtn();
  check('A4 WG-Name gespeichert', (await data()).cf.some(x => x.id === 'wg' && x.name === 'WG Sonnenallee' && x.em === '🌿'));
  await onb.getByRole('button', { name: /Growbox/ }).click();
  await nextBtn();
  check('A5 Bereiche: Growbox aus (gilt für dieses Gerät)', await page.evaluate(() => JSON.parse(localStorage.getItem('wg_modules')).grow === false));
  check('A6 Putzplan-Schritt mit vorausgewählten Aufgaben', await onb.getByRole('button', { name: '🗑️ Müll rausbringen' }).getAttribute('aria-pressed') === 'true');
  await onb.getByRole('button', { name: '🪟 Fenster putzen' }).click();
  await onb.getByRole('button', { name: '🔵 Papier' }).click();
  await onb.getByLabel('Papier: nächste Abholung').fill(dayAgo(-5));
  await nextBtn();
  d = await data();
  const pt = d.pt.map(t => t.name);
  check('A7 Aufgaben angelegt und reihum verteilt', ['Müll rausbringen', 'Bad putzen', 'Küche putzen', 'Staubsaugen', 'Fenster putzen'].every(n => pt.includes(n)) && new Set(d.pt.map(t => t.assignee)).size === 3, JSON.stringify(d.pt.map(t => [t.name, t.assignee])));
  check('A8 Müllabfuhr Papier alle 2 Wochen', d.mk.some(m => m.kind === 'papier' && m.start === dayAgo(-5) && m.every === 2), JSON.stringify(d.mk));
  await onb.getByLabel('PayPal.me-Name').fill('lena-m');
  await onb.getByLabel('Kontoinhaber').fill('Lena-Marie Beispiel');
  await onb.getByLabel('IBAN').fill('DE89 3704 0044 0532 0130 01');
  await nextBtn();
  check('A9 falsche IBAN hält an', /IBAN stimmt nicht/.test(await onb.locator('[data-testid="onb-msg"]').innerText().catch(() => '')));
  await onb.getByLabel('IBAN').fill('DE89 3704 0044 0532 0130 00');
  await nextBtn();
  const me1 = (await data()).users.find(u => u.name === 'Lena');
  check('A10 PayPal, Inhaber, IBAN gespeichert', me1.pp === 'lena-m' && me1.holder === 'Lena-Marie Beispiel' && me1.iban === 'DE89370400440532013000', JSON.stringify(me1));
  check('A11 Push-Schritt erklärt, was kommt', /Müll: am Vorabend/.test(await onb.innerText()));
  await nextBtn();   // „Später"
  const code = await onb.locator('[data-testid="onb-code"]').innerText();
  const wa = await onb.locator('[data-testid="onb-wa"]').getAttribute('href');
  check('A12 Einladen: Code + WhatsApp-Link mit ?join=', !!code && decodeURIComponent(wa).includes('?join=' + code), wa);
  await nextBtn();
  check('A13 Fertig-Seite mit Namen', /Fertig, Lena!/.test(await onb.innerText()));
  await onb.locator('[data-testid="onb-finish"]').click(); await page.waitForTimeout(500);
  check('A14 Assistent zu, gemerkt, frisch-Marker weg', await onb.count() === 0 && await page.evaluate(() => !!localStorage.getItem('wg_setup_v1') && !localStorage.getItem('wg_fresh')));
  const hello = await page.locator('[data-testid="today-hello"]').innerText();
  check('A15 Heute: „Hallo, Lena" + WG-Name', /Lena/.test(hello) && /🌿 WG Sonnenallee/.test(hello), hello);
  await page.waitForTimeout(1200);
  check('A16 kein Start-Fenster direkt danach', await page.locator('.overlay').count() === 0);
  await page.reload(); await page.locator('.tabbar').waitFor(); await page.waitForTimeout(800);
  check('A17 nach Neuladen kein Assistent mehr', await page.locator('[data-testid="onboarding"]').count() === 0);
  check('A18 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
  await A.ctx.close();
}

// ── B: Beitreten per Einladungslink ──
{
  const B = await open({ query: '?join=' + OTHER.toLowerCase(), other: true });
  const { page, onb, data } = B;
  check('B1 Link öffnet den Beitreten-Schritt, Code vorbelegt', await onb.getByLabel('WG-Code').inputValue() === OTHER);
  check('B2 Code aus der Adresse entfernt', await page.evaluate(() => location.search) === '');
  await onb.locator('[data-testid="onb-joinnow"]').click(); await page.waitForTimeout(600);
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);   // Erst-Read der neuen WG beantworten
  check('B3 verbunden: Code gewechselt, Personen vom Server', await page.evaluate(() => JSON.parse(localStorage.getItem('wg_code'))) === OTHER && /Anna/.test(await onb.innerText()) && /Ben/.test(await onb.innerText()));
  await onb.getByRole('button', { name: 'Ich bin Ben' }).click(); await page.waitForTimeout(200);
  await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(400);   // → Bereiche
  await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(400);   // → Geld
  check('B4 keine Putzplan-/Einladen-Schritte beim Beitreten', /So bekommst du Geld zurück/.test(await onb.innerText()));
  await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(400);   // → Push
  await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(400);   // → Fertig
  check('B5 Fertig, Ben', /Fertig, Ben!/.test(await onb.innerText()));
  await onb.locator('[data-testid="onb-finish"]').click(); await page.waitForTimeout(400);
  const d = await data();
  check('B6 ich bin Ben, Daten der WG da (Pizza)', await page.evaluate(() => JSON.parse(localStorage.getItem('wg_me'))) === 'x2' && d.hs.some(i => i.name === 'Pizza'));
  check('B7 keine Seitenfehler', B.errs.length === 0, B.errs.join(' | '));
  await B.ctx.close();
}

// ── C: falscher Code ──
{
  const C = await open();
  await C.onb.locator('[data-testid="onb-join"]').click(); await C.page.waitForTimeout(400);
  await C.onb.getByLabel('WG-Code').fill('ROT-SONNE-XYZ789');
  await C.onb.locator('[data-testid="onb-joinnow"]').click(); await C.page.waitForTimeout(600);
  check('C1 unbekannter Code → Meldung, Code bleibt', /keine WG/.test(await C.onb.locator('[data-testid="onb-msg"]').innerText().catch(() => '')) && await C.page.evaluate(() => JSON.parse(localStorage.getItem('wg_code'))) !== 'ROT-SONNE-XYZ789');
  // Neuer Mitbewohner trägt sich selbst ein
  await C.ctx.close();
}
{
  const C2 = await open({ query: '?join=' + OTHER, other: true });
  await C2.onb.locator('[data-testid="onb-joinnow"]').click(); await C2.page.waitForTimeout(600);
  await C2.page.evaluate(() => window.__wg.fire()); await C2.page.waitForTimeout(1200);
  await C2.onb.getByLabel('Neu: dein Name').fill('Chris');
  await C2.onb.getByRole('button', { name: 'Hinzufügen' }).click(); await C2.page.waitForTimeout(400);
  const d = await C2.data();
  const chris = d.users.find(u => u.name === 'Chris');
  check('C2 „Ich bin neu hier": neue Person, Farbe frei, ich bin sie', !!chris && d.users.length === 3 && await C2.page.evaluate(() => JSON.parse(localStorage.getItem('wg_me'))) === chris.id && !['#38bdf8', '#fbbf24'].includes(chris.color), JSON.stringify(d.users));
  await C2.ctx.close();
}

// ── D: bestehendes Gerät ──
{
  const D1 = await open({ fresh: false });
  check('D1 Gerät mit Code: kein Assistent', await D1.onb.count() === 0);
  await D1.ctx.close();
  const D2 = await open({ fresh: false, query: '?join=' + OTHER, other: true });
  check('D2 Einladungslink mit fremdem Code auf bestehendem Gerät: ignoriert, Code bleibt', await D2.onb.count() === 0 && await D2.page.evaluate(() => JSON.parse(localStorage.getItem('wg_code'))) === 'ALT-CODE-XYZ234');
  // E: persönlicher Teil aus „Mehr"
  await D2.page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await D2.page.waitForTimeout(400);
  await D2.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await D2.page.waitForTimeout(300);
  await D2.page.locator('[data-testid="onb-open"]').click(); await D2.page.waitForTimeout(500);
  check('E1 „Mein Profil einrichten" → Assistent ab „Das bist du"', /Das bist du/.test(await D2.onb.innerText().catch(() => '')));
  await D2.onb.getByLabel('Dein Name').fill('Torben S.');
  await D2.onb.locator('[data-testid="onb-next"]').click(); await D2.page.waitForTimeout(400);
  check('E2 Name geändert', (await D2.data()).users.find(u => u.id === 'u1').name === 'Torben S.');
  await D2.onb.getByRole('button', { name: 'Schließen' }).click(); await D2.page.waitForTimeout(300);
  check('E3 Schließen jederzeit möglich', await D2.onb.count() === 0);
  check('E4 keine Seitenfehler', D2.errs.length === 0 && D1.errs.length === 0, D2.errs.join(' | '));
  await D2.ctx.close();
}

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
