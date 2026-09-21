const CURRENTS_BASE = "https://api.currentsapi.services/v1";
const CURRENTS_KEY = "u4F078J4C8jKmhd8hkqVkVeyOzYQrs6maPdxVoK1YmuSVqQf";

function currentsItemToArticle(item) {
  const img = item.image || item.urlToImage || item.media || item.thumbnail || "";
  return {
    title: item.title || "",
    description: item.description || item.excerpt || "",
    url: item.url || item.link || "#",
    image: img || FALLBACK_IMAGE,
    publishedAt: item.published || item.pubDate || item.date || "",
    source: { name: (item.source && (item.source.name || item.source)) || item.author || "Currents" },
    category: item.category ? (Array.isArray(item.category) ? item.category : [item.category]) : ["Sports"],
  };
}

async function fetchFromCurrents({ category = "", language = "en", keywords = "" } = {}) {
  const params = new URLSearchParams({ apiKey: CURRENTS_KEY, language });
  let endpoint, hasMore = true, allArticles = [], page = 1;

  if (category && category !== "all") {
    endpoint = "/search";
    const q = keywords ? `${category} ${keywords}` : category;
    params.set("keywords", q);
  } else {
    endpoint = "/latest-news";
    params.set("category", "sports");
    if (keywords) params.set("keywords", keywords);
  }

  while (hasMore && page <= 2) {
    params.set("page_number", page);
    const res = await fetch(`${CURRENTS_BASE}${endpoint}?${params}`);
    if (!res.ok) throw new Error(`Currents HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "ok") throw new Error("Invalid Currents response");
    if (!data.news || !data.news.length) break;
    allArticles = allArticles.concat(data.news);
    hasMore = !!data.next;
    page++;
  }

  return allArticles.map(currentsItemToArticle);
}

const SPORTS_ORDER = [
  "all",
  "cricket",
  "football",
  "basketball",
  "tennis",
  "hockey",
  "kabaddi",
  "e-sports",
  "baseball",
  "volleyball",
  "table-tennis",
];

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "zh", label: "Chinese", native: "中文" },
];

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&q=80&w=1536";
const FALLBACK_GRID_IMAGE =
  "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=800";

const FALLBACK_NEWS = {};
const _fallback = (arr) =>
  arr.map((item) => ({
    ...item,
    image: item.image || FALLBACK_GRID_IMAGE,
    publishedAt: item.publishedAt || new Date().toISOString(),
    source: item.source || { name: "Sports News" },
  }));

FALLBACK_NEWS.all = [];
FALLBACK_NEWS.cricket = [];
FALLBACK_NEWS.football = [];
FALLBACK_NEWS.basketball = [];
FALLBACK_NEWS.tennis = [];
FALLBACK_NEWS.hockey = [];
FALLBACK_NEWS.kabaddi = [];
FALLBACK_NEWS["e-sports"] = [];
FALLBACK_NEWS.baseball = [];
FALLBACK_NEWS.volleyball = [];
FALLBACK_NEWS["table-tennis"] = [];


const YOUTUBE_VIDEOS = {
  cricket: ["YqKYpgZ9FWU", "N22Vd0DY3Lw", "AVCW8P9oXcA"],
  football: ["SgkTQBuH4w0", "HmtSjB5_yrs", "zhEWqfP6V_w"],
  basketball: ["C4B_DURXpuA", "6kW6N2Ax9XA", "q9niIQgMDuw"],
  tennis: ["vInESnvjmF0", "d8ICgsnZHrU", "eRbTHj2KLro"],
  hockey: ["8-Gca5fprqI", "fHlaHOePfts", "IqXnpoGxi6o"],
  kabaddi: ["uU4dMlPqtyk", "Tu_SZa1AHqM", "uDA3kOwmD-g"],
  "e-sports": ["jWjrdz-lLdU", "2CM6S_Jnc7M", "JrI3I2ouo5A"],
  baseball: ["OfvgQviIP-M", "Jg9TVay-Ynk", "5dGZffKDYr4"],
  volleyball: ["joVMJjCq4cE", "pNjDGCH-CWI", "NPQUfQ-4FaY"],
  "table-tennis": ["VTCDQYYKA9o", "ajR7s1Qc668", "m1UScAi8Kvs"],
};

async function fetchNews({
  category = "",
  language = "en",
  keywords = "",
} = {}) {
  try {
    const articles = await fetchFromCurrents({ category, language, keywords });
    if (keywords) {
      const kw = keywords.toLowerCase();
      const filtered = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(kw) ||
          a.description.toLowerCase().includes(kw),
      );
      if (filtered.length) return filtered;
    } else if (articles.length > 0) {
      return articles;
    }
  } catch (e) {
    console.warn("Currents failed, using fallback:", e.message);
  }
  const fallback = FALLBACK_NEWS[category] || FALLBACK_NEWS.all || [];
  return fallback.map((item, i) => ({
    ...item,
    image: i === 0 ? FALLBACK_IMAGE : FALLBACK_GRID_IMAGE,
  }));
}

function renderNewsHero(article) {
  if (!article) return "";
  const img = article.image || article.image_url || FALLBACK_IMAGE;
  const title = article.title || "";
  const desc = article.description || "";
  const url = article.url || article.link || "#";
  const source =
    (article.source && article.source.name) ||
    article.source_id ||
    article.author ||
    "Sports";
  return `
    <section class="relative h-[240px] md:h-[340px] rounded-xl md:rounded-2xl overflow-hidden shadow-lg group cursor-pointer" onclick="window.open('${url.replace(/'/g, "\\'")}', '_blank')">
      <img src="${img}" alt="${title.replace(/"/g, "&quot;")}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
      <div class="absolute bottom-0 left-0 p-4 md:p-6 w-full md:w-3/4">
        <span class="px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full mb-2 inline-block uppercase tracking-widest">Breaking</span>
        <h1 class="text-lg md:text-2xl lg:text-3xl font-black font-headline text-white leading-tight mb-2 line-clamp-2">${title}</h1>
        <p class="text-gray-300 text-xs md:text-sm line-clamp-1 mb-2">${desc}</p>
        <div class="flex items-center gap-3">
          <span class="bg-brand-green text-black font-bold px-3 py-1.5 rounded-lg text-xs transition-all hover:scale-105 active:scale-95 inline-block">Read Full Story</span>
          <span class="text-gray-400 text-[10px]">${source}</span>
        </div>
      </div>
    </section>`;
}

function renderNewsCard(article, idx) {
  const img = article.image || article.image_url || FALLBACK_GRID_IMAGE;
  const title = article.title || "";
  const desc = article.description || "";
  const url = article.url || article.link || "#";
  const source =
    (article.source && article.source.name) ||
    article.source_id ||
    article.author ||
    "Sports";
  const date =
    article.published || article.publishedAt || article.pubDate || "";
  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const cat =
    (article.category && article.category[0]) || article.category || "Sports";
  return `
    <div class="bg-white dark:bg-brand-card rounded-lg overflow-hidden border border-gray-200 dark:border-brand-border group hover:border-brand-green/50 hover:shadow-md transition-all cursor-pointer shadow-sm flex flex-col" onclick="window.open('${url.replace(/'/g, "\\'")}', '_blank')" style="animation: fadeUp 0.5s ease-out ${idx * 0.05}s both">
      <div class="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img src="${img}" alt="${title.replace(/"/g, "&quot;")}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src='${FALLBACK_GRID_IMAGE}'">
        <span class="absolute top-2 left-2 bg-brand-green/90 text-black text-[9px] font-bold px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">${typeof cat === "string" ? cat : cat.join(", ")}</span>
      </div>
      <div class="p-3 flex-1 flex flex-col">
        <h3 class="font-bold text-xs leading-snug mb-1.5 group-hover:text-brand-green transition-colors line-clamp-2">${title}</h3>
        <p class="text-slate-500 dark:text-gray-400 text-[11px] leading-relaxed line-clamp-2 mb-2">${desc}</p>
        <div class="mt-auto pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span class="text-[9px] text-gray-500 font-medium">${formattedDate}</span>
          <span class="text-brand-green font-bold text-[10px] flex items-center gap-0.5">Read <span class="material-symbols-outlined text-xs">arrow_outward</span></span>
        </div>
      </div>
    </div>`;
}

function renderVideoCards(videoIds, sportName) {
  return videoIds
    .map((vid, i) => {
      const thumbnail = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
      return `
      <div class="bg-white dark:bg-brand-card rounded-xl overflow-hidden border border-gray-200 dark:border-brand-border group cursor-pointer hover:border-brand-green/50 hover:shadow-lg transition-all shadow-sm" onclick="window.open('https://www.youtube.com/watch?v=${vid}', '_blank')" style="animation: fadeUp 0.5s ease-out ${i * 0.1}s both">
        <div class="relative aspect-video bg-black overflow-hidden">
          <img src="${thumbnail}" alt="${sportName} highlights" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
              <span class="material-symbols-outlined text-white text-2xl" style="font-variation-settings:'FILL' 1">play_arrow</span>
            </span>
          </div>
        </div>
        <div class="p-3">
          <p class="text-xs font-bold line-clamp-1 dark:text-white text-gray-900">${sportName} Highlights</p>
          <p class="text-[10px] text-gray-500 mt-1">Watch on YouTube</p>
        </div>
      </div>`;
    })
    .join("");
}

function renderVideoSection(videoData, activeSport) {
  const sportName =
    activeSport === "all"
      ? "Sports"
      : activeSport.charAt(0).toUpperCase() + activeSport.slice(1);
  const videos =
    videoData[activeSport] || videoData[Object.keys(videoData)[0]] || [];
  if (!videos.length) return "";
  return `
    <section id="video-section" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl md:text-2xl font-bold font-headline dark:text-white text-gray-900">Video Highlights</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Top plays & moments from ${sportName}</p>
        </div>
        <div class="flex gap-2 overflow-x-auto no-scrollbar" id="video-tabs">
          ${Object.keys(videoData)
            .slice(0, 6)
            .map((s) => {
              const label =
                s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);
              const isActive = s === activeSport;
              return `<button class="video-tab px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${isActive ? "bg-brand-green text-black" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}" data-sport="${s}">${label}</button>`;
            })
            .join("")}
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4" id="video-grid">
        ${renderVideoCards(videos, sportName)}
      </div>
    </section>`;
}

function updateVideoSection(videoData, sport) {
  const grid = document.getElementById("video-grid");
  const section = document.getElementById("video-section");
  if (!grid || !section) return;
  const sportName =
    sport === "all" ? "Sports" : sport.charAt(0).toUpperCase() + sport.slice(1);
  const videos = videoData[sport] || videoData[Object.keys(videoData)[0]] || [];
  if (videos.length) {
    section.querySelector("p").textContent =
      `Top plays & moments from ${sportName}`;
    grid.innerHTML = renderVideoCards(videos, sportName);
  }
  document.querySelectorAll(".video-tab").forEach((tab) => {
    const isActive = tab.dataset.sport === sport;
    tab.className = `video-tab px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${isActive ? "bg-brand-green text-black" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`;
  });
}

function renderFilterChips(activeSport, lang = "en") {
  const labels = {
    en: {
      all: "All Sports",
      cricket: "Cricket",
      football: "Football",
      basketball: "Basketball",
      tennis: "Tennis",
      hockey: "Hockey",
      kabaddi: "Kabaddi",
      "e-sports": "E-Sports",
      baseball: "Baseball",
      volleyball: "Volleyball",
      "table-tennis": "Table Tennis",
    },
    hi: {
      all: "सभी खेल",
      cricket: "क्रिकेट",
      football: "फुटबॉल",
      basketball: "बास्केटबॉल",
      tennis: "टेनिस",
      hockey: "हॉकी",
      kabaddi: "कबड्डी",
      "e-sports": "ई-स्पोर्ट्स",
      baseball: "बेसबॉल",
      volleyball: "वॉलीबॉल",
      "table-tennis": "टेबल टेनिस",
    },
  };
  const l = labels[lang] || labels.en;
  return SPORTS_ORDER.map(
    (s) => `
    <button class="filter-chip px-4 py-2 text-sm font-bold rounded-full whitespace-nowrap transition-all ${s === activeSport ? "bg-brand-green text-black shadow-md" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600"}" data-sport="${s}">
      ${l[s] || s}
    </button>`,
  ).join("");
}

function renderLanguageSelector(currentLang) {
  return LANGUAGES.map(
    (l) => `
    <button class="lang-btn px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${l.code === currentLang ? "bg-brand-green text-black" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}" data-lang="${l.code}">
      ${l.native}
    </button>`,
  ).join("");
}

async function loadNews(container, { sport = "all", language = "en" } = {}) {
  if (!container) return;
  const heroContainer = container.querySelector("#hero-news-container");
  const gridContainer = container.querySelector("#news-grid");
  const videoContainer = container.querySelector("#video-container");
  if (!gridContainer) return;

  gridContainer.innerHTML = `<div class="col-span-full flex justify-center py-16"><div class="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div></div>`;

  const articles = await fetchNews({ category: sport, language });

  if (heroContainer) {
    heroContainer.innerHTML = articles.length
      ? renderNewsHero(articles[0])
      : '<div class="text-center py-12 text-gray-500 dark:text-gray-400"><span class="material-symbols-outlined text-4xl mb-2">newspaper</span><p>No news available. Check back later.</p></div>';
  }

  gridContainer.innerHTML =
    articles.length > 1
      ? articles
          .slice(1)
          .map((a, i) => renderNewsCard(a, i))
          .join("")
      : '<div class="col-span-full text-center py-16 text-gray-500 dark:text-gray-400"><span class="material-symbols-outlined text-5xl mb-3">article</span><p class="text-lg font-medium">No articles found</p><p class="text-sm mt-1">Try selecting a different sport or language</p></div>';

  if (videoContainer) {
    videoContainer.innerHTML = renderVideoSection(YOUTUBE_VIDEOS, sport);
    videoContainer.querySelectorAll(".video-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        updateVideoSection(YOUTUBE_VIDEOS, tab.dataset.sport);
      });
    });
  }

  return articles;
}

// === New Style Renderers (NewsData.io look) ===

function renderBreakingTicker(articles) {
  const headlines = articles.slice(0, 8).map(a => a.title).join(' • ');
  return `
    <div class="breaking-ticker relative bg-gradient-to-r from-red-600/20 via-brand-card to-red-600/5 border-y border-red-900/30 overflow-hidden py-2 mb-6 rounded-lg">
      <div class="flex items-center gap-3 px-3">
        <span class="flex items-center gap-1.5 bg-red-600 text-white font-bold text-xs shrink-0 px-2 py-0.5 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          BREAKING
        </span>
        <div class="overflow-hidden relative flex-1">
          <div class="animate-marquee whitespace-nowrap text-xs text-gray-300 font-medium">
            ${headlines} • ${headlines}
          </div>
        </div>
      </div>
    </div>`;
}

function renderFeaturedNew(article) {
  if (!article) return '';
  const img = article.image || article.image_url || FALLBACK_IMAGE;
  const title = article.title || '';
  const desc = article.description || '';
  const url = article.url || article.link || '#';
  const source = (article.source && article.source.name) || article.source_id || article.author || 'Sports';
  const cat = (article.category && article.category[0]) || article.category || 'Sports';
  return `
    <div class="group relative rounded-xl overflow-hidden cursor-pointer mb-6 h-[260px] md:h-[360px]" onclick="window.open('${url.replace(/'/g, "\\'")}', '_blank')">
      <img src="${img}" alt="${title.replace(/"/g, '&quot;')}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-brand-green/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="absolute bottom-0 left-0 p-4 md:p-6 w-full">
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2.5 py-0.5 bg-brand-green/90 text-black text-[9px] font-bold rounded-full uppercase tracking-wider">${typeof cat === 'string' ? cat : cat.join(', ')}</span>
          <span class="text-[10px] text-gray-400">${source}</span>
        </div>
        <h3 class="text-xl md:text-3xl font-black text-white leading-tight mb-2 line-clamp-2">${title}</h3>
        <p class="text-gray-300 text-sm line-clamp-2 max-w-2xl">${desc}</p>
      </div>
      <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <span class="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
          <span class="material-symbols-outlined text-white text-xl">open_in_new</span>
        </span>
      </div>
    </div>`;
}

function renderHorizontalCard(article, idx) {
  const img = article.image || article.image_url || FALLBACK_GRID_IMAGE;
  const title = article.title || '';
  const desc = article.description || '';
  const url = article.url || article.link || '#';
  const source = (article.source && article.source.name) || article.source_id || article.author || 'Sports';
  const date = article.published || article.publishedAt || article.pubDate || '';
  const formattedDate = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return `
    <div class="group bg-brand-card rounded-xl overflow-hidden border border-gray-800 hover:border-brand-green/40 transition-all cursor-pointer flex flex-col sm:flex-row" onclick="window.open('${url.replace(/'/g, "\\'")}', '_blank')" style="animation: fadeUp 0.5s ease-out ${idx * 0.08}s both">
      <div class="sm:w-44 shrink-0 h-44 sm:h-auto relative overflow-hidden">
        <img src="${img}" alt="${title.replace(/"/g, '&quot;')}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src='${FALLBACK_GRID_IMAGE}'">
      </div>
      <div class="p-4 flex flex-col justify-center flex-1 min-w-0">
        <span class="text-[10px] text-brand-green font-bold uppercase tracking-wider mb-1">${source}</span>
        <h3 class="font-bold text-sm leading-snug mb-1.5 group-hover:text-brand-green transition-colors line-clamp-2">${title}</h3>
        <p class="text-gray-400 text-xs line-clamp-2">${desc}</p>
        ${formattedDate ? `<span class="text-[10px] text-gray-500 mt-2">${formattedDate}</span>` : ''}
      </div>
    </div>`;
}

function renderCompactNewCard(article, idx) {
  const img = article.image || article.image_url || FALLBACK_GRID_IMAGE;
  const title = article.title || '';
  const url = article.url || article.link || '#';
  const source = (article.source && article.source.name) || article.source_id || article.author || 'Sports';
  const cat = (article.category && article.category[0]) || article.category || 'Sports';
  return `
    <div class="group bg-brand-card rounded-lg overflow-hidden border border-gray-800 hover:border-brand-green/40 hover:shadow-lg hover:shadow-brand-green/5 transition-all cursor-pointer" onclick="window.open('${url.replace(/'/g, "\\'")}', '_blank')" style="animation: fadeUp 0.5s ease-out ${idx * 0.05}s both">
      <div class="relative aspect-[16/10] overflow-hidden">
        <img src="${img}" alt="${title.replace(/"/g, '&quot;')}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src='${FALLBACK_GRID_IMAGE}'">
        <span class="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full">${typeof cat === 'string' ? cat : cat[0]}</span>
      </div>
      <div class="p-3">
        <h3 class="font-bold text-xs leading-snug group-hover:text-brand-green transition-colors line-clamp-2">${title}</h3>
        <span class="text-[9px] text-gray-500 mt-1.5 block">${source}</span>
      </div>
    </div>`;
}

function renderNewStyleLayout(articles) {
  if (!articles || !articles.length) {
    return '<div class="text-center py-16 text-gray-500"><span class="material-symbols-outlined text-5xl mb-3">newspaper</span><p class="text-lg font-medium">No news available</p></div>';
  }
  const [featured, ...rest] = articles;
  const secondary = rest.slice(0, 4);
  const grid = rest.slice(4);
  return `
    ${renderBreakingTicker(articles)}
    ${renderFeaturedNew(featured)}
    ${secondary.length ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">${secondary.map((a, i) => renderHorizontalCard(a, i)).join('')}</div>` : ''}
    ${grid.length ? `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">${grid.map((a, i) => renderCompactNewCard(a, i + secondary.length)).join('')}</div>` : ''}
  `;
}

async function loadNewStyleNews(container, { sport = 'all', language = 'en' } = {}) {
  if (!container) return;
  container.innerHTML = `<div class="flex justify-center py-16"><div class="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div></div>`;
  const articles = await fetchNews({ category: sport, language });
  container.innerHTML = renderNewStyleLayout(articles);
  return articles;
}

const style = document.createElement("style");
style.textContent = `
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .animate-marquee { display: inline-block; animation: marquee 30s linear infinite; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
`;
document.head.appendChild(style);

export {
  fetchNews,
  loadNews,
  loadNewStyleNews,
  renderFilterChips,
  renderLanguageSelector,
  SPORTS_ORDER,
  LANGUAGES,
  YOUTUBE_VIDEOS,
  updateVideoSection,
  renderVideoSection,
  fetchFromCurrents,
};
