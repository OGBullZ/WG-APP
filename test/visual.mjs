/* Visuelle Test-Harness: fährt die App in iPhone-Emulation durch alle Screens
   + den Ausgabe-Wizard und legt Screenshots in test/shots/ ab.
   Firebase wird geblockt → läuft isoliert lokal mit Demo-Daten (echte WG unberührt).
   Start:  npm run serve   (in einem Terminal)
           node test/visual.mjs
   Danach kann Claude die PNGs in test/shots/ ansehen (Read-Tool). */
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
    { id:'h1', name:'Putzmittel',     price:24, paidBy:'u1', owedBy:'u2', date:today, settled:false },
    { id:'h2', name:'Klopapier',      price:8,  paidBy:'u2', owedBy:null, date:today, settled:false },
    { id:'h3', name:'Internet',       price:30, paidBy:'u1', owedBy:null, date:today, settled:false },
  ],
  sl: [
    { id:'s1', name:'Milch',     addedBy:'u2', date:today, done:false },
    { id:'s2', name:'Müllbeutel',addedBy:'u1', date:today, done:false },
    { id:'s3', name:'Spülmittel',addedBy:'u2', date:today, done:true  },
  ],
  gp: { u1:7, u2:2 },
  gi: [ { id:'g1', name:'Dünger', price:15, paidBy:'u2', date:today, settled:false } ],
};

const device = devices['iPhone 13'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...device });
await ctx.addInitScript(([data, meId]) => {
  localStorage.setItem('wg_data', JSON.stringify(data));
  localStorage.setItem('wg_me', JSON.stringify(meId));
  localStorage.setItem('wg_modules', JSON.stringify({ grow:true, clean:true }));
}, [DEMO, 'u2']);
await ctx.route('**/*', r => {
  const u = r.request().url();
  return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });

const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('📸 ' + name); };
const tap  = async (text) => { await page.locator(`text=${text}`).first().click(); await page.waitForTimeout(450); };

await page.goto(url, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1800);

// 1. Haushalt – Ausgaben (personalisierter Hero + gemischter Split + PayPal)
await shot('01-haushalt-ausgaben');

// 2. Wizard durchklicken
await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(400);
await shot('02-wizard-schritt1-name');
await page.locator('input.field').first().fill('Pizza');
await page.getByRole('button',{name:'Weiter'}).click(); await page.waitForTimeout(300);
await shot('03-wizard-schritt2-preis-datum');
await page.locator('input[inputmode="decimal"]').fill('18,50');
await page.getByRole('button',{name:'Weiter'}).click(); await page.waitForTimeout(300);
await shot('04-wizard-schritt3-zusammenfassung-split');
await page.getByRole('button',{name:'Abbrechen'}).click(); await page.waitForTimeout(300);

// 3. Einkaufsliste
await tap('🛒 Einkaufsliste');
await shot('05-einkaufsliste');

// 4. Growbox
await tap('Growbox');
await shot('06-growbox');

// 5. Putzplan
await tap('Putzplan');
await shot('07-putzplan');

// 6. Mehr
await tap('Mehr');
await shot('08-mehr');

console.log('\nScreenshots in ' + OUT + '/');
console.log('Konsole-Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
