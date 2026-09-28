(function () {
  if (window.__fcSeoFooter__) return;
  window.__fcSeoFooter__ = true;
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("fc-seo-footer")) return;

    var year = new Date().getFullYear();
    var sportLinks = [
      ["cricket.html", "Cricket"],
      ["football.html", "Football"],
      ["basketball.html", "Basketball"],
      ["tennis.html", "Tennis"],
      ["e-sports.html", "E-Sports"],
      ["vollyeball.html", "Volleyball"],
      ["kabbaddi.html", "Kabaddi"],
      ["hockey.html", "Hockey"],
      ["baseball.html", "Baseball"],
      ["tabletennis.html", "Table Tennis"],
    ];
    var coreLinks = [
      ["index.html", "Home"],
      ["livematches.html", "Live Matches"],
      ["match-center.html", "Match Center"],
      ["news&update.html", "News & Updates"],
      ["top-players.html", "Top Players"],
      ["leaderboard.html", "Leaderboard"],
      ["fancoin.html", "Fan Coins"],
    ];

    function links(arr) {
      return arr
        .map(function (x) {
          return '<a href="' + x[0] + '" class="fc-footer-link">' + x[1] + "</a>";
        })
        .join("");
    }

    var style =
      "#fc-seo-footer{position:relative;z-index:20;background:var(--bg-card,#0f172a);border-top:1px solid var(--border-subtle,rgba(148,163,184,.2));padding:28px 20px 18px;margin-top:40px;font-family:Lexend,system-ui,sans-serif;}" +
      "#fc-seo-footer .fc-footer-wrap{max-width:1150px;margin:0 auto;text-align:center;}" +
      "#fc-seo-footer .fc-footer-head{color:#2196f3;font-weight:700;font-size:15px;letter-spacing:.4px;margin-bottom:12px;}" +
      "#fc-seo-footer .fc-footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:14px;}" +
      "#fc-seo-footer .fc-footer-link{color:currentColor;opacity:.82;text-decoration:none;font-size:13px;padding:5px 12px;border:1px solid rgba(148,163,184,.25);border-radius:999px;transition:.2s;}" +
      "#fc-seo-footer .fc-footer-link:hover{color:#2196f3;border-color:#2196f3;opacity:1;}" +
      "#fc-seo-footer .fc-footer-copy{font-size:12px;opacity:.55;}";

    var el = document.createElement("div");
    el.id = "fc-seo-footer";
    el.setAttribute("data-purpose", "seo-footer");
    el.innerHTML =
      "<style>" + style + "</style>" +
      '<div class="fc-footer-wrap">' +
      '<div class="fc-footer-head">Fanconnact &bull; Live Sports Scores &amp; Fan Community</div>' +
      '<div class="fc-footer-links">' + links(coreLinks) + links(sportLinks) + "</div>" +
      '<div class="fc-footer-copy">&copy; ' + year + " Fanconnact. All rights reserved. Live sports scores, rankings and fan coins for cricket, football, e-sports and more.</div>" +
      "</div>";
    document.body.appendChild(el);
  });
})();