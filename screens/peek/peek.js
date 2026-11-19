/* Player peek: a slide-up card for ANOTHER player, opened by tapping their row on the leaderboard.
   Usernames only (never a first name or initial). Shows their look (banner, name style, worn items) and their stats.
   It is an overlay, not a route: closing it leaves the screen underneath exactly as it was (a live game keeps running).
   Plain JS, no framework. Text is always escaped. Needs PlayerName (lib/player-name.js) for the chip.
   Usage:
     PlayerPeek.bind(containerEl, { call: function (publicId) { return Promise of player_card JSON; } });
*/
(function (root) {
  'use strict';

  var overlay = null;
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(v) {
    var x = Number(v);
    return isFinite(x) ? Math.round(x) : 0;
  }

  // The worn items, by name. Only ids the shop sends are shown (text is escaped).
  function wornList(eq) {
    var out = [];
    if (eq.l_effect || eq.effect) out.push('Effect');
    if (eq.banner) out.push('Banner');
    if (eq.name) out.push('Name style');
    if (eq.calling) out.push('Calling card');
    if (eq.row) out.push('Row effect');
    if (eq.clan) out.push('Clan tag');
    return out;
  }

  function statHtml(label, value) {
    return '<div class="pk-stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
  }

  // r7: approved photo, else the chosen Phosphor icon, else nothing. Only from public_id looks.
  function avatarOf(d) {
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(String(d.photo || ''))) {
      return '<span class="pk-av"><img src="' + d.photo + '" alt=""></span>';
    }
    if (/^[a-z-]{3,30}$/.test(String(d.phIcon || ''))) {
      return '<span class="pk-av"><span class="ph-glyph" style="-webkit-mask-image:url(icons/phosphor/' + d.phIcon + '.svg);mask-image:url(icons/phosphor/' + d.phIcon + '.svg)"></span></span>';
    }
    return '';
  }

  function cardHtml(d) {
    var p = d.player || {};
    var s = d.stats || {};
    var eq = p.equipped || {};
    // The worn look: the shop's layers (l_<layer> keys) plus the old slot names. PlayerName keeps only known ids.
    var layers = {};
    ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'flourish', 'row', 'ring', 'intro', 'pop'].forEach(function (k) {
      if (eq['l_' + k]) layers[k] = eq['l_' + k];
    });
    var look = root.ShopTree ? ShopTree.fromPublic(p) : { clanTag: '', title: '', classes: '' };
    var chip = root.PlayerName
      ? root.PlayerName.html({ name: p.name || p.username || 'Player', level: p.level, stars: p.stars, banner: eq.banner || '',
          nameStyle: eq.name || '', rowEffect: eq.row || '', clanTag: look.clanTag || p.clan_tag || '', callingCard: eq.calling || '',
          look: eq.l_effect || eq.effect || '', layers: layers, size: 'full' })
      : esc(p.name || p.username || 'Player');
    var worn = wornList(eq);
    var wornLine = worn.length ? 'Wearing: ' + worn.join(', ') + '.' : 'Nothing worn yet.';
    var you = d.is_me ? '<p class="pk-note">This is you.</p>' : '';
    return '<h2 id="pk-title" class="pk-title">Player card</h2>' +
      '<div class="pk-chip ' + esc(look.classes) + '">' + avatarOf(d) + chip + (look.title ? ' <span class="st-pill">' + esc(look.title) + '</span>' : '') + '</div>' +
      you +
      '<p class="pk-worn">' + esc(wornLine) + '</p>' +
      '<div class="pk-grid">' +
        statHtml('Level', num(s.level || p.level)) +
        statHtml('Games', num(s.games)) +
        statHtml('Wins', num(s.wins)) +
        statHtml('Win %', num(s.win_pct) + '%') +
        statHtml('Best game', num(s.best_game)) +
        statHtml('MVPs', num(s.mvps)) +
      '</div>';
  }

  function messageHtml(text) {
    return '<h2 id="pk-title" class="pk-title">Player card</h2><p class="pk-note" role="status">' + esc(text) + '</p>';
  }

  function ensure() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'pk-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="pk-sheet" role="dialog" aria-modal="true" aria-labelledby="pk-title">' +
        '<div class="pk-grab" aria-hidden="true"></div>' +
        '<div class="pk-body" id="pk-body"></div>' +
        '<button type="button" class="pk-close" data-pk="close">Close</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || (e.target.closest && e.target.closest('[data-pk="close"]'))) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hidden) close();
    });
    return overlay;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function show(html) {
    var el = ensure();
    el.querySelector('#pk-body').innerHTML = html;
    el.hidden = false;
    var btn = el.querySelector('[data-pk="close"]');
    if (btn) btn.focus();
  }

  // Opens the card for one public id. call(publicId) must return a promise of the player_card JSON.
  function open(publicId, call, returnFocus) {
    lastFocus = returnFocus || null;
    show(messageHtml('Loading...'));
    Promise.resolve().then(function () { return call(publicId); }).then(function (d) {
      if (!d || d.ok !== true) {
        var why = d && d.reason === 'hidden' ? 'This player is hidden.' : 'Can’t load this player right now. Check your signal and try again.';
        show(messageHtml(why));
        return;
      }
      show(cardHtml(d));
    }, function () {
      show(messageHtml('Can’t load this player right now. Check your signal and try again.'));
    });
  }

  // Tap any element with data-player="<public id>" inside the container. The listener is added once per container.
  function bind(container, opts) {
    if (!container || container._peekBound) return;
    container._peekBound = true;
    container.addEventListener('click', function (e) {
      var row = e.target && e.target.closest ? e.target.closest('[data-player]') : null;
      if (!row || !container.contains(row)) return;
      var id = row.getAttribute('data-player');
      if (!id || id === 'undefined') return;
      open(id, opts.call, row);
    });
  }

  root.PlayerPeek = { bind: bind, open: open, close: close, cardHtml: cardHtml };
})(typeof window !== 'undefined' ? window : globalThis);
