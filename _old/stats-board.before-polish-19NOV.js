/* Stats and leaderboard screen (player app). Owner: Stats board thread. Plain JS, no framework, reads only.
 * Data: player_profile(p_token) for my numbers, player_leaderboard(p_token, p_board, p_limit) for the board.
 * Global: window.PlayerStatsBoard = { BOARDS, esc, boardLabel, render(view), mount(el, opts) }.
 * Node: module.exports gives the pure parts (tests: node stats-board.test.js).
 * mount(el, { rpc, token, tab, board }): rpc(name, body) returns a Promise (PlayerBackend rpc).
 */
(function (root) {
  'use strict';

  var BOARDS = [
    { id: 'xp', label: 'XP' },
    { id: 'wins', label: 'Wins' },
    { id: 'points', label: 'Points' },
    { id: 'games', label: 'Games' },
    { id: 'mvp', label: 'MVP' }
  ];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) ? Math.round(n) : 0; }

  // Seasons (P6c): same ids and words as the server's p_season and the Stats tab (seasons.js).
  var SEASONS = [
    { id: 'current', label: 'This season' },
    { id: 'last', label: 'Last season' },
    { id: 'all', label: 'All time' }
  ];
  function seasonOf(id) {
    return SEASONS.some(function (x) { return x.id === id; }) ? id : 'current';
  }

  function boardLabel(id) {
    var b = BOARDS.filter(function (x) { return x.id === id; })[0];
    return b ? b.label : 'XP';
  }

  function dateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function statCard(label, value) {
    return '<div class="sb-stat"><div class="sb-big">' + esc(num(value)) + '</div>' +
      '<div class="sb-lbl">' + esc(label) + '</div></div>';
  }

  // My numbers: four big cards and the last nights (player_profile).
  function mineHtml(profile) {
    var t = (profile && profile.totals) || {};
    var nights = (profile && profile.nights) || [];
    var cards = '<div class="sb-stats">' + statCard('Games', t.games) + statCard('Wins', t.wins) +
      statCard('Points', t.points) + statCard('MVP', t.mvp) + '</div>';
    if (!nights.length) {
      return cards + '<p class="sb-note">No runs yet. Your numbers show here once the organiser closes a run.</p>';
    }
    var items = nights.map(function (n) {
      return '<li class="sb-night">' +
        '<span class="sb-date">' + esc(dateLabel(n.night_date)) + '</span>' +
        '<span class="sb-nums">' + esc(num(n.games)) + ' games, ' + esc(num(n.wins)) + ' wins, ' +
          esc(num(n.points)) + ' pts' + (n.mvp ? ', MVP' : '') + '</span>' +
        '<span class="sb-xp">+' + esc(num(n.xp)) + ' XP</span>' +
        '</li>';
    }).join('');
    return cards + '<h2 class="sb-h2">Recent runs</h2><ul class="sb-list">' + items + '</ul>';
  }

  // Leaderboard: chips for the board, then the rows. The caller's row is marked "me".
  function seasonChips(season) {
    return '<div class="sb-chips stats-seasons" role="group" aria-label="Choose a season">' + SEASONS.map(function (x) {
      var on = x.id === season;
      return '<button type="button" class="sb-chip' + (on ? ' is-on' : '') + '" data-season="' + x.id +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(x.label) + '</button>';
    }).join('') + '</div>';
  }

  function boardHtml(board, data, season) {
    var chips = '<div class="sb-chips" role="group" aria-label="Choose a board">' + BOARDS.map(function (b) {
      var on = b.id === board;
      return '<button type="button" class="sb-chip' + (on ? ' is-on' : '') + '" data-board="' + b.id +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(b.label) + '</button>';
    }).join('') + '</div>';
    var rows = (data && data.rows) || [];
    if (!rows.length) {
      return seasonChips(season) + chips + '<p class="sb-note">Nobody is on the ' + esc(boardLabel(board)) +
        ' board yet. Play a run to get on it.</p>';
    }
    var list = '<ol class="sb-board">' + rows.map(function (r) {
      return '<li class="sb-row' + (r.me ? ' is-me' : '') + '">' +
        '<span class="sb-rank">' + esc(num(r.rank)) + '</span>' +
        '<span class="sb-name">' + esc(r.name) + '</span>' +
        '<span class="sb-lvl">Lv ' + esc(num(r.level)) + '</span>' +
        '<span class="sb-val">' + esc(num(r.value)) + '</span>' +
        '</li>';
    }).join('') + '</ol>';
    var me = data && data.me;
    var inList = rows.some(function (r) { return r.me; });
    var foot = (me && !inList) ? '<p class="sb-note">You are number ' + esc(num(me.rank)) + ' with ' +
      esc(num(me.value)) + '.</p>' : '';
    return seasonChips(season) + chips + list + foot;
  }

  function segHtml(id, label, tab) {
    var on = id === tab;
    return '<button type="button" class="sb-seg-btn' + (on ? ' is-on' : '') + '" data-tab="' + id +
      '" role="tab" aria-selected="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }

  // Pure: the whole screen as HTML. view: { tab, board, profile, data, loading, error }.
  function render(view) {
    var v = view || {};
    var tab = v.tab === 'board' ? 'board' : 'mine';
    var body;
    if (v.loading) {
      body = '<p class="sb-note" role="status">Loading...</p>';
    } else if (v.error) {
      body = '<p class="sb-note" role="alert">Can’t load stats right now. Check your signal and try again.</p>' +
        '<button type="button" class="sb-retry" data-act="retry">Try again</button>';
    } else {
      body = tab === 'mine' ? mineHtml(v.profile) : boardHtml(v.board || 'xp', v.data, seasonOf(v.season));
    }
    return '<section class="sb" aria-label="Stats">' +
      '<h1 class="sb-h1">Stats</h1>' +
      '<div class="sb-seg" role="tablist">' + segHtml('mine', 'My stats', tab) + segHtml('board', 'Leaderboard', tab) + '</div>' +
      body + '</section>';
  }

  // Browser only: draws into el and handles taps. Reads only; nothing is written.
  function mount(el, opts) {
    var o = opts || {};
    var st = { tab: o.tab === 'board' ? 'board' : 'mine', board: o.board || 'xp', season: seasonOf(o.season), loading: true, error: false, profile: null, data: null };
    var seq = 0;

    function paint() { el.innerHTML = render(st); }
    function loadBoard() {
      return o.rpc('player_leaderboard', { p_token: o.token, p_board: st.board, p_limit: 20, p_season: st.season }).then(function (j) {
        if (!j || j.ok === false) throw new Error('board');
        st.data = j;
      });
    }
    function loadProfile() {
      return o.rpc('player_profile', { p_token: o.token }).then(function (j) {
        if (!j || j.ok === false) throw new Error('profile');
        st.profile = j;
      });
    }
    function run(work) {
      var mine = ++seq;
      st.loading = true; st.error = false; paint();
      var TO = (typeof PlayerLoadTimeout !== 'undefined') ? PlayerLoadTimeout : null;
      var pending = TO ? TO.withTimeout(work(), o.timeoutMs) : work();
      return pending.then(function () {
        if (mine !== seq) return;
        st.loading = false; paint();
      }, function () {
        if (mine !== seq) return;
        st.loading = false; st.error = true; paint();
      });
    }
    function refresh() { return run(function () { return Promise.all([loadProfile(), loadBoard()]); }); }

    el.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-tab],[data-board],[data-season],[data-act]') : null;
      if (!t) return;
      if (t.hasAttribute('data-act')) { refresh(); return; }
      if (t.hasAttribute('data-tab')) {
        st.tab = t.getAttribute('data-tab') === 'board' ? 'board' : 'mine';
        paint();
        return;
      }
      if (t.hasAttribute('data-season')) {
        var sid = seasonOf(t.getAttribute('data-season'));
        if (sid === st.season && st.data) { paint(); return; }
        st.season = sid;
        run(loadBoard);
        return;
      }
      if (t.hasAttribute('data-board')) {
        var id = t.getAttribute('data-board');
        if (id === st.board && st.data) { paint(); return; }
        st.board = id;
        run(loadBoard);
      }
    });

    paint();
    return refresh();
  }

  var api = { BOARDS: BOARDS, SEASONS: SEASONS, seasonOf: seasonOf, esc: esc, boardLabel: boardLabel, render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerStatsBoard = Object.assign(root.PlayerStatsBoard || {}, api, { mount: mount });
})(typeof window !== 'undefined' ? window : globalThis);
