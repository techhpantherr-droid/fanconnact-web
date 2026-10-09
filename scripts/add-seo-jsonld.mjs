// Adds JSON-LD (Organization, WebSite, WebPage, BreadcrumbList) to every HTML
// page's <head>. Idempotent.
// Usage: node scripts/add-seo-jsonld.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = "https://fanconnact.com";
const MARKER = "<!-- fc-seo-jsonld-v1 -->";
const STUB = "news&update.html";
const BRAND = "Fanconnact";
const ALT_NAMES = [
  "Fanconnect", "Fanconnact", "Fanconect", "Fanocnnact", "Fan Connact",
  "Fanconnet", "Fanconnact live", "Fanconnect live",
];

function pageNameFromTitle(title) {
  const t = String(title || "").split("|")[0].split("-")[0].trim();
  return t || BRAND;
}

function buildGraph(canon, title) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": BASE + "/#organization",
        name: BRAND,
        alternateName: ALT_NAMES,
        url: BASE + "/",
        logo: {
          "@type": "ImageObject",
          url: BASE + "/assets/fancoin/fanconnact-icon.png",
        },
        description:
          "Fanconnact is a live sports platform for scores, fixtures, rankings, predictions, fan coins and communities across cricket, football, basketball, e-sports, volleyball, tennis, hockey and more.",
      },
      {
        "@type": "WebSite",
        "@id": BASE + "/#website",
        url: BASE + "/",
        name: BRAND,
        alternateName: ["Fanconnect", "Fanocnnact", "Fanconect"],
        publisher: { "@id": BASE + "/#organization" },
        inLanguage: "en",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: BASE + "/livematches.html?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "WebPage",
        "@id": canon + "#webpage",
        url: canon,
        name: title,
        isPartOf: { "@id": BASE + "/#website" },
        about: { "@id": BASE + "/#organization" },
        inLanguage: "en",
        breadcrumb: { "@id": canon + "#breadcrumb" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": canon + "#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE + "/" },
          { "@type": "ListItem", position: 2, name: pageNameFromTitle(title), item: canon },
        ],
      },
    ],
  };
}

const files = readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== STUB);
let count = 0;

for (const f of files) {
  const p = join(ROOT, f);
  let html = readFileSync(p, "utf8");
  if (html.includes(MARKER)) continue;

  const canonMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const canon = (canonMatch ? canonMatch[1] : BASE + "/" + f).replace(/&amp;/g, "&");
  const title = titleMatch ? titleMatch[1].trim() : BRAND;

  const json = JSON.stringify(buildGraph(canon, title), null, 2);
  const block = "\n  " + MARKER + "\n  <script type=\"application/ld+json\">\n" + json + "\n  </script>\n";

  const idx = html.search(/<\/head>/i);
  if (idx === -1) { console.warn("no </head> in", f); continue; }
  html = html.slice(0, idx) + block + html.slice(idx);
  writeFileSync(p, html, { encoding: "utf8" });
  count++;
}

console.log("JSON-LD inserted into", count, "pages");
