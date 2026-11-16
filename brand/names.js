/* Check Ball names (player app). The ONLY place player-facing words live.
   Source: revamp/NAMES-AND-RULES-AUDIT-15NOV.md, brand/options/names.json, and the Check Ball rename (the organiser approved, R93).
   Screens read NAMES.<key> in script, and HTML uses <span data-name="key"> (dotted keys like tabs.home).
   applyNames() fills those once the page has loaded. Storage keys are not here: they are not visible copy. */
(function (root) {
  var NAMES = Object.freeze({
    brand: 'Check Ball',
    fullName: 'Check Ball',
    tagline: 'Check. Game on.',
    tabs: Object.freeze({ home: 'Home', live: 'Live', stats: 'Stats', more: 'More' }),
    session: 'Run',
    joinSession: 'Join a run',
    sessionOpen: 'Run open',
    lastSession: 'Last run',
    sessionAlerts: 'Run alerts',
    sessions: 'Runs',
    sessionXp: 'Run XP',
    board: 'Stats',
    profile: 'Profile',
    playerCard: 'Player card',
    youAndThem: 'You and them',
    compare: 'Compare',
    court: 'The court',
    seeCourt: 'See the court',
    character: 'Character',
    changeLook: 'Change look',
    achievements: 'Achievements',
    shop: 'Shop',
    coins: 'Coins',
    level: 'Level',
    xp: 'XP',
    stars: 'Stars',
    games: 'Games',
    inviteMate: 'Invite a mate',
    payments: 'Payments',
    settings: 'Settings',
    help: 'Help',
    paid: 'Paid',
    owes: 'Owes',
    pass: 'Pass',
    team: 'Team',
    bench: 'Bench',
    teamChange: 'Team change',
    brightMode: 'Bright mode',
    imIn: "I'm in",
    cantMakeIt: "Can't make it"
  });

  // Fills every [data-name] element on the page, plus the page title and the Apple app title.
  function applyNames(doc) {
    var d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return;
    var els = d.querySelectorAll('[data-name]');
    for (var i = 0; i < els.length; i++) {
      var value = valueOf(els[i].getAttribute('data-name'));
      if (value !== undefined) els[i].textContent = value;
    }
    var title = d.querySelector('title[data-name]');
    if (title) title.textContent = NAMES.fullName;
    var apple = d.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute('content', NAMES.brand);
  }

  function valueOf(key) {
    var parts = String(key).split('.');
    var v = NAMES;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return typeof v === 'string' ? v : undefined;
  }

  root.NAMES = NAMES;
  root.applyNames = applyNames;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { applyNames(document); });
    else applyNames(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
