/* Check Ball player app: reminder switches in More (P4, was N11). Three switches in More, all off until the player says yes.
   Global: window.PlayerReminders = { KINDS, LABELS, create, render }. Node: module.exports.
   - create(deps) returns a controller. Nothing is asked or sent until a switch is turned on.
   - Permission is asked only after a switch is turned on, and only after the app is on the Home Screen on iPhone.
   - deps (all injected, so this file has no network):
       env: { pushSupported, isIOS, isStandalone }
       permission() -> 'default' | 'granted' | 'denied';  requestPermission() -> Promise<same>
       getSubscription() -> Promise<{ endpoint, keys } | null>;  subscribe() -> Promise<{ endpoint, keys }>
       save(sub, kinds) -> Promise (player_push_save);  remove(endpoint) -> Promise (player_push_remove)
   - Results: { ok:true, kinds } or { ok:false, reason: 'needs-install' | 'unsupported' | 'denied' | 'save-failed' }.
   All text is set with textContent. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerReminders = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = ['tonight', 'pay', 'recap'];
  var LABELS = {
    tonight: 'Morning of the run',
    pay: 'Two hours before, if you are not paid',
    recap: 'When your recap is ready'
  };
  var REASON_TEXT = {
    'needs-install': 'On iPhone, add Check Ball to your Home Screen first. Then switch this on.',
    'unsupported': 'This phone cannot show reminders.',
    'denied': 'Notifications are blocked. Turn them on in your phone settings.',
    'save-failed': 'Could not save. Try again.'
  };

  function create(deps) {
    var kinds = { tonight: false, pay: false, recap: false };

    function availability() {
      if (!deps.env || !deps.env.pushSupported) return 'unsupported';
      if (deps.env.isIOS && !deps.env.isStandalone) return 'needs-install';
      return 'ok';
    }
    function on() { return KINDS.filter(function (k) { return kinds[k]; }); }

    // Starts from what the server already has (called once after sign-in).
    function hydrate(list) {
      KINDS.forEach(function (k) { kinds[k] = (list || []).indexOf(k) !== -1; });
    }

    function turnOn(kind) {
      var avail = availability();
      if (avail !== 'ok') return Promise.resolve({ ok: false, reason: avail });
      var perm = deps.permission();
      var asked = perm === 'granted' ? Promise.resolve(perm) : deps.requestPermission();
      return asked.then(function (answer) {
        if (answer !== 'granted') return { ok: false, reason: 'denied' };
        return deps.getSubscription().then(function (sub) { return sub || deps.subscribe(); })
          .then(function (sub) {
            kinds[kind] = true;
            return deps.save(sub, on()).then(function () {
              return { ok: true, kinds: on() };
            });
          });
      }).catch(function () {
        kinds[kind] = false;
        return { ok: false, reason: 'save-failed' };
      });
    }

    function turnOff(kind) {
      kinds[kind] = false;
      return deps.getSubscription().then(function (sub) {
        if (!sub) return { ok: true, kinds: on() };
        if (on().length === 0) return deps.remove(sub.endpoint).then(function () { return { ok: true, kinds: [] }; });
        return deps.save(sub, on()).then(function () { return { ok: true, kinds: on() }; });
      }).catch(function () {
        kinds[kind] = true;
        return { ok: false, reason: 'save-failed' };
      });
    }

    function setKind(kind, want) {
      if (KINDS.indexOf(kind) === -1) return Promise.reject(new Error('unknown kind'));
      return want ? turnOn(kind) : turnOff(kind);
    }

    return {
      hydrate: hydrate,
      setKind: setKind,
      availability: availability,
      state: function () { return { availability: availability(), kinds: { tonight: kinds.tonight, pay: kinds.pay, recap: kinds.recap } }; }
    };
  }

  // Builds the three switches into host. controller is from create(). onResult(result) is optional.
  function render(host, controller, onResult) {
    host.replaceChildren();
    var st = controller.state();
    var note = document.createElement('p');
    note.className = 'pp-note';
    note.setAttribute('aria-live', 'polite');
    if (st.availability !== 'ok') note.textContent = REASON_TEXT[st.availability];
    KINDS.forEach(function (kind) {
      var row = document.createElement('div');
      row.className = 'pp-row';
      var label = document.createElement('span');
      label.className = 'pp-label';
      label.textContent = LABELS[kind];
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'pp-switch';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-label', LABELS[kind]);
      var on = !!st.kinds[kind];
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      sw.textContent = on ? 'On' : 'Off';
      sw.addEventListener('click', function () {
        var want = sw.getAttribute('aria-checked') !== 'true';
        sw.disabled = true;
        controller.setKind(kind, want).then(function (res) {
          sw.disabled = false;
          var now = controller.state().kinds[kind];
          sw.setAttribute('aria-checked', now ? 'true' : 'false');
          sw.textContent = now ? 'On' : 'Off';
          note.textContent = res.ok ? '' : REASON_TEXT[res.reason] || '';
          if (onResult) onResult(res);
        });
      });
      row.appendChild(label);
      row.appendChild(sw);
      host.appendChild(row);
    });
    host.appendChild(note);
  }

  return { KINDS: KINDS, LABELS: LABELS, REASON_TEXT: REASON_TEXT, create: create, render: render };
});
