// Generates sitemap-pages.xml (all content pages) for fanconnact.com.
// Usage: node scripts/build-sitemap-pages.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = "https://fanconnact.com";

const EXCLUDE = new Set(["news&update.html", "404.html", "offline.html"]);
const HIGH = new Set(["livematches.html", "match-center.html", "top-players.html", "leaderboard.html"]);
const SPORTS = new Set([
  "baseball.html", "basketball.html", "cricket.html", "e-sports.html",
  "football.html", "hockey.html", "kabbaddi.html", "tabletennis.html",
  "tennis.html", "vollyeball.html", "calendar.html", "prediction.html", "fancoin.html",
]);

const today = new Date().toISOString().slice(0, 10);

function priority(f) {
  if (f === "index.html") return "1.0";
  if (HIGH.has(f)) return "0.9";
  if (SPORTS.has(f)) return "0.8";
  return "0.6";
}

const files = readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && !EXCLUDE.has(f))
  .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));

const urls = files.map((f) => {
  const loc = f === "index.html" ? `${BASE}/` : `${BASE}/${f}`;
  return `  <url>\n    <loc>${loc.replace(/&/g, "&amp;")}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${priority(f)}</priority>\n  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
writeFileSync(join(ROOT, "sitemap-pages.xml"), xml, "utf8");
console.log("sitemap-pages.xml written with", files.length, "urls");
