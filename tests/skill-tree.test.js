// Node test: one skill tree for everyone (no factions). Run from the 1to1 folder: node tests/skill-tree.test.js
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');

var store = {};
var win = { localStorage: { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = String(v); } } };
win.window = win;
var ctx = { window: win, self: win };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shop', 'skill-tree-data.js'), 'utf8'), ctx);
win.SkillTreeData = ctx.window.SkillTreeData;
vm.runInContext(fs.readFileSync(path.join(root, 'shop', 'skill-tree.js'), 'utf8'), ctx);
var ST = win.ShopTree;
var out = [];

function fakeEl() {
  var el = { innerHTML: '', handler: null, addEventListener: function (t, fn) { if (t === 'click') el.handler = fn; } };
  return el;
}
function click(el, act, v) {
  el.handler({ target: { closest: function () { return { getAttribute: function (n) { return n === 'data-act' ? act : n === 'data-v' ? v : null; } }; } } });
}

// 1. The tree opens straight away: no picker, no faction word, and the saved state needs no pick.
var el = fakeEl();
ST.mount(el, { name: 'Test', level: 20 });
assert.ok(/st--tree/.test(el.innerHTML), 'tree shows');
assert.ok(!/st--chooser|Pick your faction|Choose /.test(el.innerHTML), 'no picker');
assert.ok(/Skill tree/.test(el.innerHTML), 'titled Skill tree');
out.push('1 tree opens with no picker');

// 2. The tree has all 21 level rows, in order, from one shared set.
var rows = (el.innerHTML.match(/class="st-row[ "]/g) || []).length;
assert.strictEqual(rows, 21);
out.push('2 one tree, 21 level rows');

// 3. Nobody needs to pick: the saved faction reads as the shared tree, so the glow and tag gate are off.
assert.strictEqual(ST.savedFaction(), 'frost');
out.push('3 no pick needed');

// 4. Clan tag opens with no pick.
var tagEl = fakeEl();
ST.tagPanel(tagEl);
assert.ok(!/Unlock the skill tree first/.test(tagEl.innerHTML), 'tag not locked');
assert.ok(/data-tag-form/.test(tagEl.innerHTML), 'tag form shows');
out.push('4 clan tag open');

// 5. Unlock a level 1 look, then the tree shows it as yours.
store['1to1-skill-tree'] = JSON.stringify({ faction: 'frost', unlocked: { '1-look': true }, equipped: {} });
var el2 = fakeEl();
ST.mount(el2, { name: 'Test', level: 20 });
assert.ok(/st-node--done/.test(el2.innerHTML), 'unlocked node shows as done');
out.push('5 unlocked nodes show as done');

// 6. Any player\'s look uses the shared look set (no faction picked for them).
var look = ST.fromPublic({ faction: 'brass', level: 5 }, false);
assert.strictEqual(look.faction, 'frost');
out.push('6 public look uses the shared set');

out.forEach(function (l) { console.log('ok ' + l); });
console.log('skill-tree: ' + out.length + ' checks passed');
