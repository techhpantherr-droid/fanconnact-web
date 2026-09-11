// User profile page: loads a registered user from Firestore by uid
// (passed via sessionStorage "viewUid"), shows their stats, and lets the
// logged-in viewer follow / unfollow them. Followers & following are stored
// as arrays on each user doc (following[] = uids this user follows,
// followers[] = uids that follow this user).

import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const DEFAULT_AVATAR = "assets/images/default-avatar.png?w=150";

function el(id) { return document.getElementById(id); }

function avatarFor(d) {
  if (d.photoURL) return d.photoURL;
  const seed = d.email || d.username || d.fullName || "fan";
  return "https://i.pravatar.cc/100?u=" + encodeURIComponent(seed);
}

function displayName(d) {
  return d.fullName || d.username || d.email?.split("@")[0] || "Fan";
}

function levelOf(d) {
  const xp = parseInt(d.xp, 10) || 0;
  return (window.LevelSystem && window.LevelSystem.levelFromXP)
    ? window.LevelSystem.levelFromXP(xp)
    : (parseInt(d.level, 10) || 1);
}

let VIEW_UID = null;
let CURRENT_UID = null;

async function init() {
  VIEW_UID = sessionStorage.getItem("viewUid");
  if (!VIEW_UID) {
    el("loadingState").textContent = "No user selected.";
    return;
  }

  // Wait for auth so we know who the viewer is (for follow state).
  onAuthStateChanged(auth, async (user) => {
    CURRENT_UID = user ? user.uid : null;
    await loadProfile();
  });
}

async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, "users", VIEW_UID));
    if (!snap.exists()) {
      el("loadingState").textContent = "User not found.";
      return;
    }
    const d = snap.data();
    const name = displayName(d);
    const level = levelOf(d);
    const xp = parseInt(d.xp, 10) || 0;
    const followers = Array.isArray(d.followers) ? d.followers : [];
    const following = Array.isArray(d.following) ? d.following : [];

    el("loadingState").style.display = "none";

    el("pAvatar").src = avatarFor(d);
    el("pName").textContent = name;
    el("pUsername").textContent = d.username ? "@" + d.username : (d.email || "");
    el("pLevel").textContent = "Level " + level;
    el("pXP").textContent = xp.toLocaleString() + " XP";
    el("pFollowers").textContent = followers.length;
    el("pFollowing").textContent = following.length;

    // Coins + level progress
    const coins = parseInt(d.coins, 10) || 0;
    const coinEl = el("pCoins");
    if (coinEl) coinEl.textContent = coins.toLocaleString() + " 🪙";
    if (window.LevelSystem) {
      const pct = window.LevelSystem.xpProgress ? Math.round(window.LevelSystem.xpProgress(xp) * 100) : 0;
      const bar = el("pLevelBar");
      if (bar) bar.style.width = pct + "%";
      const next = el("pNextLevel");
      if (next) {
        const toGo = window.LevelSystem.xpToNextLevel ? window.LevelSystem.xpToNextLevel(xp) : 0;
        next.textContent = "Next Level " + (level + 1) + " · " + toGo.toLocaleString() + " XP to go";
      }
    }

    // Identity details (gender, location, mobile, joined date)
    const details = [];
    if (d.fullName && d.fullName !== name) details.push(["Full Name", d.fullName]);
    if (d.gender && d.gender !== "Not Specified") details.push(["Gender", d.gender]);
    if (d.location && d.location !== "Not Specified") details.push(["Location", d.location]);
    if (d.mobile && d.mobile !== "Not Specified") details.push(["Mobile", d.mobile]);
    if (d.createdAt) {
      try {
        const dt = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        details.push(["Joined", dt.toLocaleDateString(undefined, { year: "numeric", month: "short" })]);
      } catch (e) {}
    }
    const detWrap = el("pDetails");
    if (detWrap) {
      detWrap.innerHTML = details.map(function (pair) {
        return '<div class="stat-pill rounded-lg px-3 py-2"><span class="text-slate-400 text-xs">' + pair[0] + '</span>' +
          '<div class="text-white text-sm font-medium truncate">' + pair[1] + '</div></div>';
      }).join("");
    }

    // Rank: fetch all users and sort by xp client-side (no orderBy, so users
    // without xp are still counted).
    try {
      const allSnap = await getDocs(collection(db, "users"));
      const all = [];
      allSnap.forEach((s) => {
        const u = s.data();
        all.push({ uid: s.id, xp: parseInt(u.xp, 10) || 0 });
      });
      all.sort((a, b) => b.xp - a.xp);
      const idx = all.findIndex((u) => u.uid === VIEW_UID);
      el("pRank").textContent = idx >= 0 ? "#" + (idx + 1) : "—";
    } catch (e) {
      el("pRank").textContent = "—";
    }

    renderFollowButton(followers);
  } catch (e) {
    console.error("[user-profile] load failed:", e);
    el("loadingState").textContent = "Could not load profile.";
  }
}

function renderFollowButton(followers) {
  const wrap = el("followBtnWrap");
  wrap.innerHTML = "";
  if (!CURRENT_UID || CURRENT_UID === VIEW_UID) return; // can't follow self / guests

  const isFollowing = followers.includes(CURRENT_UID);
  const btn = document.createElement("button");
  btn.className = isFollowing
    ? "w-full py-2.5 rounded-lg border border-gray-400 text-slate-300 font-semibold hover:bg-white/5 transition"
    : "w-full py-2.5 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition";
  btn.textContent = isFollowing ? "Following ✓" : "Follow";
  btn.addEventListener("click", () => toggleFollow(isFollowing));
  wrap.appendChild(btn);
}

async function toggleFollow(isFollowing) {
  if (!CURRENT_UID) return;
  const viewerRef = doc(db, "users", CURRENT_UID);
  const targetRef = doc(db, "users", VIEW_UID);
  try {
    if (isFollowing) {
      // Unfollow: remove target from viewer's following, viewer from target's followers
      await updateDoc(viewerRef, { following: arrayRemove(VIEW_UID) });
      await updateDoc(targetRef, { followers: arrayRemove(CURRENT_UID) });
    } else {
      // Send a follow REQUEST instead of following immediately. The target
      // user can accept or reject it from their profile's Follow Requests panel.
      await updateDoc(targetRef, { followRequests: arrayUnion(CURRENT_UID) });
      pushFollowNotification();
    }
    await loadProfile(); // refresh counts + button
  } catch (e) {
    console.error("[user-profile] follow toggle failed:", e);
    alert("Could not send follow request. Check Firestore rules allow writing your own profile.");
  }
}

// Best-effort follow notification via the backend WS (ignored if offline).
function pushFollowNotification() {
  try {
    const ws = new WebSocket((window.FC_API ? window.FC_API.ws() : 'ws://localhost:5000') + '/ws/notifications');
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "follow",
        to: VIEW_UID,
        from: CURRENT_UID,
      }));
      ws.close();
    };
  } catch (e) {}
}

async function showTab(which) {
  const card = el("followListCard");
  card.classList.remove("hidden");
  el("followListTitle").textContent = which === "followers" ? "Followers" : "Following";
  el("followList").innerHTML = '<div class="text-slate-400 text-sm py-4 text-center">Loading…</div>';

  const field = which; // "followers" or "following"
  try {
    const snap = await getDoc(doc(db, "users", VIEW_UID));
    const uids = Array.isArray(snap.data()[field]) ? snap.data()[field] : [];
    if (!uids.length) {
      el("followList").innerHTML = '<div class="text-slate-400 text-sm py-4 text-center">No one here yet.</div>';
      return;
    }
    const list = el("followList");
    list.innerHTML = "";
    for (const uid of uids) {
      const us = await getDoc(doc(db, "users", uid));
      if (!us.exists()) continue;
      const d = us.data();
      const row = document.createElement("div");
      row.className = "follower-row flex items-center gap-3 py-3 cursor-pointer hover:bg-white/5 px-2 rounded-lg";
      row.innerHTML =
        '<img src="' + avatarFor(d) + '" class="w-10 h-10 rounded-full object-cover">' +
        '<div class="flex-1 min-w-0"><div class="text-white text-sm font-medium truncate">' + displayName(d) + '</div>' +
        '<div class="text-slate-400 text-xs truncate">' + (d.username ? "@" + d.username : "") + '</div></div>' +
        '<span class="material-symbols-outlined text-slate-500">chevron_right</span>';
      row.addEventListener("click", () => {
        sessionStorage.setItem("viewUid", uid);
        window.location.reload();
      });
      list.appendChild(row);
    }
  } catch (e) {
    el("followList").innerHTML = '<div class="text-slate-400 text-sm py-4 text-center">Could not load list.</div>';
  }
}

function hideTab() {
  el("followListCard").classList.add("hidden");
}

window.showTab = showTab;
window.hideTab = hideTab;

init();
