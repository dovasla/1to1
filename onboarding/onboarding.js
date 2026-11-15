/* 1TO1 player app: first-minute onboarding (N10).
   Three short screens, each with one yellow button. Shown once per phone.
   Usage:
     PlayerOnboarding.markPending(localStorage);          // sign-up succeeded
     if (PlayerOnboarding.shouldShow(localStorage)) {     // app opened, signed in
       PlayerOnboarding.open(document.body, { ua: navigator.userAgent,
         standalone: isStandalone, storage: localStorage, onDone: function () {} });
     }
     PlayerOnboarding.markDone(localStorage);             // a manual log in also calls this
   States: '' (never), 'pending' (show on next signed-in open), 'done' (never again).
   Plain DOM, no innerHTML from data, no network, no timers. Node: module.exports.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerOnboarding = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = '1to1-onboarding';
  var PENDING = 'pending';
  var DONE = 'done';

  function defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function store(s) { return s || defaultStorage(); }

  function readState(s) {
    try { var st = store(s); return st ? (st.getItem(KEY) || '') : ''; } catch (e) { return ''; }
  }
  function writeState(s, v) {
    try { var st = store(s); if (st) st.setItem(KEY, v); return true; } catch (e) { return false; }
  }

  // Sign-up succeeded: show the screens the next time the app opens signed in.
  function markPending(s) { return writeState(s, PENDING); }
  // Done, Skip, or a manual log in: never show again on this phone.
  function markDone(s) { return writeState(s, DONE); }
  // Only a phone that just signed up sees the screens. Old players and later log-ins never do.
  function shouldShow(s) { return readState(s) === PENDING; }

  function platform(ua) {
    ua = ua || '';
    return {
      ios: /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua)),
      android: /android/i.test(ua),
      inApp: /CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram|Line\//i.test(ua)
    };
  }

  // Install is skipped when the app already runs installed.
  function steps(opts) {
    opts = opts || {};
    var list = [];
    if (!opts.standalone) list.push('install');
    list.push('next', 'basics');
    return list;
  }

  // Plain copy. Headings are two words. No emoji. Short lines.
  function copyFor(id, plat) {
    plat = plat || {};
    if (id === 'install') {
      var how;
      if (plat.ios && plat.inApp) how = 'Open this page in Safari first. Then tap Share, and Add to Home Screen.';
      else if (plat.ios) how = 'Tap Share (the box with an arrow) at the bottom of Safari, then Add to Home Screen.';
      else if (plat.android) how = 'In Chrome, tap the three dots, then Install app.';
      else how = 'Open this page on your phone, then add it to your Home Screen.';
      return {
        title: 'Install app',
        lines: ['1TO1 opens like an app and keeps your last screens, even with no signal.', how],
        button: 'Next'
      };
    }
    if (id === 'next') {
      return {
        title: 'Next night',
        lines: ['Home shows the next night, the time and what to do.', 'Check it before game night.'],
        button: 'Next'
      };
    }
    return {
      title: 'The basics',
      lines: ['Pay for the night before you play.', 'Play. Your team shows on Home.', 'Earn XP every night you play.'],
      button: 'Got it'
    };
  }

  // Builds the sheet into container. Returns { el, close }. Skip is always on screen.
  function open(container, opts) {
    opts = opts || {};
    var doc = (container && container.ownerDocument) || (typeof document !== 'undefined' ? document : null);
    if (!doc || !container) return null;
    var plat = platform(opts.ua);
    var list = steps({ standalone: opts.standalone });
    var index = 0;

    var el = doc.createElement('section');
    el.className = 'ob';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'obTitle');

    var wrap = doc.createElement('div');
    wrap.className = 'ob-wrap';
    el.appendChild(wrap);

    var top = doc.createElement('div');
    top.className = 'ob-top';
    var count = doc.createElement('span');
    count.className = 'ob-count';
    count.setAttribute('aria-live', 'polite');
    var skip = doc.createElement('button');
    skip.type = 'button';
    skip.className = 'ob-skip';
    skip.textContent = 'Skip';
    top.appendChild(count);
    top.appendChild(skip);
    wrap.appendChild(top);

    var card = doc.createElement('div');
    card.className = 'ob-card';
    wrap.appendChild(card);

    var dots = doc.createElement('div');
    dots.className = 'ob-dots';
    dots.setAttribute('aria-hidden', 'true');
    wrap.appendChild(dots);
    var dotEls = list.map(function () {
      var d = doc.createElement('span');
      d.className = 'ob-dot';
      dots.appendChild(d);
      return d;
    });

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      doc.removeEventListener('keydown', onKey);
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    function finish() {
      markDone(opts.storage);
      close();
      if (typeof opts.onDone === 'function') opts.onDone();
    }
    function onKey(e) { if (e.key === 'Escape') finish(); }
    doc.addEventListener('keydown', onKey);
    skip.addEventListener('click', finish);

    function render() {
      var id = list[index];
      var c = copyFor(id, plat);
      var last = index === list.length - 1;
      count.textContent = (index + 1) + ' of ' + list.length;
      dotEls.forEach(function (d, i) { d.className = 'ob-dot' + (i === index ? ' on' : ''); });

      card.textContent = '';
      var h = doc.createElement('h2');
      h.id = 'obTitle';
      h.tabIndex = -1;
      h.textContent = c.title;
      card.appendChild(h);

      var ul = doc.createElement('ul');
      ul.className = 'ob-lines';
      c.lines.forEach(function (line) {
        var li = doc.createElement('li');
        li.textContent = line;
        ul.appendChild(li);
      });
      card.appendChild(ul);

      var go = doc.createElement('button');
      go.type = 'button';
      go.className = 'ob-go';
      go.textContent = c.button;
      go.addEventListener('click', function () {
        if (last) finish();
        else { index += 1; render(); }
      });
      card.appendChild(go);

      if (h.focus) h.focus();
    }

    container.appendChild(el);
    render();
    return { el: el, close: close, finish: finish };
  }

  return {
    KEY: KEY,
    markPending: markPending,
    markDone: markDone,
    shouldShow: shouldShow,
    readState: readState,
    platform: platform,
    steps: steps,
    copyFor: copyFor,
    open: open
  };
});
