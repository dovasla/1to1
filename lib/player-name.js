/* PlayerName: one shared chip for a player's name, level, prestige stars and shop items.
   Used by the player app (leaderboard, schedule, live, reveal, cards) and later by organiser rows.
   Plain JS, no framework, no network. Text is always escaped.
   Spec: revamp/build/player-app-plan/XP-SYSTEM.md section 6. Visuals: lib/player-name.css (owner: prestige and cosmetics).

   Usage:
     PlayerName.html({ name: 'Sam Kowalski', level: 12, stars: 2, banner: 'gold', clanTag: 'NX' })
     PlayerName.el({ name: 'Sam Kowalski', level: 60, stars: 5, size: 'full', callingCard: 'legend' })
     PlayerName.shortName('Sam Kowalski') // "Sam K"

   Rules in this file:
     - A prestiged player with no shop banner equipped gets the banner for their star count (p1 to p10).
     - A level 60 or prestiged player gets the calling card slam-in on the full card, once.
     - Stars above 5 show five glyphs and "+N", so long rows stay short.
     - Emblems are CSS only (emblem: 'ring' or 'spark'); emblemSrc still takes a picture URL.
*/
(function (root) {
  'use strict';

  var MAX_LEVEL = 60;
  // Shop and XP docs cap prestige at 5 stars. Banners and demos go to 10 so the look is ready if the cap moves.
  var MAX_STARS = 10;
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

  function html(p) {
    p = p || {};
    var mock = !!p.mock;
    var size = p.size === 'full' ? 'full' : 'compact';
    var name = shortName(p.name);

    // Mocks and players with no data show the plain name only.
    var level = mock ? 0 : clampInt(p.level, 1, MAX_LEVEL, 0);
    var stars = mock ? 0 : clampInt(p.stars, 0, MAX_STARS, 0);
    var nameStyle = mock ? '' : cid(p.nameStyle);
    var clan = mock ? '' : clanTag(p.clanTag);
    var emblemSrc = mock ? '' : safeUrl(p.emblemSrc);
    var emblem = (mock || EMBLEMS.indexOf(cid(p.emblem)) === -1) ? '' : cid(p.emblem);
    var fx = mock ? '' : cid(p.rowEffect);

    // Equipped shop banner first; otherwise the prestige banner for the star count.
    var banner = mock ? '' : (cid(p.banner) || (stars ? 'p' + stars : ''));

    // Calling card: full card only, so long lists stay calm. It slams in once for level 60 or prestiged players.
    var arrive = !mock && size === 'full' && (level >= MAX_LEVEL || stars >= 1);
    // p.noCall: a screen that already shows the name big (Home hero) turns the calling card off, so the name appears once.
    var call = (!mock && size === 'full' && !p.noCall) ? (cid(p.callingCard) || (arrive ? 'std' : '')) : '';

    var cls = ['pn', 'pn--' + size];
    if (p.tap) cls.push('pn--tap');
    if (banner) cls.push('pn--has-banner');
    if (fx) cls.push('pn-fx--' + fx);
    if (mock) cls.push('pn--mock');

    var label = name;
    if (level) label += ', level ' + level;
    if (stars) label += ', ' + stars + (stars === 1 ? ' star' : ' stars');

    var out = '';
    if (banner) out += '<span class="pn-banner pn-banner--' + banner + '" aria-hidden="true"></span>';

    var line = '';
    if (clan) line += '<span class="pn-clan">' + esc(clan) + '</span>';
    line += '<span class="pn-name' + (nameStyle ? ' pn-name--' + nameStyle : '') + '">' + esc(name) + '</span>';
    if (emblem) line += '<span class="pn-emb pn-emb--' + emblem + '" aria-hidden="true"></span>';
    if (emblemSrc) line += '<img class="pn-emb" src="' + esc(emblemSrc) + '" alt="">';
    if (level) {
      // The dot comes from CSS (.pn-lv::before), so it never wraps alone onto a line.
      line += '<span class="pn-lv">Lv ' + level + '</span>';
    }
    if (stars) line += starsHtml(stars);
    out += '<span class="pn-line">' + line + '</span>';

    if (call) {
      var stat = (level ? 'Lv ' + level : '') + (stars ? (level ? ' · ' : '') + repeat('★', Math.min(stars, STAR_GLYPHS)) + (stars > STAR_GLYPHS ? ' +' + (stars - STAR_GLYPHS) : '') : '');
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

  var api = {
    html: html,
    el: el,
    shortName: shortName,
    esc: esc,
    MAX_LEVEL: MAX_LEVEL,
    MAX_STARS: MAX_STARS,
    EMBLEMS: EMBLEMS.slice()
  };

  root.PlayerName = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
