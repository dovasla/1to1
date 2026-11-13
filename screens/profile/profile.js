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

  function render(d) {
    var v = viewOf(d);
    var PN = dep('PlayerName');
    var bonus = v.bonusPct > 0 ? '+' + v.bonusPct + '% XP' : 'No XP bonus yet';

    var h = '';
    h += '<header class="p-top"><h1>My Profile</h1>' +
      '<span class="coins">' + num(v.coins) + ' coins</span></header>';

    // Player card (ticket, card C). Name, level and stars come from PlayerName.
    h += '<section class="ticket" aria-label="Player card">' +
      '<div class="tk-top"><span class="tk-brand">1TO1</span><span class="tk-admit">Player card</span></div>' +
      '<div class="tk-name">' + PN.html(Object.assign({ size: 'full' }, v.playerName)) + '</div>' +
      '<div class="tk-rule"></div>' +
      '<p class="tk-foot">Player card</p>' +
      '</section>';

    // Level and XP.
    h += '<section class="card" aria-labelledby="lvT"><h2 class="cap" id="lvT">Level</h2>' +
      '<div class="lvl"><span class="lvl-num">' + v.level + '</span>' +
      '<div><span class="badge">' + esc(v.tier) + '</span></div></div>' +
      '<div class="bar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v.pct + '">' +
      '<i style="width:' + v.pct + '%"></i></div>' +
      '<p class="muted">' + esc(v.toNext || v.note) + '</p>' +
      '<p class="muted">Run XP ' + esc(v.runXp) + ' · Lifetime XP ' + esc(v.lifetimeXp) + '</p>' +
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
      stat(v.totals.games, 'Games') + stat(v.totals.nights, 'Nights') +
      '</div></section>';

    // Skill rating, clearly separate from level.
    h += '<section class="card" aria-labelledby="skT"><h2 class="cap" id="skT">Skill rating</h2>' +
      '<p class="skill-num">' + (v.skill || '–') + ' <small>of ' + SKILL_MAX + '</small></p>' +
      '<p class="skill-name">' + esc(v.skillName || 'Not set') + '</p>' +
      '<p class="muted">Picked at sign-up. XP, level and shop items never change it.</p></section>';

    // Equipped look and shop link.
    var rows = v.equipped.map(function (e) {
      return '<li><span>' + esc(e.label) + '</span><span class="muted">' +
        (e.name ? esc(e.name) : 'Nothing equipped') + '</span></li>';
    }).join('');
    h += '<section class="card" aria-labelledby="lkT"><h2 class="cap" id="lkT">Your look</h2>' +
      '<ul class="list">' + rows + '</ul>' +
      '<a class="btn" href="../../shop/shop.html">Open shop</a></section>';

    return h;
  }

  // Two taps for prestige: the first arms the button, the second does it. Nothing happens by accident.
  function bind(container, onPrestige) {
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
      run: { xp: 561, lifetimeXp: 900, stars: 1, prestiges: 1, streak: 3, lastNight: 9, maxLevel: 12 },
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
    SCENARIOS: SCENARIOS,
    SLOT_LABEL: SLOT_LABEL
  };
});
