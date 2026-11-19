/* Lobby hype taps and the "teams are out" banner (client side only).
   Browser: window.PlayerLobbyHype. Node tests: tests/lobby-hype.test.js.
   - Interest is the live lobby count only ("N in").
   - Hype taps go to the server RPC 'lobby_hype' when it exists. If the RPC or table is missing,
     or the call fails, the tap still counts on this phone only. Nothing crashes.
   - The banner shows once per teams version, when the live row says teams are out (teamsVersion > seen).
   - Seen version and local hype counts live in localStorage (per viewer). Never a PIN or token in storage.
*/
(function (root) {
  'use strict';

  var SEEN_KEY = '1to1-lobby-teams-seen';
  var HYPE_KEY = '1to1-lobby-hype-local';
  var LIVE_STATES = ['started', 'between', 'live', 'paused', 'full-time'];

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // Pure: is there a new teams version this player has not seen yet?
  function teamsOut(feed, seenVersion) {
    if (!feed || !feed.teams || !feed.teams.length) return false;
    return num(feed.teamsVersion) > num(seenVersion);
  }

  // Pure: the "N in" line. Missing counts show 0 (never a crash, never a made-up number).
  function inLine(count) {
    var n = Math.max(0, Math.round(num(count)));
    return n + (n === 1 ? ' player in' : ' players in');
  }

  // Pure: local hype count per key. Returns a new object (no mutation).
  function bumpLocal(counts, key) {
    var next = Object.assign({}, counts || {});
    next[key] = (num(next[key]) || 0) + 1;
    return next;
  }

  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  function readJson(key, fallback) {
    try { var s = store(); var raw = s ? s.getItem(key) : null; return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, value) { try { var s = store(); if (s) s.setItem(key, JSON.stringify(value)); } catch (e) { /* private window: no memory */ } }

  function seenVersion() { return num(readJson(SEEN_KEY, 0)); }
  function markSeen(version) { writeJson(SEEN_KEY, num(version)); }
  function localHype() { return readJson(HYPE_KEY, {}); }

  // Sends one hype tap. Always resolves: { ok: true, server: true|false }.
  // server false means it only counted on this phone.
  function hype(be, token, night, key) {
    var local = bumpLocal(localHype(), key);
    writeJson(HYPE_KEY, local);
    var rpc = be && typeof be.rpc === 'function' ? be.rpc : null;
    if (!rpc) return Promise.resolve({ ok: true, server: false });
    return Promise.resolve()
      .then(function () { return rpc('lobby_hype', { p_token: token || null, p_night: night, p_key: key }); })
      .then(function (r) { return { ok: true, server: !!(r && r.ok === true) }; }, function () { return { ok: true, server: false }; });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // DOM: draws the lobby box into host. data = { feed, inCount, reactions (array of { id, label, glyph|svg }) }.
  function draw(host, data) {
    if (!host) return;
    var d = data || {};
    var out = teamsOut(d.feed, seenVersion());
    var running = !!(d.feed && LIVE_STATES.indexOf(d.feed.state) !== -1);
    // The banner stays until the player taps it (then that teams version counts as seen).
    var banner = out
      ? '<button type="button" class="lobby-banner" data-lobby-seen="' + esc(d.feed.teamsVersion) + '" role="status">Teams are out. Tap to see your team.</button>'
      : '';
    var btns = (d.reactions || []).map(function (r) {
      var face = r.svg ? r.svg : esc(r.glyph || r.label);
      return '<button type="button" class="lobby-hype" data-lobby-hype="' + esc(r.id) + '" aria-label="' + esc(r.label) + '">' + face + '</button>';
    }).join('');
    // No count from the server means no "N in" line (never a made-up number).
    var countLine = d.inCount == null ? '' : '<p class="lobby-in">' + esc(inLine(d.inCount)) + '</p>';
    host.innerHTML = banner +
      '<div class="lobby-card">' + countLine +
      (running ? '' : '<p class="lobby-sub">Teams come out when the run starts.</p>') +
      '<div class="lobby-hypes">' + btns + '</div></div>';
    host.hidden = false;
  }

  var api = {
    teamsOut: teamsOut,
    inLine: inLine,
    bumpLocal: bumpLocal,
    hype: hype,
    draw: draw,
    seenVersion: seenVersion,
    markSeen: markSeen,
    localHype: localHype
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerLobbyHype = api;
})(typeof window !== 'undefined' ? window : globalThis);
