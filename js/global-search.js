/* ============================================================================
 * global-search.js  —  Wires up every "Search matches, players..." input
 * on the site.  Queries the backend /api/search endpoint (players + matches)
 * and shows a live dropdown.  Clicking a result navigates to the right page.
 * ==========================================================================*/
(function () {
  "use strict";

  const API_BASE = window.FC_API ? window.FC_API.http() : (location.origin.includes('localhost') ? 'http://localhost:5000' : location.origin);
  const SPORT_LABEL = {
    cricket: "Cricket", football: "Football", basketball: "Basketball",
    tennis: "Tennis", baseball: "Baseball", hockey: "Hockey",
    kabaddi: "Kabaddi", "e-sports": "E-Sports", tabletennis: "Table Tennis",
    volleyball: "Volleyball"
  };

  let activeDropdown = null;
  let debounceTimer = null;

  function closeDropdown() {
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
    }
  }

  function ensureDropdown(input) {
    closeDropdown();
    const dd = document.createElement("div");
    dd.id = "global-search-dropdown";
    dd.style.cssText =
      "position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:200;" +
      "background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);" +
      "border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.25);" +
      "max-height:420px;overflow-y:auto;padding:8px;";
    input.parentElement.style.position = "relative";
    input.parentElement.appendChild(dd);
    activeDropdown = dd;
    return dd;
  }

  function playerHref(p) {
    // Open top-players page filtered to that sport.
    const sportMap = {
      cricket: "cricket", football: "football", basketball: "basketball",
      tennis: "tennis", baseball: "baseball", hockey: "hockey",
      kabaddi: "kabbaddi", "e-sports": "e-sports",
      tabletennis: "tabletennis", volleyball: "volleyball"
    };
    const sp = sportMap[p.sport] || p.sport;
    return "top-players.html?game=" + sp;
  }

  function renderResults(dd, data, q) {
    const players = data.players || [];
    const matches = data.matches || [];
    if (!players.length && !matches.length) {
      dd.innerHTML =
        '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">' +
        'No results for "' + q + '"</div>';
      return;
    }
    let html = "";
    if (players.length) {
      html += '<p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;padding:6px 8px;letter-spacing:0.5px;">Players</p>';
      players.forEach(p => {
        const label = SPORT_LABEL[p.sport] || p.sport;
        html +=
          '<a href="' + playerHref(p) + '" class="gs-item" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;text-decoration:none;color:inherit;">' +
            '<span style="width:24px;height:24px;border-radius:50%;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">' + (p.rank || "–") + '</span>' +
            '<div style="flex:1;min-width:0;"><p style="font-size:13px;font-weight:600;color:var(--text-color,#0f172a);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</p>' +
            '<p style="font-size:11px;color:#94a3b8;margin:0;">' + label + (p.team ? " · " + p.team : "") + '</p></div>' +
            '<span style="font-size:11px;color:#10b981;font-weight:700;">' + (p.stat != null && p.stat !== "" ? p.stat : "") + '</span>' +
          '</a>';
      });
    }
    if (matches.length) {
      html += '<p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;padding:6px 8px;letter-spacing:0.5px;margin-top:4px;">Matches</p>';
      matches.forEach(m => {
        const label = SPORT_LABEL[m.sport] || m.sport;
        const statusColor = m.status === "live" ? "#ef4444" : m.status === "upcoming" ? "#eab308" : "#94a3b8";
        html +=
          '<a href="' + m.link + '" class="gs-item" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;text-decoration:none;color:inherit;">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';flex-shrink:0;"></span>' +
            '<div style="flex:1;min-width:0;"><p style="font-size:13px;font-weight:600;color:var(--text-color,#0f172a);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.home + ' vs ' + m.away + '</p>' +
            '<p style="font-size:11px;color:#94a3b8;margin:0;">' + label + (m.tournament ? " · " + m.tournament : "") + '</p></div>' +
            '<span style="font-size:10px;text-transform:uppercase;font-weight:700;color:' + statusColor + ';">' + m.status + '</span>' +
          '</a>';
      });
    }
    dd.innerHTML = html;
    dd.querySelectorAll(".gs-item").forEach(el => {
      el.addEventListener("mouseenter", () => { el.style.background = "rgba(16,185,129,0.08)"; });
      el.addEventListener("mouseleave", () => { el.style.background = "transparent"; });
    });
  }

  async function doSearch(input, q) {
    if (!q || q.length < 2) { closeDropdown(); return; }
    const dd = ensureDropdown(input);
    dd.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Searching...</div>';
    try {
      const res = await fetch(API_BASE + "/api/search?q=" + encodeURIComponent(q), { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      renderResults(dd, data, q);
    } catch (e) {
      dd.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Search unavailable</div>';
    }
  }

  function wireInput(input) {
    if (input.dataset.gsWired) return;
    input.dataset.gsWired = "1";

    input.addEventListener("input", function () {
      const q = input.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doSearch(input, q), 250);
    });
    input.addEventListener("focus", function () {
      const q = input.value.trim();
      if (q.length >= 2) doSearch(input, q);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeDropdown(); input.blur(); }
    });
  }

  function init() {
    // Wire every search input on the page.
    document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]').forEach(wireInput);
    // Close dropdown on outside click.
    document.addEventListener("click", function (e) {
      if (activeDropdown && !activeDropdown.contains(e.target) && !e.target.closest('input[placeholder*="Search"]')) {
        closeDropdown();
      }
    });
    // Close on navigation.
    window.addEventListener("beforeunload", closeDropdown);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.FANCONNECT_globalSearch = { init, closeDropdown };
})();
