/* Shop climb: a skill tree. Pick a tree once, then one reward every 3 levels (3 to 60 = 20 picks per run).
   Each pick level offers three options: a Perk, a Title, Coins. Tap any node to see what it does.
   ONE free respec, ever. The SERVER decides offers, picks, respec and coins (see the SQL migration).
   Browser: window.ShopClimb (needs PlayerName first). Node: module.exports (rules only).

   Use:
     var climb = ShopClimb.mount(el, { name: 'Sam Kowalski', onAction: function (a) { return backend.climbAct(a); } });
     climb.setState({ level: res.climb.level, climb: res.climb });
   Every mount is a new shop visit: the tree picker shows again until a tree is chosen (with "Skip for now" at the top).
   onAction a = { type:'tree', tree } | { type:'pick', level, reward } | { type:'respec' }. Resolves to { state, pick } or { error }.
*/
(function (root, factory) {
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShopClimb = api;
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  var INTERVAL = 3;
  var MAX_LEVEL = 60;
  var BIG_LEVEL = 45;               // from this level, a pick gets the full-screen moment
  var TREES = {
    fire:   { name: 'Fire',   blurb: 'Heat, streaks and big nights.',     color: '#FF7A1F', icon: 'M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 4-4z' },
    ice:    { name: 'Ice',    blurb: 'Cool, clean and steady.',           color: '#5CD6FF', icon: 'M12 2v20M2 12h20M5 5l14 14M19 5L5 19' },
    gold:   { name: 'Gold',   blurb: 'Crowns, captains and big weeks.',   color: '#D99A2B', icon: 'M3 18h18l-2-10-5 4-4-6-4 6-3-4z' },
    storm:  { name: 'Storm',  blurb: 'Busy nights and long runs.',        color: '#8F7CFF', icon: 'M13 2 4 14h7l-1 8 9-12h-7z' },
    shadow: { name: 'Shadow', blurb: 'Quiet shooters and comebacks.',     color: '#9A9A9A', icon: 'M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z' }
  };
  var TREE_ORDER = ['fire', 'ice', 'gold', 'storm', 'shadow'];
  var KIND_LABEL = { perk: 'Perk', title: 'Title', coins: 'Coins' };
  var KIND_ICON = { perk: 'M13 2 4 14h7l-1 8 9-12h-7z', title: 'M3 3h8l10 10-8 8L3 11z', coins: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 12h6' };
  var LOCK_ICON = 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3';
  var CHECK_ICON = 'M5 12l4 4 10-10';
  var COLS = [60, 179, 298];         // node centres: perk, title, coins (the same left-right order on every row)
  var ROW = 96;                      // height of one pick row
  var TOP = 80;                      // first pick row starts under the root
  var TILE_H = 68;

  // ---- Rules (pure, no DOM) ----

  function pickLevels() {
    var out = [];
    for (var l = INTERVAL; l <= MAX_LEVEL; l += INTERVAL) out.push(l);
    return out;
  }

  // 'done' (picked), 'ready' (reached, not picked yet), 'locked' (not reached).
  function nodeStatus(level, climb) {
    var picked = (climb.picks || []).filter(function (p) { return p.level === level; })[0];
    if (picked) return { status: 'done', pick: picked };
    if ((level | 0) <= (climb.level | 0)) return { status: 'ready' };
    return { status: 'locked' };
  }

  function perkCount(climb) { return (climb.picks || []).filter(function (p) { return p.kind === 'perk'; }).length; }

  function pendingLevels(climb) { return (climb.pending || []).map(function (p) { return p.level; }); }

  function offersFor(climb, level) {
    var p = (climb.pending || []).filter(function (x) { return x.level === level; })[0];
    return p ? p.offers : [];
  }

  function nextPickLevel(levelNow) {
    var list = pickLevels().filter(function (l) { return l > (levelNow | 0); });
    return list.length ? list[0] : null;
  }

  // One free respec, ever. respecsLeft comes from the server (0 or 1).
  function respecsLeft(climb) { return climb.respecsLeft | 0; }

  // Full-screen moment: picks from level 45 on. Lower picks stay quiet.
  function isBigPick(pick, level) { return !!pick && (level | 0) >= BIG_LEVEL; }

  // ---- Icons ----
  function icon(path, cls) {
    return '<svg class="sc-ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
  }

  // ---- DOM ----

  function mount(el, host) {
    host = host || {};
    var PN = function () {
      if (!win || !win.PlayerName) throw new Error('PlayerName must load before ShopClimb');
      return win.PlayerName;
    };
    var esc = function (s) { return PN().esc(s); };
    var sample = function () { return host.name || 'You'; };
    var state = null;
    var pickerOpen = true;      // first entry: show the tree picker
    var skipped = false;        // "Skip for now" this visit: show a small bar instead
    var sheet = null;           // { level, mode: 'offer'|'done'|'locked', idx }
    var respecOpen = false;
    var msg = '';
    var busy = false;

    function treeOf(c) { return TREES[c.tree] || { name: '', color: '#FFD21F', icon: '' }; }
    function attrs(a, v, extra) { return ' data-act="' + a + '"' + (v != null ? ' data-v="' + esc(v) + '"' : '') + (extra || '') + (busy ? ' disabled' : ''); }

    // Preview text used in the sheets: the player's own short name with the pick.
    function who() { return esc(PN().shortName(sample())); }

    function renderPicker() {
      var items = TREE_ORDER.map(function (id) {
        var t = TREES[id];
        return '<li><button class="sc-tree" type="button" style="--tree:' + t.color + '"' + attrs('tree', id) + '>' +
          icon(t.icon, 'sc-ico--big') +
          '<span class="sc-tree-tx"><span class="sc-tree-nm">' + esc(t.name) + '</span>' +
          '<span class="sc-tree-ds">' + esc(t.blurb) + '</span></span>' +
          '<span class="sc-go">Pick</span></button></li>';
      }).join('');
      return '<div class="sc-top"><button class="sc-skip" type="button"' + attrs('skip') + '>Skip for now</button></div>' +
        '<header class="sc-hd"><div class="sc-lbl">Shop climb</div><h2 class="sc-h1">Pick your tree</h2>' +
        '<p class="sc-sub">Your tree gives you perks, titles and coins as you climb. You pick one tree and you get one free respec, ever.</p></header>' +
        '<ul class="sc-trees">' + items + '</ul>';
    }

    function renderBar() {
      return '<div class="sc-bar"><span>No tree yet. Perks start with your tree.</span>' +
        '<button class="sc-btn-sm" type="button"' + attrs('picker-open') + '>Choose</button></div>';
    }

    // The skill tree: root, then one row per pick level, branching into Perk / Title / Coins.
    function renderMap(c) {
      var t = treeOf(c);
      var pend = pendingLevels(c);
      var next = nextPickLevel(c.level);
      var headline = pend.length ? 'Reward ready. Tap a node to see it.' : (next ? 'Next pick at Level ' + next + '.' : 'All 20 picks done.');
      var levels = pickLevels();
      var H = TOP + levels.length * ROW + 16;
      var lines = '';
      var nodes = '';
      var spine = [{ x: COLS[1], y: 56 }];          // from the root
      var lastY = 56;

      levels.forEach(function (L, i) {
        var rowTop = TOP + i * ROW;
        var st = nodeStatus(L, c);
        if (st.status === 'done') {
          var col = { perk: 0, title: 1, coins: 2 }[st.pick.kind];
          var x = COLS[col];
          spine.push({ x: x, y: rowTop });
          nodes += tile(x, rowTop, 'done', st.pick.kind, st.pick.name, KIND_LABEL[st.pick.kind], L, 0);
        } else if (st.status === 'ready') {
          var offers = offersFor(c, L);
          // Dashed branches from the last chosen node to each offer.
          offers.forEach(function (o, idx) {
            var cx = COLS[idx];
            lines += curve(spine[spine.length - 1].x, spine[spine.length - 1].y + TILE_H, cx, rowTop, 'branch');
            nodes += tile(cx, rowTop, 'offer', o.kind, o.name, KIND_LABEL[o.kind] || o.kind, L, idx);
          });
          spine = null; // rows below are locked
          return;
        } else {
          [0, 1, 2].forEach(function (idx) { nodes += tile(COLS[idx], rowTop, 'locked', null, 'Level ' + L, '?', L, idx); });
        }
      });

      // Solid spine through the chosen nodes.
      if (spine && spine.length > 1) {
        for (var s = 1; s < spine.length; s++) {
          lines += curve(spine[s - 1].x, spine[s - 1].y + (s === 1 ? 0 : TILE_H), spine[s].x, spine[s].y, 'spine', t.color);
        }
      }

      var svg = '<svg class="sc-lines" viewBox="0 0 358 ' + H + '" width="358" height="' + H + '" aria-hidden="true">' + lines + '</svg>';
      var root = '<div class="sc-root" style="--tree:' + t.color + '">' + icon(t.icon) + '<span>' + esc(t.name) + ' tree</span></div>';
      var left = respecsLeft(c);
      var respec = '<div class="sc-respec"><span><b>Changed your mind?</b><br><span class="sc-muted">' +
        (left ? 'One free respec, ever. Use it wisely.' : 'Your free respec is used.') + '</span></span>' +
        '<button class="sc-btn-sm" type="button"' + attrs('respec-open', null, left ? '' : ' disabled') + '>Respec</button></div>';

      return '<header class="sc-hd"><div class="sc-lbl">Level ' + esc(c.level) + ' · ' + esc(t.name) + ' tree</div>' +
        '<h2 class="sc-h1">Your path</h2><p class="sc-sub">' + esc(headline) + ' Perks ' + perkCount(c) + ' of 3.</p></header>' +
        '<div class="sc-map" style="height:' + H + 'px">' + svg + root + nodes + '</div>' + respec;
    }

    function curve(x0, y0, x1, y1, kind, color) {
      var my = (y0 + y1) / 2;
      var cls = kind === 'branch' ? 'sc-branch' : 'sc-spine';
      var st = kind === 'spine' && color ? ' style="stroke:' + color + '"' : '';
      return '<path class="' + cls + '"' + st + ' d="M' + x0 + ' ' + y0 + ' C' + x0 + ' ' + my + ' ' + x1 + ' ' + my + ' ' + x1 + ' ' + y1 + '"/>';
    }

    // One node. kind is the reward kind (or null for locked). idx is the offer index (0..2) for offers.
    function tile(cx, top, status, kind, label, sub, level, idx) {
      var ic = status === 'locked' ? LOCK_ICON : (status === 'done' ? (KIND_ICON[kind] || CHECK_ICON) : (KIND_ICON[kind] || LOCK_ICON));
      var mark = status === 'done' ? icon(CHECK_ICON, 'sc-tick') : '';
      var v = status === 'offer' ? String(idx) : '';
      var act = status === 'locked' ? 'locked' : 'node';
      return '<button class="sc-tile sc-tile--' + status + '" type="button" style="left:' + (cx - 50) + 'px;top:' + top + 'px"' +
        ' data-act="' + act + '" data-level="' + level + '" data-v="' + v + '"' + (busy ? ' disabled' : '') + '>' +
        icon(ic) + mark +
        '<span class="sc-tile-nm">' + esc(label) + '</span><span class="sc-tile-sub">' + esc(sub) + '</span></button>';
    }

    // Bottom sheet for a tapped node.
    function renderSheet(c) {
      var L = sheet.level;
      var body = '';
      if (sheet.mode === 'offer') {
        var o = offersFor(c, L)[sheet.idx];
        if (!o) return '';
        var nxt = nextPickLevel(L);
        body = '<span class="sc-chip">' + esc(KIND_LABEL[o.kind] || o.kind) + ' · Level ' + L + '</span>' +
          '<h3>' + esc(o.name) + '</h3>' +
          '<p class="sc-what">' + esc(whatItDoes(o, sample())) + '</p>' +
          '<p class="sc-leads">' + (nxt ? 'Then at Level ' + nxt + ' you choose one of three again.' : 'This is your last pick.') + '</p>' +
          '<div class="sc-foot"><button class="sc-btn ghost" type="button"' + attrs('sheet-close') + '>Not now</button>' +
          '<button class="sc-btn" type="button"' + attrs('lock', null, '') + ' data-level="' + L + '" data-reward="' + esc(o.id) + '">Lock in</button></div>';
      } else if (sheet.mode === 'done') {
        var p = (c.picks || []).filter(function (x) { return x.level === L; })[0];
        if (!p) return '';
        body = '<span class="sc-chip sc-chip--on">' + icon(CHECK_ICON) + 'Yours · Level ' + L + '</span>' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p class="sc-what">' + esc(whatItDoes(p, sample())) + '</p>' +
          '<div class="sc-foot"><button class="sc-btn ghost" type="button"' + attrs('sheet-close') + '>Close</button></div>';
      } else {
        body = '<span class="sc-chip">' + icon(LOCK_ICON) + 'Locked</span>' +
          '<h3>Level ' + L + '</h3>' +
          '<p class="sc-what">You reach this at Level ' + L + '. Then you choose one of three: a Perk, a Title or Coins.</p>' +
          '<div class="sc-foot"><button class="sc-btn ghost" type="button"' + attrs('sheet-close') + '>Close</button></div>';
      }
      return '<div class="sc-dim" data-act="sheet-close"></div><div class="sc-sheet" role="dialog" aria-modal="true" aria-label="Node details">' +
        '<div class="sc-grab"></div>' + body + '</div>';
    }

    // Plain words for what an option does.
    function whatItDoes(o, name) {
      if (o.kind === 'perk') return 'Adds XP while this tree is picked: ' + (o.desc || '') + '.' + (o.desc && /^Replaces /.test(o.desc) ? '' : '');
      if (o.kind === 'title') return 'Shows as a title under ' + PN().shortName(name) + ' on your card, on court and on your profile.';
      return 'Gives you ' + (o.value || 0) + ' coins to spend in the shop.';
    }

    function renderRespec(c) {
      var t = treeOf(c);
      return '<div class="sc-dim" data-act="respec-no"></div>' +
        '<div class="sc-sheet" role="dialog" aria-modal="true" aria-label="Respec">' +
        '<div class="sc-grab"></div><h3>Respec the ' + esc(t.name) + ' tree?</h3>' +
        '<p>This is your one free respec, ever. Your picks go back to the choice, and you choose a tree again. Looks you own stay yours.</p>' +
        '<div class="sc-foot"><button class="sc-btn ghost" type="button"' + attrs('respec-no') + '>Keep my tree</button>' +
        '<button class="sc-btn" type="button"' + attrs('respec-yes') + '>Respec, free</button></div></div>';
    }

    function render() {
      if (!el) return;
      if (!state || !state.climb) { el.innerHTML = '<p class="sc-muted">Loading your climb…</p>'; return; }
      var c = state.climb;
      var body;
      if (!c.tree) body = pickerOpen && !skipped ? renderPicker() : renderBar();
      else body = renderMap(c);
      var extra = '';
      if (c.tree && sheet) extra += renderSheet(c);
      if (c.tree && respecOpen) extra += renderRespec(c);
      var m = msg ? '<p class="sc-msg" role="alert">' + esc(msg) + '</p>' : '';
      var tcol = c.tree ? treeOf(c).color : '#FFD21F';
      el.innerHTML = '<section class="sc sc--' + esc(c.tree || 'none') + '" style="--tree:' + tcol + '">' + body + m + '</section>' + extra;
    }

    function act(a) {
      if (busy) return;
      busy = true; msg = ''; render();
      var out;
      try { out = host.onAction ? host.onAction(a) : null; } catch (e) { out = { error: 'Could not save. Try again.' }; }
      Promise.resolve(out).then(function (r) {
        busy = false;
        if (!r) return render();
        if (r.error) { msg = r.error; return render(); }
        if (r.state) {
          state = r.state;
          if (a.type === 'tree') { pickerOpen = false; skipped = false; }
          if (a.type === 'pick') { sheet = null; }
          if (a.type === 'respec') { respecOpen = false; sheet = null; skipped = false; pickerOpen = true; }
          render();
          if (a.type === 'pick' && r.pick && isBigPick(r.pick, state.climb.level)) celebrate(r.pick, { name: sample(), level: r.pick.level });
        }
      }).catch(function () {
        busy = false; msg = 'Could not save. Check the signal and try again.'; render();
      });
    }

    if (el) {
      el.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
        if (!t || t.disabled) return;
        var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
        if (a === 'skip') { skipped = true; pickerOpen = false; return render(); }
        if (a === 'picker-open') { pickerOpen = true; skipped = false; return render(); }
        if (a === 'tree') return act({ type: 'tree', tree: v });
        if (a === 'node') {
          var L = +t.getAttribute('data-level');
          var done = (state.climb.picks || []).some(function (p) { return p.level === L; });
          sheet = { level: L, mode: done ? 'done' : 'offer', idx: +v };
          msg = ''; return render();
        }
        if (a === 'locked') { sheet = { level: +t.getAttribute('data-level'), mode: 'locked', idx: 0 }; return render(); }
        if (a === 'sheet-close') { sheet = null; return render(); }
        if (a === 'lock') return act({ type: 'pick', level: +t.getAttribute('data-level'), reward: t.getAttribute('data-reward') });
        if (a === 'respec-open') { respecOpen = true; return render(); }
        if (a === 'respec-no') { respecOpen = false; return render(); }
        if (a === 'respec-yes') return act({ type: 'respec' });
      });
    }

    return {
      setState: function (s) { state = s; render(); },
      render: render
    };
  }

  // Full-screen unlock moment for big picks. Calls opts.onClose when the player taps the button.
  function celebrate(pick, opts) {
    opts = opts || {};
    var d = win && win.document;
    if (!d || !win.PlayerName) return null;
    var PN = win.PlayerName;
    var wrap = d.createElement('div');
    wrap.className = 'sc-cel';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'New unlock: ' + pick.name);
    var sparks = [[-120, -160], [120, -150], [-160, 40], [160, 30], [-60, -210], [70, -200]].map(function (xy, i) {
      return '<span class="sc-spark" style="--x:' + xy[0] + 'px;--y:' + xy[1] + 'px;animation-delay:' + (i * 0.2) + 's"></span>';
    }).join('');
    wrap.innerHTML = '<div class="sc-ring"></div><div class="sc-ring r2"></div><div class="sc-ring r3"></div>' + sparks +
      '<div class="sc-cel-wrap"><div class="sc-word">Level ' + PN.esc(opts.level) + ' pick</div>' +
      '<div class="sc-big">' + PN.esc(pick.name) + '</div>' +
      '<div class="sc-card">' + PN.html({ name: opts.name || 'You', level: opts.level, size: 'full', noCall: true }) + '</div>' +
      '<p class="sc-sub2">' + (pick.kind === 'title' ? 'Your title is on your card.' : pick.kind === 'perk' ? 'Your perk is live while this tree is picked.' : 'Coins are in your shop.') + '</p></div>' +
      '<button class="sc-btn sc-cel-btn" type="button">Got it</button>';
    var btn = wrap.querySelector('.sc-cel-btn');
    btn.addEventListener('click', function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (opts.onClose) opts.onClose();
    });
    d.body.appendChild(wrap);
    btn.focus();
    return wrap;
  }

  return {
    mount: mount,
    celebrate: celebrate,
    pickLevels: pickLevels,
    nodeStatus: nodeStatus,
    nextPickLevel: nextPickLevel,
    respecsLeft: respecsLeft,
    isBigPick: isBigPick,
    offersFor: offersFor,
    perkCount: perkCount,
    TREES: TREES,
    TREE_ORDER: TREE_ORDER,
    INTERVAL: INTERVAL,
    MAX_LEVEL: MAX_LEVEL,
    BIG_LEVEL: BIG_LEVEL
  };
});
