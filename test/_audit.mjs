/* Perf- & a11y-Messung der WG-APP (isoliert, Firebase geblockt).
   node <pfad>/audit.mjs   — Server muss auf 8099 laufen. */
import { chromium, devices } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const today = (() => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; })();
const DEMO = {
  users: [ { id:'u1', name:'Torben', color:'#38bdf8', pp:'TorbenSteen' }, { id:'u2', name:'Tom', color:'#fbbf24' } ],
  hs: [ { id:'h1', name:'Putzmittel', price:24, paidBy:'u1', owedBy:'u2', date:today, settled:false, cat:'home' },
        { id:'h2', name:'Klopapier', price:8, paidBy:'u2', owedBy:null, date:today, settled:false, cat:'home' },
        { id:'h3', name:'Internet', price:30, paidBy:'u1', owedBy:null, date:today, settled:false, cat:'fix' } ],
  sl: [ { id:'s1', name:'Milch', addedBy:'u2', date:today, done:false } ],
  gp: { u1:7, u2:2 },
  gi: [ { id:'g1', name:'Dünger', price:15, paidBy:'u2', date:today, settled:false, cat:'duenger' } ],
  // Laufender Zyklus, damit Phasen-Chips, „Gegossen" und „Beenden" mitgemessen werden
  gz: [ { id:'c1', start:'2026-01-02', phase:'blu', pAt:'2026-01-20', wiv:3, lastW:'2026-01-25', lastWBy:'u1', wn:9 } ],
};

const browser = await chromium.launch();
async function newCtx(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([data, meId]) => {
    localStorage.setItem('wg_data', JSON.stringify(data));
    localStorage.setItem('wg_me', JSON.stringify(meId));
    localStorage.setItem('wg_modules', JSON.stringify({ grow:true, putz:true }));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0,10))); // Start-Flow aus (ls() JSON.parse't!)
  }, [DEMO, 'u2']);
  await ctx.route('**/*', r => {
    const u = r.request().url();
    return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
  });
  await ctx.routeWebSocket(/./, () => {});
  return ctx;
}

// ── 1. PERF ──────────────────────────────────────────────────────────
const THROTTLE = +(process.env.CPU || 4);   // 1 = keine Drosselung, 4 ≈ Mittelklasse-Handy
const ctx = await newCtx({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const bytes = {};
page.on('response', async r => {
  try {
    const u = r.url(); if (u.startsWith('data:')) return;
    const b = await r.body().catch(()=>null);
    if (b) bytes[u.split('/').pop().split('?')[0].slice(0,42)] = Math.round(b.length/1024);
  } catch {}
});
await page.addInitScript(() => {
  window.__lt = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ entryTypes:['longtask'] }); } catch {}
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const t0 = Date.now();
await page.goto(url, { waitUntil:'load' });
await page.waitForSelector('.tabbar', { timeout:30000 });
const tReady = Date.now() - t0;
const lt = await page.evaluate(() => window.__lt || []);
console.log(`=== CPU-Drosselung ${THROTTLE}x ===`);
console.log('  Long-Tasks (Start@ms / Dauer@ms):', lt.map(([s,d])=>`${s}/+${d}`).join(' '));
console.log('  Bytes je Ressource (KB):', Object.entries(bytes).map(([k,v])=>`${k}=${v}`).join(' '));
const perf = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0] || {};
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map(p=>[p.name, Math.round(p.startTime)]));
  const rs = performance.getEntriesByType('resource').map(r=>({ n:r.name.split('/').pop().slice(0,40), d:Math.round(r.duration), size:Math.round((r.transferSize||r.encodedBodySize||0)/1024) }));
  return { dcl: Math.round(n.domContentLoadedEventEnd||0), load: Math.round(n.loadEventEnd||0), paints,
           top: rs.sort((a,b)=>b.size-a.size).slice(0,8), totalKB: Math.round(rs.reduce((s,r)=>s+r.size,0)) };
});
console.log('=== PERF (iPhone 13, lokal, kalt) ===');
console.log('  DOMContentLoaded:', perf.dcl, 'ms | load:', perf.load, 'ms');
console.log('  paints:', JSON.stringify(perf.paints));
console.log('  Tabbar sichtbar (App gerendert):', tReady, 'ms nach goto');
console.log('  Ressourcen gesamt:', perf.totalKB, 'KB');
perf.top.forEach(r => console.log(`    ${String(r.size).padStart(5)} KB  ${String(r.d).padStart(5)} ms  ${r.n}`));

// Babel-Transform-Kosten grob: Zeit zwischen letztem Script-Load und erstem Render
const babel = await page.evaluate(() => {
  const rs = performance.getEntriesByType('resource').filter(r=>/babel/i.test(r.name));
  const fcp = (performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')||{}).startTime||0;
  const lastScript = Math.max(...performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script'||/\.js/.test(r.name)).map(r=>r.responseEnd), 0);
  return { babelKB: Math.round((rs[0]?.transferSize||0)/1024), lastScriptEnd: Math.round(lastScript), fcp: Math.round(fcp) };
});
console.log('  Babel-Standalone:', babel.babelKB, 'KB | letztes Script fertig:', babel.lastScriptEnd, 'ms | FCP:', babel.fcp, 'ms → Transform+Render ≈', babel.fcp - babel.lastScriptEnd, 'ms');

// ── 2. A11Y ──────────────────────────────────────────────────────────
function auditFn() {
  const out = { noName: [], smallTap: [], lowContrast: [], noLabelInput: [], misc: [] };
  const lum = c => { const s=c.map(v=>{v/=255; return v<=.03928? v/12.92 : Math.pow((v+.055)/1.055,2.4);}); return .2126*s[0]+.7152*s[1]+.0722*s[2]; };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p = m[1].split(',').map(parseFloat); return { rgb:[p[0],p[1],p[2]], a: p.length>3?p[3]:1 }; };
  const bgOf = el => {
    const stack = [];
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
      n = n.parentElement;
    }
    let base = [6,10,8];
    for (let i = stack.length - 1; i >= 0; i--) base = stack[i].rgb.map((v,j)=> v*stack[i].a + base[j]*(1-stack[i].a));
    return base;
  };
  const blend = (fg, a, bg) => fg.map((v,i)=> v*a + bg[i]*(1-a));
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };

  document.querySelectorAll('button, [role="button"], a[href]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const name = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
    if (!name) out.noName.push(el.className + ' | ' + el.outerHTML.slice(0,80));
    if (r.width < 40 || r.height < 40) out.smallTap.push(`${Math.round(r.width)}x${Math.round(r.height)} "${name.slice(0,22)}" .${el.className}`);
  });
  document.querySelectorAll('input, textarea, select').forEach(el => {
    const r = el.getBoundingClientRect(); if (r.width===0) return;
    const has = el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
    if (!has) out.noLabelInput.push(el.outerHTML.slice(0,90));
  });
  // Text-Kontrast
  const seen = new Set();
  document.querySelectorAll('*').forEach(el => {
    if (!el.childNodes.length) return;
    const txt = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim();
    if (!txt) return;
    const r = el.getBoundingClientRect(); if (r.width===0||r.height===0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility==='hidden'||cs.opacity==='0') return;
    // Inaktive Bedienelemente nimmt WCAG 1.4.3 ausdruecklich aus. Ohne diese
    // Regel meldete das Werkzeug dauerhaft die abgeblendeten Monatspfeile und
    // den deaktivierten "Archivieren"-Knopf - Fehlalarme, die jeden Durchgang
    // beschaeftigen und die echten Funde zudecken.
    const inaktiv = el.closest('[disabled],[aria-disabled="true"]')
      || [...document.querySelectorAll('*')].length && (() => {
           let n = el;
           while (n && n !== document.body) {
             if (parseFloat(getComputedStyle(n).opacity || 1) < 0.6) return true;
             n = n.parentElement;
           }
           return false;
         })();
    if (inaktiv) return;
    const fg = parse(cs.color); if (!fg) return;
    const bg = bgOf(el);
    const eff = blend(fg.rgb, fg.a * parseFloat(cs.opacity||1), bg);
    const cr = ratio(eff, bg);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (cr < need) {
      const key = `${cs.color}|${px}|${txt.slice(0,12)}`;
      if (seen.has(key)) return; seen.add(key);
      out.lowContrast.push(`${cr.toFixed(2)}:1 (soll ${need}) ${px}px w${cs.fontWeight} "${txt.slice(0,26)}" color=${cs.color} .${(el.className||'').toString().slice(0,26)}`);
    }
  });
  out.misc.push('lang=' + document.documentElement.lang);
  out.misc.push('viewport=' + (document.querySelector('meta[name=viewport]')||{}).content);
  out.misc.push('h1/h2 vorhanden: ' + document.querySelectorAll('h1,h2,h3').length);
  out.misc.push('img ohne alt: ' + [...document.querySelectorAll('img')].filter(i=>!i.alt).length);
  return out;
}

async function report(label) {
  const a = await page.evaluate(auditFn);
  console.log(`\n=== A11Y :: ${label} ===`);
  console.log(' ohne Namen:', a.noName.length); a.noName.slice(0,10).forEach(x=>console.log('   -',x));
  console.log(' Tap-Ziel <40px:', a.smallTap.length); [...new Set(a.smallTap)].slice(0,14).forEach(x=>console.log('   -',x));
  console.log(' Input ohne Label:', a.noLabelInput.length); a.noLabelInput.slice(0,8).forEach(x=>console.log('   -',x));
  console.log(' Kontrast < AA:', a.lowContrast.length); a.lowContrast.slice(0,25).forEach(x=>console.log('   -',x));
  if (label==='Haushalt') console.log(' misc:', a.misc.join(' | '));
}

await page.waitForTimeout(900);
await report('Haushalt');
for (const t of ['🛒 Einkaufsliste','Growbox','Putzplan','Übersicht','Mehr']) {
  await page.locator(`text=${t}`).first().click(); await page.waitForTimeout(600);
  await report(t);
}
// Wizard
await page.locator('.tabbar .tabitem').first().click(); await page.waitForTimeout(400);
await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(500);
await report('Wizard');
// Fokus-Sichtbarkeit / Tastatur
const kb = await page.evaluate(() => {
  const st = [...document.styleSheets].flatMap(s=>{ try { return [...s.cssRules].map(r=>r.cssText); } catch { return []; } }).join('\n');
  return { focusVisibleRules: (st.match(/:focus[^{]*\{/g)||[]).length, outlineNone: (st.match(/outline\s*:\s*none/g)||[]).length };
});
console.log('\n=== Tastatur ===', JSON.stringify(kb));
await browser.close();
