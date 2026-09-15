/* Firebase-STUB für Sync-Tests (sync.mjs, logins.mjs, rotate.mjs, errlog.mjs) — ersetzt firebase-app-compat.
   Bildet nur ab, was DataProvider benutzt, aber PFAD-GENAU (seit dem Code-Wechsel nötig: zwei WG-Pfade):
     once   — Callback-Form: Antwort per __wg.fire() steuerbar (Erst-Read); Promise-Form: sofort (Code-Wechsel)
     on/off — Live-Listener je Pfad
     update — multi-path relativ zum Ref, optional zurückgehalten (holdWrites/releaseWrites)
     set/remove/child/root
   window.__wg.tree = die ganze „Datenbank"; window.__wg.remote = Kurzweg auf wg/<erster Code> (wie bisher).
   window.__wgSeed (optional, per addInitScript) = Startinhalt dieser WG. */
export const STUB = `
window.__wg = { updates: [], onceAt: 0, listeners: [], holdWrites: false, held: [], code: null,
  // __wgTreeSeed = ganzer Startbaum (mehrere WGs, z. B. alter + neuer Code) — für Code-Wechsel-Tests
  tree: window.__wgTreeSeed ? JSON.parse(JSON.stringify(window.__wgTreeSeed)) : { wg: {} },
  seed: window.__wgSeed || { users:[{id:'u1',name:'Torben',color:'#38bdf8'},{id:'u2',name:'Tom',color:'#fbbf24'}],
            hs:{ serverItem:{id:'serverItem',name:'VomServer',price:9,paidBy:'u2',date:'2026-08-01',settled:false,seq:1} } } };
(function(){
  var W = window.__wg;
  // Kurzweg für Bestands-Tests: remote = Inhalt der (ersten) WG
  Object.defineProperty(W, 'remote', {
    get: function(){ if (!W.tree.wg[W.code]) W.tree.wg[W.code] = {}; return W.tree.wg[W.code]; },
    set: function(v){ W.tree.wg[W.code] = v; }
  });
  function parts(p){ return String(p || '').split('/').filter(Boolean); }
  function getAt(p){ return parts(p).reduce(function(o, k){ return (o && typeof o === 'object') ? o[k] : undefined; }, W.tree); }
  function setAt(p, v){
    var s = parts(p); if (!s.length) { W.tree = v || {}; return; }
    var o = W.tree;
    s.slice(0, -1).forEach(function(k){ if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null || v === undefined) delete o[s[s.length - 1]]; else o[s[s.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  function snapAt(p){ var v = getAt(p); v = (v === undefined) ? null : JSON.parse(JSON.stringify(v)); return { val: function(){ return v; } }; }
  function notify(){ W.listeners.slice().forEach(function(l){ l.cb(snapAt(l.path)); }); }
  function apply(op){ if (op.set) setAt(op.path, op.v); else for (var k in op.u) setAt(op.path + '/' + k, op.u[k]); }
  function write(op){
    W.updates.push(op.set ? { ['@set ' + op.path]: op.v } : op.u);
    // holdWrites: Write ist unterwegs, Server hat ihn noch nicht → inflight-Fenster gezielt testbar.
    // Warteschlange statt einzelnem Resolver, sonst verdrängt ein zweiter Write den ersten (Wackler).
    if (W.holdWrites) return new Promise(function(res){ W.held.push({ op: op, res: res }); });
    apply(op); setTimeout(notify, 20); return Promise.resolve();
  }
  // Fremd-Änderung vom anderen Gerät simulieren (löst Listener-Events aus)
  W.pushRemote = function(){ notify(); };
  // Alle zurückgehaltenen Writes zustellen und bestätigen
  W.releaseWrites = function(){ var h = W.held; W.held = []; h.forEach(function(x){ apply(x.op); x.res(); }); setTimeout(notify, 20); return h.length; };
  function Ref(path){
    path = parts(path).join('/');
    if (/^wg\\/[^/]+$/.test(path) && !W.code) {             // erste WG = die „eigene" → Startinhalt einsetzen
      W.code = path.slice(3);
      if (!W.tree.wg[W.code]) W.tree.wg[W.code] = JSON.parse(JSON.stringify(W.seed));
    }
    this.path = path;
    this.once = function(_ev, cb){
      if (typeof cb !== 'function') return Promise.resolve(snapAt(path));   // Promise-Form: sofortige Antwort
      // Server antwortet mit dem Stand beim ABSCHICKEN — ein später ankommender Write fehlt darin
      var atSend = snapAt(path);
      W.fire = function(){ W.onceAt = Date.now(); cb(atSend); };
      return { then: function(){ return { catch: function(){} }; } };
    };
    // Live-Listener wie die echte RTDB: feuert beim Registrieren mit dem AKTUELLEN Stand, dann bei Änderungen
    this.on = function(_ev, cb){ W.listeners.push({ path: path, cb: cb }); setTimeout(function(){ cb(snapAt(path)); }, 40); };
    this.off = function(){ W.listeners = W.listeners.filter(function(l){ return l.path !== path; }); };
    this.child = function(c){ return new Ref(path + '/' + c); };
    this.update = function(u){ return write({ path: path, u: u }); };
    this.set = function(v){ return write({ path: path, set: true, v: v }); };
    this.remove = function(){ return write({ path: path, set: true, v: null }); };
    Object.defineProperty(this, 'root', { get: function(){ return new Ref(''); } });
  }
  window.firebase = {
    initializeApp: function(){ return {}; },
    app: function(){ throw new Error('no app'); },
    database: function(){ return { ref: function(p){ return new Ref(p); }, goOnline: function(){}, goOffline: function(){} }; },
  };
})();
`;
