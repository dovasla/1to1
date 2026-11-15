/* Bring a friend (N13). Plain JS, no framework. Owns only screens/invite/.
   Browser: window.PlayerInvite. Node tests: invite.test.js.

   - readCode(search): the invite code from a link (?i=ABC234). '' when missing or not a code.
   - linkFor(base, code): the link a friend opens. base is the app address without a query.
   - shareText(link): the words sent with the link.
   - html(data, msg): the card (pure). data: { code, joined, rewarded, coins, badge, state }
       state: 'ready' | 'loading' | 'error'. Empty state: no friends yet. Error state: a Try again button.
   - mount(el, data, handlers): renders the card into el. handlers.share(link) and handlers.retry() are optional.
       Share uses the phone's share sheet when there is one; otherwise it copies the link and says so.

   The rewards are paid on the server (migration-19-invite.sql), never here. This file only shows numbers.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerInvite = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
  var REWARD = 500;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readCode(search) {
    var v = '';
    try { v = new URLSearchParams(String(search || '')).get('i') || ''; } catch (e) { v = ''; }
    v = v.trim().toUpperCase();
    return CODE_RE.test(v) ? v : '';
  }

  function linkFor(base, code) {
    var b = String(base || '').split('?')[0].split('#')[0];
    return b + '?i=' + encodeURIComponent(String(code || ''));
  }

  function shareText(link) {
    return 'Come and play pickup basketball with me. Sign up with my link and we both get ' + REWARD + ' coins after your first night: ' + link;
  }

  // The status line under the button. Plain words, no numbers the player cannot act on.
  function statusLine(d) {
    var joined = Number(d.joined) || 0;
    if (!joined) return 'No friends yet. Send your link to one mate.';
    return joined === 1 ? '1 friend has joined.' : joined + ' friends have joined.';
  }

  function html(data, msg) {
    var d = data || {};
    var state = d.state || 'ready';
    var head = '<h2 class="invite-title">Bring a friend</h2>';
    var lead = '<p class="invite-lead">When a friend plays their first night, you both get ' + REWARD + ' coins.</p>';
    if (state === 'loading') {
      return '<section class="invite-card" aria-busy="true">' + head + '<p class="invite-lead">Getting your link…</p></section>';
    }
    if (state === 'error' || !d.code) {
      return '<section class="invite-card" role="alert">' + head +
        '<p class="invite-lead">Your link did not load. Check your connection.</p>' +
        '<button class="btn yellow invite-btn" type="button" data-act="retry">Try again</button></section>';
    }
    var link = linkFor(d.base || '', d.code);
    return '<section class="invite-card">' + head + lead +
      '<p class="invite-code" aria-label="Your code">' + esc(d.code) + '</p>' +
      '<button class="btn yellow invite-btn" type="button" data-act="share" data-link="' + esc(link) + '">Share my link</button>' +
      '<p class="invite-status" role="status" aria-live="polite">' + esc(msg || statusLine(d)) + '</p>' +
      (d.badge ? '<p class="invite-badge">Badge earned: Friend Finder</p>' : '') +
      '</section>';
  }

  function mount(el, data, handlers) {
    var h = handlers || {};
    var st = { data: data || {}, msg: '' };

    function paint() { el.innerHTML = html(st.data, st.msg); }

    function share(link, btn) {
      var text = shareText(link);
      if (typeof navigator !== 'undefined' && navigator.share) {
        return navigator.share({ title: '1TO1 Basketball', text: text, url: link })
          .then(function () { st.msg = ''; }, function () { st.msg = ''; });
      }
      var copy = navigator && navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'));
      return copy.then(function () { st.msg = 'Link copied. Send it to a mate.'; paint(); },
        function () { st.msg = 'Copy did not work. Your link: ' + link; paint(); });
    }

    function onClick(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'share') {
        if (h.share) return Promise.resolve(h.share(t.getAttribute('data-link'))).then(function () {}, function () {});
        return share(t.getAttribute('data-link'), t);
      }
      if (act === 'retry' && h.retry) h.retry();
    }

    el.addEventListener('click', onClick);
    paint();
    return {
      update: function (next) { st.data = Object.assign({}, st.data, next || {}); paint(); },
      destroy: function () { el.removeEventListener('click', onClick); el.innerHTML = ''; }
    };
  }

  return {
    REWARD: REWARD,
    readCode: readCode,
    linkFor: linkFor,
    shareText: shareText,
    statusLine: statusLine,
    html: html,
    mount: mount
  };
});
