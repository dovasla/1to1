/* Achievements: the badge list (one JS list, one SQL table, same ids) and the badge grid.
   Plain JS, no framework, no network. Badges are worked out on the server (player_achievements / player_achievements_public).
   The phone only draws what the server sends. Text is set with textContent only.
   Spec: revamp/build/player-app-modules/achievements/README.md and HOOKS.md. Pays coins once, no XP. */
(function (root) {
  'use strict';

  // id, title, goal (plain words), coins (paid once), enabled. Keep in step with supabase/migration-16-achievements.sql. Coins are not paid in the app yet (desk R246).
  var ACHIEVEMENTS = [
    { id: 'first-game',    title: 'First game',       goal: 'Play your first run',                     coins: 50,  enabled: true },
    { id: 'first-win',     title: 'First win',        goal: 'Win your first game',                       coins: 50,  enabled: true },
    { id: 'clean-night',   title: 'Clean run',      goal: 'Play a run with no fouls',                coins: 150, enabled: true },
    { id: 'perfect-night', title: 'Perfect run',    goal: 'Win every game in one run (four or more)', coins: 250, enabled: true },
    { id: 'wins-5-night',  title: 'Five in a run',  goal: 'Win 5 games in one run',                  coins: 300, enabled: true },
    { id: 'iron-10',       title: 'Iron 10',          goal: 'Play 10 runs',                            coins: 100, enabled: true },
    { id: 'iron-25',       title: 'Iron 25',          goal: 'Play 25 runs',                            coins: 400, enabled: true },
    { id: 'iron-50',       title: 'Iron 50',          goal: 'Play 50 runs',                            coins: 500, enabled: true },
    { id: 'streak-4',      title: 'Four weeks',       goal: 'Come 4 weeks running',                      coins: 200, enabled: true },
    { id: 'streak-8',      title: 'Eight weeks',      goal: 'Come 8 weeks running',                      coins: 400, enabled: true },
    { id: 'mvp',           title: 'MVP',              goal: 'Win an MVP vote',                           coins: 300, enabled: true },
    { id: 'mvp-2',         title: 'MVP twice',        goal: 'Win two MVP votes',                         coins: 400, enabled: true },
    { id: 'games-50',      title: 'Fifty games',      goal: 'Play 50 games',                             coins: 200, enabled: true },
    { id: 'wins-10',       title: 'Ten wins',         goal: 'Win 10 games',                              coins: 150, enabled: true },
    { id: 'wins-50',       title: 'Fifty wins',       goal: 'Win 50 games',                              coins: 400, enabled: true },
    { id: 'points-50',     title: 'Fifty points',     goal: 'Score 50 points in total',                  coins: 100, enabled: true },
    { id: 'points-200',    title: 'Two hundred',      goal: 'Score 200 points in total',                 coins: 300, enabled: true },
    { id: 'level-10',      title: 'Level 10',         goal: 'Reach level 10',                            coins: 100, enabled: true },
    { id: 'ten-point',     title: 'Ten-point game',   goal: 'Score 10 points in one game',               coins: 100, enabled: false },
    { id: 'season-top3',   title: 'Season top three', goal: 'Finish in the top three this season',       coins: 500, enabled: false }
  ];

  var BY_ID = {};
  ACHIEVEMENTS.forEach(function (a) { BY_ID[a.id] = a; });

  // Progress words for a locked badge: "4 of 10 nights" style is kept to plain numbers.
  function progressText(b) {
    if (!b || b.earned) return '';
    var need = Number(b.need) || 0;
    var have = Math.min(Number(b.have) || 0, need);
    return have + ' of ' + need;
  }

  // Merge the server board (player_achievements) with the list. Switched-off badges never show.
  // Server rows win for progress and earned; the list supplies the words if the server sends none.
  function merge(board) {
    var rows = [];
    var seen = {};
    (board || []).forEach(function (b) {
      var a = BY_ID[b.id];
      if (!a || !a.enabled) return;
      seen[b.id] = true;
      rows.push({
        id: b.id,
        title: b.title || a.title,
        goal: b.goal || a.goal,
        coins: Number(b.coins != null ? b.coins : a.coins),
        earned: !!b.earned,
        have: Number(b.have) || 0,
        need: Number(b.need) || 0
      });
    });
    return rows;
  }

  function summary(rows) {
    var earned = rows.filter(function (r) { return r.earned; }).length;
    return { earned: earned, total: rows.length };
  }

  // Draws the grid into el. Uses textContent only. rows come from merge().
  function render(el, rows) {
    if (!el) return;
    el.textContent = '';
    if (!rows || rows.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'ach-empty';
      empty.textContent = 'No badges yet. Play a run to start.';
      el.appendChild(empty);
      return;
    }
    var list = document.createElement('ul');
    list.className = 'ach-grid';
    rows.forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'ach ' + (r.earned ? 'ach--earned' : 'ach--locked');
      li.setAttribute('data-id', r.id);

      var title = document.createElement('span');
      title.className = 'ach-title';
      title.textContent = r.title;
      li.appendChild(title);

      var goal = document.createElement('span');
      goal.className = 'ach-goal';
      goal.textContent = r.earned ? 'Earned' : r.goal;
      li.appendChild(goal);

      // No coin line: badge coins are not paid yet (desk R246). Locked badges show progress only.
      if (!r.earned) {
        var meta = document.createElement('span');
        meta.className = 'ach-meta';
        meta.textContent = progressText(r);
        li.appendChild(meta);
      }

      list.appendChild(li);
    });
    el.appendChild(list);
  }

  var api = {
    ACHIEVEMENTS: ACHIEVEMENTS,
    merge: merge,
    summary: summary,
    progressText: progressText,
    render: render
  };

  root.PlayerAchievements = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
