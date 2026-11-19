/**
 * gobizit.ai equivalent of the gobizit.com WPCode snippet.
 *
 * Same rules: greet only after 3 minutes on the website (any page), and the
 * greeting is chosen server-side for the CURRENT page, so English pages get
 * English text and /es/ pages get Spanish text.
 *
 * Test shortcut: add ?wv_catalyst=1 to use a 15-second wait instead of 180s.
 * Set ENDPOINT to the deployed function URL before publishing.
 *
 * Also copies <meta name="wv-greeting"> into visitor.info when present.
 */
(function () {
  'use strict';

  // REPLACE this after the Catalyst function is deployed.
  // Production:  https://{project_domain}.catalystserverless.com/server/wv-greeting/greet
  // Development: https://{project_domain}.development.catalystserverless.com/server/wv-greeting/greet
  var ENDPOINT = 'https://wv-greetings-714119021.development.catalystserverless.com/server/wv-greeting/greet';

  var WAIT_MS = 180000;
  var TEST_WAIT_MS = 15000;
  var TEST_PARAM = 'wv_catalyst';
  var FIRST_SEEN_KEY = 'wv_site_first_seen';
  var SENT_KEY = 'wv_greet_sent';
  var SITE = 'gobizit.ai';
  var ALLOWED_HOSTS = ["gobizit.ai", "www.gobizit.ai"];

  /**
   * uvid (unconfirmed mapping — must be proven on the first test):
   *
   * Official JS API, used first:
   *   $zoho.salesiq.visitor.uniqueuserid()
   *   "get the unique user id (UUID) of the visitor once tracking has begun."
   *   https://www.zoho.com/salesiq/help/developer-section/js-api-unique-user-id.html
   *   That page never uses the word "uvid".
   *
   * Official REST field:
   *   uvid — "Unique visitor ID of the website visitor to invite."
   *   https://www.zoho.com/salesiq/help/developer-section/conversation-initiate-proactive-v2.html
   *
   * Official cookies policy, used only if uniqueuserid() is empty:
   *   {screenname}-_uuid  "provides user id needed in REST API to get the data
   *   of the current user."
   *   https://www.zoho.com/salesiq/cookies-policy.html
   *
   * Do not use $zoho.salesiq.visitor.id("…") — that SETS a custom id, it does
   * not read the SalesIQ visitor id.
   *
   * If the first test returns SalesIQ error 1015 on uvid, stop and compare
   * uniqueuserid(), the _uuid cookie, and the visitor id in the SalesIQ
   * live-view panel before any rollout.
   */

  function allowedHost(host) {
    host = String(host || '').toLowerCase();
    for (var i = 0; i < ALLOWED_HOSTS.length; i++) {
      if (ALLOWED_HOSTS[i] === host) return true;
    }
    return false;
  }

  function storageGet(key) {
    try {
      return window.sessionStorage ? sessionStorage.getItem(key) : null;
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (window.sessionStorage) sessionStorage.setItem(key, value);
    } catch (err) {}
  }

  function firstSeen() {
    var existing = storageGet(FIRST_SEEN_KEY);
    if (existing) {
      var parsed = parseInt(existing, 10);
      if (parsed > 0) return parsed;
    }
    var now = Date.now();
    storageSet(FIRST_SEEN_KEY, String(now));
    return now;
  }

  function alreadySent() {
    return storageGet(SENT_KEY) === '1';
  }

  function markSent() {
    storageSet(SENT_KEY, '1');
  }

  function waitMs() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get(TEST_PARAM) === '1') return TEST_WAIT_MS;
    } catch (err) {}
    return WAIT_MS;
  }

  function currentHost() {
    return (window.location.hostname || '').toLowerCase();
  }

  function currentPath() {
    return window.location.pathname || '/';
  }

  function cookieValue(name) {
    try {
      var parts = ('; ' + document.cookie).split('; ' + name + '=');
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift() || '');
    } catch (err) {}
    return '';
  }

  function uuidFromCookie() {
    try {
      var cookies = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < cookies.length; i++) {
        var part = cookies[i].trim();
        var eq = part.indexOf('=');
        if (eq < 0) continue;
        var name = part.slice(0, eq);
        if (name.slice(-5) === '_uuid') {
          return decodeURIComponent(part.slice(eq + 1));
        }
      }
    } catch (err) {}
    return cookieValue('kiwicrm-_uuid');
  }

  function uniqueUserId() {
    try {
      if (
        window.$zoho &&
        $zoho.salesiq &&
        $zoho.salesiq.visitor &&
        typeof $zoho.salesiq.visitor.uniqueuserid === 'function'
      ) {
        var id = $zoho.salesiq.visitor.uniqueuserid();
        if (id) return String(id);
      }
    } catch (err) {}
    return '';
  }

  function zldtFromCookie() {
    // SalesIQ REST uvid = value of the "{screenname}-_zldt" cookie (verified 19 Nov 2026:
    // PUT /conversations/proactive returned 204 for it; uniqueuserid() gave 1500 "Visitor Left").
    try {
      var cookies = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < cookies.length; i++) {
        var part = cookies[i].trim();
        var eq = part.indexOf('=');
        if (eq < 0) continue;
        if (part.slice(0, eq).slice(-6) === '-_zldt') {
          return decodeURIComponent(part.slice(eq + 1));
        }
      }
    } catch (err) {}
    return '';
  }

  function getUvid() {
    return zldtFromCookie();
  }

  function setVisitorInfoFromMeta() {
    try {
      var meta = document.querySelector('meta[name="wv-greeting"]');
      var text = meta && meta.getAttribute('content');
      if (
        text &&
        window.$zoho &&
        $zoho.salesiq &&
        $zoho.salesiq.visitor &&
        typeof $zoho.salesiq.visitor.info === 'function'
      ) {
        $zoho.salesiq.visitor.info({ wv_greeting: text });
      }
    } catch (err) {}
  }

  var readyHooked = false;
  var salesiqReady = false;

  function whenSalesIqReady(callback) {
    if (salesiqReady) {
      callback();
      return;
    }
    window.$zoho = window.$zoho || {};
    $zoho.salesiq = $zoho.salesiq || { ready: function () {} };
    if (!readyHooked) {
      readyHooked = true;
      var previous = $zoho.salesiq.ready;
      $zoho.salesiq.ready = function () {
        try {
          if (typeof previous === 'function') previous.apply(this, arguments);
        } catch (err) {}
        salesiqReady = true;
        setVisitorInfoFromMeta();
        callback();
      };
    }
    var attempts = 0;
    (function poll() {
      if (salesiqReady) return;
      if (uniqueUserId() || zldtFromCookie()) {
        salesiqReady = true;
        setVisitorInfoFromMeta();
        callback();
        return;
      }
      attempts += 1;
      if (attempts < 60) setTimeout(poll, 1000);
    })();
  }

  var sendInFlight = false;

  function sendGreeting() {
    if (alreadySent() || sendInFlight) return;
    if (!allowedHost(currentHost())) return;
    if (Date.now() - firstSeen() < waitMs()) return;

    whenSalesIqReady(function () {
      if (alreadySent() || sendInFlight) return;
      var tries = 0;

      function attempt() {
        if (alreadySent() || sendInFlight) return;
        var uvid = getUvid();
        if (!uvid) {
          tries += 1;
          if (tries < 30) {
            setTimeout(attempt, 1000);
          }
          return;
        }
        sendInFlight = true;
        // Send only uvid + current host/path. Never send tokens or greeting text.
        fetch(ENDPOINT, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            uvid: uvid,
            host: currentHost(),
            path: currentPath()
          })
        })
          .then(function () {
            markSent();
          })
          .catch(function () {
            sendInFlight = false;
          });
      }

      attempt();
    });
  }

  function schedule() {
    if (!allowedHost(currentHost())) return;
    var elapsed = Date.now() - firstSeen();
    var need = waitMs();
    if (elapsed >= need) {
      sendGreeting();
      return;
    }
    setTimeout(sendGreeting, need - elapsed);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') sendGreeting();
  });

  schedule();
})();
