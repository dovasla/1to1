/* Night shape (R177): accepts the organiser's real payload, so the player app works with any organiser version.
   The organiser sends players as { name: "Pia L" } only, and games as { id, number, no, next, teams }, sometimes with no startsAt.
   applyNight(night) returns a copy with first, lastInitial on every player and a usable next game. Pure: no DOM, no network.
   Loads in the browser as window.NightShape, and in node via require(). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NightShape = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function str(v) { return v == null ? '' : String(v); }

  // "Pia L" -> { first: 'Pia', lastInitial: 'L' }. "Ana Mary Kowalski" -> first 'Ana Mary', lastInitial 'K'.
  function splitName(name) {
    var parts = str(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: '', lastInitial: '' };
    if (parts.length === 1) return { first: parts[0], lastInitial: '' };
    var last = parts[parts.length - 1];
    return { first: parts.slice(0, -1).join(' '), lastInitial: last.charAt(0).toUpperCase() };
  }

  // Same key for matching a player: ignores case and spaces.
  function playerKey(p) {
    return (str(p && p.first) + str(p && p.lastInitial)).toLowerCase().replace(/\s+/g, '');
  }

  // One answer for "which team am I on": Home, Live and the lineup reveal all use this.
  function memberKey(p) {
    if (!p) return '';
    var n = (str(p.first) || !str(p.name)) ? p : Object.assign({}, p, splitName(p.name));
    return playerKey(n);
  }
  function teamIndexOf(teams, me) {
    var k = memberKey(me);
    if (!k || !Array.isArray(teams)) return -1;
    for (var i = 0; i < teams.length; i++) {
      if ((teams[i].players || []).some(function (p) { return memberKey(p) === k; })) return i;
    }
    return -1;
  }

  function player(p) {
    if (!p) return p;
    var out = Object.assign({}, p);
    if (!str(out.first) && str(out.name)) {
      var s = splitName(out.name);
      out.first = s.first;
      if (!str(out.lastInitial)) out.lastInitial = s.lastInitial;
    }
    return out;
  }

  function validTime(v) {
    if (!v) return false;
    return !isNaN(Date.parse(v));
  }

  function game(g) {
    if (!g) return g;
    var out = Object.assign({}, g);
    if (out.no == null && out.number != null) out.no = out.number;
    out.teams = (out.teams || []).map(function (t) {
      return Object.assign({}, t, { players: (t.players || []).map(player) });
    });
    if (!validTime(out.startsAt)) out.startsAt = null;
    return out;
  }

  // The next game: a game with a valid start time (earliest not yet past), else the one flagged next, else the first with no result.
  function nextGame(games, nowMs) {
    var list = (games || []).filter(Boolean);
    var timed = list.filter(function (g) { return validTime(g.startsAt); })
      .sort(function (a, b) { return Date.parse(a.startsAt) - Date.parse(b.startsAt); });
    if (timed.length) {
      var ahead = timed.filter(function (g) { return Date.parse(g.startsAt) >= nowMs - 60000; });
      if (ahead.length) return ahead[0];
    }
    var flagged = list.filter(function (g) { return g.next === true; })[0];
    if (flagged) return flagged;
    return list.filter(function (g) { return g.result == null && g.status !== 'done'; })[0] || null;
  }

  // The organiser's night, read once. Keeps every other field as it came.
  function applyNight(night) {
    if (!night) return night;
    var out = Object.assign({}, night);
    out.games = (night.games || []).map(game);
    return out;
  }

  // Run start from the night's fields (date + start, London time). NaN if the night has no date or start.
  function londonOffsetMs(utcMs) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asUtc - utcMs;
  }
  function runStartMs(night) {
    var f = night && (night.fields || night);
    var time = f && (f.start || (f.run && f.run.startTime));
    if (!f || !f.date || !time) return NaN;
    var d = String(f.date).split('-').map(Number), t = String(time).split(':').map(Number);
    if (d.length !== 3 || t.length < 2 || [d[0], d[1], d[2], t[0], t[1]].some(isNaN)) return NaN;
    var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1]);
    return guess - londonOffsetMs(guess);
  }

  // The London calendar day (yyyy-mm-dd) of a moment.
  function londonDayKey(ms) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  // R178: a run is on from the run alone, never from games or game times. Status live, or the run's date is today
  // (London) and the run has not ended. Works with zero games.
  function runOn(night, nowMs) {
    var f = night && (night.fields || night);
    if (!f || f.cancelled === true) return false;
    var status = String((f.run && f.run.status) || '');
    if (status === 'live') return true;
    if (status === 'ended' || status === 'cancelled' || status === 'called-off') return false;
    return !!f.date && String(f.date) === londonDayKey(nowMs);
  }

  // Who plays whom in a game, for one player.
  // In the game: vs = the other team's name. Not in it, teams published: versus = "A v B" from the first two named teams.
  // Teams not published yet (fewer than two teams with a name and a player): unknown = true, nothing to show.
  function publishedTeams(teams) {
    return (teams || []).filter(function (t) { return t && t.name && Array.isArray(t.players) && t.players.length > 0; });
  }
  function rowLabel(game, me) {
    var teams = (game && Array.isArray(game.teams)) ? game.teams : [];
    var i = teamIndexOf(teams, me);
    if (i >= 0) {
      var other = teams.filter(function (t, j) { return j !== i; })[0];
      return { mine: true, unknown: false, vs: other && other.name ? String(other.name) : 'TBC', versus: null };
    }
    var named = publishedTeams(teams);
    if (named.length >= 2) return { mine: false, unknown: false, vs: null, versus: String(named[0].name) + ' v ' + String(named[1].name) };
    return { mine: false, unknown: true, vs: null, versus: null };
  }
  // The Home next card fields. notIn only when teams are published and I am in none.
  function cardFor(game, games, me) {
    var lab = rowLabel(game, me);
    var later = (lab.mine || lab.unknown) ? null : playsLater(games, game, me);
    return { vs: lab.vs, versus: lab.versus, notIn: !lab.mine && !lab.unknown, playsIn: later };
  }
  // The Live "Next up" line: the opponent when I am in the game, the matchup when I am not, nothing while teams are unknown.
  function nextUpFor(game, me) {
    var lab = rowLabel(game, me);
    if (lab.mine) return { team: lab.vs };
    return lab.versus ? { versus: lab.versus } : null;
  }
  // The number of the next game in list order where I am on a team, after `game`. Null when there is none.
  function playsLater(games, game, me) {
    var list = Array.isArray(games) ? games : [];
    var at = -1;
    for (var k = 0; k < list.length; k++) { if (list[k] && game && list[k].no === game.no) { at = k; break; } }
    for (var j = at + 1; j < list.length; j++) {
      if (teamIndexOf((list[j] && list[j].teams) || [], me) >= 0) return list[j].no;
    }
    return null;
  }

  return { rowLabel: rowLabel, cardFor: cardFor, nextUpFor: nextUpFor, playsLater: playsLater, splitName: splitName, playerKey: playerKey, memberKey: memberKey, teamIndexOf: teamIndexOf, applyNight: applyNight, nextGame: nextGame, validTime: validTime, runStartMs: runStartMs, runOn: runOn, londonDayKey: londonDayKey };
});
