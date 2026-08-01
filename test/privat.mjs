/* Ad-hoc-Verifikation privater Finanzbereich (PIN + lokal-only). */
import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
const page = await ctx.newPage();

// ERR_FAILED = die absichtlich geblockten Firebase-Requests, kein echter Fehler
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com'))
    return route.abort();
  return route.continue();
});
await page.routeWebSocket(/./, () => {});

const pass = [], fail = [];
const check = (n, c) => (c ? pass : fail).push(n);

// Bestandsgerät simulieren: wg_modules hat fin:false gespeichert → Migration muss greifen
// Nur beim allerersten Load seeden — sonst würde der Reload den Migrations-Effekt überschreiben
await page.addInitScript(() => {
  if (localStorage.getItem('wg_modules')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-AAAAAA'));
  localStorage.setItem('wg_modules', JSON.stringify({ haus:true, grow:true, putz:true, fin:false, abos:false, stats:true }));
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
// siehe archive.mjs — hier auf das gerenderte Wurzelelement warten statt auf die
// Tabbar, die in diesem Szenario hinter dem Start-Overlay nicht sichtbar wird.
await page.locator('#root > *').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(2200);
// Start-Pop-ups wegklicken
for (let i = 0; i < 2; i++) {
  const later = page.getByRole('button', { name: 'Später' });
  if (await later.count()) { await later.first().click(); await page.waitForTimeout(400); }
}

// 1) Tab sichtbar trotz gespeichertem fin:false
const tabPrivat = page.locator('.tabbar').getByText('Privat', { exact: true });
check('1 Tab "Privat" sichtbar (Migration schlägt gespeichertes fin:false)', await tabPrivat.count() === 1);
const modsAfter = await page.evaluate(() => localStorage.getItem('wg_modules'));
check('1b Migration persistiert fin:true in wg_modules (überlebt Neustart)', /"fin":true/.test(modsAfter||''));

await tabPrivat.click();
await page.waitForTimeout(600);

// 2) Sperrbildschirm: PIN festlegen
check('2 Sperrbildschirm mit PIN-Pad', await page.locator('.pin-pad').count() === 1);
check('2b Titel "PIN festlegen"', (await page.locator('.pin-title').innerText()).includes('PIN festlegen'));
check('2c Buchungen NICHT sichtbar solange gesperrt', await page.locator('.summary').count() === 0);

const tap = async digits => { for (const d of digits) { await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).click(); await page.waitForTimeout(90); } };

await tap('1234');
await page.waitForTimeout(400);
check('3 Nach 1. Eingabe: Wiederholung verlangt', (await page.locator('.pin-title').innerText()).includes('wiederholen'));

// Absichtlich falsch wiederholen
await tap('9999');
await page.waitForTimeout(500);
check('4 Abweichende Wiederholung wird abgelehnt', (await page.locator('.pin-err').innerText()).includes('nicht überein'));
await page.waitForTimeout(1600);

// Korrekt anlegen
await tap('1234');
await page.waitForTimeout(400);
await tap('1234');
await page.waitForTimeout(700);
check('5 Nach PIN-Anlage entsperrt (Monatsübersicht da)', await page.locator('.summary').count() === 1);
check('5b Hinweis "nur auf diesem Gerät"', (await page.locator('.priv-note').first().innerText()).includes('Nur auf diesem Gerät'));
check('5c NBar-Pille LOKAL', (await page.locator('.live-pill').innerText().catch(()=>'')).includes('LOKAL'));

// 6) Fixkosten Miete anlegen
await page.getByRole('button', { name: '📌 Fixkosten' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '+ Fixkosten' }).click();
await page.waitForTimeout(300);
await page.locator('input.field').first().fill('Miete');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('input[inputmode="decimal"]').fill('480,50');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('button', { name: 'Monatlich' }).click();
await page.waitForTimeout(200);
await page.locator('input[inputmode="numeric"]').fill('3');
await page.getByRole('button', { name: /Fertig|Speichern/ }).click();
await page.waitForTimeout(600);
const fixTxt = await page.locator('.group').innerText();
check('6 Fixkosten "Miete" angelegt', /Miete/.test(fixTxt) && /480,50/.test(fixTxt));
check('6b Fälligkeitstag angezeigt', /am 3\./.test(fixTxt));

// 7) Einnahme buchen
await page.getByRole('button', { name: '💳 Buchungen' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '+ Buchung' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '📈 Einnahme' }).click();
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('input[inputmode="decimal"]').fill('1450');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('button', { name: 'Wohnen', exact: true }).click();
await page.locator('input.field[placeholder*="Notiz"]').fill('Gehalt');
await page.getByRole('button', { name: /Fertig|Speichern/ }).click();
await page.waitForTimeout(600);
const sumTxt = await page.locator('.summary').innerText();
check('7 Einnahme exakt in Monatsbilanz (1.450,00 statt 1,4K)', sumTxt.includes('1.450,00'));
check('7b Fixkosten/Mo. korrekt', /480,50/.test(sumTxt));
check('7c "bleibt" = 1450-480,50 = 969,50', /969,50/.test(sumTxt));

// 8) Kein Sync: nichts in wg_data, alles in wg_priv
const store = await page.evaluate(() => ({
  priv: localStorage.getItem('wg_priv'),
  data: localStorage.getItem('wg_data'),
  pin:  localStorage.getItem('wg_priv_pin'),
}));
check('8 wg_priv enthält Miete + Gehalt', /Miete/.test(store.priv||'') && /Gehalt/.test(store.priv||''));
check('8b wg_data (gesynct) enthält KEINE privaten Daten', !/Miete/.test(store.data||'') && !/Gehalt/.test(store.data||'') && !/"ft"/.test(store.data||'') && !/"ff"/.test(store.data||''));
check('8c PIN nur als Hash+Salt gespeichert (kein Klartext "1234")', /"h":/.test(store.pin||'') && !/1234/.test(store.pin||''));

// 9) Sperren-Button
await page.getByRole('button', { name: '🔒 Sperren' }).click();
await page.waitForTimeout(500);
check('9 Sperren schließt den Bereich wieder ab', await page.locator('.pin-pad').count() === 1 && await page.locator('.summary').count() === 0);

// 10) Falsche PIN
await tap('0000');
await page.waitForTimeout(600);
check('10 Falsche PIN abgewiesen', (await page.locator('.pin-err').innerText()).includes('Falsche PIN'));
await page.waitForTimeout(1600);
await tap('1234');
await page.waitForTimeout(700);
check('10b Richtige PIN entsperrt', await page.locator('.summary').count() === 1);

// 11) Reload → wieder gesperrt, Daten aber noch da
try {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 2; i++) {
    const later = page.getByRole('button', { name: 'Später' });
    if (await later.count()) { await later.first().click(); await page.waitForTimeout(400); }
  }
  if (await page.locator('.pin-pad').count() === 0) {
    await page.locator('.tabbar').getByText('Privat', { exact: true }).click({ timeout: 8000 });
    await page.waitForTimeout(600);
  }
  check('11 Nach Reload wieder gesperrt', await page.locator('.pin-pad').count() === 1);
  check('11b Kein erneutes Anlegen, sondern Abfrage', (await page.locator('.pin-title').innerText()).includes('PIN eingeben'));
  await tap('1234');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '📌 Fixkosten' }).click(); await page.waitForTimeout(400);
  check('11c Daten nach Reload erhalten', /Miete/.test(await page.locator('.content').innerText()));
} catch (e) {
  fail.push('11 Reload-Block: ' + e.message.split('\n')[0]);
}

console.log('PASS:'); pass.forEach(p => console.log('  ✓ ' + p));
if (fail.length) { console.log('FAIL:'); fail.forEach(f => console.log('  ✗ ' + f)); }
console.log(`\n${pass.length}/${pass.length + fail.length} bestanden`);
if (errors.length) console.log('Konsolen-Fehler:\n' + errors.join('\n'));

await browser.close();
process.exit(fail.length || errors.length ? 1 : 0);
