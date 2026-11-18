/* PlayerName: one shared chip for a player's name, level, prestige stars and shop items.
   Used by the player app (leaderboard, schedule, live, reveal, cards) and later by organiser rows.
   Plain JS, no framework, no network. Text is always escaped.
   Spec: revamp/build/player-app-plan/XP-SYSTEM.md section 6. Visuals: lib/player-name.css (owner: prestige and cosmetics).

   Usage:
     PlayerName.html({ name: 'Sam Kowalski', level: 12, stars: 2, banner: 'gold', clanTag: 'NX' })
     PlayerName.el({ name: 'Sam Kowalski', level: 60, stars: 5, size: 'full', callingCard: 'legend' })
     PlayerName.shortName('Sam Kowalski') // "Sam K"

   Rules in this file:
     - 72t: no automatic banner. A player with no shop banner worn shows the plain default card, prestige or not.
     - 72t: the calling card slam-in only plays when a bought calling card is worn. It never forces a look.
     - Stars above 5 show five glyphs and "+N", so long rows stay short.
     - Emblems are CSS only (emblem: 'ring' or 'spark'); emblemSrc still takes a picture URL.
*/
(function (root) {
  'use strict';

  var MAX_LEVEL = 60;
  // Shop and XP docs cap prestige at 5 stars. Banners and demos go to 10 so the look is ready if the cap moves.
  var MAX_STARS = 5;
  var STAR_GLYPHS = 5;
  var EMBLEMS = ['ring', 'spark'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Shop ids are lowercase words only, so they are safe as CSS class names.
  function cid(id) {
    return String(id || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  // Clan tags: 2 to 4 letters or digits, shown in capitals.
  function clanTag(t) {
    var s = String(t || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return s.length >= 2 ? s.slice(0, 4) : '';
  }

  function clampInt(v, lo, hi, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  // Only https, data image or local relative paths. Anything else is dropped.
  function safeUrl(u) {
    var s = String(u || '').trim();
    if (/^https:\/\//i.test(s) || /^data:image\//i.test(s) || /^[a-z0-9_\/.-]+$/i.test(s)) return s;
    return '';
  }

  // "Sam Kowalski" -> "Sam K". One word stays as it is.
  function shortName(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase();
  }

  // Five glyphs at most, then "+N" for the rest.
  function starsHtml(n) {
    var shown = Math.min(n, STAR_GLYPHS);
    var s = '<span class="pn-stars" aria-hidden="true">' + repeat('★', shown) + '</span>';
    if (n > STAR_GLYPHS) s += '<span class="pn-stars-more" aria-hidden="true">+' + (n - STAR_GLYPHS) + '</span>';
    return s;
  }

  // Shop values with no CSS of their own reuse the tier look that already exists (silver, bronze, ember).
  var LOOK_ALIAS = { silver: 'tier-silver', bronze: 'tier-bronze', ember: 'tier-ember' };
  function look(v) { var c = cid(v); return LOOK_ALIAS[c] || c; }

  // Shop looks (12 ids, see looks/looks.js). A player with p.look set gets the look renderer;
  // every other call keeps the old chip exactly as it was (existing callers unchanged).
  var LOOKS = ['heat-orange', 'heat-red', 'heat-ice', 'glow-ember', 'glow-ice', 'glow-violet',
    'fire-on-fire', 'fire-cold-blooded', 'fire-neon', 'inferno', 'gold-crown', 'void-burn'];

  function html(p) {
    p = p || {};
    var mock = !!p.mock;
    // Shop look (12 ids). Keeps the whole chip (stars, clan, level) and adds the look classes.
    var lk = (!mock && LOOKS.indexOf(String(p.look || '')) !== -1) ? String(p.look) : '';
    var size = p.size === 'full' ? 'full' : 'compact';
    // R168: skill reads "Skill N" (levelWord 'Skill '). XP level reads "Level N" on full cards, "Lv N" on small tiles.
    var levelWord = p.levelWord || (size === 'full' ? 'Level ' : 'Lv ');
    var name = shortName(p.name);

    // Mocks and players with no data show the plain name only.
    var level = mock ? 0 : clampInt(p.level, 1, MAX_LEVEL, 0);
    var stars = mock ? 0 : clampInt(p.stars, 0, MAX_STARS, 0);
    var nameStyle = mock ? '' : look(p.nameStyle);
    var clan = mock ? '' : clanTag(p.clanTag);
    var emblemSrc = mock ? '' : safeUrl(p.emblemSrc);
    var emblem = (mock || EMBLEMS.indexOf(cid(p.emblem)) === -1) ? '' : cid(p.emblem);
    var fx = mock ? '' : cid(p.rowEffect);

    // 72t: only a worn shop banner shows. Otherwise the plain default card.
    var banner = mock ? '' : (look(p.banner) || '');

    // Calling card: full card only, so long lists stay calm. It slams in once for level 60 or prestiged players.
    var arrive = !mock && size === 'full' && (level >= MAX_LEVEL || stars >= 1) && !!look(p.callingCard);
    // p.noCall: a screen that already shows the name big (Home hero) turns the calling card off, so the name appears once.
    var call = (!mock && size === 'full' && !p.noCall) ? (look(p.callingCard) || '') : '';

    var cls = ['pn', 'pn--' + size];
    if (p.tap) cls.push('pn--tap');
    if (banner) cls.push('pn--has-banner');
    if (fx) cls.push('pn-fx--' + fx);
    if (mock) cls.push('pn--mock');
    if (lk) cls.push('pl-look-' + lk);
    // Stage 2 (card builder): every other worn layer gets its own class, e.g. pn-l-frame-electric.
    var LAYER_KEYS = ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'flourish', 'row', 'ring', 'intro', 'pop'];
    var lay = (!mock && p.layers && typeof p.layers === 'object') ? p.layers : {};
    LAYER_KEYS.forEach(function (k) { var v = cid(lay[k]); if (v) cls.push('pn-l-' + k + '-' + v); });

    var label = name;
    if (level) label += ', level ' + level;
    if (stars) label += ', ' + stars + (stars === 1 ? ' star' : ' stars');

    var out = '';
    if (lk) out += '<span class="pl-banner" aria-hidden="true"></span><span class="pl-ring" aria-hidden="true"></span><span class="pl-flame" aria-hidden="true"></span>';
    if (banner) out += '<span class="pn-banner pn-banner--' + banner + '" aria-hidden="true"></span>';

    var line = '';
    if (clan) line += '<span class="pn-clan">' + esc(clan) + '</span>';
    line += '<span class="pn-name' + (lk ? ' pl-name pl-look-' + lk : '') + (nameStyle ? ' pn-name--' + nameStyle : '') + '">' + esc(name) + '</span>';
    if (emblem) line += '<span class="pn-emb pn-emb--' + emblem + '" aria-hidden="true"></span>';
    if (emblemSrc) line += '<img class="pn-emb" src="' + esc(emblemSrc) + '" alt="">';
    if (level) {
      // The dot comes from CSS (.pn-lv::before), so it never wraps alone onto a line.
      line += '<span class="pn-lv">' + esc(levelWord) + level + '</span>';
    }
    if (stars) line += starsHtml(stars);
    out += '<span class="pn-line">' + line + '</span>';

    if (call) {
      var stat = (level ? levelWord + level : '') + (stars ? (level ? ' · ' : '') + repeat('★', Math.min(stars, STAR_GLYPHS)) + (stars > STAR_GLYPHS ? ' +' + (stars - STAR_GLYPHS) : '') : '');
      out += '<span class="pn-call pn-call--' + call + (arrive ? ' pn-call--arrive' : '') + '">' +
        '<span class="pn-call-title">' + esc(name) + '</span>' +
        (stat ? '<span class="pn-call-stat">' + esc(stat) + '</span>' : '') +
        '</span>';
    }

    return '<span class="' + cls.join(' ') + '" role="group" aria-label="' + esc(label) + '">' + out + '</span>';
  }

  function repeat(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ch;
    return s;
  }

  function el(p) {
    var t = document.createElement('template');
    t.innerHTML = html(p).trim();
    return t.content.firstElementChild;
  }

  // Just the name, with its look (leaderboard rows, lists). Same as PlayerName.html for the name part.
  function name(n, look) {
    var v = String(look || '');
    var cls = LOOKS.indexOf(v) !== -1 ? ' pl-look-' + v : '';
    return '<span class="pl-name' + cls + '">' + esc(shortName(n)) + '</span>';
  }

  var api = {
    html: html,
    el: el,
    name: name,
    shortName: shortName,
    esc: esc,
    MAX_LEVEL: MAX_LEVEL,
    MAX_STARS: MAX_STARS,
    EMBLEMS: EMBLEMS.slice(),
    LOOKS: LOOKS.slice()
  };

  root.PlayerName = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
