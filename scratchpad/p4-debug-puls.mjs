/* P4-Debug: warum findet der Test am HEAD-Stand keine heroPulse-Animation? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0'); const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], hs: { h1: { id: 'h1', seq: 1, name: 'A', price: 5, paidBy: 'u1', date: T, settled: false } }, cf: { wg: { id: 'wg', name: 'W', em: '🏠' } } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('X-P4')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify('dark')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.locator('.tabbar').waitFor(); await p.evaluate(() => window.__wg.fire()); await p.waitForTimeout(800);
await p.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).click(); await p.waitForTimeout(800); if (process.env.DETOUR) { await p.locator('.tabbar .tabitem', { hasText: 'Growbox' }).click(); await p.waitForTimeout(600); await p.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).click(); await p.waitForTimeout(800); }
await p.getByText('+ Ausgabe hinzufügen').click(); await p.waitForTimeout(450);
await p.locator('.sheet input.field').first().fill('Puls'); await p.getByRole('button', { name: 'Weiter' }).click(); await p.waitForTimeout(350);
await p.locator('input[inputmode="decimal"]').fill('9,90'); await p.getByRole('button', { name: 'Weiter' }).click(); await p.waitForTimeout(350);
await p.locator('.sheet .pick-btn', { hasText: /^Torben$/ }).click(); await p.locator('.sheet .pick-btn', { hasText: 'Gleich teilen' }).click();
await p.getByRole('button', { name: 'Fertig', exact: true }).click();
const r = await p.evaluate(() => new Promise(res => { const t0 = performance.now(); const log = []; const tick = () => { const el = document.querySelector('.hero-pulse'); if (el) { log.push({ t: Math.round(performance.now() - t0), cls: el.className, an: getComputedStyle(el).animationName, n: el.getAnimations().map(a => a.animationName) }); if (log.length > 4) return res(log); } if (performance.now() - t0 > 4000) return res(log); requestAnimationFrame(tick); }; tick(); }));
console.log(JSON.stringify(r, null, 1));
await b.close();
