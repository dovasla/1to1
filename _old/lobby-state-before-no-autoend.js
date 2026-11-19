/* Player lobby: which screen a player sees after the door code. Pure, no network.
   Owner: lobby thread. Node tests: tests/lobby-state.test.js
   Flow: lobby (before publish) -> Publish teams (also starts the run) -> team reveal -> live run.
   Anyone who joins after publish skips the lobby and the reveal (the client sets seenTeamsVersion on join).
   lobbyState({ joined, feed, nowMs, updatedMs, seenTeamsVersion, myId }) -> one of:
     'lobby'        not started yet
     'reveal'       run started, teams published, this player has not seen this teams version, and is in a team
     'live'         run started (or a game is on), nothing new to reveal
     'reconnecting' organiser silent for 5 min while running
     'over'         run ended, or silent for 10 min
   feed = the organiser's live row payload (state, teamsVersion, teams), or null.
*/
(function (root) {
  'use strict';

  var LIVE_STATES = ['started', 'between', 'live', 'paused', 'full-time'];

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // The team the player is in, from the feed. Null when none.
  function myTeam(feed, myId) {
    if (!feed || !feed.teams || !myId) return null;
    for (var i = 0; i < feed.teams.length; i++) {
      var t = feed.teams[i];
      if (t && Array.isArray(t.members) && t.members.indexOf(myId) !== -1) return t;
    }
    return null;
  }

  function lobbyState(input) {
    var feed = input.feed || null;
    if (!input.joined) return 'lobby';
    var running = !!(feed && LIVE_STATES.indexOf(feed.state) !== -1);
    var silentMs = input.nowMs != null && input.updatedMs != null ? Math.max(0, input.nowMs - input.updatedMs) : 0;
    if (feed && feed.state === 'finished') return 'over';
    if (running && silentMs >= 10 * 60 * 1000) return 'over';
    if (running && silentMs >= 5 * 60 * 1000) return 'reconnecting';
    if (!running) return 'lobby';
    if (num(feed.teamsVersion) > num(input.seenTeamsVersion) && myTeam(feed, input.myId)) return 'reveal';
    return 'live';
  }

  var api = { lobbyState: lobbyState, myTeam: myTeam, LIVE_STATES: LIVE_STATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerLobbyState = api;
})(typeof window !== 'undefined' ? window : globalThis);
