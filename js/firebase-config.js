import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    fetchSignInMethodsForEmail,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    GoogleAuthProvider,
    FacebookAuthProvider,
    TwitterAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,

    /* NEW ADDITIONS */

    updateDoc,
    deleteDoc,
    addDoc,
    orderBy,
    limit,
    onSnapshot,
    increment,
    runTransaction,
    serverTimestamp,
    writeBatch,
    getCountFromServer

} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCU8fjtDxBa6gyw2GDYwbU9znnXXaZDV_Q",
    authDomain: "fanconnact.firebaseapp.com",
    projectId: "fanconnact",
    storageBucket: "fanconnact.firebasestorage.app",
    messagingSenderId: "1067605173307",
    appId: "1:1067605173307:web:01c942ec550c4c889ba81e",
    measurementId: "G-Q02NEK5HMW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);
// Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();

// Social Login Handlers
const handleSocialLogin = async(provider) => {
    if (window.location.protocol === "file:") {
        alert(
            "Firebase Auth does not work on local files (file://). Please use a local server like 'Live Server' in VS Code.",
        );
        return;
    }

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Ensure social user has a record in Firestore so their profile isn't empty
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const email = user.email;
            const username = email.split("@")[0] + Math.floor(Math.random() * 1000);
            await setDoc(userRef, {

                // ========= BASIC =========

                uid: user.uid,

                fullName: user.displayName || email.split("@")[0],

                username,

                email,

                mobile: "",

                dob: "",

                gender: "",

                photoURL: user.photoURL || "",

                frame: "default",

                badge: "",

                role: "user",

                emailVerified: true,

                provider: user.providerData[0]?.providerId || "google",

                // ========= GAMIFICATION =========

                level: 0,

                xp: 0,

                coins: 0,

                totalPredictions: 0,

                correctPredictions: 0,

                wrongPredictions: 0,

                currentStreak: 0,

                bestStreak: 0,

                accuracy: 0,

                predictionRank: 0,

                rewardPoints: 0,

                totalXPEarned: 0,

                totalCoinsEarned: 0,

                lastPredictionAt: null,

                lastRewardAt: null,

                // ========= SPORTS =========

                selectedSports: ["cricket"],

                favoriteTeam: "",

                favoritePlayer: "",

                favoriteLeague: "",

                // ========= SETTINGS =========

                theme: "dark",

                themeMode: "system",

                language: "English",

                timezone: "Asia/Kolkata",

                compactMode: false,

                reduceAnimation: false,

                largeText: false,

                notifications: {

                    liveMatch: true,

                    predictionResult: true,

                    breakingNews: true,

                    chat: true,

                    missions: true,

                    leaderboard: true,

                    promotions: false

                },

                // ========= MISSIONS =========

                welcomeBonusClaimed: false,

                dailyMissionCompleted: 0,

                weeklyMissionCompleted: 0,

                dailyMissionRewardClaimed: false,

                weeklyMissionRewardClaimed: false,

                // ========= ACCOUNT =========

                isPremium: false,

                premiumExpiry: null,

                isBanned: false,

                banReason: "",

                accountStatus: "ACTIVE",

                // ========= TIMESTAMPS =========

                createdAt: new Date().toISOString(),

                lastLogin: new Date().toISOString(),

                updatedAt: new Date().toISOString()

            });
            await setDoc(doc(db, "usernames", username), { uid: user.uid });

             window.location.href = "complete-profile.html";
            return;
        }

           
        

        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Auth Error Code:", error.code);
        if (error.code === "auth/unauthorized-domain") {
            alert(
                "This domain is not authorized in Firebase Console. Add '" +
                window.location.hostname +
                "' to Authorized Domains in Authentication settings.",
            );
        } else if (error.code === "auth/operation-not-allowed") {
            alert("This sign-in provider is not enabled in your Firebase Console.");
        } else {
            alert("Login failed: " + error.message);
        }
    }
};

document
    .getElementById("google-login")
    ?.addEventListener("click", () => handleSocialLogin(googleProvider));
document
    .getElementById("facebook-login")
    ?.addEventListener("click", () => handleSocialLogin(facebookProvider));
document
    .getElementById("twitter-login")
    ?.addEventListener("click", () => handleSocialLogin(twitterProvider));

// Email/Password Login
const loginForm = document.getElementById("login-form") || document.querySelector("form");
loginForm?.addEventListener("submit", async(e) => {
    e.preventDefault();
    const emailInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    if (!emailInput || !passwordInput) return;

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);

        // Check Firestore emailVerified (for new OTP-verified users)
        // Missing field = legacy user = allow login; false = block
        const userRef = doc(db, "users", result.user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        if (userData && userData.emailVerified === false) {
            await signOut(auth);
            alert("Please verify your email before logging in. Contact support if you need a new verification email.");
            return;
        }

        window.location.href = "dashboard.html";
    } catch (error) {
        if (error.code === "auth/user-not-found") {
            alert("No account found with this email. Please sign up first.");
        } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
            alert("Incorrect password. Try again.");
        } else if (error.code === "auth/too-many-requests") {
            alert("Too many failed attempts. Please wait and try again.");
        } else {
            alert("Login failed: " + error.message);
        }
    }
});

// --- Login email/username: check if already registered (show immediately) ---
let loginEmailTimer = null;
const loginEmailInput = document.getElementById("username");
const loginEmailMsg = document.getElementById("login-email-msg");
if (loginEmailInput && loginEmailMsg) {
    loginEmailInput.addEventListener("input", function () {
        const val = this.value.trim();
        if (loginEmailTimer) clearTimeout(loginEmailTimer);
        loginEmailMsg.className = "text-xs mt-1 ml-1 hidden";
        loginEmailMsg.textContent = "";
        if (!val) return;
        loginEmailMsg.className = "text-xs mt-1 ml-1 text-gray-400";
        loginEmailMsg.textContent = "Checking...";
        loginEmailTimer = setTimeout(async () => {
            try {
                // The login field accepts BOTH email and username, and Firebase
                // may enable email enumeration protection (which hides whether an
                // email is registered). So check the Firestore users collection too.
                let registered = false;
                if (val.includes("@")) {
                    const oMethods = await fetchSignInMethodsForEmail(auth, val);
                    registered = oMethods.length > 0;
                }
                if (!registered) {
                    const q = query(collection(db, "users"),
                        where("email", "==", val.toLowerCase()));
                    const snap = await getDocs(q);
                    registered = !snap.empty;
                }
                if (!registered && !val.includes("@")) {
                    const q = query(collection(db, "users"),
                        where("username", "==", val.toLowerCase()));
                    const snap = await getDocs(q);
                    registered = !snap.empty;
                }
                if (registered) {
                    loginEmailMsg.className = "text-xs mt-1 ml-1 text-brand-green";
                    loginEmailMsg.textContent = "✓ This account already exists — you can log in.";
                } else {
                    loginEmailMsg.className = "text-xs mt-1 ml-1 text-amber-400";
                    loginEmailMsg.textContent = "This account is not registered yet. Please sign up first.";
                }
            } catch (_) {
                loginEmailMsg.className = "text-xs mt-1 ml-1 hidden";
            }
        }, 500);
    });
}

// Sign Up Handler
const signupForm = document.getElementById("signup-form");
signupForm?.addEventListener("submit", async(e) => {
    e.preventDefault();
    const fullName = document.getElementById("full-name").value;
    const username = document
        .getElementById("signup-username")
        .value.trim()
        .toLowerCase();
    const email = document.getElementById("email").value;
    const countryCode = document.getElementById("country-code")?.value || "+91";
    const mobileLocal = document.getElementById("mobile").value.replace(/\D/g, '').slice(0, 10);
    const mobile = countryCode + mobileLocal;
    const dob = document.getElementById("dob").value;
    let dobISO = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        dobISO = dob;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
        const [dd, mm, yyyy] = dob.split('/');
        dobISO = `${yyyy}-${mm}-${dd}`;
    }
    const gender =
        document.querySelector('input[name="gender"]:checked')?.value || "Other";
    const password = document.getElementById("password").value;
    const defaultAvatar = document.getElementById(
        "selected-default-avatar",
    )?.value;
    const selectedFrame =
        document.getElementById("selected-frame")?.value || "none";
    const selectedSports =
        document.getElementById("selected-Sports")?.value || "";
    const favoriteSports = selectedSports ?
        selectedSports.split(",").filter(Boolean) : [];
    const terms = document.getElementById("terms").checked;
    const croppedProfileBase64 = window.croppedProfileBase64;

    if (!window.emailOTPVerified) {
        alert("Please verify your email via OTP before signing up.");
        return;
    }

    // All fields compulsory
    if (!fullName) { alert("Full name is required."); return; }
    if (!email) { alert("Email is required."); return; }
    if (!mobileLocal) { alert("Mobile number is required."); return; }
    if (mobileLocal.length !== 10) { alert("Mobile number must be exactly 10 digits."); return; }
    if (!dob) { alert("Date of birth is required."); return; }
    if (!password || password.length < 8) { alert("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password)) { alert("Password must contain at least one uppercase letter."); return; }
    if (!/[a-z]/.test(password)) { alert("Password must contain at least one lowercase letter."); return; }
    if (!/[@#_]/.test(password)) { alert("Password must contain at least one special character (@, #, or _)."); return; }
    if (/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) { alert("Password must not contain sequential characters (e.g. 123, abc)."); return; }

    // Auto-generate username from full name if empty
    const finalUsername = username || (fullName.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.floor(Math.random() * 10000));
    if (!finalUsername || finalUsername.length < 2) {
        alert("Could not generate username. Please enter one manually.");
        return;
    }

    if (!terms) {
        alert("Please agree to the Terms of Service.");
        return;
    }

    // DOB validation (supports YYYY-MM-DD from date picker)
    if (!dob || !dobISO) {
        alert("Please select your date of birth.");
        return;
    }
    const parts = dobISO.split('-').map(Number);
    const [yyyy, mm, dd] = parts;
    const birthDate = new Date(yyyy, mm - 1, dd);
    if (birthDate.getDate() !== dd || birthDate.getMonth() !== mm - 1) {
        alert("Invalid date.");
        return;
    }
    const today = new Date();
    if (birthDate >= today) {
        alert("Date of birth cannot be in the future.");
        return;
    }
    const age = today.getFullYear() - yyyy;
    const monthDiff = today.getMonth() - (mm - 1);
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dd) ? age - 1 : age;
    if (actualAge < 6) {
        alert("You must be at least 6 years old to register.");
        return;
    }

    try {
        // 1. Check if username exists in Firestore (usernames collection has public read)
        const usernameRef = doc(db, "usernames", finalUsername);
        const usernameSnap = await getDoc(usernameRef);

        if (usernameSnap.exists()) {
            throw new Error("Username is already taken. Please choose another one.");
        }

        // 2. Final email duplicate check. NOTE: fetchSignInMethodsForEmail is
        //    defeated by email-enumeration protection (returns [] even for
        //    registered emails), so query the public-read users collection.
        const emailQ = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
        const emailSnap = await getDocs(emailQ);
        if (!emailSnap.empty) {
            throw new Error("This email is already registered. Please login.");
        }

        // 3. Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password,
        );

        // 4. Check mobile duplicate via mobiles collection
        const mobileRef = doc(db, "mobiles", mobile);
        if ((await getDoc(mobileRef)).exists()) {
            await userCredential.user.delete();
            throw new Error("This mobile number is already registered. Please login.");
        }

        console.log("User created, starting upload...");

        let photoURL = defaultAvatar || null;

        if (croppedProfileBase64) photoURL = croppedProfileBase64;

        await updateProfile(userCredential.user, {
            displayName: fullName,
        });

        // 5. Store user data, reserve mobile and username in Firestore
         await setDoc(doc(db, "users", userCredential.user.uid), {

            // ========= BASIC =========

            uid: userCredential.user.uid,

            fullName,

            username: finalUsername,

            email,

            mobile,

            dob: dobISO,

            gender,

            photoURL,

            frame: selectedFrame,

            badge: "",

            role: "user",

            emailVerified: true,

            provider: "email",

            // ========= GAMIFICATION =========

            level: 0,

            xp: 0,

            coins: 0,

            totalPredictions: 0,

            correctPredictions: 0,

            wrongPredictions: 0,

            currentStreak: 0,

            bestStreak: 0,

            accuracy: 0,

            predictionRank: 0,

            rewardPoints: 0,

            totalXPEarned: 0,

            totalCoinsEarned: 0,

            lastPredictionAt: null,

            lastRewardAt: null,

            // ========= SPORTS =========

            selectedSports: favoriteSports.length
                ? favoriteSports
                : ["cricket"],

            favoriteTeam: "",

            favoritePlayer: "",

            favoriteLeague: "",

            // ========= SETTINGS =========

            theme: "dark",

            themeMode: "system",

            language: "English",

            timezone: "Asia/Kolkata",

            compactMode: false,

            reduceAnimation: false,

            largeText: false,

            notifications: {

                liveMatch: true,

                predictionResult: true,

                breakingNews: true,

                chat: true,

                missions: true,

                leaderboard: true,

                promotions: false

            },

            // ========= MISSIONS =========

            welcomeBonusClaimed: false,

            dailyMissionCompleted: 0,

            weeklyMissionCompleted: 0,

            dailyMissionRewardClaimed: false,

            weeklyMissionRewardClaimed: false,

            // ========= ACCOUNT =========

            isPremium: false,

            premiumExpiry: null,

            isBanned: false,

            banReason: "",

            accountStatus: "ACTIVE",

            // ========= TIMESTAMPS =========

            createdAt: new Date().toISOString(),

            lastLogin: new Date().toISOString(),

            updatedAt: new Date().toISOString()

        });

        await setDoc(mobileRef, { uid: userCredential.user.uid });
        await setDoc(usernameRef, { uid: userCredential.user.uid });

        await signOut(auth);

        alert("Sign up successfully! Your email has been verified via OTP. You can now log in.");
        window.location.href = "login.html";
    } catch (error) {
        alert("Registration failed: " + error.message);
    }
});

// --- Real-time Field Validation (with DB duplicate checks) ---
function valMsg(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    let el = input.parentElement.querySelector('.vmsg');
    if (!el) {
        el = document.createElement('p');
        el.className = 'vmsg text-xs mt-1 ml-1 hidden';
        input.parentElement.appendChild(el);
    }
    return el;
}
function v(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.className = `vmsg text-xs mt-1 ml-1 ${ok ? 'text-brand-green' : 'text-red-400'} ${text ? '' : 'hidden'}`;
}
let valTimers = {};

function debounceDb(field, cb, ms) {
    if (valTimers[field]) clearTimeout(valTimers[field]);
    valTimers[field] = setTimeout(cb, ms);
}

document.getElementById('full-name')?.addEventListener('input', function () {
    const m = valMsg('full-name'); v(m, this.value.trim() ? '' : 'Name is required', !!this.value.trim());
});

document.getElementById('signup-username')?.addEventListener('input', function () {
    const m = valMsg('signup-username');
    const val = this.value.trim().toLowerCase();
    if (!val) { v(m, 'Optional — auto-generated if blank', true); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(val)) { v(m, '3–20 letters, numbers or underscores only', false); return; }
    v(m, 'Checking...', true);
    debounceDb('username', async () => {
        try {
            const snap = await getDoc(doc(db, "usernames", val));
            if (snap.exists()) v(m, 'Username taken', false);
            else v(m, 'Available', true);
        } catch (_) { v(m, 'Available', true); }
    }, 400);
});

document.getElementById('email')?.addEventListener('input', function () {
    const m = valMsg('email');
    const val = this.value.trim();

    // Reset OTP verification when email changes
    if (window.emailOTPVerified && this.dataset.lastVal && this.dataset.lastVal !== val) {
        window.emailOTPVerified = false;
        sendEmailOTPBtn.textContent = "Send Email OTP";
        sendEmailOTPBtn.disabled = false;
        emailOTPInput.disabled = true;
        emailOTPInput.value = "";
        verifyEmailOTPBtn.disabled = true;
        if (emailOTPTimer) clearTimeout(emailOTPTimer);
        emailOTP = null;
        emailOTPStatus.textContent = "Email changed — re-verify required";
        emailOTPStatus.className = "text-xs text-amber-400";
    }
    this.dataset.lastVal = val;

    if (!val) { v(m, '', true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { v(m, 'Invalid email format', false); return; }
    v(m, 'Valid format', true);
    debounceDb('email', async () => {
        v(m, 'Checking...', true);
        try {
            // users collection by email (enumeration protection hides
            // fetchSignInMethodsForEmail results for registered emails)
            const q = query(collection(db, "users"), where("email", "==", val.toLowerCase()));
            const snap = await getDocs(q);
            if (!snap.empty) {
                v(m, 'Already registered — cannot send OTP', false);
                sendEmailOTPBtn.disabled = true;
            } else {
                v(m, 'Available', true);
                if (!window.emailOTPVerified) sendEmailOTPBtn.disabled = false;
            }
        } catch (_) { v(m, 'Check failed', false); }
    }, 400);
});

document.getElementById('mobile')?.addEventListener('input', function () {
    const m = valMsg('mobile');
    // Strip non-digits so the field holds only the local number
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
    const val = this.value.trim();
    if (!val) { v(m, '', true); return; }
    if (val.length !== 10) { v(m, 'Enter exactly 10 digits', false); return; }
    if (!/^\d{10}$/.test(val)) { v(m, 'Digits only', false); return; }
    v(m, 'Valid format', true);
    const full = (document.getElementById('country-code')?.value || '+91') + val;
    debounceDb('mobile', async () => {
        v(m, 'Checking...', true);
        try {
            const snap = await getDoc(doc(db, "mobiles", full));
            if (snap.exists()) v(m, 'Already registered', false);
            else v(m, 'Available', true);
        } catch (_) { v(m, 'Check failed', false); }
    }, 400);
});

document.getElementById('password')?.addEventListener('input', function () {
    const m = valMsg('password');
    const val = this.value;
    if (!val) { v(m, '', true); return; }
    const fails = [];
    if (val.length < 8) fails.push('8+ chars');
    if (!/[A-Z]/.test(val)) fails.push('A-Z');
    if (!/[a-z]/.test(val)) fails.push('a-z');
    if (!/[@#_]/.test(val)) fails.push('@ # _');
    if (/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(val)) fails.push('no seq (123, abc)');
    if (fails.length) v(m, 'Missing: ' + fails.join(', '), false);
    else v(m, 'Strong password', true);
});

document.getElementById('dob')?.addEventListener('blur', function () {
    const m = valMsg('dob');
    let val = this.value.trim();
    if (!val) { v(m, '', true); return; }
    let d, mo, y;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        [y, mo, d] = val.split('-').map(Number);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        [d, mo, y] = val.split('/').map(Number);
    } else {
        v(m, 'Enter a valid date', false); return;
    }
    if (mo < 1 || mo > 12) { v(m, 'Month must be 01-12', false); return; }
    if (d < 1 || d > 31) { v(m, 'Day must be 01-31', false); return; }
    const bd = new Date(y, mo - 1, d);
    if (bd.getDate() !== d || bd.getMonth() !== mo - 1) { v(m, 'Invalid date', false); return; }
    const now = new Date();
    if (bd >= now) { v(m, 'Cannot be in future', false); return; }
    const age = now.getFullYear() - y;
    const adj = now.getMonth() < (mo - 1) || (now.getMonth() === (mo - 1) && now.getDate() < d) ? age - 1 : age;
    if (adj < 13) v(m, 'Must be 13+', false);
    else v(m, '', true);
});

// --- Email OTP Logic ---
if (typeof emailjs !== "undefined") emailjs.init("64zTCXrsJZHB9u2tY");
let emailOTP = null;
let emailOTPTimer = null;
let otpSendCount = 0;
const MAX_OTP_SENDS = 3;
let otpCooldownTimer = null;
window.emailOTPVerified = false;

const sendEmailOTPBtn = document.getElementById("send-email-otp-btn");
const verifyEmailOTPBtn = document.getElementById("verify-email-otp-btn");
const emailOTPInput = document.getElementById("email-otp-input");
const emailOTPStatus = document.getElementById("email-otp-status");

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function updateSendBtnLabel() {
    const remaining = MAX_OTP_SENDS - otpSendCount;
    if (remaining <= 0) {
        sendEmailOTPBtn.textContent = "No sends left";
        sendEmailOTPBtn.disabled = true;
    } else {
        sendEmailOTPBtn.textContent = `Send Email OTP (${remaining} left)`;
    }
}

function startCooldown() {
    let seconds = 120;
    sendEmailOTPBtn.disabled = true;
    const cooldownLabel = () => {
        sendEmailOTPBtn.textContent = `Resend in ${seconds}s`;
    };
    cooldownLabel();
    otpCooldownTimer = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
            clearInterval(otpCooldownTimer);
            otpCooldownTimer = null;
            updateSendBtnLabel();
        } else {
            cooldownLabel();
        }
    }, 1000);
}

sendEmailOTPBtn?.addEventListener("click", async () => {
    if (otpSendCount >= MAX_OTP_SENDS) {
        alert("Maximum OTP limit reached (3 per session). Please try again later.");
        return;
    }

    const email = document.getElementById("email").value.trim();
    if (!email || !email.includes("@")) {
        alert("Please enter a valid email address first.");
        return;
    }

    // Check if email already registered (before wasting an OTP)
    try {
        const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
            alert("This email is already registered. Please login instead.");
            return;
        }
    } catch (_) {}

    sendEmailOTPBtn.disabled = true;
    emailOTPStatus.textContent = "Sending...";
    emailOTPStatus.className = "text-xs text-surface-dim/70";

    emailOTP = generateOTP();

    try {
        await emailjs.send(
            "service_ntkex4p",
            "template_0d6nbzt",
            {
                to_email: email,
                passcode: emailOTP,
                time: new Date(Date.now() + 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        );
        otpSendCount++;
        emailOTPStatus.textContent = "OTP sent to " + email;
        emailOTPStatus.className = "text-xs text-brand-green";
        emailOTPInput.disabled = false;
        verifyEmailOTPBtn.disabled = false;
        emailOTPInput.focus();

        if (emailOTPTimer) clearTimeout(emailOTPTimer);
        emailOTPTimer = setTimeout(() => {
            emailOTP = null;
            emailOTPStatus.textContent = "OTP expired. Request a new one.";
            emailOTPStatus.className = "text-xs text-red-400";
        }, 300000);

        startCooldown();
    } catch (err) {
        console.error("EmailJS error:", err);
        emailOTPStatus.textContent = "Failed to send OTP. Check EmailJS config (Service ID, Template ID, Public Key).";
        emailOTPStatus.className = "text-xs text-red-400";
        updateSendBtnLabel();
    }
});

if (sendEmailOTPBtn) updateSendBtnLabel();

verifyEmailOTPBtn?.addEventListener("click", () => {
    const entered = emailOTPInput.value.trim();
    if (!entered || entered.length < 4) {
        alert("Please enter the OTP sent to your email.");
        return;
    }

    if (!emailOTP) {
        emailOTPStatus.textContent = "No OTP sent or OTP expired. Request a new one.";
        emailOTPStatus.className = "text-xs text-red-400";
        return;
    }

    if (entered !== emailOTP) {
        emailOTPStatus.textContent = "Invalid OTP. Try again.";
        emailOTPStatus.className = "text-xs text-red-400";
        return;
    }

    window.emailOTPVerified = true;
    emailOTPStatus.textContent = "Email verified!";
    emailOTPStatus.className = "text-xs text-brand-green font-semibold";
    sendEmailOTPBtn.textContent = "Verified";
    sendEmailOTPBtn.disabled = true;
    emailOTPInput.disabled = true;
    verifyEmailOTPBtn.disabled = true;
    if (emailOTPTimer) clearTimeout(emailOTPTimer);
    if (otpCooldownTimer) clearInterval(otpCooldownTimer);
});

// Monitor Auth State
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes("login.html")) {
        window.location.href = "dashboard.html";
    }
});

// --- Sport → Background Image Helper (additive feature) ---
// Returns an actual image from /assets for the given sport. If no
// sport-specific image is present in the folder, it falls back to the
// generic background.jpg so every game still gets a real image.
// Spaces in the filenames are encoded as %20 so they resolve inside CSS url().
// NOTE: the actual asset filenames contain typos (fotball, kabbadi, .javif) —
// kept as-is to match the real files on disk.
const SPORT_IMAGE_MAP = {
    cricket: "assets/cricket%20bg.jpg",
    football: "assets/fotball%20bg.jpeg",
    basketball: "assets/background.jpg",
    tennis: "assets/tennis%20bg.jpg",
    baseball: "assets/baseball%20bg.jpg",
    hockey: "assets/hockey%20bg.jpg",
    kabaddi: "assets/background.jpg",
    "e-sports": "assets/esports%20bg.jpg",
    tabletennis: "assets/tabletennis%20bg.jpg",
    volleyball: "assets/volleyball%20bg.jpg"
};
const DEFAULT_SPORT_IMAGE = "assets/background.jpg";

function sportImage(sport) {
    if (!sport) return DEFAULT_SPORT_IMAGE;
    return SPORT_IMAGE_MAP[String(sport).toLowerCase()] || DEFAULT_SPORT_IMAGE;
}

export { auth, db, storage, valMsg, v, debounceDb, generateOTP, sportImage, updateUserCounts };

// Expose core Firebase handles on window so non-module scripts
// (e.g. leaderboard.js loaded as a plain <script>) can read real data.
window.__FB__ = { auth, db, storage, fetchSignInMethodsForEmail };

// --- Dynamic user count for "Trusted by 100K+" trust badges ---
// Reads the live Firestore users collection and formats the count as
// "many" (for a small audience), "123+", "4.5K+", "100K+", "1.2M+" etc.
// Updates every element tagged with [data-user-count]. Falls back to the
// static text if it fails.
async function updateUserCounts() {
    const targets = document.querySelectorAll("[data-user-count]");
    if (!targets.length) return;
    try {
        const snap = await getCountFromServer(query(collection(db, "users")));
        const n = snap.data().count;
        let label;
        if (n < 25) label = "many";
        else if (n >= 1000000) label = (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M+";
        else if (n >= 1000) label = (n / 1000).toFixed(1).replace(/\.0$/, "") + "K+";
        else label = String(n) + "+";
        targets.forEach(el => { el.textContent = label; });
    } catch (err) {
        console.warn("updateUserCounts failed, keeping static text:", err);
    }
}
updateUserCounts();