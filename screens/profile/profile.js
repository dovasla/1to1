/* My Profile screen (player app). Pure render: data in, HTML string out. No storage, no network.
   Browser: window.PlayerProfile. Node tests: profile.test.js.
   Spec: revamp/build/player-app-plan/XP-SYSTEM.md (sections 3, 5, 6). Card: revamp/player-card-options card C (ticket).
   Skill (1 to 30) is its own labelled block. XP, level, prestige and shop items never change skill, points, wins or team places.
   Needs these globals first: PlayerXp, PlayerName, PlayerRules, ShopCosmetics.
   Data in (all optional):
     name, skill (1 to 30), run (PlayerXp run object), coins, clanTag,
     equipped { banner, name, calling, row, clan } (shop ids or null),
     totals { points, wins, games, nights }
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerProfile = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SLOTS = ['banner', 'name', 'calling', 'row', 'clan'];
  var SLOT_LABEL = { banner: 'Banner', name: 'Name style', calling: 'Calling card', row: 'Row effect', clan: 'Clan tag' };
  var SKILL_MAX = 30;
  var STAR_MAX = 5;

  function dep(name) { return globalThis[name]; }
  function esc(s) { return dep('PlayerName').esc(s); }
  function num(n) { return (Number(n) || 0).toLocaleString('en-GB'); }
  function intOr0(v) { var x = parseInt(v, 10); return isNaN(x) || x < 0 ? 0 : x; }

  function itemOf(id) {
    var C = dep('ShopCosmetics');
    if (!id || !C || !C.ITEMS) return null;
    for (var i = 0; i < C.ITEMS.length; i++) { if (C.ITEMS[i].id === id) return C.ITEMS[i]; }
    return null;
  }

  // Everything the screen shows, worked out from the data. Pure, so tests can check it.
  function viewOf(d) {
    d = d || {};
    var XP = dep('PlayerXp');
    var run = d.run || XP.newRun();
    var p = XP.progress(run);
    var eq = d.equipped || {};
    var t = d.totals || {};
    var skill = Math.min(SKILL_MAX, intOr0(d.skill));
    var rules = dep('PlayerRules');
    var skillName = skill && rules ? rules.levelLabel(skill) : '';
    var pct = p.isMax ? 100 : (p.xpForLevel ? Math.round(p.xpInLevel / p.xpForLevel * 100) : 0);

    var equipped = SLOTS.map(function (slot) {
      var it = itemOf(eq[slot]);
      return { slot: slot, label: SLOT_LABEL[slot], name: it ? it.name : '', value: it ? it.value : '' };
    });
    var look = {};
    equipped.forEach(function (e) { look[e.slot] = e.value; });

    return {
      name: String(d.name || ''),
      level: p.level,
      tier: p.tier,
      stars: p.stars,
      bonusPct: p.bonusPct,
      isMax: p.isMax,
      canPrestige: p.canPrestige,
      pct: pct,
      toNext: p.isMax ? '' : num(p.xpToNext) + ' XP to Level ' + (p.level + 1),
      note: p.isMax ? 'Max level. Prestige to start again with a star.' : '',
      runXp: num(run.xp),
      lifetimeXp: num(run.lifetimeXp),
      skill: skill,
      skillName: skillName,
      coins: intOr0(d.coins),
      totals: {
        points: intOr0(t.points), wins: intOr0(t.wins), games: intOr0(t.games), nights: intOr0(t.nights)
      },
      equipped: equipped,
      playerName: {
        name: d.name || '',
        level: p.level,
        stars: p.stars,
        banner: look.banner || '',
        nameStyle: look.name || '',
        callingCard: look.calling || '',
        clanTag: eq.clan ? String(d.clanTag || '') : ''
      }
    };
  }

  function starsHtml(n) {
    var s = '';
    for (var i = 1; i <= STAR_MAX; i++) s += i <= n ? '★' : '<span class="off">☆</span>';
    return s;
  }

  function stat(n, label) {
    return '<div class="stat"><b>' + num(n) + '</b><span>' + label + '</span></div>';
  }

  // Picture on the card: a character (a01 to a50, local SVG) or your VIP picture (v01 to v99, sent to VIP players only).
  // Same rules as icons/characters/picture.js; a classic script cannot import that module, so the rule is repeated here.
  // Nothing is shown for a plain mark, so the card stays clean until a character is picked.
  function cardPicture(character, vipIcons) {
    var id = String(character || '');
    if (/^a[0-9]{2,3}$/.test(id)) return 'icons/characters/set/' + id + '.svg';
    if (/^v[0-9]{2}$/.test(id)) {
      var hit = (vipIcons || []).filter(function (x) { return x && x.id === id && /^data:image\//.test(String(x.src || '')); })[0];
      return hit ? hit.src : '';
    }
    return '';
  }

  // Banner colour from the shop: only a plain colour or a gradient is used, so nothing odd can reach the style attribute.
  function safeBand(v) {
    var s = String(v || '');
    return /^(#[0-9a-fA-F]{3,8}|linear-gradient\([^;<>"'{}]*\))$/.test(s) ? s : '';
  }

  // The Check Ball mark (brand/check-ball, the same tile as the app icon). Shown until a character is picked.
  var MARK = 'brand/check-ball/mark-black.svg';

  // The picture slot. Always there, so Change look can fill it at once. Until a character is picked it shows
  // the Check Ball mark, so the card is never blank.
  function pictureHtml(src, firstName) {
    var letter = String(firstName || '').charAt(0).toUpperCase();
    var slot = '<span class="pic-slot" data-card-pic data-initial="' + esc(letter) + '">';
    slot += '<img class="tk-pic" alt="" src="' + esc(src || MARK) + '" width="64" height="64">';
    return slot + '</span>';
  }

  function render(d) {
    var v = viewOf(d);
    var bonus = v.bonusPct > 0 ? '+' + v.bonusPct + '% XP' : (v.bonusPct < 0 ? (-v.bonusPct) + '% slower XP per star' : 'No XP bonus yet');
    var pic = cardPicture(d && d.character, d && d.vip && d.vip.icons);

    var h = '';
    h += '<header class="p-top"><h1>My Profile</h1>' +
      '<span class="coins">' + num(v.coins) + ' coins</span></header>';

    // Player card: banner behind, picture, username, first name and initial, level and stars (PlayerName), Change look.
    var parts = String(d && d.name || '').trim().split(/\s+/);
    var firstName = parts[0] || '';
    var initial = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
    var band = safeBand(v.playerName.banner);
    h += '<section class="ticket" aria-label="Player card">' +
      '<div class="tk-band"' + (band ? ' style="background:' + band + '"' : '') + '></div>' +
      '<div class="tk-body">' +
      '<div class="tk-who">' + pictureHtml(pic, firstName) +
      '<div class="tk-name"><span class="tk-user">' + esc(String(d && d.name || '')) + '</span>' +
      (v.playerName.clanTag ? ' <span class="pn-clan tk-clan">' + esc(v.playerName.clanTag) + '</span>' : '') +
      '<p class="tk-real">' + esc(firstName + (initial ? ' ' + initial : '')) + ' · Level ' + v.level +
      ' · <span class="tk-stars" role="img" aria-label="' + v.stars + ' of ' + STAR_MAX + ' stars">' + starsHtml(v.stars) + '</span></p></div></div>' +
      '<div class="tk-rule"></div>' +
      '<button class="btn-outline" type="button" data-change-look>Change look</button>' +
      '</div></section>';

    // Level and XP.
    h += '<section class="card" aria-labelledby="lvT"><h2 class="cap" id="lvT">Level</h2>' +
      '<div class="lvl"><span class="lvl-num" data-count="' + v.level + '">' + v.level + '</span>' +
      '<div><span class="badge">' + esc(v.tier) + '</span></div></div>' +
      '<div class="bar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v.pct + '">' +
      '<i style="width:' + v.pct + '%"></i></div>' +
      '<p class="muted">' + esc(v.toNext || v.note) + '</p>' +
      '<p class="muted">' + esc(NAMES.sessionXp) + ' ' + esc(v.runXp) + ' · Lifetime XP ' + esc(v.lifetimeXp) + '</p>' +
      '<div class="stars-row"><span class="stars" role="img" aria-label="' + v.stars + ' of ' + STAR_MAX + ' prestige stars">' +
      starsHtml(v.stars) + '</span><span class="muted">' + bonus + '</span></div>';
    if (v.canPrestige) {
      h += '<div class="prestige"><p>Go back to Level 1 and gain a star. Your coins and looks stay.</p>' +
        '<button class="btn yellow" type="button" data-prestige>Prestige</button>' +
        '<p class="muted" data-prestige-note aria-live="polite"></p></div>';
    }
    h += '</section>';

    // Season numbers.
    h += '<section aria-labelledby="numT"><h2 class="cap" id="numT">Your numbers</h2><div class="grid4">' +
      stat(v.totals.points, 'Points') + stat(v.totals.wins, 'Wins') +
      stat(v.totals.games, 'Games') + stat(v.totals.nights, NAMES.sessions) +
      '</div></section>';

    // No skill rating here (R60, R62): players never see their skill number. viewOf still carries it for the organiser side.

    // Equipped look and shop link.
    var rows = v.equipped.map(function (e) {
      return '<li><span>' + esc(e.label) + '</span><span class="muted">' +
        (e.name ? esc(e.name) : 'Nothing equipped') + '</span></li>';
    }).join('');
    h += '<section class="card" aria-labelledby="lkT"><h2 class="cap" id="lkT">Your look</h2>' +
      '<ul class="list">' + rows + '</ul>' +
      '<a class="btn-outline" href="../../shop/shop.html">Open shop</a></section>';

    // Your character (R70). The picker is filled in by app.js after render (it loads picker.js).
    h += '<section class="card character" aria-labelledby="chT"><h2 class="cap" id="chT">Your character</h2>' +
      '<div data-character-picker></div><p class="muted" data-character-note aria-live="polite"></p></section>';

    // VIP icon pictures (migration-48). Only shown when the server sent pictures to a VIP player.
    if (d && d.vip && d.vip.icons && d.vip.icons.length) {
      h += '<section class="card vip" aria-labelledby="vipT"><h2 class="cap" id="vipT">VIP character</h2>' +
        '<div class="vip-grid" role="group" aria-label="Pick your VIP character">' +
        d.vip.icons.map(function (ic) {
          var on = ic.id === d.vip.current;
          return '<button type="button" class="vip-pick' + (on ? ' on' : '') + '" data-vip-icon="' + esc(ic.id) +
            '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="Icon ' + esc(ic.id) + '">' +
            '<img alt="" src="' + esc(ic.src) + '" width="56" height="56"></button>';
        }).join('') +
        '</div></section>';
    }

    return h;
  }

  // Two taps for prestige: the first arms the button, the second does it. Nothing happens by accident.
  // The character picker is mounted by app.js (see mountCharacterPicker).
  function reduceMotion() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Count the level up from 1 to its value. Skipped under Reduce motion.
  function countUp(el, to, ms) {
    if (!el || !(to > 1) || reduceMotion() || typeof requestAnimationFrame !== 'function') return;
    var t0 = null;
    el.textContent = '1';
    function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / (ms || 500));
      el.textContent = String(Math.max(1, Math.round(1 + (to - 1) * k)));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Shows a new picture on the card at once (called after a pick in the picker).
  // The new picture settles in with a short scale-in; Reduce motion turns that off in CSS.
  function updateCardPicture(container, character, vipIcons) {
    var slot = container && container.querySelector('[data-card-pic]');
    if (!slot) return;
    var src = cardPicture(character, vipIcons);
    var wrap = document.createElement('div');
    wrap.innerHTML = pictureHtml(src, slot.getAttribute('data-initial') || '?');
    slot.parentNode.replaceChild(wrap.firstChild, slot);
  }

  // Two taps for prestige: the first arms the button, the second does it. Nothing happens by accident.
  // Change look scrolls to the picker (or calls onChangeLook if app.js gives one).
  function bind(container, onPrestige, onVipIcon, onChangeLook) {
    var count = container.querySelector('[data-count]');
    if (count) countUp(count, Number(count.getAttribute('data-count')), 500);

    var look = container.querySelector('[data-change-look]');
    if (look) {
      look.addEventListener('click', function () {
        if (onChangeLook) { onChangeLook(); return; }
        var sec = container.querySelector('.character');
        if (!sec) return;
        sec.setAttribute('tabindex', '-1');
        if (sec.scrollIntoView) sec.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
        sec.focus({ preventScroll: true });
      });
    }
    if (onVipIcon) {
      container.querySelectorAll('[data-vip-icon]').forEach(function (b) {
        b.addEventListener('click', function () { onVipIcon(b.getAttribute('data-vip-icon')); });
      });
    }
    var btn = container.querySelector('[data-prestige]');
    if (!btn) return;
    var note = container.querySelector('[data-prestige-note]');
    var armed = false;
    var timer = null;
    function disarm() {
      armed = false;
      btn.textContent = 'Prestige';
      if (note) note.textContent = '';
    }
    btn.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        btn.textContent = 'Tap again to prestige';
        if (note) note.textContent = 'Tap once more within 5 seconds.';
        timer = setTimeout(disarm, 5000);
        return;
      }
      clearTimeout(timer);
      disarm();
      if (onPrestige) onPrestige();
    });
  }

  // Mock players for the screen and the test page. Not real people.
  var SCENARIOS = {
    'new': {
      name: 'Alex Brown', skill: 3, run: null, coins: 0, clanTag: '', equipped: {},
      totals: { points: 0, wins: 0, games: 0, nights: 0 }
    },
    'mid': {
      name: 'Sam Kowalski', skill: 14, coins: 540, clanTag: 'NX',
      run: { xp: 280, lifetimeXp: 900, stars: 1, prestiges: 1, streak: 3, lastNight: 9, maxLevel: 12 },   // R87 (e): level 12 starts at 264 XP on the current curve; 280 is 16 of 33 into it
      equipped: { banner: 'banner-blue', name: 'name-caps', calling: null, row: null, clan: 'clan-tag' },
      totals: { points: 212, wins: 19, games: 41, nights: 9 }
    },
    'max': {
      name: 'Jamie Ortiz', skill: 27, coins: 4800, clanTag: 'OG',
      run: { xp: 7300, lifetimeXp: 20000, stars: 4, prestiges: 4, streak: 6, lastNight: 40, maxLevel: 60 },
      equipped: { banner: 'banner-ember', name: 'name-gold', calling: 'calling-gold', row: null, clan: 'clan-tag' },
      totals: { points: 690, wins: 58, games: 118, nights: 40 }
    }
  };

  return {
    render: render,
    bind: bind,
    viewOf: viewOf,
    cardPicture: cardPicture,
    updateCardPicture: updateCardPicture,
    safeBand: safeBand,
    SCENARIOS: SCENARIOS,
    SLOT_LABEL: SLOT_LABEL
  };
});
