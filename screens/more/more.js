/* More tab (player app). Plain JS, no framework, no network. Owns only screens/more/.
   Holds: Pay and history (uses pay/pay.js), My details (nickname and team wish), Bright hall,
   Alerts and home screen help, How it works (short rules), Get help, Log out, version.
   Shop is NOT here: it lives in Profile.

   Browser: window.PlayerMore. Node tests: more.test.js.

   Usage:
     var m = PlayerMore.mount(el, data, handlers);   // renders the More list into el
     m.update(newData);                               // re-render with new data
     m.destroy();                                     // remove the click listener

   data (all optional, safe defaults):
     me:       { first, lastInitial, nickname, teamPref }   teamPref: 'any' | 'blue' | 'red'
     bright:   true | false          (Bright hall on)
     alertsOn: true | false          (Game alerts on; off by default)
     tonight:  { nightId, label, amount, status }            status: 'due' | 'claimed' | 'paid'
     history:  [ { nightId, label, amount, status } ]        newest first
     cfg:      window.PLAYER_APP_CONFIG (for squarePayLink)
     version:  text shown at the bottom

   handlers (each optional; the shell supplies them):
     claimPaid(nightId)          -> Promise { ok, reason }   sends the "I've paid" claim (shell holds the PIN)
     saveProfile({ nickname, teamPref }) -> Promise { ok, reason }
     setBright(bool)
     setAlerts(bool)
     logOut()

   Pay rules: a claim is NOT a payment. Only Jord marks a night paid.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerMore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var G = typeof window !== 'undefined' ? window : globalThis;
  var VERSION = '0.2 (More tab)';
  var NICK_MIN = 2;
  var NICK_MAX = 12;
  var PANELS = ['pay', 'details', 'alerts', 'rules', 'help'];
  var PANEL_TITLE = { pay: 'Payments', details: 'My details', alerts: 'Alerts', rules: 'How it works', help: 'Get help' };

  var PAY_STATUS = {
    due:     { text: 'To pay',                       tone: 'due' },
    claimed: { text: 'Sent. Jord will check Square', tone: 'wait' },
    paid:    { text: 'Paid',                         tone: 'paid' }
  };

  var TEAM_OPTIONS = [
    { id: 'any',  label: 'No preference' },
    { id: 'blue', label: 'Blue' },
    { id: 'red',  label: 'Red' }
  ];

  // Short, plain rules. They match the rules the app already runs (rules.js). Keep them short.
  var RULES = [
    'The latest to arrive joins the shortest team.',
    'If a team is one player short, the bench fills the gap. Fewest games first.',
    'Team fouls reset every time either team scores.',
    'You earn XP for points, wins and turning up each week. Fouls earn nothing.',
    'Pay on the night, in cash or on Square. Tap I’ve paid so Jord knows to check.'
  ];

  // ---------- helpers (pure) ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function payStatus(status) {
    return PAY_STATUS[status] || PAY_STATUS.due;
  }

  // Checks a nickname typed in My details. Empty is allowed: it means "use my first name".
  function checkNickname(raw) {
    var v = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!v) return { ok: true, value: '' };
    if (v.length < NICK_MIN) return { ok: false, reason: 'short', msg: 'Use at least 2 letters.' };
    if (v.length > NICK_MAX) return { ok: false, reason: 'long', msg: 'Up to 12 letters.' };
    if (!/^[A-Za-z][A-Za-z' -]*$/.test(v)) return { ok: false, reason: 'chars', msg: 'Letters only, please.' };
    return { ok: true, value: v };
  }

  function teamLabel(id) {
    for (var i = 0; i < TEAM_OPTIONS.length; i++) { if (TEAM_OPTIONS[i].id === id) return TEAM_OPTIONS[i].label; }
    return TEAM_OPTIONS[0].label;
  }

  // Rows for the payment history, with the status words worked out.
  function historyRows(history) {
    return (Array.isArray(history) ? history : []).map(function (h) {
      var s = payStatus(h.status);
      return { nightId: h.nightId, label: String(h.label || ''), amount: String(h.amount || ''), text: s.text, tone: s.tone };
    });
  }

  // The short line under "Pay and history" on the More list.
  function paySummary(tonight) {
    if (!tonight) return 'No night set yet';
    return tonight.status === 'paid' ? 'Tonight: paid' : (tonight.status === 'claimed' ? 'Tonight: sent to Jord' : 'Tonight: ' + (tonight.amount || 'to pay'));
  }

  function detailsSummary(me) {
    var nick = me && me.nickname ? me.nickname : (me && me.first ? me.first : '');
    return nick + ' · ' + teamLabel(me && me.teamPref);
  }

  // ---------- markup (pure: data in, string out) ----------
  function switchHtml(id, on, label, sub) {
    return '<div class="more-row more-switch">' +
      '<span class="more-text"><span class="more-title">' + esc(label) + '</span>' +
      (sub ? '<span class="muted">' + esc(sub) + '</span>' : '') + '</span>' +
      '<button class="switch" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-act="' + id + '">' + (on ? 'On' : 'Off') + '</button>' +
      '</div>';
  }

  function rowHtml(panel, title, sub) {
    return '<button class="more-row" type="button" data-go="' + panel + '">' +
      '<span class="more-text"><span class="more-title">' + esc(title) + '</span>' +
      '<span class="muted">' + esc(sub) + '</span></span></button>';
  }

  function listHtml(d) {
    d = d || {};
    var version = d.version || VERSION;
    return '<h1 id="moreH">More</h1>' +
      '<div class="more-group">' +
        rowHtml('pay', 'Pay and history', paySummary(d.tonight)) +
        rowHtml('details', 'My details', detailsSummary(d.me)) +
        switchHtml('bright', !!d.bright, 'Bright hall', 'Light colours for daytime') +
      '</div>' +
      '<div class="more-group">' +
        rowHtml('alerts', 'Alerts', d.alertsOn ? 'On' : 'Off') +
        rowHtml('rules', 'How it works', 'The rules in short') +
        rowHtml('help', 'Get help', 'Ask Jord at the desk') +
      '</div>' +
      '<button class="btn ghost more-logout" type="button" data-act="logout">Log out</button>' +
      '<p class="muted centre more-version">1TO1 Basketball · ' + esc(version) + '</p>';
  }

  function backHtml() {
    return '<button class="btn ghost more-back" type="button" data-act="back">Back to More</button>';
  }

  function payPanelHtml(d) {
    var t = d.tonight;
    var rows = historyRows(d.history);
    var status = t ? payStatus(t.status) : null;
    var hist = rows.length
      ? '<ul class="list more-hist">' + rows.map(function (r) {
          return '<li><span>' + esc(r.label) + ' · ' + esc(r.amount) + '</span><span class="more-tone tone-' + r.tone + '">' + esc(r.text) + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="muted">No nights yet.</p>';
    var tonight = t
      ? '<div class="card">' +
          '<p class="more-label">Tonight · ' + esc(t.label || '') + '</p>' +
          '<p class="more-big">' + esc(t.amount || '') + '</p>' +
          '<p class="more-tone tone-' + status.tone + '">' + esc(status.text) + '</p>' +
          (t.status === 'due'
            ? '<div id="morePayBox"><p class="muted">Pay in cash or on Square, as before.</p></div>'
            : '') +
        '</div>'
      : '<div class="card"><p class="muted">Tonight is not set yet. Check back before the night.</p></div>';
    return '<h1>' + PANEL_TITLE.pay + '</h1>' + tonight +
      '<h2>History</h2>' + hist + backHtml();
  }

  function detailsPanelHtml(d, msg) {
    var me = d.me || {};
    var nick = me.nickname || '';
    var pref = me.teamPref || 'any';
    var radios = TEAM_OPTIONS.map(function (o) {
      return '<label class="more-radio"><input type="radio" name="moreTeam" value="' + o.id + '"' +
        (o.id === pref ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
    }).join('');
    return '<h1>' + PANEL_TITLE.details + '</h1>' +
      '<div class="card">' +
        '<label for="moreNick">Nickname</label>' +
        '<input id="moreNick" type="text" maxlength="' + NICK_MAX + '" autocomplete="nickname" value="' + esc(nick) + '" placeholder="' + esc(me.first || '') + '">' +
        '<p class="muted">The name other players see. Leave it empty to use your first name. Letters only, 2 to 12.</p>' +
        '<fieldset class="more-team"><legend class="label">Team I like to play for</legend>' + radios + '</fieldset>' +
        '<p class="muted">This is a wish, not a rule. Jord still sets the teams on the night.</p>' +
        '<p class="more-msg" id="moreMsg" role="status" aria-live="polite">' + esc(msg || '') + '</p>' +
        '<button class="btn yellow more-save" type="button" data-act="save-details">Save</button>' +
      '</div>' + backHtml();
  }

  function alertsPanelHtml(d) {
    return '<h1>' + PANEL_TITLE.alerts + '</h1>' +
      '<div class="card">' + switchHtml('alerts-toggle', !!d.alertsOn, 'Game alerts', 'Off by default. A ping one minute before your game.') + '</div>' +
      '<h2>Add to home screen</h2>' +
      '<div class="card">' +
        '<p><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen.</p>' +
        '<p><b>Android:</b> open this page in Chrome, tap the menu (three dots), then Install app.</p>' +
        '<p class="muted">Alerts work best from the Home Screen icon.</p>' +
      '</div>' + backHtml();
  }

  function rulesPanelHtml() {
    return '<h1>' + PANEL_TITLE.rules + '</h1>' +
      '<div class="card"><ul class="more-rules">' + RULES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' +
      backHtml();
  }

  function helpPanelHtml(d) {
    return '<h1>' + PANEL_TITLE.help + '</h1>' +
      '<div class="card">' +
        '<p><b>Forgot your PIN?</b> Ask Jord at the desk.</p>' +
        '<p><b>Wrong team or payment?</b> Tell Jord on the night.</p>' +
        '<p class="muted">Version ' + esc(d.version || VERSION) + '</p>' +
      '</div>' + backHtml();
  }

  function panelHtml(panel, d, msg) {
    d = d || {};
    if (panel === 'pay') return payPanelHtml(d);
    if (panel === 'details') return detailsPanelHtml(d, msg);
    if (panel === 'alerts') return alertsPanelHtml(d);
    if (panel === 'rules') return rulesPanelHtml();
    if (panel === 'help') return helpPanelHtml(d);
    return listHtml(d);
  }

  // ---------- mount (browser) ----------
  function mount(el, data, handlers) {
    var st = { data: data || {}, panel: '', msg: '', focus: false };
    var h = handlers || {};

    function payBox() {
      var box = el.querySelector('#morePayBox');
      var t = st.data.tonight;
      if (!box || !t || t.status !== 'due') return;
      var PP = G.PlayerPay;
      if (!PP) return;
      var cfg = st.data.cfg || G.PLAYER_APP_CONFIG || {};
      // The shell's claimPaid handler holds the PIN for this session. More never sees it.
      PP.render(box, {
        cfg: cfg,
        // The shell sends the claim with the sign-in token it holds. The token passed here is only a marker.
        backend: { claimPaid: function (token, nightId) { return h.claimPaid ? h.claimPaid(nightId) : Promise.resolve({ ok: false, reason: 'no-night' }); } },
        nightId: t.nightId,
        night: { price: t.amount },
        me: st.data.me,
        pin: 'session',
        token: 'shell'
      });
    }

    function paint() {
      el.innerHTML = st.panel ? panelHtml(st.panel, st.data, st.msg) : listHtml(st.data);
      if (st.panel === 'pay') payBox();
      if (st.focus) {
        var h1 = el.querySelector('h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); }
        st.focus = false;
      }
    }

    function go(panel) {
      st.panel = PANELS.indexOf(panel) > -1 ? panel : '';
      st.msg = '';
      st.focus = !!st.panel;
      paint();
      if (!st.panel) { var b = el.querySelector('[data-go]'); if (b) b.focus(); }
    }

    function saveDetails() {
      var nickInput = el.querySelector('#moreNick');
      var picked = el.querySelector('input[name="moreTeam"]:checked');
      var check = checkNickname(nickInput ? nickInput.value : '');
      if (!check.ok) { st.msg = check.msg; paint(); return; }
      var teamPref = picked ? picked.value : 'any';
      var next = { nickname: check.value, teamPref: teamPref };
      st.msg = 'Saving…';
      paint();
      Promise.resolve(h.saveProfile ? h.saveProfile(next) : { ok: true }).then(function (r) {
        if (r && r.ok) {
          st.data.me = Object.assign({}, st.data.me || {}, next);
          st.msg = 'Saved.';
        } else {
          st.msg = 'Could not save. Check your connection and try again.';
        }
        paint();
      }).catch(function () {
        st.msg = 'Could not save. Check your connection and try again.';
        paint();
      });
    }

    function onClick(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-go],[data-act]') : null;
      if (!t) return;
      if (t.hasAttribute('data-go')) return go(t.getAttribute('data-go'));
      var act = t.getAttribute('data-act');
      if (act === 'back') return go('');
      if (act === 'bright') {
        st.data.bright = !st.data.bright;
        if (h.setBright) h.setBright(st.data.bright);
        return paint();
      }
      if (act === 'alerts-toggle') {
        st.data.alertsOn = !st.data.alertsOn;
        if (h.setAlerts) h.setAlerts(st.data.alertsOn);
        return paint();
      }
      if (act === 'save-details') return saveDetails();
      if (act === 'logout') { if (h.logOut) h.logOut(); return; }
    }

    el.addEventListener('click', onClick);
    paint();

    return {
      update: function (next) { st.data = Object.assign({}, st.data, next || {}); paint(); },
      show: function (panel) { go(panel); },
      destroy: function () { el.removeEventListener('click', onClick); el.innerHTML = ''; }
    };
  }

  return {
    VERSION: VERSION,
    RULES: RULES,
    TEAM_OPTIONS: TEAM_OPTIONS,
    PAY_STATUS: PAY_STATUS,
    esc: esc,
    checkNickname: checkNickname,
    payStatus: payStatus,
    historyRows: historyRows,
    paySummary: paySummary,
    detailsSummary: detailsSummary,
    teamLabel: teamLabel,
    listHtml: listHtml,
    panelHtml: panelHtml,
    mount: mount
  };
});
