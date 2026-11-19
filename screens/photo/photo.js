/* Player photo and icon (r7). Browser: window.PlayerPhoto. Node test: photo.test.js.
   - ICONS: 20 Phosphor icons (MIT, copied to icons/phosphor/). Shown as a yellow mask, so they follow the app colours.
   - fitUnderLimit(encodeAt): pure. Tries JPEG qualities until the data URL fits the server limit (60,000 characters).
   - processImage(file): browser only. Crops to a circle, resizes to 256 px, returns a JPEG data URL.
   - render(state): HTML for the block on My Profile. state = { status, icon, note }.
   - bind(box, handlers): wires the file input and the icon buttons. handlers = { onFile(dataUrl), onIcon(id) }.
   Photos are shown to others only after the organiser approves (server rule). Usernames only.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerPhoto = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LIMIT = 60000;      // server: image_data must be 60,000 characters or fewer
  var SIZE = 256;         // px, square, cropped to a circle
  var QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

  var ICONS = [
    { id: 'basketball', name: 'Basketball' }, { id: 'sneaker', name: 'Sneaker' },
    { id: 'sneaker-move', name: 'Sneaker in motion' }, { id: 'person-simple-run', name: 'Runner' },
    { id: 'trophy', name: 'Trophy' }, { id: 'flame', name: 'Flame' }, { id: 'crown', name: 'Crown' },
    { id: 'crown-simple', name: 'Simple crown' }, { id: 'medal', name: 'Medal' },
    { id: 'lightning', name: 'Lightning' }, { id: 'lightning-a', name: 'Lightning bolt' },
    { id: 'rocket', name: 'Rocket' }, { id: 'barbell', name: 'Barbell' }, { id: 'star', name: 'Star' },
    { id: 'fire', name: 'Fire' }, { id: 'target', name: 'Target' }, { id: 'hand-fist', name: 'Fist' },
    { id: 'shooting-star', name: 'Shooting star' }, { id: 'smiley-sticker', name: 'Smiley' },
    { id: 'heart', name: 'Heart' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function iconById(id) {
    for (var i = 0; i < ICONS.length; i++) { if (ICONS[i].id === id) return ICONS[i]; }
    return null;
  }

  // encodeAt(quality) returns a data URL. Returns the first one that fits, or null if none does.
  function fitUnderLimit(encodeAt) {
    for (var i = 0; i < QUALITIES.length; i++) {
      var url = encodeAt(QUALITIES[i]);
      if (url && url.length <= LIMIT) return url;
    }
    return null;
  }

  function processImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('not-image')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          var side = Math.min(img.naturalWidth, img.naturalHeight);
          var sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
          var canvas = document.createElement('canvas');
          canvas.width = SIZE; canvas.height = SIZE;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, SIZE, SIZE);
          ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
          ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
          var url = fitUnderLimit(function (q) { return canvas.toDataURL('image/jpeg', q); });
          if (!url) reject(new Error('too-big')); else resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  var STATUS_TEXT = {
    none: 'Add a photo so the organiser can see you. Photos are checked before other players see them.',
    pending: 'Your photo is waiting for the organiser to check it. Your icon shows until then.',
    approved: 'Your photo is approved. Other players can see it.',
    rejected: 'The organiser did not approve this photo. Your icon is shown. Try another photo.'
  };

  function render(state) {
    var s = state || {};
    var status = STATUS_TEXT[s.status] ? s.status : 'none';
    var cur = iconById(s.icon) ? s.icon : '';
    // An approved photo is one more choice: "My photo" (no icon saved) shows it everywhere the icon shows.
    var hasPhoto = s.status === 'approved' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(String(s.image || ''));
    var photoPick = hasPhoto
      ? '<button type="button" class="ph-pick ph-mine' + (!cur ? ' on' : '') + '" data-ph-icon="" aria-pressed="' + (!cur ? 'true' : 'false') +
        '" aria-label="My photo"><img src="' + s.image + '" alt="" width="40" height="40" style="border-radius:50%;display:block"></button>'
      : '';
    var icons = photoPick + ICONS.map(function (ic) {
      var on = ic.id === cur;
      return '<button type="button" class="ph-pick' + (on ? ' on' : '') + '" data-ph-icon="' + esc(ic.id) +
        '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(ic.name) + '">' +
        '<span class="ph-glyph" style="-webkit-mask-image:url(icons/phosphor/' + esc(ic.id) + '.svg);mask-image:url(icons/phosphor/' + esc(ic.id) + '.svg)"></span></button>';
    }).join('');
    return '<section class="card photo-card" aria-labelledby="phT"><h2 class="cap" id="phT">Your icon</h2>' +
      '<p class="muted" data-ph-status>' + esc(STATUS_TEXT[status]) + '</p>' +
      (/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(String(s.image || '')) ? '<img class="ph-preview" alt="Your photo" src="' + s.image + '" width="96" height="96">' : '') +
      '<label class="btn yellow ph-upload">Add my photo<input type="file" accept="image/*" data-ph-file hidden></label>' +
      '<p class="muted" data-ph-note aria-live="polite">' + esc(s.note || '') + '</p>' +
      '<div class="ph-grid" role="group" aria-label="Pick your icon">' + icons + '</div></section>';
  }

  function bind(box, handlers) {
    var h = handlers || {};
    var file = box.querySelector('[data-ph-file]');
    var note = box.querySelector('[data-ph-note]');
    if (file) {
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        if (note) note.textContent = 'Preparing your photo…';
        processImage(f).then(function (url) {
          if (typeof h.onFile === 'function') h.onFile(url);
        }, function (err) {
          if (note) note.textContent = err && err.message === 'too-big'
            ? 'That photo is too big even when small. Try a simpler photo.'
            : 'That file could not be used. Pick a JPG or PNG photo.';
        });
      });
    }
    box.querySelectorAll('[data-ph-icon]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (typeof h.onIcon === 'function') h.onIcon(b.getAttribute('data-ph-icon'));
      });
    });
  }

  return {
    ICONS: ICONS,
    LIMIT: LIMIT,
    SIZE: SIZE,
    fitUnderLimit: fitUnderLimit,
    processImage: processImage,
    render: render,
    bind: bind,
    iconById: iconById,
    STATUS_TEXT: STATUS_TEXT
  };
});
