(function() {
  'use strict';

  const API_BASE = window.FC_API ? window.FC_API.http() : (location.origin.includes('localhost') ? 'http://localhost:5000' : location.origin);

  const SPORT_CONFIG = {
    cricket: {
      rankingEndpoint: 'cricket/odi_bat_men',
      teamEndpoint: 'cricket/ODI',
      label: 'Cricket',
      icon: 'sports_cricket',
      statCards: [
        { label: 'Top Batsman', key: 'runs', format: 'number' },
        { label: 'Top Bowler', key: 'wkts', format: 'number' },
        { label: 'Top Rating', key: 'rating', format: 'number' },
      ]
    },
    football: {
      rankingEndpoint: 'football/scorers_men',
      teamEndpoint: 'football/EPL',
      label: 'Football',
      icon: 'sports_soccer',
      statCards: [
        { label: 'Top Scorer', key: 'goals', format: 'number' },
        { label: 'Top Assists', key: 'assists', format: 'number' },
        { label: 'Best Rating', key: 'rating', format: 'decimal' },
      ]
    },
    basketball: {
      rankingEndpoint: 'basketball/points',
      teamEndpoint: 'basketball/NBA',
      label: 'Basketball',
      icon: 'sports_basketball',
      statCards: [
        { label: 'Points Leader', key: 'points', format: 'decimal' },
        { label: 'Rebounds Leader', key: 'rebounds', format: 'decimal' },
        { label: 'Assists Leader', key: 'assists', format: 'decimal' },
      ]
    },
    tennis: {
      rankingEndpoint: 'tennis/atp_singles',
      teamEndpoint: 'tennis/ATP',
      label: 'Tennis',
      icon: 'sports_tennis',
      statCards: [
        { label: 'Top Points', key: 'points', format: 'number' },
        { label: 'Most Titles', key: 'titles', format: 'number' },
        { label: 'Best Win%', key: 'winrate', format: 'decimal' },
      ]
    },
    hockey: {
      rankingEndpoint: 'hockey/goals_men',
      teamEndpoint: 'hockey/FIH Pro League',
      label: 'Hockey',
      icon: 'sports_hockey',
      statCards: [
        { label: 'Top Scorer', key: 'goals', format: 'number' },
        { label: 'Top Assists', key: 'assists', format: 'number' },
        { label: 'Best Rating', key: 'rating', format: 'number' },
      ]
    },
    baseball: {
      rankingEndpoint: 'baseball/hr',
      teamEndpoint: 'baseball/MLB',
      label: 'Baseball',
      icon: 'sports_baseball',
      statCards: [
        { label: 'HR Leader', key: 'hr', format: 'number' },
        { label: 'Best AVG', key: 'avg', format: 'decimal' },
        { label: 'RBI Leader', key: 'rbi', format: 'number' },
      ]
    },
    volleyball: {
      rankingEndpoint: 'volleyball/points_men',
      label: 'Volleyball',
      icon: 'sports_volleyball',
      statCards: [
        { label: 'Top Scorer', key: 'points', format: 'number' },
        { label: 'Best Spiker', key: 'spikes', format: 'number' },
        { label: 'Best Blocker', key: 'blocks', format: 'number' },
      ]
    },
    kabbaddi: {
      rankingEndpoint: 'kabbaddi/raid',
      label: 'Kabaddi',
      icon: 'sports_kabaddi',
      statCards: [
        { label: 'Raid Leader', key: 'raid_pts', format: 'number' },
        { label: 'Tackle Leader', key: 'tackle_pts', format: 'number' },
        { label: 'Total Points', key: 'total_pts', format: 'number' },
      ]
    },
    'e-sports': {
      rankingEndpoint: 'e-sports/earnings',
      label: 'E-Sports',
      icon: 'sports_esports',
      statCards: [
        { label: 'Top Earnings', key: 'earnings', format: 'currency' },
        { label: 'Most Tourn.', key: 'tournaments', format: 'number' },
        { label: 'Best Win%', key: 'winrate', format: 'decimal' },
      ]
    },
    'table-tennis': {
      rankingEndpoint: 'table-tennis/singles_men',
      label: 'Table Tennis',
      icon: 'sports_tennis',
      statCards: [
        { label: 'Top Points', key: 'points', format: 'number' },
        { label: 'Most Titles', key: 'titles', format: 'number' },
        { label: 'Best Win%', key: 'winrate', format: 'decimal' },
      ]
    }
  };

  function formatStat(value, format) {
    if (value === undefined || value === null) return '-';
    if (format === 'currency') return '$' + parseFloat(value).toFixed(2) + 'M';
    if (format === 'decimal') return parseFloat(value).toFixed(1);
    return value;
  }

  function getSportFromPage() {
    const path = window.location.pathname.split('/').pop().replace('.html', '');
    const map = {
      'cricket': 'cricket', 'football': 'football', 'basketball': 'basketball',
      'tennis': 'tennis', 'hockey': 'hockey', 'baseball': 'baseball',
      'vollyeball': 'volleyball', 'kabbaddi': 'kabbaddi',
      'e-sports': 'e-sports', 'tabletennis': 'table-tennis'
    };
    return map[path] || null;
  }

  async function loadStats(containerId) {
    const sport = getSportFromPage();
    if (!sport) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    var cfg = SPORT_CONFIG[sport];
    if (!cfg) return;

    container.innerHTML = '<div style="display:flex;justify-content:center;padding:20px"><div style="width:24px;height:24px;border:3px solid #10b981;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div></div>';

    try {
      const healthCheck = await fetch(API_BASE + '/api/sync/status', { signal: AbortSignal.timeout(2000) });
      if (!healthCheck.ok) throw new Error('Backend down');
    } catch {
      container.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/rankings/' + cfg.rankingEndpoint, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const players = data.players || [];

      var teamData = null;
      try {
        if (cfg.teamEndpoint) {
          const tRes = await fetch(API_BASE + '/api/leaderboard/' + cfg.teamEndpoint, { signal: AbortSignal.timeout(4000) });
          if (tRes.ok) teamData = (await tRes.json()).rankings || null;
        }
      } catch {}

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;padding:16px">';

      cfg.statCards.forEach(function(card) {
        var topPlayer = players[0];
        if (card.format === 'decimal' || card.key === 'rating' || card.key === 'winrate' || card.key === 'avg') {
          players.sort(function(a,b) { return (parseFloat(b[card.key])||0) - (parseFloat(a[card.key])||0); });
          topPlayer = players[0];
        } else if (card.key === 'assists') {
          players.sort(function(a,b) { return (b.assists||0) - (a.assists||0); });
          topPlayer = players[0];
        }
        var val = topPlayer ? formatStat(topPlayer[card.key], card.format) : '-';
        var name = topPlayer ? topPlayer.name : '-';
        html += '<div style="background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;padding:14px;transition:all 0.2s">' +
          '<p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin:0 0 6px;letter-spacing:0.5px">' + card.label + '</p>' +
          '<p style="font-size:20px;font-weight:800;color:#10b981;margin:0 0 4px">' + val + '</p>' +
          '<p style="font-size:11px;color:#94a3b8;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</p>' +
        '</div>';
      });

      if (teamData && teamData.length) {
        html += '<div style="background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;padding:14px;grid-column:span 2">' +
          '<p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin:0 0 8px;letter-spacing:0.5px">🏆 Team Rankings</p>' +
          '<div style="display:flex;flex-direction:column;gap:4px">';
        teamData.slice(0, 5).forEach(function(t) {
          var trend = t.trend === 'up' ? '📈' : t.trend === 'down' ? '📉' : '➡️';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0">' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="font-size:11px;font-weight:700;color:#64748b;min-width:16px">#' + t.rank + '</span>' +
              '<span style="font-size:12px;font-weight:600;color:var(--text-color,#0f172a)">' + t.team + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="font-size:11px;font-weight:700;color:#10b981">' + t.rating + '</span>' +
              '<span style="font-size:10px">' + trend + '</span>' +
            '</div>' +
          '</div>';
        });
        html += '</div></div>';
      }

      html += '</div>';

      var dataSource = data.source || 'database';
      var sourceLabels = { icc: 'ICC', espn: 'ESPN', fifa: 'FIFA', sportscore: 'SportScore', database: 'Updated', generated: 'Estimated' };
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px 12px;border-top:1px solid var(--border-color,#e2e8f0)">' +
        '<span style="font-size:10px;color:#94a3b8">Source: ' + (sourceLabels[dataSource] || dataSource) + '</span>' +
        (data._lastSync ? '<span style="font-size:10px;color:#94a3b8">Updated: ' + new Date(data._lastSync).toLocaleString() + '</span>' : '') +
      '</div>';

      container.innerHTML = html;
    } catch (e) {
      if (container) container.innerHTML = '';
    }
  }

  function initStatsWidget(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    loadStats(containerId);
    setInterval(function() { loadStats(containerId); }, 60000);
  }

  window.initSportStats = initStatsWidget;
})();
