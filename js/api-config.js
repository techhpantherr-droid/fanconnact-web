/* ============================================================================
 * FanConnact - Shared API Configuration
 * Single source of truth for all API and WebSocket base URLs.
 * Detects environment automatically:
 *   - Dev (localhost / 127.0.0.1 / file://): uses localhost:5000 (HTTP + WS)
 *   - Production (any other host): uses same origin for HTTP, wss:// for WS
 * ========================================================================== */
(function () {
  'use strict';

  var isDev = location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:';

  // GitHub Pages (github.io) frontend talks to the deployed Railway backend.
  var BACKEND_ORIGIN = 'https://web-production-589a7.up.railway.app';
  var isGitHubPages = /\.github\.io$/.test(location.hostname);

  var HTTP_PORT = 5000;

  function httpBase() {
    if (isDev) return 'http://localhost:' + HTTP_PORT;
    if (isGitHubPages) return BACKEND_ORIGIN;
    return location.origin;
  }

  function apiBase() {
    return httpBase() + '/api';
  }

  function wsBase() {
    if (isDev) return 'ws://localhost:' + HTTP_PORT;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + ((isGitHubPages ? BACKEND_ORIGIN : location.origin)).replace(/^https?:\/\//, '');
  }

  window.FC_API = {
    http: httpBase,
    api: apiBase,
    ws: wsBase,
    isDev: isDev
  };
})();
