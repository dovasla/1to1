/* Shop extras panel: seasonal events, tonight's bounty, and your season trophies.
   Needs shop_extras_state (SQL v4). If the RPC is missing the panel hides itself.
   Browser: window.ShopExtras. mount(el) -> { setState(data) }. Nothing is sent from here yet (the vote UI comes later). */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function endsIn(iso) {
    var ms = Date.parse(iso) - Date.now();
    if (!(ms > 0)) return '';
    var h = Math.floor(ms / 3600000);
    return h >= 48 ? 'Ends in ' + Math.floor(h / 24) + ' days' : h >= 1 ? 'Ends in ' + h + 'h' : 'Ends soon';
  }

  function html(d) {
    var out = '';
    (d.events || []).forEach(function (e) {
      out += '<div class="ex-card ex-event"><span class="ex-kicker">Event</span><b>' + esc(e.name) + '</b>' +
        (e.effect ? '<p class="ex-sub">' + esc(e.effect) + '</p>' : '') +
        (endsIn(e.endsAt) ? '<span class="ex-ends">' + esc(endsIn(e.endsAt)) + '</span>' : '') + '</div>';
    });
    if (d.bounty) {
      out += '<div class="ex-card ex-bounty"><span class="ex-kicker">Bounty night</span><b>' + esc(d.bounty.title) + '</b>' +
        '<p class="ex-sub">+' + esc(d.bounty.bonusXp) + ' XP on top for players tonight.</p></div>';
    }
    if ((d.trophies || []).length) {
      out += '<div class="ex-card"><span class="ex-kicker">Your trophies</span><ul class="ex-list">' +
        d.trophies.map(function (t) { return '<li>' + esc(t.trophy) + ' <span class="ex-tag-s">' + esc(t.season) + '</span></li>'; }).join('') +
        '</ul></div>';
    }
    return out;
  }

  function mount(el) {
    return {
      setState: function (d) {
        var body = html(d || {});
        el.innerHTML = body ? '<section class="ex-wrap" aria-label="Events and trophies">' + body + '</section>' : '';
        el.hidden = !body;
      }
    };
  }

  root.ShopExtras = { mount: mount, endsIn: endsIn };
})(typeof window !== 'undefined' ? window : this);
