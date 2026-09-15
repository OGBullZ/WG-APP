/* Sync-Layer, Erst-Read (ref.once). Bisher ungetestet — hier mit einem Firebase-STUB
   statt eines Blocks, damit der Antwort-Zeitpunkt exakt steuerbar ist.

   Kernfrage: Was passiert mit einer Eingabe, die zwischen Verbindungsaufbau und
   Server-Antwort gemacht wird? Genau das ist der Alltag der App — unterwegs aufmachen
   und sofort eine Ausgabe eintippen, während der Erst-Read noch unterwegs ist.
   Der Server beantwortet ihn mit dem Stand von DAVOR.

   Historie: bis wg-v45 war der Eintrag danach spurlos weg — lokal vom Server-Stand
   überschrieben, und der nachlaufende Flush schickte den überschriebenen Stand, sodass
   er auch nie ankam. Gegenprobe „WG übernehmen" muss weiterhin verwerfen. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs'; // Firebase-Ersatz, geteilt mit logins.mjs

const url = 'http://localhost:8099/wgapp.html';

const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const browser = await chromium.launch();
const errors = [];
const pass = [], fail = [];
const check = (n, c) => (c ? pass : fail).push(n);

/* Ein Szenario: frischer Kontext, gestubbtes Firebase, App bis zur Bedienbarkeit. */
async function open({ localData = {}, joinMode = null, code = 'TEST-LOKAL-SYNC001' }) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // Reihenfolge zählt: Playwright wertet Routen UMGEKEHRT zur Registrierung aus — die
  // spezifische Stub-Route muss deshalb nach der allgemeinen kommen.
  await page.route('**/*', r => {
    const u = r.request().url();
    // Push-Server (Backup-Wächter, Pushes) abfangen: Test-Codes gehören nicht an die echte API
    if (u.includes('wg-app-bull-z.vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com|googleapis\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({
    status: 200, contentType: 'application/javascript',
    body: /firebase-app-compat/.test(r.request().url()) ? STUB : '/* steckt im app-Stub */',
  }));

  await page.addInitScript(([d, jm, c, u]) => {
    localStorage.setItem('wg_code', JSON.stringify(c));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_data', JSON.stringify({ users: u, ...d }));
    // Wöchentlichen Start-Ablauf (Push/PayPal/Schulden) abschalten: er kam unter Last NACH der Wegklick-Schleife
    // und legte sich über den Ausgabe-Assistenten → Klick-Timeout (Wackler 15.09.). Dieser Test prüft den Sync.
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    if (jm) sessionStorage.setItem('wg_join_mode', jm);
  }, [localData, joinMode, code, USERS]);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  for (let i = 0; i < 2; i++) {
    const l = page.getByRole('button', { name: 'Später' });
    if (await l.count()) { await l.first().click(); await page.waitForTimeout(300); }
  }
  return page;
}

/* Klick mit Diagnose: schlägt er fehl, Screenshot + Seitenzustand festhalten und laut abbrechen.
   Grund: seltener Wackler (15.09.), nur wenn parallel ein zweiter Browser-Test lief — Knopf 30 s „nicht stabil". */
async function clickDiag(page, loc, name) {
  try { await loc.click({ timeout: 15000 }); }
  catch (e) {
    await page.screenshot({ path: `test/shots/sync-fehler-${name}.png` }).catch(() => {});
    const box = await loc.boundingBox().catch(() => null);
    console.log('DIAG', name, JSON.stringify({ box, sichtbar: await loc.isVisible().catch(() => '?'), ...(await page.evaluate(() => ({
      overlays: [...document.querySelectorAll('.overlay')].map(o => o.innerText.slice(0, 50)),
      anims: document.getAnimations().map(a => a.animationName || a.constructor.name).slice(0, 12),
      sichtbarkeit: document.visibilityState,
    })).catch(() => ({}))) }));
    throw e;
  }
}
const addExpense = async (page, name, amount) => {
  await clickDiag(page, page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first(), 'ausgabe-knopf');
  await page.waitForTimeout(300);
  await page.locator('.sheet .field').first().fill(name);
  await clickDiag(page, page.locator('.sheet-acts .btn', { hasText: 'Weiter' }), 'weiter-1');
  await page.waitForTimeout(250);
  await page.locator('.sheet .f-euro .field').fill(amount);
  await clickDiag(page, page.locator('.sheet-acts .btn', { hasText: 'Weiter' }), 'weiter-2');
  await page.waitForTimeout(250);
  await clickDiag(page, page.locator('.sheet-acts .btn', { hasText: 'Fertig' }), 'fertig');
};
const hsOf = page => page.evaluate(() => (JSON.parse(localStorage.getItem('wg_data')).hs || []).map(i => i.name));
const remoteHs = page => page.evaluate(() => Object.values(window.__wg.remote.hs || {}).map(i => i && i.name));

// ── A) Eingabe während des Erst-Reads, Antwort kommt VOR dem Flush ──────────────
// Der schlimmste Fall: Der Server hat den Eintrag nie gesehen, lokal wird er überschrieben.
{
  const page = await open({});
  check('A1 Erst-Read läuft noch (Aufbau stimmt)', await page.evaluate(() => window.__wg.onceAt === 0));
  await addExpense(page, 'Sofort-Eingabe', '12,50');
  await page.evaluate(() => window.__wg.fire());   // sofort antworten, innerhalb der 400-ms-Flush-Frist
  await page.waitForTimeout(300);
  check('A2 Server hatte den Eintrag beim Antworten nicht', !(await remoteHs(page)).includes('Sofort-Eingabe'));
  await page.waitForTimeout(2500);

  const hs = await hsOf(page);
  check('A3 Eingabe überlebt den Erst-Read', hs.includes('Sofort-Eingabe'));
  check('A4 Eingabe steht in der UI', /Sofort-Eingabe/.test(await page.locator('.content').innerText()));
  check('A5 Fremd-Eintrag vom Server kam dazu', hs.includes('VomServer'));
  check('A6 Eingabe ist beim Server angekommen', (await remoteHs(page)).includes('Sofort-Eingabe'));
  await page.context().close();
}

// ── B) Eingabe während des Erst-Reads, Antwort kommt NACH dem Flush ─────────────
{
  const page = await open({ code: 'TEST-LOKAL-SYNC002' });
  await addExpense(page, 'Spaete-Eingabe', '7,00');
  await page.waitForTimeout(1200);                  // Flush läuft durch
  check('B1 Flush hat den Eintrag rausgeschickt', (await remoteHs(page)).includes('Spaete-Eingabe'));
  await page.evaluate(() => window.__wg.fire());    // Antwort trägt den Stand von vorher
  await page.waitForTimeout(2000);

  const hs = await hsOf(page);
  check('B2 Eingabe überlebt auch hier', hs.includes('Spaete-Eingabe'));
  check('B3 Fremd-Eintrag ist da', hs.includes('VomServer'));
  await page.context().close();
}

// ── C) Normaler Start ohne Eingabe: der Server gewinnt ──────────────────────────
// Wichtige Gegenprobe zum Fix — veraltete lokale Posten dürfen NICHT auferstehen.
{
  const page = await open({
    code: 'TEST-LOKAL-SYNC003',
    localData: { hs: [{ id: 'alt1', name: 'AltLokal', price: 3, paidBy: 'u1', date: '2026-07-01', settled: false, seq: 1 }] },
  });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(2000);

  const hs = await hsOf(page);
  check('C1 Server-Stand gewinnt beim normalen Start', hs.includes('VomServer'));
  check('C2 veralteter lokaler Posten ist weg (kein Wiederauferstehen)', !hs.includes('AltLokal'));
  check('C3 nichts Lokales an den Server zurückgeschrieben', !(await remoteHs(page)).includes('AltLokal'));
  await page.context().close();
}

// ── D) „WG übernehmen": lokale Daten werden bewusst verworfen ───────────────────
// Auch dann, wenn währenddessen noch etwas eingetippt wird — der Nutzer hat sich
// ausdrücklich für den fremden Stand entschieden.
{
  const page = await open({
    code: 'TEST-LOKAL-SYNC004',
    joinMode: 'remote',
    localData: { hs: [{ id: 'alt2', name: 'AltVorBeitritt', price: 4, paidBy: 'u1', date: '2026-07-02', settled: false, seq: 1 }] },
  });
  await addExpense(page, 'WaehrendBeitritt', '5,00');
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(2500);

  const hs = await hsOf(page);
  check('D1 „WG übernehmen" bringt den fremden Stand', hs.includes('VomServer'));
  check('D2 alter lokaler Stand ist verworfen', !hs.includes('AltVorBeitritt'));
  check('D3 auch die Eingabe während des Beitritts ist verworfen', !hs.includes('WaehrendBeitritt'));
  await page.context().close();
}

// ── E) Löschung, während der Write noch unterwegs ist ───────────────────────────
// Der Listener überspringt Keys, an denen gerade geschrieben wird (`dirty`) — aber nach
// dem Flush hängt der Write in `inflight`, und ein Remote-Event trägt dann noch den
// Stand VOR der Löschung. Frage: steht der gelöschte Posten danach wieder da?
{
  const page = await open({ code: 'TEST-LOKAL-SYNC005' });
  await page.evaluate(() => {
    window.__wg.remote.hs.b = { id: 'b', name: 'ZweiterPosten', price: 5, paidBy: 'u1', date: '2026-08-01', settled: false, seq: 2 };
    window.__wg.fire();
  });
  await page.waitForTimeout(1200);
  check('E1 beide Server-Posten sind da', (await hsOf(page)).length === 2);

  // Ab jetzt bleiben Writes unterwegs: der Server bestätigt sie nicht und kennt sie nicht.
  await page.evaluate(() => { window.__wg.holdWrites = true; });
  await clickDiag(page, page.locator('.del-btn[aria-label="Ausgabe löschen"]').first(), 'E-loeschen');
  await page.waitForTimeout(900);   // Flush ist raus (dirty leer), Bestätigung steht aus

  const afterDelete = await hsOf(page);
  const deletedName = ['VomServer', 'ZweiterPosten'].find(n => !afterDelete.includes(n));
  check('E2 Posten ist lokal gelöscht', afterDelete.length === 1 && !!deletedName);

  // Jetzt ein Fremd-Event mit dem Server-Stand von vor der Löschung
  await page.evaluate(() => window.__wg.pushRemote());
  await page.waitForTimeout(800);

  const afterEvent = await hsOf(page);
  check('E3 gelöschter Posten bleibt gelöscht (kein Zombie)', !afterEvent.includes(deletedName));
  check('E4 UI zeigt ihn auch nicht wieder', !(await page.locator('.content').innerText()).includes(deletedName));

  // Write kommt durch — die Löschung muss auch beim Server ankommen
  await page.evaluate(() => window.__wg.releaseWrites());
  await page.waitForTimeout(900);
  check('E5 Löschung ist beim Server angekommen', (await remoteHs(page)).length === 1);
  check('E6 lokal weiterhin nur ein Posten', (await hsOf(page)).length === 1);
  await page.context().close();
}

// ── G) Gegenprobe zum inflight-Schutz: Fremd-Änderung darf nicht verlorengehen ──
// Der Listener überspringt Keys mit offenem eigenem Write. Kommt in genau diesem Fenster
// eine Änderung vom anderen Gerät, wird sie verworfen — sie MUSS mit dem Event nach der
// Bestätigung nachkommen, sonst wäre der Zombie-Fix ein Verlust in der Gegenrichtung.
{
  const page = await open({ code: 'TEST-LOKAL-SYNC006' });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);

  await page.evaluate(() => { window.__wg.holdWrites = true; });
  await addExpense(page, 'MeineAusgabe', '3,00');
  await page.waitForTimeout(900);   // Write ist raus, Bestätigung steht aus

  // Das andere Gerät trägt währenddessen etwas ein
  await page.evaluate(() => {
    window.__wg.remote.hs.fremd = { id: 'fremd', name: 'VomAnderenGeraet', price: 6, paidBy: 'u2', date: '2026-08-02', settled: false, seq: 3 };
    window.__wg.pushRemote();
  });
  await page.waitForTimeout(700);
  check('G1 während des eigenen Writes wird die Fremd-Änderung zurückgehalten',
    !(await hsOf(page)).includes('VomAnderenGeraet'));
  check('G2 die eigene Eingabe steht unverändert da', (await hsOf(page)).includes('MeineAusgabe'));

  // Bestätigung kommt → das folgende Event trägt beides
  await page.evaluate(() => window.__wg.releaseWrites());
  await page.waitForTimeout(1200);

  const finalHs = await hsOf(page);
  check('G3 Fremd-Änderung kommt nach der Bestätigung an', finalHs.includes('VomAnderenGeraet'));
  check('G4 eigene Eingabe ist weiterhin da', finalHs.includes('MeineAusgabe'));
  check('G5 Server hat beides', (await remoteHs(page)).includes('MeineAusgabe') && (await remoteHs(page)).includes('VomAnderenGeraet'));
  await page.context().close();
}

// ── H) Jeder Listen-Key muss im Sync-Satz stehen (LIST_KEYS ⊆ KEYS) ─────────────
// Bis wg-v52 fehlte `bo` (Ankündigungen) in INIT und damit in KEYS: der Live-Listener
// übernahm Fremd-Einträge nie (erst nach Neustart), und eine Löschung in einer frischen
// Sitzung ging nie zum Server (Diff-Basis fehlte) → Eintrag kam beim nächsten Start zurück.
{
  const z2 = n => String(n).padStart(2, '0');
  const d = new Date(), today = `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}`;
  const page = await open({ code: 'TEST-LOKAL-SYNC007' });
  check('H1 jeder LIST_KEY ist ein Sync-Key', await page.evaluate(() => LIST_KEYS.every(k => KEYS.includes(k))));
  await page.evaluate(t => {
    window.__wg.remote.bo = { b1: { id: 'b1', kind: 'besuch', text: 'ServerBesuch', date: t, by: 'u2', ts: 1, seq: 1 } };
    window.__wg.fire();
  }, today);
  await page.waitForTimeout(1200);
  const boOf = () => page.evaluate(() => (JSON.parse(localStorage.getItem('wg_data')).bo || []).map(b => b.text));
  check('H2 Ankündigung vom Server kommt beim Start an', (await boOf()).includes('ServerBesuch'));

  // Fremd-Eintrag während der Sitzung → muss live erscheinen, nicht erst nach Neustart
  await page.evaluate(t => {
    window.__wg.remote.bo.b2 = { id: 'b2', kind: 'wecker', text: 'LiveWecker', date: t, by: 'u2', ts: 2, seq: 2 };
    window.__wg.pushRemote();
  }, today);
  await page.waitForTimeout(800);
  check('H3 Fremd-Ankündigung wird live übernommen', (await boOf()).includes('LiveWecker'));

  // Löschen in dieser (frischen) Sitzung muss beim Server ankommen
  // Kein ×-Knopf = Ankündigung gar nicht sichtbar → laut rot statt Timeout-Absturz
  const delBtn = page.locator('.del-btn[aria-label="Ankündigung entfernen"]');
  check('H4a Ankündigung ist in der UI sichtbar (×-Knopf da)', await delBtn.count() > 0);
  if (await delBtn.count()) {
    await delBtn.first().click();
    await page.waitForTimeout(1200);
    const remoteBo = await page.evaluate(() => Object.keys(window.__wg.remote.bo || {}));
    check('H4 gelöschte Ankündigung ist auch beim Server weg', remoteBo.length === 1);
  }
  await page.context().close();
}

check('F keine Konsolen-/Seitenfehler', errors.length === 0);

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
if (errors.length) console.log('\nFEHLER:\n' + errors.join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);

await browser.close();
process.exit(fail.length ? 1 : 0);
