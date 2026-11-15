/* 1TO1 share card (N9). Draws a 1080 x 1350 picture on a canvas in the browser.
   No server, no upload, no network. Only whitelisted fields are read, so phone, PIN,
   email and payment data can never reach the picture even if passed in.
   Usage:
     ShareCard.share({ mode: 'career', name: 'Sam Kowalski', level: 12, stars: 2,
       banner: 'gold', nameStyle: 'caps', numbers: [{ label: 'NIGHTS', value: '12' }] });
     ShareCard.toBlob(data) -> Promise<Blob>   (for previews)
     ShareCard.textList(data) -> strings drawn (for tests)
   share() resolves to 'shared' | 'saved' | 'cancelled' | 'failed'.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShareCard = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 1080, H = 1350;
  var SIGNUP_ADDRESS = 'dovasla.github.io/1to1';
  var MARK = '1TO1';
  var FOOTER = 'PICKUP NIGHT';

  // Banner colours (shop values). Prestige banners p1 to p10 use the gold ramp.
  var BANNERS = {
    blue: ['#0A5CFF', '#0747C2'], silver: ['#C9CED8', '#7D8594'], bronze: ['#C98A52', '#8A5124'],
    gold: ['#FFD21F', '#C99A00'], ember: ['#FF6A2B', '#B53A10'], black: ['#2A2D36', '#0E0E0E'],
    legend: ['#8A5CFF', '#4B2BB0']
  };
  var DEFAULT_BANNER = ['#FFD21F', '#C99A00'];
  var MODES = { career: 'CAREER', recap: 'LAST NIGHT' };
  var MAX_NUMBERS = 4;

  function clean(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function int(v, lo, hi, fb) {
    var n = parseInt(v, 10);
    return isNaN(n) ? fb : Math.min(hi, Math.max(lo, n));
  }
  function bannerKey(b) {
    var k = String(b || '').toLowerCase();
    if (BANNERS[k]) return k;
    var m = /^p(\d{1,2})$/.exec(k); // prestige banner
    return m ? 'gold' : '';
  }

  // Only these fields are read. Anything else in the input is ignored.
  function sanitize(d) {
    d = d || {};
    var mode = MODES[d.mode] ? d.mode : 'career';
    var numbers = (Array.isArray(d.numbers) ? d.numbers : []).slice(0, MAX_NUMBERS).map(function (n) {
      return { label: clean(n && n.label, 14).toUpperCase(), value: clean(n && n.value, 8) };
    }).filter(function (n) { return n.label && n.value; });
    return {
      mode: mode,
      name: clean(d.name, 30) || 'PLAYER',
      level: int(d.level, 1, 60, 1),
      stars: int(d.stars, 0, 10, 0),
      banner: bannerKey(d.banner),
      nameStyle: clean(d.nameStyle, 12).toLowerCase(),
      clanTag: clean(d.clanTag, 4).replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      nightLabel: clean(d.nightLabel, 24),
      numbers: numbers
    };
  }

  function displayName(d) {
    return d.nameStyle === 'caps' || d.nameStyle === 'legend' ? d.name.toUpperCase() : d.name;
  }

  // Every text the picture shows, in drawing order. Tests check this list.
  function textList(data) {
    var d = sanitize(data);
    var out = [MARK, MODES[d.mode], displayName(d), 'LEVEL ' + d.level];
    if (d.clanTag) out.push(d.clanTag);
    if (d.mode === 'recap' && d.nightLabel) out.push(d.nightLabel);
    d.numbers.forEach(function (n) { out.push(n.label, n.value); });
    out.push(FOOTER, 'JOIN AT ' + SIGNUP_ADDRESS.toUpperCase());
    return out;
  }

  // Shrinks the font until the name fits. measure(px, text) returns the width of text at that size.
  // Last resort: cut with an ellipsis, so a long name never runs off the card.
  function fitName(measure, text, maxW, maxPx, minPx) {
    var px = maxPx;
    while (px > minPx && measure(px, text) > maxW) px -= 2;
    var t = text;
    if (measure(px, text) > maxW) {
      while (measure(px, t + '\u2026') > maxW && t.length > 1) t = t.slice(0, -1);
      t = t.replace(/\s+$/, '') + '\u2026';
    }
    return { px: px, text: t };
  }

  // Which share route to take. Pure, so it is tested without a browser.
  function pickAction(env) {
    env = env || {};
    return env.hasShare && env.canShareFiles ? 'share' : 'download';
  }

  function drawStar(ctx, cx, cy, r, color) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.45;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Draws the card. ctx is a 2D canvas context already sized W x H.
  function draw(ctx, data) {
    var d = sanitize(data);
    var col = BANNERS[d.banner] || DEFAULT_BANNER;
    var head = '"Barlow Condensed", Impact, "Arial Narrow", sans-serif';
    var body = 'Barlow, "Segoe UI", Arial, sans-serif';

    // Background and banner band
    ctx.fillStyle = '#0E0E0E';
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, W, 420);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 420);

    // Mark and mode
    ctx.fillStyle = '#FFD21F';
    ctx.font = '700 64px ' + head;
    ctx.textBaseline = 'top';
    ctx.fillText(MARK, 72, 64);
    ctx.fillStyle = d.banner === 'black' ? '#F4F5F7' : '#0E0E0E';
    ctx.font = '700 40px ' + head;
    ctx.textAlign = 'right';
    ctx.fillText(MODES[d.mode], W - 72, 76);
    ctx.textAlign = 'left';

    // Name, fitted
    var nameText = displayName(d);
    var fit = fitName(function (px, txt) {
      ctx.font = '800 ' + px + 'px ' + head;
      return ctx.measureText(txt).width;
    }, nameText, W - 144, 150, 64);
    ctx.font = '800 ' + fit.px + 'px ' + head;
    ctx.fillStyle = d.nameStyle === 'gold' ? '#FFD21F' : '#F4F5F7';
    ctx.fillText(fit.text, 72, 470);

    // Level and stars
    ctx.fillStyle = '#FFD21F';
    ctx.font = '700 40px ' + head;
    ctx.fillText('LEVEL ' + d.level, 72, 640);
    var shown = Math.min(d.stars, 5);
    for (var s = 0; s < shown; s++) drawStar(ctx, 96 + s * 64, 760, 26, '#FFD21F');
    if (d.stars > 5) {
      ctx.fillStyle = '#FFD21F';
      ctx.font = '700 40px ' + head;
      ctx.fillText('+' + (d.stars - 5), 96 + 5 * 64 - 20, 735);
    }
    if (d.clanTag) {
      ctx.fillStyle = '#0A5CFF';
      ctx.fillRect(W - 72 - 160, 640, 160, 64);
      ctx.fillStyle = '#F4F5F7';
      ctx.font = '700 36px ' + head;
      ctx.textAlign = 'center';
      ctx.fillText(d.clanTag, W - 72 - 80, 652);
      ctx.textAlign = 'left';
    }

    // Night label (recap) and numbers
    var y = 860;
    if (d.mode === 'recap' && d.nightLabel) {
      ctx.fillStyle = '#A7ADB8';
      ctx.font = '600 36px ' + body;
      ctx.fillText(d.nightLabel, 72, y);
      y += 60;
    }
    var cols = 2, tileW = (W - 144 - 24) / cols, tileH = 180;
    d.numbers.forEach(function (n, i) {
      var x = 72 + (i % cols) * (tileW + 24);
      var ty = y + Math.floor(i / cols) * (tileH + 24);
      ctx.fillStyle = '#1A1C22';
      ctx.fillRect(x, ty, tileW, tileH);
      ctx.fillStyle = '#A7ADB8';
      ctx.font = '700 30px ' + head;
      ctx.fillText(n.label, x + 24, ty + 24);
      ctx.fillStyle = '#F4F5F7';
      ctx.font = '800 96px ' + head;
      ctx.fillText(n.value, x + 24, ty + 62);
    });

    // Footer
    ctx.fillStyle = '#FFD21F';
    ctx.fillRect(0, H - 150, W, 6);
    ctx.fillStyle = '#F4F5F7';
    ctx.font = '700 44px ' + head;
    ctx.fillText(FOOTER, 72, H - 118);
    ctx.fillStyle = '#A7ADB8';
    ctx.font = '600 36px ' + body;
    ctx.fillText('Join at ' + SIGNUP_ADDRESS, 72, H - 62);
    return ctx;
  }

  function makeCanvas() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  }

  // Loads the brand fonts first, so the picture never uses a fallback font.
  function ready() {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('800 100px "Barlow Condensed"'),
      document.fonts.load('600 36px Barlow')
    ]).catch(function () { /* fallback font is fine */ });
  }

  function toBlob(data) {
    return ready().then(function () {
      var c = makeCanvas();
      draw(c.getContext('2d'), data);
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('no-blob')); }, 'image/png');
      });
    });
  }

  function download(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return 'saved';
  }

  // Opens the share sheet with the picture when the phone can share files. Otherwise saves it.
  function share(data, opts) {
    opts = opts || {};
    var nav = opts.nav || (typeof navigator !== 'undefined' ? navigator : {});
    var d = sanitize(data);
    var fileName = '1to1-' + d.mode + '.png';
    return toBlob(data).then(function (blob) {
      var hasFile = typeof File === 'function';
      var file = hasFile ? new File([blob], fileName, { type: 'image/png' }) : null;
      var canFiles = !!(file && nav.canShare && nav.canShare({ files: [file] }));
      if (pickAction({ hasShare: !!nav.share, canShareFiles: canFiles }) === 'share') {
        return nav.share({ files: [file], title: '1TO1', text: '1TO1 pickup night. Join at ' + SIGNUP_ADDRESS })
          .then(function () { return 'shared'; }, function (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
            return download(blob, fileName);
          });
      }
      return download(blob, fileName);
    }).catch(function () { return 'failed'; });
  }

  return {
    W: W, H: H, SIGNUP_ADDRESS: SIGNUP_ADDRESS,
    sanitize: sanitize, textList: textList, fitName: fitName, pickAction: pickAction,
    draw: draw, toBlob: toBlob, share: share, bannerColours: BANNERS
  };
});
