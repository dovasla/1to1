/* Home box for the recap and MVP vote (P5b). Shows loading, error with Try again, or the card. Reads only,
   except the MVP vote itself (one tap, through PlayerMvpBackend.vote). Browser: window.PlayerRecapBox.
   Names of players appear only for a night that has been played (the server's stats rows); nothing before Start.
*/
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerRecapBox = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var TO = root.PlayerLoadTimeout;
  var LOADER = root.PlayerRecapLoader;
  var RECAP = root.PlayerRecap;
  var MVP = root.PlayerMvp;

  function esc(s) { return RECAP ? RECAP.esc(s) : String(s == null ? '' : s); }

  function stateHtml(kind) {
    if (kind === 'loading') return '<p class="muted rb-state" role="status">Loading last run…</p>';
    if (kind === 'error') return '<div class="rb-state"><p class="muted" role="alert">' + esc(TO.TEXT.error) +
      '</p><button type="button" class="rc-btn" data-rb-retry>' + esc(TO.TEXT.retry) + '</button></div>';
    return '';   // empty: no card at all
  }

  // Build the view from a loaded result. Names in top come from the server rows only.
  function viewFrom(data, seenIds, now) {
    var top = (data.top || []).map(function (r) {
      return { name: String(r.first || '') + ' ' + String(r.last_initial || ''), level: r.level, points: r.points };
    });
    return RECAP.buildRecap({ profile: data.profile, summary: data.summary, seenIds: seenIds, now: now,
      mvp: data.mvp, top: top });
  }

  // mount(el, { rpc, token, storage, now }) ; rpc(name, body) -> Promise of JSON. Returns { reload }.
  function mount(el, opts) {
    var o = opts || {};
    var tokenVal = o.token;
    function draw(kind, data) {
      el.innerHTML = kind === 'ready' ? '' : stateHtml(kind);
      if (kind !== 'ready') {
        var btn = el.querySelector('[data-rb-retry]');
        if (btn) btn.addEventListener('click', reload);
        return;
      }
      var view = viewFrom(data, RECAP.readSeen(o.storage), o.now || Date.now());
      if (!view) { el.innerHTML = ''; return; }
      var s = RECAP.slot(view, { storage: o.storage, onVote: function (nightId) { openVote(nightId); } });
      el.innerHTML = s.html;
      s.bind(el);
    }
    function reload() {
      draw('loading');
      LOADER.load(o.rpc, tokenVal).then(function (data) {
        if (data.state === 'ready') draw('ready', data);
        else if (data.state === 'error') draw('error');
        else draw('empty');
      });
    }
    // MVP vote: a second sheet with the night's players, one tap each. Votes only once the night is open.
    function openVote(nightId) {
      var backend = root.PlayerMvpBackend ? root.PlayerMvpBackend.makeSupabase(o.rpc) : null;
      if (!backend || !MVP) return;
      Promise.all([backend.eligible(tokenVal, nightId), backend.myVote(tokenVal, nightId)]).then(function (r) {
        var elig = r[0], mine = r[1];
        var data = { night: { id: nightId, confirmed: !!elig.closed, winnerId: null }, players: elig.players || [],
          me: elig.me || null, myVote: mine && mine.vote || null };
        var sheet = document.createElement('div');
        sheet.className = 'rc-overlay';
        sheet.innerHTML = '<section class="rc-sheet" role="dialog" aria-modal="true" aria-label="MVP vote">' +
          MVP.render(data) + '<button type="button" class="rc-close" data-rb-close>Close</button></section>';
        document.body.appendChild(sheet);
        sheet.addEventListener('click', function (e) {
          if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-rb-close')) sheet.remove();
        });
        MVP.bind(sheet, data, function (id) {
          var msg = sheet.querySelector('[data-mvp-msg]');
          backend.vote(tokenVal, nightId, id).then(function (res) {
            if (msg) msg.textContent = res && res.ok ? 'Vote saved.' : (MVP.REASON_TEXT[res && res.reason] || 'Could not save your vote. Try again.');
          });
        });
      }, function () { /* a failed read leaves the card as it is */ });
    }
    reload();
    return { reload: reload };
  }

  return { mount: mount, viewFrom: viewFrom, stateHtml: stateHtml };
});
