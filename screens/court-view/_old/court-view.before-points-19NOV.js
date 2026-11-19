/* Player app: court view and the tap card (R64 court, P3 tap). Owner: patch C (Live). Plain JS, no network, read-only.
   Global: window.PlayerCourtView (node: module.exports).
   courtPlayer(p)        -> { name, icon, hidden, pts, fouls, streak, gain }. Hidden or under-18 players show as "Player" with the plain mark, no points, no tap.
   count(v)              -> whole number >= 0, or null when not sent.
   courtModel(now, me)   -> { sides: [ { team, mine, players } x2 ] }, or null when the row has no court marks.
   markScored(now, prev) -> the same now, with gain (points added since prev) on each player who scored. Pure.
   formationFor(i, side) -> { x, y } in % of the court box for player i of a side ('bottom' or 'top').
   courtHtml(now, me)    -> the Court section (2-3 zone pitch, name and points under each token), or '' when there are no marks.
   cardHtml(p)           -> the small card: picture, name, team, points this game (only when sent), See player, Close.
   sheetHtml(p)          -> the player sheet: picture, name, team, points and level (only when sent).
   Player p = { name, icon, team, pts, level }. Every string is escaped. Fouls and streak only show when the feed sends them per player.
   The court is read-only: tokens open the card, nothing is scored from here.
*/
(function (root) {
  'use strict';

  var PLAIN_ICON = 'i01';
  var ICON_RE = /^[aiv]\d{2,3}$/;
  var NAME_MAX = 10;

  // 2-3 zone, in % of the court box. Top side faces the top basket, bottom side is mirrored.
  // Two high on the wings, three under the basket. Players 6+ go in a middle row.
  var SLOTS = [
    { x: 20, y: 34 }, { x: 80, y: 34 },
    { x: 20, y: 12 }, { x: 50, y: 12 }, { x: 80, y: 12 }
  ];

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
    if (!p || p.hidden) return { name: 'Player', icon: PLAIN_ICON, hidden: true, pts: null, fouls: null, streak: null, gain: null, look: null };
    var name = String(p.name || '').trim() || 'Guest';
    var icon = ICON_RE.test(String(p.icon || '')) ? String(p.icon) : PLAIN_ICON;
    // The look from the row (banner, name style, level) when the organiser sent it; else the lineup match (withLooks) fills it.
    var look = p.look || ((p.banner || p.nameStyle || p.level != null) ? lookFrom(p) : null);
    return { name: name, icon: icon, hidden: false, pts: count(p.pts), fouls: count(p.fouls), streak: count(p.streak), gain: count(p.gain), look: look };
  }

  // Looks from the lineup (same public names): level, and what is worn (banner, name style). Court tokens show a worn look, not the full card.
  var NAME_STYLES = { caps: 1, brand: 1, blue: 1, legend: 1, 'tier-bronze': 1, 'tier-ember': 1, 'tier-silver': 1 };
  // Banner strip ids the player app already draws (pn-banner--*). Shop ids like banner-blue map to these.
  var BANNERS = { blue: 1, black: 1, brand: 1, legend: 1, 'tier-bronze': 1, 'tier-ember': 1, 'tier-silver': 1, p1: 1, p2: 1, p3: 1, p4: 1, p5: 1, p6: 1, p7: 1, p8: 1, p9: 1, p10: 1 };
  function bannerClass(v) {
    var b = String(v || '').replace(/^banner-/, '');
    if (b === 'gold') b = 'brand';
    return BANNERS[b] ? b : null;
  }

  function lookFrom(src) {
    var ns = String(src.nameStyle || '').replace(/^name-/, '');
    return {
      id: String(src.look || src.lookId || ''),
      banner: bannerClass(src.banner),
      level: count(src.level),
      worn: !!(src.banner || src.nameStyle || src.callingCard || src.clanTag),
      nameStyle: NAME_STYLES[ns] ? ns : null
    };
  }

  // Adds a look to each visible court player whose name is in the lineup. Pure copy. No lineup, or no match: unchanged.
  function withLooks(now, lineup) {
    if (!now || !now.players || !lineup || !lineup.players) return now;
    var byName = {};
    Object.keys(lineup.players).forEach(function (t) {
      (Array.isArray(lineup.players[t]) ? lineup.players[t] : []).forEach(function (p) { if (p && p.name) byName[p.name] = p; });
    });
    function side(list) {
      return (Array.isArray(list) ? list : []).map(function (p) {
        var src = p && !p.hidden && byName[p.name];
        // A row that already carries the look is not overwritten by the lineup match.
        if (p && (p.banner || p.nameStyle || p.level != null)) return p;
        return src ? Object.assign({}, p, { look: lookFrom(src) }) : p;
      });
    }
    return Object.assign({}, now, { players: { a: side(now.players.a), b: side(now.players.b) } });
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

  // Points added since the last read, per visible player, matched by name within the side.
  // Returns a copy of now with gain set. No previous read, or a new game: nothing lights up.
  function markScored(now, prev) {
    if (!now || !now.players || !prev || !prev.players || prev.game !== now.game) return now;
    function before(list) {
      var m = {};
      (Array.isArray(list) ? list : []).forEach(function (p) { if (p && !p.hidden && p.pts != null) m[p.name] = Number(p.pts); });
      return m;
    }
    var out = { a: [], b: [] };
    ['a', 'b'].forEach(function (k) {
      var was = before(prev.players[k]);
      out[k] = (Array.isArray(now.players[k]) ? now.players[k] : []).map(function (p) {
        if (!p || p.hidden || p.pts == null || was[p.name] == null) return p;
        var gain = Number(p.pts) - was[p.name];
        return gain > 0 ? Object.assign({}, p, { gain: gain }) : p;
      });
    });
    return Object.assign({}, now, { players: out });
  }

  function formationFor(i, side) {
    var pos = i < SLOTS.length ? SLOTS[i] : { x: 20 + ((i - SLOTS.length) % 3) * 30, y: 38 };
    return { x: pos.x, y: side === 'bottom' ? 100 - pos.y : pos.y };
  }

  // What lights up: just scored (points went up), on a streak (3+ in a row), foul trouble (4+ fouls).
  function litOf(p) {
    if (p.hidden) return { cls: '', badge: '' };
    if (p.gain) return { cls: 'is-score', badge: '+' + p.gain };
    if (p.streak != null && p.streak >= 3) return { cls: 'is-streak', badge: '' };
    if (p.fouls != null && p.fouls >= 4) return { cls: 'is-foul', badge: p.fouls + ' FOULS' };
    return { cls: '', badge: '' };
  }

  // Names on the court and cards: first name and last initial, at most 10 characters (L4).
  // The clan tag next to the name (shared look: shop/skill-tree.js fromPublic). Empty when there is none.
  function tagOf(p) {
    if (p && p.hidden) return '';
    var look = root.ShopTree && root.ShopTree.fromPublic ? root.ShopTree.fromPublic(p || {}) : null;
    return (look && look.clanTag) || (p && p.clanTag) || '';
  }
  function tagHtml(p) { var t = tagOf(p); return t ? ' <span class="pn-clan">' + esc(t) + '</span>' : ''; }

  function shownName(name) {
    var PN = root.PlayerName;
    var s = PN && PN.shortName ? PN.shortName(name) : String(name || '');
    return s.length > NAME_MAX ? s.slice(0, NAME_MAX - 1) + '…' : s;
  }

  // Initials for a disc: "Joe P" -> "JP". No name (a guest): "G".
  function initialsOf(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'G';
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  function picHtml(icon, label, big) {
    return '<span class="lv-pic' + (big ? ' cv-pic-lg' : '') + '" data-icon="' + esc(icon || PLAIN_ICON) + '" data-label="' + esc(label) + '"></span>';
  }

  // One token on the pitch (L1 to L8): name plate, score disc (glow clipped to the disc), level plate.
  // A hidden player is a Guest: initials disc, "Guest", and the score. Never the raw word "Player".
  function tokenHtml(p, team, i, side, mine) {
    var pos = formationFor(i, side);
    var lit = litOf(p);
    var look = p.look || null;
    var PN = root.PlayerName;
    var lookId = look && PN && PN.LOOKS && PN.LOOKS.indexOf(look.id) !== -1 ? look.id : '';
    var sideCls = side === 'bottom' ? 'cv-side-a' : 'cv-side-b';
    var cls = 'cv-tk ' + sideCls + (lit.cls ? ' ' + lit.cls : '') + (p.hidden ? ' is-hidden' : '') +
      (look && look.worn ? ' has-look' : '') + (mine ? ' is-team-mine' : '');
    var style = ' style="left:' + pos.x + '%;top:' + pos.y + '%"';
    var badge = '';
    if (lit.cls === 'is-score') badge = '<span class="cv-tk-badge cv-pop ' + (pos.x >= 70 ? 'is-left' : 'is-right') + '">' + esc(lit.badge) + '</span>';
    else if (lit.cls === 'is-foul') badge = '<span class="cv-tk-badge is-foul">' + esc(lit.badge) + '</span>';
    var name = p.hidden ? 'Guest' : shownName(p.name);
    var disc = p.hidden ? initialsOf('') : (p.pts != null ? String(p.pts) : '–');
    var lvl = p.hidden ? '' : ((look && look.level != null) ? 'Lv ' + look.level : '');
    var face = '<span class="cv-plate"><span class="cv-name pl-name' + (lookId ? ' pl-look-' + esc(lookId) : '') + '">' + esc(name) + '</span></span>' +
      '<span class="cv-disc' + (p.hidden ? ' is-guest' : '') + (lookId ? ' pl-look-' + esc(lookId) : '') + '">' +
        '<span class="pl-ring" aria-hidden="true"></span><span class="pl-flame" aria-hidden="true"></span>' +
        '<span class="cv-disc-num pl-score">' + esc(disc) + '</span></span>' +
      (lvl ? '<span class="cv-plate cv-lv pl-level">' + esc(lvl) + '</span>' : '');
    if (p.hidden) return '<li class="' + cls + '"' + style + '>' + badge + '<span class="cv-tk-face" aria-label="Guest">' + face + '</span></li>';
    return '<li class="' + cls + '"' + style + '>' + badge + '<button class="cv-tk-face" type="button" data-player' +
      ' data-name="' + esc(p.name) + '" data-icon="' + esc(p.icon) + '" data-team="' + esc(team) + '" data-side="' + (side === 'bottom' ? 'a' : 'b') + '"' +
      ' data-hk="' + esc(team + '|' + p.name) + '"' +
      (look && look.banner ? ' data-banner="' + esc(look.banner) + '"' : '') +
      (p.pts != null ? ' data-pts="' + esc(p.pts) + '"' : '') +
      (look && look.level != null ? ' data-level="' + esc(look.level) + '"' : '') +
      ' aria-label="' + esc(p.name + (p.pts != null ? ', ' + p.pts + ' points' : '') + (look && look.level != null ? ', level ' + look.level : '')) + '">' + face + '</button></li>';
  }

  // Pitch: a half court at the top, the same half mirrored at the bottom (390 x 640 units, same as the preview).
  var PITCH_SVG = '<svg viewBox="0 0 390 640" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs><g id="cv-half">' +
      '<rect class="cv-paint" x="130" y="12" width="130" height="129"/>' +
      '<g class="cv-lines">' +
        '<rect x="14" y="12" width="362" height="308"/>' +
        '<path d="M130 12 V141 H260 V12"/>' +
        '<path d="M150 141 A45 45 0 0 0 240 141"/>' +
        '<path d="M36 12 V116 A172 172 0 0 0 354 116 V12"/>' +
        '<path d="M179 50 A16 16 0 0 0 211 50"/>' +
        '<path d="M175 30 H215"/>' +
        '<circle cx="195" cy="50" r="9"/>' +
      '</g></g></defs>' +
    '<use href="#cv-half"/>' +
    '<use href="#cv-half" transform="translate(0,640) scale(1,-1)"/>' +
    '<g class="cv-lines"><path d="M14 320 H376"/><circle cx="195" cy="320" r="40"/></g>' +
  '</svg>';

  // L7: last baskets. Team colour dot (no team words), "12s ago" in grey, a new row slides in.
  // The feed has no time per basket, so the time is when this phone first saw it.
  var seenAt = {};
  function historyHtml(list, nowMs) {
    var rows = (Array.isArray(list) ? list : []).filter(function (r) { return r && typeof r === 'object'; }).slice(0, 5);
    if (!rows.length) return '';
    var t = nowMs == null ? Date.now() : nowMs;
    return '<section class="cv-hist" aria-label="Last baskets">' +
      '<h3 class="lv-h3">Last baskets</h3>' +
      '<ol class="cv-hist-list">' + rows.map(function (r, idx) {
        var key = String(r.n) + '|' + r.side + '|' + r.name + '|' + r.pts;
        if (seenAt[key] == null) seenAt[key] = t;
        var secs = Math.max(0, Math.round((t - seenAt[key]) / 1000));
        var ago = secs < 5 ? 'just now' : secs + 's ago';
        return '<li class="cv-hist-row' + (idx === 0 && secs < 4 ? ' is-new' : '') + '">' +
          '<span class="cv-hist-dot cv-hist-dot-' + (r.side === 'b' ? 'b' : 'a') + '" aria-hidden="true"></span>' +
          '<span class="cv-hist-pts">+' + esc(r.pts) + '</span>' +
          '<span class="cv-hist-name">' + esc(shownName(r.name || 'Guest')) + '</span>' +
          '<span class="cv-hist-ago">' + esc(ago) + '</span></li>';
      }).join('') + '</ol></section>';
  }

  function courtHtml(now, me, lineup) {
    now = withLooks(now, lineup);
    var model = courtModel(now, me);
    if (!model) return '';
    // sides[0] is teamA: bottom of the pitch. sides[1] is teamB: top.
    var tokens = model.sides.map(function (s, si) {
      var side = si === 0 ? 'bottom' : 'top';
      return s.players.map(function (p, i) { return tokenHtml(p, s.team, i, side, s.mine); }).join('');
    }).join('');
    var mineTop = model.sides[1].mine, mineBottom = model.sides[0].mine;
    function label(s, where) {
      return '<span class="cv-label is-' + where + '">' + esc(teamWord(s.team)) + (s.mine ? ' · <b class="lv-you">Your team</b>' : '') + '</span>';
    }
    // L6: your team's half gets a 4% yellow tint.
    var tint = (mineTop ? '<span class="cv-tint is-top" aria-hidden="true"></span>' : '') + (mineBottom ? '<span class="cv-tint is-bottom" aria-hidden="true"></span>' : '');
    return '<section class="lv-card lv-court" aria-labelledby="lvCourt">' +
      '<div class="lv-top"><span class="lv-cap">Game ' + esc(now.game) + ' court</span></div>' +
      '<h2 class="lv-h" id="lvCourt">The court</h2>' +
      '<div class="cv-pitch' + (mineBottom || mineTop ? ' has-mine' : '') + '">' +
        PITCH_SVG + tint +
        label(model.sides[1], 'top') + label(model.sides[0], 'bottom') +
        '<ul class="cv-tokens">' + tokens + '</ul>' +
      '</div>' +
      historyHtml(now.history) +
    '</section>';
  }

  // Team colour strip (P2): the worn banner when there is one, else a solid 6px team-colour strip.
  function stripHtml(p) {
    if (p.banner && BANNERS[p.banner]) return '<span class="pn-banner pn-banner--' + p.banner + ' cv-card-band" aria-hidden="true"></span>';
    return '<span class="cv-strip cv-strip-' + (p.side === 'b' ? 'b' : 'a') + '" aria-hidden="true"></span>';
  }

  // P3: three big stats in a row: PTS TONIGHT, LEVEL, WEEK STREAK. The week streak is not in the feed yet: a dash.
  function statsRow(p) {
    function cell(label, value) {
      return '<div class="cv-stat3"><span class="cv-stat3-v">' + esc(value) + '</span><span class="cv-stat3-l">' + esc(label) + '</span></div>';
    }
    return '<div class="cv-stats3">' +
      cell('PTS TONIGHT', p.pts != null ? p.pts : '–') +
      cell('LEVEL', p.level != null ? p.level : '–') +
      cell('WEEK STREAK', p.weekStreak != null ? p.weekStreak : '–') +
    '</div>';
  }

  // Small card, opened by a tap. Its one main action goes to the full sheet.
  function cardHtml(p) {
    p = p || {};
    var who = p.name ? shownName(p.name) : 'Guest';
    return '<div class="cv-sheet cv-card" role="dialog" aria-modal="true" aria-labelledby="cvName">' +
      stripHtml(p) + '<div class="cv-grip" aria-hidden="true"></div>' +
      '<div class="cv-who"><span class="cv-disc-init' + (p.side === 'b' ? ' is-b' : ' is-a') + '" aria-hidden="true">' + esc(initialsOf(p.name)) + '</span>' +
        '<div class="cv-who-text">' + (p.team ? '<p class="cv-cap">' + esc(teamWord(p.team)) + '</p>' : '') +
        '<h2 class="cv-h" id="cvName">' + esc(who) + tagHtml(p) + '</h2></div></div>' +
      statsRow(p) +
      '<div class="cv-actions">' +
        (p.hk && root.PlayerHype ? root.PlayerHype.buttonHtml(p.hk) : '') +
        '<button class="cv-btn cv-btn--main" type="button" data-cv="see">See player</button>' +
        '<button class="cv-btn" type="button" data-cv="close">Close</button>' +
      '</div>' +
    '</div>';
  }

  // Full player sheet, opened from the card (P1 initials disc in team colour, P2 strip, P3 stats row).
  function sheetHtml(p) {
    p = p || {};
    var who = p.name ? shownName(p.name) : 'Guest';
    return '<div class="cv-sheet cv-full" role="dialog" aria-modal="true" aria-labelledby="cvName">' +
      stripHtml(p) +
      '<div class="cv-top"><span class="cv-cap">Player</span>' +
        '<button class="cv-btn cv-btn--small" type="button" data-cv="close">Back</button></div>' +
      '<div class="cv-hero"><span class="cv-disc-init cv-disc-init--big' + (p.side === 'b' ? ' is-b' : ' is-a') + '" aria-hidden="true">' + esc(initialsOf(p.name)) + '</span></div>' +
      '<h2 class="cv-h cv-h--big" id="cvName">' + esc(who) + tagHtml(p) + '</h2>' +
      (p.team ? '<p class="cv-cap">' + esc(teamWord(p.team)) + '</p>' : '') +
      statsRow(p) +
    '</div>';
  }

  var api = {
    PLAIN_ICON: PLAIN_ICON,
    count: count,
    courtPlayer: courtPlayer,
    courtModel: courtModel,
    withLooks: withLooks,
    markScored: markScored,
    formationFor: formationFor,
    litOf: litOf,
    courtHtml: courtHtml,
    cardHtml: cardHtml,
    sheetHtml: sheetHtml
  };
  root.PlayerCourtView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
