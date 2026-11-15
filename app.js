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
  var be = PlayerSignal.wrapBackend(PlayerBackend.create(kind, kind === 'mock'
    ? { store: PlayerBackend.memoryStore() }
    : { url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey }));
  var NIGHT_ID = 'tonight';
  // Pay is the first thing on Home: players cannot play without paying (pay-first module).
  // PayFirst is made on first use (its script loads with the screens, after this file runs).
  var pf = null;
  function getPf() {
    // R43/R42: one Pay path. Home's Pay button calls payNow here; the server's paid state comes back through refreshTonight.
    if (!pf && window.PayFirst) pf = PayFirst.create({ backend: be, token: readToken, nightId: NIGHT_ID,
      cfg: window.PLAYER_APP_CONFIG, storage: window.localStorage,
      // R43: code accepted, or the organiser pulled this player in (they may pay by card).
      checkedIn: function () { return !!S.checkedIn || !!(S.night && Array.isArray(S.night.pulledIn) && S.me && S.night.pulledIn.indexOf(S.me.id) > -1); },
      onChange: function () { refreshTonight(); } });
    return pf;
  }
  // Home's Pay button (auto pay on): the single Pay path, pay-first.js.
  function payFromHome() {
    var p = getPf();
    if (p) p.payNow();
  }
  var TABS = ['home', 'live', 'profile', 'more'];
  var SUBS = ['leaderboard', 'shop', 'prestige', 'stats'];
  var SUB_PARENT = { live: '#live', profile: '#profile', more: '#more' };
  var THEME_KEY = '1to1-theme';
  var $ = function (id) { return document.getElementById(id); };

  var LOGIN_MSG = {
    'wrong-details': 'No one signed up with that name. Check the spelling, or sign up first.',
    'wrong-pin': 'Wrong PIN. Try again.',
    'locked': 'Too many wrong tries. Try again later, or see the organiser.'   // R46: real minutes when the server gives them
  };

  // Mock people. Sam K is the demo player who logs in.
  var PEOPLE = {
    blue: [['Sam', 'K', 12, 'Steady Starter'], ['Ali', 'R', 9, 'Quick Hands'], ['Jo', 'M', 7, 'Ball Mover'], ['Mia', 'L', 10, 'Rim Runner'], ['Tom', 'W', 3, 'Rookie']],
    red: [['Priya', 'T', 14, 'Floor General'], ['Ben', 'C', 5, 'Corner Sniper'], ['Zoe', 'B', 8, 'Box Out'], ['Leo', 'F', 6, 'Pick and Roll'], ['Ava', 'D', 11, 'Glue Guy']]
  };

  var S = {
    pin: '',         // kept in memory for this session only (I've paid), never stored
    claimed: false,
    payErr: false,
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
    live: null,
    feed: null,          // the organiser's live row (live_state) as last read; null = nothing published
    feedOffline: false   // true when the last read failed (no signal): the Live tab keeps the last update
  };

  // ---------- helpers ----------
  function hhmm(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  // ---------- the signed-in player and tonight (real data only) ----------
  function fullName() { return S.me ? S.me.first + ' ' + S.me.lastInitial : ''; }
  function teamName(t) { return t && t.name ? String(t.name) : 'TBC'; }
  function skillText(level) { return window.PlayerRules ? PlayerRules.levelLabel(level) : ''; }
  function sameP(p) {
    return !!(S.me && p && String(p.first || '').toLowerCase() === S.me.first.toLowerCase() && String(p.lastInitial || '').toUpperCase() === S.me.lastInitial.toUpperCase());
  }
  function myTeamIn(game) {
    var list = (game && game.teams) || [];
    for (var i = 0; i < list.length; i++) { if ((list[i].players || []).some(sameP)) return list[i]; }
    return null;
  }
  function oppIn(game) {
    var mine = myTeamIn(game);
    return ((game && game.teams) || []).filter(function (t) { return t !== mine; })[0] || null;
  }
  function myTeamNow() {
    var g = nextGame(Date.now()) || ((S.night && S.night.games) || [])[0];
    return g ? myTeamIn(g) : null;
  }
  // Standings only exist once the organiser publishes them. Until then the screens show a plain note.
  function standingsOf() {
    var raw = S.night && Array.isArray(S.night.standings) ? S.night.standings : [];
    return raw.filter(function (t) { return t && t.name; }).slice().sort(function (a, b) { return (b.points || 0) - (a.points || 0); });
  }
  // next-34 (R55, Brief J): the lineup counts as published when the organiser's flag is set, or when a game
  // has two teams and this player is in one. Teams alone are enough, so no extra Publish is needed.
  function lineupPublished() {
    if (!S.night) return false;
    if (S.night.lineup && S.night.lineup.published === true) return true;
    return (S.night.games || []).some(function (g) { return (g.teams || []).length === 2 && !!myTeamIn(g); });
  }
  // next-34 privacy (R55): counts only until teams exist. A player in tonight sees first name and last initial of
  // the players in their own game (both teams). Other games, ratings and any other field never reach the phone.
  function tonightFor(payload) {
    if (!payload || !Array.isArray(payload.games)) return payload;
    var pick = function (p) { return { first: p.first || '', lastInitial: p.lastInitial || '' }; };
    var games = payload.games.map(function (g) {
      var inIt = !!myTeamIn(g);
      var teams = (g.teams || []).map(function (t) {
        return { name: t.name, players: inIt ? (t.players || []).map(pick) : [] };
      });
      return Object.assign({}, g, { teams: teams, bench: inIt ? (g.bench || []).map(pick) : [] });
    });
    return Object.assign({}, payload, { games: games });
  }
  // The XP run for the level the server holds (same curve as lib/xp.js totalForLevel). No demo numbers.
  function myRun() {
    var server = window.PlayerXpServer ? PlayerXpServer.runFromSummary(S.xpSummary) : null;
    if (server) return server;
    var L = Math.max(1, Math.min(60, Math.round(Number(S.me && S.me.xpLevel)) || 1));
    var run = PlayerXp.newRun();
    run.xp = Math.round((L - 1) * (30 + 1.5 * L));
    run.maxLevel = L;
    return run;
  }
  // Real day, date and start time, read from the game's own start (the organiser sets it from the run date and start).
  // Night labels are always London time, whatever the phone's time zone (night-time module, 15 Nov).
  function dayOf(iso) { var d = new Date(iso); return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/London' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }); }
  // A night the organiser cancelled (Cancel run sets payload.cancelled) is hidden: players see no night at all.
  function liveNight(payload) {
    if (!payload || typeof payload !== 'object') return null;
    // next-28: a night the organiser has not put live (run.status 'draft') is never shown to players.
    // 'live', or no run block (older nights), is shown as before.
    if (payload.run && payload.run.status === 'draft') return null;
    if (!payload.cancelled) return payload;
    // A cancelled night stays for its Cancelled banner until the first game starts, then drops as before (Fable R10).
    return window.PlayerNightStatus && PlayerNightStatus.payloadCancelledNow({ payloadCancelled: true, games: payload.games }, Date.now()) ? payload : null;
  }
  function isInstalled() { return !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true); }
  function installDismissed() { try { return localStorage.getItem('1to1-install-dismissed') === '1'; } catch (e) { return false; } }
  function setInstallDismissed() { try { localStorage.setItem('1to1-install-dismissed', '1'); } catch (e) { /* private window: asks again next visit */ } }

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
    var start = nightStartGame();
    if (!games.length && start && Date.parse(start.startsAt) > now - 600000) return start;
    return null;
  }
  // next-29: pay comes before teams and games exist. A live night with no games still has a start time
  // (payload date + start, or run.date + run.start). That start stands in for the first game.
  function londonIso(date, hhmm) {
    try {
      var p = String(date).split('-').map(Number), t = String(hhmm).split(':').map(Number);
      if (p.length !== 3 || t.length < 2 || p.some(isNaN) || t.some(isNaN)) return null;
      var guess = Date.UTC(p[0], p[1] - 1, p[2], t[0], t[1]);
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      var o = {};
      fmt.formatToParts(new Date(guess)).forEach(function (x) { o[x.type] = x.value; });
      var shown = Date.UTC(+o.year, +o.month - 1, +o.day, (+o.hour) % 24, +o.minute);
      return new Date(guess - (shown - guess)).toISOString();
    } catch (e) { return null; }
  }
  function nightStartGame() {
    var n = S.night || {}, r = n.run || {};
    var date = n.date || r.date, start = n.start || r.start;
    if (!date || !start) return null;
    var iso = londonIso(date, start);
    return iso ? { id: 'night-start', no: 0, startsAt: iso, teams: [], mapName: '' } : null;
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
  // next-31: the shop script loads lazily (lazy-screens.js). Until it is there, the balance reads 0 and nothing throws.
  // Nothing is cached, so the next call after the script loads gets the real backend.
  function shopNotReady() {
    return {
      load: function () {
        return new Promise(function (resolve) {
          var after = function () {
            if (window.ShopBackend) resolve(ensureShop().load());
            else resolve({ ok: true, state: { coins: 0 } });
          };
          if (window.LazyScreens && typeof window.LazyScreens.load === 'function') window.LazyScreens.load(after);
          else after();
        });
      },
      act: function () { return Promise.resolve({ ok: false, error: PlayerSignal.MESSAGE }); }
    };
  }
  function ensureShop() {
    if (shopBe) return shopBe;
    if (!window.ShopBackend) return shopNotReady();
    var real = PlayerSignal.wrapBackend(window.ShopBackend.create(kind === 'supabase'
      ? cfg
      : { backend: 'mock', level: PlayerXp.progress(S.run).level, stars: S.run.stars },
      function () { return readToken(); }));
    shopBe = {
      load: function () { return real.load().then(readCoinsFrom).catch(function () { return { ok: false, error: PlayerSignal.MESSAGE }; }); },
      act: function (id, tag) { return real.act(id, tag).then(readCoinsFrom).catch(function () { return { ok: false, error: PlayerSignal.MESSAGE }; }); }
    };
    return shopBe;
  }
  // The Shop frame asks for this same instance (same origin), so a purchase updates Home and Profile at once.
  // name() gives the Shop frame the signed-in player's own name (never the demo name).
  window.PlayerShop = {
    get: ensureShop,
    name: function () { return fullName(); }
  };
  function refreshCoins() {
    if (S.home) S.home.update(homeData(Date.now()));
    var prof = $('profile');
    if (prof && prof.childNodes.length) renderProfile();
  }

  // ---------- data for the screens ----------
  // Slots registered once (N3 recap, N5 streak). A slot that returns '' leaves no gap.
  // Home slots are registered on first start, when the Home script has loaded.
  var slotsRegistered = false;
  function registerHomeSlots() {
    if (slotsRegistered || !(window.PlayerHome && PlayerHome.register)) return;
    slotsRegistered = true;
    PlayerHome.register('streak', 30, function (d) { return d.streak && window.PlayerStreaks ? PlayerStreaks.slotHtml(d.streak) : ''; });
    var rsvpHandle = null;
    PlayerHome.register('rsvp', 20, function () { return window.PlayerRsvp && S.me ? '<div class="ph-rsvp-mount"></div>' : ''; },
      function (node) {
        if (!window.PlayerRsvp) return;
        if (rsvpHandle && rsvpHandle.destroy) rsvpHandle.destroy();
        var m = node.querySelector('.ph-rsvp-mount') || node;
        rsvpHandle = PlayerRsvp.mount(m, { api: PlayerRsvp.api(be.rpc), token: readToken(), nightId: 'tonight' });
      });
    PlayerHome.register('recap', 10, function () { var s = recapSlotNow(); return s ? s.html : ''; },
      function (el) { var s = recapSlotNow(); if (s && s.bind) s.bind(el); });
    if (window.PlayerReceipt) PlayerReceipt.register(window.PlayerHome && PlayerHome.register);
  }
  function recapSlotNow() {
    if (!window.PlayerRecap || !S.profileStats || !S.xpSummary) return null;
    var view = PlayerRecap.buildRecap({ profile: S.profileStats, summary: S.xpSummary, seenIds: PlayerRecap.readSeen(window.localStorage), now: Date.now(), top: null });
    return view ? PlayerRecap.slot(view, { storage: window.localStorage, onVote: function () {} }) : null;
  }
  function homeData(now) {
    var game = nextGame(now);
    var games = (S.night && S.night.games) || [];
    var gamesForHome = games.length ? games : (game ? [game] : []);
    var ns = { status: S.nightStatus && S.nightStatus.status, message: S.nightStatus && S.nightStatus.message,
      live: !!S.live, games: gamesForHome, spots: null, payloadCancelled: !!(S.night && S.night.cancelled) };
    var nsHide = window.PlayerNightStatus ? PlayerNightStatus.hides(ns, now) : { actions: false, pay: false };
    var nightBanner = window.PlayerNightStatus ? PlayerNightStatus.html(ns, now) : '';
    return {
      nightBanner: nightBanner,
      receipt: { dateISO: (S.night && S.night.games && S.night.games[0] ? S.night.games[0].startsAt : (S.night && S.night.startsAt)) || '', ref: S.paidRef || '' },
      // Empty states for Home (r8). spots stays null until the organiser count is on the player side.
      night: { status: ns.status, message: ns.message, payloadCancelled: ns.payloadCancelled, games: ns.games, spots: null },
      player: { name: fullName(), banner: '', nameStyle: '', clanTag: '', skill: skillText(S.me && S.me.level), games: 0, wins: 0 },
      run: S.run,
      coins: S.coins || 0,
      next: nsHide.actions ? null : (game ? { gameNo: game.no, vs: teamName(oppIn(game)), dayLabel: game.startsAt ? dayOf(game.startsAt) : '', startsAt: game.startsAt } : null),
      nextRunLabel: (S.night && S.night.nextRun) || '',
      schedule: games.map(function (g) {
        var state = game && g.id === game.id ? 'next' : 'todo';
        return { no: g.no, time: hhmm(g.startsAt), vs: teamName(oppIn(g)), state: state };
      }),
      lastNight: null,
      live: S.live,
      streak: S.streak || null,
      tonight: {
        rsvp: (S.rsvp && S.rsvp.ok && S.rsvp.me) ? S.rsvp.me : 'none',   // I'm in (N2), from player_rsvp_list
        rsvpUnknown: !!(S.rsvp && !S.rsvp.ok), // next-22: a failed RSVP read must not block Pay
        lineupReady: lineupPublished(),   // next-34 (R55): the organiser's flag (payload.lineup.published), or teams with this player in one
        checkedIn: !!S.checkedIn,
        ended: !!S.runEnded,
        payMsg: (pf && pf._state) ? pf._state().err : '',   // pay-first's plain message (code first, link failed, etc.)
        runClosed: !!S.runClosed || !!(S.night && (S.night.runClosed === true || S.night.codeClosed === true || S.night.status === 'closed')),   // R43: the real closed state (server "run-closed" or night flag)
        pulledIn: !!(S.me && S.night && Array.isArray(S.night.pulledIn) && S.night.pulledIn.indexOf(S.me.id) > -1),   // provisional contract: payload.pulledIn = [signup ids]
        runOn: !!S.runOn,   // next-36: server says a run is open now
        // next-36: no headcount or paid count is passed to the phone's screens (players see only their own status)
        count: null,
        needed: null,
        paidCount: null,
        paid: !!S.paidNow,
        pass: !!S.passNow,   // R59
        claimed: !!S.claimed,
        amount: payData().amount,
        payLink: payData().link,
        error: !!S.payErr
      },
      updatedAt: null
    };
  }

  // The one Pay line (Home). A claim is only "I've paid" for the organiser to check on Square.
  // next-35: the price always shows with £ (the night payload stores it as a plain number).
  function moneyText(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s || /^£/.test(s)) return s;
    return /^\d+(\.\d+)?$/.test(s) ? '£' + s : s;
  }
  function payData() {
    var cfg = window.PLAYER_APP_CONFIG || {};
    return {
      amount: moneyText(S.night && S.night.price),
      status: S.claimed ? 'claimed' : 'due',
      link: cfg.payAuto === true ? '' : (cfg.squarePayLink || ''), // next-30: auto pay asks the server for the link on tap
      error: !!S.payErr
    };
  }
  // next-31 (R39): Home's Pay button with auto pay opens the same Pay box as More > Pay, in a sheet on Home.
  function openPaySheet() {
    if (!window.PlayerPay || !be) return;
    var wrap = document.getElementById('pay-sheet');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'pay-sheet';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;';
      var card = document.createElement('div');
      card.style.cssText = 'width:100%;max-height:90vh;overflow:auto;background:var(--bg,#0E0E0E);padding:16px 16px 24px;border-radius:16px 16px 0 0;box-sizing:border-box;';
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'btn';
      close.textContent = 'Close';
      close.style.marginBottom = '12px';
      close.addEventListener('click', function () { wrap.hidden = true; refreshTonight(); });
      var box = document.createElement('div');
      box.id = 'pay-sheet-box';
      card.appendChild(close);
      card.appendChild(box);
      wrap.appendChild(card);
      document.body.appendChild(wrap);
    }
    wrap.hidden = false;
    var target = document.getElementById('pay-sheet-box');
    target.innerHTML = '';
    PlayerPay.render(target, { cfg: window.PLAYER_APP_CONFIG || {}, backend: be, nightId: NIGHT_ID, night: S.night, token: readToken, onPaid: refreshTonight });
  }
  // next-31: Home's "I'm in" button uses the I'm in card's own button (same save, same rules).
  function openImIn() {
    var b = document.querySelector('#home .ph-rsvp-mount [data-rsvp="in"]');
    if (b) { b.click(); b.scrollIntoView({ block: 'center' }); }
  }
  function claimFromHome() {
    S.payErr = false;
    moreHandlers.claimPaid(NIGHT_ID).then(function (r) {
      S.payErr = !(r && r.ok);
      if (S.home) S.home.update(homeData(Date.now()));
    });
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
    var feed = S.feed ? PlayerLiveFeed.fromFeed(S.feed) : null;
    var liveNo = feed && feed.now ? feed.now.game : null;
    var game = nextGame(Date.now());
    var soon = game && (Date.parse(game.startsAt) - Date.now()) <= 60000 ? game : null;
    var lineup = null;
    // next-34 privacy: the live lineup names players only for a game this player is in.
    if (soon && myTeamIn(soon)) {
      var mine = myTeamIn(soon), theirs = oppIn(soon);
      var pl = function (t) {
        return (t ? t.players : []).map(function (p) {
          return { id: p.first + p.lastInitial, name: p.first + ' ' + p.lastInitial, level: p.level, stars: 0, banner: '', clanTag: '', captain: false };
        });
      };
      lineup = { game: soon.no, teamA: teamName(mine), teamB: teamName(theirs), players: {} };
      lineup.players[teamName(mine)] = pl(mine);
      lineup.players[teamName(theirs)] = pl(theirs);
    }
    return {
      me: { team: teamName(myTeamNow()) },
      now: feed && feed.now ? feed.now : S.live,
      nextUp: game ? { team: teamName(oppIn(game)) } : null,
      lineup: lineup,
      upcoming: games.map(function (g) {
        var st = liveNo != null && Number(g.no) === Number(liveNo) ? 'live' : (game && g.id === game.id ? 'next' : 'todo');
        return { no: g.no, time: hhmm(g.startsAt), vs: teamName(oppIn(g)), state: st };
      }),
      updatedAt: feed ? feed.updatedAt : null,
      state: feed ? feed.state : 'none',
      recap: feed ? feed.recap : null,
      offline: S.feedOffline,
      nextRun: feed ? feed.nextRun : null
    };
  }

  // next-34: the standings block is hidden when there are no standings, so no empty table shows.
  function renderStandings() {
    var ul = $('standings');
    ul.innerHTML = '';
    var st = standingsOf();
    st.forEach(function (t, i) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = (i + 1) + '. ' + t.name;
      var b = document.createElement('span'); b.className = 'muted'; b.textContent = (t.points || 0) + ' pts';
      li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
    $('standNote').textContent = st.length ? 'Standings after tonight’s games.' : 'Standings show here after the first game.';
    $('standBlock').hidden = st.length === 0;
  }
  function renderLive() {
    if (!S.liveScreen) S.liveScreen = PlayerLive.mount($('live'), liveData(), { onReveal: openLineup });
    else S.liveScreen.update(liveData());
    renderStandings();
    loadMvp();
  }

  // Live score: one read every 10 seconds while the app is open and visible. A failed read (no signal)
  // keeps the last update on screen and shows a note. Reads only; nothing is written from the phone.
  var LIVE_ON_MS = 5000, LIVE_IDLE_MS = 30000, LIVE_OFFLINE_MS = 10000, LIVE_WAIT_MS = 8000;
  var liveBusy = false, liveTimer = null, liveOn = false;
  // Next read time: fast while a game is on court, slow otherwise, a retry soon after no signal (v2, 15 Nov).
  function nextLiveDelay() {
    if (S.feedOffline) return LIVE_OFFLINE_MS;
    var f = S.feed ? PlayerLiveFeed.fromFeed(S.feed) : null;
    return f && f.live ? LIVE_ON_MS : LIVE_IDLE_MS;
  }
  function scheduleLivePoll() {
    if (!liveOn) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { pollLive().then(scheduleLivePoll); }, nextLiveDelay());
  }
  function pollLive() {
    if (liveBusy || !S.me) return Promise.resolve();
    if (document.hidden) return Promise.resolve();
    liveBusy = true;
    var wait = null;
    var timeout = new Promise(function (_, reject) { wait = setTimeout(function () { reject(new Error('timeout')); }, LIVE_WAIT_MS); });
    var read = navigator.onLine === false ? Promise.reject(new Error('offline')) : be.getLive();
    return Promise.race([read, timeout]).then(function (row) {
      clearTimeout(wait);
      S.feed = row && row.payload ? row.payload : null;
      S.feedOffline = false;
    }, function () {
      clearTimeout(wait);
      S.feedOffline = true;
    }).then(function () {
      liveBusy = false;
      if (S.liveScreen) S.liveScreen.update(liveData());
    });
  }
  // next-34: the night is read again every 30 s while the app is open, and at once when the phone comes back to it.
  var nightTimer = null;
  function refreshNight() {
    if (!S.me || !be.getNight) return Promise.resolve();
    return be.getNight(NIGHT_ID).then(function (nt) {
      if (nt && nt.payload) applyNight(nt.payload, nt);
    }).catch(function () { /* no signal: keep the last night on screen */ });
  }
  function startNightRefresh() {
    if (nightTimer) return;
    nightTimer = setInterval(function () { if (!document.hidden) refreshNight(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshNight(); });
  }
  function stopNightRefresh() {
    if (nightTimer) clearInterval(nightTimer);
    nightTimer = null;
  }
  function startLivePoll() {
    if (liveOn) return;
    liveOn = true;
    document.addEventListener('visibilitychange', function () { if (!document.hidden) pollLive().then(scheduleLivePoll); });
    window.addEventListener('online', function () { pollLive().then(scheduleLivePoll); });
    pollLive().then(scheduleLivePoll);
  }
  function stopLivePoll() {
    liveOn = false;
    clearTimeout(liveTimer);
    liveTimer = null;
    S.feed = null;
    S.feedOffline = false;
  }


  // Streak view (N5). A failed read leaves no streak card.
  function loadStreak() {
    if (!window.PlayerStreaks || !be.streakSummary) return;
    be.streakSummary(readToken(), 0).then(function (st) {
      S.streak = st && st.ok ? PlayerStreaks.summarize({ streakRun: st.streakWeeks, lastWeek: st.lastWeek, nightsTotal: st.nightsTotal, nextWeek: st.nextWeek }) : null;
      if (S.home) S.home.update(homeData(Date.now()));
    }).catch(function () { /* no signal: keep the last view */ });
  }
  // Server copy of XP, level and stars (player_xp_summary). Mock backend has none, so the local run stays.
  function loadXp() {
    return be.xpSummary(readToken()).then(function (r) {
      S.xpSummary = r && r.ok ? r : null;
      S.run = myRun();
      if (S.home) S.home.update(homeData(Date.now()));
      loadStreak();
      var prof = $('profile');
      if (prof && prof.childNodes.length) renderProfile();
    }).catch(function () { /* no signal: keep the last numbers */ });
  }
  // MVP and profile stats use the same backend switch as the shop: real RPCs on Supabase, one-device mock otherwise.
  function mvpBackend() {
    if (!window.PlayerMvpBackend) return null;
    return kind === 'supabase'
      ? PlayerMvpBackend.makeSupabase(be.rpc)
      : PlayerMvpBackend.makeMock(window.localStorage, { me: S.me, players: [] });
  }
  // The MVP card sits under Live once the night has games. One vote each; the server keeps the vote private.
  function loadMvp() {
    var box = $('mvpBox');
    if (!box) return;
    var mb = mvpBackend();
    var played = S.night && S.night.games && S.night.games.length;
    if (!mb || !played || !S.me) { box.innerHTML = ''; return; }
    var t = readToken();
    Promise.all([mb.eligible(t, NIGHT_ID), mb.myVote(t, NIGHT_ID)]).then(function (r) {
      var el = r[0] || {}, mine = r[1] || {};
      if (!el.ok) { box.innerHTML = ''; return; }
      var data = { night: { id: NIGHT_ID, confirmed: !!el.closed, winnerId: null }, me: el.me || S.me,
                   players: el.players || [], myVote: mine.vote || null };
      box.innerHTML = PlayerMvp.render(data);
      PlayerMvp.bind(box, data, function (id) {
        mb.vote(t, NIGHT_ID, id).then(function (res) {
          if (res && res.ok) { loadMvp(); return; }
          var msg = box.querySelector('[data-mvp-msg]');
          if (msg) msg.textContent = PlayerMvp.REASON_TEXT[res && res.reason] || 'Could not save your vote. Try again.';
        });
      });
    });
  }
  // Profile numbers from the server (player_profile). Stays empty on the mock backend.
  function loadProfileStats() {
    var mb = mvpBackend();
    if (!mb || !S.me) return;
    mb.profile(readToken()).then(function (r) {
      if (r && r.ok) { S.profileStats = r; renderProfile(); if (S.home) S.home.update(homeData(Date.now())); }
    });
    // Head to head (N12): the game log block on Profile. A failed call adds nothing.
    be.playerGameLog(readToken()).then(function (r) {
      S.gameLog = r && r.ok === true ? r : null;
      renderProfile();
    }).catch(function () {});
  }
  function onPrestige() { location.hash = '#profile/prestige'; }
  // Full-screen moment, only after the server says yes (never from the phone's own result). Once per star.
  function celebratePrestige(res) {
    if (!window.PlayerCelebrate || !res || !res.ok || res.repeat) return;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    PlayerCelebrate.maybePlay({ stars: res.stars, reduce: reduce, onDone: function () { renderProfile(); } });
  }

  function profileExtrasHtml() {
    var links = '<p class="profile-links"><a class="btn" href="#profile/stats">Stats</a> <button type="button" class="btn" id="shareCard">Share my card</button></p>';
    var streak = window.PlayerStreaks && S.streak ? PlayerStreaks.badgesHtml(S.streak) : '';
    return links + streak + '<div id="ach-grid"></div><div id="invite-card"></div>';
  }
  function shareProfile() {
    if (!window.ShareCard) return;
    var t = S.profileStats ? S.profileStats.totals : {};
    var st = S.streak || {};
    ShareCard.share({ mode: 'career', name: fullName(), level: (S.me && S.me.xpLevel) || 1, stars: (S.xpSummary && S.xpSummary.stars) || 0,
      banner: '', nameStyle: '', clanTag: '',
      numbers: [{ label: 'NIGHTS', value: String(t.nights || 0) }, { label: 'WINS', value: String(t.wins || 0) },
        { label: 'STREAK', value: String(typeof st.weeks === 'number' ? st.weeks : 0) }, { label: 'XP', value: String((S.run && S.run.xp) || 0) }] }).catch(function () {});
  }
  function renderProfile() {
    var d = JSON.parse(JSON.stringify(PlayerProfile.SCENARIOS['new']));
    d.name = fullName();
    d.skill = Math.max(1, Math.min(30, Math.round(Number(S.me && S.me.level)) || 1));
    d.run = myRun();
    d.coins = S.coins || 0;
    d.clanTag = '';
    d.equipped = {};
    d.totals = S.profileStats ? S.profileStats.totals : { points: 0, wins: 0, games: 0, nights: 0 };
    var box = $('profile');
    box.innerHTML = PlayerProfile.render(d) + (S.profileStats ? PlayerProfileStats.render(S.profileStats) : '') + profileExtrasHtml();
    if (S.gameLog && window.PlayerHeadToHead) {
      var logBlock = PlayerHeadToHead.buildLog(S.gameLog);
      if (logBlock.html) box.insertAdjacentHTML('beforeend', logBlock.html);
    }
    // The shop lives inside Profile: its "Open shop" link opens the shop in the shell, not a separate page.
    box.querySelectorAll('a[href*="shop/shop.html"]').forEach(function (a) { a.setAttribute('href', '#profile/shop'); });
    var shareBtn = $('shareCard'); if (shareBtn) shareBtn.addEventListener('click', shareProfile);
    loadAchievements();
    loadInvite();
    PlayerProfile.bind(box, onPrestige);
  }

  function leaderboardData() {
    return {
      teams: standingsOf().map(function (t) { return { id: t.name, name: t.name, played: t.played || 0, wins: t.wins || 0, points: t.points || 0 }; }),
      players: []
    };
  }

  function sEsc(v) { return window.PlayerName ? PlayerName.esc(v == null ? '' : String(v)) : String(v == null ? '' : v); }
  // Season board rows from player_leaderboard. A failed read keeps a message and a retry button.
  function loadSeasonBoard(st) {
    var el = $('lbSeason');
    if (!el || !window.PlayerSeasons) return;
    el.innerHTML = '<p class="muted">Loading the board…</p>';
    be.playerLeaderboard(readToken(), st.board, 50, st.season).then(function (res) {
      if (!res || res.ok === false) {
        el.innerHTML = '<p class="muted" role="alert">Could not load this board. <button type="button" class="btn" data-retry>Try again</button></p>';
        var rb = el.querySelector('[data-retry]');
        if (rb) rb.addEventListener('click', function () { loadSeasonBoard(st); });
        return;
      }
      var rows = Array.isArray(res.rows) ? res.rows : [];
      var inView = rows.some(function (r) { return r && r.me; });
      el.innerHTML = (rows.length ? '<ol class="sl-rows">' + rows.map(function (r) {
        return '<li class="sl-row"><span class="sl-rank">' + sEsc(r.rank) + '</span><span class="sl-name">' + sEsc(r.name) +
          (r.level != null ? ' <span class="sl-lvl">L' + sEsc(r.level) + '</span>' : '') + '</span><span class="sl-val">' + sEsc(r.value) + '</span></li>';
      }).join('') + '</ol>' : '<p class="muted">No results on this board yet.</p>') +
        PlayerSeasons.pinnedHtml(res.me, st.board, { inView: inView });
    }).catch(function () {
      el.innerHTML = '<p class="muted" role="alert">No signal. Could not load this board. <button type="button" class="btn" data-retry>Try again</button></p>';
      var rb = el.querySelector('[data-retry]');
      if (rb) rb.addEventListener('click', function () { loadSeasonBoard(st); });
    });
  }

  // Bring a friend (N13): the player's own link and counts. Names are never returned.
  function loadInvite() {
    var el = $('invite-card');
    if (!el || !window.PlayerInvite || !S.me) return;
    var base = location.href.split('?')[0].split('#')[0];
    var card = PlayerInvite.mount(el, { base: base, state: 'loading' }, {});
    be.inviteInfo(readToken()).then(function (r) {
      if (!r || r.ok === false) { card.update({ state: 'error' }); return; }
      card.update({ state: 'ready', code: r.code, joined: r.joined, rewarded: r.rewarded, coins: r.coins, badge: r.badge });
    }).catch(function () { card.update({ state: 'error' }); });
  }

  // Achievements (N8): the badges the server works out for this player. Shown on Profile.
  function loadAchievements() {
    if (!window.PlayerAchievements || !S.me) return;
    be.rpc('player_achievements', { p_token: readToken() }).then(function (res) {
      var el = $('ach-grid');
      if (!el || !res || res.ok === false) return;
      PlayerAchievements.render(el, PlayerAchievements.merge(res.badges));
    }).catch(function () { /* no signal: keep what is shown */ });
  }

  // Sub-screens that are not tabs: Leaderboard (from Live) and Shop (from Profile).
  function renderSub(name) {
    var box = $('sub');
    box.innerHTML = '';
    if (name === 'prestige') {
      box.innerHTML = PlayerPrestige.render({ name: fullName(), run: S.run });
      PlayerPrestige.bind(box, { rpc: be.rpc, token: readToken(), onDone: function (res) { loadXp(); ensureShop().load(); celebratePrestige(res); } });
      return;
    }
    if (name === 'stats') {
      box.innerHTML = '<div id="sb"></div>';
      PlayerStatsBoard.mount($('sb'), { rpc: be.rpc, token: readToken(), tab: 'mine' });
      return;
    }
    if (name === 'leaderboard') {
      // Seasons (N6): This season, Last season, All time, and the board (XP, wins, points). Kept in memory only.
      var lbSt = S.lbState || (window.PlayerSeasons ? PlayerSeasons.normalise('current', 'xp') : { season: 'current', board: 'xp' });
      S.lbState = lbSt;
      box.innerHTML = '<h1>Leaderboard</h1>' + (window.PlayerSeasons ? PlayerSeasons.toolbarHtml(lbSt) : '') +
        '<div id="lbSeason" aria-live="polite"></div>' + (standingsOf().length ? '<div id="lb"></div>' : '');
      if (standingsOf().length) {
        var mt = myTeamNow();
        Leaderboard.mount($('lb'), leaderboardData(), { meId: S.me ? S.me.id : null, myTeamId: mt ? teamName(mt) : null, sort: 'level' });
      }
      box.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('[data-season],[data-board]') : null;
        if (!chip || !box.contains(chip)) return;
        S.lbState = PlayerSeasons.normalise(chip.getAttribute('data-season') || S.lbState.season, chip.getAttribute('data-board') || S.lbState.board);
        renderSub('leaderboard');
      });
      loadSeasonBoard(lbSt);
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
    if (tab === 'live') { renderLive(); pollLive(); }
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
      skillDone: S.skillDone === true,
      tonight: { nightId: NIGHT_ID, label: 'Tonight', amount: S.night && S.night.price ? S.night.price : '', status: S.claimed ? 'claimed' : 'due',
        startsAt: S.night && S.night.games && S.night.games[0] ? S.night.games[0].startsAt : '' },
      history: [],
      cfg: window.PLAYER_APP_CONFIG || {},
      version: '0.2'
    };
  }

  // Push reminders (N11). Built once; nothing is asked until a switch in More is turned on.
  function urlBase64ToUint8Array(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function readyReg() { return navigator.serviceWorker.ready; }
  var pushController = null;
  function makePushController() { return window.PlayerPush ? PlayerPush.create({
    env: {
      pushSupported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
      isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
      isStandalone: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true
    },
    permission: function () { return Notification.permission; },
    requestPermission: function () { return Notification.requestPermission(); },
    getSubscription: function () {
      return readyReg().then(function (r) { return r.pushManager.getSubscription(); })
        .then(function (s) { return s ? s.toJSON() : null; });
    },
    subscribe: function () {
      var key = (window.PLAYER_APP_CONFIG || {}).VAPID_PUBLIC_KEY || '';
      return readyReg().then(function (r) {
        return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      }).then(function (s) { return s.toJSON(); });
    },
    save: function (sub, kinds) { return be.pushSave(readToken(), sub, kinds); },
    remove: function (endpoint) { return be.pushRemove(readToken(), endpoint); }
  }) : null; }

  var moreHandlers = {
    get pushController() { return pushController; },
    claimPaid: function (nightId) {
      // The sign-in token (not the PIN) is what the server checks. It is read from this phone, as on sign-in.
      if (!S.me) return Promise.resolve({ ok: false, reason: 'signed-out' });
      return be.claimPaid(readToken(), nightId).then(function (r) {
        if (r && r.ok) {
          S.claimed = true;
          if (window.PlayerPay) PlayerPay.markSent(PlayerPay.sentKey({ nightId: NIGHT_ID, night: S.night }));
        }
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
    // Skill questions: asked once. The sign-in token is what the server checks.
    saveSkill: function (answers) {
      if (!S.me) return Promise.resolve({ ok: false, reason: 'signed-out' });
      return be.skillAnswer(readToken(), answers).then(function (r) {
        if (r && (r.ok || r.reason === 'already-done')) S.skillDone = true;
        if (S.moreScreen) S.moreScreen.update(moreData());
        return r;
      });
    },
    logOut: function () { logOut(); }
  };

  // Keeps tonight in step with the server while the app is open: a cancel hides the night, a new game shows at once.
  function applyNight(payload, row) {
    window.__pwaNight = payload || null; // next-23: pwa.js reads this to hold updates during a run
    S.nightRaw = liveNight(payload);     // next-34: kept whole, so the night can be cut again once the player is known
    var next = tonightFor(S.nightRaw);
    var ns = window.PlayerNightStatus ? PlayerNightStatus.fromRow(row) : null;
    var nsChanged = JSON.stringify(ns) !== JSON.stringify(S.nightStatus);
    S.nightStatus = ns;
    // A claim sent earlier for this night (remembered on this phone) keeps "Sent" after a reload.
    if (next && window.PlayerPay && PlayerPay.wasSent(PlayerPay.sentKey({ nightId: NIGHT_ID, night: next }))) S.claimed = true;
    if (JSON.stringify(next) === JSON.stringify(S.night) && !nsChanged) return;
    S.night = next;
    if (S.home) S.home.update(homeData(Date.now()));
    if (S.liveScreen) S.liveScreen.update(liveData());
    renderStandings();
  }
  // The lineup reveal reads tonight through this wrapper, so a cancelled night never opens a reveal.
  function nightWatchBackend() {
    return {
      getNight: function (id) {
        return be.getNight(id).then(function (nt) {
          applyNight(nt && nt.payload, nt);
          var p = nt && nt.payload;
          var cancelled = !p || !!p.cancelled || (nt && nt.status === 'cancelled');
          return (liveNight(p) && !cancelled) ? Object.assign({}, nt, { payload: tonightFor(p) }) : null;
        });
      }
    };
  }

  // "I'm here" (R18, D3). Home owns the code sheet. These helpers send the code and keep a #in/1234 or ?code= link on the phone.
  // Server reasons (migration-25 player_check_in): signin, no-code, closed, too-early, locked, wrong-code.
  var CHECKIN_ERR = { 'wrong-code': 'wrong-code', 'too-early': 'no-session', 'no-code': 'no-session', 'no-session': 'no-session', 'closed': 'run-closed', 'run-closed': 'run-closed', 'locked': 'locked', 'too-many-tries': 'locked', 'signin': 'signin' };
  // Real state for Home's "I'm in", "Pay" and "See my lineup" rows (mock mode answers 'none' and no payment).
  function refreshTonight() {
    var tok = readToken();
    if (!tok) return Promise.resolve();
    var rs = window.PlayerRsvp ? PlayerRsvp.api(be.rpc).list(tok, NIGHT_ID) : Promise.resolve({ ok: false });
    var ps = be.paymentStatus ? be.paymentStatus(tok, NIGHT_ID) : Promise.resolve({ ok: false });
    return Promise.all([rs.catch(function () { return { ok: false }; }), ps.catch(function () { return { ok: false }; })]).then(function (r) {
      S.rsvp = r[0];
      S.paidNow = !!(r[1] && r[1].ok && r[1].paid);
      S.passNow = !!(r[1] && r[1].ok && r[1].pass);   // R59: pass holder: no Pay step, ever
      S.paidRef = (r[1] && r[1].ref) || '';
      if (S.home) S.home.update(homeData(Date.now()));
    });
  }
  function checkInFromHome(code) {
    return be.checkIn(readToken(), code).then(function (r) {
      if (r && r.reason === 'closed' || r && r.reason === 'run-closed') S.runClosed = true;   // R43: Pay hides once the session has ended
      if (r && r.ok === true) { S.checkedIn = true; return { ok: true }; }
      return { ok: false, error: CHECKIN_ERR[r && r.reason] || (r && r.reason === 'error' ? 'no-signal' : 'busy') };
    }, function () { return { ok: false, error: 'no-signal' }; });
  }
  function readRunCodeFromLink() {
    var fromHash = /^#in\/(\d{4})$/.exec(location.hash || '');
    var code = fromHash ? fromHash[1] : (window.PlayerCheckIn ? PlayerCheckIn.codeFromSearch(location.search) : '');
    if (code && window.PlayerSignup3Box) PlayerSignup3Box.stashRunCode(window.localStorage, code);
  }

  // Sign-in state is set at once (boot checks it); the screen scripts load first, then the rest of the start runs.
  // next-33 (R52): the server is the truth. When tonight's run has ended or been cancelled, the phone forgets the join, the payment and the claim.
  var runWatchOn = false;
  function wipeTonight() {
    S.checkedIn = false; S.claimed = false; S.paidNow = false; S.payErr = false; S.runEnded = true;
    try { if (window.PlayerPay && S.night) localStorage.removeItem(PlayerPay.sentKey({ nightId: NIGHT_ID, night: S.night })); } catch (e) { /* nothing stored */ }
    if (S.home) S.home.update(homeData(Date.now()));
  }
  function checkRunEnded() {
    var tok = readToken();
    if (!tok || !S.me || !be.runStatus) return Promise.resolve();
    return be.runStatus(tok, NIGHT_ID).then(function (r) {
      if (!r || !r.ok) return;
      if (r.state === 'ended' || r.state === 'cancelled') { S.runOn = false; wipeTonight(); }
      else if (r.state === 'open') { S.runEnded = false; S.runOn = true; }
      else S.runOn = false;   // next-36: no open run right now
    }).catch(function () { /* no signal: keep the last state */ });
  }

  function startApp(player, pin) {
    S.me = { id: player.id, first: player.first, lastInitial: player.lastInitial, status: player.status, level: player.level, xpLevel: player.xpLevel };
    S.pin = pin;
    if (player.checkedIn) S.checkedIn = true;   // next-31: server says this player is already checked in tonight
    checkRunEnded();
    if (!runWatchOn) {
      runWatchOn = true;
      setInterval(checkRunEnded, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) checkRunEnded(); });
    }
    // next-31: the kept QR code is tried at start, before the lazy screens load (it needs no screen code).
    if (window.PlayerSignup3Box) {
      var pendingCode = PlayerSignup3Box.pendingRunCode(window.localStorage);
      if (pendingCode) checkInFromHome(pendingCode).then(function (r) {
        if (!r || !r.ok) return;
        PlayerSignup3Box.clearRunCode(window.localStorage);
        if (S.home && S.home.markHere) S.home.markHere();
      });
    }
    if (!window.LazyScreens) return startAppNow(player, pin);
    LazyScreens.load(function () { startAppNow(player, pin); });
  }
  function startAppNow(player, pin) {
    S.me = { id: player.id, first: player.first, lastInitial: player.lastInitial, status: player.status, level: player.level, xpLevel: player.xpLevel };
    S.pin = pin;
    if (S.nightRaw) S.night = tonightFor(S.nightRaw);   // next-34: cut the night to this player now the player is known
    pushController = makePushController();
    wireMyAccount();
    registerHomeSlots();
    PlayerSignal.saveMe(S.me);
    if (S.savedAt && $('signalAge')) S.ageStop = PlayerSignal.ui.age($('signalAge'), S.savedAt);
    // H7: a run code kept from a link is tried once per start; it is cleared only on success.
    // Does this phone still owe the skill questions? Drives the yellow warning under Settings.
    be.skillStatus(readToken()).then(function (r) {
      S.skillDone = !!(r && r.ok && r.done);
      if (S.moreScreen) S.moreScreen.update(moreData());
    }).catch(function () { /* stays owed; the warning shows until the next start */ });
    S.run = myRun();
    loadXp();
    loadProfileStats();
    var inst = $('homeInstall');
    if (inst) inst.hidden = isInstalled() || installDismissed();
    ensureShop().load().catch(function () {});
    refreshTonight();
    // R27: the separate tonight-count strip is folded into the Next night card (count line), so it is not mounted on Home.
    if (!S.home) {
      S.home = PlayerHome.mount($('home'), homeData(Date.now()), {
        card: function () { location.hash = '#profile'; },
        live: function () { location.hash = '#live'; },
        night: function () { location.hash = '#live'; },
        shop: function () { location.hash = '#profile/shop'; },
        lineup: openLineup,
        paid: claimFromHome,
        pay: (window.PLAYER_APP_CONFIG || {}).payAuto === true ? payFromHome : null,   // plain Square link stays a link (R43: one Pay path)
        imIn: openImIn,
        checkIn: checkInFromHome
      });
      getPf() && getPf().bind($('home'));
    }
    if (getPf()) getPf().start();
    if (!S.moreScreen && window.PlayerMore) S.moreScreen = PlayerMore.mount($('more'), moreData(), moreHandlers);
    startLivePoll();
    startNightRefresh();
    if (S.reveal) S.reveal.stop();
    if (typeof LineupReveal !== 'undefined') {
      S.reveal = LineupReveal.watch({ backend: nightWatchBackend(), nightId: NIGHT_ID, me: { first: S.me.first, lastInitial: S.me.lastInitial } });
    }
    if (window.PlayerOnboarding && PlayerOnboarding.shouldShow(localStorage)) {
      PlayerOnboarding.open(document.body, { ua: navigator.userAgent, standalone: isInstalled(), storage: localStorage, onDone: function () {} });
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
      if (!r.ok) {
        // R46: a lock shows the real wait when the server gives the time (r.until).
        var lockMins = r.reason === 'locked' && r.until ? Math.ceil((Date.parse(r.until) - Date.now()) / 60000) : 0;
        if (r.reason === 'locked' && lockMins > 0) { showErr('Too many wrong tries. Try again in ' + lockMins + ' minute' + (lockMins === 1 ? '' : 's') + ', or see the organiser.'); return; }
        showErr(LOGIN_MSG[r.reason] || 'Could not log in. Try again.');
        return;
      }
      $('lPin').value = '';
      saveToken(r.token);
      if (window.PlayerOnboarding) PlayerOnboarding.markDone(localStorage);
      startApp(r.player, pin);
    }).catch(function () {
      $('loginErr').hidden = true;
      PlayerSignal.ui.panel($('loginSig'), logIn).show();
    }).then(function () { $('loginBtn').disabled = false; });
  }

  function logOut() {
    stopLivePoll();
    var t = readToken();
    clearToken();
    if (t) be.logout(t).catch(function () { /* the token expires in 90 days anyway */ });
    if (S.tonightCount && S.tonightCount.destroy) { S.tonightCount.destroy(); S.tonightCount = null; }
    PlayerSignal.clearRun();
    PlayerSignal.clearMe();
    if (S.ageStop) { S.ageStop(); S.ageStop = null; }
    S.me = null;
    S.pin = '';
    S.claimed = false;
    if (S.reveal) { S.reveal.stop(); S.reveal = null; }
    if (S.home) { S.home.destroy(); S.home = null; }
    if (S.moreScreen) { S.moreScreen.destroy(); S.moreScreen = null; }
    if (S.liveScreen) { S.liveScreen.destroy(); S.liveScreen = null; }
    stopLivePoll();
    stopNightRefresh();
    S.nightRaw = null;
    $('lPin').value = '';
    history.replaceState(null, '', location.pathname + location.search);
    showLogin();
  }

  // ---------- mock seed (only while backend is 'mock') ----------
  function seedMock() {
    if (kind !== 'mock') return Promise.resolve();
    S.night = makeNight(Date.now(), params.get('t') === 'lineup');
    if (params.get('t') === 'cancelled') S.night.cancelled = true;   // test link: a cancelled night (hidden)
    S.live = params.get('t') === 'live' ? { game: 2, teamA: 'Blue', scoreA: 14, teamB: 'Red', scoreB: 12, clock: '4:10 left' } : null;
    return be.login('Sam', 'K', '1234').then(function (r) {
      if (r.ok) return null;
      return be.signUp({ first: 'Sam', lastInitial: 'K', level: 12, under18: false }, '1234');
    }).then(function () {
      return be.mockSeedNight(NIGHT_ID, S.night);
    });
  }

  // ---------- start: loading screen, then log in ----------
  function boot() {
    readRunCodeFromLink();
    applyTheme(readTheme());
    $('loginBtn').addEventListener('click', logIn);
    $('homeInstallNo').addEventListener('click', function () { $('homeInstall').hidden = true; setInstallDismissed(); });
    $('lPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') logIn(); });
    $('lPin').addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
    window.addEventListener('hashchange', route);

    var seeded = seedMock().catch(function () { /* mock only: a failure here still lets the screens show */ });
    // Load tonight's published night (mock or online), then show the log in screen.
    var nightLoaded = seeded.then(function () {
      return be.getNight(NIGHT_ID).then(function (nt) {
        if (nt && nt.payload) { applyNight(nt.payload, nt); PlayerSignal.saveRun(nt.payload); }
      }).catch(function () {
        var saved = PlayerSignal.loadRun();
        if (saved) { S.night = saved.payload; S.savedAt = saved.savedAt; }
      });
    });
    // Resume a 90-day sign-in on this phone (token only, no PIN needed). Otherwise show log in.
    function resumeSession() {
      var t = readToken();
      if (!t) return null;
      return be.resume(t).then(function (r) {
        if (r && r.ok) { startApp(r.player, ''); return true; }
        clearToken();
        return null;
      }).catch(function (e) {
        var me = PlayerSignal.loadMe();
        if (PlayerSignal.isSignalError(e) && me && PlayerSignal.loadRun()) { startApp(me, ''); return true; }
        return null;
      });
    }
    PlayerLoading.run({
      mapName: 'New College',
      then: function () {
        // next-23: night read and resume share one 6 s budget. Login shows at the end of it;
        // a resume that finishes later still starts the app.
        var bootBudget = new Promise(function (resolve) { setTimeout(resolve, 6000); });
        Promise.race([nightLoaded.then(resumeSession), bootBudget]).then(function () {
          if (!S.me) {
            showLogin();
            if (!S.night) PlayerSignal.ui.panel($('loginSig'), function () { location.reload(); }).show();
          }
        });
      }
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(function (reg) {
      PlayerSignal.ui.holdUpdate(reg, function () { return S.night; }, function (apply) { PlayerSignal.ui.updateCard($('updateCard'), apply); });
    }).catch(function () {});
  }

  // My account (T1): the More panel's buttons open sheets; the forms call the server through be.
  var myAccountWired = false;
  function wireMyAccount() {
    if (myAccountWired || !window.PlayerMyAccount) return;
    myAccountWired = true;
    var box = null, pendingPin = '';
    function closeSheet() { if (box) { box.remove(); box = null; } }
    function openSheet(kind, opts) {
      closeSheet();
      box = document.createElement('div');
      box.className = 'ma-overlay';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.innerHTML = PlayerMyAccount.buildSheet(kind, opts || {});
      document.body.appendChild(box);
      var first = box.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    }
    function showError(text) {
      if (!box) return;
      var old = box.querySelector('.ma-error');
      if (old) old.remove();
      var p = document.createElement('p');
      p.className = 'ma-error';
      p.setAttribute('role', 'alert');
      p.textContent = text;
      var form = box.querySelector('form');
      if (form) form.insertBefore(p, form.firstChild);
    }
    var NO_SIGNAL = 'No signal. Try again, or see the organiser.';
    function answer(r, done) {
      var m = PlayerMyAccount.messageFor(r);
      if (m.ok) done(); else showError(m.text);
    }
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-ma-action]') : null;
      if (!t) return;
      var act = t.getAttribute('data-ma-action');
      if (act === 'cancel') return closeSheet();
      if (act === 'pin' || act === 'privacy') return openSheet(act);
      if (act === 'name') return openSheet('name', { first: S.me && S.me.first, lastInitial: S.me && S.me.lastInitial });
      if (act === 'delete') return openSheet('delete-1');
      if (act === 'data') {
        var label = t.textContent;
        be.playerMyData(readToken()).then(function (r) {
          if (!r || r.ok !== true) { t.textContent = NO_SIGNAL; return; }
          var f = PlayerMyAccount.dataFile(r.data || r);
          var url = URL.createObjectURL(new Blob([f.text], { type: f.type }));
          var a = document.createElement('a');
          a.href = url; a.download = f.filename;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          t.textContent = label;
        }).catch(function () { t.textContent = NO_SIGNAL; });
      }
    });
    document.addEventListener('submit', function (e) {
      var form = e.target;
      var kind = form && form.getAttribute ? form.getAttribute('data-ma-form') : null;
      if (!kind) return;
      e.preventDefault();
      var v = {};
      new FormData(form).forEach(function (val, k) { v[k] = String(val).trim(); });
      var tok = readToken();
      function fail() { showError(NO_SIGNAL); }
      if (kind === 'pin') {
        if (!PlayerMyAccount.validPin(v.old_pin) || !PlayerMyAccount.validPin(v.new_pin)) return showError('PIN must be exactly 4 digits.');
        return be.playerChangePin(tok, v.old_pin, v.new_pin).then(function (r) { answer(r, closeSheet); }).catch(fail);
      }
      if (kind === 'name') {
        return be.playerChangeName(tok, v.first, v.last_initial.toUpperCase()).then(function (r) { answer(r, closeSheet); }).catch(fail);
      }
      if (kind === 'delete-1') {
        if (!PlayerMyAccount.validPin(v.pin)) return showError('PIN must be exactly 4 digits.');
        pendingPin = v.pin;
        return openSheet('delete-2');
      }
      if (kind === 'delete-2') {
        return be.playerDeleteMe(tok, pendingPin).then(function (r) {
          answer(r, function () { closeSheet(); logOut(); });
        }).catch(fail);
      }
    });
  }

  boot();
})();
