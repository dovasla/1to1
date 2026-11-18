/* Night recap card: a shareable picture of your last run, shown on Home.
   model() and buildCard() are pure. drawCard() paints a PNG on a canvas; shareCard() uses the phone share sheet,
   or saves the image when sharing is not there. Browser: window.PlayerNightRecap. Node tests: tests/night-recap.test.js.
   Names and looks go through PlayerName.
*/
(function (root) {
  'use strict';

  var W = 1080, H = 1350;
  var COLORS = { bg: '#0E0E0E', ink: '#F5F5F5', muted: '#9AA0A6', yellow: '#FFD400', blue: '#0A5CFF' };

  function PN() {
    if (root.PlayerName) return root.PlayerName;
    return (typeof require === 'function') ? require('./player-name.js') : null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = Number(v); return isFinite(n) ? Math.max(0, Math.floor(n)) : 0; }

  // o = { name, level, lastNight: { xp, games, wins } or null, levelPct (0-100), toNext (text), look }
  // Returns null when there is no played night (no card).
  function model(o) {
    o = o || {};
    var ln = o.lastNight;
    if (!ln || !(num(ln.games) > 0)) return null;
    var games = num(ln.games), wins = Math.min(num(ln.wins), games);
    var p = PN();
    return {
      name: p ? p.shortName(o.name || 'Player') : String(o.name || 'Player'),
      level: num(o.level),
      xp: num(ln.xp),
      games: games,
      wins: wins,
      losses: games - wins,
      levelPct: Math.min(100, num(o.levelPct)),
      toNext: String(o.toNext || ''),
      look: typeof o.look === 'string' ? o.look : ''
    };
  }

  function shareText(m) {
    return '1TO1 Basketball: ' + m.games + ' ' + (m.games === 1 ? 'game' : 'games') + ', ' + m.wins + ' ' +
      (m.wins === 1 ? 'win' : 'wins') + ', +' + m.xp + ' XP. Level ' + m.level + '.';
  }

  function buildCard(m) {
    if (!m) return '';
    var p = PN();
    var nameHtml = p ? p.name(m.name, m.look) : '<span class="pl-name">' + esc(m.name) + '</span>';
    return '<section class="recap-card card" aria-labelledby="recapH">' +
      '<h2 id="recapH">Last night</h2>' +
      '<div class="recap-who">' + nameHtml + '<span class="recap-lv">Level ' + esc(m.level) + '</span></div>' +
      '<div class="recap-stats">' +
        '<div><b>' + esc(m.xp) + '</b><span>XP earned</span></div>' +
        '<div><b>' + esc(m.wins) + '</b><span>' + (m.wins === 1 ? 'win' : 'wins') + '</span></div>' +
        '<div><b>' + esc(m.games) + '</b><span>' + (m.games === 1 ? 'game' : 'games') + '</span></div>' +
      '</div>' +
      '<div class="recap-bar" role="img" aria-label="Level progress ' + esc(m.levelPct) + ' percent"><i style="width:' + esc(m.levelPct) + '%"></i></div>' +
      (m.toNext ? '<p class="recap-note">' + esc(m.toNext) + '</p>' : '') +
      '<button type="button" class="btn yellow recap-share" data-act="share-recap">Share your night</button>' +
    '</section>';
  }

  // Paints the card as a 1080 x 1350 picture. canvas is any canvas element.
  function drawCard(m, canvas) {
    canvas.width = W; canvas.height = H;
    var g = canvas.getContext('2d');
    g.fillStyle = COLORS.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COLORS.blue; g.fillRect(0, 0, W, 18);
    g.fillStyle = COLORS.yellow; g.font = '700 64px system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText('LAST NIGHT', 80, 150);
    g.fillStyle = COLORS.ink; g.font = '800 120px system-ui, sans-serif';
    g.fillText(m.name, 80, 300);
    g.fillStyle = COLORS.muted; g.font = '500 48px system-ui, sans-serif';
    g.fillText('Level ' + m.level, 80, 370);
    var stats = [[String(m.xp), 'XP earned'], [String(m.wins), m.wins === 1 ? 'win' : 'wins'], [String(m.games), m.games === 1 ? 'game' : 'games']];
    stats.forEach(function (s, i) {
      var x = 80 + i * 320;
      g.fillStyle = COLORS.yellow; g.font = '800 150px system-ui, sans-serif'; g.fillText(s[0], x, 640);
      g.fillStyle = COLORS.muted; g.font = '500 40px system-ui, sans-serif'; g.fillText(s[1], x, 700);
    });
    g.fillStyle = '#222'; g.fillRect(80, 820, W - 160, 40);
    g.fillStyle = COLORS.blue; g.fillRect(80, 820, (W - 160) * m.levelPct / 100, 40);
    g.fillStyle = COLORS.ink; g.font = '500 44px system-ui, sans-serif';
    g.fillText(m.toNext || ('Level ' + m.level), 80, 920);
    g.fillStyle = COLORS.muted; g.font = '400 36px system-ui, sans-serif';
    g.fillText('1TO1 Basketball', 80, H - 80);
    return canvas;
  }

  // Share the picture: the phone share sheet when it can take files, else a PNG download.
  // Returns a promise: 'shared', 'saved', 'cancelled' or 'failed'.
  function shareCard(m, doc) {
    var d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return Promise.resolve('failed');
    var canvas = drawCard(m, d.createElement('canvas'));
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) { resolve('failed'); return; }
        var file = typeof File === 'function' ? new File([blob], '1to1-last-night.png', { type: 'image/png' }) : null;
        var nav = typeof navigator !== 'undefined' ? navigator : null;
        if (file && nav && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
          nav.share({ files: [file], title: '1TO1 Basketball', text: shareText(m) })
            .then(function () { resolve('shared'); }, function (e) { resolve(e && e.name === 'AbortError' ? 'cancelled' : 'failed'); });
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = d.createElement('a');
        a.href = url; a.download = '1to1-last-night.png';
        d.body.appendChild(a); a.click(); d.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve('saved');
      }, 'image/png');
    });
  }

  var api = { model: model, shareText: shareText, buildCard: buildCard, drawCard: drawCard, shareCard: shareCard, W: W, H: H };
  root.PlayerNightRecap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
