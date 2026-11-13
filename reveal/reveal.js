/* Lineup reveal (player app). Read-only: it never changes teams or stats.
   Opens once per game when the organiser publishes the next game with this player in it.
   Data contract: backend.getNight(nightId) -> { payload: { games: [GAME, ...] } }  (see NOTES.md).
   Plays by itself in about 6 seconds. Skip shows the full lineup at once.
   Global: window.LineupReveal = { watch, open, buildLineup, dueGame, summary, TIMING }. Node: module.exports.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LineupReveal = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Timings in ms from the start of the reveal (Fable review, DECISIONS-AND-BRAND.md section 3).
  var TIMING = {
    titleMs: 1200,       // title card alone
    teamStartMs: 1400,   // first teammate
    teamGapMs: 440,      // 320 ms slide, 120 ms apart
    vsMs: 3500,          // VS slam
    oppStartMs: 4000,    // first opponent
    oppGapMs: 380,       // 280 ms slide, 100 ms apart
    settleMs: 4800,      // bench line, Continue fade in
    endMs: 6000,         // reveal finished
    pollMs: 12000        // ask the database every 12 seconds while the app is open
  };
  var SEEN_KEY = '1to1-reveal-seen';
  var memSeen = {};

  function hasDoc() { return typeof document !== 'undefined'; }
  function reduceMotion() {
    return typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function same(a, b) { return !!a && !!b && a.first === b.first && a.lastInitial === b.lastInitial; }
  function nameOf(p) { return ((p.first || '') + ' ' + (p.lastInitial || '')).toUpperCase(); }
  function norm(p, flags) {
    flags = flags || {};
    return {
      first: p.first || '', lastInitial: p.lastInitial || '',
      level: p.level || 1,
      tier: p.tier || '',               // tier word (Rookie, Regular, Veteran). Never the skill title.
      standIn: !!p.standIn, prestige: !!p.prestige,
      stars: p.prestige ? (p.stars || 0) : 0,    // prestige stars only; a level-60 non-prestige shows the level only
      banner: p.prestige ? (p.banner || '') : '', rowEffect: p.prestige ? (p.rowEffect || '') : '',
      nameStyle: p.nameStyle || '', clanTag: p.clanTag || '', emblemSrc: p.emblemSrc || '',
      captain: !!flags.captain, me: !!flags.me
    };
  }

  // Turns one published game into the lineup shown on screen. Returns null if the player is not in it.
  function buildLineup(game, me) {
    if (!game || !Array.isArray(game.teams) || game.teams.length !== 2 || !me) return null;
    var mine = -1;
    game.teams.forEach(function (t, i) {
      if (mine < 0 && (t.players || []).some(function (p) { return same(p, me); })) mine = i;
    });
    if (mine < 0) return null;
    var ours = game.teams[mine];
    var theirs = game.teams[1 - mine];
    function sorted(team, isOurs) {
      // Highest XP level first. Tie break: most lifetime XP (xp field), then A to Z.
      return (team.players || []).slice().sort(function (a, b) {
        return (b.level || 0) - (a.level || 0) || (b.xp || 0) - (a.xp || 0) ||
          nameOf(a).localeCompare(nameOf(b));
      }).map(function (p, i) {
        return norm(p, { captain: isOurs && i === 0, me: isOurs && same(p, me) });
      });
    }
    return {
      id: String(game.id || game.startsAt),
      number: game.number || 0,
      startsAt: game.startsAt,
      mapName: game.mapName || 'Map',
      ours: { name: ours.name || 'Your team', players: sorted(ours, true) },
      theirs: { name: theirs.name || 'Opponents', players: sorted(theirs, false) },
      bench: (game.bench || []).map(function (p) { return norm(p); })
    };
  }

  // Spoken summary for screen readers: "Game 3. You are on Blue with John, Mo, Sam and Zak. Against Red."
  function summary(lineup) {
    var mates = lineup.ours.players.filter(function (p) { return !p.me; }).map(function (p) { return p.first; });
    var list = mates.length > 1 ? mates.slice(0, -1).join(', ') + ' and ' + mates[mates.length - 1] : (mates[0] || '');
    var game = lineup.number ? 'Game ' + lineup.number + '. ' : '';
    return game + 'You are on ' + lineup.ours.name + (list ? ' with ' + list : '') + '. Against ' + lineup.theirs.name + '.';
  }

  // The game the organiser has marked as next, with this player in it, and not shown yet.
  // The clock is not used to trigger. A game that has already started opens with the lineup at once (late: true).
  function dueGame(games, me, seen, nowMs) {
    var list = games || [];
    for (var i = 0; i < list.length; i++) {
      var g = list[i];
      var id = g && (g.id || g.startsAt);
      if (!g || g.next !== true || !id || (seen && seen[id])) continue;
      var lineup = buildLineup(g, me);
      if (!lineup) continue;
      var t = Date.parse(g.startsAt);
      lineup.late = !isNaN(t) && nowMs > t;
      return lineup;
    }
    return null;
  }

  function readSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function seenNow() {
    var s = readSeen();
    Object.keys(memSeen).forEach(function (k) { s[k] = true; });
    return s;
  }
  function markSeen(id) {
    memSeen[id] = true;
    try {
      var s = readSeen();
      s[id] = true;
      localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    } catch (e) { /* private mode: memSeen still stops a repeat this session */ }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function rowEl(p, i, opp) {
    var cls = 'lr-row' + (opp ? ' lr-opp' : '') + (p.me ? ' lr-me' : '') + (p.prestige ? ' lr-prestige' : '');
    var row = el('div', cls);
    row.appendChild(el('span', 'lr-n', String(i + 1)));
    var body = el('div', 'lr-p');
    var chip = el('div', 'lr-chip');
    chip.innerHTML = PlayerName.html({
      name: (p.first || '') + ' ' + (p.lastInitial || ''), level: p.level, stars: p.stars,
      banner: p.banner, nameStyle: p.nameStyle, clanTag: p.clanTag, emblemSrc: p.emblemSrc, rowEffect: p.rowEffect
    });
    body.appendChild(chip);
    var tags = el('div', 'lr-tags');
    if (p.captain) tags.appendChild(el('span', 'lr-tag lr-tag-blue', 'CAPTAIN'));
    if (p.me) tags.appendChild(el('span', 'lr-tag lr-tag-yellow', 'YOU'));
    if (p.standIn) tags.appendChild(el('span', 'lr-tag lr-tag-blue', 'STAND-IN'));
    if (p.tier) tags.appendChild(el('span', 'lr-tier', p.tier));
    if (tags.childNodes.length) body.appendChild(tags);
    row.appendChild(body);
    return row;
  }

  // Shows the reveal over the app. Returns { finish, close }.
  // opts: { skipIntro, reduce, theme, onClose }. skipIntro starts at the team step (the loading screen already ran).
  function open(lineup, opts) {
    opts = opts || {};
    if (!hasDoc()) return null;
    var reduce = reduceMotion() || opts.reduce === true || lineup.late === true;
    var shift = opts.skipIntro ? TIMING.titleMs : 0;
    var prev = document.activeElement;
    var theme = opts.theme || document.documentElement.getAttribute('data-theme') || '';

    var overlay = el('div', 'lr-overlay' + (reduce ? ' lr-instant' : ''));
    if (theme) overlay.setAttribute('data-theme', theme);
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'lr-title');

    var phone = el('div', 'lr-phone');
    var top = el('div', 'lr-top');
    top.appendChild(el('span', null, '1TO1 · TONIGHT'));
    top.appendChild(el('span', null, lineup.number ? 'GAME ' + lineup.number : 'LINEUP'));
    phone.appendChild(top);

    var stage = el('div', 'lr-stage');
    var court = el('div', 'lr-court');
    court.appendChild(el('span', 'lr-map', lineup.mapName.toUpperCase()));
    var side = el('span', 'lr-side', lineup.ours.name.toUpperCase());
    court.appendChild(side);
    stage.appendChild(court);

    var titleText = lineup.mapName.toUpperCase() + (lineup.number ? ' · GAME ' + lineup.number : '');
    var title = el('h1', 'lr-h', titleText);
    title.id = 'lr-title';
    stage.appendChild(title);

    var list = el('div', 'lr-list');
    stage.appendChild(list);

    var status = el('div', 'lr-status');
    status.setAttribute('aria-live', 'polite');
    stage.appendChild(status);
    var sr = el('p', 'lr-sr', summary(lineup));
    stage.appendChild(sr);
    phone.appendChild(stage);

    var foot = el('div', 'lr-foot');
    var bench = el('div', 'lr-bench');
    if (lineup.bench.length) {
      bench.textContent = 'BENCH: ' + lineup.bench.map(function (b) { return nameOf(b) + ' LV ' + b.level; }).join(' · ');
    } else {
      bench.hidden = true;
    }
    foot.appendChild(bench);
    var cont = el('button', 'lr-btn', 'Continue');
    cont.type = 'button';
    cont.hidden = true;
    var skip = el('button', 'lr-skip', 'Skip');
    skip.type = 'button';
    foot.appendChild(cont);
    foot.appendChild(skip);
    phone.appendChild(foot);

    overlay.appendChild(phone);
    document.body.appendChild(overlay);

    var timers = [];
    var done = false;
    var ours = lineup.ours.players;
    var theirs = lineup.theirs.players;

    function setTitle(text) { title.textContent = text; }
    function setStatus(text) { status.textContent = text; }
    function setCourt(name) { side.textContent = name.toUpperCase(); }
    function setCur(row) {
      list.querySelectorAll('.lr-cur').forEach(function (r) { r.classList.remove('lr-cur'); });
      if (row) row.classList.add('lr-cur');
    }
    function at(ms, fn) { timers.push(setTimeout(fn, Math.max(0, ms - shift))); }
    function showEnd() {
      bench.classList.add('lr-in');
      cont.hidden = false;
      setTitle('Ready to play');
      setStatus('');
      done = true;
    }

    // The whole lineup at once: Skip, reduced motion, or a game that has already started.
    function drawAll() {
      list.textContent = '';
      ours.forEach(function (p, i) { var r = rowEl(p, i, false); r.classList.add('in'); list.appendChild(r); });
      var vs = el('div', 'lr-vs in', 'VS');
      list.appendChild(vs);
      theirs.forEach(function (p, i) { var r = rowEl(p, i, true); r.classList.add('in'); list.appendChild(r); });
      setCourt(lineup.theirs.name);
      bench.classList.add('lr-in');
      cont.hidden = false;
      setTitle('Ready to play');
      setStatus('');
      done = true;
    }

    function finish() {
      timers.splice(0).forEach(clearTimeout);
      drawAll();
    }

    function play() {
      var label = ours.length === 5 ? 'Your five' : 'Your team';
      var oppLabel = theirs.length === 5 ? 'Their five' : 'Opponents';
      at(TIMING.titleMs, function () { setTitle(label); });
      ours.forEach(function (p, i) {
        at(TIMING.teamStartMs + i * TIMING.teamGapMs, function () {
          var r = rowEl(p, i, false);
          list.appendChild(r);
          requestAnimationFrame(function () { r.classList.add('in'); });
          setCur(r);
          list.scrollTop = list.scrollHeight;
        });
      });
      at(TIMING.vsMs, function () {
        setCur(null);
        var vs = el('div', 'lr-vs', 'VS');
        list.appendChild(vs);
        requestAnimationFrame(function () { vs.classList.add('in'); });
        setCourt(lineup.theirs.name);
        setTitle(oppLabel);
        list.scrollTop = list.scrollHeight;
      });
      theirs.forEach(function (p, i) {
        at(TIMING.oppStartMs + i * TIMING.oppGapMs, function () {
          var r = rowEl(p, i, true);
          list.appendChild(r);
          requestAnimationFrame(function () { r.classList.add('in'); });
          setCur(r);
          list.scrollTop = list.scrollHeight;
        });
      });
      at(TIMING.settleMs, function () { setCur(null); cont.hidden = false; bench.classList.add('lr-in'); });
      at(TIMING.endMs, showEnd);
    }

    function close() {
      timers.splice(0).forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      try { if (prev && prev.focus) prev.focus(); } catch (e) { /* ignore */ }
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (done) close(); else finish();
    }

    cont.onclick = function () { if (done) close(); else finish(); };
    skip.onclick = finish;
    document.addEventListener('keydown', onKey);

    if (reduce) drawAll(); else play();
    cont.focus();
    return { finish: finish, close: close };
  }

  // Polls the database while the app is open. Opens the reveal once per game.
  // opts: { backend, nightId, me: { first, lastInitial }, pollMs?, open?, onClose?(lineup) }
  function watch(opts) {
    opts = opts || {};
    var be = opts.backend;
    var nightId = opts.nightId || 'tonight';
    var me = opts.me;
    var pollMs = opts.pollMs || TIMING.pollMs;
    var timer = null, stopped = false, showing = false, inFlight = false;
    var show = opts.open || open;

    function schedule() {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(tick, pollMs);
    }
    function tick() {
      if (stopped) return;
      if (showing || inFlight || (hasDoc() && document.hidden)) { schedule(); return; }
      inFlight = true;
      Promise.resolve()
        .then(function () { return be.getNight(nightId); })
        .then(function (nt) {
          var games = nt && nt.payload && nt.payload.games;
          var lineup = dueGame(games, me, seenNow(), Date.now());
          if (!lineup || showing) return;
          showing = true;
          markSeen(lineup.id);
          show(lineup, {
            onClose: function () {
              showing = false;
              if (opts.onClose) opts.onClose(lineup);
            }
          });
        })
        .catch(function () { /* offline or no signal: keep quiet and try again next time */ })
        .then(function () { inFlight = false; schedule(); });
    }
    function onVis() { if (!document.hidden) tick(); }

    if (hasDoc()) document.addEventListener('visibilitychange', onVis);
    tick();
    return {
      stop: function () {
        stopped = true;
        clearTimeout(timer);
        if (hasDoc()) document.removeEventListener('visibilitychange', onVis);
      }
    };
  }

  return { TIMING: TIMING, watch: watch, open: open, buildLineup: buildLineup, dueGame: dueGame, summary: summary };
});
