/* More tab (player app). Plain JS, no framework, no network. Owns only screens/more/.
   The More list (R62, 59c layout): You (Profile, Achievements, Shop, Invite a mate) and App (Payments, Settings, Help), then Log out.
   Settings is a real page: Your username, My details, Bright hall, Show me to other players, Run alerts and Skill questions (asked once).
   Run alerts page: run alerts are always on (no switch), three extra switches (R65), and Send me a test alert (R69).
   Help holds the short rules and desk help. Shop is reached through its row (a page under More).

   Browser: window.PlayerMore. Node tests: tests/more-patch-a.test.js.

   Usage:
     var m = PlayerMore.mount(el, data, handlers);   // renders the More list into el
     m.update(newData);                               // re-render with new data
     m.show('settings');                              // open a panel directly (tests, deep links)
     m.destroy();                                     // remove the click listener

   data (all optional, safe defaults):
     me:       { first, lastInitial, nickname, teamPref }   teamPref: 'any' | 'blue' | 'red'
     username: the player's username (Settings > Your username)
     showMe:   true | false          (Show me to other players; default on)
     bright:   true | false          (Bright hall on)
     alertsState: 'on' | 'off' | 'blocked' | 'add-to-home' | 'unsupported' | 'no-key'   (default 'off')
     alertPrefs: { dayBefore, mvp, achievements }   each true | false (default all true)
     tonight:  { nightId, label, amount, status }            status: 'due' | 'claimed' | 'paid'
     history:  [ { nightId, label, amount, status } ]        newest first
     cfg:      window.PLAYER_APP_CONFIG (for squarePayLink)
     version:  text shown at the bottom
     skillDone: true once the skill questions are answered. Anything else shows the yellow warning under Settings.

   handlers (each optional; the shell supplies them):
     claimPaid(nightId)          -> Promise { ok, reason }   sends the "I've paid" claim (shell holds the PIN)
     saveUsername(raw)           -> Promise { ok, username } or { ok: false, reason }   reasons: bad-name, taken, blocked, too-soon, not-signed-in
     saveProfile({ nickname, teamPref }) -> Promise { ok, reason }
     saveSkill(answers)          -> Promise { ok, reason }   the skill questions, asked once (shell holds the token)
     setBright(bool)
     setShowMe(bool)             -> Promise { ok }   hides the player as "Player" when off
     setAlertPref(key, bool)     -> Promise { ok }   key: 'dayBefore' | 'mvp' | 'achievements'
     enableAlerts() -> Promise { ok, state }   turns run alerts on (asks the phone). There is no off switch.
     sendTestAlert() -> Promise { ok, reason }   one test to this player's own phones only
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
  var VERSION = 'next-72k';  // build tag shown in the More footer; bump with each build
  var NICK_MIN = 2;
  var NICK_MAX = 12;
  var PANELS = ['pay', 'details', 'alerts', 'rules', 'help', 'settings', 'skill', 'achievements', 'invite', 'account', 'reminders'];
  var PANEL_TITLE = { pay: 'Payment history', details: 'My details', alerts: 'Run alerts', rules: 'How it works', help: 'Help', settings: 'Settings',
    skill: 'Skill questions', achievements: 'Badges and milestones', invite: 'Invite a mate', account: 'My account', reminders: 'Reminders' };

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
  var HEIGHT_MIN = 53, HEIGHT_MAX = 84, HEIGHT_DEFAULT = 69;   // inches: 4 ft 5 in to 7 ft 0 in, default 5 ft 9 in

  // Extra alert switches (R65). Run alerts have no switch: the phone's own setting is the off switch.
  // R87 (d): the three extra switches are hidden until the server stores them. Re-add here when it does.
  var ALERT_PREFS = [];

  // Words for each server answer on Your username (R63: 30 day rule).
  var USERNAME_MSG = {
    'bad-name': 'Use 3 to 14 letters or numbers. Underscores are fine. No spaces.',
    'taken': 'That name is taken. Try another.',
    'blocked': 'That name is not allowed. Try another.',
    'too-soon': 'You can change your name again later. Ask the organiser to reset it.',
    'not-signed-in': 'Sign in again to change your name.'
  };

  // Words for each server answer on Send me a test alert (R69).
  var TEST_MSG = {
    'no-phone': 'This phone has no alerts set up yet. Tap Turn on run alerts first.',
    'too-soon': 'Wait 10 seconds, then try again.',
    'not-signed-in': 'Sign in again to send a test.',
    'signed-out': 'Sign in again to send a test.'
  };

  var MSG_SAVE_FAIL = 'Could not save. Check your connection and try again.';

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
      if (Number.isInteger(bi) && bi >= 0 && bi < SKILL_BEST.length) answers.best = SKILL_BEST[bi];
    }
    return { ok: true, answers: answers };
  }

  // The Settings row under More (R62). Says what is inside; the yellow line says what is still owed.
  function settingsSummary(d) {
    return d && d.skillDone === true ? 'Alerts, colours and your details' : 'Skill questions to answer';
  }

  var PAY_STATUS = {
    due:     { text: 'To pay',                       tone: 'due' },
    claimed: { text: 'Sent. The organiser will check your payment', tone: 'wait' },
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
    'Pay at the run, in cash at the desk or by card. Tap I’ve paid so the organiser knows to check.'
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
    if (!tonight) return 'No run set yet';
    return tonight.status === 'paid' ? 'This run: paid' : (tonight.status === 'claimed' ? 'This run: sent to the organiser' : 'This run: ' + (tonight.amount || 'to pay'));
  }

  function detailsSummary(me) {
    var nick = me && me.nickname ? me.nickname : (me && me.first ? me.first : '');
    return nick + ' · ' + teamLabel(me && me.teamPref);
  }

  // Alert prefs with defaults: a missing key counts as on (R65 extras default ON).
  function prefOn(d, key) {
    var p = (d && d.alertPrefs) || {};
    return p[key] !== false;
  }

  // ---------- markup (pure: data in, string out) ----------
  function switchHtml(id, on, label, sub, key) {
    return '<div class="more-row more-switch">' +
      '<span class="more-text"><span class="more-title">' + esc(label) + '</span>' +
      (sub ? '<span class="muted">' + esc(sub) + '</span>' : '') + '</span>' +
      '<button class="switch" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-act="' + id + '"' +
      (key ? ' data-key="' + esc(key) + '"' : '') + '>' + (on ? 'On' : 'Off') + '</button>' +
      '</div>';
  }

  function rowHtml(panel, title, sub) {
    return '<button class="more-row" type="button" data-go="' + panel + '">' +
      '<span class="more-text"><span class="more-title">' + esc(title) + '</span>' +
      '<span class="muted">' + esc(sub) + '</span></span></button>';
  }

  // A row that opens another tab page (Profile, Shop). Plain link, same look as a row.
  function linkRowHtml(href, title, sub) {
    return '<a class="more-row" href="' + esc(href) + '">' +
      '<span class="more-text"><span class="more-title">' + esc(title) + '</span>' +
      '<span class="muted">' + esc(sub) + '</span></span></a>';
  }

  // The More list (R62): seven rows in two groups, then Log out. Same order as before.
  function listHtml(d) {
    d = d || {};
    var version = d.version || VERSION;
    return '<h1 id="moreH">More</h1>' +
      '<p class="more-label more-head">You</p>' +
      '<div class="more-group">' +
        linkRowHtml('#profile', 'Profile', 'Your card, look and numbers') +
        rowHtml('account', 'My account', 'PIN, privacy, delete') +
        rowHtml('achievements', 'Badges and milestones', 'Badges you have earned and how close you are') +
        linkRowHtml('#shop', 'Shop', 'Looks and coins') +
        rowHtml('invite', 'Invite a mate', 'Bring someone along') +
      '</div>' +
      '<p class="more-label more-head">App</p>' +
      '<div class="more-group">' +
        (hasPastPayment(d.history) ? rowHtml('pay', 'Payment history', 'Past runs you paid for') : '') +
        rowHtml('settings', 'Settings', settingsSummary(d)) +
        rowHtml('help', 'Help', 'How it works and getting help') +
      '</div>' +
      '<button class="btn ghost more-logout" type="button" data-act="logout">Log out</button>' +
      '<p class="muted centre more-version">' + esc(NAMES.fullName) + ' · ' + esc(version) + '</p>';
  }

  // Back button. to = 'settings' for pages opened from Settings, otherwise More.
  function backHtml(to) {
    var label = to === 'settings' ? 'Back to Settings' : 'Back to More';
    return '<button class="btn ghost more-back" type="button" data-act="back" data-to="' + (to || '') + '">' + label + '</button>';
  }

  // 72g (R299): More shows past payments only, and only when there is at least one. The pay screen is Home's pay box.
  function hasPastPayment(history) {
    return (Array.isArray(history) ? history : []).some(function (h) { return h && h.status === 'paid'; });
  }
  function payPanelHtml(d) {
    var rows = historyRows(d.history).filter(function (r, i) { return d.history[i] && d.history[i].status === 'paid'; });
    var hist = rows.length
      ? '<ul class="list more-hist">' + rows.map(function (r) {
          return '<li><span>' + esc(r.label) + ' · ' + esc(r.amount) + '</span><span class="more-tone tone-' + r.tone + '">' + esc(r.text) + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="muted">No payments yet.</p>';
    return '<h1>Payment history</h1>' + hist + backHtml('');
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
          '<fieldset class="more-team"><legend class="label">Team I like to play for</legend>' + radios + '</fieldset>' +
        '<p class="muted">This is a wish, not a rule. The organiser still sets the teams at the run.</p>' +
        '<p class="more-msg" id="moreMsg" role="status" aria-live="polite">' + esc(msg || '') + '</p>' +
        '<button class="btn yellow more-save" type="button" data-act="save-details">Save</button>' +
      '</div>' + backHtml('settings');
  }

  // Your username card (61, Settings). The app checks the format; the server checks taken, blocked and the 30-day wait.
  // 72h (R305): once set, the username and name are read-only. No change control exists anywhere in the app.
  function usernameCardHtml(d) {
    var me = d.me || {};
    var fullName = [me.first || '', me.lastInitial ? me.lastInitial + '.' : ''].join(' ').trim();
    return '<div class="card">' +
      '<span class="more-label">Your username</span>' +
      '<p class="more-big">' + esc(d.username || fullName || '') + '</p>' +
      '<span class="more-label">Your name</span>' +
      '<p>' + esc(fullName) + '</p>' +
      '<p class="muted">Ask the organiser if this is wrong.</p>' +
    '</div>';
  }

  // Short label for the More list row. state comes from PlayerPush (see pwa-push.js).
  function alertsSummary(state) {
    return ({ on: 'On', off: 'Off. Tap to turn on', blocked: 'Blocked in phone settings', 'add-to-home': 'Add to Home Screen first' })[state] || 'Tap to turn on';
  }

  // Run alerts page: run alerts are always on (R65), the three extras have switches, and the test (R69).
  function alertsPanelHtml(d, testMsg) {
    var state = d.alertsState || 'off';
    var text = {
      on: 'Run alerts are always on. To turn them off, use your phone settings.',
      off: 'Not on yet. Tap the button, then Allow.',
      blocked: 'Alerts are blocked on this phone. Turn them on in your phone settings for ' + NAMES.brand + '.',
      'add-to-home': 'On iPhone, first add ' + NAMES.brand + ' to your Home Screen: tap Share, then Add to Home Screen. Open it from the icon, then tap Turn on run alerts.',
      unsupported: 'This browser cannot send run alerts. Open the app from the Home Screen or in Chrome.',
      'no-key': 'Run alerts are not set up yet.'
    }[state] || '';
    var extras = ALERT_PREFS.map(function (p) {
      return switchHtml('pref', prefOn(d, p.key), p.title, p.sub, p.key);
    }).join('');
    return '<h1>' + PANEL_TITLE.alerts + '</h1>' +
      '<div class="card"><p>' + esc(text) + '</p>' +
        (state === 'off' ? '<button class="btn yellow" type="button" data-act="alerts-on">Turn on run alerts</button>' : '') +
      '</div>' +
      '<div class="more-group">' + extras + '</div>' +
      '<div class="card">' +
        '<p class="muted">Sends one test to this phone only. Nobody else gets it.</p>' +
        '<button class="btn ghost" type="button" data-act="test-alert">Send me a test alert</button>' +
        '<p class="more-msg" id="moreTestMsg" role="status" aria-live="polite">' + esc(testMsg || '') + '</p>' +
      '</div>' + backHtml('settings');
  }

  function rulesHtml() {
    return '<p class="more-label">How it works</p><ul class="more-rules">' + RULES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
  }

  // Help holds the short rules (merged from How it works) and the desk help.
  function helpPanelHtml(d) {
    return '<h1>' + PANEL_TITLE.help + '</h1>' +
      '<div class="card">' + rulesHtml() + '</div>' +
      '<div class="card">' +
        '<p><b>Forgot your PIN?</b> Ask at the desk.</p>' +
        '<p><b>Wrong team or payment?</b> Tell the organiser at the run.</p>' +
        '<p class="muted">Version ' + esc(d.version || VERSION) + '</p>' +
      '</div>' +
      '<p class="muted more-credit">Character art: DiceBear Personas, CC BY 4.0</p>' + backHtml('');
  }

  function rulesPanelHtml() { return helpPanelHtml({}); }

  function accountPanelHtml() {
    return '<h1>' + PANEL_TITLE.account + '</h1>' + (window.PlayerMyAccount ? PlayerMyAccount.buildPanel() : '<p class="muted">Not available.</p>') + backHtml('');
  }
  // Badges and milestones (P7). The shell's badges handler asks the server; PlayerAchievements draws the grid.
  function achievementsPanelHtml() {
    return '<h1>' + PANEL_TITLE.achievements + '</h1>' +
      '<div class="card ach-page" id="moreBadges" aria-live="polite"><p class="muted">Loading your badges…</p></div>' +
      backHtml('');
  }

  function invitePanelHtml() {
    return '<h1>' + PANEL_TITLE.invite + '</h1>' +
      '<div id="moreInvite" class="more-invite"><p class="muted">Getting your link…</p></div>' +
      '<div class="card">' +
        '<p>Send a mate the ' + esc(NAMES.brand) + ' link. They sign up with their first name, last initial and a PIN, then tap Join a run.</p>' +
        '<p class="muted">Ask at the desk if they need help.</p>' +
      '</div>' + backHtml('');
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
    return '<h1>' + PANEL_TITLE.skill + '</h1>' +
      '<div class="card">' +
        '<p class="more-skill-note"><b>Answer honestly.</b> It saves time at the run: teams are built from these answers. ' +
        'The organiser checks every number. You can answer once only.</p>' +
        blocks + height + best +
        '<p class="more-msg" id="moreSkillMsg" role="status" aria-live="polite">' + esc(msg || '') + '</p>' +
        '<button class="btn yellow more-save" type="button" data-act="save-skill">Save my answers</button>' +
      '</div>' + backHtml('settings');
  }

  // The real Settings page (R62). Username on top, then My details, Bright hall, Show me, Run alerts and the Skill questions row.
  function settingsPanelHtml(d) {
    var owed = d.skillDone !== true;
    return '<h1>' + PANEL_TITLE.settings + '</h1>' +
      usernameCardHtml(d) +
      '<div class="more-group">' +
        rowHtml('details', 'My details', detailsSummary(d.me)) +
        switchHtml('bright', !!d.bright, 'Bright hall', 'Light colours for daytime') +
        switchHtml('showme', d.showMe !== false, 'Show me to other players', 'Off: you show as “Player” and nobody can tap your name') +
        rowHtml('alerts', 'Run alerts', alertsSummary(d.alertsState || 'off')) +
        rowHtml('reminders', 'Reminders', 'Off until you switch one on') +
        rowHtml('skill', 'Skill questions', owed ? 'To answer, once' : 'Done') +
      '</div>' +
      (owed ? '<p class="more-warn" role="status"><span aria-hidden="true">⚠</span> Skill questions still to answer</p>' : '') +
      backHtml('');
  }

  function skillPanelHtml(d, msg) {
    if (d.skillDone === true) {
      return '<h1>' + PANEL_TITLE.skill + '</h1>' +
        '<div class="card"><p><b>Skill questions done.</b></p>' +
        '<p class="muted">Your answers are saved. They can’t be changed. The organiser checks your number.</p></div>' + backHtml('settings');
    }
    return skillFormHtml(msg);
  }

  function feetInches(n) { return Math.floor(n / 12) + ' ft ' + (n % 12) + ' in'; }

  function panelHtml(panel, d, msg, testMsg) {
    d = d || {};
    if (panel === 'account') return accountPanelHtml();
    if (panel === 'pay') return payPanelHtml(d);
    if (panel === 'details') return detailsPanelHtml(d, msg);
    if (panel === 'alerts') return alertsPanelHtml(d, testMsg);
    if (panel === 'rules') return rulesPanelHtml();
    if (panel === 'help') return helpPanelHtml(d);
    if (panel === 'settings') return settingsPanelHtml(d);
    if (panel === 'skill') return skillPanelHtml(d, msg);
    if (panel === 'achievements') return achievementsPanelHtml();
    if (panel === 'invite') return invitePanelHtml();
    if (panel === 'reminders') return '<h1>' + PANEL_TITLE.reminders + '</h1><div id="morePushBox"></div>';
    return listHtml(d);
  }

  // ---------- mount (browser) ----------
  function mount(el, data, handlers) {
    var st = { data: data || {}, panel: '', msg: '', test: '', focus: false };
    var h = handlers || {};

    function payBox() {
      var box = el.querySelector('#morePayBox');
      var t = st.data.tonight;
      if (!box || !t || t.status !== 'due') return;
      var PP = G.PlayerPay;
      if (!PP) return;
      var cfg = st.data.cfg || G.PLAYER_APP_CONFIG || {};
      // The shell's claimPaid handler holds the PIN for this run. More never sees it.
      PP.render(box, {
        cfg: cfg,
        // The shell sends the claim with the sign-in token it holds. The token passed here is only a marker.
        backend: {
          claimPaid: function (token, nightId) { return h.claimPaid ? h.claimPaid(nightId) : Promise.resolve({ ok: false, reason: 'no-night' }); },
          // r196j: the card path needs the Square link and the paid check (pay.js calls both).
          payLink: function (token, nightId) { return h.payLink ? h.payLink(token, nightId) : Promise.resolve({ ok: false, reason: 'error' }); },
          paymentStatus: function (token, nightId) { return h.paymentStatus ? h.paymentStatus(token, nightId) : Promise.resolve({ ok: false }); }
        },
        nightId: t.nightId,
        night: { price: t.amount },
        me: st.data.me,
        pin: 'session',
        token: 'shell'
      });
    }

    function paint() {
      el.innerHTML = st.panel ? panelHtml(st.panel, st.data, st.msg, st.test) : listHtml(st.data);
      if (st.panel === 'pay') payBox();
      if (st.panel === 'reminders' && h.reminders) h.reminders(el.querySelector('#morePushBox'));
      if (st.panel === 'invite' && h.invite) h.invite(el.querySelector('#moreInvite'));
      if (st.panel === 'achievements') loadBadges();
      if (st.focus) {
        var h1 = el.querySelector('h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); }
        st.focus = false;
      }
    }

    // Fills the badges page. Shows a plain message when the server cannot answer.
    function loadBadges() {
      var box = el.querySelector('#moreBadges');
      if (!box) return;
      var PA = G.PlayerAchievements;
      if (!PA || !h.badges) { box.innerHTML = '<p class="muted">Badges are not available right now.</p>'; return; }
      Promise.resolve(h.badges()).then(function (r) {
        if (!box.isConnected) return;
        if (!r || !r.ok) { box.innerHTML = '<p class="muted">Could not load your badges. Try again in a minute.</p>'; return; }
        var rows = PA.merge(r.badges);
        var sum = PA.summary(rows);
        box.innerHTML = '<p class="ach-sum"><b>' + sum.earned + ' of ' + sum.total + '</b> badges earned</p><div class="ach-box"></div>';
        PA.render(box.querySelector('.ach-box'), rows);
      }, function () {
        if (box.isConnected) box.innerHTML = '<p class="muted">Could not load your badges. Try again in a minute.</p>';
      });
    }

    function go(panel) {
      st.panel = PANELS.indexOf(panel) > -1 ? panel : '';
      st.msg = '';
      st.test = '';
      st.focus = !!st.panel;
      paint();
      if (!st.panel) { var b = el.querySelector('[data-go]'); if (b) b.focus(); }
    }

    function saveDetails() {
      var picked = el.querySelector('input[name="moreTeam"]:checked');
      var teamPref = picked ? picked.value : 'any';
      // 72h: the nickname is no longer editable, so the save keeps the one on file.
      var next = { nickname: (st.data.me && st.data.me.nickname) || '', teamPref: teamPref };
      st.msg = 'Saving…';
      paint();
      Promise.resolve(h.saveProfile ? h.saveProfile(next) : { ok: true }).then(function (r) {
        if (r && r.ok) {
          st.data.me = Object.assign({}, st.data.me || {}, next);
          st.msg = 'Saved.';
        } else {
          st.msg = MSG_SAVE_FAIL;
        }
        paint();
      }).catch(function () {
        st.msg = MSG_SAVE_FAIL;
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
          say(MSG_SAVE_FAIL);
        }
      }).catch(function () {
        say(MSG_SAVE_FAIL);
      });
    }

    // Switches flip at once and go back if the shell says no.
    function flip(key, next, fn) {
      var prev = key.get();
      key.set(next);
      paint();
      Promise.resolve(fn ? fn(next) : { ok: true }).then(function (r) {
        if (!(r && r.ok)) { key.set(prev); paint(); }
      }).catch(function () { key.set(prev); paint(); });
    }

    function testAlert() {
      st.test = 'Sending…';
      paint();
      Promise.resolve(h.sendTestAlert ? h.sendTestAlert() : { ok: false, reason: 'error' }).then(function (r) {
        st.test = (r && r.ok) ? 'Sent. It should reach this phone in a moment.' : ((r && TEST_MSG[r.reason]) || MSG_SAVE_FAIL);
        paint();
      }).catch(function () {
        st.test = MSG_SAVE_FAIL;
        paint();
      });
    }

    function onClick(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-go],[data-act]') : null;
      if (!t) return;
      if (t.hasAttribute('data-go')) return go(t.getAttribute('data-go'));
      var act = t.getAttribute('data-act');
      if (act === 'back') return go(t.getAttribute('data-to') || '');
      if (act === 'save-skill') return saveSkill();
      if (act === 'bright') {
        st.data.bright = !st.data.bright;
        if (h.setBright) h.setBright(st.data.bright);
        return paint();
      }
      if (act === 'showme') {
        return flip({
          get: function () { return st.data.showMe !== false; },
          set: function (v) { st.data.showMe = v; }
        }, !(st.data.showMe !== false), h.setShowMe);
      }
      if (act === 'pref') {
        var key = t.getAttribute('data-key');
        return flip({
          get: function () { return prefOn(st.data, key); },
          set: function (v) {
            var prefs = Object.assign({}, st.data.alertPrefs || {});
            prefs[key] = v;
            st.data.alertPrefs = prefs;
          }
        }, !prefOn(st.data, key), function (v) { return h.setAlertPref ? h.setAlertPref(key, v) : { ok: true }; });
      }
      if (act === 'test-alert') return testAlert();
      // Run alerts can only be turned ON here (no off switch). The app updates this panel when the phone answers.
      if (act === 'alerts-on') {
        if (h.enableAlerts) h.enableAlerts();
        return;
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
      // Leaving More: the next visit opens the More list, not the last panel.
      reset: function () { st.panel = ''; st.msg = ''; st.test = ''; st.focus = false; paint(); },
      show: function (panel) { go(panel); },
      destroy: function () { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.innerHTML = ''; }
    };
  }

  return {
    VERSION: VERSION,
    RULES: RULES,
    TEAM_OPTIONS: TEAM_OPTIONS,
    PAY_STATUS: PAY_STATUS,
    ALERT_PREFS: ALERT_PREFS,
    PANELS: PANELS,
    USERNAME_MSG: USERNAME_MSG,
    TEST_MSG: TEST_MSG,
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
    alertsSummary: alertsSummary,
    prefOn: prefOn,
    mount: mount
  };
});
