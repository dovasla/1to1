/* 1TO1 player app: weak-signal screen pieces (F7). DOM only. Uses PlayerSignal from signal.js.
   - PlayerSignal.ui.panel(box, onRetry): one plain message and a Try again button. Used on Pay, code entry, login, Home.
   - PlayerSignal.ui.age(el, savedAt): "Updated 20 min ago" line, refreshed every 30 seconds.
   - PlayerSignal.ui.holdUpdate(sw, getNight, onReady): a new version waits while a run is on, then shows "Update".
   Text is set with textContent only. No spinners, no percentages, no hint lines.
*/
(function () {
  'use strict';
  var S = window.PlayerSignal;
  if (!S) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // Shows the plain message with a Try again button inside box. Returns { show(), hide() }.
  // Typed input is not touched: the screen keeps what was typed, and Try again runs onRetry again.
  function panel(box, onRetry) {
    if (!box) return { show: function () {}, hide: function () {} };
    box.innerHTML = '';
    box.classList.add('sig-panel');
    box.setAttribute('role', 'alert');
    var msg = el('p', 'sig-msg', S.MESSAGE);
    var btn = el('button', 'btn yellow sig-retry', 'Try again');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (typeof onRetry === 'function') onRetry();
    });
    box.appendChild(msg);
    box.appendChild(btn);
    box.hidden = true;
    return {
      show: function () { box.hidden = false; },
      hide: function () { box.hidden = true; }
    };
  }

  // Keeps "Updated N min ago" current. Returns a stop() function.
  function age(node, savedAt) {
    if (!node || typeof savedAt !== 'number') { if (node) node.hidden = true; return function () {}; }
    function paint() {
      node.textContent = S.ageText(savedAt, Date.now());
      node.hidden = false;
    }
    paint();
    var timer = setInterval(paint, 30000);
    return function () { clearInterval(timer); };
  }

  // A new version (service worker in waiting) is held while a run is on.
  // When the run is over, onReady(apply) is called once; apply() tells the waiting worker to take over.
  // getNight() returns the night the app is showing (or null). Rechecked every 60 seconds.
  function holdUpdate(reg, getNight, onReady) {
    if (!reg) return function () {};
    var done = false;
    function apply() {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    function check() {
      if (done || !reg.waiting) return;
      if (S.updateAllowed(typeof getNight === 'function' ? getNight() : null, Date.now())) {
        done = true;
        clearInterval(timer);
        if (typeof onReady === 'function') onReady(apply);
      }
    }
    var timer = setInterval(check, 60000);
    check();
    return function stop() { clearInterval(timer); };
  }

  // The "Update" card. Shown only when onReady fires. Tap applies the new version (page reloads itself).
  function updateCard(box, apply) {
    if (!box) return;
    box.innerHTML = '';
    box.classList.add('sig-update');
    box.appendChild(el('p', 'sig-msg', 'A new version is ready.'));
    var btn = el('button', 'btn yellow sig-retry', 'Update');
    btn.type = 'button';
    btn.addEventListener('click', function () { apply(); });
    box.appendChild(btn);
    box.hidden = false;
  }

  window.PlayerSignal.ui = { panel: panel, age: age, holdUpdate: holdUpdate, updateCard: updateCard };
})();
