/* App shell: loading -> log in -> Home, with four tabs (Home, Live, Stats, More). Profile and Shop are pages.
   Plain JS, no framework. Uses the finished screens: home, profile, leaderboard, shop (in a frame),
   loading, lineup reveal and lib/xp.js + lib/player-name.js.

   Flow: cold start -> loading screen (PlayerLoading) -> log in -> Home.
   The lineup reveal opens from Home (Lineup button) and on its own while the app is open, 1 minute before a game.
   More holds Leaderboard, Shop, Settings and About.

   MOCK DATA: until the Supabase keys arrive (config.js backend 'mock'), this shell seeds one demo player
   (first name Sam, last initial K, PIN 1234) and a demo night into an in-memory store on every load.
   Nothing is kept on the phone, as in night.html.
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
  // P12: weak-signal line. Watches every server call; never blocks or cancels one.
  var sigLine = window.PlayerSignalLine ? window.PlayerSignalLine.create() : null;
  if (sigLine) be = sigLine.wrap(be);
  var NIGHT_ID = 'tonight';
  var TABS = ['home', 'live', 'stats', 'more'];
  var SUBS = ['shop', 'history'];
  var SUB_PARENT = { home: '#home', live: '#live', stats: '#stats', profile: '#profile', more: '#more' };
  var TAB_LABEL = { home: NAMES.tabs.home, live: NAMES.tabs.live, stats: NAMES.tabs.stats, profile: NAMES.profile, more: NAMES.tabs.more };
  var THEME_KEY = '1to1-theme';
  var $ = function (id) { return document.getElementById(id); };
  // Speed: the Stats and Profile scripts load on the first visit to those screens (and are fetched once the app is idle).
  var GROUPS = {
    stats: ['screens/leaderboard/leaderboard.js', 'screens/peek/peek.js', 'screens/stats-board/stats-board.js', 'screens/head-to-head/head-to-head.js', 'screens/streaks/streaks.js'],
    profile: ['screens/profile/profile.js', 'screens/photo/photo.js', 'share-card/share-card.js']
  };
  var groupDone = {}, groupBusy = {};
  function ensureGroup(name) {
    if (groupDone[name]) return Promise.resolve();
    if (!groupBusy[name]) {
      groupBusy[name] = GROUPS[name].reduce(function (p, src) {
        return p.then(function () {
          return new Promise(function (done) {
            var sc = document.createElement('script');
            sc.src = src; sc.onload = done; sc.onerror = done;   // a failed file still lets the screen draw its plain state
            document.body.appendChild(sc);
          });
        });
      }, Promise.resolve()).then(function () { groupDone[name] = true; });
    }
    return groupBusy[name];
  }
  // Fetched 4 s after Home is up, when the phone is idle. Boot stays lean, and the first tap on Stats or Profile is still quick.
  function prefetchGroups() {
    var go = function () { ensureGroup('stats'); ensureGroup('profile'); };
    setTimeout(function () {
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4000 }); else go();
    }, 4000);
  }

  var LOGIN_MSG = {
    'wrong-details': 'No one signed up with that name. Check the spelling, or sign up first.',
    'wrong-pin': 'Wrong PIN. Try again.',
    'hard-stop': (window.WORDING56 ? WORDING56.lockMessage('signin', 'hard-stop') : 'Ask the organiser to reset your PIN.'),
    'locked': (window.WORDING56 ? WORDING56.lockMessage('signin', 'pause') : 'Too many wrong tries. Try again in 1 minute, or ask the organiser.')
  };

  // Mock people. Sam K is the demo player who logs in.
  var PEOPLE = {
    blue: [['Sam', 'K', 12, 'Steady Starter'], ['Ali', 'R', 9, 'Quick Hands'], ['Jo', 'M', 7, 'Ball Mover'], ['Mia', 'L', 10, 'Rim Runner'], ['Tom', 'W', 3, 'Rookie']],
    red: [['Priya', 'T', 14, 'Floor General'], ['Ben', 'C', 5, 'Corner Sniper'], ['Zoe', 'B', 8, 'Box Out'], ['Leo', 'F', 6, 'Pick and Roll'], ['Ava', 'D', 11, 'Glue Guy']]
  };

  var S = {
    rsvp: null, rsvpError: false,
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
    serverRun: null  // 72k: player_run_status state: open, ended, none, cancelled, removed, signin (null until answered)
  };

  // ---------- helpers ----------
  function hhmm(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  // ---------- the signed-in player and tonight (real data only) ----------
  function fullName() { return S.me ? S.me.first + ' ' + S.me.lastInitial : ''; }
  // What the player sees of themselves: their username (never the first name or initial). Other players: usernames only.
  function displayName() { return S.username || savedUsernameHere() || 'You'; }
  function teamName(t) { return t && t.name ? String(t.name) : 'TBC'; }
  function skillText(level) { return window.PlayerRules ? PlayerRules.levelLabel(level) : ''; }
  function myTeamIn(game) {
    var list = (game && game.teams) || [];
    var i = NightShape.teamIndexOf(list, S.me);
    return i < 0 ? null : list[i];
  }
  // The other team. Null when I am not on any team: Home then shows no "vs" line, never a guess.
  function oppIn(game) {
    var list = (game && game.teams) || [];
    var i = NightShape.teamIndexOf(list, S.me);
    if (i < 0) return null;
    return list.filter(function (t, j) { return j !== i; })[0] || null;
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
  // The XP run for the level the server holds (same curve as lib/xp.js totalForLevel). No demo numbers.
  function myRun() {
    var L = Math.max(1, Math.min(60, Math.round(Number(S.me && S.me.xpLevel)) || 1));
    var run = PlayerXp.newRun();
    run.xp = Math.round((L - 1) * (30 + 1.5 * L));
    run.maxLevel = L;
    return run;
  }
  function dayOf(iso) { if (isNaN(Date.parse(iso))) return ''; return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + hhmm(iso); }
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
        mapName: '',
        teams: [{ name: 'Blue', players: sameGroup(PEOPLE.blue) }, { name: 'Red', players: sameGroup(PEOPLE.red) }]
      });
    }
    return { title: 'This run', when: 'Time set by the desk', price: '£5', date: new Date(now).toISOString().slice(0, 10), games: games };
  }

  // R177: games may have no start time. Then the next game is the flagged one, and its time is the run start (London).
  function nextGame(now) {
    var games = (S.night && S.night.games) || [];
    var g = NightShape.nextGame(games, now);
    if (!g) return null;
    if (NightShape.validTime(g.startsAt)) return g;
    var rs = NightShape.runStartMs(S.night);
    if (isNaN(rs)) return null;
    return Object.assign({}, g, { startsAt: new Date(rs).toISOString(), timed: false });
  }

  // Stay signed in on this phone for 90 days. The phone keeps only the sign-in token, never the PIN.
  var TOKEN_KEY = '1to1-player-token';
  // The sign-in token is also kept in memory, so a phone with storage blocked can still join while the page is open.
  var memToken = '';
  function saveToken(t) { memToken = t || ''; try { if (t) localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* blocked: the memory copy is used */ } }
  function readToken() { try { return localStorage.getItem(TOKEN_KEY) || memToken; } catch (e) { return memToken; } }
  function clearToken() { memToken = ''; try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* nothing to clear */ } }

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
    if (r && r.state && r.state.equipped) { S.shopEquipped = slotsFromShop(r.state.equipped); }
    if (r && r.state && typeof r.state.coins === 'number') { S.coins = r.state.coins; refreshCoins(); }
    else if (S.shopEquipped) { refreshCoins(); }
    return r;
  }
  function ensureShop() {
    if (shopBe) return shopBe;
    var real = window.ShopBackend.create(kind === 'supabase'
      ? cfg
      : { backend: 'mock', level: PlayerXp.progress(S.run).level, stars: S.run.stars },
      function () { return readToken(); });
    // Keep every method of the real backend (climb and crew calls too). Only load and act also read the coins.
    shopBe = Object.assign({}, real, {
      load: function () { return real.load().then(readCoinsFrom); },
      act: function (id, tag) { return real.act(id, tag).then(readCoinsFrom); }
    });
    return shopBe;
  }
  // The Shop frame asks for this same instance (same origin), so a purchase updates Home and Profile at once.
  // name() gives the Shop frame the signed-in player's own name (never the demo name).
  // 72r4: the shop reports its equipped state here, so Profile shows what the shop shows.
  var SHOP_SLOT_LAYER = { banner: 'background', name: 'name', calling: 'card', row: 'row', clan: 'title' };
  // Stage 1 (card builder): every worn layer reaches the card, not only the five old slots.
  var SHOP_LAYERS = ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'flourish', 'row', 'ring', 'intro', 'pop'];
  function slotsFromShop(eq) {
    var out = {};
    Object.keys(SHOP_SLOT_LAYER).forEach(function (slot) {
      var id = eq[SHOP_SLOT_LAYER[slot] && ('l_' + SHOP_SLOT_LAYER[slot])] || eq[slot];
      if (id) out[slot] = id;
    });
    out.layers = {};
    SHOP_LAYERS.forEach(function (layer) {
      var id = eq['l_' + layer];
      if (id) out.layers[layer] = id;
    });
    return out;
  }
  window.PlayerShop = {
    get: ensureShop,
    name: function () { return displayName(); },
    report: function (eq) { S.shopEquipped = slotsFromShop(eq || {}); var pb = $('profile'); if (pb && pb.childNodes.length) renderProfile(); }
  };
  function refreshCoins() {
    if (S.home) S.home.update(homeData(Date.now()));
    var prof = $('profile');
    if (prof && prof.childNodes.length) renderProfile();
  }

  // ---------- data for the screens ----------
  // I'm in / Can't make it (R74): the server answer for this player and night.
  // P13 (R198): my own spot in the upcoming runs (upcoming_list). Feeds the Live waiting room only.
  // One call a minute; reset on sign-out and sign-in (R220). Timeout 12 s, with error and Try again.
  var upcomingGate = null;
  function gateFor() {
    if (!upcomingGate && be.upcomingList && window.PlayerBackend && window.PlayerBackend.upcomingGate) upcomingGate = window.PlayerBackend.upcomingGate(be);
    return upcomingGate;
  }
  function resetUpcoming() {
    S.upcoming = null;
    S.upcomingError = false;
    S.board = null;
    if (S.scoreCard) S.scoreCard.stop();
    S.scoreCard = null;
    if (upcomingGate) upcomingGate.reset();
  }
  function loadUpcoming() {
    var t = readToken();
    var g = gateFor();
    if (!t || !g) return;
    window.LoadTimeout.run(function () {
      return g.load(t).then(function (r) { return r && r.stale ? { ok: true, runs: [], stale: true } : r; });
    }, { isEmpty: function (r) { return !!r.stale || !(r.runs && r.runs.length); } }).then(function (res) {
      if (res.data && res.data.stale) return;                       // a newer load (after sign-in) is on its way
      S.upcomingError = res.state === 'error' || res.state === 'timeout';
      S.upcoming = S.upcomingError ? null : ((res.data && res.data.runs) || []);
      if (S.liveScreen) S.liveScreen.update(liveData());
    });
  }

  // P13: the live scoreboard (player_live_scoreboard), 12 s timeout. Scores and team names only.
  // The score card fires once per new basket; the first load does not replay baskets already on the board.
  function loadBoard() {
    var t = readToken();
    if (!t || !be.scoreboard || !S.me) return;
    window.LoadTimeout.run(function () { return be.scoreboard(t, NIGHT_ID); }, { isEmpty: function (r) { return !r.live; } }).then(function (res) {
      S.board = { state: res.state, data: res.data };
      if (res.state === 'ok' && res.data.events) {
        var evs = res.data.events, newest = null;
        evs.forEach(function (e) { if (e && e.at && (!newest || e.at > newest)) newest = e.at; });
        if (!S.scoreCard) S.scoreCard = window.PlayerScoreCard.create(showScoreCard, { lastAt: newest });
        else S.scoreCard.feed(evs);
      }
      if (S.liveScreen) S.liveScreen.update(liveData());
    });
  }
  function showScoreCard(markup) {
    var el = document.getElementById('scLayer');
    if (!el) { el = document.createElement('div'); el.id = 'scLayer'; el.className = 'sc-layer'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.innerHTML = markup;
    el.classList.add('on');
    clearTimeout(showScoreCard.t);
    showScoreCard.t = setTimeout(function () { el.classList.remove('on'); }, 1900);
  }
  function retryLive() {
    if (upcomingGate) upcomingGate.reset();
    loadUpcoming();
    loadBoard();
  }

  // The real level is the XP ledger's level (player_state, read by player_xp_summary). Sign-in and resume return
  // signups.xp_level, which nothing updates, so Home showed Level 1. Take the higher of the two.
  function loadXpLevel() {
    var t = readToken();
    if (!t || !be.rpc || !S.me) return;
    be.rpc('player_xp_summary', { p_token: t }).then(function (x) {
      if (!x || x.ok === false || typeof x.level !== 'number') return;
      S.me.xpLevel = Math.max(Number(S.me.xpLevel) || 1, Math.round(x.level));
      if (x.username) { S.username = String(x.username); saveUsernameHere(S.username); }
      var run = myRun();
      if (typeof x.xp === 'number' && x.xp > run.xp) run.xp = x.xp;
      S.run = run;
      if (S.home) S.home.update(homeData(Date.now()));
      var prof = $('profile'); if (prof && prof.childNodes.length) renderProfile();
    }).catch(function () { /* keep the level from sign-in */ });
  }

  // Reads player_profile (totals and nights). Fills Home's games, wins and last run, and the Profile numbers.
  function loadProfileStats() {
    var t = readToken();
    if (!t || !be.rpc) return;
    loadXpLevel();
    be.rpc('player_profile', { p_token: t }).then(function (r) {
      if (!r || r.ok === false) return;
      S.profileStats = r;
      if (S.home) S.home.update(homeData(Date.now()));
      // Gap 4 (72v): my details come back from the server on sign-in (player_get_profile, migration-56).
      be.rpc('player_get_profile', { p_token: t }).then(function (p) {
        if (p && p.ok === true) { S.nickname = p.nickname || ''; S.teamPref = p.team_pref || 'any'; if (S.moreScreen) S.moreScreen.update(moreData()); }
      }).catch(function () { /* no saved details yet: keep what the phone has */ });
      var prof = $('profile'); if (prof && prof.childNodes.length) renderProfile();
    }).catch(function () { /* Home keeps its zeros and no last-run card when the read fails */ });
  }

  function loadRsvp() {
    var t = readToken();
    if (!t || !be.rsvpList) return;
    loadUpcoming();
    be.rsvpList(t, NIGHT_ID).then(function (r) {
      S.rsvp = r || { ok: false, reason: 'error' };
      if (S.home) S.home.update(homeData(Date.now()));
    }).catch(function () {
      S.rsvp = { ok: false, reason: 'error' };
      if (S.home) S.home.update(homeData(Date.now()));
    });
  }

  function shopItemsFor() {
    var cat = (window.ShopCosmetics && window.ShopCosmetics.ITEMS) || [];
    var owned = S.owned || [];
    return cat.map(function (it) {
      return { id: it.id, slot: it.slot, value: it.value, name: it.name, price: it.price, owned: owned.indexOf(it.id) >= 0, unlockLevel: it.minLevel };
    });
  }

  // The Home next card: my game, or the next game when I am not in it.
  function nextCard(game, games) {
    var c = NightShape.cardFor(game, games, S.me);
    return { gameNo: game.no, vs: c.vs, versus: c.versus, notIn: c.notIn, playsIn: c.playsIn,
      dayLabel: dayOf(game.startsAt), startsAt: game.startsAt };
  }
  // The Live "Next up" line: the opponent when I am in the game, the matchup when I am not.
  function nextUpOf(game) {
    return NightShape.nextUpFor(game, S.me);
  }

  // Auto runs (JORD-PASTE-62): "Thu 19 Nov, 8:00pm" from S.nextRun, the same format the organiser writes.
  function nextRunText() {
    var r = S.nextRun;
    if (!r || !r.date || !r.start) return '';
    var DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var y = +r.date.slice(0, 4), m = +r.date.slice(5, 7) - 1, d = +r.date.slice(8, 10);
    var hh = +r.start.slice(0, 2), mm = r.start.slice(3, 5);
    return DN[new Date(Date.UTC(y, m, d)).getUTCDay()] + ' ' + d + ' ' + MN[m] + ', ' + ((hh % 12) || 12) + ':' + mm + (hh >= 12 ? 'pm' : 'am');
  }

  // Fix 2: last run card from the newest night in player_profile (no card when no games yet).
  function lastNightOf() {
    var n = ((S.profileStats || {}).nights || [])[0];
    if (!n || !(Number(n.games) > 0)) return null;
    return { xp: Number(n.xp || n.points) || 0, games: Number(n.games) || 0, wins: Number(n.wins) || 0 };
  }

  function homeData(now) {
    var game = nextGame(now);
    var games = (S.night && S.night.games) || [];
    return {
      rsvp: S.rsvp,
      rsvpError: S.rsvpError,
      shopWorn: S.shopEquipped || {},
      player: Object.assign({ name: displayName(), banner: '', nameStyle: '', clanTag: '', skill: skillText(S.me && S.me.level), games: Number(((S.profileStats || {}).totals || {}).games) || 0, wins: Number(((S.profileStats || {}).totals || {}).wins) || 0 },
        { banner: '', nameStyle: (S.shopEquipped && S.shopEquipped.name) || '',
          rowEffect: (S.shopEquipped && S.shopEquipped.row) || '', callingCard: (S.shopEquipped && S.shopEquipped.calling) || '',
          layers: (S.shopEquipped && S.shopEquipped.layers) || {} }),
      run: S.run,
      coins: typeof S.coins === 'number' ? S.coins : null,   // 72g: null until the shop read answers, so Home shows a dash, not 0
      next: game ? nextCard(game, games) : null,
      runState: runStateText(games, now),
      runOver: runOverNow(),
      runOverWord: runOverWordNow(),
      nextRunLabel: nextRunText() || (S.night && S.night.nextRun) || '',
      teamsIn: !!(game && LineupGate.published(game)),
      schedule: games.map(function (g) {
        var state = game && g.id === game.id ? 'next' : 'todo';
        var lab = NightShape.rowLabel(g, S.me);
        return { no: g.no, time: hhmm(g.startsAt), vs: lab.vs, versus: lab.versus, state: state };
      }),
      lastNight: lastNightOf(),
      live: S.live,
      pay: payData(),
      checkedIn: readCheckedIn(),
      runOn: runOnNow(now),
      runLabel: (S.night && S.night.fields && S.night.fields.nextRun) || '',
      level: PlayerXp.progress(S.run).level,
      shopItems: shopItemsFor(),
      newLooks: false,
      updatedAt: null
    };
  }

  // 72g: "claim pending" survives a reload on this phone. The server does not send the claim back yet,
  // so this phone remembers its own claim for this night (cleared on sign-out).
  var CLAIM_KEY = 'cb.claimed';
  function rememberClaim(on) {
    try { if (on) localStorage.setItem(CLAIM_KEY, NIGHT_ID); else localStorage.removeItem(CLAIM_KEY); } catch (e) { /* storage blocked: the claim lasts this visit */ }
  }
  function storedClaim() {
    try { return localStorage.getItem(CLAIM_KEY) === NIGHT_ID; } catch (e) { return false; }
  }

  // 72k (R315): card pending is remembered on this phone when "Pay by card" is tapped; it clears when the server says paid.
  var CARD_KEY = 'cb.cardPending', SEEN_KEY = 'cb.paidSeen';
  function rememberCard(on) {
    try { if (on) localStorage.setItem(CARD_KEY, NIGHT_ID); else localStorage.removeItem(CARD_KEY); } catch (e) { /* storage blocked */ }
  }
  function storedCard() {
    try { return localStorage.getItem(CARD_KEY) === NIGHT_ID; } catch (e) { return false; }
  }
  function seenPaid() {
    try { return localStorage.getItem(SEEN_KEY) === NIGHT_ID; } catch (e) { return false; }
  }
  var paidSeenTimer = null;
  // The one pay screen (Home). Money exists only inside a booked run (amountNow). States: due, card, claimed, paid.
  // "Paid. You're in." shows once; after that the top line and all money text go for this run.
  function payData() {
    var cfg = window.PLAYER_APP_CONFIG || {};
    if (S.paid && storedCard()) rememberCard(false);
    var status = S.paid ? 'paid' : ((S.claimed || storedClaim()) ? 'claimed' : (storedCard() ? 'card' : 'due'));
    if (S.pay && S.pay.state) {
      var map = { paid: 'paid', claimed: 'claimed', card_pending: 'card', due: 'due', none: 'none' };
      status = map[S.pay.state] || 'due';
    }
    if (status === 'paid' && !seenPaid() && !paidSeenTimer) {
      paidSeenTimer = setTimeout(function () {
        try { localStorage.setItem(SEEN_KEY, NIGHT_ID); } catch (e) { /* storage blocked: shown again */ }
        paidSeenTimer = null;
        if (S.home) S.home.update(homeData(Date.now()));
        payTopUpdate();
      }, 8000);
    }
    // Pay first (R-P2): only when the organiser's switch is On for this night. Off (or missing) changes nothing.
    var payFirst = !!(S.night && S.night.fields && S.night.fields.payFirst === true);
    var gone = status === 'paid' && seenPaid();
    return {
      amount: gone ? '' : amountNow(),
      status: status,
      link: cfg.squarePayLink || '',
      error: !!S.payErr,
      receiptDate: niceDate(S.night && S.night.date),
      gate: payFirst && status !== 'paid'
    };
  }
  // 72k: a price is shown only for a player who has used a good code in a run that is open now on the server.
  // No open run, or no join for it, means no amount anywhere (no "5 to pay" on a night with no run).
  function amountNow() {
    var inRun = S.serverRun === 'open';
    // R318: when the server answered, its amount is used, and only for a booked player (amount_pence null otherwise).
    // 72p: a booked player still owes after End run, so the booking alone decides once the server has answered.
    if (S.pay && S.pay.state) {
      if (S.pay.state === 'none' || !S.pay.booked || S.pay.amountPence == null) return '';
      var pounds = S.pay.amountPence / 100;
      return '£' + (pounds % 1 === 0 ? String(pounds) : pounds.toFixed(2));
    }
    var joined = inRun && serverJoin !== false && !!(S.checkedIn || readCheckedIn());
    return joined && S.night && S.night.price ? S.night.price : '';
  }
  // "16 Nov" from a night date (yyyy-mm-dd). Empty when there is no date.
  function niceDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (!m) return '';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  // Gap 3 (72v): one claim at a time (no double send on a double tap), and a failed read shows the error instead of nothing.
  function claimFromHome() {
    if (S.claimBusy) return;
    S.claimBusy = true;
    S.payErr = false;
    // Review fix (72z): a hung request on a bad signal must not block the button for good. Free it after 15 s.
    var claimGuard = setTimeout(function () { S.claimBusy = false; }, 15000);
    moreHandlers.claimPaid(NIGHT_ID).then(function (r) {
      S.payErr = !(r && r.ok);
    }, function () { S.payErr = true; }).then(function () {
      clearTimeout(claimGuard);
      S.claimBusy = false;
      if (S.home) S.home.update(homeData(Date.now()));
      placeHomeExtras();
      updateTabDots();
    });
  }
  // 72g: the top-bar Pay line. Shown only for a joined player who owes (due or claim pending); gone once paid.
  // Tap opens Home, where the pay box has Pay by card and I've paid cash.
  function payTopUpdate() {
    var btn = document.getElementById('payTop');
    if (!btn) return;
    var p = payData();
    // 72h (R299): the top Pay pill is a shortcut to the one pay screen (Home pay box), shown only after a good code in a run that is owing.
    var show = !!S.me && !!p.amount && p.status !== 'paid';
    btn.hidden = !show;
    if (!show) return;
    btn.textContent = p.status === 'claimed' ? 'Cash: waiting' : (p.status === 'card' ? 'Card: checking' : 'Pay ' + p.amount);
  }
  // 72g: on the other tabs, one thin dark strip under the top bar with the live score (team names and score only).
  // One soft pulse when a score moves. Tap opens Live. Hidden on Live itself, which keeps the full view.
  var lastStripScore = '';
  function liveStripUpdate() {
    var strip = document.getElementById('liveStrip');
    if (!strip) return;
    var f = feedNow();
    var n = f && f.live ? f.now : null;
    var onLive = (location.hash || '').indexOf('#live') === 0;
    var show = !!S.me && !!n && !onLive;
    strip.hidden = !show;
    if (!show) { lastStripScore = ''; return; }
    var txt = escText(n.teamA || 'Team A') + ' <b>' + escText(n.scoreA) + '</b> – <b>' + escText(n.scoreB) + '</b> ' + escText(n.teamB || 'Team B');
    var sc = String(n.scoreA) + '-' + String(n.scoreB);
    var body = document.getElementById('liveStripBtn');
    if (!body) return;
    if (body.innerHTML !== txt) body.innerHTML = txt;
    if (lastStripScore && lastStripScore !== sc) {
      body.classList.remove('pulse'); void body.offsetWidth; body.classList.add('pulse');
    }
    lastStripScore = sc;
  }
  (function wireLiveStrip() {
    var btn = document.getElementById('liveStripBtn');
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = '1';
      btn.addEventListener('click', function () { location.hash = '#live'; });
    }
  })();
  window.addEventListener('hashchange', liveStripUpdate);
  (function wirePayTop() {
    var btn = document.getElementById('payTop');
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = '1';
      btn.addEventListener('click', function () { location.hash = '#home'; });
    }
  })();
  // Pay proof (15 Nov): the Home Pay line learns "Paid" from the server every 15 s and when the phone comes back,
  // so a cash or card mark by the organiser shows here without a reload. Unmark brings "due" back.
  var lastPaySig = '';
  function refreshPaid() {
    var t = readToken();
    if (!t || !S.me || !be.paymentStatus) return;
    return be.paymentStatus(t, NIGHT_ID).then(function (r) {
      if (!r || !r.ok) return;
      var was = !!S.paid;
      S.paid = !!r.paid;
      // R318: the server's state is the one truth. The phone memory of a claim is only a fallback when no state came back.
      if (r.state) { S.pay = { state: r.state, booked: !!r.booked, amountPence: r.amountPence }; rememberClaim(r.state === 'claimed'); }
      else { S.pay = null; }
      var sig = JSON.stringify([S.paid, S.pay, S.claimed]);
      var changed = sig !== lastPaySig;
      lastPaySig = sig;
      if (changed && S.home) S.home.update(homeData(Date.now()));
      if (changed || was !== S.paid) payTopUpdate();
    }, function () { /* offline: the next look tries again */ });
  }
  // 72i: the paid check runs every 2 s while a cash claim is waiting (up to 10 minutes after the claim), else every 15 s.
  // 72k: the server's run state. 'open' = the organiser's code is up (Start run); 'ended', 'none', 'cancelled' = not on.
  // Until that answer comes, the night's own run flag decides.
  // 72p: once the server has answered and it is not 'open' (End run, none, cancelled, removed, anything else), the run is not on.
  function runOnNow(now) {
    if (S.serverRun === 'open') return true;
    if (S.serverRun && S.serverRun !== 'signin') return false;
    return NightShape.runOn(S.night, now);
  }
  // Run over (72q): the organiser ended the run (End run publishes run status closed), the night is cancelled, or the server says ended.
  // Home and Live then say the run is over and stop offering the games as next. A run that is on now is never over.
  function runOverNow() {
    if (runOnNow(Date.now())) return false;
    if (S.serverRun === 'ended' || S.serverRun === 'cancelled') return true;
    var PRS = window.PlayerRunState;
    return !!(PRS && S.night && { ended: 1, cancelled: 1, 'called-off': 1, closed: 1 }[PRS.statusOf(S.night)]);
  }
  // Live tab redraw (72q): the Live screen reads the night too, so it follows a night change at once.
  function liveUpdate() { if (S.liveScreen) S.liveScreen.update(liveData()); }
  // The words for a run that is over: a cancelled night says so (the organiser marks it cancelled).
  function runOverWordNow() {
    var PRS = window.PlayerRunState;
    return PRS && S.night && PRS.statusOf(S.night) === 'cancelled' ? 'Run is cancelled' : 'Run is over';
  }
  // A run day: the run is open on the server, or the night is dated today.
  function runDay() {
    if (S.serverRun === 'open') return true;
    // 72l: the fast tick also runs from 30 minutes before the start until 6 hours after it.
    var st = Date.parse(runStartNow());
    var now = Date.now();
    if (!isNaN(st) && now >= st - 30 * 60 * 1000 && now <= st + 6 * 60 * 60 * 1000) return true;
    return !!(S.night && S.night.date && S.night.date === NightShape.londonDayKey(Date.now()));
  }
  // 72k: one tick. On a run day (tab visible) every 2 s: the server's run state, the night's stamp (full read only when it moved),
  // and the paid mark. The live row has its own loop (liveDelay). Otherwise every 30 s.
  // 17 Nov: idle phones check every 15 s (was 30 s), the same cadence as the organiser's payment pull, so a payment shows sooner.
  var TICK_RUN_MS = 2000, TICK_IDLE_MS = 15000, lastNightStamp = '';
  function tickDelay() { return runDay() && !document.hidden ? TICK_RUN_MS : TICK_IDLE_MS; }
  function runTick() {
    if (!S.me || document.hidden) return Promise.resolve();
    var t = readToken();
    var st = t && be.runStatus ? be.runStatus(t, NIGHT_ID) : Promise.resolve(null);
    return st.then(function (r) {
      if (r && r.ok === true && r.state && r.state !== S.serverRun) {
        S.serverRun = r.state;
        if (r.state === 'open') S.sawOpen = true;
        if (S.home) S.home.update(homeData(Date.now()));
        liveUpdate();
        liveStripUpdate();
        checkJoinState();
      } else if (r && r.ok === true && r.state) { S.serverRun = r.state; if (r.state === 'open') S.sawOpen = true; }
      if (!be.getNightStamp) return refreshNight();
      return be.getNightStamp(NIGHT_ID).then(function (s) {
        if (s && s.ok && s.stamp !== lastNightStamp) { lastNightStamp = s.stamp; return refreshNight(); }
      });
    }).then(function () { return refreshPaid(); }, function () { return refreshPaid(); })
      .then(function () { /* done */ }, function () { /* the next tick tries again */ });
  }
  // Checks every half second and runs a tick when its gap has passed, so a run day that starts after load is picked up at once.
  var lastTickAt = 0;
  function tickLoop() {
    setTimeout(function () {
      // Fire and forget: a slow read never stops the loop (72k rig finding).
      if (Date.now() - lastTickAt >= tickDelay()) { lastTickAt = Date.now(); runTick().catch(function () { /* next tick tries again */ }); }
      tickLoop();
    }, 500);
  }
  tickLoop();

  // Night changes without a reload: check the organiser's night every 30 seconds and redraw Home when it changed.
  var lastNightSig = '';
  // Home run error (72e): shown above Home when the night read fails or never answers (12 s), with Try again.
  function setHomeError(on) {
    var el = document.getElementById('homeNightErr');
    if (!on) { if (el) el.hidden = true; return; }
    var host = $('home');
    if (!el && host && host.parentNode) {
      el = document.createElement('div');
      el.id = 'homeNightErr';
      el.className = 'card';
      el.setAttribute('role', 'alert');
      el.innerHTML = '<p class="sb-note">Can’t reach the run details right now. Check your signal and try again.</p>' +
        '<button type="button" class="btn ghost" data-act="retry-home-night">Try again</button>';
      el.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('[data-act="retry-home-night"]')) { el.hidden = true; refreshNight(); }
      });
      host.parentNode.insertBefore(el, host);
    }
    if (el) el.hidden = false;
  }
  function refreshNight() {
    if (!S.me || document.hidden) return;
    var LT = window.PlayerLoadTimeout;
    var p = be.getNight(NIGHT_ID);
    var work = LT ? LT.withTimeout(p, LT.LIMIT, 'night') : p;
    return work.then(function (nt) {
      setHomeError(false);
      if (!nt || !nt.payload) return;
      var sig = JSON.stringify(nt.payload);
      if (sig === lastNightSig) return;
      lastNightSig = sig;
      S.night = NightShape.applyNight(nt.payload);
      if (S.home) S.home.update(homeData(Date.now()));
      liveUpdate();
      checkJoinState();
    }).catch(function () { setHomeError(true); });
  }
  // 72k: refreshNight and refreshPaid run inside runTick (2 s on a run day, 30 s otherwise).

  // ---------- live feed (P9): the organiser's live row, read while the app is open ----------
  // Read only. The row holds the court, scores, fouls, the clock and the run date. It never holds who is in or who paid.
  // A failed read (no signal) keeps the last update on screen.
  var feedState = { feed: null, offline: false };
  var feedTimer = null, feedBusy = false;
  function feedNow() { return feedState.feed ? PlayerLiveFeed.fromFeed(feedState.feed, Date.now(), feedState.serverMs) : null; }
  // Heartbeat (live-feed.js): 'reconnecting' after 5 min with no beat, 'over' after 10 min. 'ok' when there is no row.
  function feedConnectionNow() { var f = feedNow(); return f ? f.connection : 'ok'; }
  // Run started on the organiser, no game on court yet: the Live tab says "Run is on".
  function feedStartedNow() { var f = feedNow(); return !!(f && f.state === 'started'); }
  // The organiser ended this run (or it has been silent for 10 min): the Live tab goes back to its default view.
  function feedEndedNow() { return PlayerLiveFeed.endedNow(feedNow()); }
  function feedRunKeyNow() { return feedState.feed ? PlayerLiveFeed.runKey(feedState.feed) : ''; }
  function liveNoNow() { var f = feedNow(); return f && f.now ? f.now.game : null; }
  // The Live screen's "now" card, from the live row. Falls back to S.live (null in the shipped build) when no row.
  function liveNow() {
    var f = feedNow();
    if (!f || !f.now) return S.live;
    var n = f.now;
    var clock = n.state === 'full-time' ? 'Full time' : (n.state === 'paused' ? 'Paused' : (n.clockText ? n.clockText + ' left' : ''));
    return { game: n.game, court: n.court, teamA: n.teamA, scoreA: n.scoreA, teamB: n.teamB, scoreB: n.scoreB, clock: clock, players: n.players || { a: [], b: [] }, history: n.history || [] };
  }
  // Results: the last finished game and the final game (no full list in the row). Hidden when none.
  function liveResults() {
    var f = feedNow();
    var r = f && f.recap;
    if (!r) return (S.live && S.live.results) || null;
    var out = [];
    [r.last, r.final].forEach(function (g) {
      if (g && !out.some(function (x) { return x.no === g.no; })) out.push({ no: g.no, teamA: g.teamA, teamB: g.teamB, scoreA: g.scoreA, scoreB: g.scoreB, final: true });
    });
    return out.length ? out : null;
  }
  // Live feed error (72d): shown above the Live screen when the feed read fails or never answers (8 s), with Try again.
  function setLiveError(on) {
    var el = document.getElementById('liveFeedErr');
    if (!on) { if (el) el.hidden = true; return; }
    var host = $('live');
    if (!el && host && host.parentNode) {
      el = document.createElement('div');
      el.id = 'liveFeedErr';
      el.className = 'card';
      el.setAttribute('role', 'alert');
      el.innerHTML = '<p class="sb-note">Can’t reach the live feed right now. Check your signal and try again.</p>' +
        '<button type="button" class="btn ghost" data-act="retry-live-feed">Try again</button>';
      el.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('[data-act="retry-live-feed"]')) { el.hidden = true; pollLive(); }
      });
      host.parentNode.insertBefore(el, host);
    }
    if (el) el.hidden = false;
  }
  function pollLive() {
    if (!S.me || !be.getLive || feedBusy || document.hidden || navigator.onLine === false) return Promise.resolve();
    feedBusy = true;
    var wait = null;
    var timeout = new Promise(function (_, reject) { wait = setTimeout(function () { reject(new Error('timeout')); }, 8000); });
    return Promise.race([be.getLive(), timeout]).then(function (row) {
      var sig = row && row.payload ? JSON.stringify(row.payload) : '';
      feedState.changed = sig !== feedState.sig;   // stamp check: the same row as last time needs no redraw
      feedState.sig = sig;
      feedState.feed = row && row.payload ? row.payload : null;
      // The server's own stamp for the row (Supabase updated_at): the heartbeat check uses it too.
      feedState.serverMs = row && row.updatedAt ? Date.parse(row.updatedAt) : null;
      feedState.offline = false;
    }, function () { feedState.offline = true; feedState.changed = true; }).then(function () {
      clearTimeout(wait);
      feedBusy = false;
      // A silent organiser changes no row, so a change in the heartbeat state (reconnecting / over) must redraw too.
      if (feedConnectionNow() !== feedState.lastConn) { feedState.lastConn = feedConnectionNow(); feedState.changed = true; }
      if (feedState.changed) {
        if (feedNow() && feedNow().live) loadBoard(); else if (S.board) { S.board = null; }
        if (S.liveScreen) S.liveScreen.update(liveData());
      }
      liveStripUpdate();
      setLiveError(feedState.offline);
      updateTabDots();
    });
  }
  // Cadence (lib/live-cadence.js): 2 s while a game is on court, 30 s otherwise, 10 s after a failed read.
  function liveDelay() {
    var f = feedNow();
    return PlayerLiveCadence.delayMs({ offline: feedState.offline, live: !!(f && f.live) || runDay() });
  }
  function scheduleLive() {
    clearTimeout(feedTimer);
    feedTimer = setTimeout(function () { pollLive().then(scheduleLive); }, liveDelay());
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pollLive(); });
  // Pull to refresh (lib/pull-refresh.js): the night, the paid mark and the live row, at once.
  function refreshAll() { return Promise.all([refreshNight(), refreshPaid(), pollLive()]).then(function () {}, function () {}); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refreshPaid(); });

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

  // Own spot only (R143): is there an upcoming run where I am in (or, with paidOnly, paid)?
  function myPaidOrIn(paidOnly) {
    return (S.upcoming || []).some(function (r) {
      if (!r || !r.me) return false;
      return paidOnly ? r.me.paid === true : r.me.in === true;
    });
  }

  // Live tab data: the Live screen (screens/live) draws it. Built from the published night.
  function liveData() {
    var games = (S.night && S.night.games) || [];
    var game = nextGame(Date.now());
    // R168: the lineup shows one minute before each game, from the published night (lib/lineup-gate.js).
    var soon = !runOverNow() && LineupGate.shows(game, Date.now(), NightShape.runStartMs(S.night)) ? game : null;
    var lineup = null;
    if (soon) {
      var mine = myTeamIn(soon), theirs = oppIn(soon);
      // Not in this game: the first two named teams, so both teams show and none is tagged as mine.
      var named = (soon.teams || []).filter(function (t) { return t && t.name; });
      var ta = mine || named[0] || null, tb = mine ? theirs : (named[1] || null);
      var pl = function (t) {
        return (t ? t.players : []).map(function (p) {
          return { id: p.first + p.lastInitial, name: p.username || 'Player', level: p.level, stars: 0, banner: '', clanTag: '', captain: false };
        });
      };
      lineup = { game: soon.no, teamA: teamName(ta), teamB: teamName(tb), players: {}, left: !mine };
      lineup.players[teamName(ta)] = pl(ta);
      lineup.players[teamName(tb)] = pl(tb);
    }
    return {
      me: { team: teamName(myTeamNow()) },
      now: liveNow(),
      results: liveResults(),
      nextUp: game && !runOverNow() ? nextUpOf(game) : null,
      lineup: lineup,
      upcoming: games.map(function (g) {
        var lab = NightShape.rowLabel(g, S.me);
        return { no: g.no, time: hhmm(g.startsAt), vs: lab.vs, versus: lab.versus, state: liveNoNow() === g.no ? 'live' : (game && g.id === game.id ? 'next' : 'todo') };
      }),
      runOn: runOnNow(Date.now()) || feedStartedNow(),
      runStarting: feedStartedNow(),
      connection: feedConnectionNow(),
      waiting: !runOverNow() && !!(S.paid || myPaidOrIn() || (S.rsvp && S.rsvp.ok === true && S.rsvp.me === 'in')),
      runOver: runOverNow() || feedEndedNow(),
      runKey: feedRunKeyNow(),
      runOverWord: feedConnectionNow() === 'over' && !runOverNow() ? 'Run’s over' : runOverWordNow(),
      paid: !!(S.paid || myPaidOrIn(true)),
      waitError: !!S.upcomingError,
      board: S.board || null,
      updatedAt: feedNow() ? feedNow().updatedAt : null
    };
  }

  function renderLive() {
    if (!S.liveScreen) {
      S.liveScreen = PlayerLive.mount($('live'), liveData(), { onReveal: openLineup, onRetry: retryLive, onHome: function () { location.hash = '#home'; } });
      // Hype: re-light the tokens after every Live render, and ask the server for the latest taps (throttled).
      var liveUpd = S.liveScreen.update;
      S.liveScreen.update = function (d) { liveUpd(d); if (window.PlayerHype) PlayerHype.apply(document, hypeLit); hypeRefresh(false); };
    }
    else S.liveScreen.update(liveData());
    var ul = $('standings');
    ul.innerHTML = '';
    var st = standingsOf();
    st.forEach(function (t, i) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = (i + 1) + '. ' + t.name;
      var b = document.createElement('span'); b.className = 'muted'; b.textContent = (t.points || 0) + ' pts';
      li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
    $('standNote').textContent = st.length ? 'Standings after this run’s games.' : 'Standings show after the first game.';
  }

  function onPrestige() {
    if (!PlayerXp.canPrestige(S.run)) return;
    S.run = PlayerXp.prestige(S.run);
    renderProfile();
    announcePrestige(S.run.stars);
  }

  // P12: the prestige moment, once per new star. Reduced motion gets one plain line instead.
  function announcePrestige(stars) {
    if (!window.PlayerCelebrate) return;
    var store = window.localStorage;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var fresh = PlayerCelebrate.shouldPlay(stars, store);
    PlayerCelebrate.maybePlay({ stars: stars, reduce: reduce, store: store });
    if (!fresh || !reduce) return;
    var c = PlayerCelebrate.copy(stars);
    var p = document.getElementById('pcPlain');
    if (!p) { p = document.createElement('p'); p.id = 'pcPlain'; p.className = 'pc-plain'; p.setAttribute('role', 'status'); document.body.appendChild(p); }
    p.textContent = c.title + ' ' + c.star + '. ' + c.line;
    p.hidden = false;
    setTimeout(function () { p.hidden = true; }, 6000);
  }

  // P12: the run-state line on Home. Live is the same flag the Live tab uses (NightShape.runOn); over is the published status.
  function runStateText(games, now) {
    if (!window.PlayerRunState || !games || !games.length) return '';
    var starts = games.map(function (g) { return Date.parse(g.startsAt); }).filter(function (t) { return t > 0; });
    if (!starts.length) return '';
    // 72p: a run that was open this session and is now not open (End run) reads as over, even if the published night still says live.
    var ended = !!S.sawOpen && !!S.serverRun && S.serverRun !== 'open' && S.serverRun !== 'signin';
    var st = PlayerRunState.homeState(Math.min.apply(null, starts), now, runOnNow(now), ended ? 'ended' : PlayerRunState.statusOf(S.night));
    return st ? PlayerRunState.labelFor(st) : '';
  }

  // Bring a friend (P8): the player's own link and counts. Names are never returned.
  function loadInviteInto(box) {
    if (!box || !window.PlayerInvite || !S.me) return;
    var base = location.href.split('?')[0].split('#')[0];
    var retry = function () { loadInviteInto(box); };
    var card = PlayerInvite.mount(box, { base: base, state: 'loading' }, { retry: retry });
    if (!be.inviteInfo) { card.update({ state: 'error' }); return; }
    (window.PlayerLoadTimeout ? PlayerLoadTimeout.withTimeout(be.inviteInfo(readToken())) : be.inviteInfo(readToken())).then(function (r) {
      if (!r || r.ok === false) { card.update({ state: 'error' }); return; }
      card.update({ state: 'ready', code: r.code, joined: r.joined, rewarded: r.rewarded, coins: r.coins, badge: r.badge });
    }).catch(function () { card.update({ state: 'error' }); });
  }

  // Share my card (P8): the card picture, from fields the player already sees on Profile.
  function shareProfile(d) {
    if (!window.ShareCard) return;
    var t = (S.profileStats && S.profileStats.totals) || {};
    ShareCard.share({ mode: 'career', name: d.name, level: d.skill || 1, stars: 0,
      numbers: [{ label: 'NIGHTS', value: String(t.nights || 0) }, { label: 'WINS', value: String(t.wins || 0) }] }).catch(function () {});
  }

  function renderProfile() {
    var d = JSON.parse(JSON.stringify(PlayerProfile.SCENARIOS['new']));
    d.name = displayName();
    d.skill = Math.max(1, Math.min(30, Math.round(Number(S.me && S.me.level)) || 1));
    d.run = myRun();
    d.coins = S.coins || 0;
    d.clanTag = '';
    if (!S.shopEquipped && !S.shopEquippedAsked) {
      S.shopEquippedAsked = true;
      ensureShop().load().then(function (r) {
        if (r && r.ok && r.state) { window.PlayerShop.report(r.state.equipped || {}); }
      }, function () { /* offline: Profile shows nothing equipped until the shop answers */ });
    }
    d.equipped = S.shopEquipped || {};
    var st = S.profileStats || {};
    d.totals = Object.assign({ points: 0, wins: 0, games: 0, nights: 0 }, st.totals || {});
    if (vipState.icons.length) d.vip = { icons: vipState.icons, current: vipState.current };
    var box = $('profile');
    d.character = charState.current || vipState.current;
    box.innerHTML = PlayerProfile.render(d) + (window.PlayerPhoto ? PlayerPhoto.render(photoState) : '') +
      (window.ShareCard ? '<p class="profile-links"><button type="button" class="btn yellow" id="shareCard">Share my card</button></p>' : '');
    if (window.PlayerPhoto) PlayerPhoto.bind(box, { onFile: onPhotoFile, onIcon: onPhotoIcon });
    loadPhoto();
    var shareBtn = box.querySelector('#shareCard');
    if (shareBtn) shareBtn.addEventListener('click', function () { shareProfile(d); });
    // The shop lives inside Profile: its "Open shop" link opens the shop in the shell, not a separate page.
    box.querySelectorAll('a[href*="shop/shop.html"]').forEach(function (a) { a.setAttribute('href', '#profile/shop'); });
    PlayerProfile.bind(box, onPrestige, onVipIcon);
    // r7: the old character picker is hidden (its code stays in place). Players pick a Phosphor icon in the photo block instead.
    loadVip();
  }

  // Photo (r7): the player's own photo status. Other players see approved photos only (server rule).
  var photoState = { status: 'none', icon: '', note: '' };
  function loadPhoto() {
    var t = readToken();
    if (!t || !be.myPhoto || photoState.loaded || photoState.loading) return;
    photoState.loading = true;
    be.myPhoto(t).then(function (r) {
      photoState.loading = false;
      if (r && r.ok && r.status) { photoState.loaded = true; photoState.status = r.status; photoState.icon = r.icon || ''; photoState.image = r.status === 'rejected' ? '' : (r.image_data || ''); renderProfile(); }
      else { setTimeout(loadPhoto, 3000); }
    }, function () { photoState.loading = false; setTimeout(loadPhoto, 3000); });
  }
  function onPhotoFile(dataUrl) {
    var t = readToken();
    if (!t || !be.uploadPhoto) return;
    photoState.note = 'Sending…';
    be.uploadPhoto(t, dataUrl).then(function (r) {
      if (r && r.ok) { photoState.status = 'pending'; photoState.note = 'Sent. The organiser will check it.'; }
      else { photoState.note = r && r.reason === 'signed-out' ? 'Sign in again to upload.' : 'Could not send. Try again.'; }
      renderProfile();
    });
  }
  // Icon pick: saved to the server (player_set_photo_icon) and shown to other players.
  function onPhotoIcon(id) {
    var t = readToken();
    var before = photoState.icon;
    photoState.icon = id; photoState.note = ''; renderProfile();
    if (!t || !be.setPhotoIcon) { photoState.icon = before; photoState.note = 'Sign in to pick an icon.'; renderProfile(); return; }
    be.setPhotoIcon(t, id).then(function (r) {
      // Saved: reload the looks so the Leaderboard and player cards show the new icon now, not after a restart.
      if (r && r.ok) { loadLooks(); return; }
      // Not saved: show the icon that is really saved, and say so.
      photoState.icon = before;
      photoState.note = r && r.reason === 'signed-out' ? 'Sign in again to pick an icon.' : 'Icon not saved. Try again.';
      renderProfile();
    });
  }
  // Other players' looks, by public_id (photo only when approved). S.looks is set after each board load.
  function lookOf(p) { var k = p && (p.public_id || p.id); return (S.looks && k && S.looks[k]) || {}; }
  function loadLooks() {
    if (!be.publicLooks) { renderStats(); return; }
    be.publicLooks().then(function (r) {
      var map = {};
      ((r && r.rows) || []).forEach(function (row) { if (row && row.public_id) map[row.public_id] = { photo: row.image_data || '', icon: row.photo_icon || '' }; });
      S.looks = map;
      renderStats();
    }, function () { renderStats(); });
  }

  // VIP extras (migration-48): the server sends VIP players their pictures and nothing else goes to anyone else.
  var vipState = { icons: [], current: '', loaded: false };
  function loadVip() {
    var t = readToken();
    if (!t || !be.vipIcons || vipState.loaded) return;
    vipState.loaded = true;
    be.vipIcons(t).then(function (r) {
      if (r && r.ok && r.icons && r.icons.length) { vipState.icons = r.icons; renderProfile(); }
    });
  }
  function onVipIcon(id) {
    var t = readToken();
    if (!t || !be.setVipIcon) return;
    be.setVipIcon(t, id).then(function (r) {
      if (r && r.ok) { vipState.current = id; charState.current = id; renderProfile(); }
    });
  }

  // Your character (R70): the picker lives in icons/characters/picker.js. Saving uses the same server call as the old icon choice (player_set_icon).
  // The server accepts any id of the shape i or a plus two or three digits, and the picker only offers ids in its set.
  var charState = { current: '' };
  function mountCharacterPicker(box) {
    var host = box.querySelector('[data-character-picker]');
    if (!host) return;
    import('./icons/characters/picker.js').then(function (m) {
      m.renderCharacterPicker(host, { current: charState.current, onUse: onCharacterPick });
    }, function () {
      var note = box.querySelector('[data-character-note]');
      if (note) note.textContent = 'Characters could not load. Check your connection and try again.';
    });
  }
  function onCharacterPick(id) {
    var t = readToken();
    var note = $('profile').querySelector('[data-character-note]');
    if (!t || !be.setVipIcon) { if (note) note.textContent = 'Sign in to pick a character.'; return; }
    be.setVipIcon(t, id).then(function (r) {
      if (r && r.ok) { charState.current = id; renderProfile(); return; }
      if (note) note.textContent = 'Could not save. Try again.';
    });
  }

  function leaderboardData() {
    return {
      teams: standingsOf().map(function (t) { return { id: t.name, name: t.name, played: t.played || 0, wins: t.wins || 0, points: t.points || 0 }; }),
      // Looks and stars come from migration 47 (player_leaderboard). Until the board data is loaded, no player rows.
      players: ((S.seasonBoard && S.seasonBoard.players) || []).map(function (p) {
        // The board sends public_id (never the internal id) and "value" (the number for the chosen board).
        return { id: p.public_id || p.id, name: p.name, level: p.level, stars: p.stars, points: p.points != null ? p.points : p.value, wins: p.wins,
          icon: p.icon, photo: lookOf(p).photo, phIcon: lookOf(p).icon, look: p.look || {}, clanTag: p.clanTag, emblemSrc: p.emblemSrc,
          visible: p.visible, under18: p.under18 };
      })
    };
  }

  // Sub-screen: the Shop (from More, and from Profile). The Shop frame has its own heading.
  function renderSub(name) {
    var box = $('sub');
    box.innerHTML = '';
    if (name === 'shop') {
      box.innerHTML = '<iframe class="sub-frame" src="shop/shop-v2.html" title="Shop"></iframe>';
    }
    if (name === 'history') renderHistory();
  }

  // P6b: my stats, streak, game log and head to head. Every read has a 12 second limit, an error state and Try again.
  function renderHistory() {
    var box = $('sub');
    box.innerHTML = '<div id="hStreak"></div><div id="hBoard"></div><div id="hLog"></div><div id="hH2h"></div><div id="hH2hCard"></div>';
    var tok = readToken();
    // Every read ends: an answer, an error, or a 12 second limit. A sync throw becomes an error too.
    var rpc = function (n, b) {
      return new Promise(function (resolve, reject) {
        var done = false;
        var t = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout:' + n)); } }, 12000);
        var p;
        try { p = be.rpc ? be.rpc(n, b) : Promise.resolve({ ok: false }); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
          function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } });
      });
    };
    var retry = '<button type="button" class="btn ghost hist-retry" data-act="retry-history">Try again</button>';
    var failed = function (el, msg) {
      el.innerHTML = '<p class="sb-note" role="alert">' + msg + '</p>' + retry;
    };
    box.onclick = function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var retryBtn = t.closest('[data-act="retry-history"]');
      if (retryBtn) { renderHistory(); return; }
      var pick = t.closest('[data-h2h]');
      if (pick && window.PlayerHeadToHead) {
        var card = $('hH2hCard');
        card.innerHTML = '<p class="sb-note" role="status">Loading...</p>';
        rpc('player_head_to_head_public', { p_token: tok, p_public_id: pick.getAttribute('data-h2h') }).then(function (h) {
          var out = PlayerHeadToHead.buildCard(h);
          card.innerHTML = out.html || '';
          if (!out.html) failed(card, 'Can’t load this head to head right now. Check your signal and try again.');
        }, function () { failed(card, 'Can’t load this head to head right now. Check your signal and try again.'); });
      }
    };
    if (window.PlayerStreaks) {
      rpc('player_streak_summary', { p_token: tok, p_next_week: 0 }).then(function (j) {
        if (!j || j.ok !== true) return;
        var v = PlayerStreaks.summarize({ streakRun: j.streakWeeks, lastWeek: j.lastWeek, nightsTotal: j.nightsTotal, nextWeek: j.nextWeek });
        $('hStreak').innerHTML = PlayerStreaks.slotHtml(v);
      }, function () { /* streak is optional: nothing shown */ });
    }
    if (window.PlayerStatsBoard) PlayerStatsBoard.mount($('hBoard'), { rpc: rpc, token: tok, tab: 'mine' });
    $('hLog').innerHTML = '<p class="sb-note" role="status">Loading games...</p>';
    rpc('player_game_log', { p_token: tok }).then(function (log) {
      if (!window.PlayerHeadToHead || !log || log.ok !== true) { failed($('hLog'), 'Can’t load your games right now. Check your signal and try again.'); return; }
      $('hLog').innerHTML = PlayerHeadToHead.buildLog(log).html;
    }).catch(function () { failed($('hLog'), 'Can’t load your games right now. Check your signal and try again.'); });
    rpc('player_leaderboard', { p_token: tok, p_board: 'xp', p_limit: 50, p_season: 'all', p_search: null, p_offset: 0 }).then(function (j) {
      if (!window.PlayerHeadToHead || !j || j.ok !== true) { failed($('hH2h'), 'Can’t load the players right now. Check your signal and try again.'); return; }
      $('hH2h').innerHTML = PlayerHeadToHead.pickerHtml(j.rows);
    }).catch(function () { failed($('hH2h'), 'Can’t load the players right now. Check your signal and try again.'); });
  }

  function escText(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Stats tab season picker (P6c): This season, Last season, All time. Each change reloads the board with a 12 s limit.
  var SEASON_CHIPS = [['current', 'This season'], ['last', 'Last season'], ['all', 'All time']];
  function seasonChipsHtml() {
    var on0 = S.season || 'current';
    return '<div class="sb-chips stats-seasons" role="group" aria-label="Choose a season">' + SEASON_CHIPS.map(function (x) {
      var on = x[0] === on0;
      return '<button type="button" class="sb-chip' + (on ? ' is-on' : '') + '" data-season="' + x[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + x[1] + '</button>';
    }).join('') + '</div>';
  }
  function loadSeasonBoard() {
    var LT = window.PlayerLoadTimeout;
    var p = be.leaderboard ? be.leaderboard(readToken(), S.season || 'current') : Promise.resolve({ players: [] });
    S.boardState = 'loading';
    renderStats();
    var work = LT ? LT.withTimeout(p, LT.LIMIT, 'board') : p;
    return work.then(function (r) {
      S.seasonBoard = { players: (r && r.players) || [] }; S.boardState = 'ok';
    }, function () { S.boardState = 'error'; }).then(loadLooks);
  }

  // 1st, 2nd, 3rd, 4th ... 11th, 12th, 21st.
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // Stats tab (R62): your card pinned on top (tap it to open Profile), then the season picker and the board.
  function renderStats() {
    var box = $('stats');
    box.onclick = function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-season],[data-act="retry-season"]') : null;
      if (!t) return;
      if (t.hasAttribute('data-season')) {
        var id = t.getAttribute('data-season');
        if (id === (S.season || 'current')) return;
        S.season = id; loadSeasonBoard();
      } else { loadSeasonBoard(); }
    };
    var prog = PlayerXp.progress(myRun());
    var pct = prog.isMax ? 100 : (prog.xpForLevel ? Math.round(prog.xpInLevel / prog.xpForLevel * 100) : 0);
    var toNext = prog.isMax ? 'Max level' : prog.xpToNext + ' XP to Level ' + (prog.level + 1);
    box.innerHTML = '<h1>' + NAMES.board + '</h1>' +
      '<a class="stats-me card" href="#profile" aria-label="Your card. Open your profile">' +
        '<span class="stats-me-name">' + escText(displayName()) + '</span>' +
        '<span class="stats-me-line"><b>Level ' + prog.level + '</b><span class="muted">' + escText(toNext) + '</span></span>' +
        '<span class="stats-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
      '</a>' +
      '<a class="stats-hist btn ghost" href="#stats/history">My stats and history</a>' +
      seasonChipsHtml() +
      '<p class="stats-place muted" id="statsPlace" aria-live="polite"></p>' +
      '<div id="lb"></div>';
    if (S.boardState === 'loading') { $('lb').innerHTML = '<p class="sb-note" role="status">Loading...</p>'; return; }
    if (S.boardState === 'error') {
      $('lb').innerHTML = '<p class="sb-note" role="alert">Can’t load the board right now. Check your signal and try again.</p>' +
        '<button type="button" class="btn ghost" data-act="retry-season">Try again</button>';
      return;
    }
    var mt = myTeamNow();
    Leaderboard.mount($('lb'), leaderboardData(), { meId: S.me ? S.me.id : null, myTeamId: mt ? teamName(mt) : null, sort: 'level',
      valueLabel: 'XP', iconHtml: function (id) { return window.PlayerIconSvg ? window.PlayerIconSvg(id, { size: 36 }) : ''; } });
    // "Your place": the rank the board itself shows on your row (same sort, hidden players counted as the board counts them).
    var mineRank = $('lb').querySelector('.lb-row--me .lb-rank');
    var place = $('statsPlace');
    if (place && S.seasonBoard && S.seasonBoard.players && S.seasonBoard.players.length) {
      place.textContent = mineRank ? 'You are ' + ordinal(Number(mineRank.textContent)) + ' on this board.' : 'You are not on this board yet.';
    }
    // Tap a player row to see their card (overlay; the stats screen underneath stays as it is).
    if (window.PlayerPeek) PlayerPeek.bind($('lb'), { call: function (publicId) { return be.rpc('player_card', { p_token: readToken(), p_public_id: publicId }).then(function (d) { var L = lookOf({ id: publicId, public_id: publicId }); if (d && typeof d === 'object') { d.photo = L.photo; d.phIcon = L.icon; } return d; }); } });
    if (!(S.seasonBoard && S.seasonBoard.players && S.seasonBoard.players.length)) {
      $('lb').insertAdjacentHTML('afterbegin', '<p class="sb-note">Nobody is on this board for this season yet.</p>');
    }
  }

  // Tab dots (R62): red on Live while a game is on court; yellow on More while skill questions are owed or a payment failed.
  function updateTabDots() {
    var live = document.querySelector('.tabs a[data-tab="live"]');
    var more = document.querySelector('.tabs a[data-tab="more"]');
    if (live) live.classList.toggle('has-dot', !!S.live || !!(feedNow() && feedNow().live));
    if (more) more.classList.toggle('has-dot', S.skillDone === false || !!S.payErr);
    payTopUpdate();
    liveStripUpdate();
  }

  // Home shows at most three cards (R62): the tonight card, the pay card while owed, and the last-night card.
  // The alerts ask and the install card sit below them, and only show while there is room.
  function homeCardCount(d) {
    return 1 + (d.pay && d.pay.amount ? 1 : 0) + (d.lastNight ? 1 : 0);
  }
  function placeHomeExtras() {
    var room = 3 - homeCardCount(homeData(Date.now()));
    var alertsOn = !!S.alertsAsk && room > 0;
    if (alertsOn) room -= 1;
    var installOn = room > 0 && !!S.me && !isInstalled() && !installDismissed();
    var c = $('homeAlerts'); if (c) c.hidden = !alertsOn;
    var inst = $('homeInstall'); if (inst) inst.hidden = !installOn;
  }

  // Weekly rival card on Home (lib/weekly-rival.js). Loads once per week per visit. Hides itself when the server piece
  // (player_week_board, a draft) is missing, or when there is no one to pair with.
  function wornLookId(x) { return typeof x === 'string' ? x : ((x && (x.look || x.id)) || ''); }
  function loadWeeklyRival() {
    var box = $('homeRival');
    var RV = window.PlayerWeeklyRival, LT = window.PlayerLoadTimeout;
    var tok = readToken();
    if (!box || !RV || !S.me || !tok) { if (box) box.hidden = true; return; }
    var week = RV.weekKey(new Date());
    if (S.rivalWeek === week) return;
    S.rivalWeek = week;
    var hide = function () { box.hidden = true; box.innerHTML = ''; };
    var lt = function (p, what) { return LT ? LT.withTimeout(p, LT.LIMIT, what) : p; };
    var board = S.seasonBoard ? Promise.resolve({ ok: true, players: S.seasonBoard.players }) : be.leaderboard(tok, 'current');
    var weekly = be.rpc('player_week_board', { p_token: tok, p_week: week });
    Promise.all([lt(board, 'board'), lt(weekly, 'rival')]).then(function (v) {
      var b = v[0], w = v[1];
      if (!w || w.ok !== true || !w.me || !b || !b.players) { hide(); return; }
      var pts = {};
      (w.rows || []).forEach(function (r) { pts[r.public_id] = Number(r.pts) || 0; });
      if (!(w.me in pts)) { hide(); return; }
      // One measure only: the board's own level and XP for everyone, me included (same data the pairing uses).
      var mine = null;
      b.players.forEach(function (p) { if (p && p.id === w.me) mine = p; });
      if (!mine) { hide(); return; }
      var level = Number(mine.level) || 0;
      var rival = RV.pickRival({ id: w.me }, b.players, week);
      if (!rival) { hide(); return; }
      var d = RV.duel(pts[w.me], pts[rival.id] || 0, level, rival.level);
      var show = function (bonus) {
        var html = RV.buildCard({ week: week,
          me: { name: displayName(), level: level, look: wornLookId(S.shopEquipped) },
          rival: { name: rival.name, level: rival.level, look: wornLookId(rival.look) },
          duel: d, bonus: bonus });
        if (!html) { hide(); return; }
        box.innerHTML = html; box.hidden = false;
      };
      if (!d.bonusXp) { show(null); return; }
      // A win near your level: the server pays the bonus once a week and checks the win itself.
      // Until it answers the card says "on its way". If the claim fails, the bonus line goes and the card stays.
      show('pending');
      be.rpc('player_claim_rival_bonus', { p_token: tok, p_week: week, p_rival: rival.id }).then(function (r) {
        show(r && r.ok === true ? 'added' : null);
      }, function () { show(null); });
    }).catch(hide);
  }

  // Hype taps on Live (lib/hype.js). Buttons and lit tokens show only after the server answers player_hype_rows.
  var hypeLit = {}, hypeLastFetch = 0;
  function hypeRefresh(force) {
    var tok = readToken();
    if (!window.PlayerHype || !tok) { document.body.classList.remove('hype-on'); return; }
    var now = Date.now();
    if (!force && now - hypeLastFetch < 15000) return;
    hypeLastFetch = now;
    be.rpc('player_hype_rows', { p_token: tok, p_night: NIGHT_ID }).then(function (r) {
      if (!r || r.ok !== true) { document.body.classList.remove('hype-on'); hypeLit = {}; return; }
      document.body.classList.add('hype-on');
      hypeLit = PlayerHype.litKeys(r.rows, Date.now());
      PlayerHype.apply(document, hypeLit);
    }, function () { document.body.classList.remove('hype-on'); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-hype-btn]') : null;
    if (!b || !window.PlayerHype) return;
    var key = b.getAttribute('data-hype-btn'), now = Date.now();
    var store = null;
    try { store = window.localStorage; } catch (err) { store = null; }
    var led = PlayerHype.loadLedger(store);
    var gate = PlayerHype.canHype(led, key, now);
    if (!gate.ok) { b.textContent = gate.message; return; }
    b.disabled = true;
    be.rpc('player_hype', { p_token: readToken(), p_night: NIGHT_ID, p_key: key }).then(function (r) {
      b.disabled = false;
      if (r && r.ok === true) { PlayerHype.saveLedger(store, PlayerHype.recordHype(led, key, now)); b.textContent = 'Hyped'; hypeRefresh(true); return; }
      b.textContent = r && r.reason === 'wait' ? PlayerHype.MSG.wait : r && r.reason === 'hourly' ? PlayerHype.MSG.hourly : 'Could not hype. Try again.';
    }, function () { b.disabled = false; b.textContent = 'Could not hype. Try again.'; });
  });

  // Night recap card on Home (lib/night-recap.js). Shows after a played night; Share uses the phone share sheet or saves a picture.
  var recapModelNow = null;
  function renderRecapCard() {
    var box = $('homeRecap');
    var RN = window.PlayerNightRecap;
    if (!box || !RN || !S.me) { if (box) { box.hidden = true; box.innerHTML = ''; } return; }
    var prog = PlayerXp.progress(S.run);
    var pct = prog.isMax ? 100 : (prog.xpForLevel ? Math.round(prog.xpInLevel / prog.xpForLevel * 100) : 0);
    var toNext = prog.isMax ? 'Max level' : prog.xpToNext + ' XP to Level ' + (prog.level + 1);
    recapModelNow = RN.model({ name: displayName(), level: prog.level, levelPct: pct, toNext: toNext,
      look: wornLookId(S.shopEquipped), lastNight: lastNightOf() });
    var html = RN.buildCard(recapModelNow);
    box.innerHTML = html; box.hidden = !html;
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-act="share-recap"]') : null;
    if (!b || !window.PlayerNightRecap || !recapModelNow) return;
    b.disabled = true;
    window.PlayerNightRecap.shareCard(recapModelNow).then(function (res) {
      b.disabled = false;
      b.textContent = res === 'saved' ? 'Picture saved' : res === 'shared' ? 'Shared' : res === 'cancelled' ? 'Share your night' : 'Could not share. Try again.';
    });
  });

  // ---------- routing ----------
  // Four tabs: Home, Live, Stats, More. Profile is a page (opened from Stats and More); Shop is a page too.
  // Old links still work: #profile, #profile/shop, #more/shop, #shop; #live/leaderboard and #more/leaderboard go to #stats.
  function route() {
    if (!S.me) { showLogin(); return; }
    showShell();
    var parts = (location.hash || '#home').slice(1).split('/');
    var head = parts[0], sub = parts[1] || '';
    if (sub === 'leaderboard') { location.hash = '#stats'; return; }
    if (head === 'shop') { head = 'more'; sub = 'shop'; }
    var tab = head === 'profile' ? 'profile' : (TABS.indexOf(head) > -1 ? head : 'home');
    if (sub && SUBS.indexOf(sub) < 0) { location.hash = '#' + tab; return; }
    // The screen's script loads first (once), then the same route runs again.
    var needs = (tab === 'stats' || sub === 'history') ? 'stats' : (tab === 'profile' ? 'profile' : '');
    if (needs && !groupDone[needs]) { ensureGroup(needs).then(route); return; }

    if (tab !== 'more' && S.moreScreen) S.moreScreen.reset();
    var viewId = sub ? 'v-sub' : 'v-' + tab;
    if (sub) {
      var back = $('backLink');
      back.setAttribute('href', SUB_PARENT[tab] || '#more');
      back.textContent = 'Back to ' + (TAB_LABEL[tab] || 'More');
    } else if (tab === 'profile') {
      var from = S.from || 'more';
      var pb = $('profBack');
      pb.setAttribute('href', SUB_PARENT[from] || '#more');
      pb.textContent = 'Back to ' + (TAB_LABEL[from] || 'More');
    } else {
      S.from = tab;
    }

    // The tab stays lit while Profile is open from it.
    var lit = tab === 'profile' ? (S.from || 'more') : tab;
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== viewId; });
    document.querySelectorAll('.tabs a').forEach(function (a) {
      if (a.getAttribute('data-tab') === lit) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    updateTabDots();

    if (tab === 'home' && S.home) { S.home.update(homeData(Date.now())); placeHomeExtras(); }
    if (tab === 'home' && !sub) refreshNight();
    if (tab === 'live' && !sub) renderLive();
    var le = document.getElementById('liveFeedErr');
    if (le && tab !== 'live') le.hidden = true;
    if (tab === 'stats' && !sub) loadSeasonBoard();
    if (tab === 'more' && S.moreScreen && !sub) S.moreScreen.update(moreData());
    if (tab === 'profile' && !sub) renderProfile();
    if (sub) renderSub(sub);
    window.scrollTo(0, 0);
  }

  // ---------- log in and out ----------
  function showErr(msg) {
    var e = $('loginErr');
    e.textContent = msg;
    e.hidden = false;
  }

  // Patch A: the username is kept on this phone too (never the PIN).
  var USERNAME_KEY = '1to1-player-username';
  function savedUsernameHere() { try { return localStorage.getItem(USERNAME_KEY) || ''; } catch (e) { return ''; } }
  function saveUsernameHere(name) { try { localStorage.setItem(USERNAME_KEY, String(name || '')); } catch (e) { /* private window: no memory of it */ } }

  // ---------- More tab (screens/more). The PIN is kept in memory for this session only, never stored. ----------
  function moreData() {
    return {
      me: S.me ? { first: S.me.first, lastInitial: S.me.lastInitial, username: S.username || savedUsernameHere(), nickname: S.nickname || '', teamPref: S.teamPref || 'any' } : null,
      bright: document.documentElement.getAttribute('data-theme') === 'light',
      alertsState: S.alerts || 'off',
      skillDone: S.skillDone === true,
      username: S.username || savedUsernameHere(),
      showMe: S.showMe !== false,
      alertPrefs: S.alertPrefs || {},
      tonight: { nightId: NIGHT_ID, label: 'This run', amount: amountNow(), status: S.claimed ? 'claimed' : 'due' },
      history: [],
      cfg: window.PLAYER_APP_CONFIG || {},
      version: '0.2'
    };
  }

  // ---------- Run alerts (Web Push, migration 43). On by default: asked once after sign-in, then kept saved. ----------
  function saveSub(sub) {
    if (!S.me) return Promise.resolve({ ok: false });
    return be.savePush(readToken(), sub);
  }
  function hideAlertsAsk() { S.alertsAsk = false; placeHomeExtras(); }
  function checkAlerts() {
    if (!window.PlayerPush) return Promise.resolve();
    return PlayerPush.refresh(saveSub).then(function (r) {
      S.alerts = r.state;
      S.alertsAsk = !!r.canAsk;
      placeHomeExtras();
      if (S.moreScreen) S.moreScreen.update(moreData());
    }).catch(function () { /* stays off; nothing breaks */ });
  }

  // Reminder switches (P4): tonight, pay, recap. Created on first use.
  var remCtl = null;
  function readyReg() {
    return Promise.race([navigator.serviceWorker.ready, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 4000); })]);
  }
  function reminderController() {
    if (remCtl || !window.PlayerReminders) return remCtl;
    remCtl = PlayerReminders.create({
      env: { pushSupported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
        isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent),
        isStandalone: !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true) },
      permission: function () { return Notification.permission; },
      requestPermission: function () { return Notification.requestPermission(); },
      getSubscription: function () { return readyReg().then(function (r) { return r.pushManager.getSubscription(); }); },
      subscribe: function () {
        return readyReg().then(function (r) { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: PlayerPush.b64ToBytes(PLAYER_APP_CONFIG.vapidPublicKey) }); })
          .then(function (s) { return s.toJSON(); });
      },
      save: function (sub, kinds) { return be.pushSave(readToken(), sub, kinds); },
      remove: function (endpoint) { return be.pushRemove(readToken(), endpoint); }
    });
    return remCtl;
  }
  // After sign-in: set the three switches from what the server has saved for this phone.
  function hydrateReminders() {
    var c = reminderController();
    if (!c || !S.me || !window.PlayerPush) return;
    readyReg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return null;
      return be.pushStatus(readToken(), sub.endpoint);
    }).then(function (st) {
      if (st) c.hydrate((st && st.kinds) || []);
    }).catch(function () {});
  }

  var moreHandlers = {
    // More > Reminders: the three switches are drawn into the panel box.
    reminders: function (box) { if (window.PlayerReminders && box) PlayerReminders.render(box, reminderController(), function () {}); },
    // Bring a friend (P8): the player's own code and link, shown inside the More invite panel.
    invite: function (box) { loadInviteInto(box); },
    // Badges and milestones (P7): the server board. No token, no board.
    badges: function () {
      if (!S.me || !be.achievements) return Promise.resolve({ ok: false });
      return (window.PlayerLoadTimeout ? PlayerLoadTimeout.withTimeout(be.achievements(readToken())) : be.achievements(readToken()));
    },
    setShowMe: function (on) {
      if (!S.me) return Promise.resolve({ ok: false });
      return be.setVisible(readToken(), on).then(function (r) {
        if (r && r.ok) S.showMe = !!on;
        return { ok: !!(r && r.ok) };
      }, function () { return { ok: false }; });
    },
    sendTestAlert: function () {
      if (!S.me) return Promise.resolve({ ok: false, reason: 'signed-out' });
      return be.sendTestAlert(readToken()).then(function (r) {
        return (r && r.ok) ? { ok: true } : { ok: false, reason: (r && r.reason) || 'error' };
      }, function () { return { ok: false, reason: 'error' }; });
    },
    // r196j: Pay by card. The Pay box asks for the Square link and polls the paid check through these.
    payLink: function (token, nightId) {
      if (!S.me || !be.payLink) return Promise.resolve({ ok: false, reason: 'signed-out' });
      return be.payLink(readToken(), nightId).then(function (r) { return r || { ok: false, reason: 'error' }; }, function () { return { ok: false, reason: 'error' }; });
    },
    paymentStatus: function (token, nightId) {
      if (!S.me || !be.paymentStatus) return Promise.resolve({ ok: false, reason: 'signed-out' });
      return be.paymentStatus(readToken(), nightId).then(function (r) { return r || { ok: false }; }, function () { return { ok: false }; });
    },
    claimPaid: function (nightId) {
      // The sign-in token (not the PIN) is what the server checks. It is read from this phone, as on sign-in.
      if (!S.me) return Promise.resolve({ ok: false, reason: 'signed-out' });
      return be.claimPaid(readToken(), nightId).then(function (r) {
        if (r && r.ok) { S.claimed = true; rememberClaim(true); }
        if (S.moreScreen) S.moreScreen.update(moreData());
        return r;
      });
    },
    // Gap 4 (72v): saved to the online database (player_save_profile, migration-56). If that function is not there yet,
    // the answer is still memory-only and no error is shown, as before.
    saveProfile: function (next) {
      S.nickname = next.nickname;
      S.teamPref = next.teamPref;
      // r8: "Saved." only when the server says ok. No sign-in, no signal or any other failure is reported as a failure.
      if (!be.rpc) return Promise.resolve({ ok: true });   // test (mock) backend only: kept in memory
      var t = readToken();
      if (!t) return Promise.resolve({ ok: false, reason: 'signin' });
      return be.rpc('player_save_profile', { p_token: t, p_nickname: next.nickname || '', p_team_pref: next.teamPref || 'any' }).then(function (r) {
        if (r && r.ok === true) return { ok: true };
        return { ok: false, reason: (r && r.reason) || 'error' };
      }, function () { return { ok: false, reason: 'error' }; });
    },
    setBright: function (on) { var v = on ? 'light' : 'dark'; applyTheme(v); saveTheme(v); },
    // Run alerts: there is no off switch in the app. This only turns them on (asks the phone for permission).
    enableAlerts: function () {
      return PlayerPush.enable(saveSub).then(function (r) {
        S.alerts = r.state;
        if (r.ok) hideAlertsAsk();
        if (S.moreScreen) S.moreScreen.update(moreData());
        return r;
      });
    },
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

  function startApp(player, pin) {
    // Patch F: the saved character comes back with the player record (or the card is blank after a restart).
    if (player && /^[aiv]\d{2,3}$/.test(String(player.icon || ''))) charState.current = String(player.icon);
    resetUpcoming();
    S.me = { id: player.id, first: player.first, lastInitial: player.lastInitial, status: player.status, level: player.level, xpLevel: player.xpLevel };
    S.pin = pin;
    hydrateReminders();
    checkJoinState();   // this phone's remembered join, checked with the server now that the player is known
    // Does this phone still owe the skill questions? Drives the yellow warning under Settings.
    be.skillStatus(readToken()).then(function (r) {
      S.skillDone = !!(r && r.ok && r.done);
      if (S.moreScreen) S.moreScreen.update(moreData());
    }).catch(function () { /* stays owed; the warning shows until the next start */ });
    S.run = myRun();
    ensureShop().load().catch(function () { /* the shop shows its own error when opened; a failed startup read is not fatal */ });
    loadRsvp();
    loadProfileStats();
    loadBoard();
    // P5b: recap and MVP vote on Home. Reads through be.rpc (live names only), 12 s timeout inside the loader.
    if (window.PlayerRecapBox && $('recapBox') && !S.recapBox) {
      try {
        S.recapBox = PlayerRecapBox.mount($('recapBox'), {
          rpc: function (n, b) { return be.rpc ? be.rpc(n, b) : Promise.resolve({ ok: false }); },
          token: readToken(),
          storage: window.localStorage,
          now: Date.now()
        });
      } catch (e) { /* the recap card is optional: the rest of Home still loads */ }
    }
    checkAlerts();
    loadWeeklyRival();
    renderRecapCard();
    if (!S.home) {
      ensureShop().load().catch(function () { /* offline: Home shows the plain card */ });
      S.home = PlayerHome.mount($('home'), homeData(Date.now()), {
        card: function () { location.hash = '#profile'; },
        live: function () { location.hash = '#live'; },
        night: function () { location.hash = '#live'; },
        shop: function () { location.hash = '#profile/shop'; },
        lineup: openLineup,
        paid: claimFromHome,
        cardpay: function (a) { rememberCard(true); if (a && a.href) window.open(a.href, '_blank', 'noopener'); if (S.home) S.home.update(homeData(Date.now())); payTopUpdate(); },
        rsvp: function (state) {
          var t = readToken();
          return be.rsvpSet(t, NIGHT_ID, state).then(function (r) {
            S.rsvpError = !(r && r.ok === true);
            return be.rsvpList(t, NIGHT_ID);
          }).then(function (r) {
            S.rsvp = r || { ok: false, reason: 'error' };
            if (S.home) S.home.update(homeData(Date.now()));
          }).catch(function () {
            S.rsvpError = true;
            if (S.home) S.home.update(homeData(Date.now()));
          });
        },
        join: function (code) {
          var t = readToken();
          if (!t) return Promise.resolve({ ok: false, reason: 'signin' });
          return be.checkIn(t, NIGHT_ID, code).then(function (r) {
            if (r && r.ok === true) {
              S.checkedIn = true;
              payTopUpdate();
              // Store the code time with the record, so a later code (a new run start or a new code) shows the keypad again.
              be.runStatus(readToken(), NIGHT_ID).then(function (s) {
                rememberCheckedIn(true, s && s.ok && s.state === 'open' ? s.codeMadeAt : '');
                checkJoinState();
              }, function () { rememberCheckedIn(true, ''); checkJoinState(); });
            }
            return r;
          });
        },
        signin: function () { showLogin(); }
      });
    }
    if (!S.moreScreen) S.moreScreen = PlayerMore.mount($('more'), moreData(), moreHandlers);
    if (S.reveal) S.reveal.stop();
    if (typeof LineupReveal !== 'undefined') {
      S.reveal = LineupReveal.watch({ backend: be, nightId: NIGHT_ID, me: { first: S.me.first, lastInitial: S.me.lastInitial } });
    }
    scheduleLive();
    pollLive();
    // First-minute screens: shown once, on the first signed-in open after a sign-up on this phone.
    if (window.PlayerOnboarding && PlayerOnboarding.shouldShow(localStorage)) {
      var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
      PlayerOnboarding.open(document.body, { ua: navigator.userAgent, standalone: standalone, storage: localStorage, onDone: function () {} });
    }
    if (!location.hash) history.replaceState(null, '', '#home');
    route();
    updateTabDots();
    prefetchGroups();
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
      // A manual log in means this phone is set up: the first-minute screens never show again.
      if (window.PlayerOnboarding) PlayerOnboarding.markDone(localStorage);
      startApp(r.player, pin);
    }).catch(function () {
      showErr('Could not check. Try again.');
    }).then(function () { $('loginBtn').disabled = false; });
  }

  // The join is remembered per phone, per player, per night date and per run start, so a reload does not show the keypad again.
  // A new run start on the same day (the organiser ended and started again) shows the keypad again.
  var CHECKED_KEY = 'cb.checkedIn';
  function runStartNow() {
    return String((S.night && (S.night.start || (S.night.run && S.night.run.startTime))) || '');
  }
  var memChecked = null;   // the same record, kept in memory for phones where storage is blocked
  function matchesNight(v) {
    return !!(v && S.me && S.night && v.date === S.night.date && v.who === fullName() && v.start === runStartNow() && (v.run || '') === runKeyNow());
  }
  function storedRec() {
    try { return JSON.parse(localStorage.getItem(CHECKED_KEY) || 'null'); } catch (e) { return null; }
  }
  // The remembered record for this night, if any (memory first, then storage).
  function localRec() {
    if (matchesNight(memChecked)) return memChecked;
    var v = storedRec();
    return matchesNight(v) ? v : null;
  }
  // serverJoin: null = no server answer yet (or no signal), true/false = the last answer from player_run_status.
  var serverJoin = null;
  function readCheckedIn() {
    if (serverJoin !== null) return serverJoin;
    return !!localRec();
  }
  function runKeyNow() {
    return String((S.night && S.night.run && (S.night.run.id || S.night.run.runId)) || (S.night && S.night.runId) || '');
  }
  function rememberCheckedIn(on, codeMadeAt) {
    memChecked = on && S.me && S.night && S.night.date ? { date: S.night.date, who: fullName(), start: runStartNow(), run: runKeyNow(), codeMadeAt: codeMadeAt || '' } : null;
    serverJoin = null;
    try {
      if (memChecked) localStorage.setItem(CHECKED_KEY, JSON.stringify(memChecked));
      else localStorage.removeItem(CHECKED_KEY);
    } catch (e) { /* storage blocked: the in-memory copy still holds the join */ }
  }

  // Ask the server for this phone's run status (player_run_status) and decide "You're in" only when it is open
  // and the code time matches the remembered one. No answer (no signal): keep the remembered record.
  function checkJoinState() {
    var rec = localRec();
    if (!S.me) { serverJoin = null; if (S.home) S.home.update(homeData(Date.now())); return; }
    var t = readToken();
    be.runStatus(t, NIGHT_ID).then(function (r) {
      // 72i: the server knows the join (the phone was signed out and back in, or the local record is gone).
      if (r && r.ok === true && r.state === 'open' && r.checkedIn === true) {
        if (!localRec() || String(localRec().codeMadeAt || '') !== String(r.codeMadeAt || '')) rememberCheckedIn(true, r.codeMadeAt || '');
        serverJoin = true;
        if (S.home) S.home.update(homeData(Date.now()));
        return;
      }
      if (!localRec()) { if (S.home) S.home.update(homeData(Date.now())); return; }   // nothing remembered and the server does not know a join
      if (r && r.ok === true) {
        if (r.state === 'open' && !rec.codeMadeAt && r.codeMadeAt) {
          // The join went through but its status check failed: adopt the server's code time now.
          rememberCheckedIn(true, r.codeMadeAt);
          serverJoin = true;
        } else if (r.state === 'open' && rec.codeMadeAt && String(r.codeMadeAt) === String(rec.codeMadeAt)) {
          serverJoin = true;
        } else {
          serverJoin = false; rememberCheckedIn(false);
        }
      } else {
        serverJoin = null;   // no signal: the remembered record decides
      }
      if (S.home) S.home.update(homeData(Date.now()));
    }).catch(function () { serverJoin = null; if (S.home) S.home.update(homeData(Date.now())); });
  }

  function logOut() {
    var t = readToken();
    clearToken();
    if (t) be.logout(t).catch(function () { /* the token expires in 90 days anyway */ });
    rememberCheckedIn(false);
    rememberClaim(false);
    S.claimed = false;
    S.checkedIn = false;
    S.me = null;
    resetUpcoming();
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

  // Alert tap (R87 b): the service worker sends the alert's target; the page opens that tab.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (!e.data || e.data.type !== 'alert-tap') return;
      try { var u = new URL(String(e.data.url || 'app.html#home'), location.href); if (u.hash) location.hash = u.hash; } catch (err) { /* bad link: stay here */ }
    });
  }

  // ---------- mock seed (only while backend is 'mock') ----------
  function seedMock() {
    if (kind !== 'mock') return Promise.resolve();
    S.night = NightShape.applyNight(makeNight(Date.now(), false));
    S.live = null;
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
    $('homeInstallNo').addEventListener('click', function () { $('homeInstall').hidden = true; setInstallDismissed(); });
    $('homeAlertsBtn').addEventListener('click', function () {
      if (window.PlayerPush) moreHandlers.enableAlerts();
    });
    $('lPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') logIn(); });
    $('lPin').addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
    window.addEventListener('hashchange', route);
    if (window.PlayerPullRefresh) PlayerPullRefresh.attach({ onRefresh: refreshAll });

    var seeded = seedMock().catch(function () { /* mock only: a failure here still lets the screens show */ });
    // Load tonight's published night (mock or online), then show the log in screen.
    function loadNight() {
      return seeded.then(function () {
        var LT0 = window.PlayerLoadTimeout;
        var pn = be.getNight(NIGHT_ID);
        // 72r4: the next run is its own read with its own limit. It never holds up or fails the night read.
        var nrP = (be.nextRun ? be.nextRun() : Promise.resolve(null)).catch(function () { return null; });
        var nrLimit = new Promise(function (res) { setTimeout(function () { res(null); }, 5000); });
        Promise.race([nrP, nrLimit]).then(function (nr) { S.nextRun = nr || null; if (S.home) S.home.update(homeData(Date.now())); }, function () { S.nextRun = null; });
        return (LT0 ? LT0.withTimeout(pn, LT0.LIMIT, 'night') : pn).then(function (nt) { setHomeError(false); if (nt && nt.payload) { lastNightSig = JSON.stringify(nt.payload); S.night = NightShape.applyNight(nt.payload); checkJoinState(); PlayerLoading.saveLast(nt.payload); if (window.PlayerRunAlerts) PlayerRunAlerts.onNight(S.night); } }).catch(function () { setHomeError(!!S.me); });
      });
    }
    // Resume a 90-day sign-in on this phone (token only, no PIN needed). Otherwise show log in.
    // Gap 5 (72v): a bad signal is not a sign-out. The last player seen on this phone is kept, so a
    // signed-in player on weak signal lands on Home with the "Signal is weak" note, not on the log in form.
    var LAST_PLAYER_KEY = '1to1-player-last';
    function saveLastPlayer(p) { try { localStorage.setItem(LAST_PLAYER_KEY, JSON.stringify(p)); } catch (e) { /* private window: nothing kept */ } }
    function readLastPlayer() { try { return JSON.parse(localStorage.getItem(LAST_PLAYER_KEY) || 'null'); } catch (e) { return null; } }
    function resumeSession() {
      var t = readToken();
      if (!t) return null;
      return be.resume(t).then(function (r) {
        if (r && r.ok) { saveLastPlayer(r.player); startApp(r.player, ''); return true; }
        clearToken();
        return null;
      }, function (e) {
        // Review fix (72z): a server answer with an HTTP error (for example 401) means the sign-in is no good: clear it.
        // Only a network failure (no answer at all) keeps the last player on this phone.
        if (e && /^http-/.test(String(e.message || ''))) { clearToken(); return null; }
        var last = readLastPlayer();
        if (last && last.first) { startApp(last, ''); return true; }
        return null;
      }).catch(function () { return null; });
    }
    // Server check (R75): after 8 s the "Can't reach" card shows with Try again. Resolves once the server answers.
    var reached = PlayerLoading.reach({ task: function () { return loadNight().then(resumeSession); } });
    PlayerLoading.run({
      mapName: '',
      minMs: 900,
      until: reached,
      then: function () {
        reached.then(function () {
          if (!S.me) showLogin();
        });
      }
    });
  }

  // My account: the More panel's buttons open sheets; the forms call the server through be.
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
  wireMyAccount();

  boot();
})();
