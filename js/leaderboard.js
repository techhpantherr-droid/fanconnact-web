// Full leaderboard data — REAL registered users from Firestore (users collection) ONLY.
// No static/fake players are ever shown. If Firestore can't be reached, the
// leaderboard renders empty (never fake names).
var leaderboardData = null;
var leaderboardLoaded = false;

// FanConnact level formula — keep this identical to services/userService.js.
// Level 1 = 150 XP, Level 2 = 350 XP, Level 3 = 600 XP, etc.
function fanConnactRequiredXP(level) {
  level = Math.max(0, Math.floor(Number(level) || 0));
  if (level <= 0) return 0;
  return Math.floor(150 * level + ((level - 1) * level * 25));
}

function fanConnactCalculateLevel(xp) {
  xp = Math.max(0, Math.floor(Number(xp) || 0));
  var level = 0;
  while (xp >= fanConnactRequiredXP(level + 1)) level++;
  return level;
}

function fanConnactNextLevelXP(xp) {
  return fanConnactRequiredXP(fanConnactCalculateLevel(xp) + 1);
}

function fanConnactXPProgress(xp) {
  xp = Math.max(0, Math.floor(Number(xp) || 0));
  var level = fanConnactCalculateLevel(xp);
  var base = fanConnactRequiredXP(level);
  var next = fanConnactRequiredXP(level + 1);
  if (next <= base) return 0;
  return Math.max(0, Math.min(1, (xp - base) / (next - base)));
}

// Wait until Firebase handles are exposed on window.__FB__ (set asynchronously
// by js/script.js -> js/firebase-config.js). Returns true once ready.
async function waitForFirebase(timeoutMs) {
  timeoutMs = timeoutMs || 4000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.__FB__ && window.__FB__.db && window.__FB__.auth) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!(window.__FB__ && window.__FB__.db);
}

// Wait until Firebase Auth has resolved its initial state. The leaderboard
// reads the public `users` collection, but the read must not fire before auth
// finishes initializing (otherwise the SDK may reject it). We wait for
// onAuthStateChanged to settle, then proceed regardless of login state.
// Accepts the auth module directly (self-sufficient, no dependency on window.__FB__).
async function waitForAuthReady(auth, timeoutMs) {
  timeoutMs = timeoutMs || 6000;
  if (!auth) return;
  if (auth.currentUser !== null) return; // already resolved
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const unsub = auth.onAuthStateChanged(function () { finish(); });
    setTimeout(finish, timeoutMs); // don't hang forever
    // Best-effort cleanup of the listener
    setTimeout(function () { try { unsub && unsub(); } catch (e) {} }, timeoutMs + 200);
  });
}

// Load real registered users from Firestore (users collection)
async function loadRealUsers() {
  try {
    // Self-sufficient: import Firebase handles directly (no race on window.__FB__
    // being set by script.js). This avoids the "Firebase not ready" failure.
    const fb = await import("./firebase-config.js");
    const db = fb.db;
    const auth = fb.auth;
    await waitForAuthReady(auth);
    const { collection, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    // IMPORTANT: do NOT use orderBy("xp") here. Firestore silently drops any
    // document that lacks the orderBy field, so users without an `xp` field
    // would never appear. Fetch ALL users, then sort client-side by xp.
    const snap = await getDocs(collection(db, "users"));
    var users = [];
    snap.forEach(function (doc) {
      var d = doc.data();
      var xp = parseInt(d.xp, 10) || 0;
      var level = fanConnactCalculateLevel(xp);
      var coins = parseInt(d.coins, 10);
      if (isNaN(coins)) coins = 100; // default 100 coins for every registered user
      if (coins < 0) coins = 0; // FanCoins can never be negative
      var name = d.username || d.fullName || d.email || "Fan";
      var img = d.photoURL || (d.email ? ("https://i.pravatar.cc/100?u=" + encodeURIComponent(d.email)) : "assets/images/default-avatar.png?w=150");
      // The document ID IS the uid. The data may NOT contain a `uid` field,
      // so always use doc.id (this is what makes profile links work).
      users.push({ name: name, level: level, xp: xp, coins: coins, img: img, uid: doc.id });
    });
    if (!users.length) throw new Error("No users in Firestore");
    users.sort(function (a, b) {
      if (a.xp !== b.xp) return b.xp - a.xp;
      if (a.coins !== b.coins) return b.coins - a.coins;
      if (a.level !== b.level) return b.level - a.level;
      return a.name.localeCompare(b.name);
    });
    for (var i = 0; i < users.length; i++) users[i].rank = i + 1;
    return users;
  } catch (e) {
    // Surface the real error so failures are diagnosable (instead of silently
    // showing empty/static placeholders).
    console.error("[leaderboard] failed to load registered users:", e);
    showLeaderboardError(e);
    return null;
  }
}

// Show a visible error banner in the leaderboard so the user knows the fetch
// failed (instead of silently showing "—" / "0 XP" placeholders).
function showLeaderboardError(e) {
  var banner = document.getElementById("leaderboard-error");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "leaderboard-error";
    banner.className = "mx-4 md:mx-8 my-4 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm";
    var container = document.querySelector("main") || document.body;
    container.insertBefore(banner, container.firstChild);
  }
  banner.textContent = "Could not load registered users: " + (e && e.message ? e.message : e) +
    ". Check your connection and Firestore rules (users collection must be readable).";
}

async function getData() {
  if (leaderboardData) return leaderboardData;
  if (!leaderboardLoaded) {
    leaderboardLoaded = true;
    // REAL-ONLY: only ever show registered Firestore users. No fake/fallback names.
    var real = await loadRealUsers();
    leaderboardData = real || [];
  }
  return leaderboardData;
}

// Expose a helper so profile.html can show the user's rank vs ALL registered users.
window.FANCONNECT_leaderboard = {
  loadRealUsers: loadRealUsers,
  getData: getData
};

async function goToPlayer(u, sport) {
  // Open the real registered user's profile page (not the sports player page).
  if (u && u.uid) {
    // If the clicked user is the viewer themselves, open the full profile.html
    // (which shows real coins / full details) instead of the public view.
    try {
      const fb = await import("./firebase-config.js");
      const auth = fb.auth;
      if (auth && auth.currentUser && auth.currentUser.uid === u.uid) {
        window.location.href = "profile.html";
        return;
      }
    } catch (e) {}
    sessionStorage.setItem("viewUid", u.uid);
    window.location.href = "user-profile.html";
    return;
  }
  if (!sport) {
    // Try active game filter button on leaderboard page
    var activeGameBtn = document.querySelector('.game-filter-btn.active-filter');
    if (activeGameBtn) {
      sport = activeGameBtn.getAttribute('data-game') || "Cricket";
    } else {
      sport = "Cricket";
    }
    sport = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
    if (sport === "Esports") sport = "E-Sports";
  }
  sessionStorage.setItem("playerSport", sport || "Cricket");
  sessionStorage.setItem("playerView", JSON.stringify({ player: { name: u.name, rank: u.rank, xp: u.xp, level: u.level, imgUrl: u.img }, sport: sport || "Cricket" }));
  window.location.href = "player.html";
}

async function renderPodium() {
  var data = await getData();
  var cards = [
    document.getElementById("card-rank1"),
    document.getElementById("card-rank2"),
    document.getElementById("card-rank3")
  ];
  var users = [data[0], data[1], data[2]];
  cards.forEach(function(el, idx) {
    if (!el) return;

    // IMPORTANT:
    // The podium HTML already has unique IDs for each live field:
    // rank1-name / rank1-level / rank1-xp, etc.
    // Do NOT use generic selectors such as ".font-black" here because
    // the rank badge itself also has "font-black" and would get the XP.
    var rank = idx + 1;
    var nameEl = document.getElementById("rank" + rank + "-name");
    var imgEl = document.getElementById("rank" + rank + "-img");
    var levelEl = document.getElementById("rank" + rank + "-level");
    var xpEl = document.getElementById("rank" + rank + "-xp");

    if (!users[idx]) {
      // No real user for this podium slot — clear only the data fields.
      if (nameEl) nameEl.textContent = "—";
      if (imgEl) imgEl.src = "assets/images/default-avatar.png?w=150";
      if (levelEl) levelEl.textContent = "Level 0";
      if (xpEl) xpEl.textContent = "0 XP";
      return;
    }

    var u = users[idx];

    // Update ONLY the intended podium fields.
    // The fixed 1 / 2 / 3 rank badges in the HTML remain untouched.
    if (nameEl) nameEl.textContent = u.name;
    if (imgEl) imgEl.src = u.img;
    if (levelEl) levelEl.textContent = "Level " + u.level;
    if (xpEl) xpEl.textContent = u.xp.toLocaleString() + " XP";

    el.classList.add("cursor-pointer");
    el.addEventListener("click", function() { goToPlayer(u); });
  });
}

async function renderRows4to6() {
  var container = document.getElementById("leaderboard-rows-4-6");
  if (!container) return;
  var data = await getData();
  var rows = data.slice(3, 6);
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = '<div class="px-6 py-8 text-center text-slate-400 text-sm">No fans ranked yet.</div>';
    return;
  }
  rows.forEach(function(u) {
    var d = document.createElement("div");
    d.className = "hidden md:grid grid-cols-12 items-center px-6 py-4 hover:bg-[#091321] transition border-b border-[#0f1d30] cursor-pointer";
    d.innerHTML = '<div class="col-span-1 text-white font-semibold">' + u.rank + '</div>' +
      '<div class="col-span-5 flex items-center gap-3"><img src="' + u.img + '" class="w-10 h-10 rounded-full"><span class="text-white">' + u.name + '</span></div>' +
      '<div class="col-span-3"><span class="bg-[#23153e] text-purple-300 px-3 py-1 rounded-lg text-sm">Level ' + u.level + '</span></div>' +
      '<div class="col-span-3 text-right text-white font-semibold">' + u.xp.toLocaleString() + ' XP</div>';
    d.addEventListener("click", function() { goToPlayer(u); });
    container.appendChild(d);
    var m = document.createElement("div");
    m.className = "md:hidden p-4 border-b border-[#0f1d30] cursor-pointer";
    m.innerHTML = '<div class="flex items-center gap-3"><div class="text-white font-bold">#' + u.rank + '</div>' +
      '<img src="' + u.img + '" class="w-10 h-10 rounded-full">' +
      '<div class="flex-1"><div class="text-white font-medium">' + u.name + '</div>' +
      '<div class="flex justify-between mt-1"><span class="bg-[#23153e] text-purple-300 px-2 py-1 rounded text-xs">Level ' + u.level + '</span>' +
      '<span class="text-white font-semibold">' + u.xp.toLocaleString() + ' XP</span></div></div></div>';
    m.addEventListener("click", function() { goToPlayer(u); });
    container.appendChild(m);
  });
}

var topEarnersExpanded = false;

async function renderTopEarners() {
  var container = document.getElementById("topEarnersList");
  if (!container) return;
  var data = await getData();
  container.innerHTML = "";
  if (!data.length) {
    container.innerHTML = '<div class="text-center text-slate-400 text-sm py-4">No fans yet.</div>';
    return;
  }
  var list = topEarnersExpanded ? data.slice() : data.slice(0, 5);
  list.forEach(function(u, idx) {
    var div = document.createElement("div");
    div.className = "flex items-center justify-between cursor-pointer hover:bg-[#0a1628] p-2 rounded-lg transition";
    div.innerHTML = '<div class="flex items-center gap-3"><span class="text-slate-400 w-4">' + (idx + 1) + '</span>' +
      '<img src="' + u.img + '" class="w-10 h-10 rounded-full">' +
      '<span class="text-white">' + u.name + '</span></div>' +
      '<span class="text-[#f7c948] font-semibold">' + u.coins.toLocaleString() + ' 🪙</span>';
    div.addEventListener("click", function() { goToPlayer(u); });
    container.appendChild(div);
  });
  var btn = document.getElementById("top-earners-view-all");
  if (btn) {
    btn.textContent = topEarnersExpanded ? "Show Less ↑" : "View All Top Earners →";
    btn.onclick = function() {
      topEarnersExpanded = !topEarnersExpanded;
      renderTopEarners();
    };
  }
}

var fullLBExpanded = false;

async function toggleFullLeaderboard() {
  var container = document.getElementById("full-leaderboard-container");
  var btn = document.getElementById("full-lb-btn");
  if (!container) return;
  if (fullLBExpanded) {
    container.classList.add("hidden");
    btn.innerHTML = "View Full Leaderboard →";
    fullLBExpanded = false;
    return;
  }
  var data = await getData();
  var rows = data.slice(6);
  container.classList.remove("hidden");
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = '<div class="px-6 py-8 text-center text-slate-400 text-sm">No more fans to show.</div>';
    btn.innerHTML = "Hide Full Leaderboard ↑";
    fullLBExpanded = true;
    return;
  }
  var header = document.createElement("div");
  header.className = "hidden md:grid grid-cols-12 px-6 py-3 text-slate-400 text-xs font-semibold border-b border-[#12263f] sticky top-0 bg-[#060d18]";
  header.innerHTML = '<div class="col-span-1">Rank</div><div class="col-span-5">User</div><div class="col-span-3">Level</div><div class="col-span-3 text-right">XP</div>';
  container.appendChild(header);
  rows.forEach(function(f) {
    var row = document.createElement("div");
    row.className = "border-b border-[#0f1d30] hover:bg-[#0a1628] transition cursor-pointer";
    row.addEventListener("click", function() { goToPlayer(f); });
    var rc = f.rank <= 10 ? "text-yellow-400" : "text-white";
    var desk = document.createElement("div");
    desk.className = "hidden md:grid grid-cols-12 items-center px-6 py-3";
    desk.innerHTML = '<div class="col-span-1 ' + rc + ' font-semibold">#' + f.rank + '</div>' +
      '<div class="col-span-5 flex items-center gap-3"><img src="' + f.img + '" class="w-8 h-8 rounded-full"><span class="text-white text-sm">' + f.name + '</span></div>' +
      '<div class="col-span-3"><span class="bg-[#23153e] text-purple-300 px-2 py-1 rounded text-xs">Level ' + f.level + '</span></div>' +
      '<div class="col-span-3 text-right text-white font-semibold text-sm">' + f.xp.toLocaleString() + ' XP</div>';
    row.appendChild(desk);
    var mob = document.createElement("div");
    mob.className = "md:hidden p-3";
    mob.innerHTML = '<div class="flex items-center gap-3"><div class="' + rc + ' font-bold text-sm">#' + f.rank + '</div>' +
      '<img src="' + f.img + '" class="w-8 h-8 rounded-full">' +
      '<div class="flex-1"><div class="text-white text-sm font-medium">' + f.name + '</div>' +
      '<div class="flex justify-between mt-1"><span class="bg-[#23153e] text-purple-300 px-2 py-0.5 rounded text-xs">Level ' + f.level + '</span>' +
      '<span class="text-white font-semibold text-xs">' + f.xp.toLocaleString() + ' XP</span></div></div></div>';
    row.appendChild(mob);
    container.appendChild(row);
  });
  btn.innerHTML = "Hide Full Leaderboard ↑";
  fullLBExpanded = true;
}

document.addEventListener("DOMContentLoaded", async function() {
  await getData(); // load real registered users (real-only)
  await renderPodium();
  await renderRows4to6();
  await renderYourRank();
  await renderTopEarners();
});

// Populate the "Your Rank" sidebar + "Your Row" with the REAL logged-in user.
async function renderYourRank() {
  // Wait for the real profile (set by js/script.js onAuthStateChanged).
  let profile = null;
  for (var i = 0; i < 40; i++) {
    if (window.currentUserProfile && window.currentUserProfile.name) { profile = window.currentUserProfile; break; }
    await new Promise(function(r){ setTimeout(r, 100); });
  }
  if (!profile) profile = { name: "You", username: "", photoURL: "assets/images/default-avatar.png?w=150", level: 0, xp: 0 };

  // Derive XP + level from the real profile (prefer Firestore xp if present).
  var xp = parseInt(profile.xp, 10) || 0;
  var level = fanConnactCalculateLevel(xp);

  // Find this user's rank within the real leaderboard data.
  var data = await getData();
  var rank = data.findIndex(function(u){ return u.uid && profile.uid && u.uid === profile.uid; });
  if (rank < 0) {
    // Match by name as a fallback.
    rank = data.findIndex(function(u){ return u.name === profile.name; });
  }
  rank = rank >= 0 ? rank + 1 : (data.length ? data.length + 1 : 1);
  var total = data.length || 1;

  var headerLevel = document.getElementById("user-level-display");
  if (headerLevel) headerLevel.textContent = "Level " + level;

  // Compute next-level progress from the same userService formula.
  var nextXP = fanConnactNextLevelXP(xp);
  var toGo = Math.max(0, nextXP - xp);
  var pct = Math.round(fanConnactXPProgress(xp) * 100);

  // Sidebar: Your Rank
  var curRank = document.getElementById("currentRank");
  if (curRank) curRank.textContent = rank;
  var totalLabel = document.getElementById("totalUsersLabel");
  if (totalLabel) totalLabel.textContent = "/ " + total.toLocaleString();
  var totalXPEl = document.getElementById("totalXP");
  if (totalXPEl) totalXPEl.textContent = xp.toLocaleString() + " XP";
  var sProg = document.getElementById("sidebar-xpProgress");
  if (sProg) sProg.style.width = pct + "%";
  var sNext = document.getElementById("sidebar-nextLevel");
  if (sNext) sNext.textContent = "Next Level " + (level + 1);
  var sRemain = document.getElementById("sidebar-xpRemaining");
  if (sRemain) sRemain.textContent = toGo.toLocaleString() + " XP to go";

  // Your Row (desktop)
  var rowRank = document.getElementById("yourRowRank");
  if (rowRank) rowRank.textContent = rank;
  var rowName = document.getElementById("yourRowName");
  if (rowName) rowName.textContent = profile.name + (profile.username ? " (@" + profile.username + ")" : "");
  var rowLevel = document.getElementById("yourRowLevel");
  if (rowLevel) rowLevel.textContent = "Level " + level;
  var rowXP = document.getElementById("yourRowXP");
  if (rowXP) rowXP.textContent = xp.toLocaleString() + " XP";
  var rowImg = document.getElementById("yourRowImg");
  if (rowImg) rowImg.src = profile.photoURL || "assets/images/default-avatar.png?w=150";

  // Your Row (mobile)
  var rowRankM = document.getElementById("yourRowRankM");
  if (rowRankM) rowRankM.textContent = "#" + rank;
  var rowNameM = document.getElementById("yourRowNameM");
  if (rowNameM) rowNameM.textContent = profile.name + (profile.username ? " (@" + profile.username + ")" : "");
  var rowLevelM = document.getElementById("yourRowLevelM");
  if (rowLevelM) rowLevelM.textContent = "Level " + level;
  var rowImgM = document.getElementById("yourRowImgM");
  if (rowImgM) rowImgM.src = profile.photoURL || "assets/images/default-avatar.png?w=150";

  var mProg = document.getElementById("xpProgress");
  if (mProg) mProg.style.width = pct + "%";
  var mNext = document.getElementById("nextLevel");
  if (mNext) mNext.textContent = "Next Level " + (level + 1);
  var mRemain = document.getElementById("xpRemaining");
  if (mRemain) mRemain.textContent = toGo.toLocaleString() + " XP to go";
  var mXP = document.getElementById("userXP");
  if (mXP) mXP.textContent = xp.toLocaleString() + " XP";
}
