/* ============================================================================
 * FanConnact - Shared API Configuration
 * Single source of truth for all API and WebSocket base URLs.
 * Detects environment automatically:
 *   - Dev (localhost / 127.0.0.1 / file://): uses localhost:5000 / ws://localhost:3001
 *   - Production (any other host): uses same origin for HTTP, wss:// for WS
 * ========================================================================== */
(function () {
  'use strict';

  var isDev = location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:';

  var HTTP_PORT = 5000;
  var WS_PORT = 3001;

  function httpBase() {
    if (isDev) return 'http://localhost:' + HTTP_PORT;
    return location.origin;
  }

  function apiBase() {
    return httpBase() + '/api';
  }

  function wsBase() {
    if (isDev) return 'ws://localhost:' + WS_PORT;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host;
  }

  window.FC_API = {
    http: httpBase,
    api: apiBase,
    ws: wsBase,
    isDev: isDev
  };
})();
