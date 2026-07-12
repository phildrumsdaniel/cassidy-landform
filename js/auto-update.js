// ── auto-update.js — pick up a new deploy without a manual cache-clear ─────────
// Mobile Safari caches index.html hard, so a freshly-deployed version can sit unseen
// until you clear the cache by hand. This watches for the app becoming visible again
// — e.g. you put the phone down and reopen it, or switch back to the tab — and checks
// whether a newer build is live. It does that by comparing the cache-bust hash of the
// 01-config.js currently loaded against the one in a fresh (no-store) fetch of index.html.
// If they differ, a new version is deployed, so it reloads with a cache-busting query and
// the new files load. It ONLY reloads when there's genuinely a new build, so ordinary
// app-switching never refreshes, and the deal is safe to reload (it's persisted to
// localStorage continuously). Throttled so a check runs at most once every 30 seconds.
(function(){
  // The hash on our own currently-loaded 01-config.js — our "installed" version marker.
  function hashOf(html){
    var m = /01-config\.js\?v=([a-z0-9]+)/i.exec(html || "");
    return m ? m[1] : null;
  }
  var cfg = document.querySelector('script[src*="01-config.js"]');
  var mine = cfg ? hashOf(cfg.getAttribute("src")) : null;
  if(!mine) return;                       // can't identify our build — do nothing, safely

  var lastCheck = 0, busy = false;
  function check(){
    var now = Date.now();
    if(busy || (now - lastCheck) < 30000) return;   // throttle: at most once / 30s
    lastCheck = now; busy = true;
    // no-store + a unique query forces Safari past its cache to the true deployed page.
    fetch("index.html?cb=" + now, { cache:"no-store" })
      .then(function(r){ return r.ok ? r.text() : ""; })
      .then(function(html){
        var live = hashOf(html);
        if(live && live !== mine){
          // A newer build is deployed → hard-reload past the cache. The deal is in
          // localStorage, so it comes straight back after the reload.
          location.replace(location.pathname + "?u=" + now);
        }
      })
      .catch(function(){ /* offline or blocked — try again next time */ })
      .then(function(){ busy = false; });
  }

  // Fires when you return to the app after putting the phone down / switching away.
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible") check();
  });
  // Back/forward cache restore (Safari) and regaining window focus.
  window.addEventListener("pageshow", function(ev){ if(ev.persisted) check(); });
  window.addEventListener("focus", check);
})();
