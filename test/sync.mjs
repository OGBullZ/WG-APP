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

const url = 'http://localhost:8099/wgapp.html';

// Firebase-Ersatz: nur das, was DataProvider benutzt. Der Test löst die Antwort selbst aus.
const STUB = `
window.__wg = { updates: [], onceAt: 0, listeners: [],
  remote: { users:[{id:'u1',name:'Torben',color:'#38bdf8'},{id:'u2',name:'Tom',color:'#fbbf24'}],
            hs:{ serverItem:{id:'serverItem',name:'VomServer',price:9,paidBy:'u2',date:'2026-08-01',settled:false,seq:1} } } };
(function(){
  function snap(){ var v = JSON.parse(JSON.stringify(window.__wg.remote)); return { val: function(){ return v; } }; }
  function notify(){ window.__wg.listeners.forEach(function(cb){ cb(snap()); }); }
  function Ref(){
    this.once = function(_ev, cb){
      // Der Server antwortet mit dem Stand, den er beim ABSCHICKEN hatte — ein Write,
      // der erst danach ankommt, ist nicht enthalten.
      var atSend = snap();
      window.__wg.fire = function(){ window.__wg.onceAt = Date.now(); cb(atSend); };
      return { then: function(){ return { catch: function(){} }; } };
    };
    // Live-Listener wie die echte RTDB: feuert direkt beim Registrieren mit dem AKTUELLEN
    // Stand und danach bei jeder Änderung. Ohne das testet der Stub eine Welt, in der
    // der Server nie etwas nachliefert — und meldet Fehler, die es real nicht gibt.
    this.on = function(_ev, cb){ window.__wg.listeners.push(cb); setTimeout(function(){ cb(snap()); }, 40); };
    this.off = function(){ window.__wg.listeners.length = 0; };
    this.child = function(){ return new Ref(); };
    this.update = function(u){
      window.__wg.updates.push(u);
      for (var path in u) {
        var parts = path.split('/');
        if (parts.length === 2) {
          var k = parts[0], id = parts[1];
          if (!window.__wg.remote[k]) window.__wg.remote[k] = {};
          if (u[path] === null) delete window.__wg.remote[k][id]; else window.__wg.remote[k][id] = u[path];
        } else if (u[path] !== null) { window.__wg.remote[path] = u[path]; }
      }
      setTimeout(notify, 20);
      return Promise.resolve();
    };
    this.set = this.update;
  }
  window.firebase = {
    initializeApp: function(){ return {}; },
    app: function(){ throw new Error('no app'); },
    database: function(){ return { ref: function(){ return new Ref(); }, goOnline:function(){}, goOffline:function(){} }; },
  };
})();
`;

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
    return /firebasedatabase\.app|firebaseio\.com|googleapis\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat\.js/, r => r.fulfill({
    status: 200, contentType: 'application/javascript',
    body: /firebase-app-compat/.test(r.request().url()) ? STUB : '/* steckt im app-Stub */',
  }));

  await page.addInitScript(([d, jm, c, u]) => {
    localStorage.setItem('wg_code', JSON.stringify(c));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_data', JSON.stringify({ users: u, ...d }));
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

const addExpense = async (page, name, amount) => {
  await page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('.sheet .field').first().fill(name);
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet .f-euro .field').fill(amount);
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
  await page.waitForTimeout(250);
  await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click();
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

check('E keine Konsolen-/Seitenfehler', errors.length === 0);

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
if (errors.length) console.log('\nFEHLER:\n' + errors.join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);

await browser.close();
process.exit(fail.length ? 1 : 0);
