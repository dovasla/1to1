/* Lobby hype reactions (lobby thread). Pure data, no network.
   Row 1: standard emoji. Row 2: custom basketball badges (SVG, yellow / blue / black).
   To add one: push an entry to CUSTOM with a unique id, a label and a small inline SVG (viewBox 0 0 64 40).
   LobbyReactions.all() -> [{ id, kind: 'emoji' | 'badge', label, glyph | svg }]
   LobbyReactions.byId(id) -> the entry or null (the server only stores ids, so unknown ids are ignored).
*/
(function (root) {
  'use strict';

  var EMOJI = [
    { id: 'fire', kind: 'emoji', label: 'Fire', glyph: '🔥' },
    { id: 'down', kind: 'emoji', label: 'Downvote', glyph: '👎' },
    { id: 'angry', kind: 'emoji', label: 'Angry', glyph: '😡' },
    { id: 'laugh', kind: 'emoji', label: 'Laugh', glyph: '😂' },
    { id: 'flex', kind: 'emoji', label: 'Flex', glyph: '💪' }
  ];

  function badge(id, label, inner) {
    return { id: id, kind: 'badge', label: label,
      svg: '<svg viewBox="0 0 64 40" aria-hidden="true" focusable="false">' + inner + '</svg>' };
  }

  var CUSTOM = [
    badge('three', '3', '<rect x="1" y="1" width="62" height="38" rx="8" fill="#0A5CFF"/>' +
      '<text x="32" y="30" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="28" fill="#FFD400">3</text>'),
    badge('splash', 'SPLASH', '<rect x="1" y="1" width="62" height="38" rx="8" fill="#FFD400"/>' +
      '<text x="32" y="28" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="17" fill="#000">SPLASH</text>'),
    badge('brick', 'BRICK', '<rect x="1" y="1" width="62" height="38" rx="8" fill="#000" stroke="#FFD400" stroke-width="2"/>' +
      '<text x="32" y="28" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="17" fill="#FFD400">BRICK</text>'),
    badge('andone', 'AND ONE', '<rect x="1" y="1" width="62" height="38" rx="8" fill="#0A5CFF"/>' +
      '<text x="32" y="28" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="14" fill="#FFD400">AND ONE</text>')
  ];

  var ALL = EMOJI.concat(CUSTOM);

  var api = {
    all: function () { return ALL.slice(); },
    byId: function (id) {
      for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i];
      return null;
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LobbyReactions = api;
})(typeof window !== 'undefined' ? window : globalThis);
