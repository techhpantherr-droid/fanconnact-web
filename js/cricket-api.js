/* ============================================================================
 * FanConnact - real Cricket Match Center API client
 * Browser -> local Node/Express proxy -> Cricket provider
 * REAL DATA ONLY. No dummy/random/fallback match data.
 * ========================================================================== */
(function () {
  'use strict';

 const BASE = (window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin + '/api')) + '/matches';

  async function get(path) {
    const response = await fetch(BASE + path, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Match API ${response.status}: ${path}`);
    }

    return response.json();
  }

  const api = {
    getMatch(id) {
      return get(`/${encodeURIComponent(id)}`);
    },

    getCommentary(id, iid = 1) {
      return get(`/${encodeURIComponent(id)}/commentary?iid=${encodeURIComponent(iid)}`);
    },

    getHCommentary(id, iid = 1) {
      return get(`/${encodeURIComponent(id)}/hcommentary?iid=${encodeURIComponent(iid)}`);
    },

    getScorecard(id) {
      return get(`/${encodeURIComponent(id)}/scorecard`);
    },

    getSquads(id) {
      return get(`/${encodeURIComponent(id)}/squads`);
    },

    getOvers(id, iid = 1) {
      return get(`/${encodeURIComponent(id)}/overs?iid=${encodeURIComponent(iid)}`);
    },

    getOverDetails(id, iid = 1) {
      return get(`/${encodeURIComponent(id)}/overs/details?iid=${encodeURIComponent(iid)}`);
    },

    getHighlights(id) {
      return get(`/${encodeURIComponent(id)}/highlights`);
    },

    getOversGraph(id) {
      return get(`/${encodeURIComponent(id)}/oversGraph`);
    },

    getBallsGraph(id, iid = 1) {
      return get(`/${encodeURIComponent(id)}/ballsGraph?iid=${encodeURIComponent(iid)}`);
    },

    getPartnershipGraph(id) {
      return get(`/${encodeURIComponent(id)}/partnershipGraph`);
    },

    getNews(lastId = 0) {
      return get(`/news${lastId ? `?lastId=${encodeURIComponent(lastId)}` : ''}`);
    }
  };

  window.FANCONNECT_CRICKET_API = api;
})();
