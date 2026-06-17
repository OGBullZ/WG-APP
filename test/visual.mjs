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

const today = (() => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; })();

// Demo-Daten: gemischter Split, Einkaufsliste, Pflanzen, me=Tom (zeigt personalisierten Hero)
const DEMO = {
  users: [
    { id:'u1', name:'Torben', color:'#38bdf8', pp:'TorbenSteen' },
    { id:'u2', name:'Tom',    color:'#fbbf24' },
  ],
  hs: [
    { id:'h1', name:'Putzmittel', price:24, paidBy:'u1', owedBy:'u2', date:today, settled:false },
    { id:'h2', name:'Klopapier',  price:8,  paidBy:'u2', owedBy:null, date:today, settled:false },
    { id:'h3', name:'Internet',   price:30, paidBy:'u1', owedBy:null, date:today, settled:false },
  ],
  sl: [
    { id:'s1', name:'Milch',      addedBy:'u2', date:today, done:false },
    { id:'s2', name:'Müllbeutel', addedBy:'u1', date:today, done:false },
    { id:'s3', name:'Spülmittel', addedBy:'u2', date:today, done:true  },
  ],
  gp: { u1:7, u2:2 },
  gi: [ { id:'g1', name:'Dünger', price:15, paidBy:'u2', date:today, settled:false } ],
};

const browser = await chromium.launch();
const errs = [];

async function newCtx(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([data, meId]) => {
    localStorage.setItem('wg_data', JSON.stringify(data));
    localStorage.setItem('wg_me', JSON.stringify(meId));
    localStorage.setItem('wg_modules', JSON.stringify({ grow:true, clean:true }));
  }, [DEMO, 'u2']);
  await ctx.route('**/*', r => {
    const u = r.request().url();
    return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
  });
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
  await page.waitForTimeout(1700);

  await shot('haushalt');               // personalisierter Hero + gemischter Split + PayPal

  // Wizard: auf Tablet/Desktop zentriertes Modal, auf Handy Bottom-Sheet
  await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(400);
  await shot('wizard-1-name');
  await page.locator('input.field').first().fill('Pizza');

  if (mode === 'mobile') {
    // Tastatur-offen simulieren: --kb hochsetzen (headless hat keine echte Tastatur, die App hebt das Sheet via --kb)
    await page.locator('input.field').first().focus();
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

  if (mode === 'mobile') {
    await tap('🛒 Einkaufsliste'); await shot('einkaufsliste');
    await tap('Growbox');  await shot('growbox');
    await tap('Putzplan'); await shot('putzplan');
    await tap('Mehr');     await shot('mehr');
  } else {
    await tap('Growbox'); await shot('growbox');
  }
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
