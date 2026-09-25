// Complete-profile flow for users who signed in with Google but have no
// Firestore record yet. Email is already known + verified by Google, so we
// only collect the remaining signup details (username, mobile, DOB, gender,
// sports). On submit we create the user doc and go to the dashboard.

import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

// Pull the Google user info stashed by handleSocialLogin
let googleData = null;
try {
  googleData = JSON.parse(sessionStorage.getItem("googleSignup") || "null");
} catch (_) {}

if (!googleData || !googleData.uid) {
  // No pending Google signup — nothing to complete.
  window.location.href = "login.html";
}

// Pre-fill email + name from Google
if (googleData) {
  if ($("email")) $("email").value = googleData.email || "";
  if ($("full-name") && googleData.fullName) $("full-name").value = googleData.fullName;
}

// ── Gender selection ──
document.querySelectorAll('#gender-group input[name="gender"]').forEach((input) => {
  input.addEventListener("change", () => {
    document.querySelectorAll("#gender-group .gender-card").forEach((c) => c.classList.remove("active"));
    if (input.checked) input.closest("label").querySelector(".gender-card").classList.add("active");
  });
});

// ── Sports selection ──
document.querySelectorAll("#sports-container input[name='sports']").forEach((cb) => {
  cb.addEventListener("change", () => {
    cb.closest("label").classList.toggle("active", cb.checked);
  });
});

// ── Username availability check ──
let usernameOk = false;
$("signup-username")?.addEventListener("input", async function () {
  const msg = $("username-msg");
  const val = this.value.trim().toLowerCase();
  if (!val) { msg.textContent = ""; usernameOk = false; return; }
  try {
    const q = query(collection(db, "usernames"), where("__name__", "==", val));
    const snap = await getDocs(q);
    if (snap.size > 0) {
      msg.textContent = "Username taken";
      msg.className = "text-xs ml-1 text-red-500";
      usernameOk = false;
    } else {
      msg.textContent = "Available ✓";
      msg.className = "text-xs ml-1 text-emerald-500";
      usernameOk = true;
    }
  } catch (e) {
    usernameOk = false;
  }
});

// ── Finish ──
$("finish-btn")?.addEventListener("click", async () => {
  const err = $("error-msg");
  err.classList.add("hidden");

  const fullName = $("full-name").value.trim();
  let username = $("signup-username").value.trim().toLowerCase();
  const mobile = $("mobile").value.trim();
  const dob = $("dob").value;
  const genderEl = document.querySelector('#gender-group input[name="gender"]:checked');
  const gender = genderEl ? genderEl.value : "Not Specified";
  const sports = Array.from(document.querySelectorAll('#sports-container input[name="sports"]:checked')).map((c) => c.value);

  if (!fullName) { showErr("Please enter your full name."); return; }
  if (!username) username = googleData.email.split("@")[0] + Math.floor(Math.random() * 1000);
  if (!usernameOk && $("signup-username").value.trim()) { showErr("Please choose an available username."); return; }
  if (!mobile || mobile.length < 8) { showErr("Please enter a valid mobile number."); return; }
  if (!dob) { showErr("Please enter your date of birth."); return; }

  const btn = $("finish-btn");
  btn.disabled = true;
  btn.textContent = "Creating account…";

  try {
    const uid = googleData.uid;
    const userRef = doc(db, "users", uid);
    // Guard: if a doc was created in the meantime, don't overwrite.
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      sessionStorage.removeItem("googleSignup");
      window.location.href = "dashboard.html";
      return;
    }

    await setDoc(userRef, {
      fullName: fullName,
      username: username,
      email: googleData.email,
      photoURL: googleData.photoURL || "",
      mobile: mobile,
      dob: dob,
      gender: gender,
      sports: sports,
      coins: 100,
      level: 1,
      xp: 0,
      followers: [],
      following: [],
      followRequests: [],
      emailVerified: true,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, "usernames", username), { uid: uid });

    await addDoc(
      collection(db, "rewards"),
      {
        uid: uid,
        reason: "Signup Coins",
        xp: 0,
        coins: 100,
        createdAt: serverTimestamp(),
      }
    );

    sessionStorage.removeItem("googleSignup");
    window.location.href = "dashboard.html";
  } catch (e) {
    console.error("[complete-profile] failed:", e);
    showErr("Could not complete sign up: " + e.message);
    btn.disabled = false;
    btn.textContent = "Finish Sign Up";
  }
});

function showErr(msg) {
  const err = $("error-msg");
  err.textContent = msg;
  err.classList.remove("hidden");
}
