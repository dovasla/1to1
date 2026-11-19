/* Team reveal (lobby thread). Self-contained: fade to black, Continue, then the full reveal.
   Owner: lobby thread. Style is swappable: change only the markup in render() and team-reveal.css.
   TeamReveal.mount(host, { team, teammates, onDone })
     team      { name, colour }
     teammates [{ id, first, lastInitial, level, prestige, avatar, nameEffect }]  (the shared chip data)
     onDone    called when the player taps "Go to the run"
   Returns { destroy() }. Never throws; respects reduced motion.
*/
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reduced() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  // Placeholder chip until the shared player chip is wired in (see player-chip-18nov).
  function chipHtml(p, i) {
    var name = esc(p.first) + ' ' + esc(p.lastInitial);
    var fx = p.nameEffect ? ' tr-fx-' + esc(p.nameEffect) : '';
    return '<div class="tr-chip' + fx + '" style="--tr-i:' + i + '">' +
      '<span class="tr-chip-name">' + name + '</span>' +
      (p.level ? '<span class="tr-chip-lvl">Lv ' + esc(p.level) + '</span>' : '') +
      (p.prestige ? '<span class="tr-chip-pre">' + '★'.repeat(Math.min(5, Number(p.prestige) || 0)) + '</span>' : '') +
    '</div>';
  }

  function render(host, o) {
    var team = o.team || {};
    var colour = /^#[0-9a-fA-F]{6}$/.test(team.colour || '') ? team.colour : '#FFD400';
    host.innerHTML =
      '<div class="tr-veil" data-phase="black" style="--tr-colour:' + colour + '">' +
        '<div class="tr-stage">' +
          '<p class="tr-cap">You’re on</p>' +
          '<h2 class="tr-team" hidden>' + esc(team.name || 'Your team') + '</h2>' +
          '<div class="tr-chips" hidden>' + (o.teammates || []).map(chipHtml).join('') + '</div>' +
          '<button type="button" class="tr-continue" data-act="continue" hidden>Continue</button>' +
          '<button type="button" class="tr-go" data-act="go" hidden>Go to the run</button>' +
        '</div>' +
      '</div>';
    return host.querySelector('.tr-veil');
  }

  function mount(host, o) {
    if (!host) return { destroy: function () {} };
    var veil = render(host, o || {});
    var timers = [];
    var motion = !reduced();
    function q(sel) { return veil.querySelector(sel); }
    function show(el) { if (el) el.hidden = false; }
    function later(fn, ms) { timers.push(setTimeout(fn, motion ? ms : 0)); }

    // 1. Fade slowly to fully black (CSS transition on [data-phase]); then the Continue button appears.
    requestAnimationFrame(function () { veil.setAttribute('data-phase', 'black'); });
    later(function () { show(q('.tr-continue')); }, 2600);

    // 2. Continue plays the full reveal: name, colour, teammates pop in one by one.
    host.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-act]');
      if (!t) return;
      if (t.getAttribute('data-act') === 'continue') {
        t.hidden = true;
        veil.setAttribute('data-phase', 'reveal');
        show(q('.tr-team')); show(q('.tr-chips'));
        later(function () { show(q('.tr-go')); }, 1200 + (o.teammates || []).length * 180);
      } else if (t.getAttribute('data-act') === 'go') {
        destroy();
        if (typeof o.onDone === 'function') o.onDone();
      }
    });

    function destroy() {
      timers.forEach(clearTimeout);
      timers = [];
      host.innerHTML = '';
    }
    return { destroy: destroy };
  }

  var api = { mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TeamReveal = api;
})(typeof window !== 'undefined' ? window : globalThis);
