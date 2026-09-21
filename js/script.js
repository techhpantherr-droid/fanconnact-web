import { calculateLevel } from "./services/userService.js";

// Apply saved appearance settings globally (compact, large text, reduce animation, THEME)
(function() {
  try {
    var saved = JSON.parse(localStorage.getItem('fanconnact-settings'));
    if (saved) {
      if (saved.compact) document.documentElement.classList.add('compact-mode');
      if (saved.largeText) document.documentElement.classList.add('large-text');
      if (saved.reduceAnimation) document.documentElement.classList.add('reduce-animation');
      // Apply the chosen named theme (light/dark/stadium/esports/royal/custom) on every page
      var validThemes = ['light', 'dark', 'stadium', 'esports', 'royal', 'custom'];
      var theme = saved.theme && validThemes.indexOf(saved.theme) !== -1 ? saved.theme : 'light';
      document.body.classList.remove('theme-light', 'theme-dark', 'theme-stadium', 'theme-esports', 'theme-royal', 'theme-custom');
      document.body.classList.add('theme-' + theme);
      // Custom theme: apply the user's saved CSS variables to <body>
      if (theme === 'custom' && saved.customTheme) {
        var c = saved.customTheme;
        var s = document.body.style;
        s.setProperty('--page-bg', c.pageBg || '#0b1220');
        s.setProperty('--card-bg', c.cardBg || '#111827');
        s.setProperty('--border', c.border || '#243347');
        s.setProperty('--text', c.text || '#ffffff');
        s.setProperty('--text-light', c.textLight || '#94a3b8');
        s.setProperty('--primary', c.primary || '#22c55e');
        s.setProperty('--hover', c.hover || '#162132');
        if (c.bgImage) {
          s.setProperty('--page-bg-image', 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url("' + c.bgImage + '")');
        } else {
          s.setProperty('--page-bg-image', 'none');
        }
        s.setProperty('--page-bg-size', c.bgSize || 'cover');
        s.setProperty('--page-bg-position', c.bgPosition || 'center top');
        s.setProperty('--page-bg-repeat', c.bgRepeat || 'no-repeat');
        s.setProperty('--page-bg-attachment', c.bgAttachment || 'fixed');
      }
    }
  } catch(e) {}
})();

// Replace the header notification bell with a Settings (gear) icon on EVERY page.
// This keeps the top bar consistent and avoids the notification/settings overlap.
(function () {
  function swapNotifForSettings() {
    try {
      const header = document.querySelector("header");
      if (!header) return;

      // The notification bell appears as a .notification-trigger element, or as a
      // button / anchor / span containing the "notifications" material symbol.
      const found = [];
      header.querySelectorAll(".notification-trigger").forEach((el) => found.push(el));
      header.querySelectorAll("button, a, span, i").forEach((el) => {
        if (/notifications/.test(el.innerHTML) && !found.includes(el)) found.push(el);
      });

      found.forEach((el) => {
        const btn = document.createElement("button");
        btn.setAttribute("type", "button");
        btn.setAttribute("onclick", "window.location.href='setting.html'");
        btn.setAttribute("title", "Settings");
        btn.className =
          (el.className || "")
            .replace(/\bnotification-trigger\b/g, "")
            .trim() +
          " shrink-0 settings-top-icon";
        btn.innerHTML =
          '<span class="material-symbols-outlined text-slate-500 dark:text-gray-400 text-xl sm:text-2xl">settings</span>';
        if (el.parentNode) el.parentNode.replaceChild(btn, el);
      });
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", swapNotifForSettings);
  } else {
    swapNotifForSettings();
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  // Nav "Matches"/"Live Matches" links point to livematches.html (the matches
  // list). Individual match cards use m.link → match-center.html directly.
  const themeToggleBtn = document.getElementById("theme-toggle");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const closeSidebarBtn = document.getElementById("close-sidebar-btn");
  const sidebar = document.getElementById("sidebar");
  const headerLogo = document.getElementById("header-logo");
  const profileTrigger = document.getElementById("profile-trigger");

  // --- Hero Carousel Logic ---
  const carousel = document.getElementById("hero-carousel"); // Ensure this ID exists in HTML
  const prevBtn = document.getElementById("prev-slide"); // Ensure this ID exists in HTML
  const nextBtn = document.getElementById("next-slide"); // Ensure this ID exists in HTML
  const dots = document.querySelectorAll(".hero-dot"); // Ensure this class exists in HTML

  const updateDots = () => {
    const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.replace("bg-gray-600", "bg-brand-green");
      } else {
        dot.classList.replace("bg-brand-green", "bg-gray-600");
      }
    });
  };

  if (carousel) {
    carousel.addEventListener("scroll", updateDots);
  }

  if (carousel && prevBtn && nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (
        carousel.scrollLeft + carousel.offsetWidth >=
        carousel.scrollWidth - 10
      ) {
        carousel.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        carousel.scrollBy({ left: carousel.offsetWidth, behavior: "smooth" });
      }
    });

    prevBtn.addEventListener("click", () => {
      if (carousel.scrollLeft <= 10) {
        carousel.scrollTo({ left: carousel.scrollWidth, behavior: "smooth" });
      } else {
        carousel.scrollBy({ left: -carousel.offsetWidth, behavior: "smooth" });
      }
    });
  }

  let currentUser = null;

  // Monitor Real Auth State (firebase loaded lazily so a network/CDN
  // failure can never block the rest of this module from running).
  (async () => {
    let auth, db, onAuthStateChanged, doc, getDoc, onSnapshot, signOut;
    try {
      ({ onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"));
      ({ doc, getDoc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"));
      ({ auth, db } = await import("./firebase-config.js"));
    } catch (e) {
      console.warn("[script] firebase unavailable:", e);
      return;
    }
    onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    window.currentUser = user;

    // Redirect guests from protected pages
    if (!user) {
      const path = window.location.pathname;
      const page = path.split("/").pop();
      // Pages guests are allowed to see
      // Guests may only open the landing page and the public Match Center
      // (plus auth/legal pages so they can sign in). Every other page
      // redirects back to index.html.
      const guestAllowedPages = [
        "index.html",
        "match-center.html",
        "login.html",
        "signup.html",
        "forget-password.html",
        "reset-password.html",
        "terms.html",
        "football.html",
        "cricket.html",
        "basketball.html",
        "tennis.html",
        "baseball.html",
        "hockey.html",
        "vollyeball.html",
        "kabbaddi.html",
        "e-sports.html",
        "tabletennis.html",
        "top-players.html",
        "leaderboard.html",
        "livematches.html",
        "news&update.html",
        "calendar.html",
        "profile.html",
        "setting.html",
        "notification.html",
        "prediction.html",
        "player.html",
        "fancoin.html",
        "dashboard.html",
      ];

      // Default landing page for unauthenticated users visiting root or protected pages
      if (page === "" || !guestAllowedPages.includes(page)) {
        window.location.href = "index.html";
        return;
      }
    } else if (user) {
      // User is logged in. Redirect away from auth pages to index.
      const page = window.location.pathname.split("/").pop();
      if (
        page === "login.html" ||
        page === "signup.html"
      ) {
        // Check Firestore emailVerified for OTP-verified users
        // Missing field = legacy user = allow; false = block
        let emailVerified = true;
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists() && userSnap.data().emailVerified === false) {
            emailVerified = false;
          }
        } catch (_) {}
        if (!emailVerified) {
          await signOut(auth);
          return;
        }
        window.location.href = "index.html";
        return;
      }
    }

    // Update every FanCoin badge across the site from Firestore.
    // No dummy/default wallet balance is used here.
    function updateCoinBadges(coins) {
      var c = Number(coins);
      if (!Number.isFinite(c)) return;
      var formatted = c.toLocaleString();
      // Top-bar wallet badge(s). Some pages (e.g. dashboard) have MORE THAN ONE
      // element with id="wallet-coin-balance" (top bar + wallet card), so we
      // must update every match, not just the first getElementById result.
      document.querySelectorAll('[id="wallet-coin-balance"]').forEach(function (el) {
        el.textContent = formatted;
      });
      // Any element showing a raw coin number next to the wallet icon
      document.querySelectorAll(".coin-balance-value").forEach(function (el) {
        el.textContent = formatted;
      });
      // Profile hero "X Coins"
      var hero = document.getElementById("profile-hero-coins");
      if (hero) hero.textContent = formatted + " Coins";
      // Generic elements flagged with data-coin-badge
      document.querySelectorAll("[data-coin-badge]").forEach(function (el) {
        el.textContent = formatted;
      });
    }
    window.updateCoinBadges = updateCoinBadges;

    const userNameElem = document.getElementById("user-name-display");
    const userAvatarElem = document.getElementById("user-profile-img");
    const userLevelElem = document.getElementById("user-level-display");
    const dashboardStreakElem = document.getElementById("dashboard-current-streak");
    const welcomeElem = document.getElementById("welcome-message");

    if (user) {
      const emailPrefix = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      let displayIdentity = emailPrefix || "user";
      const photo =
        user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayIdentity)}&background=10b981&color=fff`;

      // Show Auth data immediately to prevent flicker
      if (userNameElem)
        userNameElem.textContent = `@${displayIdentity}`;
      if (welcomeElem)
        welcomeElem.innerHTML = `Welcome back, ${displayIdentity}! <span class="ml-2 text-2xl">👋</span>`;
      if (userAvatarElem) userAvatarElem.src = photo;
      // Firestore is the source of truth for gamification fields.
      // Keep auth-only identity available while the database profile loads,
      // but do not paint dummy coins/XP/streak values.
      window.currentUserProfile = {
        name: displayIdentity,
        username: '',
        photoURL: photo,
        level: null,
        uid: user.uid,
        xp: null,
        coins: null,
        currentStreak: null,
        bestStreak: null,
        totalPredictions: null,
        correctPredictions: null,
        wrongPredictions: null,
        accuracy: null,
        rewardPoints: null,
        totalXPEarned: null,
        totalCoinsEarned: null
      };

      // Keep the user profile live so Dashboard, FanCoin and other modules
      // immediately reflect Firestore changes without a page refresh.
      try {
        onSnapshot(doc(db, "users", user.uid), (userDoc) => {
          if (!userDoc.exists()) {
            console.warn("[script] Firestore user document not found:", user.uid);
            return;
          }

          const data = userDoc.data();
          if (data.username) displayIdentity = `@${data.username}`;
          if (data.frame && userAvatarElem) {
            // Clear existing frames
            userAvatarElem.classList.remove(
              "frame-gold",
              "frame-emerald",
              "frame-diamond",
            );
            if (data.frame && data.frame !== "none")
              userAvatarElem.classList.add(`frame-${data.frame}`);
            if (data.frame && data.frame !== "none")
              userAvatarElem.style.borderWidth = "3px";
          }
          if (userLevelElem) {
            const lvl = calculateLevel(parseInt(data.xp, 10) || 0);
            userLevelElem.textContent = `Level ${lvl}`;
          }

          if (data.username && userNameElem)
            userNameElem.textContent = `@${data.username}`;
          if (data.photoURL && userAvatarElem) {
            userAvatarElem.src = data.photoURL;
          }
          if (welcomeElem) {
            const name = data.fullName || data.username || displayIdentity;
            welcomeElem.textContent = `Welcome back, ${name}!`;
          }
          // Expose the complete real database profile for other modules.
          const xp = Number.isFinite(Number(data.xp)) ? Number(data.xp) : 0;
          const coins = Number.isFinite(Number(data.coins)) ? Number(data.coins) : 0;
          const level = Number.isFinite(Number(data.level))
            ? Number(data.level)
            : calculateLevel(xp);
          const currentStreak = Number.isFinite(Number(data.currentStreak)) ? Number(data.currentStreak) : 0;

          if (dashboardStreakElem) {
            dashboardStreakElem.textContent = currentStreak.toLocaleString();
          }

          window.currentUserProfile = {
            name: data.fullName || data.username || displayIdentity,
            username: data.username || '',
            photoURL: data.photoURL || photo,
            level,
            uid: user.uid,
            xp,
            coins,
            currentStreak,
            bestStreak: Number.isFinite(Number(data.bestStreak)) ? Number(data.bestStreak) : 0,
            totalPredictions: Number.isFinite(Number(data.totalPredictions)) ? Number(data.totalPredictions) : 0,
            correctPredictions: Number.isFinite(Number(data.correctPredictions)) ? Number(data.correctPredictions) : 0,
            wrongPredictions: Number.isFinite(Number(data.wrongPredictions)) ? Number(data.wrongPredictions) : 0,
            accuracy: Number.isFinite(Number(data.accuracy)) ? Number(data.accuracy) : 0,
            rewardPoints: Number.isFinite(Number(data.rewardPoints)) ? Number(data.rewardPoints) : 0,
            totalXPEarned: Number.isFinite(Number(data.totalXPEarned)) ? Number(data.totalXPEarned) : 0,
            totalCoinsEarned: Number.isFinite(Number(data.totalCoinsEarned)) ? Number(data.totalCoinsEarned) : 0
          };

          updateCoinBadges(coins);

          window.dispatchEvent(new CustomEvent("fanconnact:user-profile-updated", {
            detail: window.currentUserProfile
          }));
        });
      } catch (error) {
        console.error("Error listening to user data from Firestore:", error);
      }
    } else {
      // Default Guest State
      if (userNameElem) userNameElem.textContent = "Guest";
      if (welcomeElem)
        welcomeElem.innerHTML = `Welcome, Guest! <span class="ml-2 text-2xl">👋</span>`;
      if (userAvatarElem)
        userAvatarElem.src =
          "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
    }
    });
  })();

  // Initialize Sidebar State (all screen sizes)
  if (sidebar) {
    const stored = localStorage.getItem("sidebar-hidden");
    // Default: sidebar CLOSED on every page (drawer). Respect a saved choice.
    const isHidden = stored === null ? true : stored === "true";
    if (isHidden) {
      // Mobile: slide off-screen. Desktop: collapse to 0 (display:none via CSS).
      sidebar.classList.add("-translate-x-full");
      sidebar.classList.add("sidebar-collapsed");
      headerLogo?.classList.remove("header-logo-hidden");
      headerLogo?.classList.add("header-logo-show");
    } else {
      sidebar.classList.remove("-translate-x-full");
      sidebar.classList.remove("sidebar-collapsed");
      headerLogo?.classList.add("header-logo-hidden");
      headerLogo?.classList.remove("header-logo-show");
    }
  }

  // --- Active Link Highlighting ---
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a, aside a").forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("nav-link-active");
    }
  });

  // --- Language Selection Logic ---
  const LANG_CODES = {
    "English": "en", "Hindi": "hi", "Bengali": "bn", "Tamil": "ta",
    "Telugu": "te", "Marathi": "mr", "Spanish": "es", "French": "fr", "Arabic": "ar"
  };

  const translations = {
    en: {
      // Nav
      "nav-home": "Home", "nav-news": "News", "nav-matches": "Matches",
      "nav-communities": "Communities", "nav-leaderboard": "Leaderboard",
      "nav-live": "Live Matches", "nav-settings": "Settings",
      "nav-profile": "Profile", "nav-notifications": "Notifications",
      "nav-logout": "Logout", "nav-login": "Login", "nav-signup": "Sign Up",
      "nav-back": "Back", "nav-global": "Global", "nav-player-zone": "Player Zone",
      "nav-predictions": "Predictions",
      // General
      "welcome-guest": "Welcome, Guest!",
      "welcome-back": "Welcome back,",
      "search-placeholder": "Search...",
      "view-all": "View All", "see-more": "See More",
      "no-results": "No results found",
      "loading": "Loading...", "error-occured": "Something went wrong",
      "retry": "Retry", "cancel": "Cancel",
      "save": "Save", "delete": "Delete", "confirm": "Confirm",
      "version": "Version 1.0.0",
      "vs": "VS", "play-now": "Play Now", "live-now": "LIVE NOW",
      "app-unlock": "Unlock with App",
      "promo-join-now": "Join Now",
      "match-center-view": "View Match Center",
      "welcome-subtitle": "Your ultimate sports community",
      "communities-title": "Fan Communities",
      "status-live": "Live",
      "promo-fan-war": "Fan War",
      "promo-fan-war-desc": "Join the ultimate fan battle",
      "quiz-title": "Quiz Challenge",
      "quiz-daily-cricket": "Daily Cricket Quiz",
      "quiz-description": "Test your cricket knowledge",
      "quiz-win": "Win",
      "predictions-trending": "Trending Predictions",
      "leaderboard-top-fans": "Top Fans",
      "leaderboard-full": "Full Leaderboard",
      "time-this-week": "This Week",
      "stat-earned": "Earned",
      // Auth
      "login-title": "Welcome Back! 👋",
      "login-email-label": "Email or Username",
      "login-email-placeholder": "Enter your email or username",
      "login-password-label": "Password",
      "login-password-placeholder": "Enter your password",
      "login-submit": "Login",
      "login-forgot": "Forgot Password?",
      "login-no-account": "Don't have an account?",
      "signup-title": "Create Account",
      "signup-name-label": "Full Name",
      "signup-email-label": "Email",
      "signup-password-label": "Password",
      "signup-submit": "Sign Up",
      "signup-have-account": "Already have an account?",
      "forgot-title": "Reset Password",
      "forgot-submit": "Send Reset Link",
      // Settings - Page
      "settings-title": "Settings",
      "settings-subtitle": "Manage your preferences and account settings",
      // Settings - Appearance
      "appearance-title": "Appearance",
      "appearance-subtitle": "Customize the look and feel of FanConnact",
      "theme-light": "Light", "theme-light-desc": "Clean and bright",
      "theme-dark": "Dark", "theme-dark-desc": "Easy on the eyes",
      "theme-stadium": "Stadium", "theme-stadium-desc": "Feel the game",
      "theme-esports": "Esports", "theme-esports-desc": "For esports fans",
      "theme-royal": "Royal Blue", "theme-royal-desc": "Classic and sleek",
      "compact-mode": "Compact Mode",
      "compact-mode-desc": "Show more content in less space",
      "reduce-animations": "Reduce Animations",
      "reduce-animations-desc": "Reduce motion for a smoother experience",
      "large-text": "Large Text",
      "large-text-desc": "Increase text size for better readability",
      // Settings - Sports
      "sports-title": "Sports Preferences",
      "sports-subtitle": "Select your favorite sports to get personalized updates",
      "sport-cricket": "Cricket", "sport-football": "Football",
      "sport-basketball": "Basketball", "sport-tennis": "Tennis",
      "sport-hockey": "Hockey", "sport-kabaddi": "Kabaddi",
      "sport-volleyball": "Volleyball", "sport-tabletennis": "Table Tennis",
      "sport-esports": "Esports", "sport-baseball": "Baseball",
      "sport-add-more": "Add more sports",
      // Settings - Notifications
      "notif-title": "Notification Preferences",
      "notif-subtitle": "Choose what you want to be notified about",
      "notif-live": "Live Match Alerts",
      "notif-news": "Breaking News",
      "notif-predictions": "Prediction Results",
      "notif-community": "Community Updates",
      "notif-email": "Email Notifications",
      "notif-push": "Push Notifications",
      "notif-mentions": "Mentions & Replies",
      "notif-followers": "New Followers",
      // Settings - Security
      "security-title": "Security",
      "security-subtitle": "Keep your account safe and secure",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "Connected",
      "security-change-password": "Change Password",
      "security-2fa": "Two-Factor Authentication",
      "security-2fa-on": "On", "security-2fa-off": "Off",
      "security-logout-all": "Logout All Devices",
      // Settings - Language & Region
      "lang-title": "Language & Region",
      "lang-subtitle": "Manage your language and region preferences",
      "lang-language": "Language",
      "lang-timezone": "Timezone",
      "lang-region": "Region",
      // Settings - Support
      "support-title": "Support & About",
      "support-subtitle": "Help, feedback and app information",
      "support-report-bug": "Report Bug",
      "support-feedback": "Send Feedback",
      "support-contact": "Contact Support",
      "support-privacy": "Privacy Policy",
      "support-terms": "Terms & Conditions",
      // Profile
      "profile-title": "Profile",
      "profile-edit": "Edit Profile", "profile-level": "Level",
      "profile-achievements": "Achievements",
      "profile-recent-activity": "Recent Activity",
      "profile-identity": "Identity Details",
      "profile-fullname": "Full Name", "profile-username": "Username",
      "profile-gender": "Gender", "profile-dob": "Date of Birth",
      "profile-contact": "Contact Info",
      "profile-email": "Email", "profile-mobile": "Mobile",
      "profile-location": "Location",
      "profile-save": "Save Changes", "profile-cancel": "Cancel",
      "profile-signout": "Sign Out Account",
      "stats-total-predictions": "Total Predictions",
      "stats-win-rate": "Win Rate %",
      "stats-xp-progress": "XP Progress",
      "stats-global-rank": "Global Rank",
      // FanCoin
      "fancoin-title": "FanCoin Wallet",
      "fancoin-balance": "Balance",
      "fancoin-earn": "Earn Coins",
      "fancoin-history": "Transaction History",
      "fancoin-tagline": "Earn Coins. Play More. Win Big.",
      "fancoin-ways": "Ways To Earn Fan Coins",
      "fancoin-streak": "Day Streak",
      "view-wallet": "View Wallet",
      "earn-daily-quiz-title": "Daily Quiz",
      "earn-prediction-title": "Match Prediction",
      "earn-community-title": "Community Activity",
      "earn-fanwar-title": "Fan War",
      "earn-daily-quiz-desc": "Answer daily quiz questions and earn coins",
      "earn-prediction-desc": "Predict match outcomes correctly",
      "earn-community-desc": "Stay active in your fan communities",
      "earn-fanwar-desc": "Participate in fan battles",
      "level-bronze": "Bronze Fan", "level-silver": "Silver Fan",
      "level-gold": "Gold Fan", "level-diamond": "Diamond Fan",
      "level-next": "Keep going! Unlock the next level for more rewards!",
      "level-benefits": "Level Benefits",
      "benefit-exclusive": "Exclusive Content",
      "benefit-early-access": "Early Access",
      "benefit-badges": "Special Badges",
      // News
      "news-title": "News & Updates",
      "news-latest": "Latest News",
      // Matches
      "matches-title": "Live Matches",
      "matches-upcoming": "Upcoming",
      "matches-live": "LIVE",
      "matches-completed": "Completed",
      // Footer / Misc
      "footer-copyright": "© 2024 FanConnact. All rights reserved.",
      "theme-toggle-label": "Toggle theme",
    },
    hi: {
      "nav-home": "होम", "nav-news": "समाचार", "nav-matches": "मैच",
      "nav-communities": "समुदाय", "nav-leaderboard": "लीडरबोर्ड",
      "nav-live": "लाइव मैच", "nav-settings": "सेटिंग्स",
      "nav-profile": "प्रोफ़ाइल", "nav-notifications": "सूचनाएं",
      "nav-logout": "लॉग आउट", "nav-login": "लॉगिन", "nav-signup": "साइन अप",
      "nav-back": "वापस",
      "welcome-guest": "स्वागत है, अतिथि!",
      "welcome-back": "वापसी पर स्वागत है,",
      "search-placeholder": "खोजें...",
      "view-all": "सभी देखें", "see-more": "और देखें",
      "no-results": "कोई परिणाम नहीं मिला",
      "loading": "लोड हो रहा है...",
      "error-occured": "कुछ गलत हो गया",
      "retry": "पुनः प्रयास करें",
      "cancel": "रद्द करें", "save": "सहेजें",
      "delete": "हटाएं", "confirm": "पुष्टि करें",
      "version": "संस्करण 1.0.0",
      "login-title": "वापसी पर स्वागत है! 👋",
      "login-email-label": "ईमेल या उपयोगकर्ता नाम",
      "login-email-placeholder": "अपना ईमेल या उपयोगकर्ता नाम दर्ज करें",
      "login-password-label": "पासवर्ड",
      "login-password-placeholder": "अपना पासवर्ड दर्ज करें",
      "login-submit": "लॉगिन करें",
      "login-forgot": "पासवर्ड भूल गए?",
      "login-no-account": "खाता नहीं है?",
      "signup-title": "खाता बनाएं",
      "signup-name-label": "पूरा नाम",
      "signup-email-label": "ईमेल",
      "signup-password-label": "पासवर्ड",
      "signup-submit": "साइन अप करें",
      "signup-have-account": "पहले से खाता है?",
      "forgot-title": "पासवर्ड रीसेट करें",
      "forgot-submit": "रीसेट लिंक भेजें",
      "settings-title": "सेटिंग्स",
      "settings-subtitle": "अपनी प्राथमिकताएं और खाता सेटिंग्स प्रबंधित करें",
      "appearance-title": "दिखावट",
      "appearance-subtitle": "FanConnact के रूप और अनुभव को अनुकूलित करें",
      "theme-light": "लाइट", "theme-light-desc": "साफ और उज्ज्वल",
      "theme-dark": "डार्क", "theme-dark-desc": "आंखों के लिए आसान",
      "theme-stadium": "स्टेडियम", "theme-stadium-desc": "खेल का अनुभव करें",
      "theme-esports": "ईस्पोर्ट्स", "theme-esports-desc": "ईस्पोर्ट्स प्रशंसकों के लिए",
      "theme-royal": "रॉयल ब्लू", "theme-royal-desc": "क्लासिक और सुंदर",
      "compact-mode": "कॉम्पैक्ट मोड",
      "compact-mode-desc": "कम स्थान में अधिक सामग्री दिखाएं",
      "reduce-animations": "एनिमेशन कम करें",
      "reduce-animations-desc": "सुचारू अनुभव के लिए गति कम करें",
      "large-text": "बड़ा टेक्स्ट",
      "large-text-desc": "बेहतर पठनीयता के लिए टेक्स्ट आकार बढ़ाएं",
      "sports-title": "खेल प्राथमिकताएं",
      "sports-subtitle": "वैयक्तिकृत अपडेट के लिए अपने पसंदीदा खेल चुनें",
      "sport-cricket": "क्रिकेट", "sport-football": "फ़ुटबॉल",
      "sport-basketball": "बास्केटबॉल", "sport-tennis": "टेनिस",
      "sport-hockey": "हॉकी", "sport-kabaddi": "कबड्डी",
      "sport-volleyball": "वॉलीबॉल", "sport-tabletennis": "टेबल टेनिस",
      "sport-esports": "ईस्पोर्ट्स", "sport-baseball": "बेसबॉल",
      "sport-add-more": "और खेल जोड़ें",
      "notif-title": "सूचना प्राथमिकताएं",
      "notif-subtitle": "चुनें कि आप किस बारे में सूचित होना चाहते हैं",
      "notif-live": "लाइव मैच अलर्ट",
      "notif-news": "ब्रेकिंग न्यूज़",
      "notif-predictions": "भविष्यवाणी परिणाम",
      "notif-community": "समुदाय अपडेट",
      "notif-email": "ईमेल सूचनाएं",
      "notif-push": "पुश सूचनाएं",
      "notif-mentions": "उल्लेख और उत्तर",
      "notif-followers": "नए अनुयायी",
      "security-title": "सुरक्षा",
      "security-subtitle": "अपने खाते को सुरक्षित रखें",
      "security-google": "गूगल",
      "security-facebook": "फ़ेसबुक",
      "security-connected": "कनेक्टेड",
      "security-change-password": "पासवर्ड बदलें",
      "security-2fa": "दो-चरणीय प्रमाणीकरण",
      "security-2fa-on": "चालू", "security-2fa-off": "बंद",
      "security-logout-all": "सभी डिवाइस से लॉग आउट करें",
      "lang-title": "भाषा और क्षेत्र",
      "lang-subtitle": "अपनी भाषा और क्षेत्र प्राथमिकताएं प्रबंधित करें",
      "lang-language": "भाषा",
      "lang-timezone": "समय क्षेत्र",
      "lang-region": "क्षेत्र",
      "support-title": "सहायता और जानकारी",
      "support-subtitle": "सहायता, प्रतिक्रिया और ऐप जानकारी",
      "support-report-bug": "बग रिपोर्ट करें",
      "support-feedback": "प्रतिक्रिया भेजें",
      "support-contact": "सहायता से संपर्क करें",
      "support-privacy": "गोपनीयता नीति",
      "support-terms": "नियम और शर्तें",
      "profile-title": "प्रोफ़ाइल",
      "profile-edit": "प्रोफ़ाइल संपादित करें",
      "profile-level": "स्तर",
      "fancoin-title": "फैनकॉइन वॉलेट",
      "fancoin-balance": "बैलेंस",
      "fancoin-earn": "कॉइन कमाएं",
      "fancoin-history": "लेन-देन इतिहास",
      "news-title": "समाचार और अपडेट",
      "news-latest": "ताज़ा समाचार",
      "matches-title": "लाइव मैच",
      "matches-upcoming": "आगामी",
      "matches-live": "लाइव",
      "matches-completed": "समाप्त",
      "footer-copyright": "© 2024 FanConnact. सर्वाधिकार सुरक्षित।",
      "theme-toggle-label": "थीम बदलें",
      // New keys
      "nav-global": "ग्लोबल", "nav-player-zone": "खिलाड़ी क्षेत्र",
      "nav-predictions": "भविष्यवाणियां",
      "vs": "बनाम", "play-now": "अभी खेलें", "live-now": "लाइव अभी",
      "app-unlock": "ऐप से अनलॉक करें",
      "promo-join-now": "अभी शामिल हों",
      "match-center-view": "मैच सेंटर देखें",
      "welcome-subtitle": "आपका अल्टीमेट स्पोर्ट्स समुदाय",
      "communities-title": "प्रशंसक समुदाय",
      "status-live": "लाइव",
      "promo-fan-war": "फैन वॉर",
      "promo-fan-war-desc": "अल्टीमेट फैन बैटल में शामिल हों",
      "quiz-title": "क्विज़ चुनौती",
      "quiz-daily-cricket": "दैनिक क्रिकेट क्विज़",
      "quiz-description": "अपने क्रिकेट ज्ञान का परीक्षण करें",
      "quiz-win": "जीतें",
      "predictions-trending": "ट्रेंडिंग भविष्यवाणियां",
      "leaderboard-top-fans": "टॉप प्रशंसक",
      "leaderboard-full": "पूर्ण लीडरबोर्ड",
      "time-this-week": "इस सप्ताह", "stat-earned": "कमाया",
      "profile-achievements": "उपलब्धियां",
      "profile-recent-activity": "हालिया गतिविधि",
      "profile-identity": "पहचान विवरण",
      "profile-fullname": "पूरा नाम", "profile-username": "उपयोगकर्ता नाम",
      "profile-gender": "लिंग", "profile-dob": "जन्म तिथि",
      "profile-contact": "संपर्क जानकारी",
      "profile-email": "ईमेल", "profile-mobile": "मोबाइल",
      "profile-location": "स्थान",
      "profile-save": "परिवर्तन सहेजें", "profile-cancel": "रद्द करें",
      "profile-signout": "खाता साइन आउट करें",
      "stats-total-predictions": "कुल भविष्यवाणियां",
      "stats-win-rate": "जीत दर %",
      "stats-xp-progress": "XP प्रगति",
      "stats-global-rank": "वैश्विक रैंक",
      "fancoin-tagline": "कॉइन कमाएं. अधिक खेलें. बड़ा जीतें.",
      "fancoin-ways": "फैन कॉइन कमाने के तरीके",
      "fancoin-streak": "दिनों की लगातार उपस्थिति",
      "view-wallet": "वॉलेट देखें",
      "earn-daily-quiz-title": "दैनिक क्विज़",
      "earn-prediction-title": "मैच भविष्यवाणी",
      "earn-community-title": "समुदाय गतिविधि",
      "earn-fanwar-title": "फैन वॉर",
      "earn-daily-quiz-desc": "दैनिक क्विज़ प्रश्नों के उत्तर दें और कॉइन कमाएं",
      "earn-prediction-desc": "मैच परिणामों की सही भविष्यवाणी करें",
      "earn-community-desc": "अपने प्रशंसक समुदायों में सक्रिय रहें",
      "earn-fanwar-desc": "फैन बैटल में भाग लें",
      "level-bronze": "कांस्य प्रशंसक", "level-silver": "रजत प्रशंसक",
      "level-gold": "स्वर्ण प्रशंसक", "level-diamond": "हीरा प्रशंसक",
      "level-next": "आगे बढ़ते रहें! अधिक पुरस्कारों के लिए अगला स्तर अनलॉक करें!",
      "level-benefits": "स्तर लाभ",
      "benefit-exclusive": "विशेष सामग्री",
      "benefit-early-access": "जल्दी पहुंच",
      "benefit-badges": "विशेष बैज",
    },
  bn: {
      "nav-home": "বাড়ি",
      "nav-news": "খবর",
      "nav-matches": "মেলে",
      "nav-communities": "সম্প্রদায়গুলি",
      "nav-leaderboard": "লিডারবোর্ড",
      "nav-live": "লাইভ ম্যাচ",
      "nav-settings": "সেটিংস",
      "nav-profile": "প্রোফাইল",
      "nav-notifications": "বিজ্ঞপ্তি",
      "nav-logout": "লগআউট",
      "nav-login": "লগইন করুন",
      "nav-signup": "সাইন আপ করুন",
      "nav-back": "ব্যাক",
      "nav-global": "গ্লোবাল",
      "nav-player-zone": "প্লেয়ার জোন",
      "nav-predictions": "ভবিষ্যদ্বাণী",
      "welcome-guest": "স্বাগতম, অতিথি!",
      "welcome-back": "আবার স্বাগতম,",
      "search-placeholder": "অনুসন্ধান করুন...",
      "view-all": "সব দেখুন",
      "see-more": "আরও দেখুন",
      "no-results": "কোন ফলাফল পাওয়া যায়নি",
      "loading": "লোড হচ্ছে...",
      "error-occured": "কিছু ভুল হয়েছে",
      "retry": "আবার চেষ্টা করুন",
      "cancel": "বাতিল করুন",
      "save": "সংরক্ষণ করুন",
      "delete": "মুছে দিন",
      "confirm": "নিশ্চিত করুন",
      "version": "সংস্করণ 1.0.0",
      "vs": "ভিএস",
      "play-now": "এখন খেলুন",
      "live-now": "এখন লাইভ",
      "app-unlock": "অ্যাপ দিয়ে আনলক করুন",
      "promo-join-now": "এখন যোগ দিন",
      "match-center-view": "ম্যাচ সেন্টার দেখুন",
      "welcome-subtitle": "আপনার চূড়ান্ত ক্রীড়া সম্প্রদায়",
      "communities-title": "ফ্যান সম্প্রদায়",
      "status-live": "লাইভ",
      "promo-fan-war": "ভক্ত যুদ্ধ",
      "promo-fan-war-desc": "চূড়ান্ত ভক্ত যুদ্ধে যোগ দিন",
      "quiz-title": "কুইজ চ্যালেঞ্জ",
      "quiz-daily-cricket": "দৈনিক ক্রিকেট কুইজ",
      "quiz-description": "আপনার ক্রিকেট জ্ঞান পরীক্ষা করুন",
      "quiz-win": "জয়",
      "predictions-trending": "প্রবণতা ভবিষ্যদ্বাণী",
      "leaderboard-top-fans": "শীর্ষ ভক্ত",
      "leaderboard-full": "সম্পূর্ণ লিডারবোর্ড",
      "time-this-week": "এই সপ্তাহে",
      "stat-earned": "অর্জিত",
      "login-title": "আবার স্বাগতম!",
      "login-email-label": "ইমেল বা ব্যবহারকারীর নাম",
      "login-email-placeholder": "আপনার ইমেল বা ব্যবহারকারীর নাম লিখুন",
      "login-password-label": "পাসওয়ার্ড",
      "login-password-placeholder": "আপনার পাসওয়ার্ড লিখুন",
      "login-submit": "লগইন করুন",
      "login-forgot": "পাসওয়ার্ড ভুলে গেছেন?",
      "login-no-account": "একটি অ্যাকাউন্ট নেই?",
      "signup-title": "অ্যাকাউন্ট তৈরি করুন",
      "signup-name-label": "পুরো নাম",
      "signup-email-label": "ইমেইল",
      "signup-password-label": "পাসওয়ার্ড",
      "signup-submit": "সাইন আপ করুন",
      "signup-have-account": "ইতিমধ্যে একটি অ্যাকাউন্ট আছে?",
      "forgot-title": "পাসওয়ার্ড রিসেট করুন",
      "forgot-submit": "রিসেট লিঙ্ক পাঠান",
      "settings-title": "সেটিংস",
      "settings-subtitle": "আপনার পছন্দ এবং অ্যাকাউন্ট সেটিংস পরিচালনা করুন",
      "appearance-title": "চেহারা",
      "appearance-subtitle": "FanConnact এর চেহারা এবং অনুভূতি কাস্টমাইজ করুন",
      "theme-light": "আলো",
      "theme-light-desc": "পরিষ্কার এবং উজ্জ্বল",
      "theme-dark": "অন্ধকার",
      "theme-dark-desc": "চোখের উপর সহজ",
      "theme-stadium": "স্টেডিয়াম",
      "theme-stadium-desc": "গেমটি অনুভব করুন",
      "theme-esports": "খেলাধুলা",
      "theme-esports-desc": "এস্পোর্টস অনুরাগীদের জন্য",
      "theme-royal": "রয়্যাল ব্লু",
      "theme-royal-desc": "ক্লাসিক এবং মসৃণ",
      "compact-mode": "কমপ্যাক্ট মোড",
      "compact-mode-desc": "কম জায়গায় আরও কন্টেন্ট দেখান",
      "reduce-animations": "অ্যানিমেশন হ্রাস করুন",
      "reduce-animations-desc": "একটি মসৃণ অভিজ্ঞতার জন্য গতি হ্রাস করুন",
      "large-text": "বড় টেক্সট",
      "large-text-desc": "ভালো পঠনযোগ্যতার জন্য পাঠ্যের আকার বাড়ান",
      "sports-title": "ক্রীড়া পছন্দ",
      "sports-subtitle": "ব্যক্তিগতকৃত আপডেট পেতে আপনার প্রিয় খেলা নির্বাচন করুন",
      "sport-cricket": "ক্রিকেট",
      "sport-football": "ফুটবল",
      "sport-basketball": "বাস্কেটবল",
      "sport-tennis": "টেনিস",
      "sport-hockey": "হকি",
      "sport-kabaddi": "কাবাডি",
      "sport-volleyball": "ভলিবল",
      "sport-tabletennis": "টেবিল টেনিস",
      "sport-esports": "খেলাধুলা",
      "sport-baseball": "বেসবল",
      "sport-add-more": "আরো খেলা যোগ করুন",
      "notif-title": "বিজ্ঞপ্তি পছন্দ",
      "notif-subtitle": "আপনি কি সম্পর্কে অবহিত হতে চান তা চয়ন করুন৷",
      "notif-live": "লাইভ ম্যাচ সতর্কতা",
      "notif-news": "ব্রেকিং নিউজ",
      "notif-predictions": "ভবিষ্যদ্বাণী ফলাফল",
      "notif-community": "সম্প্রদায় আপডেট",
      "notif-email": "ইমেল বিজ্ঞপ্তি",
      "notif-push": "পুশ বিজ্ঞপ্তি",
      "notif-mentions": "উল্লেখ এবং উত্তর",
      "notif-followers": "নতুন ফলোয়ার",
      "security-title": "নিরাপত্তা",
      "security-subtitle": "আপনার অ্যাকাউন্ট নিরাপদ এবং সুরক্ষিত রাখুন",
      "security-google": "গুগল",
      "security-facebook": "ফেসবুক",
      "security-connected": "সংযুক্ত",
      "security-change-password": "পাসওয়ার্ড পরিবর্তন করুন",
      "security-2fa": "দ্বি-ফ্যাক্টর প্রমাণীকরণ",
      "security-2fa-on": "চালু",
      "security-2fa-off": "বন্ধ",
      "security-logout-all": "সমস্ত ডিভাইস লগআউট করুন",
      "lang-title": "ভাষা ও অঞ্চল",
      "lang-subtitle": "আপনার ভাষা এবং অঞ্চলের পছন্দগুলি পরিচালনা করুন",
      "lang-language": "ভাষা",
      "lang-timezone": "টাইমজোন",
      "lang-region": "অঞ্চল",
      "support-title": "সমর্থন এবং সম্পর্কে",
      "support-subtitle": "সাহায্য, প্রতিক্রিয়া এবং অ্যাপ তথ্য",
      "support-report-bug": "বাগ রিপোর্ট করুন",
      "support-feedback": "প্রতিক্রিয়া পাঠান",
      "support-contact": "সহায়তার সাথে যোগাযোগ করুন",
      "support-privacy": "গোপনীয়তা নীতি",
      "support-terms": "শর্তাবলী",
      "profile-title": "প্রোফাইল",
      "profile-edit": "প্রোফাইল সম্পাদনা করুন",
      "profile-level": "স্তর",
      "profile-achievements": "অর্জন",
      "profile-recent-activity": "সাম্প্রতিক কার্যকলাপ",
      "profile-identity": "পরিচয় বিবরণ",
      "profile-fullname": "পুরো নাম",
      "profile-username": "ব্যবহারকারীর নাম",
      "profile-gender": "লিঙ্গ",
      "profile-dob": "জন্ম তারিখ",
      "profile-contact": "যোগাযোগের তথ্য",
      "profile-email": "ইমেইল",
      "profile-mobile": "মোবাইল",
      "profile-location": "অবস্থান",
      "profile-save": "পরিবর্তনগুলি সংরক্ষণ করুন",
      "profile-cancel": "বাতিল করুন",
      "profile-signout": "সাইন আউট অ্যাকাউন্ট",
      "stats-total-predictions": "মোট ভবিষ্যদ্বাণী",
      "stats-win-rate": "জয়ের হার %",
      "stats-xp-progress": "এক্সপি অগ্রগতি",
      "stats-global-rank": "গ্লোবাল র‍্যাঙ্ক",
      "fancoin-title": "ফ্যানকয়েন ওয়ালেট",
      "fancoin-balance": "ভারসাম্য",
      "fancoin-earn": "কয়েন উপার্জন",
      "fancoin-history": "লেনদেনের ইতিহাস",
      "fancoin-tagline": "কয়েন উপার্জন.",
      "fancoin-ways": "ফ্যান কয়েন উপার্জনের উপায়",
      "fancoin-streak": "ডে স্ট্রিক",
      "view-wallet": "ওয়ালেট দেখুন",
      "earn-daily-quiz-title": "দৈনিক কুইজ",
      "earn-prediction-title": "ম্যাচের পূর্বাভাস",
      "earn-community-title": "সম্প্রদায়ের কার্যকলাপ",
      "earn-fanwar-title": "ভক্ত যুদ্ধ",
      "earn-daily-quiz-desc": "দৈনিক কুইজের প্রশ্নের উত্তর দিন এবং কয়েন উপার্জন করুন",
      "earn-prediction-desc": "ম্যাচের ফলাফল সঠিকভাবে অনুমান করুন",
      "earn-community-desc": "আপনার ফ্যান সম্প্রদায়গুলিতে সক্রিয় থাকুন",
      "earn-fanwar-desc": "ভক্তদের যুদ্ধে অংশগ্রহণ করুন",
      "level-bronze": "ব্রোঞ্জ ফ্যান",
      "level-silver": "সিলভার ফ্যান",
      "level-gold": "সোনার পাখা",
      "level-diamond": "ডায়মন্ড ফ্যান",
      "level-next": "চালিয়ে যান!",
      "level-benefits": "স্তরের সুবিধা",
      "benefit-exclusive": "এক্সক্লুসিভ কন্টেন্ট",
      "benefit-early-access": "প্রারম্ভিক অ্যাক্সেস",
      "benefit-badges": "বিশেষ ব্যাজ",
      "news-title": "খবর এবং আপডেট",
      "news-latest": "সর্বশেষ খবর",
      "matches-title": "লাইভ ম্যাচ",
      "matches-upcoming": "আসন্ন",
      "matches-live": "লাইভ",
      "matches-completed": "সম্পন্ন",
      "footer-copyright": "© 2024 ফ্যানকান্যাক্ট।",
      "theme-toggle-label": "থিম টগল করুন",
    },
  ta: {
      "nav-home": "வீடு",
      "nav-news": "செய்தி",
      "nav-matches": "போட்டிகள்",
      "nav-communities": "சமூகங்கள்",
      "nav-leaderboard": "லீடர்போர்டு",
      "nav-live": "நேரடி போட்டிகள்",
      "nav-settings": "அமைப்புகள்",
      "nav-profile": "சுயவிவரம்",
      "nav-notifications": "அறிவிப்புகள்",
      "nav-logout": "வெளியேறு",
      "nav-login": "உள்நுழைக",
      "nav-signup": "பதிவு செய்யவும்",
      "nav-back": "மீண்டும்",
      "nav-global": "உலகளாவிய",
      "nav-player-zone": "வீரர் மண்டலம்",
      "nav-predictions": "கணிப்புகள்",
      "welcome-guest": "வரவேற்கிறோம், விருந்தினர்!",
      "welcome-back": "மீண்டும் வரவேற்கிறோம்,",
      "search-placeholder": "தேடு...",
      "view-all": "அனைத்தையும் பார்க்கவும்",
      "see-more": "மேலும் பார்க்கவும்",
      "no-results": "முடிவுகள் எதுவும் கிடைக்கவில்லை",
      "loading": "ஏற்றுகிறது...",
      "error-occured": "ஏதோ தவறாகிவிட்டது",
      "retry": "மீண்டும் முயற்சிக்கவும்",
      "cancel": "ரத்து செய்",
      "save": "சேமிக்கவும்",
      "delete": "நீக்கு",
      "confirm": "உறுதிப்படுத்தவும்",
      "version": "பதிப்பு 1.0.0",
      "vs": "வி.எஸ்",
      "play-now": "இப்போது விளையாடு",
      "live-now": "இப்போது நேரலை",
      "app-unlock": "ஆப் மூலம் திறக்கவும்",
      "promo-join-now": "இப்போது சேரவும்",
      "match-center-view": "போட்டி மையத்தைக் காண்க",
      "welcome-subtitle": "உங்கள் இறுதி விளையாட்டு சமூகம்",
      "communities-title": "ரசிகர் சமூகங்கள்",
      "status-live": "வாழ்க",
      "promo-fan-war": "ரசிகர் போர்",
      "promo-fan-war-desc": "இறுதி ரசிகர் போரில் சேரவும்",
      "quiz-title": "வினாடி வினா சவால்",
      "quiz-daily-cricket": "தினசரி கிரிக்கெட் வினாடிவினா",
      "quiz-description": "உங்கள் கிரிக்கெட் அறிவை சோதிக்கவும்",
      "quiz-win": "வெற்றி",
      "predictions-trending": "பிரபல கணிப்புகள்",
      "leaderboard-top-fans": "சிறந்த ரசிகர்கள்",
      "leaderboard-full": "முழு லீடர்போர்டு",
      "time-this-week": "இந்த வாரம்",
      "stat-earned": "சம்பாதித்தது",
      "login-title": "மீண்டும் வரவேற்கிறோம்!",
      "login-email-label": "மின்னஞ்சல் அல்லது பயனர் பெயர்",
      "login-email-placeholder": "உங்கள் மின்னஞ்சல் அல்லது பயனர் பெயரை உள்ளிடவும்",
      "login-password-label": "கடவுச்சொல்",
      "login-password-placeholder": "உங்கள் கடவுச்சொல்லை உள்ளிடவும்",
      "login-submit": "உள்நுழைக",
      "login-forgot": "கடவுச்சொல் மறந்துவிட்டதா?",
      "login-no-account": "கணக்கு இல்லையா?",
      "signup-title": "கணக்கை உருவாக்கவும்",
      "signup-name-label": "முழுப் பெயர்",
      "signup-email-label": "மின்னஞ்சல்",
      "signup-password-label": "கடவுச்சொல்",
      "signup-submit": "பதிவு செய்யவும்",
      "signup-have-account": "ஏற்கனவே கணக்கு உள்ளதா?",
      "forgot-title": "கடவுச்சொல்லை மீட்டமைக்கவும்",
      "forgot-submit": "மீட்டமை இணைப்பை அனுப்பவும்",
      "settings-title": "அமைப்புகள்",
      "settings-subtitle": "உங்கள் விருப்பத்தேர்வுகள் மற்றும் கணக்கு அமைப்புகளை நிர்வகிக்கவும்",
      "appearance-title": "தோற்றம்",
      "appearance-subtitle": "FanConnact இன் தோற்றத்தையும் உணர்வையும் தனிப்பயனாக்குங்கள்",
      "theme-light": "ஒளி",
      "theme-light-desc": "சுத்தமான மற்றும் பிரகாசமான",
      "theme-dark": "இருள்",
      "theme-dark-desc": "கண்களுக்கு எளிதானது",
      "theme-stadium": "அரங்கம்",
      "theme-stadium-desc": "விளையாட்டை உணருங்கள்",
      "theme-esports": "ஸ்போர்ட்ஸ்",
      "theme-esports-desc": "ஸ்போர்ட்ஸ் ரசிகர்களுக்கு",
      "theme-royal": "ராயல் ப்ளூ",
      "theme-royal-desc": "கிளாசிக் மற்றும் நேர்த்தியான",
      "compact-mode": "காம்பாக்ட் பயன்முறை",
      "compact-mode-desc": "குறைந்த இடத்தில் அதிக உள்ளடக்கத்தைக் காட்டு",
      "reduce-animations": "அனிமேஷன்களைக் குறைக்கவும்",
      "reduce-animations-desc": "மென்மையான அனுபவத்திற்கு இயக்கத்தை குறைக்கவும்",
      "large-text": "பெரிய உரை",
      "large-text-desc": "சிறந்த வாசிப்புக்கு உரை அளவை அதிகரிக்கவும்",
      "sports-title": "விளையாட்டு விருப்பத்தேர்வுகள்",
      "sports-subtitle": "தனிப்பயனாக்கப்பட்ட அறிவிப்புகளைப் பெற, உங்களுக்குப் பிடித்த விளையாட்டுகளைத் தேர்ந்தெடுக்கவும்",
      "sport-cricket": "கிரிக்கெட்",
      "sport-football": "கால்பந்து",
      "sport-basketball": "கூடைப்பந்து",
      "sport-tennis": "டென்னிஸ்",
      "sport-hockey": "ஹாக்கி",
      "sport-kabaddi": "கபடி",
      "sport-volleyball": "கைப்பந்து",
      "sport-tabletennis": "டேபிள் டென்னிஸ்",
      "sport-esports": "ஸ்போர்ட்ஸ்",
      "sport-baseball": "பேஸ்பால்",
      "sport-add-more": "மேலும் விளையாட்டுகளைச் சேர்க்கவும்",
      "notif-title": "அறிவிப்பு விருப்பத்தேர்வுகள்",
      "notif-subtitle": "நீங்கள் எதைப் பற்றி அறிவிக்க வேண்டும் என்பதைத் தேர்வுசெய்யவும்",
      "notif-live": "நேரடி போட்டி எச்சரிக்கைகள்",
      "notif-news": "பிரேக்கிங் நியூஸ்",
      "notif-predictions": "கணிப்பு முடிவுகள்",
      "notif-community": "சமூக புதுப்பிப்புகள்",
      "notif-email": "மின்னஞ்சல் அறிவிப்புகள்",
      "notif-push": "புஷ் அறிவிப்புகள்",
      "notif-mentions": "குறிப்புகள் & பதில்கள்",
      "notif-followers": "புதிய பின்தொடர்பவர்கள்",
      "security-title": "பாதுகாப்பு",
      "security-subtitle": "உங்கள் கணக்கைப் பாதுகாப்பாகவும் பாதுகாப்பாகவும் வைத்திருங்கள்",
      "security-google": "கூகுள்",
      "security-facebook": "Facebook",
      "security-connected": "இணைக்கப்பட்டது",
      "security-change-password": "கடவுச்சொல்லை மாற்றவும்",
      "security-2fa": "இரண்டு காரணி அங்கீகாரம்",
      "security-2fa-on": "அன்று",
      "security-2fa-off": "ஆஃப்",
      "security-logout-all": "அனைத்து சாதனங்களையும் வெளியேறு",
      "lang-title": "மொழி & பிராந்தியம்",
      "lang-subtitle": "உங்கள் மொழி மற்றும் பிராந்திய விருப்பங்களை நிர்வகிக்கவும்",
      "lang-language": "மொழி",
      "lang-timezone": "நேர மண்டலம்",
      "lang-region": "பிராந்தியம்",
      "support-title": "ஆதரவு & பற்றி",
      "support-subtitle": "உதவி, கருத்து மற்றும் பயன்பாட்டுத் தகவல்",
      "support-report-bug": "பிழையைப் புகாரளிக்கவும்",
      "support-feedback": "கருத்தை அனுப்பவும்",
      "support-contact": "ஆதரவைத் தொடர்பு கொள்ளவும்",
      "support-privacy": "தனியுரிமைக் கொள்கை",
      "support-terms": "விதிமுறைகள் & நிபந்தனைகள்",
      "profile-title": "சுயவிவரம்",
      "profile-edit": "சுயவிவரத்தைத் திருத்து",
      "profile-level": "நிலை",
      "profile-achievements": "சாதனைகள்",
      "profile-recent-activity": "சமீபத்திய செயல்பாடு",
      "profile-identity": "அடையாள விவரங்கள்",
      "profile-fullname": "முழுப் பெயர்",
      "profile-username": "பயனர் பெயர்",
      "profile-gender": "பாலினம்",
      "profile-dob": "பிறந்த தேதி",
      "profile-contact": "தொடர்பு தகவல்",
      "profile-email": "மின்னஞ்சல்",
      "profile-mobile": "மொபைல்",
      "profile-location": "இடம்",
      "profile-save": "மாற்றங்களைச் சேமிக்கவும்",
      "profile-cancel": "ரத்து செய்",
      "profile-signout": "கணக்கிலிருந்து வெளியேறு",
      "stats-total-predictions": "மொத்த கணிப்புகள்",
      "stats-win-rate": "வெற்றி விகிதம் %",
      "stats-xp-progress": "எக்ஸ்பி முன்னேற்றம்",
      "stats-global-rank": "உலகளாவிய தரவரிசை",
      "fancoin-title": "FanCoin பணப்பை",
      "fancoin-balance": "இருப்பு",
      "fancoin-earn": "நாணயங்கள் சம்பாதிக்க",
      "fancoin-history": "பரிவர்த்தனை வரலாறு",
      "fancoin-tagline": "நாணயங்கள் சம்பாதிக்க.",
      "fancoin-ways": "ரசிகர் நாணயங்களை சம்பாதிப்பதற்கான வழிகள்",
      "fancoin-streak": "நாள் ஸ்ட்ரீக்",
      "view-wallet": "வாலட்டைப் பார்க்கவும்",
      "earn-daily-quiz-title": "தினசரி வினாடிவினா",
      "earn-prediction-title": "போட்டி கணிப்பு",
      "earn-community-title": "சமூக செயல்பாடு",
      "earn-fanwar-title": "ரசிகர் போர்",
      "earn-daily-quiz-desc": "தினசரி வினாடி வினா கேள்விகளுக்கு பதிலளித்து நாணயங்களைப் பெறுங்கள்",
      "earn-prediction-desc": "போட்டி முடிவுகளை சரியாக கணிக்கவும்",
      "earn-community-desc": "உங்கள் ரசிகர் சமூகங்களில் செயலில் இருங்கள்",
      "earn-fanwar-desc": "ரசிகர் சண்டைகளில் பங்கேற்கவும்",
      "level-bronze": "வெண்கல விசிறி",
      "level-silver": "வெள்ளி விசிறி",
      "level-gold": "தங்க விசிறி",
      "level-diamond": "வைர விசிறி",
      "level-next": "தொடருங்கள்!",
      "level-benefits": "நிலை நன்மைகள்",
      "benefit-exclusive": "பிரத்தியேக உள்ளடக்கம்",
      "benefit-early-access": "ஆரம்ப அணுகல்",
      "benefit-badges": "சிறப்பு பேட்ஜ்கள்",
      "news-title": "செய்திகள் & புதுப்பிப்புகள்",
      "news-latest": "சமீபத்திய செய்திகள்",
      "matches-title": "நேரடி போட்டிகள்",
      "matches-upcoming": "வரவிருக்கிறது",
      "matches-live": "நேரலை",
      "matches-completed": "முடிக்கப்பட்டது",
      "footer-copyright": "© 2024 FanConnact.",
      "theme-toggle-label": "தீம் மாறு",
    },
  te: {
      "nav-home": "హోమ్",
      "nav-news": "వార్తలు",
      "nav-matches": "మ్యాచ్‌లు",
      "nav-communities": "సంఘాలు",
      "nav-leaderboard": "లీడర్‌బోర్డ్",
      "nav-live": "ప్రత్యక్ష మ్యాచ్‌లు",
      "nav-settings": "సెట్టింగ్‌లు",
      "nav-profile": "ప్రొఫైల్",
      "nav-notifications": "నోటిఫికేషన్‌లు",
      "nav-logout": "లాగ్అవుట్",
      "nav-login": "లాగిన్ చేయండి",
      "nav-signup": "సైన్ అప్ చేయండి",
      "nav-back": "వెనుకకు",
      "nav-global": "గ్లోబల్",
      "nav-player-zone": "ప్లేయర్ జోన్",
      "nav-predictions": "అంచనాలు",
      "welcome-guest": "స్వాగతం, అతిథి!",
      "welcome-back": "తిరిగి స్వాగతం,",
      "search-placeholder": "శోధన...",
      "view-all": "అన్నీ వీక్షించండి",
      "see-more": "మరిన్ని చూడండి",
      "no-results": "ఫలితాలు ఏవీ కనుగొనబడలేదు",
      "loading": "లోడ్ అవుతోంది...",
      "error-occured": "ఏదో తప్పు జరిగింది",
      "retry": "మళ్లీ ప్రయత్నించండి",
      "cancel": "రద్దు చేయి",
      "save": "సేవ్ చేయండి",
      "delete": "తొలగించు",
      "confirm": "నిర్ధారించండి",
      "version": "వెర్షన్ 1.0.0",
      "vs": "VS",
      "play-now": "ఇప్పుడే ఆడండి",
      "live-now": "ఇప్పుడు ప్రత్యక్ష ప్రసారం చేయండి",
      "app-unlock": "యాప్‌తో అన్‌లాక్ చేయండి",
      "promo-join-now": "ఇప్పుడే చేరండి",
      "match-center-view": "మ్యాచ్ కేంద్రాన్ని వీక్షించండి",
      "welcome-subtitle": "మీ అంతిమ క్రీడా సంఘం",
      "communities-title": "అభిమాన సంఘాలు",
      "status-live": "ప్రత్యక్షం",
      "promo-fan-war": "ఫ్యాన్ వార్",
      "promo-fan-war-desc": "అంతిమ అభిమానుల యుద్ధంలో చేరండి",
      "quiz-title": "క్విజ్ ఛాలెంజ్",
      "quiz-daily-cricket": "రోజువారీ క్రికెట్ క్విజ్",
      "quiz-description": "మీ క్రికెట్ పరిజ్ఞానాన్ని పరీక్షించుకోండి",
      "quiz-win": "గెలవండి",
      "predictions-trending": "ట్రెండింగ్ అంచనాలు",
      "leaderboard-top-fans": "అగ్ర అభిమానులు",
      "leaderboard-full": "పూర్తి లీడర్‌బోర్డ్",
      "time-this-week": "ఈ వారం",
      "stat-earned": "సంపాదించారు",
      "login-title": "తిరిగి స్వాగతం!",
      "login-email-label": "ఇమెయిల్ లేదా వినియోగదారు పేరు",
      "login-email-placeholder": "మీ ఇమెయిల్ లేదా వినియోగదారు పేరును నమోదు చేయండి",
      "login-password-label": "పాస్వర్డ్",
      "login-password-placeholder": "మీ పాస్‌వర్డ్‌ని నమోదు చేయండి",
      "login-submit": "లాగిన్ చేయండి",
      "login-forgot": "పాస్‌వర్డ్ మర్చిపోయారా?",
      "login-no-account": "ఖాతా లేదా?",
      "signup-title": "ఖాతాను సృష్టించండి",
      "signup-name-label": "పూర్తి పేరు",
      "signup-email-label": "ఇమెయిల్",
      "signup-password-label": "పాస్వర్డ్",
      "signup-submit": "సైన్ అప్ చేయండి",
      "signup-have-account": "ఇప్పటికే ఖాతా ఉందా?",
      "forgot-title": "పాస్‌వర్డ్‌ని రీసెట్ చేయండి",
      "forgot-submit": "రీసెట్ లింక్‌ని పంపండి",
      "settings-title": "సెట్టింగ్‌లు",
      "settings-subtitle": "మీ ప్రాధాన్యతలు మరియు ఖాతా సెట్టింగ్‌లను నిర్వహించండి",
      "appearance-title": "స్వరూపం",
      "appearance-subtitle": "FanConnact రూపాన్ని మరియు అనుభూతిని అనుకూలీకరించండి",
      "theme-light": "కాంతి",
      "theme-light-desc": "శుభ్రంగా మరియు ప్రకాశవంతంగా",
      "theme-dark": "చీకటి",
      "theme-dark-desc": "కళ్లకు తేలిక",
      "theme-stadium": "స్టేడియం",
      "theme-stadium-desc": "గేమ్ ఫీల్",
      "theme-esports": "ఎస్పోర్ట్స్",
      "theme-esports-desc": "ఎస్పోర్ట్స్ అభిమానుల కోసం",
      "theme-royal": "రాయల్ బ్లూ",
      "theme-royal-desc": "క్లాసిక్ మరియు సొగసైన",
      "compact-mode": "కాంపాక్ట్ మోడ్",
      "compact-mode-desc": "తక్కువ స్థలంలో ఎక్కువ కంటెంట్‌ని చూపండి",
      "reduce-animations": "యానిమేషన్‌లను తగ్గించండి",
      "reduce-animations-desc": "సున్నితమైన అనుభవం కోసం కదలికను తగ్గించండి",
      "large-text": "పెద్ద వచనం",
      "large-text-desc": "మెరుగైన రీడబిలిటీ కోసం టెక్స్ట్ పరిమాణాన్ని పెంచండి",
      "sports-title": "క్రీడల ప్రాధాన్యతలు",
      "sports-subtitle": "వ్యక్తిగతీకరించిన అప్‌డేట్‌లను పొందడానికి మీకు ఇష్టమైన క్రీడలను ఎంచుకోండి",
      "sport-cricket": "క్రికెట్",
      "sport-football": "ఫుట్బాల్",
      "sport-basketball": "బాస్కెట్‌బాల్",
      "sport-tennis": "టెన్నిస్",
      "sport-hockey": "హాకీ",
      "sport-kabaddi": "కబడ్డీ",
      "sport-volleyball": "వాలీబాల్",
      "sport-tabletennis": "టేబుల్ టెన్నిస్",
      "sport-esports": "ఎస్పోర్ట్స్",
      "sport-baseball": "బేస్బాల్",
      "sport-add-more": "మరిన్ని క్రీడలను జోడించండి",
      "notif-title": "నోటిఫికేషన్ ప్రాధాన్యతలు",
      "notif-subtitle": "మీరు దేని గురించి తెలియజేయాలనుకుంటున్నారో ఎంచుకోండి",
      "notif-live": "ప్రత్యక్ష మ్యాచ్ హెచ్చరికలు",
      "notif-news": "బ్రేకింగ్ న్యూస్",
      "notif-predictions": "అంచనా ఫలితాలు",
      "notif-community": "సంఘం నవీకరణలు",
      "notif-email": "ఇమెయిల్ నోటిఫికేషన్‌లు",
      "notif-push": "పుష్ నోటిఫికేషన్లు",
      "notif-mentions": "ప్రస్తావనలు & ప్రత్యుత్తరాలు",
      "notif-followers": "కొత్త అనుచరులు",
      "security-title": "భద్రత",
      "security-subtitle": "మీ ఖాతాను సురక్షితంగా మరియు సురక్షితంగా ఉంచండి",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "కనెక్ట్ చేయబడింది",
      "security-change-password": "పాస్‌వర్డ్ మార్చండి",
      "security-2fa": "రెండు-కారకాల ప్రమాణీకరణ",
      "security-2fa-on": "ఆన్",
      "security-2fa-off": "ఆఫ్",
      "security-logout-all": "అన్ని పరికరాలను లాగ్అవుట్ చేయండి",
      "lang-title": "భాష & ప్రాంతం",
      "lang-subtitle": "మీ భాష మరియు ప్రాంత ప్రాధాన్యతలను నిర్వహించండి",
      "lang-language": "భాష",
      "lang-timezone": "సమయమండలి",
      "lang-region": "ప్రాంతం",
      "support-title": "మద్దతు & గురించి",
      "support-subtitle": "సహాయం, అభిప్రాయం మరియు యాప్ సమాచారం",
      "support-report-bug": "బగ్‌ని నివేదించండి",
      "support-feedback": "అభిప్రాయాన్ని పంపండి",
      "support-contact": "మద్దతును సంప్రదించండి",
      "support-privacy": "గోప్యతా విధానం",
      "support-terms": "నిబంధనలు & షరతులు",
      "profile-title": "ప్రొఫైల్",
      "profile-edit": "ప్రొఫైల్‌ని సవరించండి",
      "profile-level": "స్థాయి",
      "profile-achievements": "విజయాలు",
      "profile-recent-activity": "ఇటీవలి కార్యాచరణ",
      "profile-identity": "గుర్తింపు వివరాలు",
      "profile-fullname": "పూర్తి పేరు",
      "profile-username": "వినియోగదారు పేరు",
      "profile-gender": "లింగం",
      "profile-dob": "పుట్టిన తేదీ",
      "profile-contact": "సంప్రదింపు సమాచారం",
      "profile-email": "ఇమెయిల్",
      "profile-mobile": "మొబైల్",
      "profile-location": "స్థానం",
      "profile-save": "మార్పులను సేవ్ చేయండి",
      "profile-cancel": "రద్దు చేయి",
      "profile-signout": "ఖాతా నుండి సైన్ అవుట్ చేయండి",
      "stats-total-predictions": "మొత్తం అంచనాలు",
      "stats-win-rate": "గెలుపు రేటు %",
      "stats-xp-progress": "XP పురోగతి",
      "stats-global-rank": "గ్లోబల్ ర్యాంక్",
      "fancoin-title": "FanCoin వాలెట్",
      "fancoin-balance": "బ్యాలెన్స్",
      "fancoin-earn": "నాణేలు సంపాదించండి",
      "fancoin-history": "లావాదేవీ చరిత్ర",
      "fancoin-tagline": "నాణేలు సంపాదించండి.",
      "fancoin-ways": "ఫ్యాన్ నాణేలను సంపాదించడానికి మార్గాలు",
      "fancoin-streak": "డే స్ట్రీక్",
      "view-wallet": "వాలెట్‌ని వీక్షించండి",
      "earn-daily-quiz-title": "రోజువారీ క్విజ్",
      "earn-prediction-title": "మ్యాచ్ ప్రిడిక్షన్",
      "earn-community-title": "సంఘం కార్యాచరణ",
      "earn-fanwar-title": "ఫ్యాన్ వార్",
      "earn-daily-quiz-desc": "రోజువారీ క్విజ్ ప్రశ్నలకు సమాధానం ఇవ్వండి మరియు నాణేలను సంపాదించండి",
      "earn-prediction-desc": "మ్యాచ్ ఫలితాలను సరిగ్గా అంచనా వేయండి",
      "earn-community-desc": "మీ అభిమాన సంఘాలలో చురుకుగా ఉండండి",
      "earn-fanwar-desc": "అభిమానుల పోరాటాలలో పాల్గొంటారు",
      "level-bronze": "కాంస్య ఫ్యాన్",
      "level-silver": "సిల్వర్ ఫ్యాన్",
      "level-gold": "గోల్డ్ ఫ్యాన్",
      "level-diamond": "డైమండ్ ఫ్యాన్",
      "level-next": "కొనసాగించు!",
      "level-benefits": "స్థాయి ప్రయోజనాలు",
      "benefit-exclusive": "ప్రత్యేకమైన కంటెంట్",
      "benefit-early-access": "ముందస్తు యాక్సెస్",
      "benefit-badges": "ప్రత్యేక బ్యాడ్జీలు",
      "news-title": "వార్తలు & నవీకరణలు",
      "news-latest": "తాజా వార్తలు",
      "matches-title": "ప్రత్యక్ష మ్యాచ్‌లు",
      "matches-upcoming": "రాబోయేది",
      "matches-live": "ప్రత్యక్ష ప్రసారం",
      "matches-completed": "పూర్తయింది",
      "footer-copyright": "© 2024 FanConnact.",
      "theme-toggle-label": "థీమ్‌ను టోగుల్ చేయండి",
    },
  mr: {
      "nav-home": "घर",
      "nav-news": "बातम्या",
      "nav-matches": "जुळतात",
      "nav-communities": "समुदाय",
      "nav-leaderboard": "लीडरबोर्ड",
      "nav-live": "थेट सामने",
      "nav-settings": "सेटिंग्ज",
      "nav-profile": "प्रोफाइल",
      "nav-notifications": "सूचना",
      "nav-logout": "लॉगआउट करा",
      "nav-login": "लॉगिन करा",
      "nav-signup": "साइन अप करा",
      "nav-back": "मागे",
      "nav-global": "जागतिक",
      "nav-player-zone": "प्लेअर झोन",
      "nav-predictions": "अंदाज",
      "welcome-guest": "स्वागत आहे, अतिथी!",
      "welcome-back": "परत स्वागत आहे,",
      "search-placeholder": "शोधा...",
      "view-all": "सर्व पहा",
      "see-more": "अधिक पहा",
      "no-results": "कोणतेही परिणाम आढळले नाहीत",
      "loading": "लोड करत आहे...",
      "error-occured": "काहीतरी चूक झाली",
      "retry": "पुन्हा प्रयत्न करा",
      "cancel": "रद्द करा",
      "save": "जतन करा",
      "delete": "हटवा",
      "confirm": "पुष्टी करा",
      "version": "आवृत्ती 1.0.0",
      "vs": "वि.स",
      "play-now": "आता खेळा",
      "live-now": "आता थेट",
      "app-unlock": "ॲपसह अनलॉक करा",
      "promo-join-now": "आता सामील व्हा",
      "match-center-view": "सामना केंद्र पहा",
      "welcome-subtitle": "तुमचा अंतिम क्रीडा समुदाय",
      "communities-title": "चाहता समुदाय",
      "status-live": "लाइव्ह",
      "promo-fan-war": "चाहता युद्ध",
      "promo-fan-war-desc": "अंतिम चाहत्यांच्या लढाईत सामील व्हा",
      "quiz-title": "क्विझ चॅलेंज",
      "quiz-daily-cricket": "दैनिक क्रिकेट क्विझ",
      "quiz-description": "तुमच्या क्रिकेट ज्ञानाची चाचणी घ्या",
      "quiz-win": "जिंकणे",
      "predictions-trending": "ट्रेंडिंग अंदाज",
      "leaderboard-top-fans": "शीर्ष चाहते",
      "leaderboard-full": "पूर्ण लीडरबोर्ड",
      "time-this-week": "या आठवड्यात",
      "stat-earned": "कमावले",
      "login-title": "परत स्वागत आहे!",
      "login-email-label": "ईमेल किंवा वापरकर्तानाव",
      "login-email-placeholder": "तुमचा ईमेल किंवा वापरकर्तानाव प्रविष्ट करा",
      "login-password-label": "पासवर्ड",
      "login-password-placeholder": "तुमचा पासवर्ड टाका",
      "login-submit": "लॉगिन करा",
      "login-forgot": "पासवर्ड विसरलात?",
      "login-no-account": "खाते नाही?",
      "signup-title": "खाते तयार करा",
      "signup-name-label": "पूर्ण नाव",
      "signup-email-label": "ईमेल",
      "signup-password-label": "पासवर्ड",
      "signup-submit": "साइन अप करा",
      "signup-have-account": "आधीच खाते आहे?",
      "forgot-title": "पासवर्ड रीसेट करा",
      "forgot-submit": "रीसेट लिंक पाठवा",
      "settings-title": "सेटिंग्ज",
      "settings-subtitle": "तुमची प्राधान्ये आणि खाते सेटिंग्ज व्यवस्थापित करा",
      "appearance-title": "देखावा",
      "appearance-subtitle": "FanConnact चे स्वरूप आणि अनुभव सानुकूलित करा",
      "theme-light": "प्रकाश",
      "theme-light-desc": "स्वच्छ आणि तेजस्वी",
      "theme-dark": "गडद",
      "theme-dark-desc": "डोळ्यांवर सोपे",
      "theme-stadium": "स्टेडियम",
      "theme-stadium-desc": "खेळ अनुभवा",
      "theme-esports": "स्पोर्ट्स",
      "theme-esports-desc": "एस्पोर्ट्स चाहत्यांसाठी",
      "theme-royal": "रॉयल ब्लू",
      "theme-royal-desc": "क्लासिक आणि गोंडस",
      "compact-mode": "कॉम्पॅक्ट मोड",
      "compact-mode-desc": "कमी जागेत अधिक सामग्री दर्शवा",
      "reduce-animations": "ॲनिमेशन कमी करा",
      "reduce-animations-desc": "नितळ अनुभवासाठी हालचाल कमी करा",
      "large-text": "मोठा मजकूर",
      "large-text-desc": "चांगल्या वाचनीयतेसाठी मजकूर आकार वाढवा",
      "sports-title": "क्रीडा प्राधान्ये",
      "sports-subtitle": "वैयक्तिकृत अद्यतने मिळविण्यासाठी तुमचे आवडते खेळ निवडा",
      "sport-cricket": "क्रिकेट",
      "sport-football": "फुटबॉल",
      "sport-basketball": "बास्केटबॉल",
      "sport-tennis": "टेनिस",
      "sport-hockey": "हॉकी",
      "sport-kabaddi": "कबड्डी",
      "sport-volleyball": "व्हॉलीबॉल",
      "sport-tabletennis": "टेबल टेनिस",
      "sport-esports": "स्पोर्ट्स",
      "sport-baseball": "बेसबॉल",
      "sport-add-more": "अधिक खेळ जोडा",
      "notif-title": "सूचना प्राधान्ये",
      "notif-subtitle": "तुम्हाला काय सूचित करायचे आहे ते निवडा",
      "notif-live": "थेट सामना सूचना",
      "notif-news": "ब्रेकिंग न्यूज",
      "notif-predictions": "अंदाज परिणाम",
      "notif-community": "समुदाय अद्यतने",
      "notif-email": "ईमेल सूचना",
      "notif-push": "पुश सूचना",
      "notif-mentions": "उल्लेख आणि प्रत्युत्तरे",
      "notif-followers": "नवीन अनुयायी",
      "security-title": "सुरक्षा",
      "security-subtitle": "तुमचे खाते सुरक्षित आणि सुरक्षित ठेवा",
      "security-google": "Google",
      "security-facebook": "फेसबुक",
      "security-connected": "जोडलेले",
      "security-change-password": "पासवर्ड बदला",
      "security-2fa": "दोन-घटक प्रमाणीकरण",
      "security-2fa-on": "चालू",
      "security-2fa-off": "बंद",
      "security-logout-all": "सर्व उपकरणे लॉगआउट करा",
      "lang-title": "भाषा आणि प्रदेश",
      "lang-subtitle": "तुमची भाषा आणि प्रदेश प्राधान्ये व्यवस्थापित करा",
      "lang-language": "भाषा",
      "lang-timezone": "टाइमझोन",
      "lang-region": "प्रदेश",
      "support-title": "समर्थन आणि बद्दल",
      "support-subtitle": "मदत, अभिप्राय आणि ॲप माहिती",
      "support-report-bug": "दोष नोंदवा",
      "support-feedback": "अभिप्राय पाठवा",
      "support-contact": "सपोर्टशी संपर्क साधा",
      "support-privacy": "गोपनीयता धोरण",
      "support-terms": "नियम आणि अटी",
      "profile-title": "प्रोफाइल",
      "profile-edit": "प्रोफाइल संपादित करा",
      "profile-level": "पातळी",
      "profile-achievements": "उपलब्धी",
      "profile-recent-activity": "अलीकडील क्रियाकलाप",
      "profile-identity": "ओळख तपशील",
      "profile-fullname": "पूर्ण नाव",
      "profile-username": "वापरकर्तानाव",
      "profile-gender": "लिंग",
      "profile-dob": "जन्मतारीख",
      "profile-contact": "संपर्क माहिती",
      "profile-email": "ईमेल",
      "profile-mobile": "मोबाईल",
      "profile-location": "स्थान",
      "profile-save": "बदल जतन करा",
      "profile-cancel": "रद्द करा",
      "profile-signout": "खाते साइन आउट करा",
      "stats-total-predictions": "एकूण अंदाज",
      "stats-win-rate": "जिंकण्याचा दर %",
      "stats-xp-progress": "XP प्रगती",
      "stats-global-rank": "जागतिक रँक",
      "fancoin-title": "फॅनकॉइन वॉलेट",
      "fancoin-balance": "शिल्लक",
      "fancoin-earn": "नाणी मिळवा",
      "fancoin-history": "व्यवहार इतिहास",
      "fancoin-tagline": "नाणी मिळवा.",
      "fancoin-ways": "फॅन नाणी मिळविण्याचे मार्ग",
      "fancoin-streak": "डे स्ट्रीक",
      "view-wallet": "वॉलेट पहा",
      "earn-daily-quiz-title": "दैनिक क्विझ",
      "earn-prediction-title": "जुळणी अंदाज",
      "earn-community-title": "समुदाय क्रियाकलाप",
      "earn-fanwar-title": "चाहता युद्ध",
      "earn-daily-quiz-desc": "दररोज क्विझ प्रश्नांची उत्तरे द्या आणि नाणी मिळवा",
      "earn-prediction-desc": "सामन्याच्या निकालांचा अचूक अंदाज लावा",
      "earn-community-desc": "तुमच्या चाहत्यांच्या समुदायांमध्ये सक्रिय रहा",
      "earn-fanwar-desc": "चाहत्यांच्या लढाईत सहभागी व्हा",
      "level-bronze": "कांस्य पंखा",
      "level-silver": "चांदीचा पंखा",
      "level-gold": "सोन्याचा पंखा",
      "level-diamond": "डायमंड फॅन",
      "level-next": "चालू ठेवा!",
      "level-benefits": "स्तर लाभ",
      "benefit-exclusive": "अनन्य सामग्री",
      "benefit-early-access": "लवकर प्रवेश",
      "benefit-badges": "विशेष बॅज",
      "news-title": "बातम्या आणि अपडेट्स",
      "news-latest": "ताज्या बातम्या",
      "matches-title": "थेट सामने",
      "matches-upcoming": "आगामी",
      "matches-live": "लाइव्ह",
      "matches-completed": "पूर्ण झाले",
      "footer-copyright": "© 2024 FanConnact.",
      "theme-toggle-label": "थीम टॉगल करा",
    },
  es: {
      "nav-home": "Hogar",
      "nav-news": "Noticias",
      "nav-matches": "Partidos",
      "nav-communities": "Comunidades",
      "nav-leaderboard": "Tabla de clasificación",
      "nav-live": "Partidos en vivo",
      "nav-settings": "Ajustes",
      "nav-profile": "Perfil",
      "nav-notifications": "Notificaciones",
      "nav-logout": "Cerrar sesión",
      "nav-login": "Acceso",
      "nav-signup": "Inscribirse",
      "nav-back": "Atrás",
      "nav-global": "Global",
      "nav-player-zone": "Zona de jugador",
      "nav-predictions": "Predicciones",
      "welcome-guest": "¡Bienvenido, invitado!",
      "welcome-back": "Bienvenido de nuevo,",
      "search-placeholder": "Buscar...",
      "view-all": "Ver todo",
      "see-more": "Ver más",
      "no-results": "No se encontraron resultados",
      "loading": "Cargando...",
      "error-occured": "algo salió mal",
      "retry": "Rever",
      "cancel": "Cancelar",
      "save": "Ahorrar",
      "delete": "Borrar",
      "confirm": "Confirmar",
      "version": "Versión 1.0.0",
      "vs": "VS",
      "play-now": "Jugar ahora",
      "live-now": "VIVE AHORA",
      "app-unlock": "Desbloquear con la aplicación",
      "promo-join-now": "Únete ahora",
      "match-center-view": "Ver centro de partidos",
      "welcome-subtitle": "Tu comunidad deportiva definitiva",
      "communities-title": "Comunidades de fans",
      "status-live": "Vivir",
      "promo-fan-war": "Guerra de fans",
      "promo-fan-war-desc": "Únete a la batalla definitiva de fans",
      "quiz-title": "Desafío de prueba",
      "quiz-daily-cricket": "Prueba diaria de críquet",
      "quiz-description": "Pon a prueba tus conocimientos de cricket",
      "quiz-win": "Ganar",
      "predictions-trending": "Predicciones de tendencia",
      "leaderboard-top-fans": "Fanáticos principales",
      "leaderboard-full": "Tabla de clasificación completa",
      "time-this-week": "Esta semana",
      "stat-earned": "Ganado",
      "login-title": "¡Bienvenido de nuevo!",
      "login-email-label": "Correo electrónico o nombre de usuario",
      "login-email-placeholder": "Introduce tu correo electrónico o nombre de usuario",
      "login-password-label": "Contraseña",
      "login-password-placeholder": "Introduce tu contraseña",
      "login-submit": "Acceso",
      "login-forgot": "¿Has olvidado tu contraseña?",
      "login-no-account": "¿No tienes una cuenta?",
      "signup-title": "Crear una cuenta",
      "signup-name-label": "Nombre completo",
      "signup-email-label": "Correo electrónico",
      "signup-password-label": "Contraseña",
      "signup-submit": "Inscribirse",
      "signup-have-account": "¿Ya tienes una cuenta?",
      "forgot-title": "Restablecer contraseña",
      "forgot-submit": "Enviar enlace de reinicio",
      "settings-title": "Ajustes",
      "settings-subtitle": "Administre sus preferencias y configuración de cuenta",
      "appearance-title": "Apariencia",
      "appearance-subtitle": "Personaliza la apariencia de FanConnact",
      "theme-light": "Luz",
      "theme-light-desc": "Limpio y brillante",
      "theme-dark": "Oscuro",
      "theme-dark-desc": "Agradable a la vista",
      "theme-stadium": "Estadio",
      "theme-stadium-desc": "Siente el juego",
      "theme-esports": "Deportes electrónicos",
      "theme-esports-desc": "Para fanáticos de los deportes electrónicos",
      "theme-royal": "azul real",
      "theme-royal-desc": "Clásico y elegante",
      "compact-mode": "Modo compacto",
      "compact-mode-desc": "Mostrar más contenido en menos espacio",
      "reduce-animations": "Reducir animaciones",
      "reduce-animations-desc": "Reduzca el movimiento para una experiencia más fluida",
      "large-text": "Texto grande",
      "large-text-desc": "Aumente el tamaño del texto para una mejor legibilidad",
      "sports-title": "Preferencias deportivas",
      "sports-subtitle": "Selecciona tus deportes favoritos para recibir actualizaciones personalizadas",
      "sport-cricket": "Cricket",
      "sport-football": "Fútbol americano",
      "sport-basketball": "Baloncesto",
      "sport-tennis": "Tenis",
      "sport-hockey": "Hockey",
      "sport-kabaddi": "Kabaddi",
      "sport-volleyball": "Voleibol",
      "sport-tabletennis": "Tenis de mesa",
      "sport-esports": "Deportes electrónicos",
      "sport-baseball": "Béisbol",
      "sport-add-more": "Añadir más deportes",
      "notif-title": "Preferencias de notificación",
      "notif-subtitle": "Elige sobre qué quieres recibir notificaciones",
      "notif-live": "Alertas de partidos en vivo",
      "notif-news": "Noticias de última hora",
      "notif-predictions": "Resultados de predicción",
      "notif-community": "Actualizaciones de la comunidad",
      "notif-email": "Notificaciones por correo electrónico",
      "notif-push": "Notificaciones push",
      "notif-mentions": "Menciones y respuestas",
      "notif-followers": "Nuevos seguidores",
      "security-title": "Seguridad",
      "security-subtitle": "Mantenga su cuenta segura y protegida",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "Conectado",
      "security-change-password": "Cambiar la contraseña",
      "security-2fa": "Autenticación de dos factores",
      "security-2fa-on": "En",
      "security-2fa-off": "Apagado",
      "security-logout-all": "Cerrar sesión en todos los dispositivos",
      "lang-title": "Idioma y región",
      "lang-subtitle": "Administre sus preferencias de idioma y región",
      "lang-language": "Idioma",
      "lang-timezone": "Zona horaria",
      "lang-region": "Región",
      "support-title": "Soporte y acerca de",
      "support-subtitle": "Ayuda, comentarios e información de la aplicación",
      "support-report-bug": "Informar error",
      "support-feedback": "Enviar comentarios",
      "support-contact": "Contactar con soporte",
      "support-privacy": "política de privacidad",
      "support-terms": "Términos y condiciones",
      "profile-title": "Perfil",
      "profile-edit": "Editar perfil",
      "profile-level": "Nivel",
      "profile-achievements": "Logros",
      "profile-recent-activity": "Actividad reciente",
      "profile-identity": "Detalles de identidad",
      "profile-fullname": "Nombre completo",
      "profile-username": "Nombre de usuario",
      "profile-gender": "Género",
      "profile-dob": "Fecha de nacimiento",
      "profile-contact": "Información de contacto",
      "profile-email": "Correo electrónico",
      "profile-mobile": "Móvil",
      "profile-location": "Ubicación",
      "profile-save": "Guardar cambios",
      "profile-cancel": "Cancelar",
      "profile-signout": "Cerrar sesión en la cuenta",
      "stats-total-predictions": "Predicciones totales",
      "stats-win-rate": "% de tasa de ganancia",
      "stats-xp-progress": "Progreso de XP",
      "stats-global-rank": "Clasificación global",
      "fancoin-title": "Monedero FanCoin",
      "fancoin-balance": "Balance",
      "fancoin-earn": "ganar monedas",
      "fancoin-history": "Historial de transacciones",
      "fancoin-tagline": "Gana monedas.",
      "fancoin-ways": "Formas de ganar Fan Coins",
      "fancoin-streak": "Racha del día",
      "view-wallet": "Ver billetera",
      "earn-daily-quiz-title": "Prueba diaria",
      "earn-prediction-title": "Predicción del partido",
      "earn-community-title": "Actividad comunitaria",
      "earn-fanwar-title": "Guerra de fans",
      "earn-daily-quiz-desc": "Responde preguntas del cuestionario diario y gana monedas.",
      "earn-prediction-desc": "Predecir correctamente los resultados de los partidos",
      "earn-community-desc": "Mantente activo en tus comunidades de fans",
      "earn-fanwar-desc": "Participa en batallas de fans.",
      "level-bronze": "Abanico de Bronce",
      "level-silver": "Abanico plateado",
      "level-gold": "Abanico dorado",
      "level-diamond": "Abanico de diamantes",
      "level-next": "¡Sigue adelante!",
      "level-benefits": "Beneficios de nivel",
      "benefit-exclusive": "Contenido exclusivo",
      "benefit-early-access": "Acceso temprano",
      "benefit-badges": "Insignias especiales",
      "news-title": "Noticias y actualizaciones",
      "news-latest": "Últimas noticias",
      "matches-title": "Partidos en vivo",
      "matches-upcoming": "Próximo",
      "matches-live": "VIVIR",
      "matches-completed": "Terminado",
      "footer-copyright": "© 2024 FanConnact.",
      "theme-toggle-label": "Alternar tema",
    },
  fr: {
      "nav-home": "Maison",
      "nav-news": "Nouvelles",
      "nav-matches": "Matchs",
      "nav-communities": "Communautés",
      "nav-leaderboard": "Classement",
      "nav-live": "Matchs en direct",
      "nav-settings": "Paramètres",
      "nav-profile": "Profil",
      "nav-notifications": "Notifications",
      "nav-logout": "Déconnexion",
      "nav-login": "Se connecter",
      "nav-signup": "S'inscrire",
      "nav-back": "Dos",
      "nav-global": "Mondial",
      "nav-player-zone": "Espace Joueur",
      "nav-predictions": "Prédictions",
      "welcome-guest": "Bienvenue, invité !",
      "welcome-back": "Content de te revoir,",
      "search-placeholder": "Recherche...",
      "view-all": "Tout afficher",
      "see-more": "Voir plus",
      "no-results": "Aucun résultat trouvé",
      "loading": "Chargement...",
      "error-occured": "Quelque chose s'est mal passé",
      "retry": "Réessayer",
      "cancel": "Annuler",
      "save": "Sauvegarder",
      "delete": "Supprimer",
      "confirm": "Confirmer",
      "version": "Version 1.0.0",
      "vs": "CONTRE",
      "play-now": "Jouez maintenant",
      "live-now": "EN DIRECT MAINTENANT",
      "app-unlock": "Déverrouiller avec l'application",
      "promo-join-now": "Inscrivez-vous maintenant",
      "match-center-view": "Voir le centre de correspondance",
      "welcome-subtitle": "Votre communauté sportive ultime",
      "communities-title": "Communautés de fans",
      "status-live": "En direct",
      "promo-fan-war": "Guerre des fans",
      "promo-fan-war-desc": "Rejoignez la bataille de fans ultime",
      "quiz-title": "Défi Quiz",
      "quiz-daily-cricket": "Quiz quotidien sur le cricket",
      "quiz-description": "Testez vos connaissances sur le cricket",
      "quiz-win": "Gagner",
      "predictions-trending": "Prédictions de tendances",
      "leaderboard-top-fans": "Meilleurs fans",
      "leaderboard-full": "Classement complet",
      "time-this-week": "Cette semaine",
      "stat-earned": "Gagné",
      "login-title": "Content de te revoir!",
      "login-email-label": "E-mail ou nom d'utilisateur",
      "login-email-placeholder": "Entrez votre email ou votre nom d'utilisateur",
      "login-password-label": "Mot de passe",
      "login-password-placeholder": "Entrez votre mot de passe",
      "login-submit": "Se connecter",
      "login-forgot": "Mot de passe oublié ?",
      "login-no-account": "Vous n'avez pas de compte ?",
      "signup-title": "Créer un compte",
      "signup-name-label": "Nom et prénom",
      "signup-email-label": "E-mail",
      "signup-password-label": "Mot de passe",
      "signup-submit": "S'inscrire",
      "signup-have-account": "Vous avez déjà un compte ?",
      "forgot-title": "Réinitialiser le mot de passe",
      "forgot-submit": "Envoyer le lien de réinitialisation",
      "settings-title": "Paramètres",
      "settings-subtitle": "Gérer vos préférences et paramètres de compte",
      "appearance-title": "Apparence",
      "appearance-subtitle": "Personnalisez l'apparence et la convivialité de FanConnact",
      "theme-light": "Lumière",
      "theme-light-desc": "Propre et lumineux",
      "theme-dark": "Sombre",
      "theme-dark-desc": "Agréable pour les yeux",
      "theme-stadium": "Stade",
      "theme-stadium-desc": "Ressentez le jeu",
      "theme-esports": "E-sport",
      "theme-esports-desc": "Pour les fans d'e-sport",
      "theme-royal": "Bleu roi",
      "theme-royal-desc": "Classique et élégant",
      "compact-mode": "Mode compact",
      "compact-mode-desc": "Afficher plus de contenu dans moins d'espace",
      "reduce-animations": "Réduire les animations",
      "reduce-animations-desc": "Réduisez les mouvements pour une expérience plus fluide",
      "large-text": "Grand texte",
      "large-text-desc": "Augmentez la taille du texte pour une meilleure lisibilité",
      "sports-title": "Préférences sportives",
      "sports-subtitle": "Sélectionnez vos sports préférés pour obtenir des mises à jour personnalisées",
      "sport-cricket": "Cricket",
      "sport-football": "Football",
      "sport-basketball": "Basket-ball",
      "sport-tennis": "Tennis",
      "sport-hockey": "Hockey",
      "sport-kabaddi": "Kabaddi",
      "sport-volleyball": "Volley-ball",
      "sport-tabletennis": "Tennis de table",
      "sport-esports": "E-sport",
      "sport-baseball": "Base-ball",
      "sport-add-more": "Ajouter plus de sports",
      "notif-title": "Préférences de notifications",
      "notif-subtitle": "Choisissez ce dont vous souhaitez être informé",
      "notif-live": "Alertes de match en direct",
      "notif-news": "Dernières nouvelles",
      "notif-predictions": "Résultats de prédiction",
      "notif-community": "Mises à jour de la communauté",
      "notif-email": "Notifications par courrier électronique",
      "notif-push": "Notifications poussées",
      "notif-mentions": "Mentions et réponses",
      "notif-followers": "Nouveaux abonnés",
      "security-title": "Sécurité",
      "security-subtitle": "Gardez votre compte en sécurité",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "Connecté",
      "security-change-password": "Changer le mot de passe",
      "security-2fa": "Authentification à deux facteurs",
      "security-2fa-on": "Sur",
      "security-2fa-off": "Désactivé",
      "security-logout-all": "Déconnecter tous les appareils",
      "lang-title": "Langue et région",
      "lang-subtitle": "Gérez vos préférences de langue et de région",
      "lang-language": "Langue",
      "lang-timezone": "Fuseau horaire",
      "lang-region": "Région",
      "support-title": "Assistance et à propos",
      "support-subtitle": "Aide, commentaires et informations sur l'application",
      "support-report-bug": "Signaler un bug",
      "support-feedback": "Envoyer des commentaires",
      "support-contact": "Contacter l'assistance",
      "support-privacy": "politique de confidentialité",
      "support-terms": "Conditions générales",
      "profile-title": "Profil",
      "profile-edit": "Modifier le profil",
      "profile-level": "Niveau",
      "profile-achievements": "Réalisations",
      "profile-recent-activity": "Activité récente",
      "profile-identity": "Détails d'identité",
      "profile-fullname": "Nom et prénom",
      "profile-username": "Nom d'utilisateur",
      "profile-gender": "Genre",
      "profile-dob": "Date de naissance",
      "profile-contact": "Coordonnées",
      "profile-email": "E-mail",
      "profile-mobile": "Mobile",
      "profile-location": "Emplacement",
      "profile-save": "Enregistrer les modifications",
      "profile-cancel": "Annuler",
      "profile-signout": "Se déconnecter du compte",
      "stats-total-predictions": "Prédictions totales",
      "stats-win-rate": "Taux de victoire %",
      "stats-xp-progress": "Progression XP",
      "stats-global-rank": "Classement mondial",
      "fancoin-title": "Portefeuille FanCoin",
      "fancoin-balance": "Équilibre",
      "fancoin-earn": "Gagnez des pièces",
      "fancoin-history": "Historique des transactions",
      "fancoin-tagline": "Gagnez des pièces.",
      "fancoin-ways": "Façons de gagner des pièces de fans",
      "fancoin-streak": "Série d'une journée",
      "view-wallet": "Voir le portefeuille",
      "earn-daily-quiz-title": "Quiz quotidien",
      "earn-prediction-title": "Prédiction du match",
      "earn-community-title": "Activité communautaire",
      "earn-fanwar-title": "Guerre des fans",
      "earn-daily-quiz-desc": "Répondez aux questions du quiz quotidien et gagnez des pièces",
      "earn-prediction-desc": "Prédire correctement les résultats des matchs",
      "earn-community-desc": "Restez actif dans vos communautés de fans",
      "earn-fanwar-desc": "Participez à des batailles de fans",
      "level-bronze": "Éventail en bronze",
      "level-silver": "Éventail en argent",
      "level-gold": "Éventail d'or",
      "level-diamond": "Éventail de diamants",
      "level-next": "Continue!",
      "level-benefits": "Avantages de niveau",
      "benefit-exclusive": "Contenu exclusif",
      "benefit-early-access": "Accès anticipé",
      "benefit-badges": "Insignes spéciaux",
      "news-title": "Nouvelles et mises à jour",
      "news-latest": "Dernières nouvelles",
      "matches-title": "Matchs en direct",
      "matches-upcoming": "Prochain",
      "matches-live": "EN DIRECT",
      "matches-completed": "Complété",
      "footer-copyright": "© 2024 FanConnact.",
      "theme-toggle-label": "Changer de thème",
    },
  ar: {
      "nav-home": "بيت",
      "nav-news": "أخبار",
      "nav-matches": "مباريات",
      "nav-communities": "المجتمعات",
      "nav-leaderboard": "المتصدرين",
      "nav-live": "المباريات الحية",
      "nav-settings": "إعدادات",
      "nav-profile": "حساب تعريفي",
      "nav-notifications": "إشعارات",
      "nav-logout": "تسجيل الخروج",
      "nav-login": "تسجيل الدخول",
      "nav-signup": "اشتراك",
      "nav-back": "خلف",
      "nav-global": "عالمي",
      "nav-player-zone": "منطقة اللاعب",
      "nav-predictions": "التنبؤات",
      "welcome-guest": "مرحباً أيها الضيف!",
      "welcome-back": "مرحبًا بعودتك،",
      "search-placeholder": "يبحث...",
      "view-all": "عرض الكل",
      "see-more": "شاهد المزيد",
      "no-results": "لم يتم العثور على نتائج",
      "loading": "تحميل...",
      "error-occured": "حدث خطأ ما",
      "retry": "أعد المحاولة",
      "cancel": "يلغي",
      "save": "يحفظ",
      "delete": "يمسح",
      "confirm": "يتأكد",
      "version": "الإصدار 1.0.0",
      "vs": "مقابل",
      "play-now": "العب الآن",
      "live-now": "عش الآن",
      "app-unlock": "فتح مع التطبيق",
      "promo-join-now": "انضم الآن",
      "match-center-view": "عرض مركز المباراة",
      "welcome-subtitle": "مجتمعك الرياضي النهائي",
      "communities-title": "مجتمعات المعجبين",
      "status-live": "يعيش",
      "promo-fan-war": "حرب المعجبين",
      "promo-fan-war-desc": "انضم إلى معركة المعجبين النهائية",
      "quiz-title": "التحدي مسابقة",
      "quiz-daily-cricket": "مسابقة الكريكيت اليومية",
      "quiz-description": "اختبر معلوماتك في لعبة الكريكيت",
      "quiz-win": "يفوز",
      "predictions-trending": "تتجه التوقعات",
      "leaderboard-top-fans": "أهم المعجبين",
      "leaderboard-full": "المتصدرين الكاملة",
      "time-this-week": "هذا الاسبوع",
      "stat-earned": "حصل",
      "login-title": "مرحبًا بعودتك!",
      "login-email-label": "البريد الإلكتروني أو اسم المستخدم",
      "login-email-placeholder": "أدخل بريدك الإلكتروني أو اسم المستخدم",
      "login-password-label": "كلمة المرور",
      "login-password-placeholder": "أدخل كلمة المرور الخاصة بك",
      "login-submit": "تسجيل الدخول",
      "login-forgot": "هل نسيت كلمة السر؟",
      "login-no-account": "ليس لديك حساب؟",
      "signup-title": "إنشاء حساب",
      "signup-name-label": "الاسم الكامل",
      "signup-email-label": "بريد إلكتروني",
      "signup-password-label": "كلمة المرور",
      "signup-submit": "اشتراك",
      "signup-have-account": "هل لديك حساب بالفعل؟",
      "forgot-title": "إعادة تعيين كلمة المرور",
      "forgot-submit": "أرسل رابط إعادة الضبط",
      "settings-title": "إعدادات",
      "settings-subtitle": "إدارة تفضيلاتك وإعدادات الحساب",
      "appearance-title": "مظهر",
      "appearance-subtitle": "قم بتخصيص شكل ومظهر FanConnact",
      "theme-light": "ضوء",
      "theme-light-desc": "نظيفة ومشرقة",
      "theme-dark": "مظلم",
      "theme-dark-desc": "سهل على العيون",
      "theme-stadium": "الملعب",
      "theme-stadium-desc": "اشعر باللعبة",
      "theme-esports": "الرياضات الإلكترونية",
      "theme-esports-desc": "لعشاق الرياضات الإلكترونية",
      "theme-royal": "الأزرق الملكي",
      "theme-royal-desc": "كلاسيكي وأنيق",
      "compact-mode": "الوضع المضغوط",
      "compact-mode-desc": "عرض المزيد من المحتوى في مساحة أقل",
      "reduce-animations": "تقليل الرسوم المتحركة",
      "reduce-animations-desc": "تقليل الحركة لتجربة أكثر سلاسة",
      "large-text": "نص كبير",
      "large-text-desc": "زيادة حجم النص لسهولة القراءة",
      "sports-title": "التفضيلات الرياضية",
      "sports-subtitle": "اختر رياضاتك المفضلة للحصول على تحديثات مخصصة",
      "sport-cricket": "لعبة الكريكيت",
      "sport-football": "كرة القدم",
      "sport-basketball": "كرة السلة",
      "sport-tennis": "التنس",
      "sport-hockey": "الهوكي",
      "sport-kabaddi": "كبادي",
      "sport-volleyball": "الكرة الطائرة",
      "sport-tabletennis": "كرة الطاولة",
      "sport-esports": "الرياضات الإلكترونية",
      "sport-baseball": "البيسبول",
      "sport-add-more": "إضافة المزيد من الألعاب الرياضية",
      "notif-title": "تفضيلات الإخطار",
      "notif-subtitle": "اختر ما تريد أن يتم إعلامك به",
      "notif-live": "تنبيهات المباراة الحية",
      "notif-news": "الأخبار العاجلة",
      "notif-predictions": "نتائج التنبؤ",
      "notif-community": "تحديثات المجتمع",
      "notif-email": "إشعارات البريد الإلكتروني",
      "notif-push": "دفع الإخطارات",
      "notif-mentions": "الإشارات والردود",
      "notif-followers": "متابعين جدد",
      "security-title": "حماية",
      "security-subtitle": "حافظ على حسابك آمنًا ومأمونًا",
      "security-google": "جوجل",
      "security-facebook": "فيسبوك",
      "security-connected": "متصل",
      "security-change-password": "تغيير كلمة المرور",
      "security-2fa": "المصادقة الثنائية",
      "security-2fa-on": "على",
      "security-2fa-off": "عن",
      "security-logout-all": "تسجيل الخروج من جميع الأجهزة",
      "lang-title": "اللغة والمنطقة",
      "lang-subtitle": "إدارة تفضيلات اللغة والمنطقة الخاصة بك",
      "lang-language": "لغة",
      "lang-timezone": "المنطقة الزمنية",
      "lang-region": "منطقة",
      "support-title": "الدعم والمعلومات",
      "support-subtitle": "المساعدة والتعليقات ومعلومات التطبيق",
      "support-report-bug": "الإبلاغ عن الخطأ",
      "support-feedback": "إرسال الملاحظات",
      "support-contact": "اتصل بالدعم",
      "support-privacy": "سياسة الخصوصية",
      "support-terms": "الشروط والأحكام",
      "profile-title": "حساب تعريفي",
      "profile-edit": "تحرير الملف الشخصي",
      "profile-level": "مستوى",
      "profile-achievements": "الإنجازات",
      "profile-recent-activity": "النشاط الأخير",
      "profile-identity": "تفاصيل الهوية",
      "profile-fullname": "الاسم الكامل",
      "profile-username": "اسم المستخدم",
      "profile-gender": "جنس",
      "profile-dob": "تاريخ الميلاد",
      "profile-contact": "معلومات الاتصال",
      "profile-email": "بريد إلكتروني",
      "profile-mobile": "متحرك",
      "profile-location": "موقع",
      "profile-save": "حفظ التغييرات",
      "profile-cancel": "يلغي",
      "profile-signout": "تسجيل الخروج من الحساب",
      "stats-total-predictions": "مجموع التوقعات",
      "stats-win-rate": "معدل الفوز %",
      "stats-xp-progress": "تقدم XP",
      "stats-global-rank": "المرتبة العالمية",
      "fancoin-title": "محفظة فان كوين",
      "fancoin-balance": "توازن",
      "fancoin-earn": "كسب العملات المعدنية",
      "fancoin-history": "تاريخ المعاملات",
      "fancoin-tagline": "كسب العملات المعدنية.",
      "fancoin-ways": "طرق لكسب عملات المعجبين",
      "fancoin-streak": "خط اليوم",
      "view-wallet": "عرض المحفظة",
      "earn-daily-quiz-title": "مسابقة يومية",
      "earn-prediction-title": "توقعات المباراة",
      "earn-community-title": "نشاط المجتمع",
      "earn-fanwar-title": "حرب المعجبين",
      "earn-daily-quiz-desc": "أجب عن أسئلة الاختبار اليومي واكسب العملات المعدنية",
      "earn-prediction-desc": "توقع نتائج المباراة بشكل صحيح",
      "earn-community-desc": "ابق نشطًا في مجتمعات المعجبين بك",
      "earn-fanwar-desc": "المشاركة في معارك المعجبين",
      "level-bronze": "مروحة برونزية",
      "level-silver": "المروحة الفضية",
      "level-gold": "مروحة الذهب",
      "level-diamond": "مروحة الماس",
      "level-next": "يستمر في التقدم!",
      "level-benefits": "فوائد المستوى",
      "benefit-exclusive": "محتوى حصري",
      "benefit-early-access": "الوصول المبكر",
      "benefit-badges": "شارات خاصة",
      "news-title": "الأخبار والمستجدات",
      "news-latest": "آخر الأخبار",
      "matches-title": "المباريات الحية",
      "matches-upcoming": "القادمة",
      "matches-live": "يعيش",
      "matches-completed": "مكتمل",
      "footer-copyright": "© 2024 فانكوناكت.",
      "theme-toggle-label": "تبديل الموضوع",
    },
  };

  // Build a reverse map: English text -> key (so we can auto-translate
  // static UI strings on pages that don't have data-i18n tags).
  const EN = translations.en || {};
  const TEXT_TO_KEY = {};
  Object.keys(EN).forEach((k) => {
    const v = EN[k];
    if (typeof v === "string" && v.trim()) TEXT_TO_KEY[v.trim()] = k;
  });

  function applyLanguage(lang) {
    // 1. Explicit data-i18n elements (settings, login, etc.)
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      let text = null;
      if (translations[lang] && translations[lang][key]) {
        text = translations[lang][key];
      } else if (translations.en && translations.en[key]) {
        text = translations.en[key];
      }
      if (text !== null) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          if (el.type === "text" || el.type === "email" || el.type === "search" || el.type === "password") {
            el.placeholder = text;
          }
        } else {
          el.textContent = text;
        }
      }
    });

    // 2. Auto-translate common static UI strings site-wide (nav, headings,
    //    buttons, tabs) by matching their visible English text. This makes
    //    language changes apply across EVERY page without manual tagging.
    if (lang !== "en" && translations[lang]) {
      const skipTags = new Set(["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "IMG", "BR", "SVG", "PATH"]);
      const walk = (root) => {
        const nodes = root.childNodes;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.nodeType === 3) { // text node
            const raw = n.nodeValue.trim();
            if (!raw) continue;
            const key = TEXT_TO_KEY[raw];
            if (key && translations[lang][key]) {
              n.nodeValue = translations[lang][key];
            }
          } else if (n.nodeType === 1 && !skipTags.has(n.tagName) && !n.hasAttribute("data-i18n")) {
            // Don't descend into elements that hold dynamic match data
            if (n.hasAttribute("data-match-id") || n.hasAttribute("data-purpose") && /matches|carousel|hero/i.test(n.getAttribute("data-purpose") || "")) continue;
            walk(n);
          }
        }
      };
      walk(document.body);
    }

    localStorage.setItem("fanconnect-lang", lang);
    document.documentElement.lang = LANG_CODES[lang] || lang;
  }

  // Load saved language
  const savedLang = localStorage.getItem("fanconnect-lang") || "en";
  applyLanguage(savedLang);
  window.applyLanguage = applyLanguage;
  window.LANG_CODES = LANG_CODES;

  // 1. Initial Icon Sync
  const syncIcons = () => {
    const darkIcon = document.getElementById("theme-toggle-dark-icon");
    const lightIcon = document.getElementById("theme-toggle-light-icon");
    const isDark = document.documentElement.classList.contains("dark");

    if (isDark) {
      darkIcon?.classList.remove("hidden");
      lightIcon?.classList.add("hidden");
    } else {
      darkIcon?.classList.add("hidden");
      lightIcon?.classList.remove("hidden");
    }
  };
  syncIcons();

  // 2. Theme handled by theme.js — only sync icons on load

  // 2.1 Listen for changes from other tabs
  window.addEventListener("storage", (e) => {
    if (e.key === "color-theme") {
      const isDark = e.newValue === "dark";
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.classList.toggle("light", !isDark);
      syncIcons();
    }
  });

  // --- Sidebar mobile backdrop (created once, shared across all pages) ---
  let sidebarBackdrop = document.getElementById("sidebar-backdrop");
  if (!sidebarBackdrop && sidebar) {
    sidebarBackdrop = document.createElement("div");
    sidebarBackdrop.id = "sidebar-backdrop";
    sidebarBackdrop.className =
      "fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300 lg:hidden";
    document.body.appendChild(sidebarBackdrop);
    sidebarBackdrop.addEventListener("click", () => closeSidebar());
  }
  function openSidebar() {
    if (!sidebar) return;
    if (window.innerWidth >= 1024) {
      // Desktop: collapse/expand via width (sidebar is static here)
      sidebar.classList.remove("sidebar-collapsed");
    } else {
      sidebar.classList.remove("-translate-x-full");
    }
    localStorage.setItem("sidebar-hidden", "false");
    headerLogo?.classList.add("header-logo-hidden");
    headerLogo?.classList.remove("header-logo-show");
    sidebarBackdrop?.classList.add("opacity-0", "pointer-events-none");
  }
  function closeSidebar() {
    if (!sidebar) return;
    if (window.innerWidth >= 1024) {
      // Desktop: collapse the sidebar to 0 width so main content expands
      sidebar.classList.add("sidebar-collapsed");
    } else {
      sidebar.classList.add("-translate-x-full");
    }
    localStorage.setItem("sidebar-hidden", "true");
    headerLogo?.classList.remove("header-logo-hidden");
    headerLogo?.classList.add("header-logo-show");
    sidebarBackdrop?.classList.add("opacity-0", "pointer-events-none");
  }

  // 3. Sidebar Toggle (works on every screen size)
  mobileMenuBtn?.addEventListener("click", () => {
    if (!sidebar) return;
    const isOpen = window.innerWidth >= 1024
      ? !sidebar.classList.contains("sidebar-collapsed")
      : !sidebar.classList.contains("-translate-x-full");
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Sidebar Close Button
  closeSidebarBtn?.addEventListener("click", closeSidebar);

  // 4. Navigation Interceptor & Mobile Sidebar Close
  const navLinks = document.querySelectorAll(
    "nav a, .nav-link, aside a, .fixed.bottom-0 a",
  );
  navLinks?.forEach((link) => {
    link.addEventListener("click", (e) => {
      const navTextElement = link.querySelector(".nav-text");
      const linkText = (
        navTextElement ? navTextElement.textContent : link.textContent
      ).trim();
      const href = link.getAttribute("href");

      if (link.tagName === "BUTTON") return; // Don't intercept button clicks

      // Define which tabs are accessible without login
      const allowedTabs = ["Home", "News", "News & Updates"];
      const isHomeOrNews =
        allowedTabs.some((t) => linkText.includes(t)) || href === "dashboard.html";

      // Define sport-related pages that require login.
      // This array should include all sport-specific pages and general match pages.
      // The `includes` check is broad, so ensure unique names if needed.
      // For example, "Matches" could be a general page, while "Cricket" is specific.
      // The current setup assumes "Matches" in the top nav and sidebar refers to livematches.html
      // and individual sport names refer to their respective pages.
      const sportPagesRequiringLogin = [
        "Live Matches",
        "Matches", // For the top header "Matches" link
        "Match Center",
        "Football",
        "Basketball",
        "Tennis",
        "Baseball",
        "Cricket", // Assuming cricket.html is also a sport page
        "Hockey",
        "All Games",
      ];

      // Check if the clicked link is a sport-related page (or general match page)
      // and requires login. If the user is not logged in, redirect to login.
      // Otherwise, proceed with navigation.
      if (sportPagesRequiringLogin.some((sport) => linkText.includes(sport))) {
        if (!currentUser) {
          e.preventDefault();
          window.location.href = "login.html";
        }
        return;
      }

      // If guest clicks a link to dashboard.html, redirect to login page instead
      if (!currentUser && href === "dashboard.html") {
        e.preventDefault();
        if (window.innerWidth < 1024) {
          closeSidebar();
        }
        window.location.href = "login.html";
        return;
      }

      // Check if the clicked tab is restricted AND user is not logged in
      if (
        linkText &&
        !currentUser &&
        !isHomeOrNews &&
        href !== "login.html" &&
        href !== "signup.html"
      ) {
        e.preventDefault();
        window.location.href = "login.html";
        return;
      }

      if (window.innerWidth < 1024) {
        closeSidebar();
      }
    });
  });

  // 6. Profile Page Redirect
  profileTrigger?.addEventListener("click", () => {
    window.location.href = "profile.html";
  });

  // 7. Notification Page Redirect
  document.querySelectorAll(".notification-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      window.location.href = "notification.html";
    });
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth < 1024 &&
      sidebar &&
      !sidebar.contains(e.target) &&
      mobileMenuBtn &&
      !mobileMenuBtn.contains(e.target)
    ) {
      closeSidebar();
    }
  });

  // 8. Search Autocomplete — opens player.html on result click
  (function() {
    var searchInput = document.querySelector('input[placeholder="Search teams, matches, players..."]');
    if (!searchInput) return;

    var wrapper = searchInput.parentElement;
    wrapper.style.position = "relative";
    var dropdown = document.createElement("div");
    dropdown.className = "absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto hidden";
    wrapper.appendChild(dropdown);

    var playerCache = null;
    var fetchPromise = null;

    function fetchAllPlayers() {
      if (fetchPromise) return fetchPromise;
      playerCache = [];
      var sports = [
        { id: "cricket", name: "Cricket" },
        { id: "football", name: "Football" },
        { id: "basketball", name: "Basketball" },
        { id: "tennis", name: "Tennis" },
        { id: "baseball", name: "Baseball" },
        { id: "hockey", name: "Hockey" },
        { id: "volleyball", name: "Volleyball" },
        { id: "kabbaddi", name: "Kabaddi" },
        { id: "e-sports", name: "E-Sports" },
        { id: "table-tennis", name: "Table Tennis" }
      ];
      var promises = sports.map(function(s) {
        return fetch(((window.FC_API && window.FC_API.api) ? window.FC_API.api() : "") + "/rankings/" + s.id + "?limit=100")
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data && data.players) {
              data.players.forEach(function(p) {
                if (p && p.name) {
                  playerCache.push({
                    name: p.name,
                    sport: s.name,
                    sportId: s.id,
                    country: p.country || "",
                    img: p.imgUrl || ""
                  });
                }
              });
            }
          })
          .catch(function() {});
      });
      fetchPromise = Promise.all(promises);
      return fetchPromise;
    }

    searchInput.addEventListener("input", function() {
      var query = this.value.trim();
      if (query.length < 2) {
        dropdown.classList.add("hidden");
        return;
      }
      fetchAllPlayers().then(function() {
        if (query !== searchInput.value.trim()) return;
        var lower = query.toLowerCase();
        var results = playerCache.filter(function(p) {
          return p.name.toLowerCase().indexOf(lower) !== -1;
        });
        results = results.slice(0, 8);
        if (results.length === 0) {
          dropdown.classList.add("hidden");
          return;
        }
        dropdown.innerHTML = "";
        results.forEach(function(p) {
          var item = document.createElement("div");
          item.className = "flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0";
          var img = p.img || "https://ui-avatars.com/api/?name=" + encodeURIComponent(p.name.substring(0, 2)) + "&background=8b5cf6&color=fff&size=40";
          var detail = p.sport + (p.country ? " • " + p.country : "");
          item.innerHTML = '<img src="' + img + '" class="w-8 h-8 rounded-full object-cover" onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.name.substring(0, 2)) + '&background=8b5cf6&color=fff&size=40\'"><div class="min-w-0"><div class="text-sm font-bold text-gray-900 dark:text-white truncate">' + p.name + '</div><div class="text-[10px] text-gray-500 truncate">' + detail + '</div></div>';
          (function(playerName, playerSport) {
            item.addEventListener("click", function() {
              openPlayerProfile(playerName, playerSport);
            });
          })(p.name, p.sport);
          dropdown.appendChild(item);
        });
        dropdown.classList.remove("hidden");
      });
    });

    function openPlayerProfile(playerName, sportName) {
      var sidMap = {
        "Cricket": "cricket", "Football": "football", "Basketball": "basketball",
        "Tennis": "tennis", "Baseball": "baseball", "Hockey": "hockey",
        "Volleyball": "volleyball", "Kabaddi": "kabbaddi",
        "E-Sports": "e-sports", "Table Tennis": "table-tennis"
      };
      var sid = sidMap[sportName] || "cricket";
      fetch(((window.FC_API && window.FC_API.api) ? window.FC_API.api() : "") + "/rankings/" + sid + "?limit=100")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && data.players) {
            var found = null;
            for (var i = 0; i < data.players.length; i++) {
              if (data.players[i].name && data.players[i].name.toLowerCase() === playerName.toLowerCase()) {
                found = data.players[i];
                break;
              }
            }
            if (found) {
              sessionStorage.setItem("playerSport", sportName);
              sessionStorage.setItem("playerView", JSON.stringify({ player: found, sport: sportName }));
              window.location.href = "player.html";
            }
          }
        })
        .catch(function(e) { console.error("Search nav error", e); });
    }

    document.addEventListener("click", function(e) {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });

    searchInput.addEventListener("focus", function() {
      if (this.value.trim().length >= 2) {
        this.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  })();
});

