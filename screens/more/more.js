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
     skillDone: true once the skill questions are answered. Anything else shows the yellow warning under Settings.

   handlers (each optional; the shell supplies them):
     claimPaid(nightId)          -> Promise { ok, reason }   sends the "I've paid" claim (shell holds the PIN)
     saveProfile({ nickname, teamPref }) -> Promise { ok, reason }
     saveSkill(answers)          -> Promise { ok, reason }   the skill questions, asked once (shell holds the token)
     setBright(bool)
     setAlerts(bool)
     logOut()

   Pay rules: a claim is NOT a payment. Only the organiser marks a night paid.
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
  var PANELS = ['pay', 'details', 'alerts', 'reminders', 'account', 'rules', 'help', 'settings'];
  var PANEL_TITLE = { pay: 'Payments', details: 'My details', alerts: 'Alerts', reminders: 'Reminders', account: 'My account', rules: 'How it works', help: 'Get help', settings: 'Settings' };

  // Skill questions. Asked once, from Settings. Wording as in off-rating.js (Fable 23:14, the organiser 8 Nov).
  // Each option has a hidden value (1 to 10) that feeds the 1 to 1000 score on the server.
  var SKILL_QUESTIONS = [
    { key: 'exp', title: 'Experience', q: 'Which of these is closest to you?', opts: [
      { label: 'I have played at county, national or pro level', v: 10 },
      { label: 'I have played for a club or league team', v: 8 },
      { label: 'I have played for my school or a local team', v: 6 },
      { label: 'I have played a few games with mates, not in a team', v: 4 },
      { label: 'I have only messed about on a court or in PE', v: 2 },
      { label: 'I have never really played', v: 1 }
    ] },
    { key: 'shoot', title: 'Shooting', q: 'How well can you shoot from behind the three-point line?', opts: [
      { label: 'I make it almost always (90%+)', v: 10 },
      { label: 'I make it most of the time, not always (75-80%)', v: 8 },
      { label: 'I often make it, better than half (60-70%)', v: 7 },
      { label: 'Hit and miss, about half (40-60%)', v: 5 },
      { label: 'I usually miss, but I make it sometimes (20-40%)', v: 3 },
      { label: 'I almost always miss, I would not shoot even if open (0-20%)', v: 1 }
    ] },
    { key: 'dribble', title: 'Dribbling', q: 'How often can you get past someone who is guarding you?', opts: [
      { label: 'I get past almost anyone guarding me (90%+)', v: 10 },
      { label: 'I get past most people guarding me (75-80%)', v: 8 },
      { label: 'I get past people at my level, often (60-70%)', v: 7 },
      { label: 'Around half the time, hit and miss (40-60%)', v: 5 },
      { label: 'I usually lose the ball, but I get past sometimes (20-40%)', v: 3 },
      { label: 'I almost never get past anyone (0-20%)', v: 1 }
    ] },
    { key: 'run', title: 'Stamina', q: 'How much of a game can you go hard for?', opts: [
      { label: 'I can go hard for the whole game and still be quick (90%+)', v: 10 },
      { label: 'I can go hard for most of the game (75-80%)', v: 8 },
      { label: 'I can go hard for about two-thirds of the game (60-70%)', v: 7 },
      { label: 'I can go hard for about half the game (40-60%)', v: 5 },
      { label: 'I can go hard for a short spell, then I need a rest (20-40%)', v: 3 },
      { label: 'I tire almost straight away (0-20%)', v: 1 }
    ] }
  ];
  var SKILL_BEST = ['I am best at scoring', 'I am best at passing and setting up others', 'I am best at dribbling and handling the ball',
    'I am best at defending', 'I am best at rebounding', 'I am best at working hard and running the floor'];
  // Short keys sent to the server. The server accepts at most 20 characters here (migration-6), so the long text above is never sent.
  var SKILL_BEST_KEY = ['scoring', 'passing', 'dribbling', 'defending', 'rebounding', 'hard work'];
  var HEIGHT_MIN = 53, HEIGHT_MAX = 84, HEIGHT_DEFAULT = 69;   // inches: 4 ft 5 in to 7 ft 0 in, default 5 ft 9 in

  // Checks the answers from the form. Returns { ok, answers } or { ok: false, missing: [keys] }.
  // best is optional and is not scored.
  function validateSkill(raw) {
    raw = raw || {};
    var missing = [], answers = {};
    SKILL_QUESTIONS.forEach(function (q) {
      var v = Number(raw[q.key]);
      var valid = q.opts.some(function (o) { return o.v === v; });
      if (!valid) missing.push(q.key); else answers[q.key] = v;
    });
    var h = Number(raw.height);
    if (!Number.isInteger(h) || h < HEIGHT_MIN || h > HEIGHT_MAX) missing.push('height'); else answers.height = h;
    if (missing.length) return { ok: false, missing: missing };
    if (raw.best != null && raw.best !== '') {
      var bi = Number(raw.best);
      if (Number.isInteger(bi) && bi >= 0 && bi < SKILL_BEST_KEY.length) answers.best = SKILL_BEST_KEY[bi];
    }
    return { ok: true, answers: answers };
  }

  function settingsSummary(d) {
    return d && d.skillDone === true ? 'Skill questions done' : 'Skill questions to answer';
  }

  var PAY_STATUS = {
    due:     { text: 'To pay',                       tone: 'due' },
    claimed: { text: 'Sent. The organiser will check Square', tone: 'wait' },
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
    'Pay on the night, in cash or on Square. Tap I’ve paid so the organiser knows to check.'
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
    return tonight.status === 'paid' ? 'Tonight: paid' : (tonight.status === 'claimed' ? 'Tonight: sent to the organiser' : 'Tonight: ' + (tonight.amount || 'to pay'));
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
    var owed = d.skillDone !== true;
    return '<h1 id="moreH">More</h1>' +
      '<div class="more-group">' +
        rowHtml('details', 'My details', detailsSummary(d.me)) +
        switchHtml('bright', !!d.bright, 'Bright hall', 'Light colours for daytime') +
      '</div>' +
      '<div class="more-group">' +
        rowHtml('alerts', 'Alerts', d.alertsOn ? 'On' : 'Off') +
        rowHtml('reminders', 'Reminders', 'Off until you switch one on') +
        rowHtml('account', 'My account', 'PIN, name, my data, delete') +
        rowHtml('rules', 'How it works', 'The rules in short') +
        rowHtml('help', 'Get help', 'Ask the organiser at the desk') +
        rowHtml('settings', 'Settings', settingsSummary(d)) +
        (owed ? '<p class="more-warn" role="status"><span aria-hidden="true">⚠</span> Skill questions still to answer</p>' : '') +
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
        '<p class="muted">This is a wish, not a rule. The organiser still sets the teams on the night.</p>' +
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

  function remindersPanelHtml() {
    return '<h1>' + PANEL_TITLE.reminders + '</h1>' +
      '<div class="card" id="morePushBox"></div>' + backHtml();
  }

  function rulesPanelHtml() {
    return '<h1>' + PANEL_TITLE.rules + '</h1>' +
      '<div class="card"><ul class="more-rules">' + RULES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' +
      backHtml();
  }

  function helpPanelHtml(d) {
    return '<h1>' + PANEL_TITLE.help + '</h1>' +
      '<div class="card">' +
        '<p><b>Forgot your PIN?</b> Ask the organiser at the desk.</p>' +
        '<p><b>Wrong team or payment?</b> Tell the organiser on the night.</p>' +
        '<p class="muted">Version ' + esc(d.version || VERSION) + '</p>' +
      '</div>' + backHtml();
  }

  function skillFormHtml(msg) {
    var blocks = SKILL_QUESTIONS.map(function (q) {
      return '<fieldset class="more-skill"><legend class="more-skill-title">' + esc(q.title) + '</legend>' +
        '<p class="muted">' + esc(q.q) + '</p>' +
        q.opts.map(function (o) {
          return '<label class="more-radio more-answer"><input type="radio" name="skill-' + q.key + '" value="' + o.v + '">' +
            '<span>' + esc(o.label) + '</span></label>';
        }).join('') +
        '</fieldset>';
    }).join('');
    var height = '<fieldset class="more-skill"><legend class="more-skill-title">Height</legend>' +
      '<p class="muted">Slide to your height in feet and inches.</p>' +
      '<label class="more-range"><span id="moreHeightOut">' + esc(feetInches(HEIGHT_DEFAULT)) + '</span>' +
      '<input id="moreHeight" type="range" name="skill-height" min="' + HEIGHT_MIN + '" max="' + HEIGHT_MAX + '" step="1" value="' + HEIGHT_DEFAULT + '"></label>' +
      '</fieldset>';
    var best = '<fieldset class="more-skill"><legend class="more-skill-title">Best at</legend>' +
      '<p class="muted">Optional. Helps the organiser spread the team. Not scored.</p>' +
      SKILL_BEST.map(function (text, i) {
        return '<label class="more-radio more-answer"><input type="radio" name="skill-best" value="' + i + '"><span>' + esc(text) + '</span></label>';
      }).join('') +
      '</fieldset>';
    return '<h1>' + PANEL_TITLE.settings + '</h1>' +
      '<div class="card">' +
        '<p class="more-skill-note"><b>Answer honestly.</b> It saves time on the night: teams are built from these answers. ' +
        'The organiser checks every number. You can answer once only.</p>' +
        blocks + height + best +
        '<p class="more-msg" id="moreSkillMsg" role="status" aria-live="polite">' + esc(msg || '') + '</p>' +
        '<button class="btn yellow more-save" type="button" data-act="save-skill">Save my answers</button>' +
      '</div>' + backHtml();
  }

  function settingsPanelHtml(d, msg) {
    if (d.skillDone === true) {
      return '<h1>' + PANEL_TITLE.settings + '</h1>' +
        '<div class="card"><p><b>Skill questions done.</b></p>' +
        '<p class="muted">Your answers are saved. They can’t be changed. The organiser checks your number.</p></div>' + backHtml();
    }
    return skillFormHtml(msg);
  }

  function feetInches(n) { return Math.floor(n / 12) + ' ft ' + (n % 12) + ' in'; }

  function panelHtml(panel, d, msg) {
    d = d || {};
    if (panel === 'pay') return payPanelHtml(d);
    if (panel === 'details') return detailsPanelHtml(d, msg);
    if (panel === 'alerts') return alertsPanelHtml(d);
    if (panel === 'reminders') return remindersPanelHtml();
    if (panel === 'account') return '<h1>' + PANEL_TITLE.account + '</h1>' + (window.PlayerMyAccount ? PlayerMyAccount.buildPanel() : '<p class="muted">Not available.</p>') + backHtml();
    if (panel === 'rules') return rulesPanelHtml();
    if (panel === 'help') return helpPanelHtml(d);
    if (panel === 'settings') return settingsPanelHtml(d, msg);
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
        night: { price: t.amount, games: t.startsAt ? [{ startsAt: t.startsAt }] : [] },
        me: st.data.me,
        pin: 'session',
        token: 'shell'
      });
    }

    function pushBox() {
      var box = el.querySelector('#morePushBox');
      if (!box || !G.PlayerPush || !h.pushController) return;
      G.PlayerPush.render(box, h.pushController);
    }

    function paint() {
      el.innerHTML = st.panel ? panelHtml(st.panel, st.data, st.msg) : listHtml(st.data);
      if (st.panel === 'pay') payBox();
      if (st.panel === 'reminders') pushBox();
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

    function saveSkill() {
      var raw = {};
      SKILL_QUESTIONS.forEach(function (q) {
        var picked = el.querySelector('input[name="skill-' + q.key + '"]:checked');
        raw[q.key] = picked ? picked.value : '';
      });
      var hi = el.querySelector('#moreHeight');
      raw.height = hi ? hi.value : '';
      var pb = el.querySelector('input[name="skill-best"]:checked');
      raw.best = pb ? pb.value : '';
      var check = validateSkill(raw);
      // Messages go into the form's status line only, so the answers picked so far stay on screen.
      var line = el.querySelector('#moreSkillMsg');
      function say(text) { if (line) line.textContent = text; }
      if (!check.ok) { say('Answer every question first.'); return; }
      say('Saving…');
      Promise.resolve(h.saveSkill ? h.saveSkill(check.answers) : { ok: false, reason: 'error' }).then(function (r) {
        if ((r && r.ok) || (r && r.reason === 'already-done')) {
          st.data.skillDone = true;
          st.msg = '';
          paint();
        } else {
          say('Could not save. Check your connection and try again.');
        }
      }).catch(function () {
        say('Could not save. Check your connection and try again.');
      });
    }

    function onClick(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-go],[data-act]') : null;
      if (!t) return;
      if (t.hasAttribute('data-go')) return go(t.getAttribute('data-go'));
      var act = t.getAttribute('data-act');
      if (act === 'back') return go('');
      if (act === 'save-skill') return saveSkill();
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

    function onInput(e) {
      if (e.target && e.target.id === 'moreHeight') {
        var out = el.querySelector('#moreHeightOut');
        if (out) out.textContent = feetInches(Number(e.target.value));
      }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    paint();

    return {
      update: function (next) { st.data = Object.assign({}, st.data, next || {}); paint(); },
      show: function (panel) { go(panel); },
      destroy: function () { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.innerHTML = ''; }
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
    SKILL_QUESTIONS: SKILL_QUESTIONS,
    validateSkill: validateSkill,
    settingsSummary: settingsSummary,
    mount: mount
  };
});
