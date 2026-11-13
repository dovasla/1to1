/* Shop screen. Draws the catalog, the equipped look and the slide-up sheet. The server (via shop-backend.js) is the truth. */
(function () {
  'use strict';
  var R = window.ShopRules;
  var PN = window.PlayerName;
  var C = window.ShopCosmetics;
  var B = window.ShopBackend;
  var SAMPLE_NAME = 'Sam Kowalski';

  // Inside the player app, use the app's own shop backend (one balance shared with Home and Profile, QA item 1).
  // Demo page: falls back to the mock (level 12, 3 stars), in memory only.
  var host = null;
  try { host = window.parent !== window && window.parent.PlayerShop ? window.parent.PlayerShop : null; } catch (e) { host = null; }
  var backend = host ? host.get() : B.create(window.PLAYER_APP_CONFIG || { backend: 'mock', level: 12, stars: 3 },
    function () { return window.PLAYER_TOKEN || ''; });

  var st = null;
  var openItem = null;
  var closeTimer = null;
  var busy = false;

  function $(id) { return document.getElementById(id); }

  function lookFor(override) {
    var l = R.look(st, override);
    return l;
  }

  function playerProps(override, size) {
    var l = lookFor(override);
    return {
      name: SAMPLE_NAME, level: st.level, stars: st.stars, size: size,
      banner: l.banner, nameStyle: l.nameStyle, callingCard: l.callingCard,
      rowEffect: l.rowEffect, clanTag: l.clanTag
    };
  }

  function metaText(item, s) {
    if (s === 'locked') return R.lockText(item, st);
    if (s === 'on') return 'On your card';
    if (s === 'use') return 'Owned';
    if (s === 'short') return item.price + ' coins';
    return item.price + ' coins';
  }

  // Sample for each tile. Calling cards show as the card, the rest as the name chip.
  function swatchHtml(item) {
    if (item.slot === 'calling') {
      return '<span class="pn-call pn-call--' + item.value + '">' +
        '<span class="pn-call-title">Sam K</span><span class="pn-call-stat">Lv 12</span></span>';
    }
    var l = R.look({ items: st.items, equipped: {}, clanTag: '' },
      { slot: item.slot, id: item.id, tag: st.clanTag || 'TNT' });
    return PN.html({
      name: 'Sam K', level: 12, stars: 3,
      banner: l.banner, nameStyle: l.nameStyle, rowEffect: l.rowEffect, clanTag: l.clanTag
    });
  }

  function tile(item) {
    var s = R.status(item, st);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile tile--' + s;
    b.setAttribute('aria-label', item.name + ', ' + metaText(item, s));

    var sw = document.createElement('div');
    sw.className = 'swatch';
    sw.innerHTML = swatchHtml(item);

    var name = document.createElement('span');
    name.className = 'tile-name';
    name.textContent = item.name;

    var meta = document.createElement('span');
    meta.className = 'tile-meta';
    meta.textContent = metaText(item, s);

    b.appendChild(sw);
    b.appendChild(name);
    b.appendChild(meta);
    b.addEventListener('click', function () { openSheet(item.id); });
    return b;
  }

  function renderGrid() {
    var host = $('grid');
    host.innerHTML = '';
    C.SLOT_ORDER.forEach(function (slot) {
      var items = st.items.filter(function (i) { return i.slot === slot; });
      if (!items.length) return;
      var sec = document.createElement('section');
      sec.className = 'group';
      var h = document.createElement('h2');
      h.textContent = C.SLOT_LABEL[slot];
      sec.appendChild(h);
      var wrap = document.createElement('div');
      wrap.className = 'tiles';
      items.forEach(function (item) { wrap.appendChild(tile(item)); });
      sec.appendChild(wrap);
      host.appendChild(sec);
    });
  }

  function renderAll() {
    if (!st) return;
    $('coins').textContent = Number(st.coins).toLocaleString('en-GB');
    $('heroLv').textContent = st.level;
    $('preview').innerHTML = PN.html(playerProps(null, 'full'));
    renderGrid();
  }

  // ---- sheet ----

  function infoText(item, s) {
    if (s === 'locked') return R.lockText(item, st) + '.';
    if (s === 'short') return 'You need ' + (item.price - st.coins) + ' more coins.';
    if (s === 'buy') return 'Costs ' + item.price + ' coins. You can take it off any time.';
    if (s === 'use') return 'You own this. Put it on your card.';
    return 'On your card. Tap to take it off.';
  }

  function actLabel(item, s) {
    if (s === 'locked') return 'Locked';
    if (s === 'short') return 'Not enough coins';
    if (s === 'buy') return 'Buy for ' + item.price;
    if (s === 'use') return 'Use this';
    return 'Take off';
  }

  function renderSheet(message) {
    if (!openItem || !st) return;
    var item = openItem;
    var s = R.status(item, st);
    var isClan = item.slot === 'clan';
    var tagValue = isClan ? R.clean($('tagIn').value) : '';
    var tagBad = isClan && s !== 'on' && (!R.validTag(tagValue) || R.blockedTag(tagValue));

    $('tagLabel').hidden = !isClan;
    $('tagIn').hidden = !isClan;

    var override = s === 'on' ? null : { slot: item.slot, id: item.id, tag: tagValue };
    $('sheetPreview').innerHTML = PN.html(playerProps(override, 'full'));
    $('sheetInfo').textContent = message || infoText(item, s);

    var btn = $('act');
    if (busy) btn.textContent = 'Saving...';
    else if (tagBad && s !== 'locked' && s !== 'short') {
      btn.textContent = R.validTag(tagValue) ? 'Tag not allowed' : 'Type a tag first';
    }
    else btn.textContent = actLabel(item, s);
    btn.disabled = busy || s === 'locked' || s === 'short' || tagBad;
    btn.className = 'btn' + (s === 'on' ? ' ghost' : '');
    $('sheetErr').hidden = true;
  }

  function openSheet(id) {
    var item = st && st.items.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    openItem = item;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    $('sheetT').textContent = item.name;
    $('tagIn').value = st.clanTag;
    renderSheet();
    $('scrim').hidden = false;
    $('sheet').hidden = false;
    requestAnimationFrame(function () { $('sheet').classList.add('open'); });
    $('sheetT').focus();
  }

  function closeSheet() {
    if (!openItem) return;
    openItem = null;
    $('sheet').classList.remove('open');
    $('scrim').hidden = true;
    closeTimer = setTimeout(function () { $('sheet').hidden = true; closeTimer = null; }, 240);
    renderAll();
  }

  function showError(msg) {
    var e = $('sheetErr');
    e.textContent = msg;
    e.hidden = false;
  }

  function onAct() {
    if (!openItem || busy) return;
    var tag = openItem.slot === 'clan' ? $('tagIn').value : '';
    busy = true;
    renderSheet();
    backend.act(openItem.id, tag).then(function (res) {
      busy = false;
      if (!res.ok) { renderSheet(); showError(res.error); return; }
      st = res.state;
      renderAll();
      renderSheet(res.message);
    }, function () {
      busy = false;
      renderSheet();
      showError('Could not save. Check the signal and try again.');
    });
  }

  // ---- load ----

  function load() {
    $('loadErr').hidden = true;
    $('retry').hidden = true;
    backend.load().then(function (res) {
      if (!res.ok) { showLoadError(res.error); return; }
      st = res.state;
      renderAll();
    }, function () {
      showLoadError('Could not load the shop. Check the signal and try again.');
    });
  }

  function showLoadError(msg) {
    $('loadErr').textContent = msg;
    $('loadErr').hidden = false;
    $('retry').hidden = false;
    $('grid').innerHTML = '';
  }

  // ---- boot ----

  $('act').addEventListener('click', onAct);
  $('close').addEventListener('click', closeSheet);
  $('scrim').addEventListener('click', closeSheet);
  // Swipe down to dismiss: drag the sheet down more than 80px and let go (pop-up sheet look, Fable pick).
  (function () {
    var sheet = $('sheet'), startY = null, dy = 0;
    if (!sheet) return;
    sheet.addEventListener('touchstart', function (e) {
      if (sheet.scrollTop > 0) { startY = null; return; }
      startY = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transition = 'none';
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    sheet.addEventListener('touchend', function () {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 80) closeSheet();
      dy = 0;
    });
  })();
  $('retry').addEventListener('click', load);
  $('tagIn').addEventListener('input', function () { renderSheet(); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeSheet();
  });

  load();
})();
