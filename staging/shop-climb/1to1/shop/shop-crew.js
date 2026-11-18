/* Shop crew panel: join or make a crew, see your crew's members, and the weekly crew board.
   Needs the server RPCs shop_crew_state, shop_crew_create, shop_crew_join, shop_crew_leave, shop_crew_board (SQL v3).
   If an RPC is missing (not yet run on the server), the panel hides itself. No crew data is shown to anyone else.
   Browser: window.ShopCrew. Names are always 'First L' from the server, never usernames.
   mount(el, { onAct, onHide }) -> { setState({ crew, board }) }
     onAct({ type: 'create', name, tag } | { type: 'join', tag } | { type: 'leave' }) -> Promise<{ ok, error, message }>
     setState({ crew: object|null, board: array|null }) draws the panel. */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function crewHtml(crew) {
    if (!crew) {
      return '<div class="cr-card">' +
        '<h3 class="cr-title">Join a crew</h3>' +
        '<p class="cr-sub">Crews are 3 to 5 players. Your crew XP goes on the weekly board.</p>' +
        '<div class="cr-row"><input class="cr-in" id="cr-tag-join" maxlength="4" placeholder="Tag, e.g. ABC" autocomplete="off" aria-label="Crew tag">' +
        '<button type="button" class="cr-btn" data-act="join">Join</button></div>' +
        '<h3 class="cr-title cr-title-2">Make a crew</h3>' +
        '<div class="cr-row"><input class="cr-in" id="cr-name" maxlength="24" placeholder="Crew name" autocomplete="off" aria-label="Crew name">' +
        '<input class="cr-in cr-in-tag" id="cr-tag" maxlength="4" placeholder="Tag" autocomplete="off" aria-label="New crew tag">' +
        '<button type="button" class="cr-btn" data-act="create">Make</button></div>' +
        '<p class="cr-msg" id="cr-msg" role="status" aria-live="polite"></p>' +
        '</div>';
    }
    var members = (crew.members || []).map(function (m) {
      return '<li class="cr-mem' + (m.you ? ' is-you' : '') + '">' + esc(m.name) +
        (m.creator ? ' <span class="cr-tag-s">captain</span>' : '') + (m.you ? ' <span class="cr-tag-s">you</span>' : '') + '</li>';
    }).join('');
    return '<div class="cr-card">' +
      '<div class="cr-head"><div><h3 class="cr-title">' + esc(crew.name) + '</h3>' +
      '<p class="cr-sub"><span class="cr-badge">' + esc(crew.tag) + '</span> ' + esc(crew.size) + ' of ' + esc(crew.max || 5) + ' players</p></div></div>' +
      '<ul class="cr-list">' + members + '</ul>' +
      '<div class="cr-row"><button type="button" class="cr-btn cr-btn-ghost" data-act="leave">Leave crew</button></div>' +
      '<p class="cr-msg" id="cr-msg" role="status" aria-live="polite"></p>' +
      '</div>';
  }

  function boardHtml(board, crew) {
    if (!board) return '';
    if (!board.length) {
      return '<div class="cr-card"><h3 class="cr-title">Crew board this week</h3><p class="cr-sub">No crew XP yet this week.</p></div>';
    }
    var rows = board.map(function (r, i) {
      var mine = crew && crew.tag === r.tag;
      return '<li class="cr-row-b' + (mine ? ' is-mine' : '') + '"><span class="cr-rank">' + (i + 1) + '</span>' +
        '<span class="cr-bname">' + esc(r.name) + ' <span class="cr-tag-s">' + esc(r.tag) + '</span></span>' +
        '<span class="cr-bxp">' + esc(r.xp) + ' XP</span></li>';
    }).join('');
    return '<div class="cr-card"><h3 class="cr-title">Crew board this week</h3><ol class="cr-board">' + rows + '</ol></div>';
  }

  function mount(el, opts) {
    var onAct = opts.onAct;
    var state = { crew: null, board: null };
    var panel = el;

    function draw() {
      panel.innerHTML = '<section class="cr-wrap" aria-label="Crew">' + crewHtml(state.crew) + boardHtml(state.board, state.crew) + '</section>';
    }
    function msg(text, bad) {
      var m = panel.querySelector('#cr-msg');
      if (!m) return;
      m.textContent = text || '';
      m.className = 'cr-msg' + (bad ? ' is-bad' : '');
    }
    function act(a) {
      var tagIn = panel.querySelector('#cr-tag-join');
      var nameIn = panel.querySelector('#cr-name');
      var tagNew = panel.querySelector('#cr-tag');
      var req = a === 'join' ? { type: 'join', tag: (tagIn && tagIn.value) || '' }
        : a === 'create' ? { type: 'create', name: (nameIn && nameIn.value) || '', tag: (tagNew && tagNew.value) || '' }
        : { type: 'leave' };
      Promise.resolve(onAct(req)).then(function (r) {
        if (!r || r.ok === false || r.error) { msg((r && r.error) || 'Could not save. Try again.', true); return; }
        if (r.crew !== undefined) state.crew = r.crew;
        draw();
        msg(r.message || '', false);
        if (opts.onChanged) opts.onChanged();
      }).catch(function () { msg('Could not save. Try again.', true); });
    }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act]');
      if (b) act(b.getAttribute('data-act'));
    });

    return {
      setState: function (s) {
        if (s && s.crew !== undefined) state.crew = s.crew;
        if (s && s.board !== undefined) state.board = s.board;
        draw();
      },
      hide: function () { panel.hidden = true; if (opts.onHide) opts.onHide(); }
    };
  }

  root.ShopCrew = { mount: mount, esc: esc };
})(typeof window !== 'undefined' ? window : this);
