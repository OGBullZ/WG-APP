/* Visuelle Test-Harness: fährt die App durch alle Screens + den Ausgabe-Wizard
   in DREI Breakpoints (Handy / Tablet / Desktop) PLUS einem Tastatur-offen-Zustand
   und legt Screenshots in test/shots/ ab.
   Firebase wird geblockt → läuft isoliert lokal mit Demo-Daten (echte WG unberührt).
   Start:  npm run serve   (in einem Terminal)
           node test/visual.mjs   (bzw. npm run visual)
   Danach kann Claude die PNGs in test/shots/ ansehen (Read-Tool).

   PFLICHT (global, siehe Memory feedback-visual-harness): bei JEDER UI-Änderung
   müssen alle drei Breakpoints UND der Tastatur-offen-Zustand mit-geprüft werden. */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';

const url = 'http://localhost:8099/wgapp.html';
const OUT = 'test/shots';
mkdirSync(OUT, { recursive: true });

const z2 = n => String(n).padStart(2,'0');
const ago = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}`; };
const today = ago(0);

// Demo-Daten: gemischter Split, Einkaufsliste, Pflanzen, me=Tom (zeigt personalisierten Hero)
const DEMO = {
  users: [
    { id:'u1', name:'Torben', color:'#38bdf8', pp:'TorbenSteen' },
    { id:'u2', name:'Tom',    color:'#fbbf24' },
  ],
  hs: [
    { id:'h1', name:'Putzmittel', price:24, paidBy:'u1', owedBy:'u2', date:today, settled:false, cat:'home' },
    { id:'h2', name:'Klopapier',  price:8,  paidBy:'u2', owedBy:null, date:today, settled:false, cat:'home' },
    { id:'h3', name:'Internet',   price:30, paidBy:'u1', owedBy:null, date:today, settled:false, cat:'fix' },
  ],
  sl: [
    { id:'s1', name:'Milch',      addedBy:'u2', date:today, done:false },
    { id:'s2', name:'Müllbeutel', addedBy:'u1', date:today, done:false },
    { id:'s3', name:'Spülmittel', addedBy:'u2', date:today, done:true  },
  ],
  gp: { u1:7, u2:2 },
  gi: [
    { id:'g1', name:'Dünger', price:15, paidBy:'u2', date:today, settled:false, cat:'duenger' },
    { id:'g2', name:'LED-Panel', price:60, paidBy:'u1', date:today, settled:false, cat:'equip' },
  ],
  gh: [ { id:'e1', date:today, grams:42.5, note:'Northern Lights' } ],
  // Laufender Zyklus im Warnzustand: Gießen 1 Tag überfällig (zeigt die auffällige Variante der Karte)
  gz: [ { id:'c1', start:ago(44), phase:'blu', pAt:ago(11), wiv:3, lastW:ago(4), lastWBy:'u1', wn:11 } ],
  bud: [ { id:'home', limit:30 } ],
  slh: [ { id:'hafermilch', name:'Hafermilch', n:5 }, { id:'tofu', name:'Tofu', n:3 } ],
  // Eingehende Login-Freigabe von Torben (Chiffretext ist Attrappe — wird hier nur angezeigt, nie eingelöst)
  ls: [ { id:'l1', svc:'Netflix', by:'u1', ts:Date.now(), exp:Date.now()+20*3600e3, view:15, s:'AAAA', iv:'AAAA', ct:'AAAA', it:250000 } ],
};
// Gerade sichtbarer Login (bereits eingelöst) — zeigt die „noch … sichtbar"-Zeile und das Anzeige-Sheet
const LG_VIEW_DEMO = { id:'l0', svc:'Apple TV', by:'u1', u:'tom.wg@example.org', p:'Demo-Passwort-123', from:Date.now(), until:Date.now()+9*60e3 };

const browser = await chromium.launch();
const errs = [];

async function newCtx(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([data, meId, lgView]) => {
    localStorage.setItem('wg_data', JSON.stringify(data));
    localStorage.setItem('wg_me', JSON.stringify(meId));
    localStorage.setItem('wg_modules', JSON.stringify({ grow:true, putz:true })); // Rest aus MOD_DEF (inkl. stats:true → Übersicht-Tab)
    localStorage.setItem('wg_lg_view', JSON.stringify(lgView));
  }, [DEMO, 'u2', LG_VIEW_DEMO]);
  await ctx.route('**/*', r => {
    const u = r.request().url();
    return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
  });
  // RTDB synct per WebSocket — route() fängt WS NICHT ab, ohne das hier leaken Demo-Daten als Junk-WG in die echte DB
  await ctx.routeWebSocket(/./, () => {});
  return ctx;
}

// Ein kompletter Durchlauf in einem Breakpoint. mode: 'mobile' = voller Walk + Tastatur; sonst Kernscreens.
async function run(prefix, ctxOpts, mode) {
  const ctx = await newCtx(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`[${prefix}] PAGEERROR: ` + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errs.push(`[${prefix}] ` + m.text()); });
  const shot = async (n) => { await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/${prefix}-${n}.png` }); console.log(`📸 ${prefix}-${n}`); };
  const tap  = async (t) => { await page.locator(`text=${t}`).first().click(); await page.waitForTimeout(420); };

  await page.goto(url, { waitUntil:'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });   // siehe archive.mjs
  await page.waitForTimeout(1700);

  // Start-Flow (me=Tom, keine Push-Berechtigung + kein PayPal-Handle + Schulden):
  // erst Push-Aufforderung, dann PayPal-Einrichtung, dann Schulden-Pop-up — jeweils „Später", damit die Kern-Screenshots frei sind.
  if (await page.getByText('Benachrichtigungen', { exact:true }).isVisible().catch(()=>false)) {
    if (mode==='mobile') await shot('start-popup-push');
    await page.getByRole('button', { name:'Später' }).click();
    await page.waitForTimeout(400);
  }
  if (await page.getByText('PayPal einrichten').isVisible().catch(()=>false)) {
    if (mode==='mobile') await shot('start-popup-paypal');
    await page.getByRole('button', { name:'Später' }).click();
    await page.waitForTimeout(400);
  }
  if (await page.getByText('Du schuldest').isVisible().catch(()=>false)) {
    if (mode==='mobile') await shot('start-popup-schulden');
    await page.getByRole('button', { name:'Später' }).click();
    await page.waitForTimeout(400);
  }

  await shot('haushalt');               // personalisierter Hero + gemischter Split + PayPal

  // Wizard: auf Tablet/Desktop zentriertes Modal, auf Handy Bottom-Sheet
  await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(400);
  await shot('wizard-1-name');
  await page.locator('.sheet input.field').first().fill('Pizza');

  if (mode === 'mobile') {
    // Tastatur-offen simulieren: --kb hochsetzen (headless hat keine echte Tastatur, die App hebt das Sheet via --kb)
    await page.locator('.sheet input.field').first().focus();
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px'));
    await shot('wizard-1-tastatur-offen');
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '0px'));
  }

  await page.getByRole('button', { name:'Weiter' }).click(); await page.waitForTimeout(300);
  await shot('wizard-2-preis-datum');
  await page.locator('input[inputmode="decimal"]').fill('18,50');
  await page.getByRole('button', { name:'Weiter' }).click(); await page.waitForTimeout(300);
  await shot('wizard-3-zusammenfassung-split');
  await page.getByRole('button', { name:'Abbrechen' }).click(); await page.waitForTimeout(300);

  // ── Abo-Logins: Karte → Code eingeben → sichtbarer Login → Freigabe anlegen → Code ──
  // Auf den unteren Knopf der Karte zielen — die Überschrift allein landet hinter der Tabbar
  await page.getByRole('button', { name:/Login freigeben/ }).scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await shot('logins-1-karte');
  await page.getByRole('button', { name:'Code eingeben' }).click(); await page.waitForTimeout(350);
  await page.getByLabel('Einmal-Code').fill('K7QF9XMP');
  await shot('logins-2-code-eingeben');
  await page.getByRole('button', { name:'Abbrechen' }).click(); await page.waitForTimeout(300);
  await page.getByText(/Apple TV · noch/).click(); await page.waitForTimeout(350);
  await shot('logins-3-sichtbar');
  await page.getByRole('button', { name:'Schließen' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name:/Login freigeben/ }).click(); await page.waitForTimeout(350);
  await page.getByLabel('Dienst').fill('Disney+');
  await page.getByLabel('E-Mail oder Benutzername').fill('wg@example.org');
  await page.getByLabel('Passwort').fill('geheim');
  await shot('logins-4-freigeben');
  if (mode === 'mobile') {
    await page.getByLabel('Passwort').focus();
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px'));
    // iOS scrollt das fokussierte Feld selbst ins Bild — headless nicht, also nachbilden
    await page.getByLabel('Passwort').scrollIntoViewIfNeeded();
    await shot('logins-4-freigeben-tastatur-offen');
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '0px'));
  }
  await page.getByRole('button', { name:'Code erzeugen' }).click();
  await page.locator('[data-testid="lg-code"]').waitFor({ timeout: 8000 });
  await shot('logins-5-code');
  await page.getByRole('button', { name:'Fertig', exact: true }).click(); await page.waitForTimeout(300);
  await shot('logins-6-karte-danach');

  if (mode === 'mobile') {
    await tap('🛒 Einkaufsliste'); await shot('einkaufsliste');
    await tap('Growbox');  await shot('growbox');
    await tap('Putzplan'); await shot('putzplan');
    await tap('Übersicht'); await page.waitForTimeout(700); await shot('uebersicht'); // CountUp ausanimieren lassen
    await tap('Mehr');     await shot('mehr');
  } else {
    await tap('Growbox'); await shot('growbox');
    await tap('Übersicht'); await page.waitForTimeout(700); await shot('uebersicht');
  }

  // ── Privater Finanzbereich: gesperrt → PIN anlegen → entsperrt ──
  // Der Seed unten legt PIN + Demo-Buchungen NICHT an; der Bereich startet also
  // im Einrichtungs-Zustand, genau wie beim ersten echten Öffnen.
  await page.locator('.tabbar .tabitem', { hasText:'Privat' }).click();
  await page.waitForTimeout(450);
  await shot('privat-1-pin-anlegen');
  const pin = async d => { for (const n of d) { await page.locator('.pin-key', { hasText:new RegExp(`^${n}$`) }).click(); await page.waitForTimeout(80); } };
  await pin('1234'); await page.waitForTimeout(350);
  await pin('1234'); await page.waitForTimeout(650);
  await shot('privat-2-uebersicht');
  await page.getByRole('button', { name:'📌 Fixkosten' }).click(); await page.waitForTimeout(350);
  await shot('privat-3-fixkosten');
  await page.getByRole('button', { name:'+ Fixkosten' }).click(); await page.waitForTimeout(400);
  await page.locator('.sheet input.field').first().fill('Miete');
  if (mode === 'mobile') {
    await page.locator('.sheet input.field').first().focus();
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px'));
    await shot('privat-4-wizard-tastatur-offen');
    await page.evaluate(() => document.documentElement.style.setProperty('--kb', '0px'));
  }
  await page.getByRole('button', { name:'Abbrechen' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name:'🔒 Sperren' }).click(); await page.waitForTimeout(450);
  await shot('privat-5-gesperrt');

  await ctx.close();
}

// Handy (iPhone 13) — voller Walk inkl. Tastatur-offen
await run('mobile',  { ...devices['iPhone 13'] }, 'mobile');
// Tablet (iPad-Klasse, Touch) — App nutzt Desktop-Layout ab 700px (zentrierte Spalte, Sheet→Modal)
await run('tablet',  { viewport:{ width:834, height:1112 }, deviceScaleFactor:2, isMobile:true, hasTouch:true }, 'tablet');
// Desktop
await run('desktop', { viewport:{ width:1366, height:900 } }, 'desktop');

console.log('\nScreenshots in ' + OUT + '/');
console.log('Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
process.exit(errs.length ? 1 : 0);
