/* Clan tag check for the player app (pure, no DOM, no storage).
   Works in the browser (window.ClanTag) and in Node (tests).

   Rules:
   - 2 to 4 characters, letters and numbers only. Case does not matter (TONE = tone).
   - Blocked if it is a swear or cuss word, including letter swaps (0 = o, 1 = i or l, 3 = e, 4 = a,
     5 = s, @ = a, $ = s) and repeated-letter padding (aa, sss...).
   - validateClanTag(text) returns { ok, reason, tag }. tag is the upper-case version when ok.
   - The server must run the same rules (see the clan_tag checks in revamp/battle-18nov/PHASE3-SQL-REVIEW-19NOV.sql).
     Keep BLOCKED_WORDS in step with the tag_blocklist table.
   - Matching: words of 3 letters or fewer must match the whole tag. Longer words are blocked when they
     appear anywhere in the tag. (So BASS is fine, ASS is not.)
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClanTag = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_LENGTH = 2;
  var MAX_LENGTH = 4;

  // Plain-English list of blocked words, lower case, letters only. Easy to read and edit.
  // Add a word here AND to the tag_blocklist table on the server.
  var BLOCKED_WORDS = [
    'ass', 'arse', 'tit', 'tits', 'cum', 'fag', 'fags',
    'fuck', 'fucker', 'shit', 'bitch', 'bastard', 'cunt', 'dick', 'cock', 'pussy',
    'piss', 'slut', 'whore', 'twat', 'wank', 'prick', 'dyke', 'nigger', 'nigga',
    'retard', 'spic', 'kike', 'nazi', 'bollocks', 'rape'
  ];

  // Letter swaps. '1' can stand for i or l, so both are tried.
  var SWAPS = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '@': 'a', '$': 's' };

  // The tag as typed, plus the swaps undone (1 as i, and 1 as l).
  function spellings(text) {
    var lower = String(text).toLowerCase();
    var asI = '';
    var asL = '';
    for (var i = 0; i < lower.length; i++) {
      var ch = lower.charAt(i);
      if (ch === '1') { asI += 'i'; asL += 'l'; continue; }
      var mapped = SWAPS[ch] || ch;
      asI += mapped;
      asL += mapped;
    }
    return [lower, asI, asL];
  }

  // Repeated letters collapsed: "asss" becomes "as".
  function collapse(s) { return s.replace(/(.)\1+/g, '$1'); }

  // Words of 3 letters or fewer must match the whole form. Longer words match anywhere in it.
  function hits(word, form) {
    return word.length <= 3 ? form === word : form.indexOf(word) !== -1;
  }

  function isBlocked(text) {
    var forms = spellings(text);
    // Padded forms: only when collapsing changed the spelling, compare against the collapsed word.
    // This stops "ASSS" but keeps "AS" (which is not padded) allowed.
    var padded = forms.filter(function (f) { return collapse(f) !== f; }).map(collapse);
    return BLOCKED_WORDS.some(function (word) {
      return forms.some(function (f) { return hits(word, f); }) ||
             padded.some(function (f) { return hits(collapse(word), f); });
    });
  }

  function validateClanTag(text) {
    var tag = String(text == null ? '' : text).trim();
    if (tag.length < MIN_LENGTH || tag.length > MAX_LENGTH) {
      return { ok: false, reason: 'Tags need 2 to 4 characters.', tag: '' };
    }
    if (!/^[A-Za-z0-9]+$/.test(tag)) {
      return { ok: false, reason: 'Use letters and numbers only.', tag: '' };
    }
    if (isBlocked(tag)) {
      return { ok: false, reason: "That one isn't allowed. Try another tag.", tag: '' };
    }
    return { ok: true, reason: '', tag: tag.toUpperCase() };
  }

  return {
    MIN_LENGTH: MIN_LENGTH,
    MAX_LENGTH: MAX_LENGTH,
    BLOCKED_WORDS: BLOCKED_WORDS,
    isBlocked: isBlocked,
    validateClanTag: validateClanTag
  };
});
