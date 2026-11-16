/* Check Ball opening lockup: the K1 loading lockup (brand/check-ball/loading-lockup.svg).
   The SVG carries its own motion; under Reduce motion it shows the final state. Name is read from NAMES. */
(function (root) {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function markup() {
    var names = root.NAMES || { brand: '', tagline: '' };
    return '<div class="cb-lockup">' +
      '<img class="cb-lockup-img" src="brand/check-ball/loading-lockup.svg" alt="' + esc(names.brand + '. ' + names.tagline) + '">' +
    '</div>';
  }
  root.CheckBallLockup = { markup: markup };
})(typeof window !== 'undefined' ? window : globalThis);
