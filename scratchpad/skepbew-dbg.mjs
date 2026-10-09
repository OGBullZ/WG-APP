import { chromium } from 'playwright';
import { oeffne, tabKlick } from './skepbew-lib.mjs';
const b = await chromium.launch();
const { ctx, page } = await oeffne(b, { tag: 'DBG' });
await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1600);
console.log(await page.evaluate(() => ({ hero: document.querySelectorAll('.hero-big').length, odo: document.querySelectorAll('.odo').length, odoIn: [...document.querySelectorAll('.odo')].map(o => o.closest('[class]')?.className + ' | ' + o.textContent.slice(0, 20)), tabs: [...document.querySelectorAll('.tabitem')].map(t => t.textContent.trim()) })));
await b.close();
