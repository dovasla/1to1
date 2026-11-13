// 1TO1 player app: offline bar, Add-to-Home-Screen card and service worker start.
// Plain JS. Uses no storage at all (no localStorage, sessionStorage, IndexedDB or cookies).
(function () {
  'use strict';

  // 1. Service worker. Reload once when a new version takes over from an old one.
  //    The first-ever install does not reload, so nobody loses what they were typing.
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  function mount() {
    var ua = navigator.userAgent || '';
    var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /android/i.test(ua);
    var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

    // 2. Offline bar. Shown only while the phone has no connection.
    var bar = document.createElement('div');
    bar.className = 'pwa-offline';
    bar.id = 'pwaOffline';
    bar.setAttribute('role', 'status');
    bar.textContent = 'No signal. Screens you opened before still show. New data loads when you are back online.';
    bar.hidden = navigator.onLine !== false;
    document.body.appendChild(bar);
    window.addEventListener('offline', function () { bar.hidden = false; });
    window.addEventListener('online', function () { bar.hidden = true; });

    // 3. Add-to-Home-Screen card. Not shown when the app is already installed,
    //    and not on pages with the bottom tab bar (it would sit on top of the tabs).
    if (isStandalone || document.querySelector('.tabs')) return;

    var card = document.createElement('div');
    card.className = 'pwa-install';
    card.id = 'pwaInstall';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Add to home screen');
    card.hidden = true;

    var text = document.createElement('p');
    text.className = 'pwa-install-text';
    text.id = 'pwaInstallText';

    var actions = document.createElement('div');
    actions.className = 'pwa-install-actions';

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'pwa-btn pwa-yes';
    yes.id = 'pwaInstallBtn';
    yes.textContent = 'Install';
    yes.hidden = true;

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'pwa-btn pwa-no';
    no.textContent = 'Not now';

    actions.appendChild(yes);
    actions.appendChild(no);
    card.appendChild(text);
    card.appendChild(actions);
    document.body.appendChild(card);

    var deferred = null;

    function show(message) {
      text.textContent = message;
      card.hidden = false;
      document.body.classList.add('pwa-pad');
    }
    function hide() {
      card.hidden = true;
      document.body.classList.remove('pwa-pad');
    }

    if (isIOS) {
      show('Add 1TO1 to your home screen. Tap Share (the box with an arrow) at the bottom of Safari, then Add to Home Screen.');
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      // Chrome on Android: keep the event and show a one-tap Install button.
      e.preventDefault();
      deferred = e;
      if (isIOS) return;
      show('Add 1TO1 to your home screen. It opens like an app and keeps your last screens with no signal.');
      yes.hidden = false;
    });

    if (!isIOS && isAndroid) {
      // Fallback for Chrome when it has not offered the one-tap button.
      setTimeout(function () {
        if (!deferred && card.hidden) {
          show('Add 1TO1 to your home screen. In Chrome, tap the three dots, then Add to Home screen.');
        }
      }, 4000);
    }

    yes.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; hide(); });
    });
    no.addEventListener('click', hide);
    window.addEventListener('appinstalled', hide);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
