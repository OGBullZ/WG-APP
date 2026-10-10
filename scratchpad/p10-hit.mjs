/* P10: Trefferfläche der Kopf-Aktionen „+ Neu" (Putzplan), „+ Tonne", „+ Ernte" (Growbox) — wie in test/hier_v112.mjs e3 gemessen */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = { users: U, gp: { u1: 2, u2: 3 }, gh: [{ id: 'gh1', date: vor(30), grams: 40 }], pt: map([{ id: 't1', name: 'Bad', em: '🚿', interval: 7, pts: 3, lastDone: vor(2), assignee: 'u1' }]), mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]) };
const browser = await chromium.launch();
for (const [tab, re] of [['putz', /\+ Neu/], ['putz', /\+ Tonne/], ['grow', /\+ Ernte/]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, tb]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HIT')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify(tb)); localStorage.setItem('wg_lang', JSON.stringify('de')); }, [SEED, T, tab]);
  const page = await ctx.newPage();
  await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const r = await page.evaluate(src => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll('.section-hdr button')].find(x => re.test(x.textContent));
    b.scrollIntoView({ block: 'center' });
    const er = b.getBoundingClientRect(), cx = er.left + er.width / 2, cy = er.top + er.height / 2;
    const trifft = dy => { const el = document.elementFromPoint(cx, cy + dy); return el === b || b.contains(el); };
    let o = 0, u = 0; while (o < 60 && trifft(-(o + 1))) o++; while (u < 60 && trifft(u + 1)) u++;
    const hdr = b.closest('.section-hdr');
    return { text: b.textContent, h: er.height, oben: o, unten: u, summe: o + u + 1, padB: getComputedStyle(hdr).paddingBottom };
  }, re.source);
  console.log(tab, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
