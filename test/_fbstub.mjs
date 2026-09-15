/* Firebase-STUB für Sync-Tests (sync.mjs, logins.mjs) — ersetzt firebase-app-compat.js.
   Bildet nur ab, was DataProvider benutzt: once (Antwort per __wg.fire() steuerbar),
   on (Live-Listener), update (multi-path, optional zurückgehalten), child/set.
   window.__wg.remote = der „Server-Stand"; Tests lesen/ändern ihn direkt. */
export const STUB = `
window.__wg = { updates: [], onceAt: 0, listeners: [], holdWrites: false, held: [],
  remote: window.__wgSeed || { users:[{id:'u1',name:'Torben',color:'#38bdf8'},{id:'u2',name:'Tom',color:'#fbbf24'}],
            hs:{ serverItem:{id:'serverItem',name:'VomServer',price:9,paidBy:'u2',date:'2026-08-01',settled:false,seq:1} } } };
(function(){
  function snap(){ var v = JSON.parse(JSON.stringify(window.__wg.remote)); return { val: function(){ return v; } }; }
  function notify(){ window.__wg.listeners.forEach(function(cb){ cb(snap()); }); }
  function applyUpdate(u){
    for (var path in u) {
      var parts = path.split('/');
      if (parts.length === 2) {
        var k = parts[0], id = parts[1];
        if (!window.__wg.remote[k]) window.__wg.remote[k] = {};
        if (u[path] === null) delete window.__wg.remote[k][id]; else window.__wg.remote[k][id] = u[path];
      } else if (u[path] !== null) { window.__wg.remote[path] = u[path]; }
    }
  }
  // Fremd-Aenderung vom anderen Geraet simulieren (loest ein Listener-Event aus)
  window.__wg.pushRemote = function(){ notify(); };
  // Alle zurueckgehaltenen Writes zustellen und bestaetigen
  window.__wg.releaseWrites = function(){
    var h = window.__wg.held; window.__wg.held = [];
    h.forEach(function(x){ applyUpdate(x.u); x.res(); });
    setTimeout(notify, 20);
    return h.length;
  };
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
    this.remove = function(){ return Promise.resolve(); };
    this.update = function(u){
      window.__wg.updates.push(u);
      // holdWrites: der Write ist unterwegs — der Server hat ihn noch nicht verarbeitet
      // und bestaetigt ihn nicht. So laesst sich das inflight-Fenster gezielt testen.
      if (window.__wg.holdWrites) {
        // Warteschlange, kein einzelner Resolver: gehen mehrere Writes raus, darf der
        // zweite den ersten nicht verdraengen (sonst wird ein Write nie angewendet und
        // der Test schlaegt sporadisch fehl).
        return new Promise(function(res){ window.__wg.held.push({ u: u, res: res }); });
      }
      applyUpdate(u);
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
