/* ============================================================================
 * top-players-widget.js  —  Populates the right-side "Top Players" widget on
 * every sport page with REAL rankings from the backend API.  All filter buttons
 * are activated and re-fetch data when clicked.  Falls back to the static
 * top-players-fallback.js data if the backend is unreachable.
 * ==========================================================================*/
(function () {
  "use strict";

  const API_BASE = window.FC_API ? window.FC_API.http() : (location.origin.includes('localhost') ? 'http://localhost:5000' : location.origin);

  // Map page filename -> sport id used by the API.
  const PAGE_SPORT = {
    cricket: "cricket", football: "football", basketball: "basketball",
    tennis: "tennis", hockey: "hockey", baseball: "baseball",
    vollyeball: "volleyball", kabbaddi: "kabbaddi",
    "e-sports": "e-sports", tabletennis: "table-tennis"
  };

  // Per-sport filter definitions (label + API category key).
  // Category keys MUST match the keys in data/player-rankings.json.
  const SPORT_FILTERS = {
    cricket: [
      { label: "Run Scorers", cat: "odi_bat_men" },
      { label: "Wicket Takers", cat: "odi_bowl_men" },
      { label: "Most Sixes", cat: "odi_bat_men_sixes" }
    ],
    football: [
      { label: "Top Scorers", cat: "scorers_men" },
      { label: "Top Assists", cat: "assists_men" },
      { label: "Top Rated", cat: "rating_men" }
    ],
    basketball: [
      { label: "Points", cat: "points" },
      { label: "Rebounds", cat: "rebounds" },
      { label: "Assists", cat: "assists" }
    ],
    tennis: [
      { label: "ATP Singles", cat: "atp_singles" },
      { label: "WTA Singles", cat: "wta_singles" }
    ],
    hockey: [
      { label: "Goals", cat: "goals_men" },
      { label: "Assists", cat: "assists_men" },
      { label: "Goals (W)", cat: "goals_women" }
    ],
    baseball: [
      { label: "Home Runs", cat: "hr" },
      { label: "Best AVG", cat: "avg" },
      { label: "RBI", cat: "rbi" }
    ],
    volleyball: [
      { label: "Points", cat: "points_men" },
      { label: "Spikes", cat: "spikes_men" },
      { label: "Blocks", cat: "blocks_men" }
    ],
    kabbaddi: [
      { label: "Raid Points", cat: "raid" },
      { label: "Tackle Points", cat: "tackle" },
      { label: "All-Round", cat: "allround" }
    ],
    "e-sports": [
      { label: "All", cat: "all" },
      { label: "Valorant", cat: "valorant" },
      { label: "League of Legends", cat: "lol" }
    ],
    "table-tennis": [
      { label: "Men's Singles", cat: "singles_men" },
      { label: "Women's Singles", cat: "singles_women" }
    ]
  };

  // Which stat key to show as the right-hand value per sport.
  const STAT_KEY = {
    cricket: "runs", football: "goals", basketball: "points",
    tennis: "points", hockey: "goals", baseball: "hr",
    volleyball: "points", kabbaddi: "raid_pts", "e-sports": "earnings",
    "table-tennis": "points"
  };
  const STAT_LABEL = {
    cricket: "Runs", football: "Goals", basketball: "PTS",
    tennis: "Pts", hockey: "Goals", baseball: "HR",
    volleyball: "Pts", kabbaddi: "Raid", "e-sports": "$M",
    "table-tennis": "Pts"
  };

  function getSportFromPage() {
    const path = window.location.pathname.split("/").pop().replace(".html", "");
    return PAGE_SPORT[path] || null;
  }

  function flagURL(country) {
    const MAP = {
      "India": "in", "Australia": "au", "England": "gb-eng", "New Zealand": "nz",
      "South Africa": "za", "Pakistan": "pk", "Sri Lanka": "lk", "West Indies": "tt",
      "Bangladesh": "bd", "Afghanistan": "af", "China": "cn", "Japan": "jp",
      "Germany": "de", "France": "fr", "Spain": "es", "Brazil": "br",
      "USA": "us", "Argentina": "ar", "Portugal": "pt", "Italy": "it"
    };
    const code = MAP[country];
    return code ? "https://flagcdn.com/16x12/" + code + ".png" : null;
  }

  function avatar(name) {
    return "https://ui-avatars.com/api/?name=" + encodeURIComponent((name || "?").replace(/\s+/g, "+")) +
      "&background=10b981&color=fff&size=64&bold=true";
  }

  function renderWidget(sport, players, statKey, statLabel, activeCat) {
    const widget = document.querySelector('[data-purpose="top-players-widget"]');
    if (!widget) return;
    const filterBar = widget.querySelector('[data-role="filters"]');
    const list = widget.querySelector('[data-role="list"]');

    // Render filter buttons only once (or when sport changes).
    if (filterBar && SPORT_FILTERS[sport]) {
      // If buttons already exist, just update active state.
      const existing = filterBar.querySelectorAll("button");
      if (existing.length === SPORT_FILTERS[sport].length && !activeCat) {
        // Already rendered, skip re-creating to preserve handlers.
      } else {
        filterBar.innerHTML = SPORT_FILTERS[sport].map((f, i) =>
          '<button data-cat="' + f.cat + '" class="flex-1 py-1.5 text-[10px] font-bold rounded-md ' +
          (i === 0 ? "bg-emerald-accent/10 border border-emerald-accent text-emerald-accent" : "text-gray-500 hover:text-white") +
          '">' + f.label + '</button>'
        ).join("");
        filterBar.querySelectorAll("button").forEach(btn => {
          btn.addEventListener("click", () => {
            // Update active state immediately.
            filterBar.querySelectorAll("button").forEach(b => {
              b.className = "flex-1 py-1.5 text-[10px] font-bold rounded-md text-gray-500 hover:text-white";
            });
            btn.className = "flex-1 py-1.5 text-[10px] font-bold rounded-md bg-emerald-accent/10 border border-emerald-accent text-emerald-accent";
            loadAndRender(sport, btn.dataset.cat, btn.dataset.cat);
          });
        });
      }
    }

    // Update active button if activeCat provided.
    if (filterBar && activeCat) {
      filterBar.querySelectorAll("button").forEach(b => {
        if (b.dataset.cat === activeCat) {
          b.className = "flex-1 py-1.5 text-[10px] font-bold rounded-md bg-emerald-accent/10 border border-emerald-accent text-emerald-accent";
        } else {
          b.className = "flex-1 py-1.5 text-[10px] font-bold rounded-md text-gray-500 hover:text-white";
        }
      });
    }

    // Render player list.
    if (!list) return;
    if (!players || !players.length) {
      list.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">No players found</div>';
      return;
    }
    list.innerHTML = players.slice(0, 5).map((p, i) => {
      const fl = flagURL(p.country);
      const val = p[statKey] != null ? p[statKey] : (p.points != null ? p.points : "–");
      const img = p.img || avatar(p.name);
      return (
        '<div class="flex items-center justify-between group cursor-pointer" onclick="window.location.href=\'top-players.html?game=' + sport + '\'">' +
          '<div class="flex items-center space-x-3">' +
            '<span class="text-xs font-bold text-gray-500 w-3">' + (i + 1) + '</span>' +
            '<img alt="' + (p.name || "Player") + '" class="w-10 h-10 rounded-full border border-gray-700" src="' + img + '" onerror="this.src=\'' + avatar(p.name) + '\'">' +
            '<div>' +
              '<p class="text-sm font-bold">' + (p.name || "Unknown") +
                (p.team ? ' <span class="text-[10px] text-gray-500 font-normal">(' + p.team + ')</span>' : (p.country ? ' <span class="text-[10px] text-gray-500 font-normal">(' + p.country + ')</span>' : "")) +
              '</p>' +
            '</div>' +
          '</div>' +
          '<span class="text-sm font-bold">' + val + ' <span class="text-[10px] text-gray-500 font-normal">' + statLabel + '</span></span>' +
        '</div>'
      );
    }).join("");
  }

  async function loadAndRender(sport, cat, activeCat) {
    const widget = document.querySelector('[data-purpose="top-players-widget"]');
    const list = widget && widget.querySelector('[data-role="list"]');
    if (list) list.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Loading...</div>';

    const statKey = STAT_KEY[sport] || "points";
    const statLabel = STAT_LABEL[sport] || "Pts";

    try {
      const res = await fetch(API_BASE + "/api/rankings/" + sport + "/" + cat, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("rankings fetch failed");
      const data = await res.json();
      const players = data.players || [];
      renderWidget(sport, players, statKey, statLabel, activeCat || cat);
    } catch (e) {
      // Fallback to static data.
      try {
        if (window.FALLBACK && typeof window.FALLBACK.getPlayers === "function") {
          const fb = window.FALLBACK.getPlayers(sport, cat);
          if (fb && fb.length) { renderWidget(sport, fb, statKey, statLabel, activeCat || cat); return; }
        }
      } catch (_) {}
      if (list) list.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">Data unavailable</div>';
    }
  }

  function init() {
    const sport = getSportFromPage();
    if (!sport) return;
    const widget = document.querySelector('[data-purpose="top-players-widget"]');
    if (!widget) return;
    const firstCat = SPORT_FILTERS[sport] && SPORT_FILTERS[sport][0] ? SPORT_FILTERS[sport][0].cat : null;
    if (firstCat) loadAndRender(sport, firstCat);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.FANCONNECT_topPlayersWidget = { init, loadAndRender };
})();
