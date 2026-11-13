/* App shell: loading -> log in -> Home, with four tabs (Home, Live, Profile, More).
   Plain JS, no framework. Uses the finished screens: home, profile, leaderboard, shop (in a frame),
   loading, lineup reveal and lib/xp.js + lib/player-name.js.

   Flow: cold start -> loading screen (PlayerLoading) -> log in -> Home.
   The lineup reveal opens from Home (Lineup button) and on its own while the app is open, 1 minute before a game.
   More holds Leaderboard, Shop, Settings and About.

   MOCK DATA: until the Supabase keys arrive (config.js backend 'mock'), this shell seeds one demo player
   (first name Sam, last initial K, PIN 1234) and a demo night into an in-memory store on every load.
   Nothing is kept on the phone, as in night.html.
   Test links: ?t=lineup (a game starts in 45 seconds, Lineup button shows) and ?t=live (a game is on court).
*/
(function () {
  'use strict';

  var cfg = window.PLAYER_APP_CONFIG || {};
  var params = new URLSearchParams(location.search);
  // Demo data only when config says mock, or the test link adds ?mock=1. Otherwise the real online database.
  var kind = (cfg.backend === 'supabase' && params.get('mock') !== '1') ? 'supabase' : 'mock';
  var be = PlayerBackend.create(kind, kind === 'mock'
    ? { store: PlayerBackend.memoryStore() }
    : { url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey });
  var NIGHT_ID = 'tonight';
  var TABS = ['home', 'live', 'profile', 'more'];
  var SUBS = ['leaderboard', 'shop'];
  var SUB_PARENT = { live: '#live', profile: '#profile', more: '#more' };
  var THEME_KEY = '1to1-theme';
  var $ = function (id) { return document.getElementById(id); };

  var LOGIN_MSG = {
    'wrong-details': 'No one signed up with that name. Check the spelling, or sign up first.',
    'wrong-pin': 'Wrong PIN. Try again.',
    'locked': 'Too many wrong tries. Wait a few minutes and try again, or ask Jord at the desk.'
  };

  // Mock people. Sam K is the demo player who logs in.
  var PEOPLE = {
    blue: [['Sam', 'K', 12, 'Steady Starter'], ['Ali', 'R', 9, 'Quick Hands'], ['Jo', 'M', 7, 'Ball Mover'], ['Mia', 'L', 10, 'Rim Runner'], ['Tom', 'W', 3, 'Rookie']],
    red: [['Priya', 'T', 14, 'Floor General'], ['Ben', 'C', 5, 'Corner Sniper'], ['Zoe', 'B', 8, 'Box Out'], ['Leo', 'F', 6, 'Pick and Roll'], ['Ava', 'D', 11, 'Glue Guy']]
  };
  var TEAMS = [
    { id: 'b', name: 'Blue', played: 4, wins: 3, points: 14 },
    { id: 'r', name: 'Red', played: 4, wins: 1, points: 9 }
  ];
  var PLAYERS = [
    { id: 'priya', name: 'Priya Taylor', level: 14, stars: 0, points: 240, wins: 21, banner: 'gold', clanTag: 'OG' },
    { id: 'sam', name: 'Sam Kowalski', level: 12, stars: 1, points: 212, wins: 19, banner: 'blue', clanTag: 'NX' },
    { id: 'ava', name: 'Ava Dunn', level: 11, stars: 0, points: 180, wins: 15, banner: '', clanTag: '' },
    { id: 'mia', name: 'Mia Lewis', level: 10, stars: 0, points: 150, wins: 12, banner: '', clanTag: '' },
    { id: 'zoe', name: 'Zoe Brown', level: 8, stars: 0, points: 95, wins: 7, banner: '', clanTag: '' }
  ];

  var S = {
    pin: '',         // kept in memory for this session only (I've paid), never stored
    claimed: false,
    alerts: false,
    nickname: '',
    teamPref: 'any',
    liveScreen: null,
    moreScreen: null,
    me: null,        // { first, lastInitial, status } after a good log in. Memory only.
    night: null,     // demo night payload
    home: null,      // PlayerHome handle
    reveal: null,    // LineupReveal.watch handle
    run: null,       // XP run for the demo player
    coins: null,     // coin balance, read from the shop backend (one source for Home, Profile and Shop)
    live: null
  };

  // ---------- helpers ----------
  function hhmm(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function toP(row) { return { first: row[0], lastInitial: row[1], level: row[2], title: row[3] }; }
  function sameGroup(list) { return list.map(toP); }

  // Demo night: five games, 7.5 minutes apart. soon = true puts the first game 45 seconds away.
  function makeNight(now, soon) {
    var base = soon ? now + 45000 : now + 72 * 60000;
    var games = [];
    for (var i = 0; i < 5; i++) {
      games.push({
        id: 'g-' + (i + 1), no: i + 1,
        next: i === 0 && base - now <= 60000,   // flagged only in the minute before tip-off, as the organiser does
        startsAt: new Date(base + i * 450000).toISOString(),
        mapName: 'New College',
        teams: [{ name: 'Blue', players: sameGroup(PEOPLE.blue) }, { name: 'Red', players: sameGroup(PEOPLE.red) }]
      });
    }
    return { title: 'Tonight', when: 'Thursday, 8pm', price: '£5', games: games };
  }

  function nextGame(now) {
    var games = (S.night && S.night.games) || [];
    for (var i = 0; i < games.length; i++) {
      if (Date.parse(games[i].startsAt) > now - 600000) return games[i];
    }
    return null;
  }

  // Stay signed in on this phone for 90 days. The phone keeps only the sign-in token, never the PIN.
  var TOKEN_KEY = '1to1-player-token';
  function saveToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* blocked: sign in each time */ } }
  function readToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* nothing to clear */ } }

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveTheme(v) {
    try { localStorage.setItem(THEME_KEY, v); } catch (e) { /* private window: keep it for this visit only */ }
  }
  function applyTheme(v) {
    if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v);
    else document.documentElement.removeAttribute('data-theme');
  }

  // ---------- one coin balance for Home, Profile and Shop (QA item 1) ----------
  // Home, Profile and the Shop frame all read the same shop backend. Online the server holds the balance;
  // in mock mode there is one in-memory copy that follows the demo player's level and stars.
  var shopBe = null;
  function readCoinsFrom(r) {
    if (r && r.state && typeof r.state.coins === 'number') { S.coins = r.state.coins; refreshCoins(); }
    return r;
  }
  function ensureShop() {
    if (shopBe) return shopBe;
    var real = window.ShopBackend.create(kind === 'supabase'
      ? cfg
      : { backend: 'mock', level: PlayerXp.progress(S.run).level, stars: S.run.stars },
      function () { return readToken(); });
    shopBe = {
      load: function () { return real.load().then(readCoinsFrom); },
      act: function (id, tag) { return real.act(id, tag).then(readCoinsFrom); }
    };
    return shopBe;
  }
  // The Shop frame asks for this same instance (same origin), so a purchase updates Home and Profile at once.
  window.PlayerShop = { get: ensureShop };
  function refreshCoins() {
    if (S.home) S.home.update(homeData(Date.now()));
    var prof = $('profile');
    if (prof && prof.childNodes.length) renderProfile();
  }

  // ---------- data for the screens ----------
  function homeData(now) {
    var game = nextGame(now);
    var games = (S.night && S.night.games) || [];
    return {
      player: { name: 'Sam Kowalski', banner: 'gold', nameStyle: '', clanTag: 'NX', skill: 'Steady Starter', games: 34, wins: 19 },
      run: S.run,
      coins: S.coins || 0,
      next: game ? { gameNo: game.no, vs: 'Red', dayLabel: 'Thursday, ' + hhmm(game.startsAt), startsAt: game.startsAt } : null,
      nextRunLabel: 'Sunday 12:45',
      schedule: games.map(function (g) {
        var state = game && g.id === game.id ? 'next' : 'todo';
        return { no: g.no, time: hhmm(g.startsAt), vs: 'Red', state: state };
      }),
      lastNight: { xp: 143, games: 3, wins: 2 },
      live: S.live,
      updatedAt: null
    };
  }

  // Profile looks up shop items by id. The shop module exports ITEMS only, so add the lookup here (shim, shell only).
  if (window.ShopCosmetics && typeof window.ShopCosmetics.byId !== 'function') {
    window.ShopCosmetics.byId = function (id) {
      var list = window.ShopCosmetics.ITEMS || [];
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
      return null;
    };
  }

  // ---------- screens ----------
  function showLogin() {
    $('shell').hidden = true;
    $('login').hidden = false;
    $('loginErr').hidden = true;
  }

  function showShell() {
    $('login').hidden = true;
    $('shell').hidden = false;
  }

  function openLineup() {
    var game = nextGame(Date.now());
    var lineup = game && S.me ? LineupReveal.buildLineup(game, { first: S.me.first, lastInitial: S.me.lastInitial }) : null;
    if (lineup && typeof LineupReveal.open === 'function') LineupReveal.open(lineup, {});
  }

  // Live tab data: the Live screen (screens/live) draws it. Built from the published night.
  function liveData() {
    var games = (S.night && S.night.games) || [];
    var game = nextGame(Date.now());
    var soon = game && (Date.parse(game.startsAt) - Date.now()) <= 60000 ? game : null;
    var lineup = null;
    if (soon) {
      var mine = soon.teams.filter(function (t) { return t.name === 'Blue'; })[0];
      var theirs = soon.teams.filter(function (t) { return t.name !== 'Blue'; })[0];
      var pl = function (t) {
        return (t ? t.players : []).map(function (p) {
          return { id: p.first + p.lastInitial, name: p.first + ' ' + p.lastInitial, level: p.level, stars: 0, banner: '', clanTag: '', captain: false };
        });
      };
      lineup = { game: soon.no, teamA: 'Blue', teamB: 'Red', players: { Blue: pl(mine), Red: pl(theirs) } };
    }
    return {
      me: { team: 'Blue' },
      now: S.live,
      nextUp: game ? { team: 'Red' } : null,
      lineup: lineup,
      upcoming: games.map(function (g) {
        return { no: g.no, time: hhmm(g.startsAt), vs: 'Red', state: game && g.id === game.id ? 'next' : 'todo' };
      }),
      updatedAt: null
    };
  }

  function renderLive() {
    if (!S.liveScreen) S.liveScreen = PlayerLive.mount($('live'), liveData(), { onReveal: openLineup });
    else S.liveScreen.update(liveData());
    var ul = $('standings');
    ul.innerHTML = '';
    TEAMS.slice().sort(function (a, b) { return b.points - a.points; }).forEach(function (t, i) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = (i + 1) + '. ' + t.name;
      var b = document.createElement('span'); b.className = 'muted'; b.textContent = t.points + ' pts';
      li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
    $('standNote').textContent = 'Standings update during run time.';
  }

  function onPrestige() {
    if (!PlayerXp.canPrestige(S.run)) return;
    S.run = PlayerXp.prestige(S.run);
    renderProfile();
  }

  function renderProfile() {
    var d = JSON.parse(JSON.stringify(PlayerProfile.SCENARIOS.mid));
    d.name = 'Sam Kowalski';
    d.run = S.run;
    d.coins = S.coins || 0;
    var box = $('profile');
    box.innerHTML = PlayerProfile.render(d);
    // The shop lives inside Profile: its "Open shop" link opens the shop in the shell, not a separate page.
    box.querySelectorAll('a[href*="shop/shop.html"]').forEach(function (a) { a.setAttribute('href', '#profile/shop'); });
    PlayerProfile.bind(box, onPrestige);
  }

  function leaderboardData() {
    return { teams: TEAMS, players: PLAYERS };
  }

  // Sub-screens that are not tabs: Leaderboard (from Live) and Shop (from Profile).
  function renderSub(name) {
    var box = $('sub');
    box.innerHTML = '';
    if (name === 'leaderboard') {
      box.innerHTML = '<h1>Leaderboard</h1><div id="lb"></div>';
      Leaderboard.mount($('lb'), leaderboardData(), { meId: 'sam', myTeamId: 'b', sort: 'level' });
    } else if (name === 'shop') {
      // The frame has its own "Shop" heading, so the shell adds none (QA item 5).
      box.innerHTML = '<iframe class="sub-frame" src="shop/shop.html" title="Shop"></iframe>';
    }
  }

  // ---------- routing ----------
  function route() {
    if (!S.me) { showLogin(); return; }
    showShell();
    var parts = (location.hash || '#home').slice(1).split('/');
    var tab = TABS.indexOf(parts[0]) > -1 ? parts[0] : 'home';
    var sub = SUB_PARENT[tab] && parts[1] ? parts[1] : '';
    if (sub && SUBS.indexOf(sub) < 0) { location.hash = '#' + tab; return; }
    var back = $('backLink');
    back.setAttribute('href', SUB_PARENT[tab] || '#more');
    back.textContent = tab === 'profile' ? 'Back to Profile' : (tab === 'live' ? 'Back to Live' : 'Back to More');

    var viewId = sub ? 'v-sub' : 'v-' + tab;
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== viewId; });
    document.querySelectorAll('.tabs a').forEach(function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    if (tab === 'home' && S.home) S.home.update(homeData(Date.now()));
    if (tab === 'live') renderLive();
    if (tab === 'more' && S.moreScreen) S.moreScreen.update(moreData());
    if (tab === 'profile') renderProfile();
    if (sub) renderSub(sub);
    window.scrollTo(0, 0);
  }

  // ---------- log in and out ----------
  function showErr(msg) {
    var e = $('loginErr');
    e.textContent = msg;
    e.hidden = false;
  }

  // ---------- More tab (screens/more). The PIN is kept in memory for this session only, never stored. ----------
  function moreData() {
    return {
      me: S.me ? { first: S.me.first, lastInitial: S.me.lastInitial, nickname: S.nickname || '', teamPref: S.teamPref || 'any' } : null,
      bright: document.documentElement.getAttribute('data-theme') === 'light',
      alertsOn: !!S.alerts,
      tonight: { nightId: NIGHT_ID, label: 'Tonight', amount: S.night && S.night.price ? S.night.price : '', status: S.claimed ? 'claimed' : 'due' },
      history: [],
      cfg: window.PLAYER_APP_CONFIG || {},
      version: 'Shell 0.2'
    };
  }

  var moreHandlers = {
    claimPaid: function (nightId) {
      if (!S.me || !S.pin) return Promise.resolve({ ok: false, reason: 'need-pin' });
      return be.claimPaid(S.me.first, S.me.lastInitial, S.pin, nightId).then(function (r) {
        if (r && r.ok) S.claimed = true;
        if (S.moreScreen) S.moreScreen.update(moreData());
        return r;
      });
    },
    saveProfile: function (next) {
      // Memory only for now. Saving to the online database is not wired yet.
      S.nickname = next.nickname;
      S.teamPref = next.teamPref;
      return Promise.resolve({ ok: true });
    },
    setBright: function (on) { var v = on ? 'light' : 'dark'; applyTheme(v); saveTheme(v); },
    setAlerts: function (on) { S.alerts = !!on; },
    logOut: function () { logOut(); }
  };

  function startApp(player, pin) {
    S.me = { first: player.first, lastInitial: player.lastInitial, status: player.status };
    S.pin = pin;
    S.run = JSON.parse(JSON.stringify(PlayerProfile.SCENARIOS.mid.run));
    ensureShop().load();
    if (!S.home) {
      S.home = PlayerHome.mount($('home'), homeData(Date.now()), {
        card: function () { location.hash = '#profile'; },
        live: function () { location.hash = '#live'; },
        night: function () { location.hash = '#live'; },
        shop: function () { location.hash = '#profile/shop'; },
        lineup: openLineup
      });
    }
    if (!S.moreScreen) S.moreScreen = PlayerMore.mount($('more'), moreData(), moreHandlers);
    if (S.reveal) S.reveal.stop();
    if (typeof LineupReveal !== 'undefined') {
      S.reveal = LineupReveal.watch({ backend: be, nightId: NIGHT_ID, me: { first: S.me.first, lastInitial: S.me.lastInitial } });
    }
    if (!location.hash) history.replaceState(null, '', '#home');
    route();
  }

  function logIn() {
    var first = $('lFirst').value.trim();
    var li = $('lLi').value.trim();
    var pin = $('lPin').value.trim();
    $('loginErr').hidden = true;
    if (!first || !li || !pin) { showErr('Type your first name, last initial and PIN.'); return; }
    $('loginBtn').disabled = true;
    be.login(first, li, pin).then(function (r) {
      if (!r.ok) { showErr(LOGIN_MSG[r.reason] || 'Could not log in. Try again.'); return; }
      $('lPin').value = '';
      saveToken(r.token);
      startApp(r.player, pin);
    }).catch(function () {
      showErr('Could not check. Try again.');
    }).then(function () { $('loginBtn').disabled = false; });
  }

  function logOut() {
    var t = readToken();
    clearToken();
    if (t) be.logout(t).catch(function () { /* the token expires in 90 days anyway */ });
    S.me = null;
    S.pin = '';
    S.claimed = false;
    if (S.reveal) { S.reveal.stop(); S.reveal = null; }
    if (S.home) { S.home.destroy(); S.home = null; }
    if (S.moreScreen) { S.moreScreen.destroy(); S.moreScreen = null; }
    if (S.liveScreen) { S.liveScreen.destroy(); S.liveScreen = null; }
    $('lPin').value = '';
    history.replaceState(null, '', location.pathname + location.search);
    showLogin();
  }

  // ---------- mock seed (only while backend is 'mock') ----------
  function seedMock() {
    if (kind !== 'mock') return Promise.resolve();
    S.night = makeNight(Date.now(), params.get('t') === 'lineup');
    S.live = params.get('t') === 'live' ? { game: 2, teamA: 'Blue', scoreA: 14, teamB: 'Red', scoreB: 12, clock: '4:10 left' } : null;
    return be.login('Sam', 'K', '1234').then(function (r) {
      if (r.ok) return null;
      return be.signUp({ first: 'Sam', lastInitial: 'K', level: 12, under18: false }, '1234');
    }).then(function () {
      return be.publishNight(NIGHT_ID, S.night);
    });
  }

  // ---------- start: loading screen, then log in ----------
  function boot() {
    applyTheme(readTheme());
    $('loginBtn').addEventListener('click', logIn);
    $('lPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') logIn(); });
    $('lPin').addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
    window.addEventListener('hashchange', route);

    var seeded = seedMock().catch(function () { /* mock only: a failure here still lets the screens show */ });
    // Load tonight's published night (mock or online), then show the log in screen.
    var nightLoaded = seeded.then(function () {
      return be.getNight(NIGHT_ID).then(function (nt) { if (nt && nt.payload) S.night = nt.payload; }).catch(function () {});
    });
    // Resume a 90-day sign-in on this phone (token only, no PIN needed). Otherwise show log in.
    function resumeSession() {
      var t = readToken();
      if (!t) return null;
      return be.resume(t).then(function (r) {
        if (r && r.ok) { startApp(r.player, ''); return true; }
        clearToken();
        return null;
      }).catch(function () { return null; });
    }
    PlayerLoading.run({
      mapName: 'New College',
      then: function () {
        nightLoaded.then(resumeSession).then(function () {
          if (!S.me) showLogin();
        });
      }
    });
  }

  boot();
})();
