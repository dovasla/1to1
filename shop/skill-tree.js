/* Skill tree (player app). One tree for everyone (factions removed, 19 Nov): unlocks by level, levels 1 to 60.
   Browser: window.ShopTree. Node: module.exports (rules only).
   Data: shop/skill-tree-data.js (generated from revamp/SKILLTREE-OFFERS-19NOV.md).
   Effects: effects/faction-effects.css (fx-<faction>-<slot>-<stage> classes).
   Rules: unlock is free and needs the player's level. No coins, no XP is spent. Unlocks save on this phone only.
   Equip is separate (equipPanel, on Profile). Unlocking never equips.
   Use:
     ShopTree.mount(el, { name, level, onExit })   // the one skill tree
     ShopTree.equipPanel(el, { })                    // Profile: 5 equip slots
*/
(function (root, factory) {
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShopTree = api;
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  var KEY = '1to1-skill-tree';
  var FACTION_IDS = ['ember', 'frost', 'brass', 'indigo', 'slate']; // all five stay valid for saved players; indigo is retired from the picker
  var SLOT_NAMES = { card: 'Card effect', banner: 'Banner', name: 'Name effect', badge: 'Badge', title: 'Title pill' };
  var TIERS = [[1, 'Tier 1 · small'], [15, 'Tier 2 · detail'], [27, 'Tier 3 · motion'], [39, 'Tier 4 · strong'], [51, 'Tier 5 · top']];

  // ---- Rules (pure) ----

  // Names come from FactionPoints (one place to change them). Retired factions stay valid for saved players.
  function dataFactions() { return (win && win.SkillTreeData && win.SkillTreeData.factions) || []; }
  function dataFaction(id) { return dataFactions().filter(function (f) { return f.id === id; })[0] || null; }
  // One tree for everyone. Its nodes and look set come from the shared id below (frost).
  var TREE_ID = 'frost';
  function sharedTree() {
    var base = dataFaction(TREE_ID) || { id: TREE_ID, nodes: [] };
    return Object.assign({}, base, { name: 'Skill tree', color: '#FFD21F' });
  }
  function factions() { return [sharedTree()]; }
  function faction() { return sharedTree(); }

  // A saved faction only counts if it is one of the known ids (old test values count as "not picked").
  function validFaction(id) { return FACTION_IDS.indexOf(String(id || '')) > -1 ? String(id) : ''; }

  function nodeId(level, branch) { return level + '-' + branch; }

  // 1 of 1 set: earned at prestige (one star or more). Parts are owned, never worn automatically.
  var SET_SLOTS = ['card', 'banner', 'name', 'badge'];
  var SET_NAMES = { card: 'card', banner: 'banner', name: 'name', badge: 'badge' };
  function hasSet(host) { return (host && (host.stars | 0)) >= 1; }
  function setClass(f, slot) { return 'fx-' + f + '-1of1-' + slot; }

  // [CARD 2] / [BADGE 1] / [BANNER 3] / [NAME 1] tags mark an inventory item. Returns { slot, stage } or null.
  function slotOf(text) {
    var m = String(text || '').match(/^\[(CARD|BADGE|BANNER|NAME) (\d)\]/);
    if (!m) return null;
    return { slot: { CARD: 'card', BADGE: 'badge', BANNER: 'banner', NAME: 'name' }[m[1]], stage: +m[2] };
  }

  // Plain words for a cell: the [TAG] prefix is removed.
  function plain(text) { return String(text || '').replace(/^\[[A-Z]+ \d\]\s*/, ''); }

  // Coin rewards sit in the Look column in the data, but they are not looks: shown as "Reward".
  function isCoinReward(text) { return /^Coins \+/.test(plain(text)); }
  function branchLabel(n) { return n.branch === 'name' ? 'Name' : (isCoinReward(n.text) ? 'Reward' : 'Look'); }

  function titleOf(text) {
    var m = plain(text).match(/^Title:\s*(.+)$/);
    return m ? m[1] : '';
  }

  // Boost (★) rows: "★ +2% XP on ..." count toward the live boost total. Coins rows and others do not.
  function boostOf(text) {
    var t = String(text || '');
    if (t.indexOf('★') === -1) return 0;
    var m = t.match(/\+(\d+)%/);
    return m ? +m[1] : 0;
  }

  // Unlocked map: { '15-look': true, ... }. Node state for the tree.
  function stateOf(node, playerLevel, unlocked) {
    if (unlocked[nodeId(node.level, node.branch)]) return 'done';
    if (node.level <= (playerLevel | 0)) return 'open';
    return 'locked';
  }

  function nodesOf(f) {
    var out = [];
    f.nodes.forEach(function (n) {
      out.push({ level: n.level, big: n.big, branch: 'look', text: n.look });
      out.push({ level: n.level, big: n.big, branch: 'name', text: n.name });
    });
    return out;
  }

  // The first level the player has not reached yet that is a big node. Null when all are reached.
  function nextBig(playerLevel) {
    var L = [15, 30, 45, 60];
    for (var i = 0; i < L.length; i++) if (L[i] > (playerLevel | 0)) return L[i];
    return null;
  }

  function totals(f, unlocked) {
    var all = nodesOf(f);
    var done = all.filter(function (n) { return unlocked[nodeId(n.level, n.branch)]; });
    var boost = done.reduce(function (s, n) { return s + boostOf(n.text); }, 0);
    return { done: done.length, total: all.length, boost: boost };
  }

  // ---- Local save (this phone only) ----

  function read() {
    var s = null;
    try { s = JSON.parse((win && win.localStorage.getItem(KEY)) || 'null'); } catch (e) { s = null; }
    s = s && typeof s === 'object' ? s : {};
    return {
      faction: TREE_ID,
      unlocked: s.unlocked && typeof s.unlocked === 'object' ? s.unlocked : {},
      equipped: s.equipped && typeof s.equipped === 'object' ? s.equipped : {},
      warOn: !!s.warOn,
      clanTag: typeof s.clanTag === 'string' ? s.clanTag : ''
    };
  }
  function write(s) {
    try { win.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: kept for this visit only */ }
  }
  function savedFaction() { return read().faction; }

  // The title pill worn on Profile (from the equip slot), or '' when none is worn.
  function equippedTitle() {
    var s = read();
    var id = s.equipped && s.equipped.title;
    if (!id) return '';
    var parts = String(id).split('-');
    var f = faction(s.faction);
    if (!f) return '';
    var n = nodesOf(f).filter(function (x) { return nodeId(x.level, x.branch) === nodeId(+parts[0], parts[1]); })[0];
    return n ? titleOf(n.text) : '';
  }

  // ---- DOM ----

  function esc(s) { return win.PlayerName ? win.PlayerName.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, ''); }
  function fxClass(f, slot, stage) { return 'fx-' + f + '-' + slot + '-' + stage; }
  function itemClass(f, node) {
    var s = slotOf(node.text);
    return s ? fxClass(f, s.slot, s.stage) : '';
  }

  // One shared look for the local player: faction, clan tag, worn title and worn effect classes.
  // Every own-name chip and card on this phone reads it, so a change shows everywhere at once.
  function ownLook() {
    var s = read();
    var eq = s.equipped || {};
    var f = faction(s.faction);
    var classes = f ? ['card', 'banner', 'name', 'badge'].map(function (slot) { return itemCls(f, slot, eq[slot] || ''); }).filter(Boolean).join(' ') : '';
    return { faction: s.faction, clanTag: s.clanTag || '', clanOn: !!s.clanTag, title: equippedTitle(), classes: classes };
  }

  // One shape for any player's look on any screen. p = a server row (player_public_card: faction, clan_tag, title,
  // equipped, level, stars). own: true uses this phone's save. Missing fields fall back to plain.
  function fromPublic(p, own) {
    p = p || {};
    if (own) {
      var ol = ownLook();
      return { faction: ol.faction, clanTag: ol.clanTag, title: ol.title, classes: ol.classes, level: p.level | 0, stars: p.stars | 0 };
    }
    var f = faction(validFaction(p.faction));
    var eq = p.equipped || {};
    var classes = f ? ['card', 'banner', 'name', 'badge'].map(function (slot) { return itemCls(f, slot, eq[slot] || ''); }).filter(Boolean).join(' ') : '';
    return { faction: f ? f.id : '', clanTag: String(p.clan_tag || p.clanTag || ''), title: String(p.title || ''), classes: classes, level: p.level | 0, stars: p.stars | 0 };
  }

  function cardHtml(name, level, extra) {
    if (!win.PlayerName) return '';
    return '<div class="st-card ' + (extra || '') + '">' + win.PlayerName.html({ name: name, level: level, size: 'full', noCall: true, clanTag: ownLook().clanTag }) + '</div>';
  }

  function nodeHtml(f, n, playerLevel, unlocked, sel, preview) {
    var st = stateOf(n, playerLevel, unlocked);
    var shown = preview || st !== 'locked';
    var txt = shown ? plain(n.text) : '?';
    if (preview) st = n.level <= (playerLevel | 0) ? 'open' : 'locked';
    var cls = 'st-node st-node--' + st + (n.big ? ' st-node--big' : '') + (sel ? ' is-sel' : '') + (preview ? ' st-node--static' : '');
    var inner = '<span class="st-node-l">Level ' + n.level + (n.big ? ' · BIG' : '') + ' · ' + branchLabel(n) + '</span>' +
      '<span class="st-node-t">' + esc(txt) + '</span>';
    if (preview) return '<div class="' + cls + ' st-node--' + n.branch + '">' + inner + '</div>';
    return '<button class="' + cls + ' st-node--' + n.branch + '" type="button" data-act="node" data-level="' + n.level + '" data-branch="' + n.branch + '">' + inner + '</button>';
  }

  // Rows in level order (1 to 60): Look left, Name right, a hub between, tier bands. Preview = read-only.
  function rowsHtml(f, pl, unlocked, preview, sel) {
    var rows = '';
    var byLevel = {};
    nodesOf(f).forEach(function (n) { (byLevel[n.level] = byLevel[n.level] || {})[n.branch] = n; });
    f.nodes.forEach(function (fn) {
      var tier = TIERS.filter(function (x) { return fn.level >= x[0]; }).pop();
      if (tier && tier[0] === fn.level) rows += '<div class="st-tier">' + esc(tier[1]) + '</div>';
      var look = byLevel[fn.level].look, name = byLevel[fn.level].name;
      var lookState = stateOf(look, pl, unlocked);
      rows += '<div class="st-row' + (fn.big ? ' st-row--big' : '') + '">' +
        nodeHtml(f, look, pl, unlocked, !!(sel && sel === nodeId(fn.level, 'look')), preview) +
        '<span class="st-hub' + (fn.big ? ' st-hub--big' : '') + (lookState === 'done' ? ' is-on' : '') + '" aria-hidden="true"></span>' +
        nodeHtml(f, name, pl, unlocked, !!(sel && sel === nodeId(fn.level, 'name')), preview) +
        '</div>';
    });
    return rows;
  }

  // The full-screen branching tree: spine down the middle, Look left, Name right, tier bands.
  function treeHtml(f, host, s) {
    var pl = host.level | 0;
    var t = totals(f, s.unlocked);
    var nb = nextBig(pl);
    var teaser = nb ? 'Big unlock at ' + nb + ' · ?' : 'All big unlocks reached';
    var rows = rowsHtml(f, pl, s.unlocked, false, host.sel);
    return '<div class="st-ftop" style="--fc:' + f.color + '">' +
      '<button class="st-down" type="button" data-act="exit" aria-label="Leave the tree"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v14M6 12l6 6 6-6"/></svg></button>' +
      '<div class="st-ftitle"><span class="st-lbl">Level ' + pl + '</span><h2 class="st-h">' + esc(f.name) + '</h2></div>' +
      '<span class="st-live" aria-live="polite">Boost +' + t.boost + '% · ' + t.done + ' of ' + t.total + '</span>' +
      '<a class="st-x st-inv-link" href="#profile/inventory">Equip in Inventory</a></div>' +
      '<p class="st-teaser">' + esc(teaser) + '</p>' +
      '<p class="st-set">' + (hasSet(host) ? 'Prestige set is yours. Wear it on Profile.' : 'Prestige set · ? · Earned at prestige') + '</p>' +
      '<div class="st-spine-wrap"><div class="st-spine" aria-hidden="true"></div>' + rows + '</div>' +
      '<p class="st-legend"><b>Gold ring</b> = big node. Solid = yours. Dashed = open now. "?" = not reached yet.</p>';
  }

  // Bottom sheet for a tapped node: a preview on the player's own card, then Unlock with a confirm step.
  function sheetHtml(f, host, s, sel) {
    var parts = sel.split('-');
    var level = +parts[0], branch = parts[1];
    var n = nodesOf(f).filter(function (x) { return x.level === level && x.branch === branch; })[0];
    if (!n) return '';
    var st = stateOf(n, host.level | 0, s.unlocked);
    var cls = itemClass(f.id, n);
    var titleTxt = titleOf(n.text);
    var preview = cardHtml(host.name || 'You', host.level | 0, cls) + (titleTxt ? '<span class="st-pill">' + esc(titleTxt) + '</span>' : '');
    var boost = boostOf(n.text);
    var what = boost ? 'Adds +' + boost + '% XP while you play. It never changes game results.' : (cls ? 'A card look. Wear it on Profile.' : (titleTxt ? 'A title. Wear it on Profile.' : 'Coins for the shop.'));
    var status = st === 'done' ? '<span class="st-chip st-chip--on">Yours</span>' : (st === 'open' ? '<span class="st-chip">Ready to unlock</span>' : '<span class="st-chip">Reach Level ' + level + '</span>');
    var foot;
    if (st === 'done') foot = '<button class="st-btn ghost" type="button" data-act="close">Close</button>';
    else if (st === 'locked') foot = '<button class="st-btn ghost" type="button" data-act="close">Close</button>';
    else if (sheet.confirm) foot = '<p class="st-q">Unlock this for free? Your level is not spent.</p><div class="st-row2"><button class="st-btn ghost" type="button" data-act="cancel">Not yet</button><button class="st-btn" type="button" data-act="unlock" data-v="' + sel + '">Yes, unlock</button></div>';
    else foot = '<div class="st-row2"><button class="st-btn ghost" type="button" data-act="close">Cancel</button><button class="st-btn" type="button" data-act="ask">Unlock</button></div>';
    return '<div class="st-dim" data-act="close"></div><div class="st-sheet" role="dialog" aria-modal="true" aria-label="Node">' +
      '<div class="st-grab"></div><div class="st-sheet-hd">' + status + '<span class="st-node-l">Level ' + level + ' · ' + branchLabel(n) + '</span></div>' +
      '<h3 class="st-h3">' + esc(plain(n.text)) + '</h3>' +
      '<div class="st-prev">' + preview + '</div>' +
      '<p class="st-what">' + esc(what) + '</p>' + foot + '</div>';
  }

  var sheet = null; // { sel: '15-look', confirm: false }

  function mount(el, host) {
    host = host || {};
    var f = null;
    var msg = '';
    var sheetOpen = false;

    function render() {
      if (!el) return;
      var s = read();
      f = sharedTree();
      el.innerHTML = '<section class="st st--tree" style="--fc:' + f.color + '">' + treeHtml(f, Object.assign({}, host, { sel: sheetOpen && sheet ? sheet.sel : '' }), s) +
        (sheetOpen && sheet ? sheetHtml(f, host, s, sheet.sel) : '') +
        (msg ? '<p class="st-msg" role="status">' + esc(msg) + '</p>' : '') + '</section>';
    }

    if (el) el.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
      var s = read();
      if (a === 'exit') { if (host.onExit) host.onExit(); return; }
      if (a === 'node') {
        sheet = { sel: t.getAttribute('data-level') + '-' + t.getAttribute('data-branch'), confirm: false };
        sheetOpen = true; msg = ''; return render();
      }
      if (a === 'close' || a === 'cancel') { sheetOpen = false; sheet = null; return render(); }
      if (a === 'ask') { sheet.confirm = true; return render(); }
      if (a === 'unlock') {
        var parts = v.split('-'); var id = nodeId(+parts[0], parts[1]);
        if (!f) return;
        var node = nodesOf(f).filter(function (x) { return nodeId(x.level, x.branch) === id; })[0];
        if (!node || stateOf(node, host.level | 0, s.unlocked) !== 'open') { msg = 'Reach that level first.'; sheetOpen = false; return render(); }
        s.unlocked[id] = true;
        if (node.level === 1 && node.branch === 'look') s.warOn = true;
        write(s); sheetOpen = false; sheet = null; msg = 'Unlocked.'; render();
      }
    });

    render();
    return { render: render };
  }

  // Profile: five equip slots. Only owned (unlocked) items of the chosen faction can be worn.
  function equipPanel(el, host) {
    host = host || {};
    // One line per call: the list shows the faction's 1 of 1 parts when prestiged.
    function render() {
      if (!el) return;
      var s = read();
      var f = faction(s.faction);
      if (!f) { el.innerHTML = '<p class="st-sub">Pick a faction on the skill tree first. Then your looks show here.</p>'; return; }
      var owned = nodesOf(f).filter(function (n) { return s.unlocked[nodeId(n.level, n.branch)]; });
      var setOn = hasSet(host);
      var rows = ['card', 'banner', 'name', 'badge', 'title'].map(function (slot) {
        var opts = owned.filter(function (n) { return slot === 'title' ? !!titleOf(n.text) : (slotOf(n.text) || {}).slot === slot; });
        var setChip = SET_SLOTS.indexOf(slot) > -1
          ? (setOn ? '<button class="st-chip ' + setClass(f.id, slot) + (String(s.equipped[slot] || '') === '1of1-' + slot ? ' is-on' : '') + '" type="button" data-slot="' + slot + '" data-v="1of1-' + slot + '">1 of 1 ' + esc(SET_NAMES[slot]) + '</button>' : '<span class="st-chip">? 1 of 1 ' + esc(SET_NAMES[slot]) + '</span>')
          : '';
        var cur = s.equipped[slot] || '';
        var chips = '<button class="st-chip' + (!cur ? ' is-on' : '') + '" type="button" data-slot="' + slot + '" data-v="">None</button>' +
          opts.map(function (n) {
            var id = nodeId(n.level, n.branch);
            return '<button class="st-chip' + (cur === id ? ' is-on' : '') + '" type="button" data-slot="' + slot + '" data-v="' + id + '">' + esc(plain(n.text)) + '</button>';
          }).join('') + setChip;
        return '<div class="st-eq"><div class="st-eq-nm">' + esc(SLOT_NAMES[slot]) + '</div><div class="st-eq-ch">' + chips + '</div></div>';
      }).join('');
      el.innerHTML = '<div class="st-equip">' + rows + '</div>';
    }
    if (el) el.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-slot]') : null;
      if (!t) return;
      var s = read();
      s.equipped[t.getAttribute('data-slot')] = t.getAttribute('data-v');
      write(s); render();
    });
    render();
    return { render: render };
  }

  // Clan tag (2 to 4 letters or numbers). Locked until a faction is picked. Saves on this phone for now.
  function tagPanel(el) {
    var msg = '';
    function render() {
      if (!el) return;
      var s = read();
      var locked = !s.faction;
      if (locked) {
        el.innerHTML = '<div class="st-tag st-tag--locked"><button class="st-tag-lock" type="button" data-tag-act="locked">' + icon('M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3') + '<span>Unlock the skill tree first</span></button></div>' + (msg ? '<p class="st-msg" role="status">' + esc(msg) + '</p>' : '');
        return;
      }
      el.innerHTML = '<form class="st-tag" data-tag-form><label class="st-eq-nm" for="stTag">Clan tag</label>' +
        '<div class="st-row2"><input id="stTag" class="st-input" maxlength="4" autocomplete="off" value="' + esc(s.clanTag) + '" placeholder="e.g. TONE">' +
        '<button class="st-btn" type="submit">Save tag</button></div></form>' + (msg ? '<p class="st-msg" role="status">' + esc(msg) + '</p>' : '');
    }
    if (el) {
      el.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-tag-act]') : null;
        if (t) { msg = 'Unlock the skill tree first. Pick a faction and your tag opens.'; render(); }
      });
      el.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var input = el.querySelector('#stTag');
        var raw = input ? input.value : '';
        var v = win.ClanTag ? win.ClanTag.validateClanTag(raw) : { ok: false, reason: 'Tags are not ready yet.' };
        if (!v.ok) { msg = (v.reason === "blocked") ? "That one isn’t allowed. Try another tag." : (v.reason || "Try another tag."); return render(); }
        var s = read(); s.clanTag = v.tag; write(s); msg = 'Saved. Your tag is ' + v.tag + '.'; render();
      });
    }
    render();
    return { render: render };
  }

  function icon(path) { return '<svg class="st-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="' + path + '"/></svg>'; }

  // Inventory / Customize: everything owned, grouped by slot. Wear one per slot; tap a worn one to take it off.
  // Unowned items show "?" and where to get them. Own screen (not inside the tree or the shop).
  var SLOT_LABEL = { card: 'Card effect', banner: 'Banner', name: 'Name effect', badge: 'Badge', title: 'Title pill' };
  var SLOT_ORDER = ['card', 'banner', 'name', 'badge', 'title'];

  function itemSlot(n) { return titleOf(n.text) ? 'title' : ((slotOf(n.text) || {}).slot || ''); }

  function inventoryItems(f, s, host) {
    var out = { card: [], banner: [], name: [], badge: [], title: [] };
    nodesOf(f).forEach(function (n) {
      var slot = itemSlot(n);
      if (!slot) return;
      var id = nodeId(n.level, n.branch);
      out[slot].push({ id: id, label: plain(n.text), owned: !!s.unlocked[id], hint: 'Tree, Level ' + n.level });
    });
    SET_SLOTS.forEach(function (slot) {
      out[slot].push({ id: '1of1-' + slot, label: '1 of 1 ' + SET_NAMES[slot], owned: hasSet(host), hint: 'Prestige set' });
    });
    return out;
  }

  // The class for a worn item (fx-<faction>-<slot>-<stage>, or the 1 of 1 set class).
  function itemCls(f, slot, id) {
    if (!id) return '';
    if (id.indexOf('1of1-') === 0) return setClass(f.id, slot);
    var n = nodesOf(f).filter(function (x) { return nodeId(x.level, x.branch) === id; })[0];
    var sl = n && slotOf(n.text);
    return sl && sl.slot === slot ? fxClass(f.id, sl.slot, sl.stage) : '';
  }

  function invPreview(f, s, host) {
    var eq = s.equipped || {};
    var title = eq.title ? equippedTitle() : '';
    var nm = esc(host.name || 'You');
    return '<div class="st-inv-prev">' +
      '<div class="st-inv-banner ' + itemCls(f, 'banner', eq.banner) + '"></div>' +
      '<p class="st-inv-name"><span class="' + itemCls(f, 'name', eq.name) + '">' + nm + '</span> <span class="st-muted">Level ' + (host.level | 0) + '</span></p>' +
      cardHtml(host.name || 'You', host.level | 0, itemCls(f, 'card', eq.card)) +
      '<div class="st-inv-badge"><span class="st-disc ' + itemCls(f, 'badge', eq.badge) + '"></span>' +
      (title ? '<span class="st-pill">' + esc(title) + '</span>' : '') + '</div></div>';
  }

  function invSlot(f, s, slot, list) {
    var cur = s.equipped[slot] || '';
    var tiles = list.map(function (it) {
      if (!it.owned) return '<div class="st-inv-tile st-inv-tile--locked"><span class="st-inv-q">?</span><span class="st-inv-hint">' + esc(it.hint) + '</span></div>';
      var on = cur === it.id;
      return '<button class="st-inv-tile' + (on ? ' is-on' : '') + '" type="button" data-inv-slot="' + slot + '" data-v="' + it.id + '">' +
        '<span class="st-inv-sw ' + itemCls(f, slot, it.id) + '"></span><span class="st-inv-lbl">' + esc(it.label) + '</span><span class="st-inv-hint">' + (on ? 'Worn. Tap to take off.' : 'Tap to wear') + '</span></button>';
    }).join('');
    return '<section class="st-inv-slot"><h3 class="st-inv-h">' + esc(SLOT_LABEL[slot]) + '</h3><div class="st-inv-grid">' + tiles + '</div>' +
      (cur ? '<button class="st-chip st-inv-off" type="button" data-inv-slot="' + slot + '" data-v="">Take off</button>' : '') + '</section>';
  }

  function inventory(el, host) {
    host = host || {};
    function render() {
      if (!el) return;
      var s = read();
      var f = faction(s.faction);
      if (!f) { el.innerHTML = '<p class="st-sub">Pick a faction on the skill tree first. Then your inventory opens.</p><p><a class="st-x" href="#profile/tree">Skill tree</a></p>'; return; }
      var items = inventoryItems(f, s, host);
      el.innerHTML = '<div class="st-inv">' +
        '<header class="st-hd"><div class="st-lbl">Your looks</div><h2 class="st-h">Inventory</h2>' +
        '<p class="st-sub">Everything you own, by slot. Owning a look does not wear it. Tap one to wear it on your card.</p></header>' +
        invPreview(f, s, host) + SLOT_ORDER.map(function (slot) { return invSlot(f, s, slot, items[slot]); }).join('') + '</div>';
    }
    if (el) el.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-inv-back],[data-inv-slot]') : null;
      if (!t) return;
      if (t.hasAttribute('data-inv-back')) { if (host.onBack) host.onBack(); return; }
      var slot = t.getAttribute('data-inv-slot'), v = t.getAttribute('data-v') || '';
      var s = read();
      var f = faction(s.faction);
      if (v && f) {
        var owned = inventoryItems(f, s, host)[slot].filter(function (it) { return it.id === v && it.owned; });
        if (!owned.length) return;
      }
      s.equipped[slot] = (v && s.equipped[slot] !== v) ? v : '';
      write(s);
      render();
    });
    render();
    return { render: render };
  }

  return {
    inventory: inventory,
    ownLook: ownLook,
    fromPublic: fromPublic,
    tagPanel: tagPanel,
    mount: mount,
    equipPanel: equipPanel,
    savedFaction: savedFaction,
    equippedTitle: equippedTitle,
    read: read,
    write: write,
    KEY: KEY,
    factions: factions,
    faction: faction,
    nodesOf: nodesOf,
    stateOf: stateOf,
    slotOf: slotOf,
    titleOf: titleOf,
    boostOf: boostOf,
    nextBig: nextBig,
    totals: totals,
    FACTION_IDS: FACTION_IDS
  };
});
