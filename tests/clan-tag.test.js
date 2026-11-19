'use strict';
// Node test: clan tag length, characters, swear list with letter swaps and padding. Run: node tests/clan-tag.test.js
var assert = require('assert');
var path = require('path');
var C = require(path.join(__dirname, '..', 'lib', 'clan-tag.js'));

var out = [];

function ok(input, expectedTag) {
  var r = C.validateClanTag(input);
  assert.strictEqual(r.ok, true, 'should pass: ' + input + ' -> ' + r.reason);
  if (expectedTag) assert.strictEqual(r.tag, expectedTag);
}
function no(input, reason) {
  var r = C.validateClanTag(input);
  assert.strictEqual(r.ok, false, 'should fail: ' + input);
  if (reason) assert.strictEqual(r.reason, reason);
}

// 1. Good tags pass and come back upper-case.
ok('tone', 'TONE');
ok('ROCK', 'ROCK');
ok('Ab', 'AB');
ok('99', '99');
ok('a1b2', 'A1B2');
out.push('1 good tags pass, upper-cased');

// 2. Length: 2 to 4 only.
no('a', 'Tags need 2 to 4 characters.');
no('', 'Tags need 2 to 4 characters.');
no('abcde', 'Tags need 2 to 4 characters.');
out.push('2 length 2 to 4');

// 3. Letters and numbers only.
no('ab!', 'Use letters and numbers only.');
no('a b', 'Use letters and numbers only.');
no('ké', 'Use letters and numbers only.');
out.push('3 letters and numbers only');

// 4. Swears are blocked, any case.
no('ass', "That one isn't allowed. Try another tag.");
no('FUCK', "That one isn't allowed. Try another tag.");
no('tits', "That one isn't allowed. Try another tag.");
out.push('4 plain swears blocked');

// 5. Letter swaps are blocked.
no('a55', "That one isn't allowed. Try another tag.");   // a55 -> ass
no('sh1t', "That one isn't allowed. Try another tag.");  // sh1t -> shit
no('c0ck', "That one isn't allowed. Try another tag.");  // c0ck -> cock
no('t1ts', "That one isn't allowed. Try another tag.");  // t1ts -> tits
out.push('5 letter swaps blocked');

// 6. Repeated-letter padding is blocked.
no('asss', "That one isn't allowed. Try another tag.");  // asss -> as... and ass-like padding
out.push('6 padding (checked, see note in summary)');

// 7. Short words only match the whole tag, so ordinary words are fine.
ok('BASS', 'BASS');
ok('PASS', 'PASS');
ok('AS', 'AS');
out.push('7 BASS, PASS, AS allowed');

// 8. Blocked list is an array of plain words.
assert.ok(Array.isArray(C.BLOCKED_WORDS) && C.BLOCKED_WORDS.length > 10);
out.push('8 blocked list is readable array');

out.forEach(function (line) { console.log('ok ' + line); });
console.log('clan-tag: ' + out.length + ' groups passed');
