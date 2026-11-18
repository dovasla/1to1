/* Shop trolley icon: own line-style inline SVG (grid basket, handle, two wheels), accent colour via currentColor.
   Use inside a 44px tap target. Browser: window.PlayerCartIcon.svg(). Node tests: tests/delight-rules.test.js. */
(function (root) {
  'use strict';
  function svg(size) {
    var s = size || 24;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M2 3h3l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h9.6a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>' +
      '<path d="M7.5 10.5h11.8M9 14h9.5M9.8 7v7.5M13.2 7v7.5M16.6 7v7.5"/>' +
      '<circle cx="9.5" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/>' +
      '</svg>';
  }
  var api = { svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerCartIcon = api;
})(typeof window !== 'undefined' ? window : globalThis);
