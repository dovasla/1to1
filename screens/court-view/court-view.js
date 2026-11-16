/* Player app: court view and the tap card (R64 court, P3 tap). Owner: patch C (Live). Plain JS, no network, read-only.
   Global: window.PlayerCourtView (node: module.exports).
   courtPlayer(p)        -> { name, icon, hidden, pts }. Hidden or under-18 players show as "Player" with the plain mark, no points, no tap.
   count(v)              -> whole number >= 0, or null when not sent.
   courtModel(now, me)   -> { sides: [ { team, mine, players } x2 ] }, or null when the row has no court marks.
   courtHtml(now, me)    -> the Court section, or '' when there are no marks.
   cardHtml(p)           -> the small card: picture, name, team, points this game (only when sent), See player, Close.
   sheetHtml(p)          -> the player sheet: picture, name, team, points and level (only when sent).
   Player p = { name, icon, team, pts, level }. Every string is escaped. Nothing here shows fouls or hidden names.
*/
(function (root) {
  'use strict';

  var PLAIN_ICON = 'i01';
  var ICON_RE = /^[aiv]\d{2,3}$/;
  var NAME_MAX = 10;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function teamWord(name) { return String(name == null ? '' : name).toUpperCase(); }

  // Whole number >= 0, or null when the value is not sent.
  function count(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    return isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  // One court player as the view shows it.
  function courtPlayer(p) {
    if (!p || p.hidden) return { name: 'Player', icon: PLAIN_ICON, hidden: true, pts: null };
    var name = String(p.name || '').trim().slice(0, NAME_MAX) || 'Player';
    var icon = ICON_RE.test(String(p.icon || '')) ? String(p.icon) : PLAIN_ICON;
    return { name: name, icon: icon, hidden: false, pts: count(p.pts) };
  }

  // The organiser sends now.players = { a: [...], b: [...] }, a being teamA.
  function courtModel(now, me) {
    var players = now && now.players;
    if (!players || typeof players !== 'object') return null;
    function side(team, list) {
      return { team: String(team || ''), mine: !!me && team === me, players: (Array.isArray(list) ? list : []).map(courtPlayer) };
    }
    return { sides: [side(now.teamA, players.a), side(now.teamB, players.b)] };
  }

  function picHtml(icon, label, big) {
    return '<span class="lv-pic' + (big ? ' cv-pic-lg' : '') + '" data-icon="' + esc(icon || PLAIN_ICON) + '" data-label="' + esc(label) + '"></span>';
  }

  // A tappable tile for a visible player; a hidden player is a plain, non-tappable tile.
  function tileHtml(p, team) {
    var inner = picHtml(p.icon, p.name) + '<span class="lv-pn">' + esc(p.name) + '</span>';
    if (p.hidden) return '<li class="lv-pt cv-pt is-hidden"><span class="cv-static">' + inner + '</span></li>';
    return '<li class="lv-pt cv-pt"><button class="cv-tap" type="button" data-player' +
      ' data-name="' + esc(p.name) + '" data-icon="' + esc(p.icon) + '" data-team="' + esc(team) + '"' +
      (p.pts != null ? ' data-pts="' + esc(p.pts) + '"' : '') + '>' + inner + '</button></li>';
  }

  function sideHtml(s) {
    var tiles = s.players.map(function (p) { return tileHtml(p, s.team); }).join('');
    return '<div class="lv-court-side' + (s.mine ? ' is-mine' : '') + '">' +
      '<h3 class="lv-h3">' + esc(teamWord(s.team)) + (s.mine ? ' <b class="lv-you">Your team</b>' : '') + '</h3>' +
      '<ul class="lv-ptiles">' + (tiles || '<li class="lv-muted">No players on court</li>') + '</ul>' +
    '</div>';
  }

  function courtHtml(now, me) {
    var model = courtModel(now, me);
    if (!model) return '';
    return '<section class="lv-card lv-court" aria-labelledby="lvCourt">' +
      '<div class="lv-top"><span class="lv-cap">Game ' + esc(now.game) + ' court</span></div>' +
      '<h2 class="lv-h" id="lvCourt">The court</h2>' +
      '<div class="lv-court-box">' + model.sides.map(sideHtml).join('') + '</div>' +
      '<p class="lv-muted lv-court-note">Positions are just for show.</p>' +
    '</section>';
  }

  function ptsLine(p) {
    return p.pts != null ? '<p class="cv-line">' + esc(p.pts) + ' ' + (p.pts === 1 ? 'point' : 'points') + ' this game</p>' : '';
  }

  // Small card, opened by a tap. Its one main action goes to the full sheet.
  function cardHtml(p) {
    p = p || {};
    return '<div class="cv-sheet cv-card" role="dialog" aria-modal="true" aria-labelledby="cvName">' +
      '<div class="cv-grip" aria-hidden="true"></div>' +
      '<div class="cv-who">' + picHtml(p.icon, p.name || 'Player', true) +
        '<div class="cv-who-text">' + (p.team ? '<p class="cv-cap">' + esc(teamWord(p.team)) + '</p>' : '') +
        '<h2 class="cv-h" id="cvName">' + esc(p.name || 'Player') + '</h2></div></div>' +
      ptsLine(p) +
      '<div class="cv-actions">' +
        '<button class="cv-btn cv-btn--main" type="button" data-cv="see">See player</button>' +
        '<button class="cv-btn" type="button" data-cv="close">Close</button>' +
      '</div>' +
    '</div>';
  }

  // Full player sheet, opened from the card.
  function sheetHtml(p) {
    p = p || {};
    var rows = '';
    if (p.pts != null) rows += '<div class="cv-stat"><dt>Points this game</dt><dd>' + esc(p.pts) + '</dd></div>';
    if (p.level != null) rows += '<div class="cv-stat"><dt>Level</dt><dd>' + esc(p.level) + '</dd></div>';
    return '<div class="cv-sheet cv-full" role="dialog" aria-modal="true" aria-labelledby="cvName">' +
      '<div class="cv-top"><span class="cv-cap">Player</span>' +
        '<button class="cv-btn cv-btn--small" type="button" data-cv="close">Back</button></div>' +
      '<div class="cv-hero">' + picHtml(p.icon, p.name || 'Player', true) + '</div>' +
      '<h2 class="cv-h cv-h--big" id="cvName">' + esc(p.name || 'Player') + '</h2>' +
      (p.team ? '<p class="cv-cap">' + esc(teamWord(p.team)) + '</p>' : '') +
      (rows ? '<dl class="cv-stats">' + rows + '</dl>' : '<p class="lv-muted">Stats show here when the organiser sends them.</p>') +
    '</div>';
  }

  var api = {
    PLAIN_ICON: PLAIN_ICON,
    count: count,
    courtPlayer: courtPlayer,
    courtModel: courtModel,
    tileHtml: tileHtml,
    courtHtml: courtHtml,
    cardHtml: cardHtml,
    sheetHtml: sheetHtml
  };
  root.PlayerCourtView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
