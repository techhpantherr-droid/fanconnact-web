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
  // list). Individual match cards use m.link â†’ match-center.html directly.
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
      // Pages guests are allowed to see.
      // Home, Match Center and Live Matches are public for everyone.
      // The auth pages stay open as well, otherwise a guest landing on
      // index.html could never reach the sign-in form to log in.
      // Every other page (dashboard, predictions, FanCoins, profile, settings,
      // leaderboards, per-sport pages, ...) redirects back to the pre-login
      // landing page.
      const guestAllowedPages = [
        "index.html",
        "match-center.html",
        "livematches.html",
        "login.html",
        "signup.html",
        "forget-password.html",
        "reset-password.html",
        "terms.html",
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
        welcomeElem.innerHTML = `Welcome back, ${displayIdentity}! <span class="ml-2 text-2xl">ðŸ‘‹</span>`;
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
            // No profile doc yet: still paint the real auth identity so the
            // header never keeps a hardcoded placeholder shipped in the HTML.
            if (userNameElem) userNameElem.textContent = `@${displayIdentity}`;
            if (userLevelElem) userLevelElem.textContent = "—";
            if (welcomeElem) welcomeElem.textContent = `Welcome back, ${displayIdentity}!`;
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
          const rawCoins = Number.isFinite(Number(data.coins)) ? Number(data.coins) : 0;
          const coins = Math.max(0, rawCoins); // never negative
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
      if (userLevelElem) userLevelElem.textContent = "—";
      if (welcomeElem)
        welcomeElem.innerHTML = `Welcome, Guest! <span class="ml-2 text-2xl">ðŸ‘‹</span>`;
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
      "login-title": "Welcome Back! ðŸ‘‹",
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
      "footer-copyright": "Â© 2024 FanConnact. All rights reserved.",
      "theme-toggle-label": "Toggle theme",
    },
    hi: {
      "nav-home": "à¤¹à¥‹à¤®", "nav-news": "à¤¸à¤®à¤¾à¤šà¤¾à¤°", "nav-matches": "à¤®à¥ˆà¤š",
      "nav-communities": "à¤¸à¤®à¥à¤¦à¤¾à¤¯", "nav-leaderboard": "à¤²à¥€à¤¡à¤°à¤¬à¥‹à¤°à¥à¤¡",
      "nav-live": "à¤²à¤¾à¤‡à¤µ à¤®à¥ˆà¤š", "nav-settings": "à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸",
      "nav-profile": "à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤²", "nav-notifications": "à¤¸à¥‚à¤šà¤¨à¤¾à¤à¤‚",
      "nav-logout": "à¤²à¥‰à¤— à¤†à¤‰à¤Ÿ", "nav-login": "à¤²à¥‰à¤—à¤¿à¤¨", "nav-signup": "à¤¸à¤¾à¤‡à¤¨ à¤…à¤ª",
      "nav-back": "à¤µà¤¾à¤ªà¤¸",
      "welcome-guest": "à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤¹à¥ˆ, à¤…à¤¤à¤¿à¤¥à¤¿!",
      "welcome-back": "à¤µà¤¾à¤ªà¤¸à¥€ à¤ªà¤° à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤¹à¥ˆ,",
      "search-placeholder": "à¤–à¥‹à¤œà¥‡à¤‚...",
      "view-all": "à¤¸à¤­à¥€ à¤¦à¥‡à¤–à¥‡à¤‚", "see-more": "à¤”à¤° à¤¦à¥‡à¤–à¥‡à¤‚",
      "no-results": "à¤•à¥‹à¤ˆ à¤ªà¤°à¤¿à¤£à¤¾à¤® à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾",
      "loading": "à¤²à¥‹à¤¡ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...",
      "error-occured": "à¤•à¥à¤› à¤—à¤²à¤¤ à¤¹à¥‹ à¤—à¤¯à¤¾",
      "retry": "à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤•à¤°à¥‡à¤‚",
      "cancel": "à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚", "save": "à¤¸à¤¹à¥‡à¤œà¥‡à¤‚",
      "delete": "à¤¹à¤Ÿà¤¾à¤à¤‚", "confirm": "à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤•à¤°à¥‡à¤‚",
      "version": "à¤¸à¤‚à¤¸à¥à¤•à¤°à¤£ 1.0.0",
      "login-title": "à¤µà¤¾à¤ªà¤¸à¥€ à¤ªà¤° à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤¹à¥ˆ! ðŸ‘‹",
      "login-email-label": "à¤ˆà¤®à¥‡à¤² à¤¯à¤¾ à¤‰à¤ªà¤¯à¥‹à¤—à¤•à¤°à¥à¤¤à¤¾ à¤¨à¤¾à¤®",
      "login-email-placeholder": "à¤…à¤ªà¤¨à¤¾ à¤ˆà¤®à¥‡à¤² à¤¯à¤¾ à¤‰à¤ªà¤¯à¥‹à¤—à¤•à¤°à¥à¤¤à¤¾ à¤¨à¤¾à¤® à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚",
      "login-password-label": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡",
      "login-password-placeholder": "à¤…à¤ªà¤¨à¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚",
      "login-submit": "à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¥‡à¤‚",
      "login-forgot": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤­à¥‚à¤² à¤—à¤?",
      "login-no-account": "à¤–à¤¾à¤¤à¤¾ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ?",
      "signup-title": "à¤–à¤¾à¤¤à¤¾ à¤¬à¤¨à¤¾à¤à¤‚",
      "signup-name-label": "à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤®",
      "signup-email-label": "à¤ˆà¤®à¥‡à¤²",
      "signup-password-label": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡",
      "signup-submit": "à¤¸à¤¾à¤‡à¤¨ à¤…à¤ª à¤•à¤°à¥‡à¤‚",
      "signup-have-account": "à¤ªà¤¹à¤²à¥‡ à¤¸à¥‡ à¤–à¤¾à¤¤à¤¾ à¤¹à¥ˆ?",
      "forgot-title": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤°à¥€à¤¸à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚",
      "forgot-submit": "à¤°à¥€à¤¸à¥‡à¤Ÿ à¤²à¤¿à¤‚à¤• à¤­à¥‡à¤œà¥‡à¤‚",
      "settings-title": "à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸",
      "settings-subtitle": "à¤…à¤ªà¤¨à¥€ à¤ªà¥à¤°à¤¾à¤¥à¤®à¤¿à¤•à¤¤à¤¾à¤à¤‚ à¤”à¤° à¤–à¤¾à¤¤à¤¾ à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚",
      "appearance-title": "à¤¦à¤¿à¤–à¤¾à¤µà¤Ÿ",
      "appearance-subtitle": "FanConnact à¤•à¥‡ à¤°à¥‚à¤ª à¤”à¤° à¤…à¤¨à¥à¤­à¤µ à¤•à¥‹ à¤…à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤•à¤°à¥‡à¤‚",
      "theme-light": "à¤²à¤¾à¤‡à¤Ÿ", "theme-light-desc": "à¤¸à¤¾à¤« à¤”à¤° à¤‰à¤œà¥à¤œà¥à¤µà¤²",
      "theme-dark": "à¤¡à¤¾à¤°à¥à¤•", "theme-dark-desc": "à¤†à¤‚à¤–à¥‹à¤‚ à¤•à¥‡ à¤²à¤¿à¤ à¤†à¤¸à¤¾à¤¨",
      "theme-stadium": "à¤¸à¥à¤Ÿà¥‡à¤¡à¤¿à¤¯à¤®", "theme-stadium-desc": "à¤–à¥‡à¤² à¤•à¤¾ à¤…à¤¨à¥à¤­à¤µ à¤•à¤°à¥‡à¤‚",
      "theme-esports": "à¤ˆà¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸", "theme-esports-desc": "à¤ˆà¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸ à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤•à¥‹à¤‚ à¤•à¥‡ à¤²à¤¿à¤",
      "theme-royal": "à¤°à¥‰à¤¯à¤² à¤¬à¥à¤²à¥‚", "theme-royal-desc": "à¤•à¥à¤²à¤¾à¤¸à¤¿à¤• à¤”à¤° à¤¸à¥à¤‚à¤¦à¤°",
      "compact-mode": "à¤•à¥‰à¤®à¥à¤ªà¥ˆà¤•à¥à¤Ÿ à¤®à¥‹à¤¡",
      "compact-mode-desc": "à¤•à¤® à¤¸à¥à¤¥à¤¾à¤¨ à¤®à¥‡à¤‚ à¤…à¤§à¤¿à¤• à¤¸à¤¾à¤®à¤—à¥à¤°à¥€ à¤¦à¤¿à¤–à¤¾à¤à¤‚",
      "reduce-animations": "à¤à¤¨à¤¿à¤®à¥‡à¤¶à¤¨ à¤•à¤® à¤•à¤°à¥‡à¤‚",
      "reduce-animations-desc": "à¤¸à¥à¤šà¤¾à¤°à¥‚ à¤…à¤¨à¥à¤­à¤µ à¤•à¥‡ à¤²à¤¿à¤ à¤—à¤¤à¤¿ à¤•à¤® à¤•à¤°à¥‡à¤‚",
      "large-text": "à¤¬à¤¡à¤¼à¤¾ à¤Ÿà¥‡à¤•à¥à¤¸à¥à¤Ÿ",
      "large-text-desc": "à¤¬à¥‡à¤¹à¤¤à¤° à¤ªà¤ à¤¨à¥€à¤¯à¤¤à¤¾ à¤•à¥‡ à¤²à¤¿à¤ à¤Ÿà¥‡à¤•à¥à¤¸à¥à¤Ÿ à¤†à¤•à¤¾à¤° à¤¬à¤¢à¤¼à¤¾à¤à¤‚",
      "sports-title": "à¤–à¥‡à¤² à¤ªà¥à¤°à¤¾à¤¥à¤®à¤¿à¤•à¤¤à¤¾à¤à¤‚",
      "sports-subtitle": "à¤µà¥ˆà¤¯à¤•à¥à¤¤à¤¿à¤•à¥ƒà¤¤ à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¥‡ à¤²à¤¿à¤ à¤…à¤ªà¤¨à¥‡ à¤ªà¤¸à¤‚à¤¦à¥€à¤¦à¤¾ à¤–à¥‡à¤² à¤šà¥à¤¨à¥‡à¤‚",
      "sport-cricket": "à¤•à¥à¤°à¤¿à¤•à¥‡à¤Ÿ", "sport-football": "à¤«à¤¼à¥à¤Ÿà¤¬à¥‰à¤²",
      "sport-basketball": "à¤¬à¤¾à¤¸à¥à¤•à¥‡à¤Ÿà¤¬à¥‰à¤²", "sport-tennis": "à¤Ÿà¥‡à¤¨à¤¿à¤¸",
      "sport-hockey": "à¤¹à¥‰à¤•à¥€", "sport-kabaddi": "à¤•à¤¬à¤¡à¥à¤¡à¥€",
      "sport-volleyball": "à¤µà¥‰à¤²à¥€à¤¬à¥‰à¤²", "sport-tabletennis": "à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥‡à¤¨à¤¿à¤¸",
      "sport-esports": "à¤ˆà¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸", "sport-baseball": "à¤¬à¥‡à¤¸à¤¬à¥‰à¤²",
      "sport-add-more": "à¤”à¤° à¤–à¥‡à¤² à¤œà¥‹à¤¡à¤¼à¥‡à¤‚",
      "notif-title": "à¤¸à¥‚à¤šà¤¨à¤¾ à¤ªà¥à¤°à¤¾à¤¥à¤®à¤¿à¤•à¤¤à¤¾à¤à¤‚",
      "notif-subtitle": "à¤šà¥à¤¨à¥‡à¤‚ à¤•à¤¿ à¤†à¤ª à¤•à¤¿à¤¸ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚ à¤¸à¥‚à¤šà¤¿à¤¤ à¤¹à¥‹à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚",
      "notif-live": "à¤²à¤¾à¤‡à¤µ à¤®à¥ˆà¤š à¤…à¤²à¤°à¥à¤Ÿ",
      "notif-news": "à¤¬à¥à¤°à¥‡à¤•à¤¿à¤‚à¤— à¤¨à¥à¤¯à¥‚à¤œà¤¼",
      "notif-predictions": "à¤­à¤µà¤¿à¤·à¥à¤¯à¤µà¤¾à¤£à¥€ à¤ªà¤°à¤¿à¤£à¤¾à¤®",
      "notif-community": "à¤¸à¤®à¥à¤¦à¤¾à¤¯ à¤…à¤ªà¤¡à¥‡à¤Ÿ",
      "notif-email": "à¤ˆà¤®à¥‡à¤² à¤¸à¥‚à¤šà¤¨à¤¾à¤à¤‚",
      "notif-push": "à¤ªà¥à¤¶ à¤¸à¥‚à¤šà¤¨à¤¾à¤à¤‚",
      "notif-mentions": "à¤‰à¤²à¥à¤²à¥‡à¤– à¤”à¤° à¤‰à¤¤à¥à¤¤à¤°",
      "notif-followers": "à¤¨à¤ à¤…à¤¨à¥à¤¯à¤¾à¤¯à¥€",
      "security-title": "à¤¸à¥à¤°à¤•à¥à¤·à¤¾",
      "security-subtitle": "à¤…à¤ªà¤¨à¥‡ à¤–à¤¾à¤¤à¥‡ à¤•à¥‹ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤°à¤–à¥‡à¤‚",
      "security-google": "à¤—à¥‚à¤—à¤²",
      "security-facebook": "à¤«à¤¼à¥‡à¤¸à¤¬à¥à¤•",
      "security-connected": "à¤•à¤¨à¥‡à¤•à¥à¤Ÿà¥‡à¤¡",
      "security-change-password": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¬à¤¦à¤²à¥‡à¤‚",
      "security-2fa": "à¤¦à¥‹-à¤šà¤°à¤£à¥€à¤¯ à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¤°à¤£",
      "security-2fa-on": "à¤šà¤¾à¤²à¥‚", "security-2fa-off": "à¤¬à¤‚à¤¦",
      "security-logout-all": "à¤¸à¤­à¥€ à¤¡à¤¿à¤µà¤¾à¤‡à¤¸ à¤¸à¥‡ à¤²à¥‰à¤— à¤†à¤‰à¤Ÿ à¤•à¤°à¥‡à¤‚",
      "lang-title": "à¤­à¤¾à¤·à¤¾ à¤”à¤° à¤•à¥à¤·à¥‡à¤¤à¥à¤°",
      "lang-subtitle": "à¤…à¤ªà¤¨à¥€ à¤­à¤¾à¤·à¤¾ à¤”à¤° à¤•à¥à¤·à¥‡à¤¤à¥à¤° à¤ªà¥à¤°à¤¾à¤¥à¤®à¤¿à¤•à¤¤à¤¾à¤à¤‚ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚",
      "lang-language": "à¤­à¤¾à¤·à¤¾",
      "lang-timezone": "à¤¸à¤®à¤¯ à¤•à¥à¤·à¥‡à¤¤à¥à¤°",
      "lang-region": "à¤•à¥à¤·à¥‡à¤¤à¥à¤°",
      "support-title": "à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤”à¤° à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€",
      "support-subtitle": "à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾, à¤ªà¥à¤°à¤¤à¤¿à¤•à¥à¤°à¤¿à¤¯à¤¾ à¤”à¤° à¤à¤ª à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€",
      "support-report-bug": "à¤¬à¤— à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ à¤•à¤°à¥‡à¤‚",
      "support-feedback": "à¤ªà¥à¤°à¤¤à¤¿à¤•à¥à¤°à¤¿à¤¯à¤¾ à¤­à¥‡à¤œà¥‡à¤‚",
      "support-contact": "à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤¸à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚",
      "support-privacy": "à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾ à¤¨à¥€à¤¤à¤¿",
      "support-terms": "à¤¨à¤¿à¤¯à¤® à¤”à¤° à¤¶à¤°à¥à¤¤à¥‡à¤‚",
      "profile-title": "à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤²",
      "profile-edit": "à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤² à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤ à¤•à¤°à¥‡à¤‚",
      "profile-level": "à¤¸à¥à¤¤à¤°",
      "fancoin-title": "à¤«à¥ˆà¤¨à¤•à¥‰à¤‡à¤¨ à¤µà¥‰à¤²à¥‡à¤Ÿ",
      "fancoin-balance": "à¤¬à¥ˆà¤²à¥‡à¤‚à¤¸",
      "fancoin-earn": "à¤•à¥‰à¤‡à¤¨ à¤•à¤®à¤¾à¤à¤‚",
      "fancoin-history": "à¤²à¥‡à¤¨-à¤¦à¥‡à¤¨ à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸",
      "news-title": "à¤¸à¤®à¤¾à¤šà¤¾à¤° à¤”à¤° à¤…à¤ªà¤¡à¥‡à¤Ÿ",
      "news-latest": "à¤¤à¤¾à¤œà¤¼à¤¾ à¤¸à¤®à¤¾à¤šà¤¾à¤°",
      "matches-title": "à¤²à¤¾à¤‡à¤µ à¤®à¥ˆà¤š",
      "matches-upcoming": "à¤†à¤—à¤¾à¤®à¥€",
      "matches-live": "à¤²à¤¾à¤‡à¤µ",
      "matches-completed": "à¤¸à¤®à¤¾à¤ªà¥à¤¤",
      "footer-copyright": "Â© 2024 FanConnact. à¤¸à¤°à¥à¤µà¤¾à¤§à¤¿à¤•à¤¾à¤° à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤à¥¤",
      "theme-toggle-label": "à¤¥à¥€à¤® à¤¬à¤¦à¤²à¥‡à¤‚",
      // New keys
      "nav-global": "à¤—à¥à¤²à¥‹à¤¬à¤²", "nav-player-zone": "à¤–à¤¿à¤²à¤¾à¤¡à¤¼à¥€ à¤•à¥à¤·à¥‡à¤¤à¥à¤°",
      "nav-predictions": "à¤­à¤µà¤¿à¤·à¥à¤¯à¤µà¤¾à¤£à¤¿à¤¯à¤¾à¤‚",
      "vs": "à¤¬à¤¨à¤¾à¤®", "play-now": "à¤…à¤­à¥€ à¤–à¥‡à¤²à¥‡à¤‚", "live-now": "à¤²à¤¾à¤‡à¤µ à¤…à¤­à¥€",
      "app-unlock": "à¤à¤ª à¤¸à¥‡ à¤…à¤¨à¤²à¥‰à¤• à¤•à¤°à¥‡à¤‚",
      "promo-join-now": "à¤…à¤­à¥€ à¤¶à¤¾à¤®à¤¿à¤² à¤¹à¥‹à¤‚",
      "match-center-view": "à¤®à¥ˆà¤š à¤¸à¥‡à¤‚à¤Ÿà¤° à¤¦à¥‡à¤–à¥‡à¤‚",
      "welcome-subtitle": "à¤†à¤ªà¤•à¤¾ à¤…à¤²à¥à¤Ÿà¥€à¤®à¥‡à¤Ÿ à¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸ à¤¸à¤®à¥à¤¦à¤¾à¤¯",
      "communities-title": "à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤• à¤¸à¤®à¥à¤¦à¤¾à¤¯",
      "status-live": "à¤²à¤¾à¤‡à¤µ",
      "promo-fan-war": "à¤«à¥ˆà¤¨ à¤µà¥‰à¤°",
      "promo-fan-war-desc": "à¤…à¤²à¥à¤Ÿà¥€à¤®à¥‡à¤Ÿ à¤«à¥ˆà¤¨ à¤¬à¥ˆà¤Ÿà¤² à¤®à¥‡à¤‚ à¤¶à¤¾à¤®à¤¿à¤² à¤¹à¥‹à¤‚",
      "quiz-title": "à¤•à¥à¤µà¤¿à¤œà¤¼ à¤šà¥à¤¨à¥Œà¤¤à¥€",
      "quiz-daily-cricket": "à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¥à¤°à¤¿à¤•à¥‡à¤Ÿ à¤•à¥à¤µà¤¿à¤œà¤¼",
      "quiz-description": "à¤…à¤ªà¤¨à¥‡ à¤•à¥à¤°à¤¿à¤•à¥‡à¤Ÿ à¤œà¥à¤žà¤¾à¤¨ à¤•à¤¾ à¤ªà¤°à¥€à¤•à¥à¤·à¤£ à¤•à¤°à¥‡à¤‚",
      "quiz-win": "à¤œà¥€à¤¤à¥‡à¤‚",
      "predictions-trending": "à¤Ÿà¥à¤°à¥‡à¤‚à¤¡à¤¿à¤‚à¤— à¤­à¤µà¤¿à¤·à¥à¤¯à¤µà¤¾à¤£à¤¿à¤¯à¤¾à¤‚",
      "leaderboard-top-fans": "à¤Ÿà¥‰à¤ª à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤•",
      "leaderboard-full": "à¤ªà¥‚à¤°à¥à¤£ à¤²à¥€à¤¡à¤°à¤¬à¥‹à¤°à¥à¤¡",
      "time-this-week": "à¤‡à¤¸ à¤¸à¤ªà¥à¤¤à¤¾à¤¹", "stat-earned": "à¤•à¤®à¤¾à¤¯à¤¾",
      "profile-achievements": "à¤‰à¤ªà¤²à¤¬à¥à¤§à¤¿à¤¯à¤¾à¤‚",
      "profile-recent-activity": "à¤¹à¤¾à¤²à¤¿à¤¯à¤¾ à¤—à¤¤à¤¿à¤µà¤¿à¤§à¤¿",
      "profile-identity": "à¤ªà¤¹à¤šà¤¾à¤¨ à¤µà¤¿à¤µà¤°à¤£",
      "profile-fullname": "à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤®", "profile-username": "à¤‰à¤ªà¤¯à¥‹à¤—à¤•à¤°à¥à¤¤à¤¾ à¤¨à¤¾à¤®",
      "profile-gender": "à¤²à¤¿à¤‚à¤—", "profile-dob": "à¤œà¤¨à¥à¤® à¤¤à¤¿à¤¥à¤¿",
      "profile-contact": "à¤¸à¤‚à¤ªà¤°à¥à¤• à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€",
      "profile-email": "à¤ˆà¤®à¥‡à¤²", "profile-mobile": "à¤®à¥‹à¤¬à¤¾à¤‡à¤²",
      "profile-location": "à¤¸à¥à¤¥à¤¾à¤¨",
      "profile-save": "à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨ à¤¸à¤¹à¥‡à¤œà¥‡à¤‚", "profile-cancel": "à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚",
      "profile-signout": "à¤–à¤¾à¤¤à¤¾ à¤¸à¤¾à¤‡à¤¨ à¤†à¤‰à¤Ÿ à¤•à¤°à¥‡à¤‚",
      "stats-total-predictions": "à¤•à¥à¤² à¤­à¤µà¤¿à¤·à¥à¤¯à¤µà¤¾à¤£à¤¿à¤¯à¤¾à¤‚",
      "stats-win-rate": "à¤œà¥€à¤¤ à¤¦à¤° %",
      "stats-xp-progress": "XP à¤ªà¥à¤°à¤—à¤¤à¤¿",
      "stats-global-rank": "à¤µà¥ˆà¤¶à¥à¤µà¤¿à¤• à¤°à¥ˆà¤‚à¤•",
      "fancoin-tagline": "à¤•à¥‰à¤‡à¤¨ à¤•à¤®à¤¾à¤à¤‚. à¤…à¤§à¤¿à¤• à¤–à¥‡à¤²à¥‡à¤‚. à¤¬à¤¡à¤¼à¤¾ à¤œà¥€à¤¤à¥‡à¤‚.",
      "fancoin-ways": "à¤«à¥ˆà¤¨ à¤•à¥‰à¤‡à¤¨ à¤•à¤®à¤¾à¤¨à¥‡ à¤•à¥‡ à¤¤à¤°à¥€à¤•à¥‡",
      "fancoin-streak": "à¤¦à¤¿à¤¨à¥‹à¤‚ à¤•à¥€ à¤²à¤—à¤¾à¤¤à¤¾à¤° à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿",
      "view-wallet": "à¤µà¥‰à¤²à¥‡à¤Ÿ à¤¦à¥‡à¤–à¥‡à¤‚",
      "earn-daily-quiz-title": "à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¥à¤µà¤¿à¤œà¤¼",
      "earn-prediction-title": "à¤®à¥ˆà¤š à¤­à¤µà¤¿à¤·à¥à¤¯à¤µà¤¾à¤£à¥€",
      "earn-community-title": "à¤¸à¤®à¥à¤¦à¤¾à¤¯ à¤—à¤¤à¤¿à¤µà¤¿à¤§à¤¿",
      "earn-fanwar-title": "à¤«à¥ˆà¤¨ à¤µà¥‰à¤°",
      "earn-daily-quiz-desc": "à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¥à¤µà¤¿à¤œà¤¼ à¤ªà¥à¤°à¤¶à¥à¤¨à¥‹à¤‚ à¤•à¥‡ à¤‰à¤¤à¥à¤¤à¤° à¤¦à¥‡à¤‚ à¤”à¤° à¤•à¥‰à¤‡à¤¨ à¤•à¤®à¤¾à¤à¤‚",
      "earn-prediction-desc": "à¤®à¥ˆà¤š à¤ªà¤°à¤¿à¤£à¤¾à¤®à¥‹à¤‚ à¤•à¥€ à¤¸à¤¹à¥€ à¤­à¤µà¤¿à¤·à¥à¤¯à¤µà¤¾à¤£à¥€ à¤•à¤°à¥‡à¤‚",
      "earn-community-desc": "à¤…à¤ªà¤¨à¥‡ à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤• à¤¸à¤®à¥à¤¦à¤¾à¤¯à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤°à¤¹à¥‡à¤‚",
      "earn-fanwar-desc": "à¤«à¥ˆà¤¨ à¤¬à¥ˆà¤Ÿà¤² à¤®à¥‡à¤‚ à¤­à¤¾à¤— à¤²à¥‡à¤‚",
      "level-bronze": "à¤•à¤¾à¤‚à¤¸à¥à¤¯ à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤•", "level-silver": "à¤°à¤œà¤¤ à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤•",
      "level-gold": "à¤¸à¥à¤µà¤°à¥à¤£ à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤•", "level-diamond": "à¤¹à¥€à¤°à¤¾ à¤ªà¥à¤°à¤¶à¤‚à¤¸à¤•",
      "level-next": "à¤†à¤—à¥‡ à¤¬à¤¢à¤¼à¤¤à¥‡ à¤°à¤¹à¥‡à¤‚! à¤…à¤§à¤¿à¤• à¤ªà¥à¤°à¤¸à¥à¤•à¤¾à¤°à¥‹à¤‚ à¤•à¥‡ à¤²à¤¿à¤ à¤…à¤—à¤²à¤¾ à¤¸à¥à¤¤à¤° à¤…à¤¨à¤²à¥‰à¤• à¤•à¤°à¥‡à¤‚!",
      "level-benefits": "à¤¸à¥à¤¤à¤° à¤²à¤¾à¤­",
      "benefit-exclusive": "à¤µà¤¿à¤¶à¥‡à¤· à¤¸à¤¾à¤®à¤—à¥à¤°à¥€",
      "benefit-early-access": "à¤œà¤²à¥à¤¦à¥€ à¤ªà¤¹à¥à¤‚à¤š",
      "benefit-badges": "à¤µà¤¿à¤¶à¥‡à¤· à¤¬à¥ˆà¤œ",
    },
  bn: {
      "nav-home": "à¦¬à¦¾à¦¡à¦¼à¦¿",
      "nav-news": "à¦–à¦¬à¦°",
      "nav-matches": "à¦®à§‡à¦²à§‡",
      "nav-communities": "à¦¸à¦®à§à¦ªà§à¦°à¦¦à¦¾à¦¯à¦¼à¦—à§à¦²à¦¿",
      "nav-leaderboard": "à¦²à¦¿à¦¡à¦¾à¦°à¦¬à§‹à¦°à§à¦¡",
      "nav-live": "à¦²à¦¾à¦‡à¦­ à¦®à§à¦¯à¦¾à¦š",
      "nav-settings": "à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸",
      "nav-profile": "à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²",
      "nav-notifications": "à¦¬à¦¿à¦œà§à¦žà¦ªà§à¦¤à¦¿",
      "nav-logout": "à¦²à¦—à¦†à¦‰à¦Ÿ",
      "nav-login": "à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨",
      "nav-signup": "à¦¸à¦¾à¦‡à¦¨ à¦†à¦ª à¦•à¦°à§à¦¨",
      "nav-back": "à¦¬à§à¦¯à¦¾à¦•",
      "nav-global": "à¦—à§à¦²à§‹à¦¬à¦¾à¦²",
      "nav-player-zone": "à¦ªà§à¦²à§‡à¦¯à¦¼à¦¾à¦° à¦œà§‹à¦¨",
      "nav-predictions": "à¦­à¦¬à¦¿à¦·à§à¦¯à¦¦à§à¦¬à¦¾à¦£à§€",
      "welcome-guest": "à¦¸à§à¦¬à¦¾à¦—à¦¤à¦®, à¦…à¦¤à¦¿à¦¥à¦¿!",
      "welcome-back": "à¦†à¦¬à¦¾à¦° à¦¸à§à¦¬à¦¾à¦—à¦¤à¦®,",
      "search-placeholder": "à¦…à¦¨à§à¦¸à¦¨à§à¦§à¦¾à¦¨ à¦•à¦°à§à¦¨...",
      "view-all": "à¦¸à¦¬ à¦¦à§‡à¦–à§à¦¨",
      "see-more": "à¦†à¦°à¦“ à¦¦à§‡à¦–à§à¦¨",
      "no-results": "à¦•à§‹à¦¨ à¦«à¦²à¦¾à¦«à¦² à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿",
      "loading": "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...",
      "error-occured": "à¦•à¦¿à¦›à§ à¦­à§à¦² à¦¹à¦¯à¦¼à§‡à¦›à§‡",
      "retry": "à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨",
      "cancel": "à¦¬à¦¾à¦¤à¦¿à¦² à¦•à¦°à§à¦¨",
      "save": "à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à§à¦¨",
      "delete": "à¦®à§à¦›à§‡ à¦¦à¦¿à¦¨",
      "confirm": "à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à§à¦¨",
      "version": "à¦¸à¦‚à¦¸à§à¦•à¦°à¦£ 1.0.0",
      "vs": "à¦­à¦¿à¦à¦¸",
      "play-now": "à¦à¦–à¦¨ à¦–à§‡à¦²à§à¦¨",
      "live-now": "à¦à¦–à¦¨ à¦²à¦¾à¦‡à¦­",
      "app-unlock": "à¦…à§à¦¯à¦¾à¦ª à¦¦à¦¿à¦¯à¦¼à§‡ à¦†à¦¨à¦²à¦• à¦•à¦°à§à¦¨",
      "promo-join-now": "à¦à¦–à¦¨ à¦¯à§‹à¦— à¦¦à¦¿à¦¨",
      "match-center-view": "à¦®à§à¦¯à¦¾à¦š à¦¸à§‡à¦¨à§à¦Ÿà¦¾à¦° à¦¦à§‡à¦–à§à¦¨",
      "welcome-subtitle": "à¦†à¦ªà¦¨à¦¾à¦° à¦šà§‚à¦¡à¦¼à¦¾à¦¨à§à¦¤ à¦•à§à¦°à§€à¦¡à¦¼à¦¾ à¦¸à¦®à§à¦ªà§à¦°à¦¦à¦¾à¦¯à¦¼",
      "communities-title": "à¦«à§à¦¯à¦¾à¦¨ à¦¸à¦®à§à¦ªà§à¦°à¦¦à¦¾à¦¯à¦¼",
      "status-live": "à¦²à¦¾à¦‡à¦­",
      "promo-fan-war": "à¦­à¦•à§à¦¤ à¦¯à§à¦¦à§à¦§",
      "promo-fan-war-desc": "à¦šà§‚à¦¡à¦¼à¦¾à¦¨à§à¦¤ à¦­à¦•à§à¦¤ à¦¯à§à¦¦à§à¦§à§‡ à¦¯à§‹à¦— à¦¦à¦¿à¦¨",
      "quiz-title": "à¦•à§à¦‡à¦œ à¦šà§à¦¯à¦¾à¦²à§‡à¦žà§à¦œ",
      "quiz-daily-cricket": "à¦¦à§ˆà¦¨à¦¿à¦• à¦•à§à¦°à¦¿à¦•à§‡à¦Ÿ à¦•à§à¦‡à¦œ",
      "quiz-description": "à¦†à¦ªà¦¨à¦¾à¦° à¦•à§à¦°à¦¿à¦•à§‡à¦Ÿ à¦œà§à¦žà¦¾à¦¨ à¦ªà¦°à§€à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨",
      "quiz-win": "à¦œà¦¯à¦¼",
      "predictions-trending": "à¦ªà§à¦°à¦¬à¦£à¦¤à¦¾ à¦­à¦¬à¦¿à¦·à§à¦¯à¦¦à§à¦¬à¦¾à¦£à§€",
      "leaderboard-top-fans": "à¦¶à§€à¦°à§à¦· à¦­à¦•à§à¦¤",
      "leaderboard-full": "à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ à¦²à¦¿à¦¡à¦¾à¦°à¦¬à§‹à¦°à§à¦¡",
      "time-this-week": "à¦à¦‡ à¦¸à¦ªà§à¦¤à¦¾à¦¹à§‡",
      "stat-earned": "à¦…à¦°à§à¦œà¦¿à¦¤",
      "login-title": "à¦†à¦¬à¦¾à¦° à¦¸à§à¦¬à¦¾à¦—à¦¤à¦®!",
      "login-email-label": "à¦‡à¦®à§‡à¦² à¦¬à¦¾ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦°à¦•à¦¾à¦°à§€à¦° à¦¨à¦¾à¦®",
      "login-email-placeholder": "à¦†à¦ªà¦¨à¦¾à¦° à¦‡à¦®à§‡à¦² à¦¬à¦¾ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦°à¦•à¦¾à¦°à§€à¦° à¦¨à¦¾à¦® à¦²à¦¿à¦–à§à¦¨",
      "login-password-label": "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡",
      "login-password-placeholder": "à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦²à¦¿à¦–à§à¦¨",
      "login-submit": "à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨",
      "login-forgot": "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦­à§à¦²à§‡ à¦—à§‡à¦›à§‡à¦¨?",
      "login-no-account": "à¦à¦•à¦Ÿà¦¿ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¨à§‡à¦‡?",
      "signup-title": "à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§à¦¨",
      "signup-name-label": "à¦ªà§à¦°à§‹ à¦¨à¦¾à¦®",
      "signup-email-label": "à¦‡à¦®à§‡à¦‡à¦²",
      "signup-password-label": "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡",
      "signup-submit": "à¦¸à¦¾à¦‡à¦¨ à¦†à¦ª à¦•à¦°à§à¦¨",
      "signup-have-account": "à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦à¦•à¦Ÿà¦¿ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦†à¦›à§‡?",
      "forgot-title": "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦°à¦¿à¦¸à§‡à¦Ÿ à¦•à¦°à§à¦¨",
      "forgot-submit": "à¦°à¦¿à¦¸à§‡à¦Ÿ à¦²à¦¿à¦™à§à¦• à¦ªà¦¾à¦ à¦¾à¦¨",
      "settings-title": "à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸",
      "settings-subtitle": "à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦›à¦¨à§à¦¦ à¦à¦¬à¦‚ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸ à¦ªà¦°à¦¿à¦šà¦¾à¦²à¦¨à¦¾ à¦•à¦°à§à¦¨",
      "appearance-title": "à¦šà§‡à¦¹à¦¾à¦°à¦¾",
      "appearance-subtitle": "FanConnact à¦à¦° à¦šà§‡à¦¹à¦¾à¦°à¦¾ à¦à¦¬à¦‚ à¦…à¦¨à§à¦­à§‚à¦¤à¦¿ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦‡à¦œ à¦•à¦°à§à¦¨",
      "theme-light": "à¦†à¦²à§‹",
      "theme-light-desc": "à¦ªà¦°à¦¿à¦·à§à¦•à¦¾à¦° à¦à¦¬à¦‚ à¦‰à¦œà§à¦œà§à¦¬à¦²",
      "theme-dark": "à¦…à¦¨à§à¦§à¦•à¦¾à¦°",
      "theme-dark-desc": "à¦šà§‹à¦–à§‡à¦° à¦‰à¦ªà¦° à¦¸à¦¹à¦œ",
      "theme-stadium": "à¦¸à§à¦Ÿà§‡à¦¡à¦¿à¦¯à¦¼à¦¾à¦®",
      "theme-stadium-desc": "à¦—à§‡à¦®à¦Ÿà¦¿ à¦…à¦¨à§à¦­à¦¬ à¦•à¦°à§à¦¨",
      "theme-esports": "à¦–à§‡à¦²à¦¾à¦§à§à¦²à¦¾",
      "theme-esports-desc": "à¦à¦¸à§à¦ªà§‹à¦°à§à¦Ÿà¦¸ à¦…à¦¨à§à¦°à¦¾à¦—à§€à¦¦à§‡à¦° à¦œà¦¨à§à¦¯",
      "theme-royal": "à¦°à¦¯à¦¼à§à¦¯à¦¾à¦² à¦¬à§à¦²à§",
      "theme-royal-desc": "à¦•à§à¦²à¦¾à¦¸à¦¿à¦• à¦à¦¬à¦‚ à¦®à¦¸à§ƒà¦£",
      "compact-mode": "à¦•à¦®à¦ªà§à¦¯à¦¾à¦•à§à¦Ÿ à¦®à§‹à¦¡",
      "compact-mode-desc": "à¦•à¦® à¦œà¦¾à¦¯à¦¼à¦—à¦¾à¦¯à¦¼ à¦†à¦°à¦“ à¦•à¦¨à§à¦Ÿà§‡à¦¨à§à¦Ÿ à¦¦à§‡à¦–à¦¾à¦¨",
      "reduce-animations": "à¦…à§à¦¯à¦¾à¦¨à¦¿à¦®à§‡à¦¶à¦¨ à¦¹à§à¦°à¦¾à¦¸ à¦•à¦°à§à¦¨",
      "reduce-animations-desc": "à¦à¦•à¦Ÿà¦¿ à¦®à¦¸à§ƒà¦£ à¦…à¦­à¦¿à¦œà§à¦žà¦¤à¦¾à¦° à¦œà¦¨à§à¦¯ à¦—à¦¤à¦¿ à¦¹à§à¦°à¦¾à¦¸ à¦•à¦°à§à¦¨",
      "large-text": "à¦¬à¦¡à¦¼ à¦Ÿà§‡à¦•à§à¦¸à¦Ÿ",
      "large-text-desc": "à¦­à¦¾à¦²à§‹ à¦ªà¦ à¦¨à¦¯à§‹à¦—à§à¦¯à¦¤à¦¾à¦° à¦œà¦¨à§à¦¯ à¦ªà¦¾à¦ à§à¦¯à§‡à¦° à¦†à¦•à¦¾à¦° à¦¬à¦¾à¦¡à¦¼à¦¾à¦¨",
      "sports-title": "à¦•à§à¦°à§€à¦¡à¦¼à¦¾ à¦ªà¦›à¦¨à§à¦¦",
      "sports-subtitle": "à¦¬à§à¦¯à¦•à§à¦¤à¦¿à¦—à¦¤à¦•à§ƒà¦¤ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦ªà§‡à¦¤à§‡ à¦†à¦ªà¦¨à¦¾à¦° à¦ªà§à¦°à¦¿à¦¯à¦¼ à¦–à§‡à¦²à¦¾ à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨",
      "sport-cricket": "à¦•à§à¦°à¦¿à¦•à§‡à¦Ÿ",
      "sport-football": "à¦«à§à¦Ÿà¦¬à¦²",
      "sport-basketball": "à¦¬à¦¾à¦¸à§à¦•à§‡à¦Ÿà¦¬à¦²",
      "sport-tennis": "à¦Ÿà§‡à¦¨à¦¿à¦¸",
      "sport-hockey": "à¦¹à¦•à¦¿",
      "sport-kabaddi": "à¦•à¦¾à¦¬à¦¾à¦¡à¦¿",
      "sport-volleyball": "à¦­à¦²à¦¿à¦¬à¦²",
      "sport-tabletennis": "à¦Ÿà§‡à¦¬à¦¿à¦² à¦Ÿà§‡à¦¨à¦¿à¦¸",
      "sport-esports": "à¦–à§‡à¦²à¦¾à¦§à§à¦²à¦¾",
      "sport-baseball": "à¦¬à§‡à¦¸à¦¬à¦²",
      "sport-add-more": "à¦†à¦°à§‹ à¦–à§‡à¦²à¦¾ à¦¯à§‹à¦— à¦•à¦°à§à¦¨",
      "notif-title": "à¦¬à¦¿à¦œà§à¦žà¦ªà§à¦¤à¦¿ à¦ªà¦›à¦¨à§à¦¦",
      "notif-subtitle": "à¦†à¦ªà¦¨à¦¿ à¦•à¦¿ à¦¸à¦®à§à¦ªà¦°à§à¦•à§‡ à¦…à¦¬à¦¹à¦¿à¦¤ à¦¹à¦¤à§‡ à¦šà¦¾à¦¨ à¦¤à¦¾ à¦šà¦¯à¦¼à¦¨ à¦•à¦°à§à¦¨à§·",
      "notif-live": "à¦²à¦¾à¦‡à¦­ à¦®à§à¦¯à¦¾à¦š à¦¸à¦¤à¦°à§à¦•à¦¤à¦¾",
      "notif-news": "à¦¬à§à¦°à§‡à¦•à¦¿à¦‚ à¦¨à¦¿à¦‰à¦œ",
      "notif-predictions": "à¦­à¦¬à¦¿à¦·à§à¦¯à¦¦à§à¦¬à¦¾à¦£à§€ à¦«à¦²à¦¾à¦«à¦²",
      "notif-community": "à¦¸à¦®à§à¦ªà§à¦°à¦¦à¦¾à¦¯à¦¼ à¦†à¦ªà¦¡à§‡à¦Ÿ",
      "notif-email": "à¦‡à¦®à§‡à¦² à¦¬à¦¿à¦œà§à¦žà¦ªà§à¦¤à¦¿",
      "notif-push": "à¦ªà§à¦¶ à¦¬à¦¿à¦œà§à¦žà¦ªà§à¦¤à¦¿",
      "notif-mentions": "à¦‰à¦²à§à¦²à§‡à¦– à¦à¦¬à¦‚ à¦‰à¦¤à§à¦¤à¦°",
      "notif-followers": "à¦¨à¦¤à§à¦¨ à¦«à¦²à§‹à¦¯à¦¼à¦¾à¦°",
      "security-title": "à¦¨à¦¿à¦°à¦¾à¦ªà¦¤à§à¦¤à¦¾",
      "security-subtitle": "à¦†à¦ªà¦¨à¦¾à¦° à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¨à¦¿à¦°à¦¾à¦ªà¦¦ à¦à¦¬à¦‚ à¦¸à§à¦°à¦•à§à¦·à¦¿à¦¤ à¦°à¦¾à¦–à§à¦¨",
      "security-google": "à¦—à§à¦—à¦²",
      "security-facebook": "à¦«à§‡à¦¸à¦¬à§à¦•",
      "security-connected": "à¦¸à¦‚à¦¯à§à¦•à§à¦¤",
      "security-change-password": "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§à¦¨",
      "security-2fa": "à¦¦à§à¦¬à¦¿-à¦«à§à¦¯à¦¾à¦•à§à¦Ÿà¦° à¦ªà§à¦°à¦®à¦¾à¦£à§€à¦•à¦°à¦£",
      "security-2fa-on": "à¦šà¦¾à¦²à§",
      "security-2fa-off": "à¦¬à¦¨à§à¦§",
      "security-logout-all": "à¦¸à¦®à¦¸à§à¦¤ à¦¡à¦¿à¦­à¦¾à¦‡à¦¸ à¦²à¦—à¦†à¦‰à¦Ÿ à¦•à¦°à§à¦¨",
      "lang-title": "à¦­à¦¾à¦·à¦¾ à¦“ à¦…à¦žà§à¦šà¦²",
      "lang-subtitle": "à¦†à¦ªà¦¨à¦¾à¦° à¦­à¦¾à¦·à¦¾ à¦à¦¬à¦‚ à¦…à¦žà§à¦šà¦²à§‡à¦° à¦ªà¦›à¦¨à§à¦¦à¦—à§à¦²à¦¿ à¦ªà¦°à¦¿à¦šà¦¾à¦²à¦¨à¦¾ à¦•à¦°à§à¦¨",
      "lang-language": "à¦­à¦¾à¦·à¦¾",
      "lang-timezone": "à¦Ÿà¦¾à¦‡à¦®à¦œà§‹à¦¨",
      "lang-region": "à¦…à¦žà§à¦šà¦²",
      "support-title": "à¦¸à¦®à¦°à§à¦¥à¦¨ à¦à¦¬à¦‚ à¦¸à¦®à§à¦ªà¦°à§à¦•à§‡",
      "support-subtitle": "à¦¸à¦¾à¦¹à¦¾à¦¯à§à¦¯, à¦ªà§à¦°à¦¤à¦¿à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾ à¦à¦¬à¦‚ à¦…à§à¦¯à¦¾à¦ª à¦¤à¦¥à§à¦¯",
      "support-report-bug": "à¦¬à¦¾à¦— à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ à¦•à¦°à§à¦¨",
      "support-feedback": "à¦ªà§à¦°à¦¤à¦¿à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾ à¦ªà¦¾à¦ à¦¾à¦¨",
      "support-contact": "à¦¸à¦¹à¦¾à¦¯à¦¼à¦¤à¦¾à¦° à¦¸à¦¾à¦¥à§‡ à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦— à¦•à¦°à§à¦¨",
      "support-privacy": "à¦—à§‹à¦ªà¦¨à§€à¦¯à¦¼à¦¤à¦¾ à¦¨à§€à¦¤à¦¿",
      "support-terms": "à¦¶à¦°à§à¦¤à¦¾à¦¬à¦²à§€",
      "profile-title": "à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²",
      "profile-edit": "à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦² à¦¸à¦®à§à¦ªà¦¾à¦¦à¦¨à¦¾ à¦•à¦°à§à¦¨",
      "profile-level": "à¦¸à§à¦¤à¦°",
      "profile-achievements": "à¦…à¦°à§à¦œà¦¨",
      "profile-recent-activity": "à¦¸à¦¾à¦®à§à¦ªà§à¦°à¦¤à¦¿à¦• à¦•à¦¾à¦°à§à¦¯à¦•à¦²à¦¾à¦ª",
      "profile-identity": "à¦ªà¦°à¦¿à¦šà¦¯à¦¼ à¦¬à¦¿à¦¬à¦°à¦£",
      "profile-fullname": "à¦ªà§à¦°à§‹ à¦¨à¦¾à¦®",
      "profile-username": "à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦°à¦•à¦¾à¦°à§€à¦° à¦¨à¦¾à¦®",
      "profile-gender": "à¦²à¦¿à¦™à§à¦—",
      "profile-dob": "à¦œà¦¨à§à¦® à¦¤à¦¾à¦°à¦¿à¦–",
      "profile-contact": "à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦—à§‡à¦° à¦¤à¦¥à§à¦¯",
      "profile-email": "à¦‡à¦®à§‡à¦‡à¦²",
      "profile-mobile": "à¦®à§‹à¦¬à¦¾à¦‡à¦²",
      "profile-location": "à¦…à¦¬à¦¸à§à¦¥à¦¾à¦¨",
      "profile-save": "à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨à¦—à§à¦²à¦¿ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à§à¦¨",
      "profile-cancel": "à¦¬à¦¾à¦¤à¦¿à¦² à¦•à¦°à§à¦¨",
      "profile-signout": "à¦¸à¦¾à¦‡à¦¨ à¦†à¦‰à¦Ÿ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ",
      "stats-total-predictions": "à¦®à§‹à¦Ÿ à¦­à¦¬à¦¿à¦·à§à¦¯à¦¦à§à¦¬à¦¾à¦£à§€",
      "stats-win-rate": "à¦œà¦¯à¦¼à§‡à¦° à¦¹à¦¾à¦° %",
      "stats-xp-progress": "à¦à¦•à§à¦¸à¦ªà¦¿ à¦…à¦—à§à¦°à¦—à¦¤à¦¿",
      "stats-global-rank": "à¦—à§à¦²à§‹à¦¬à¦¾à¦² à¦°â€à§à¦¯à¦¾à¦™à§à¦•",
      "fancoin-title": "à¦«à§à¦¯à¦¾à¦¨à¦•à¦¯à¦¼à§‡à¦¨ à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ",
      "fancoin-balance": "à¦­à¦¾à¦°à¦¸à¦¾à¦®à§à¦¯",
      "fancoin-earn": "à¦•à¦¯à¦¼à§‡à¦¨ à¦‰à¦ªà¦¾à¦°à§à¦œà¦¨",
      "fancoin-history": "à¦²à§‡à¦¨à¦¦à§‡à¦¨à§‡à¦° à¦‡à¦¤à¦¿à¦¹à¦¾à¦¸",
      "fancoin-tagline": "à¦•à¦¯à¦¼à§‡à¦¨ à¦‰à¦ªà¦¾à¦°à§à¦œà¦¨.",
      "fancoin-ways": "à¦«à§à¦¯à¦¾à¦¨ à¦•à¦¯à¦¼à§‡à¦¨ à¦‰à¦ªà¦¾à¦°à§à¦œà¦¨à§‡à¦° à¦‰à¦ªà¦¾à¦¯à¦¼",
      "fancoin-streak": "à¦¡à§‡ à¦¸à§à¦Ÿà§à¦°à¦¿à¦•",
      "view-wallet": "à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ à¦¦à§‡à¦–à§à¦¨",
      "earn-daily-quiz-title": "à¦¦à§ˆà¦¨à¦¿à¦• à¦•à§à¦‡à¦œ",
      "earn-prediction-title": "à¦®à§à¦¯à¦¾à¦šà§‡à¦° à¦ªà§‚à¦°à§à¦¬à¦¾à¦­à¦¾à¦¸",
      "earn-community-title": "à¦¸à¦®à§à¦ªà§à¦°à¦¦à¦¾à¦¯à¦¼à§‡à¦° à¦•à¦¾à¦°à§à¦¯à¦•à¦²à¦¾à¦ª",
      "earn-fanwar-title": "à¦­à¦•à§à¦¤ à¦¯à§à¦¦à§à¦§",
      "earn-daily-quiz-desc": "à¦¦à§ˆà¦¨à¦¿à¦• à¦•à§à¦‡à¦œà§‡à¦° à¦ªà§à¦°à¦¶à§à¦¨à§‡à¦° à¦‰à¦¤à§à¦¤à¦° à¦¦à¦¿à¦¨ à¦à¦¬à¦‚ à¦•à¦¯à¦¼à§‡à¦¨ à¦‰à¦ªà¦¾à¦°à§à¦œà¦¨ à¦•à¦°à§à¦¨",
      "earn-prediction-desc": "à¦®à§à¦¯à¦¾à¦šà§‡à¦° à¦«à¦²à¦¾à¦«à¦² à¦¸à¦ à¦¿à¦•à¦­à¦¾à¦¬à§‡ à¦…à¦¨à§à¦®à¦¾à¦¨ à¦•à¦°à§à¦¨",
      "earn-community-desc": "à¦†à¦ªà¦¨à¦¾à¦° à¦«à§à¦¯à¦¾à¦¨ à¦¸à¦®à§à¦ªà§à¦°à¦¦à¦¾à¦¯à¦¼à¦—à§à¦²à¦¿à¦¤à§‡ à¦¸à¦•à§à¦°à¦¿à¦¯à¦¼ à¦¥à¦¾à¦•à§à¦¨",
      "earn-fanwar-desc": "à¦­à¦•à§à¦¤à¦¦à§‡à¦° à¦¯à§à¦¦à§à¦§à§‡ à¦…à¦‚à¦¶à¦—à§à¦°à¦¹à¦£ à¦•à¦°à§à¦¨",
      "level-bronze": "à¦¬à§à¦°à§‹à¦žà§à¦œ à¦«à§à¦¯à¦¾à¦¨",
      "level-silver": "à¦¸à¦¿à¦²à¦­à¦¾à¦° à¦«à§à¦¯à¦¾à¦¨",
      "level-gold": "à¦¸à§‹à¦¨à¦¾à¦° à¦ªà¦¾à¦–à¦¾",
      "level-diamond": "à¦¡à¦¾à¦¯à¦¼à¦®à¦¨à§à¦¡ à¦«à§à¦¯à¦¾à¦¨",
      "level-next": "à¦šà¦¾à¦²à¦¿à¦¯à¦¼à§‡ à¦¯à¦¾à¦¨!",
      "level-benefits": "à¦¸à§à¦¤à¦°à§‡à¦° à¦¸à§à¦¬à¦¿à¦§à¦¾",
      "benefit-exclusive": "à¦à¦•à§à¦¸à¦•à§à¦²à§à¦¸à¦¿à¦­ à¦•à¦¨à§à¦Ÿà§‡à¦¨à§à¦Ÿ",
      "benefit-early-access": "à¦ªà§à¦°à¦¾à¦°à¦®à§à¦­à¦¿à¦• à¦…à§à¦¯à¦¾à¦•à§à¦¸à§‡à¦¸",
      "benefit-badges": "à¦¬à¦¿à¦¶à§‡à¦· à¦¬à§à¦¯à¦¾à¦œ",
      "news-title": "à¦–à¦¬à¦° à¦à¦¬à¦‚ à¦†à¦ªà¦¡à§‡à¦Ÿ",
      "news-latest": "à¦¸à¦°à§à¦¬à¦¶à§‡à¦· à¦–à¦¬à¦°",
      "matches-title": "à¦²à¦¾à¦‡à¦­ à¦®à§à¦¯à¦¾à¦š",
      "matches-upcoming": "à¦†à¦¸à¦¨à§à¦¨",
      "matches-live": "à¦²à¦¾à¦‡à¦­",
      "matches-completed": "à¦¸à¦®à§à¦ªà¦¨à§à¦¨",
      "footer-copyright": "Â© 2024 à¦«à§à¦¯à¦¾à¦¨à¦•à¦¾à¦¨à§à¦¯à¦¾à¦•à§à¦Ÿà¥¤",
      "theme-toggle-label": "à¦¥à¦¿à¦® à¦Ÿà¦—à¦² à¦•à¦°à§à¦¨",
    },
  ta: {
      "nav-home": "à®µà¯€à®Ÿà¯",
      "nav-news": "à®šà¯†à®¯à¯à®¤à®¿",
      "nav-matches": "à®ªà¯‹à®Ÿà¯à®Ÿà®¿à®•à®³à¯",
      "nav-communities": "à®šà®®à¯‚à®•à®™à¯à®•à®³à¯",
      "nav-leaderboard": "à®²à¯€à®Ÿà®°à¯à®ªà¯‹à®°à¯à®Ÿà¯",
      "nav-live": "à®¨à¯‡à®°à®Ÿà®¿ à®ªà¯‹à®Ÿà¯à®Ÿà®¿à®•à®³à¯",
      "nav-settings": "à®…à®®à¯ˆà®ªà¯à®ªà¯à®•à®³à¯",
      "nav-profile": "à®šà¯à®¯à®µà®¿à®µà®°à®®à¯",
      "nav-notifications": "à®…à®±à®¿à®µà®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "nav-logout": "à®µà¯†à®³à®¿à®¯à¯‡à®±à¯",
      "nav-login": "à®‰à®³à¯à®¨à¯à®´à¯ˆà®•",
      "nav-signup": "à®ªà®¤à®¿à®µà¯ à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯",
      "nav-back": "à®®à¯€à®£à¯à®Ÿà¯à®®à¯",
      "nav-global": "à®‰à®²à®•à®³à®¾à®µà®¿à®¯",
      "nav-player-zone": "à®µà¯€à®°à®°à¯ à®®à®£à¯à®Ÿà®²à®®à¯",
      "nav-predictions": "à®•à®£à®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "welcome-guest": "à®µà®°à®µà¯‡à®±à¯à®•à®¿à®±à¯‹à®®à¯, à®µà®¿à®°à¯à®¨à¯à®¤à®¿à®©à®°à¯!",
      "welcome-back": "à®®à¯€à®£à¯à®Ÿà¯à®®à¯ à®µà®°à®µà¯‡à®±à¯à®•à®¿à®±à¯‹à®®à¯,",
      "search-placeholder": "à®¤à¯‡à®Ÿà¯...",
      "view-all": "à®…à®©à¯ˆà®¤à¯à®¤à¯ˆà®¯à¯à®®à¯ à®ªà®¾à®°à¯à®•à¯à®•à®µà¯à®®à¯",
      "see-more": "à®®à¯‡à®²à¯à®®à¯ à®ªà®¾à®°à¯à®•à¯à®•à®µà¯à®®à¯",
      "no-results": "à®®à¯à®Ÿà®¿à®µà¯à®•à®³à¯ à®Žà®¤à¯à®µà¯à®®à¯ à®•à®¿à®Ÿà¯ˆà®•à¯à®•à®µà®¿à®²à¯à®²à¯ˆ",
      "loading": "à®à®±à¯à®±à¯à®•à®¿à®±à®¤à¯...",
      "error-occured": "à®à®¤à¯‹ à®¤à®µà®±à®¾à®•à®¿à®µà®¿à®Ÿà¯à®Ÿà®¤à¯",
      "retry": "à®®à¯€à®£à¯à®Ÿà¯à®®à¯ à®®à¯à®¯à®±à¯à®šà®¿à®•à¯à®•à®µà¯à®®à¯",
      "cancel": "à®°à®¤à¯à®¤à¯ à®šà¯†à®¯à¯",
      "save": "à®šà¯‡à®®à®¿à®•à¯à®•à®µà¯à®®à¯",
      "delete": "à®¨à¯€à®•à¯à®•à¯",
      "confirm": "à®‰à®±à¯à®¤à®¿à®ªà¯à®ªà®Ÿà¯à®¤à¯à®¤à®µà¯à®®à¯",
      "version": "à®ªà®¤à®¿à®ªà¯à®ªà¯ 1.0.0",
      "vs": "à®µà®¿.à®Žà®¸à¯",
      "play-now": "à®‡à®ªà¯à®ªà¯‹à®¤à¯ à®µà®¿à®³à¯ˆà®¯à®¾à®Ÿà¯",
      "live-now": "à®‡à®ªà¯à®ªà¯‹à®¤à¯ à®¨à¯‡à®°à®²à¯ˆ",
      "app-unlock": "à®†à®ªà¯ à®®à¯‚à®²à®®à¯ à®¤à®¿à®±à®•à¯à®•à®µà¯à®®à¯",
      "promo-join-now": "à®‡à®ªà¯à®ªà¯‹à®¤à¯ à®šà¯‡à®°à®µà¯à®®à¯",
      "match-center-view": "à®ªà¯‹à®Ÿà¯à®Ÿà®¿ à®®à¯ˆà®¯à®¤à¯à®¤à¯ˆà®•à¯ à®•à®¾à®£à¯à®•",
      "welcome-subtitle": "à®‰à®™à¯à®•à®³à¯ à®‡à®±à¯à®¤à®¿ à®µà®¿à®³à¯ˆà®¯à®¾à®Ÿà¯à®Ÿà¯ à®šà®®à¯‚à®•à®®à¯",
      "communities-title": "à®°à®šà®¿à®•à®°à¯ à®šà®®à¯‚à®•à®™à¯à®•à®³à¯",
      "status-live": "à®µà®¾à®´à¯à®•",
      "promo-fan-war": "à®°à®šà®¿à®•à®°à¯ à®ªà¯‹à®°à¯",
      "promo-fan-war-desc": "à®‡à®±à¯à®¤à®¿ à®°à®šà®¿à®•à®°à¯ à®ªà¯‹à®°à®¿à®²à¯ à®šà¯‡à®°à®µà¯à®®à¯",
      "quiz-title": "à®µà®¿à®©à®¾à®Ÿà®¿ à®µà®¿à®©à®¾ à®šà®µà®¾à®²à¯",
      "quiz-daily-cricket": "à®¤à®¿à®©à®šà®°à®¿ à®•à®¿à®°à®¿à®•à¯à®•à¯†à®Ÿà¯ à®µà®¿à®©à®¾à®Ÿà®¿à®µà®¿à®©à®¾",
      "quiz-description": "à®‰à®™à¯à®•à®³à¯ à®•à®¿à®°à®¿à®•à¯à®•à¯†à®Ÿà¯ à®…à®±à®¿à®µà¯ˆ à®šà¯‹à®¤à®¿à®•à¯à®•à®µà¯à®®à¯",
      "quiz-win": "à®µà¯†à®±à¯à®±à®¿",
      "predictions-trending": "à®ªà®¿à®°à®ªà®² à®•à®£à®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "leaderboard-top-fans": "à®šà®¿à®±à®¨à¯à®¤ à®°à®šà®¿à®•à®°à¯à®•à®³à¯",
      "leaderboard-full": "à®®à¯à®´à¯ à®²à¯€à®Ÿà®°à¯à®ªà¯‹à®°à¯à®Ÿà¯",
      "time-this-week": "à®‡à®¨à¯à®¤ à®µà®¾à®°à®®à¯",
      "stat-earned": "à®šà®®à¯à®ªà®¾à®¤à®¿à®¤à¯à®¤à®¤à¯",
      "login-title": "à®®à¯€à®£à¯à®Ÿà¯à®®à¯ à®µà®°à®µà¯‡à®±à¯à®•à®¿à®±à¯‹à®®à¯!",
      "login-email-label": "à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯ à®…à®²à¯à®²à®¤à¯ à®ªà®¯à®©à®°à¯ à®ªà¯†à®¯à®°à¯",
      "login-email-placeholder": "à®‰à®™à¯à®•à®³à¯ à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯ à®…à®²à¯à®²à®¤à¯ à®ªà®¯à®©à®°à¯ à®ªà¯†à®¯à®°à¯ˆ à®‰à®³à¯à®³à®¿à®Ÿà®µà¯à®®à¯",
      "login-password-label": "à®•à®Ÿà®µà¯à®šà¯à®šà¯Šà®²à¯",
      "login-password-placeholder": "à®‰à®™à¯à®•à®³à¯ à®•à®Ÿà®µà¯à®šà¯à®šà¯Šà®²à¯à®²à¯ˆ à®‰à®³à¯à®³à®¿à®Ÿà®µà¯à®®à¯",
      "login-submit": "à®‰à®³à¯à®¨à¯à®´à¯ˆà®•",
      "login-forgot": "à®•à®Ÿà®µà¯à®šà¯à®šà¯Šà®²à¯ à®®à®±à®¨à¯à®¤à¯à®µà®¿à®Ÿà¯à®Ÿà®¤à®¾?",
      "login-no-account": "à®•à®£à®•à¯à®•à¯ à®‡à®²à¯à®²à¯ˆà®¯à®¾?",
      "signup-title": "à®•à®£à®•à¯à®•à¯ˆ à®‰à®°à¯à®µà®¾à®•à¯à®•à®µà¯à®®à¯",
      "signup-name-label": "à®®à¯à®´à¯à®ªà¯ à®ªà¯†à®¯à®°à¯",
      "signup-email-label": "à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯",
      "signup-password-label": "à®•à®Ÿà®µà¯à®šà¯à®šà¯Šà®²à¯",
      "signup-submit": "à®ªà®¤à®¿à®µà¯ à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯",
      "signup-have-account": "à®à®±à¯à®•à®©à®µà¯‡ à®•à®£à®•à¯à®•à¯ à®‰à®³à¯à®³à®¤à®¾?",
      "forgot-title": "à®•à®Ÿà®µà¯à®šà¯à®šà¯Šà®²à¯à®²à¯ˆ à®®à¯€à®Ÿà¯à®Ÿà®®à¯ˆà®•à¯à®•à®µà¯à®®à¯",
      "forgot-submit": "à®®à¯€à®Ÿà¯à®Ÿà®®à¯ˆ à®‡à®£à¯ˆà®ªà¯à®ªà¯ˆ à®…à®©à¯à®ªà¯à®ªà®µà¯à®®à¯",
      "settings-title": "à®…à®®à¯ˆà®ªà¯à®ªà¯à®•à®³à¯",
      "settings-subtitle": "à®‰à®™à¯à®•à®³à¯ à®µà®¿à®°à¯à®ªà¯à®ªà®¤à¯à®¤à¯‡à®°à¯à®µà¯à®•à®³à¯ à®®à®±à¯à®±à¯à®®à¯ à®•à®£à®•à¯à®•à¯ à®…à®®à¯ˆà®ªà¯à®ªà¯à®•à®³à¯ˆ à®¨à®¿à®°à¯à®µà®•à®¿à®•à¯à®•à®µà¯à®®à¯",
      "appearance-title": "à®¤à¯‹à®±à¯à®±à®®à¯",
      "appearance-subtitle": "FanConnact à®‡à®©à¯ à®¤à¯‹à®±à¯à®±à®¤à¯à®¤à¯ˆà®¯à¯à®®à¯ à®‰à®£à®°à¯à®µà¯ˆà®¯à¯à®®à¯ à®¤à®©à®¿à®ªà¯à®ªà®¯à®©à®¾à®•à¯à®•à¯à®™à¯à®•à®³à¯",
      "theme-light": "à®’à®³à®¿",
      "theme-light-desc": "à®šà¯à®¤à¯à®¤à®®à®¾à®© à®®à®±à¯à®±à¯à®®à¯ à®ªà®¿à®°à®•à®¾à®šà®®à®¾à®©",
      "theme-dark": "à®‡à®°à¯à®³à¯",
      "theme-dark-desc": "à®•à®£à¯à®•à®³à¯à®•à¯à®•à¯ à®Žà®³à®¿à®¤à®¾à®©à®¤à¯",
      "theme-stadium": "à®…à®°à®™à¯à®•à®®à¯",
      "theme-stadium-desc": "à®µà®¿à®³à¯ˆà®¯à®¾à®Ÿà¯à®Ÿà¯ˆ à®‰à®£à®°à¯à®™à¯à®•à®³à¯",
      "theme-esports": "à®¸à¯à®ªà¯‹à®°à¯à®Ÿà¯à®¸à¯",
      "theme-esports-desc": "à®¸à¯à®ªà¯‹à®°à¯à®Ÿà¯à®¸à¯ à®°à®šà®¿à®•à®°à¯à®•à®³à¯à®•à¯à®•à¯",
      "theme-royal": "à®°à®¾à®¯à®²à¯ à®ªà¯à®³à¯‚",
      "theme-royal-desc": "à®•à®¿à®³à®¾à®šà®¿à®•à¯ à®®à®±à¯à®±à¯à®®à¯ à®¨à¯‡à®°à¯à®¤à¯à®¤à®¿à®¯à®¾à®©",
      "compact-mode": "à®•à®¾à®®à¯à®ªà®¾à®•à¯à®Ÿà¯ à®ªà®¯à®©à¯à®®à¯à®±à¯ˆ",
      "compact-mode-desc": "à®•à¯à®±à¯ˆà®¨à¯à®¤ à®‡à®Ÿà®¤à¯à®¤à®¿à®²à¯ à®…à®¤à®¿à®• à®‰à®³à¯à®³à®Ÿà®•à¯à®•à®¤à¯à®¤à¯ˆà®•à¯ à®•à®¾à®Ÿà¯à®Ÿà¯",
      "reduce-animations": "à®…à®©à®¿à®®à¯‡à®·à®©à¯à®•à®³à¯ˆà®•à¯ à®•à¯à®±à¯ˆà®•à¯à®•à®µà¯à®®à¯",
      "reduce-animations-desc": "à®®à¯†à®©à¯à®®à¯ˆà®¯à®¾à®© à®…à®©à¯à®ªà®µà®¤à¯à®¤à®¿à®±à¯à®•à¯ à®‡à®¯à®•à¯à®•à®¤à¯à®¤à¯ˆ à®•à¯à®±à¯ˆà®•à¯à®•à®µà¯à®®à¯",
      "large-text": "à®ªà¯†à®°à®¿à®¯ à®‰à®°à¯ˆ",
      "large-text-desc": "à®šà®¿à®±à®¨à¯à®¤ à®µà®¾à®šà®¿à®ªà¯à®ªà¯à®•à¯à®•à¯ à®‰à®°à¯ˆ à®…à®³à®µà¯ˆ à®…à®¤à®¿à®•à®°à®¿à®•à¯à®•à®µà¯à®®à¯",
      "sports-title": "à®µà®¿à®³à¯ˆà®¯à®¾à®Ÿà¯à®Ÿà¯ à®µà®¿à®°à¯à®ªà¯à®ªà®¤à¯à®¤à¯‡à®°à¯à®µà¯à®•à®³à¯",
      "sports-subtitle": "à®¤à®©à®¿à®ªà¯à®ªà®¯à®©à®¾à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿ à®…à®±à®¿à®µà®¿à®ªà¯à®ªà¯à®•à®³à¯ˆà®ªà¯ à®ªà¯†à®±, à®‰à®™à¯à®•à®³à¯à®•à¯à®•à¯à®ªà¯ à®ªà®¿à®Ÿà®¿à®¤à¯à®¤ à®µà®¿à®³à¯ˆà®¯à®¾à®Ÿà¯à®Ÿà¯à®•à®³à¯ˆà®¤à¯ à®¤à¯‡à®°à¯à®¨à¯à®¤à¯†à®Ÿà¯à®•à¯à®•à®µà¯à®®à¯",
      "sport-cricket": "à®•à®¿à®°à®¿à®•à¯à®•à¯†à®Ÿà¯",
      "sport-football": "à®•à®¾à®²à¯à®ªà®¨à¯à®¤à¯",
      "sport-basketball": "à®•à¯‚à®Ÿà¯ˆà®ªà¯à®ªà®¨à¯à®¤à¯",
      "sport-tennis": "à®Ÿà¯†à®©à¯à®©à®¿à®¸à¯",
      "sport-hockey": "à®¹à®¾à®•à¯à®•à®¿",
      "sport-kabaddi": "à®•à®ªà®Ÿà®¿",
      "sport-volleyball": "à®•à¯ˆà®ªà¯à®ªà®¨à¯à®¤à¯",
      "sport-tabletennis": "à®Ÿà¯‡à®ªà®¿à®³à¯ à®Ÿà¯†à®©à¯à®©à®¿à®¸à¯",
      "sport-esports": "à®¸à¯à®ªà¯‹à®°à¯à®Ÿà¯à®¸à¯",
      "sport-baseball": "à®ªà¯‡à®¸à¯à®ªà®¾à®²à¯",
      "sport-add-more": "à®®à¯‡à®²à¯à®®à¯ à®µà®¿à®³à¯ˆà®¯à®¾à®Ÿà¯à®Ÿà¯à®•à®³à¯ˆà®šà¯ à®šà¯‡à®°à¯à®•à¯à®•à®µà¯à®®à¯",
      "notif-title": "à®…à®±à®¿à®µà®¿à®ªà¯à®ªà¯ à®µà®¿à®°à¯à®ªà¯à®ªà®¤à¯à®¤à¯‡à®°à¯à®µà¯à®•à®³à¯",
      "notif-subtitle": "à®¨à¯€à®™à¯à®•à®³à¯ à®Žà®¤à¯ˆà®ªà¯ à®ªà®±à¯à®±à®¿ à®…à®±à®¿à®µà®¿à®•à¯à®• à®µà¯‡à®£à¯à®Ÿà¯à®®à¯ à®Žà®©à¯à®ªà®¤à¯ˆà®¤à¯ à®¤à¯‡à®°à¯à®µà¯à®šà¯†à®¯à¯à®¯à®µà¯à®®à¯",
      "notif-live": "à®¨à¯‡à®°à®Ÿà®¿ à®ªà¯‹à®Ÿà¯à®Ÿà®¿ à®Žà®šà¯à®šà®°à®¿à®•à¯à®•à¯ˆà®•à®³à¯",
      "notif-news": "à®ªà®¿à®°à¯‡à®•à¯à®•à®¿à®™à¯ à®¨à®¿à®¯à¯‚à®¸à¯",
      "notif-predictions": "à®•à®£à®¿à®ªà¯à®ªà¯ à®®à¯à®Ÿà®¿à®µà¯à®•à®³à¯",
      "notif-community": "à®šà®®à¯‚à®• à®ªà¯à®¤à¯à®ªà¯à®ªà®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "notif-email": "à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯ à®…à®±à®¿à®µà®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "notif-push": "à®ªà¯à®·à¯ à®…à®±à®¿à®µà®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "notif-mentions": "à®•à¯à®±à®¿à®ªà¯à®ªà¯à®•à®³à¯ & à®ªà®¤à®¿à®²à¯à®•à®³à¯",
      "notif-followers": "à®ªà¯à®¤à®¿à®¯ à®ªà®¿à®©à¯à®¤à¯Šà®Ÿà®°à¯à®ªà®µà®°à¯à®•à®³à¯",
      "security-title": "à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯",
      "security-subtitle": "à®‰à®™à¯à®•à®³à¯ à®•à®£à®•à¯à®•à¯ˆà®ªà¯ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®•à®µà¯à®®à¯ à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà®¾à®•à®µà¯à®®à¯ à®µà¯ˆà®¤à¯à®¤à®¿à®°à¯à®™à¯à®•à®³à¯",
      "security-google": "à®•à¯‚à®•à¯à®³à¯",
      "security-facebook": "Facebook",
      "security-connected": "à®‡à®£à¯ˆà®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿà®¤à¯",
      "security-change-password": "à®•à®Ÿà®µà¯à®šà¯à®šà¯Šà®²à¯à®²à¯ˆ à®®à®¾à®±à¯à®±à®µà¯à®®à¯",
      "security-2fa": "à®‡à®°à®£à¯à®Ÿà¯ à®•à®¾à®°à®£à®¿ à®…à®™à¯à®•à¯€à®•à®¾à®°à®®à¯",
      "security-2fa-on": "à®…à®©à¯à®±à¯",
      "security-2fa-off": "à®†à®ƒà®ªà¯",
      "security-logout-all": "à®…à®©à¯ˆà®¤à¯à®¤à¯ à®šà®¾à®¤à®©à®™à¯à®•à®³à¯ˆà®¯à¯à®®à¯ à®µà¯†à®³à®¿à®¯à¯‡à®±à¯",
      "lang-title": "à®®à¯Šà®´à®¿ & à®ªà®¿à®°à®¾à®¨à¯à®¤à®¿à®¯à®®à¯",
      "lang-subtitle": "à®‰à®™à¯à®•à®³à¯ à®®à¯Šà®´à®¿ à®®à®±à¯à®±à¯à®®à¯ à®ªà®¿à®°à®¾à®¨à¯à®¤à®¿à®¯ à®µà®¿à®°à¯à®ªà¯à®ªà®™à¯à®•à®³à¯ˆ à®¨à®¿à®°à¯à®µà®•à®¿à®•à¯à®•à®µà¯à®®à¯",
      "lang-language": "à®®à¯Šà®´à®¿",
      "lang-timezone": "à®¨à¯‡à®° à®®à®£à¯à®Ÿà®²à®®à¯",
      "lang-region": "à®ªà®¿à®°à®¾à®¨à¯à®¤à®¿à®¯à®®à¯",
      "support-title": "à®†à®¤à®°à®µà¯ & à®ªà®±à¯à®±à®¿",
      "support-subtitle": "à®‰à®¤à®µà®¿, à®•à®°à¯à®¤à¯à®¤à¯ à®®à®±à¯à®±à¯à®®à¯ à®ªà®¯à®©à¯à®ªà®¾à®Ÿà¯à®Ÿà¯à®¤à¯ à®¤à®•à®µà®²à¯",
      "support-report-bug": "à®ªà®¿à®´à¯ˆà®¯à¯ˆà®ªà¯ à®ªà¯à®•à®¾à®°à®³à®¿à®•à¯à®•à®µà¯à®®à¯",
      "support-feedback": "à®•à®°à¯à®¤à¯à®¤à¯ˆ à®…à®©à¯à®ªà¯à®ªà®µà¯à®®à¯",
      "support-contact": "à®†à®¤à®°à®µà¯ˆà®¤à¯ à®¤à¯Šà®Ÿà®°à¯à®ªà¯ à®•à¯Šà®³à¯à®³à®µà¯à®®à¯",
      "support-privacy": "à®¤à®©à®¿à®¯à¯à®°à®¿à®®à¯ˆà®•à¯ à®•à¯Šà®³à¯à®•à¯ˆ",
      "support-terms": "à®µà®¿à®¤à®¿à®®à¯à®±à¯ˆà®•à®³à¯ & à®¨à®¿à®ªà®¨à¯à®¤à®©à¯ˆà®•à®³à¯",
      "profile-title": "à®šà¯à®¯à®µà®¿à®µà®°à®®à¯",
      "profile-edit": "à®šà¯à®¯à®µà®¿à®µà®°à®¤à¯à®¤à¯ˆà®¤à¯ à®¤à®¿à®°à¯à®¤à¯à®¤à¯",
      "profile-level": "à®¨à®¿à®²à¯ˆ",
      "profile-achievements": "à®šà®¾à®¤à®©à¯ˆà®•à®³à¯",
      "profile-recent-activity": "à®šà®®à¯€à®ªà®¤à¯à®¤à®¿à®¯ à®šà¯†à®¯à®²à¯à®ªà®¾à®Ÿà¯",
      "profile-identity": "à®…à®Ÿà¯ˆà®¯à®¾à®³ à®µà®¿à®µà®°à®™à¯à®•à®³à¯",
      "profile-fullname": "à®®à¯à®´à¯à®ªà¯ à®ªà¯†à®¯à®°à¯",
      "profile-username": "à®ªà®¯à®©à®°à¯ à®ªà¯†à®¯à®°à¯",
      "profile-gender": "à®ªà®¾à®²à®¿à®©à®®à¯",
      "profile-dob": "à®ªà®¿à®±à®¨à¯à®¤ à®¤à¯‡à®¤à®¿",
      "profile-contact": "à®¤à¯Šà®Ÿà®°à¯à®ªà¯ à®¤à®•à®µà®²à¯",
      "profile-email": "à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯",
      "profile-mobile": "à®®à¯Šà®ªà¯ˆà®²à¯",
      "profile-location": "à®‡à®Ÿà®®à¯",
      "profile-save": "à®®à®¾à®±à¯à®±à®™à¯à®•à®³à¯ˆà®šà¯ à®šà¯‡à®®à®¿à®•à¯à®•à®µà¯à®®à¯",
      "profile-cancel": "à®°à®¤à¯à®¤à¯ à®šà¯†à®¯à¯",
      "profile-signout": "à®•à®£à®•à¯à®•à®¿à®²à®¿à®°à¯à®¨à¯à®¤à¯ à®µà¯†à®³à®¿à®¯à¯‡à®±à¯",
      "stats-total-predictions": "à®®à¯Šà®¤à¯à®¤ à®•à®£à®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "stats-win-rate": "à®µà¯†à®±à¯à®±à®¿ à®µà®¿à®•à®¿à®¤à®®à¯ %",
      "stats-xp-progress": "à®Žà®•à¯à®¸à¯à®ªà®¿ à®®à¯à®©à¯à®©à¯‡à®±à¯à®±à®®à¯",
      "stats-global-rank": "à®‰à®²à®•à®³à®¾à®µà®¿à®¯ à®¤à®°à®µà®°à®¿à®šà¯ˆ",
      "fancoin-title": "FanCoin à®ªà®£à®ªà¯à®ªà¯ˆ",
      "fancoin-balance": "à®‡à®°à¯à®ªà¯à®ªà¯",
      "fancoin-earn": "à®¨à®¾à®£à®¯à®™à¯à®•à®³à¯ à®šà®®à¯à®ªà®¾à®¤à®¿à®•à¯à®•",
      "fancoin-history": "à®ªà®°à®¿à®µà®°à¯à®¤à¯à®¤à®©à¯ˆ à®µà®°à®²à®¾à®±à¯",
      "fancoin-tagline": "à®¨à®¾à®£à®¯à®™à¯à®•à®³à¯ à®šà®®à¯à®ªà®¾à®¤à®¿à®•à¯à®•.",
      "fancoin-ways": "à®°à®šà®¿à®•à®°à¯ à®¨à®¾à®£à®¯à®™à¯à®•à®³à¯ˆ à®šà®®à¯à®ªà®¾à®¤à®¿à®ªà¯à®ªà®¤à®±à¯à®•à®¾à®© à®µà®´à®¿à®•à®³à¯",
      "fancoin-streak": "à®¨à®¾à®³à¯ à®¸à¯à®Ÿà¯à®°à¯€à®•à¯",
      "view-wallet": "à®µà®¾à®²à®Ÿà¯à®Ÿà¯ˆà®ªà¯ à®ªà®¾à®°à¯à®•à¯à®•à®µà¯à®®à¯",
      "earn-daily-quiz-title": "à®¤à®¿à®©à®šà®°à®¿ à®µà®¿à®©à®¾à®Ÿà®¿à®µà®¿à®©à®¾",
      "earn-prediction-title": "à®ªà¯‹à®Ÿà¯à®Ÿà®¿ à®•à®£à®¿à®ªà¯à®ªà¯",
      "earn-community-title": "à®šà®®à¯‚à®• à®šà¯†à®¯à®²à¯à®ªà®¾à®Ÿà¯",
      "earn-fanwar-title": "à®°à®šà®¿à®•à®°à¯ à®ªà¯‹à®°à¯",
      "earn-daily-quiz-desc": "à®¤à®¿à®©à®šà®°à®¿ à®µà®¿à®©à®¾à®Ÿà®¿ à®µà®¿à®©à®¾ à®•à¯‡à®³à¯à®µà®¿à®•à®³à¯à®•à¯à®•à¯ à®ªà®¤à®¿à®²à®³à®¿à®¤à¯à®¤à¯ à®¨à®¾à®£à®¯à®™à¯à®•à®³à¯ˆà®ªà¯ à®ªà¯†à®±à¯à®™à¯à®•à®³à¯",
      "earn-prediction-desc": "à®ªà¯‹à®Ÿà¯à®Ÿà®¿ à®®à¯à®Ÿà®¿à®µà¯à®•à®³à¯ˆ à®šà®°à®¿à®¯à®¾à®• à®•à®£à®¿à®•à¯à®•à®µà¯à®®à¯",
      "earn-community-desc": "à®‰à®™à¯à®•à®³à¯ à®°à®šà®¿à®•à®°à¯ à®šà®®à¯‚à®•à®™à¯à®•à®³à®¿à®²à¯ à®šà¯†à®¯à®²à®¿à®²à¯ à®‡à®°à¯à®™à¯à®•à®³à¯",
      "earn-fanwar-desc": "à®°à®šà®¿à®•à®°à¯ à®šà®£à¯à®Ÿà¯ˆà®•à®³à®¿à®²à¯ à®ªà®™à¯à®•à¯‡à®±à¯à®•à®µà¯à®®à¯",
      "level-bronze": "à®µà¯†à®£à¯à®•à®² à®µà®¿à®šà®¿à®±à®¿",
      "level-silver": "à®µà¯†à®³à¯à®³à®¿ à®µà®¿à®šà®¿à®±à®¿",
      "level-gold": "à®¤à®™à¯à®• à®µà®¿à®šà®¿à®±à®¿",
      "level-diamond": "à®µà¯ˆà®° à®µà®¿à®šà®¿à®±à®¿",
      "level-next": "à®¤à¯Šà®Ÿà®°à¯à®™à¯à®•à®³à¯!",
      "level-benefits": "à®¨à®¿à®²à¯ˆ à®¨à®©à¯à®®à¯ˆà®•à®³à¯",
      "benefit-exclusive": "à®ªà®¿à®°à®¤à¯à®¤à®¿à®¯à¯‡à®• à®‰à®³à¯à®³à®Ÿà®•à¯à®•à®®à¯",
      "benefit-early-access": "à®†à®°à®®à¯à®ª à®…à®£à¯à®•à®²à¯",
      "benefit-badges": "à®šà®¿à®±à®ªà¯à®ªà¯ à®ªà¯‡à®Ÿà¯à®œà¯à®•à®³à¯",
      "news-title": "à®šà¯†à®¯à¯à®¤à®¿à®•à®³à¯ & à®ªà¯à®¤à¯à®ªà¯à®ªà®¿à®ªà¯à®ªà¯à®•à®³à¯",
      "news-latest": "à®šà®®à¯€à®ªà®¤à¯à®¤à®¿à®¯ à®šà¯†à®¯à¯à®¤à®¿à®•à®³à¯",
      "matches-title": "à®¨à¯‡à®°à®Ÿà®¿ à®ªà¯‹à®Ÿà¯à®Ÿà®¿à®•à®³à¯",
      "matches-upcoming": "à®µà®°à®µà®¿à®°à¯à®•à¯à®•à®¿à®±à®¤à¯",
      "matches-live": "à®¨à¯‡à®°à®²à¯ˆ",
      "matches-completed": "à®®à¯à®Ÿà®¿à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿà®¤à¯",
      "footer-copyright": "Â© 2024 FanConnact.",
      "theme-toggle-label": "à®¤à¯€à®®à¯ à®®à®¾à®±à¯",
    },
  te: {
      "nav-home": "à°¹à±‹à°®à±",
      "nav-news": "à°µà°¾à°°à±à°¤à°²à±",
      "nav-matches": "à°®à±à°¯à°¾à°šà±â€Œà°²à±",
      "nav-communities": "à°¸à°‚à°˜à°¾à°²à±",
      "nav-leaderboard": "à°²à±€à°¡à°°à±â€Œà°¬à±‹à°°à±à°¡à±",
      "nav-live": "à°ªà±à°°à°¤à±à°¯à°•à±à°· à°®à±à°¯à°¾à°šà±â€Œà°²à±",
      "nav-settings": "à°¸à±†à°Ÿà±à°Ÿà°¿à°‚à°—à±â€Œà°²à±",
      "nav-profile": "à°ªà±à°°à±Šà°«à±ˆà°²à±",
      "nav-notifications": "à°¨à±‹à°Ÿà°¿à°«à°¿à°•à±‡à°·à°¨à±â€Œà°²à±",
      "nav-logout": "à°²à°¾à°—à±à°…à°µà±à°Ÿà±",
      "nav-login": "à°²à°¾à°—à°¿à°¨à± à°šà±‡à°¯à°‚à°¡à°¿",
      "nav-signup": "à°¸à±ˆà°¨à± à°…à°ªà± à°šà±‡à°¯à°‚à°¡à°¿",
      "nav-back": "à°µà±†à°¨à±à°•à°•à±",
      "nav-global": "à°—à±à°²à±‹à°¬à°²à±",
      "nav-player-zone": "à°ªà±à°²à±‡à°¯à°°à± à°œà±‹à°¨à±",
      "nav-predictions": "à°…à°‚à°šà°¨à°¾à°²à±",
      "welcome-guest": "à°¸à±à°µà°¾à°—à°¤à°‚, à°…à°¤à°¿à°¥à°¿!",
      "welcome-back": "à°¤à°¿à°°à°¿à°—à°¿ à°¸à±à°µà°¾à°—à°¤à°‚,",
      "search-placeholder": "à°¶à±‹à°§à°¨...",
      "view-all": "à°…à°¨à±à°¨à±€ à°µà±€à°•à±à°·à°¿à°‚à°šà°‚à°¡à°¿",
      "see-more": "à°®à°°à°¿à°¨à±à°¨à°¿ à°šà±‚à°¡à°‚à°¡à°¿",
      "no-results": "à°«à°²à°¿à°¤à°¾à°²à± à°à°µà±€ à°•à°¨à±à°—à±Šà°¨à°¬à°¡à°²à±‡à°¦à±",
      "loading": "à°²à±‹à°¡à± à°…à°µà±à°¤à±‹à°‚à°¦à°¿...",
      "error-occured": "à°à°¦à±‹ à°¤à°ªà±à°ªà± à°œà°°à°¿à°—à°¿à°‚à°¦à°¿",
      "retry": "à°®à°³à±à°²à±€ à°ªà±à°°à°¯à°¤à±à°¨à°¿à°‚à°šà°‚à°¡à°¿",
      "cancel": "à°°à°¦à±à°¦à± à°šà±‡à°¯à°¿",
      "save": "à°¸à±‡à°µà± à°šà±‡à°¯à°‚à°¡à°¿",
      "delete": "à°¤à±Šà°²à°—à°¿à°‚à°šà±",
      "confirm": "à°¨à°¿à°°à±à°§à°¾à°°à°¿à°‚à°šà°‚à°¡à°¿",
      "version": "à°µà±†à°°à±à°·à°¨à± 1.0.0",
      "vs": "VS",
      "play-now": "à°‡à°ªà±à°ªà±à°¡à±‡ à°†à°¡à°‚à°¡à°¿",
      "live-now": "à°‡à°ªà±à°ªà±à°¡à± à°ªà±à°°à°¤à±à°¯à°•à±à°· à°ªà±à°°à°¸à°¾à°°à°‚ à°šà±‡à°¯à°‚à°¡à°¿",
      "app-unlock": "à°¯à°¾à°ªà±â€Œà°¤à±‹ à°…à°¨à±â€Œà°²à°¾à°•à± à°šà±‡à°¯à°‚à°¡à°¿",
      "promo-join-now": "à°‡à°ªà±à°ªà±à°¡à±‡ à°šà±‡à°°à°‚à°¡à°¿",
      "match-center-view": "à°®à±à°¯à°¾à°šà± à°•à±‡à°‚à°¦à±à°°à°¾à°¨à±à°¨à°¿ à°µà±€à°•à±à°·à°¿à°‚à°šà°‚à°¡à°¿",
      "welcome-subtitle": "à°®à±€ à°…à°‚à°¤à°¿à°® à°•à±à°°à±€à°¡à°¾ à°¸à°‚à°˜à°‚",
      "communities-title": "à°…à°­à°¿à°®à°¾à°¨ à°¸à°‚à°˜à°¾à°²à±",
      "status-live": "à°ªà±à°°à°¤à±à°¯à°•à±à°·à°‚",
      "promo-fan-war": "à°«à±à°¯à°¾à°¨à± à°µà°¾à°°à±",
      "promo-fan-war-desc": "à°…à°‚à°¤à°¿à°® à°…à°­à°¿à°®à°¾à°¨à±à°² à°¯à±à°¦à±à°§à°‚à°²à±‹ à°šà±‡à°°à°‚à°¡à°¿",
      "quiz-title": "à°•à±à°µà°¿à°œà± à°›à°¾à°²à±†à°‚à°œà±",
      "quiz-daily-cricket": "à°°à±‹à°œà±à°µà°¾à°°à±€ à°•à±à°°à°¿à°•à±†à°Ÿà± à°•à±à°µà°¿à°œà±",
      "quiz-description": "à°®à±€ à°•à±à°°à°¿à°•à±†à°Ÿà± à°ªà°°à°¿à°œà±à°žà°¾à°¨à°¾à°¨à±à°¨à°¿ à°ªà°°à±€à°•à±à°·à°¿à°‚à°šà±à°•à±‹à°‚à°¡à°¿",
      "quiz-win": "à°—à±†à°²à°µà°‚à°¡à°¿",
      "predictions-trending": "à°Ÿà±à°°à±†à°‚à°¡à°¿à°‚à°—à± à°…à°‚à°šà°¨à°¾à°²à±",
      "leaderboard-top-fans": "à°…à°—à±à°° à°…à°­à°¿à°®à°¾à°¨à±à°²à±",
      "leaderboard-full": "à°ªà±‚à°°à±à°¤à°¿ à°²à±€à°¡à°°à±â€Œà°¬à±‹à°°à±à°¡à±",
      "time-this-week": "à°ˆ à°µà°¾à°°à°‚",
      "stat-earned": "à°¸à°‚à°ªà°¾à°¦à°¿à°‚à°šà°¾à°°à±",
      "login-title": "à°¤à°¿à°°à°¿à°—à°¿ à°¸à±à°µà°¾à°—à°¤à°‚!",
      "login-email-label": "à°‡à°®à±†à°¯à°¿à°²à± à°²à±‡à°¦à°¾ à°µà°¿à°¨à°¿à°¯à±‹à°—à°¦à°¾à°°à± à°ªà±‡à°°à±",
      "login-email-placeholder": "à°®à±€ à°‡à°®à±†à°¯à°¿à°²à± à°²à±‡à°¦à°¾ à°µà°¿à°¨à°¿à°¯à±‹à°—à°¦à°¾à°°à± à°ªà±‡à°°à±à°¨à± à°¨à°®à±‹à°¦à± à°šà±‡à°¯à°‚à°¡à°¿",
      "login-password-label": "à°ªà°¾à°¸à±à°µà°°à±à°¡à±",
      "login-password-placeholder": "à°®à±€ à°ªà°¾à°¸à±â€Œà°µà°°à±à°¡à±â€Œà°¨à°¿ à°¨à°®à±‹à°¦à± à°šà±‡à°¯à°‚à°¡à°¿",
      "login-submit": "à°²à°¾à°—à°¿à°¨à± à°šà±‡à°¯à°‚à°¡à°¿",
      "login-forgot": "à°ªà°¾à°¸à±â€Œà°µà°°à±à°¡à± à°®à°°à±à°šà°¿à°ªà±‹à°¯à°¾à°°à°¾?",
      "login-no-account": "à°–à°¾à°¤à°¾ à°²à±‡à°¦à°¾?",
      "signup-title": "à°–à°¾à°¤à°¾à°¨à± à°¸à±ƒà°·à±à°Ÿà°¿à°‚à°šà°‚à°¡à°¿",
      "signup-name-label": "à°ªà±‚à°°à±à°¤à°¿ à°ªà±‡à°°à±",
      "signup-email-label": "à°‡à°®à±†à°¯à°¿à°²à±",
      "signup-password-label": "à°ªà°¾à°¸à±à°µà°°à±à°¡à±",
      "signup-submit": "à°¸à±ˆà°¨à± à°…à°ªà± à°šà±‡à°¯à°‚à°¡à°¿",
      "signup-have-account": "à°‡à°ªà±à°ªà°Ÿà°¿à°•à±‡ à°–à°¾à°¤à°¾ à°‰à°‚à°¦à°¾?",
      "forgot-title": "à°ªà°¾à°¸à±â€Œà°µà°°à±à°¡à±â€Œà°¨à°¿ à°°à±€à°¸à±†à°Ÿà± à°šà±‡à°¯à°‚à°¡à°¿",
      "forgot-submit": "à°°à±€à°¸à±†à°Ÿà± à°²à°¿à°‚à°•à±â€Œà°¨à°¿ à°ªà°‚à°ªà°‚à°¡à°¿",
      "settings-title": "à°¸à±†à°Ÿà±à°Ÿà°¿à°‚à°—à±â€Œà°²à±",
      "settings-subtitle": "à°®à±€ à°ªà±à°°à°¾à°§à°¾à°¨à±à°¯à°¤à°²à± à°®à°°à°¿à°¯à± à°–à°¾à°¤à°¾ à°¸à±†à°Ÿà±à°Ÿà°¿à°‚à°—à±â€Œà°²à°¨à± à°¨à°¿à°°à±à°µà°¹à°¿à°‚à°šà°‚à°¡à°¿",
      "appearance-title": "à°¸à±à°µà°°à±‚à°ªà°‚",
      "appearance-subtitle": "FanConnact à°°à±‚à°ªà°¾à°¨à±à°¨à°¿ à°®à°°à°¿à°¯à± à°…à°¨à±à°­à±‚à°¤à°¿à°¨à°¿ à°…à°¨à±à°•à±‚à°²à±€à°•à°°à°¿à°‚à°šà°‚à°¡à°¿",
      "theme-light": "à°•à°¾à°‚à°¤à°¿",
      "theme-light-desc": "à°¶à±à°­à±à°°à°‚à°—à°¾ à°®à°°à°¿à°¯à± à°ªà±à°°à°•à°¾à°¶à°µà°‚à°¤à°‚à°—à°¾",
      "theme-dark": "à°šà±€à°•à°Ÿà°¿",
      "theme-dark-desc": "à°•à°³à±à°²à°•à± à°¤à±‡à°²à°¿à°•",
      "theme-stadium": "à°¸à±à°Ÿà±‡à°¡à°¿à°¯à°‚",
      "theme-stadium-desc": "à°—à±‡à°®à± à°«à±€à°²à±",
      "theme-esports": "à°Žà°¸à±à°ªà±‹à°°à±à°Ÿà±à°¸à±",
      "theme-esports-desc": "à°Žà°¸à±à°ªà±‹à°°à±à°Ÿà±à°¸à± à°…à°­à°¿à°®à°¾à°¨à±à°² à°•à±‹à°¸à°‚",
      "theme-royal": "à°°à°¾à°¯à°²à± à°¬à±à°²à±‚",
      "theme-royal-desc": "à°•à±à°²à°¾à°¸à°¿à°•à± à°®à°°à°¿à°¯à± à°¸à±Šà°—à°¸à±ˆà°¨",
      "compact-mode": "à°•à°¾à°‚à°ªà°¾à°•à±à°Ÿà± à°®à±‹à°¡à±",
      "compact-mode-desc": "à°¤à°•à±à°•à±à°µ à°¸à±à°¥à°²à°‚à°²à±‹ à°Žà°•à±à°•à±à°µ à°•à°‚à°Ÿà±†à°‚à°Ÿà±â€Œà°¨à°¿ à°šà±‚à°ªà°‚à°¡à°¿",
      "reduce-animations": "à°¯à°¾à°¨à°¿à°®à±‡à°·à°¨à±â€Œà°²à°¨à± à°¤à°—à±à°—à°¿à°‚à°šà°‚à°¡à°¿",
      "reduce-animations-desc": "à°¸à±à°¨à±à°¨à°¿à°¤à°®à±ˆà°¨ à°…à°¨à±à°­à°µà°‚ à°•à±‹à°¸à°‚ à°•à°¦à°²à°¿à°•à°¨à± à°¤à°—à±à°—à°¿à°‚à°šà°‚à°¡à°¿",
      "large-text": "à°ªà±†à°¦à±à°¦ à°µà°šà°¨à°‚",
      "large-text-desc": "à°®à±†à°°à±à°—à±ˆà°¨ à°°à±€à°¡à°¬à°¿à°²à°¿à°Ÿà±€ à°•à±‹à°¸à°‚ à°Ÿà±†à°•à±à°¸à±à°Ÿà± à°ªà°°à°¿à°®à°¾à°£à°¾à°¨à±à°¨à°¿ à°ªà±†à°‚à°šà°‚à°¡à°¿",
      "sports-title": "à°•à±à°°à±€à°¡à°² à°ªà±à°°à°¾à°§à°¾à°¨à±à°¯à°¤à°²à±",
      "sports-subtitle": "à°µà±à°¯à°•à±à°¤à°¿à°—à°¤à±€à°•à°°à°¿à°‚à°šà°¿à°¨ à°…à°ªà±â€Œà°¡à±‡à°Ÿà±â€Œà°²à°¨à± à°ªà±Šà°‚à°¦à°¡à°¾à°¨à°¿à°•à°¿ à°®à±€à°•à± à°‡à°·à±à°Ÿà°®à±ˆà°¨ à°•à±à°°à±€à°¡à°²à°¨à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿",
      "sport-cricket": "à°•à±à°°à°¿à°•à±†à°Ÿà±",
      "sport-football": "à°«à±à°Ÿà±à°¬à°¾à°²à±",
      "sport-basketball": "à°¬à°¾à°¸à±à°•à±†à°Ÿà±â€Œà°¬à°¾à°²à±",
      "sport-tennis": "à°Ÿà±†à°¨à±à°¨à°¿à°¸à±",
      "sport-hockey": "à°¹à°¾à°•à±€",
      "sport-kabaddi": "à°•à°¬à°¡à±à°¡à±€",
      "sport-volleyball": "à°µà°¾à°²à±€à°¬à°¾à°²à±",
      "sport-tabletennis": "à°Ÿà±‡à°¬à±à°²à± à°Ÿà±†à°¨à±à°¨à°¿à°¸à±",
      "sport-esports": "à°Žà°¸à±à°ªà±‹à°°à±à°Ÿà±à°¸à±",
      "sport-baseball": "à°¬à±‡à°¸à±à°¬à°¾à°²à±",
      "sport-add-more": "à°®à°°à°¿à°¨à±à°¨à°¿ à°•à±à°°à±€à°¡à°²à°¨à± à°œà±‹à°¡à°¿à°‚à°šà°‚à°¡à°¿",
      "notif-title": "à°¨à±‹à°Ÿà°¿à°«à°¿à°•à±‡à°·à°¨à± à°ªà±à°°à°¾à°§à°¾à°¨à±à°¯à°¤à°²à±",
      "notif-subtitle": "à°®à±€à°°à± à°¦à±‡à°¨à°¿ à°—à±à°°à°¿à°‚à°šà°¿ à°¤à±†à°²à°¿à°¯à°œà±‡à°¯à°¾à°²à°¨à±à°•à±à°‚à°Ÿà±à°¨à±à°¨à°¾à°°à±‹ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿",
      "notif-live": "à°ªà±à°°à°¤à±à°¯à°•à±à°· à°®à±à°¯à°¾à°šà± à°¹à±†à°šà±à°šà°°à°¿à°•à°²à±",
      "notif-news": "à°¬à±à°°à±‡à°•à°¿à°‚à°—à± à°¨à±à°¯à±‚à°¸à±",
      "notif-predictions": "à°…à°‚à°šà°¨à°¾ à°«à°²à°¿à°¤à°¾à°²à±",
      "notif-community": "à°¸à°‚à°˜à°‚ à°¨à°µà±€à°•à°°à°£à°²à±",
      "notif-email": "à°‡à°®à±†à°¯à°¿à°²à± à°¨à±‹à°Ÿà°¿à°«à°¿à°•à±‡à°·à°¨à±â€Œà°²à±",
      "notif-push": "à°ªà±à°·à± à°¨à±‹à°Ÿà°¿à°«à°¿à°•à±‡à°·à°¨à±à°²à±",
      "notif-mentions": "à°ªà±à°°à°¸à±à°¤à°¾à°µà°¨à°²à± & à°ªà±à°°à°¤à±à°¯à±à°¤à±à°¤à°°à°¾à°²à±",
      "notif-followers": "à°•à±Šà°¤à±à°¤ à°…à°¨à±à°šà°°à±à°²à±",
      "security-title": "à°­à°¦à±à°°à°¤",
      "security-subtitle": "à°®à±€ à°–à°¾à°¤à°¾à°¨à± à°¸à±à°°à°•à±à°·à°¿à°¤à°‚à°—à°¾ à°®à°°à°¿à°¯à± à°¸à±à°°à°•à±à°·à°¿à°¤à°‚à°—à°¾ à°‰à°‚à°šà°‚à°¡à°¿",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "à°•à°¨à±†à°•à±à°Ÿà± à°šà±‡à°¯à°¬à°¡à°¿à°‚à°¦à°¿",
      "security-change-password": "à°ªà°¾à°¸à±â€Œà°µà°°à±à°¡à± à°®à°¾à°°à±à°šà°‚à°¡à°¿",
      "security-2fa": "à°°à±†à°‚à°¡à±-à°•à°¾à°°à°•à°¾à°² à°ªà±à°°à°®à°¾à°£à±€à°•à°°à°£",
      "security-2fa-on": "à°†à°¨à±",
      "security-2fa-off": "à°†à°«à±",
      "security-logout-all": "à°…à°¨à±à°¨à°¿ à°ªà°°à°¿à°•à°°à°¾à°²à°¨à± à°²à°¾à°—à±à°…à°µà±à°Ÿà± à°šà±‡à°¯à°‚à°¡à°¿",
      "lang-title": "à°­à°¾à°· & à°ªà±à°°à°¾à°‚à°¤à°‚",
      "lang-subtitle": "à°®à±€ à°­à°¾à°· à°®à°°à°¿à°¯à± à°ªà±à°°à°¾à°‚à°¤ à°ªà±à°°à°¾à°§à°¾à°¨à±à°¯à°¤à°²à°¨à± à°¨à°¿à°°à±à°µà°¹à°¿à°‚à°šà°‚à°¡à°¿",
      "lang-language": "à°­à°¾à°·",
      "lang-timezone": "à°¸à°®à°¯à°®à°‚à°¡à°²à°¿",
      "lang-region": "à°ªà±à°°à°¾à°‚à°¤à°‚",
      "support-title": "à°®à°¦à±à°¦à°¤à± & à°—à±à°°à°¿à°‚à°šà°¿",
      "support-subtitle": "à°¸à°¹à°¾à°¯à°‚, à°…à°­à°¿à°ªà±à°°à°¾à°¯à°‚ à°®à°°à°¿à°¯à± à°¯à°¾à°ªà± à°¸à°®à°¾à°šà°¾à°°à°‚",
      "support-report-bug": "à°¬à°—à±â€Œà°¨à°¿ à°¨à°¿à°µà±‡à°¦à°¿à°‚à°šà°‚à°¡à°¿",
      "support-feedback": "à°…à°­à°¿à°ªà±à°°à°¾à°¯à°¾à°¨à±à°¨à°¿ à°ªà°‚à°ªà°‚à°¡à°¿",
      "support-contact": "à°®à°¦à±à°¦à°¤à±à°¨à± à°¸à°‚à°ªà±à°°à°¦à°¿à°‚à°šà°‚à°¡à°¿",
      "support-privacy": "à°—à±‹à°ªà±à°¯à°¤à°¾ à°µà°¿à°§à°¾à°¨à°‚",
      "support-terms": "à°¨à°¿à°¬à°‚à°§à°¨à°²à± & à°·à°°à°¤à±à°²à±",
      "profile-title": "à°ªà±à°°à±Šà°«à±ˆà°²à±",
      "profile-edit": "à°ªà±à°°à±Šà°«à±ˆà°²à±â€Œà°¨à°¿ à°¸à°µà°°à°¿à°‚à°šà°‚à°¡à°¿",
      "profile-level": "à°¸à±à°¥à°¾à°¯à°¿",
      "profile-achievements": "à°µà°¿à°œà°¯à°¾à°²à±",
      "profile-recent-activity": "à°‡à°Ÿà±€à°µà°²à°¿ à°•à°¾à°°à±à°¯à°¾à°šà°°à°£",
      "profile-identity": "à°—à±à°°à±à°¤à°¿à°‚à°ªà± à°µà°¿à°µà°°à°¾à°²à±",
      "profile-fullname": "à°ªà±‚à°°à±à°¤à°¿ à°ªà±‡à°°à±",
      "profile-username": "à°µà°¿à°¨à°¿à°¯à±‹à°—à°¦à°¾à°°à± à°ªà±‡à°°à±",
      "profile-gender": "à°²à°¿à°‚à°—à°‚",
      "profile-dob": "à°ªà±à°Ÿà±à°Ÿà°¿à°¨ à°¤à±‡à°¦à±€",
      "profile-contact": "à°¸à°‚à°ªà±à°°à°¦à°¿à°‚à°ªà± à°¸à°®à°¾à°šà°¾à°°à°‚",
      "profile-email": "à°‡à°®à±†à°¯à°¿à°²à±",
      "profile-mobile": "à°®à±Šà°¬à±ˆà°²à±",
      "profile-location": "à°¸à±à°¥à°¾à°¨à°‚",
      "profile-save": "à°®à°¾à°°à±à°ªà±à°²à°¨à± à°¸à±‡à°µà± à°šà±‡à°¯à°‚à°¡à°¿",
      "profile-cancel": "à°°à°¦à±à°¦à± à°šà±‡à°¯à°¿",
      "profile-signout": "à°–à°¾à°¤à°¾ à°¨à±à°‚à°¡à°¿ à°¸à±ˆà°¨à± à°…à°µà±à°Ÿà± à°šà±‡à°¯à°‚à°¡à°¿",
      "stats-total-predictions": "à°®à±Šà°¤à±à°¤à°‚ à°…à°‚à°šà°¨à°¾à°²à±",
      "stats-win-rate": "à°—à±†à°²à±à°ªà± à°°à±‡à°Ÿà± %",
      "stats-xp-progress": "XP à°ªà±à°°à±‹à°—à°¤à°¿",
      "stats-global-rank": "à°—à±à°²à±‹à°¬à°²à± à°°à±à°¯à°¾à°‚à°•à±",
      "fancoin-title": "FanCoin à°µà°¾à°²à±†à°Ÿà±",
      "fancoin-balance": "à°¬à±à°¯à°¾à°²à±†à°¨à±à°¸à±",
      "fancoin-earn": "à°¨à°¾à°£à±‡à°²à± à°¸à°‚à°ªà°¾à°¦à°¿à°‚à°šà°‚à°¡à°¿",
      "fancoin-history": "à°²à°¾à°µà°¾à°¦à±‡à°µà±€ à°šà°°à°¿à°¤à±à°°",
      "fancoin-tagline": "à°¨à°¾à°£à±‡à°²à± à°¸à°‚à°ªà°¾à°¦à°¿à°‚à°šà°‚à°¡à°¿.",
      "fancoin-ways": "à°«à±à°¯à°¾à°¨à± à°¨à°¾à°£à±‡à°²à°¨à± à°¸à°‚à°ªà°¾à°¦à°¿à°‚à°šà°¡à°¾à°¨à°¿à°•à°¿ à°®à°¾à°°à±à°—à°¾à°²à±",
      "fancoin-streak": "à°¡à±‡ à°¸à±à°Ÿà±à°°à±€à°•à±",
      "view-wallet": "à°µà°¾à°²à±†à°Ÿà±â€Œà°¨à°¿ à°µà±€à°•à±à°·à°¿à°‚à°šà°‚à°¡à°¿",
      "earn-daily-quiz-title": "à°°à±‹à°œà±à°µà°¾à°°à±€ à°•à±à°µà°¿à°œà±",
      "earn-prediction-title": "à°®à±à°¯à°¾à°šà± à°ªà±à°°à°¿à°¡à°¿à°•à±à°·à°¨à±",
      "earn-community-title": "à°¸à°‚à°˜à°‚ à°•à°¾à°°à±à°¯à°¾à°šà°°à°£",
      "earn-fanwar-title": "à°«à±à°¯à°¾à°¨à± à°µà°¾à°°à±",
      "earn-daily-quiz-desc": "à°°à±‹à°œà±à°µà°¾à°°à±€ à°•à±à°µà°¿à°œà± à°ªà±à°°à°¶à±à°¨à°²à°•à± à°¸à°®à°¾à°§à°¾à°¨à°‚ à°‡à°µà±à°µà°‚à°¡à°¿ à°®à°°à°¿à°¯à± à°¨à°¾à°£à±‡à°²à°¨à± à°¸à°‚à°ªà°¾à°¦à°¿à°‚à°šà°‚à°¡à°¿",
      "earn-prediction-desc": "à°®à±à°¯à°¾à°šà± à°«à°²à°¿à°¤à°¾à°²à°¨à± à°¸à°°à°¿à°—à±à°—à°¾ à°…à°‚à°šà°¨à°¾ à°µà±‡à°¯à°‚à°¡à°¿",
      "earn-community-desc": "à°®à±€ à°…à°­à°¿à°®à°¾à°¨ à°¸à°‚à°˜à°¾à°²à°²à±‹ à°šà±à°°à±à°•à±à°—à°¾ à°‰à°‚à°¡à°‚à°¡à°¿",
      "earn-fanwar-desc": "à°…à°­à°¿à°®à°¾à°¨à±à°² à°ªà±‹à°°à°¾à°Ÿà°¾à°²à°²à±‹ à°ªà°¾à°²à±à°—à±Šà°‚à°Ÿà°¾à°°à±",
      "level-bronze": "à°•à°¾à°‚à°¸à±à°¯ à°«à±à°¯à°¾à°¨à±",
      "level-silver": "à°¸à°¿à°²à±à°µà°°à± à°«à±à°¯à°¾à°¨à±",
      "level-gold": "à°—à±‹à°²à±à°¡à± à°«à±à°¯à°¾à°¨à±",
      "level-diamond": "à°¡à±ˆà°®à°‚à°¡à± à°«à±à°¯à°¾à°¨à±",
      "level-next": "à°•à±Šà°¨à°¸à°¾à°—à°¿à°‚à°šà±!",
      "level-benefits": "à°¸à±à°¥à°¾à°¯à°¿ à°ªà±à°°à°¯à±‹à°œà°¨à°¾à°²à±",
      "benefit-exclusive": "à°ªà±à°°à°¤à±à°¯à±‡à°•à°®à±ˆà°¨ à°•à°‚à°Ÿà±†à°‚à°Ÿà±",
      "benefit-early-access": "à°®à±à°‚à°¦à°¸à±à°¤à± à°¯à°¾à°•à±à°¸à±†à°¸à±",
      "benefit-badges": "à°ªà±à°°à°¤à±à°¯à±‡à°• à°¬à±à°¯à°¾à°¡à±à°œà±€à°²à±",
      "news-title": "à°µà°¾à°°à±à°¤à°²à± & à°¨à°µà±€à°•à°°à°£à°²à±",
      "news-latest": "à°¤à°¾à°œà°¾ à°µà°¾à°°à±à°¤à°²à±",
      "matches-title": "à°ªà±à°°à°¤à±à°¯à°•à±à°· à°®à±à°¯à°¾à°šà±â€Œà°²à±",
      "matches-upcoming": "à°°à°¾à°¬à±‹à°¯à±‡à°¦à°¿",
      "matches-live": "à°ªà±à°°à°¤à±à°¯à°•à±à°· à°ªà±à°°à°¸à°¾à°°à°‚",
      "matches-completed": "à°ªà±‚à°°à±à°¤à°¯à°¿à°‚à°¦à°¿",
      "footer-copyright": "Â© 2024 FanConnact.",
      "theme-toggle-label": "à°¥à±€à°®à±â€Œà°¨à± à°Ÿà±‹à°—à±à°²à± à°šà±‡à°¯à°‚à°¡à°¿",
    },
  mr: {
      "nav-home": "à¤˜à¤°",
      "nav-news": "à¤¬à¤¾à¤¤à¤®à¥à¤¯à¤¾",
      "nav-matches": "à¤œà¥à¤³à¤¤à¤¾à¤¤",
      "nav-communities": "à¤¸à¤®à¥à¤¦à¤¾à¤¯",
      "nav-leaderboard": "à¤²à¥€à¤¡à¤°à¤¬à¥‹à¤°à¥à¤¡",
      "nav-live": "à¤¥à¥‡à¤Ÿ à¤¸à¤¾à¤®à¤¨à¥‡",
      "nav-settings": "à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤œ",
      "nav-profile": "à¤ªà¥à¤°à¥‹à¤«à¤¾à¤‡à¤²",
      "nav-notifications": "à¤¸à¥‚à¤šà¤¨à¤¾",
      "nav-logout": "à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ à¤•à¤°à¤¾",
      "nav-login": "à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¤¾",
      "nav-signup": "à¤¸à¤¾à¤‡à¤¨ à¤…à¤ª à¤•à¤°à¤¾",
      "nav-back": "à¤®à¤¾à¤—à¥‡",
      "nav-global": "à¤œà¤¾à¤—à¤¤à¤¿à¤•",
      "nav-player-zone": "à¤ªà¥à¤²à¥‡à¤…à¤° à¤à¥‹à¤¨",
      "nav-predictions": "à¤…à¤‚à¤¦à¤¾à¤œ",
      "welcome-guest": "à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤†à¤¹à¥‡, à¤…à¤¤à¤¿à¤¥à¥€!",
      "welcome-back": "à¤ªà¤°à¤¤ à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤†à¤¹à¥‡,",
      "search-placeholder": "à¤¶à¥‹à¤§à¤¾...",
      "view-all": "à¤¸à¤°à¥à¤µ à¤ªà¤¹à¤¾",
      "see-more": "à¤…à¤§à¤¿à¤• à¤ªà¤¹à¤¾",
      "no-results": "à¤•à¥‹à¤£à¤¤à¥‡à¤¹à¥€ à¤ªà¤°à¤¿à¤£à¤¾à¤® à¤†à¤¢à¤³à¤²à¥‡ à¤¨à¤¾à¤¹à¥€à¤¤",
      "loading": "à¤²à¥‹à¤¡ à¤•à¤°à¤¤ à¤†à¤¹à¥‡...",
      "error-occured": "à¤•à¤¾à¤¹à¥€à¤¤à¤°à¥€ à¤šà¥‚à¤• à¤à¤¾à¤²à¥€",
      "retry": "à¤ªà¥à¤¨à¥à¤¹à¤¾ à¤ªà¥à¤°à¤¯à¤¤à¥à¤¨ à¤•à¤°à¤¾",
      "cancel": "à¤°à¤¦à¥à¤¦ à¤•à¤°à¤¾",
      "save": "à¤œà¤¤à¤¨ à¤•à¤°à¤¾",
      "delete": "à¤¹à¤Ÿà¤µà¤¾",
      "confirm": "à¤ªà¥à¤·à¥à¤Ÿà¥€ à¤•à¤°à¤¾",
      "version": "à¤†à¤µà¥ƒà¤¤à¥à¤¤à¥€ 1.0.0",
      "vs": "à¤µà¤¿.à¤¸",
      "play-now": "à¤†à¤¤à¤¾ à¤–à¥‡à¤³à¤¾",
      "live-now": "à¤†à¤¤à¤¾ à¤¥à¥‡à¤Ÿ",
      "app-unlock": "à¥²à¤ªà¤¸à¤¹ à¤…à¤¨à¤²à¥‰à¤• à¤•à¤°à¤¾",
      "promo-join-now": "à¤†à¤¤à¤¾ à¤¸à¤¾à¤®à¥€à¤² à¤µà¥à¤¹à¤¾",
      "match-center-view": "à¤¸à¤¾à¤®à¤¨à¤¾ à¤•à¥‡à¤‚à¤¦à¥à¤° à¤ªà¤¹à¤¾",
      "welcome-subtitle": "à¤¤à¥à¤®à¤šà¤¾ à¤…à¤‚à¤¤à¤¿à¤® à¤•à¥à¤°à¥€à¤¡à¤¾ à¤¸à¤®à¥à¤¦à¤¾à¤¯",
      "communities-title": "à¤šà¤¾à¤¹à¤¤à¤¾ à¤¸à¤®à¥à¤¦à¤¾à¤¯",
      "status-live": "à¤²à¤¾à¤‡à¤µà¥à¤¹",
      "promo-fan-war": "à¤šà¤¾à¤¹à¤¤à¤¾ à¤¯à¥à¤¦à¥à¤§",
      "promo-fan-war-desc": "à¤…à¤‚à¤¤à¤¿à¤® à¤šà¤¾à¤¹à¤¤à¥à¤¯à¤¾à¤‚à¤šà¥à¤¯à¤¾ à¤²à¤¢à¤¾à¤ˆà¤¤ à¤¸à¤¾à¤®à¥€à¤² à¤µà¥à¤¹à¤¾",
      "quiz-title": "à¤•à¥à¤µà¤¿à¤ à¤šà¥…à¤²à¥‡à¤‚à¤œ",
      "quiz-daily-cricket": "à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¥à¤°à¤¿à¤•à¥‡à¤Ÿ à¤•à¥à¤µà¤¿à¤",
      "quiz-description": "à¤¤à¥à¤®à¤šà¥à¤¯à¤¾ à¤•à¥à¤°à¤¿à¤•à¥‡à¤Ÿ à¤œà¥à¤žà¤¾à¤¨à¤¾à¤šà¥€ à¤šà¤¾à¤šà¤£à¥€ à¤˜à¥à¤¯à¤¾",
      "quiz-win": "à¤œà¤¿à¤‚à¤•à¤£à¥‡",
      "predictions-trending": "à¤Ÿà¥à¤°à¥‡à¤‚à¤¡à¤¿à¤‚à¤— à¤…à¤‚à¤¦à¤¾à¤œ",
      "leaderboard-top-fans": "à¤¶à¥€à¤°à¥à¤· à¤šà¤¾à¤¹à¤¤à¥‡",
      "leaderboard-full": "à¤ªà¥‚à¤°à¥à¤£ à¤²à¥€à¤¡à¤°à¤¬à¥‹à¤°à¥à¤¡",
      "time-this-week": "à¤¯à¤¾ à¤†à¤ à¤µà¤¡à¥à¤¯à¤¾à¤¤",
      "stat-earned": "à¤•à¤®à¤¾à¤µà¤²à¥‡",
      "login-title": "à¤ªà¤°à¤¤ à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤†à¤¹à¥‡!",
      "login-email-label": "à¤ˆà¤®à¥‡à¤² à¤•à¤¿à¤‚à¤µà¤¾ à¤µà¤¾à¤ªà¤°à¤•à¤°à¥à¤¤à¤¾à¤¨à¤¾à¤µ",
      "login-email-placeholder": "à¤¤à¥à¤®à¤šà¤¾ à¤ˆà¤®à¥‡à¤² à¤•à¤¿à¤‚à¤µà¤¾ à¤µà¤¾à¤ªà¤°à¤•à¤°à¥à¤¤à¤¾à¤¨à¤¾à¤µ à¤ªà¥à¤°à¤µà¤¿à¤·à¥à¤Ÿ à¤•à¤°à¤¾",
      "login-password-label": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡",
      "login-password-placeholder": "à¤¤à¥à¤®à¤šà¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤Ÿà¤¾à¤•à¤¾",
      "login-submit": "à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¤¾",
      "login-forgot": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤µà¤¿à¤¸à¤°à¤²à¤¾à¤¤?",
      "login-no-account": "à¤–à¤¾à¤¤à¥‡ à¤¨à¤¾à¤¹à¥€?",
      "signup-title": "à¤–à¤¾à¤¤à¥‡ à¤¤à¤¯à¤¾à¤° à¤•à¤°à¤¾",
      "signup-name-label": "à¤ªà¥‚à¤°à¥à¤£ à¤¨à¤¾à¤µ",
      "signup-email-label": "à¤ˆà¤®à¥‡à¤²",
      "signup-password-label": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡",
      "signup-submit": "à¤¸à¤¾à¤‡à¤¨ à¤…à¤ª à¤•à¤°à¤¾",
      "signup-have-account": "à¤†à¤§à¥€à¤š à¤–à¤¾à¤¤à¥‡ à¤†à¤¹à¥‡?",
      "forgot-title": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤°à¥€à¤¸à¥‡à¤Ÿ à¤•à¤°à¤¾",
      "forgot-submit": "à¤°à¥€à¤¸à¥‡à¤Ÿ à¤²à¤¿à¤‚à¤• à¤ªà¤¾à¤ à¤µà¤¾",
      "settings-title": "à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤œ",
      "settings-subtitle": "à¤¤à¥à¤®à¤šà¥€ à¤ªà¥à¤°à¤¾à¤§à¤¾à¤¨à¥à¤¯à¥‡ à¤†à¤£à¤¿ à¤–à¤¾à¤¤à¥‡ à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤œ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤¿à¤¤ à¤•à¤°à¤¾",
      "appearance-title": "à¤¦à¥‡à¤–à¤¾à¤µà¤¾",
      "appearance-subtitle": "FanConnact à¤šà¥‡ à¤¸à¥à¤µà¤°à¥‚à¤ª à¤†à¤£à¤¿ à¤…à¤¨à¥à¤­à¤µ à¤¸à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤•à¤°à¤¾",
      "theme-light": "à¤ªà¥à¤°à¤•à¤¾à¤¶",
      "theme-light-desc": "à¤¸à¥à¤µà¤šà¥à¤› à¤†à¤£à¤¿ à¤¤à¥‡à¤œà¤¸à¥à¤µà¥€",
      "theme-dark": "à¤—à¤¡à¤¦",
      "theme-dark-desc": "à¤¡à¥‹à¤³à¥à¤¯à¤¾à¤‚à¤µà¤° à¤¸à¥‹à¤ªà¥‡",
      "theme-stadium": "à¤¸à¥à¤Ÿà¥‡à¤¡à¤¿à¤¯à¤®",
      "theme-stadium-desc": "à¤–à¥‡à¤³ à¤…à¤¨à¥à¤­à¤µà¤¾",
      "theme-esports": "à¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸",
      "theme-esports-desc": "à¤à¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸ à¤šà¤¾à¤¹à¤¤à¥à¤¯à¤¾à¤‚à¤¸à¤¾à¤ à¥€",
      "theme-royal": "à¤°à¥‰à¤¯à¤² à¤¬à¥à¤²à¥‚",
      "theme-royal-desc": "à¤•à¥à¤²à¤¾à¤¸à¤¿à¤• à¤†à¤£à¤¿ à¤—à¥‹à¤‚à¤¡à¤¸",
      "compact-mode": "à¤•à¥‰à¤®à¥à¤ªà¥…à¤•à¥à¤Ÿ à¤®à¥‹à¤¡",
      "compact-mode-desc": "à¤•à¤®à¥€ à¤œà¤¾à¤—à¥‡à¤¤ à¤…à¤§à¤¿à¤• à¤¸à¤¾à¤®à¤—à¥à¤°à¥€ à¤¦à¤°à¥à¤¶à¤µà¤¾",
      "reduce-animations": "à¥²à¤¨à¤¿à¤®à¥‡à¤¶à¤¨ à¤•à¤®à¥€ à¤•à¤°à¤¾",
      "reduce-animations-desc": "à¤¨à¤¿à¤¤à¤³ à¤…à¤¨à¥à¤­à¤µà¤¾à¤¸à¤¾à¤ à¥€ à¤¹à¤¾à¤²à¤šà¤¾à¤² à¤•à¤®à¥€ à¤•à¤°à¤¾",
      "large-text": "à¤®à¥‹à¤ à¤¾ à¤®à¤œà¤•à¥‚à¤°",
      "large-text-desc": "à¤šà¤¾à¤‚à¤—à¤²à¥à¤¯à¤¾ à¤µà¤¾à¤šà¤¨à¥€à¤¯à¤¤à¥‡à¤¸à¤¾à¤ à¥€ à¤®à¤œà¤•à¥‚à¤° à¤†à¤•à¤¾à¤° à¤µà¤¾à¤¢à¤µà¤¾",
      "sports-title": "à¤•à¥à¤°à¥€à¤¡à¤¾ à¤ªà¥à¤°à¤¾à¤§à¤¾à¤¨à¥à¤¯à¥‡",
      "sports-subtitle": "à¤µà¥ˆà¤¯à¤•à¥à¤¤à¤¿à¤•à¥ƒà¤¤ à¤…à¤¦à¥à¤¯à¤¤à¤¨à¥‡ à¤®à¤¿à¤³à¤µà¤¿à¤£à¥à¤¯à¤¾à¤¸à¤¾à¤ à¥€ à¤¤à¥à¤®à¤šà¥‡ à¤†à¤µà¤¡à¤¤à¥‡ à¤–à¥‡à¤³ à¤¨à¤¿à¤µà¤¡à¤¾",
      "sport-cricket": "à¤•à¥à¤°à¤¿à¤•à¥‡à¤Ÿ",
      "sport-football": "à¤«à¥à¤Ÿà¤¬à¥‰à¤²",
      "sport-basketball": "à¤¬à¤¾à¤¸à¥à¤•à¥‡à¤Ÿà¤¬à¥‰à¤²",
      "sport-tennis": "à¤Ÿà¥‡à¤¨à¤¿à¤¸",
      "sport-hockey": "à¤¹à¥‰à¤•à¥€",
      "sport-kabaddi": "à¤•à¤¬à¤¡à¥à¤¡à¥€",
      "sport-volleyball": "à¤µà¥à¤¹à¥‰à¤²à¥€à¤¬à¥‰à¤²",
      "sport-tabletennis": "à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥‡à¤¨à¤¿à¤¸",
      "sport-esports": "à¤¸à¥à¤ªà¥‹à¤°à¥à¤Ÿà¥à¤¸",
      "sport-baseball": "à¤¬à¥‡à¤¸à¤¬à¥‰à¤²",
      "sport-add-more": "à¤…à¤§à¤¿à¤• à¤–à¥‡à¤³ à¤œà¥‹à¤¡à¤¾",
      "notif-title": "à¤¸à¥‚à¤šà¤¨à¤¾ à¤ªà¥à¤°à¤¾à¤§à¤¾à¤¨à¥à¤¯à¥‡",
      "notif-subtitle": "à¤¤à¥à¤®à¥à¤¹à¤¾à¤²à¤¾ à¤•à¤¾à¤¯ à¤¸à¥‚à¤šà¤¿à¤¤ à¤•à¤°à¤¾à¤¯à¤šà¥‡ à¤†à¤¹à¥‡ à¤¤à¥‡ à¤¨à¤¿à¤µà¤¡à¤¾",
      "notif-live": "à¤¥à¥‡à¤Ÿ à¤¸à¤¾à¤®à¤¨à¤¾ à¤¸à¥‚à¤šà¤¨à¤¾",
      "notif-news": "à¤¬à¥à¤°à¥‡à¤•à¤¿à¤‚à¤— à¤¨à¥à¤¯à¥‚à¤œ",
      "notif-predictions": "à¤…à¤‚à¤¦à¤¾à¤œ à¤ªà¤°à¤¿à¤£à¤¾à¤®",
      "notif-community": "à¤¸à¤®à¥à¤¦à¤¾à¤¯ à¤…à¤¦à¥à¤¯à¤¤à¤¨à¥‡",
      "notif-email": "à¤ˆà¤®à¥‡à¤² à¤¸à¥‚à¤šà¤¨à¤¾",
      "notif-push": "à¤ªà¥à¤¶ à¤¸à¥‚à¤šà¤¨à¤¾",
      "notif-mentions": "à¤‰à¤²à¥à¤²à¥‡à¤– à¤†à¤£à¤¿ à¤ªà¥à¤°à¤¤à¥à¤¯à¥à¤¤à¥à¤¤à¤°à¥‡",
      "notif-followers": "à¤¨à¤µà¥€à¤¨ à¤…à¤¨à¥à¤¯à¤¾à¤¯à¥€",
      "security-title": "à¤¸à¥à¤°à¤•à¥à¤·à¤¾",
      "security-subtitle": "à¤¤à¥à¤®à¤šà¥‡ à¤–à¤¾à¤¤à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤†à¤£à¤¿ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤ à¥‡à¤µà¤¾",
      "security-google": "Google",
      "security-facebook": "à¤«à¥‡à¤¸à¤¬à¥à¤•",
      "security-connected": "à¤œà¥‹à¤¡à¤²à¥‡à¤²à¥‡",
      "security-change-password": "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¬à¤¦à¤²à¤¾",
      "security-2fa": "à¤¦à¥‹à¤¨-à¤˜à¤Ÿà¤• à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¤°à¤£",
      "security-2fa-on": "à¤šà¤¾à¤²à¥‚",
      "security-2fa-off": "à¤¬à¤‚à¤¦",
      "security-logout-all": "à¤¸à¤°à¥à¤µ à¤‰à¤ªà¤•à¤°à¤£à¥‡ à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ à¤•à¤°à¤¾",
      "lang-title": "à¤­à¤¾à¤·à¤¾ à¤†à¤£à¤¿ à¤ªà¥à¤°à¤¦à¥‡à¤¶",
      "lang-subtitle": "à¤¤à¥à¤®à¤šà¥€ à¤­à¤¾à¤·à¤¾ à¤†à¤£à¤¿ à¤ªà¥à¤°à¤¦à¥‡à¤¶ à¤ªà¥à¤°à¤¾à¤§à¤¾à¤¨à¥à¤¯à¥‡ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤¿à¤¤ à¤•à¤°à¤¾",
      "lang-language": "à¤­à¤¾à¤·à¤¾",
      "lang-timezone": "à¤Ÿà¤¾à¤‡à¤®à¤à¥‹à¤¨",
      "lang-region": "à¤ªà¥à¤°à¤¦à¥‡à¤¶",
      "support-title": "à¤¸à¤®à¤°à¥à¤¥à¤¨ à¤†à¤£à¤¿ à¤¬à¤¦à¥à¤¦à¤²",
      "support-subtitle": "à¤®à¤¦à¤¤, à¤…à¤­à¤¿à¤ªà¥à¤°à¤¾à¤¯ à¤†à¤£à¤¿ à¥²à¤ª à¤®à¤¾à¤¹à¤¿à¤¤à¥€",
      "support-report-bug": "à¤¦à¥‹à¤· à¤¨à¥‹à¤‚à¤¦à¤µà¤¾",
      "support-feedback": "à¤…à¤­à¤¿à¤ªà¥à¤°à¤¾à¤¯ à¤ªà¤¾à¤ à¤µà¤¾",
      "support-contact": "à¤¸à¤ªà¥‹à¤°à¥à¤Ÿà¤¶à¥€ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤¸à¤¾à¤§à¤¾",
      "support-privacy": "à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾ à¤§à¥‹à¤°à¤£",
      "support-terms": "à¤¨à¤¿à¤¯à¤® à¤†à¤£à¤¿ à¤…à¤Ÿà¥€",
      "profile-title": "à¤ªà¥à¤°à¥‹à¤«à¤¾à¤‡à¤²",
      "profile-edit": "à¤ªà¥à¤°à¥‹à¤«à¤¾à¤‡à¤² à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤ à¤•à¤°à¤¾",
      "profile-level": "à¤ªà¤¾à¤¤à¤³à¥€",
      "profile-achievements": "à¤‰à¤ªà¤²à¤¬à¥à¤§à¥€",
      "profile-recent-activity": "à¤…à¤²à¥€à¤•à¤¡à¥€à¤² à¤•à¥à¤°à¤¿à¤¯à¤¾à¤•à¤²à¤¾à¤ª",
      "profile-identity": "à¤“à¤³à¤– à¤¤à¤ªà¤¶à¥€à¤²",
      "profile-fullname": "à¤ªà¥‚à¤°à¥à¤£ à¤¨à¤¾à¤µ",
      "profile-username": "à¤µà¤¾à¤ªà¤°à¤•à¤°à¥à¤¤à¤¾à¤¨à¤¾à¤µ",
      "profile-gender": "à¤²à¤¿à¤‚à¤—",
      "profile-dob": "à¤œà¤¨à¥à¤®à¤¤à¤¾à¤°à¥€à¤–",
      "profile-contact": "à¤¸à¤‚à¤ªà¤°à¥à¤• à¤®à¤¾à¤¹à¤¿à¤¤à¥€",
      "profile-email": "à¤ˆà¤®à¥‡à¤²",
      "profile-mobile": "à¤®à¥‹à¤¬à¤¾à¤ˆà¤²",
      "profile-location": "à¤¸à¥à¤¥à¤¾à¤¨",
      "profile-save": "à¤¬à¤¦à¤² à¤œà¤¤à¤¨ à¤•à¤°à¤¾",
      "profile-cancel": "à¤°à¤¦à¥à¤¦ à¤•à¤°à¤¾",
      "profile-signout": "à¤–à¤¾à¤¤à¥‡ à¤¸à¤¾à¤‡à¤¨ à¤†à¤‰à¤Ÿ à¤•à¤°à¤¾",
      "stats-total-predictions": "à¤à¤•à¥‚à¤£ à¤…à¤‚à¤¦à¤¾à¤œ",
      "stats-win-rate": "à¤œà¤¿à¤‚à¤•à¤£à¥à¤¯à¤¾à¤šà¤¾ à¤¦à¤° %",
      "stats-xp-progress": "XP à¤ªà¥à¤°à¤—à¤¤à¥€",
      "stats-global-rank": "à¤œà¤¾à¤—à¤¤à¤¿à¤• à¤°à¤à¤•",
      "fancoin-title": "à¤«à¥…à¤¨à¤•à¥‰à¤‡à¤¨ à¤µà¥‰à¤²à¥‡à¤Ÿ",
      "fancoin-balance": "à¤¶à¤¿à¤²à¥à¤²à¤•",
      "fancoin-earn": "à¤¨à¤¾à¤£à¥€ à¤®à¤¿à¤³à¤µà¤¾",
      "fancoin-history": "à¤µà¥à¤¯à¤µà¤¹à¤¾à¤° à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸",
      "fancoin-tagline": "à¤¨à¤¾à¤£à¥€ à¤®à¤¿à¤³à¤µà¤¾.",
      "fancoin-ways": "à¤«à¥…à¤¨ à¤¨à¤¾à¤£à¥€ à¤®à¤¿à¤³à¤µà¤¿à¤£à¥à¤¯à¤¾à¤šà¥‡ à¤®à¤¾à¤°à¥à¤—",
      "fancoin-streak": "à¤¡à¥‡ à¤¸à¥à¤Ÿà¥à¤°à¥€à¤•",
      "view-wallet": "à¤µà¥‰à¤²à¥‡à¤Ÿ à¤ªà¤¹à¤¾",
      "earn-daily-quiz-title": "à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¥à¤µà¤¿à¤",
      "earn-prediction-title": "à¤œà¥à¤³à¤£à¥€ à¤…à¤‚à¤¦à¤¾à¤œ",
      "earn-community-title": "à¤¸à¤®à¥à¤¦à¤¾à¤¯ à¤•à¥à¤°à¤¿à¤¯à¤¾à¤•à¤²à¤¾à¤ª",
      "earn-fanwar-title": "à¤šà¤¾à¤¹à¤¤à¤¾ à¤¯à¥à¤¦à¥à¤§",
      "earn-daily-quiz-desc": "à¤¦à¤°à¤°à¥‹à¤œ à¤•à¥à¤µà¤¿à¤ à¤ªà¥à¤°à¤¶à¥à¤¨à¤¾à¤‚à¤šà¥€ à¤‰à¤¤à¥à¤¤à¤°à¥‡ à¤¦à¥à¤¯à¤¾ à¤†à¤£à¤¿ à¤¨à¤¾à¤£à¥€ à¤®à¤¿à¤³à¤µà¤¾",
      "earn-prediction-desc": "à¤¸à¤¾à¤®à¤¨à¥à¤¯à¤¾à¤šà¥à¤¯à¤¾ à¤¨à¤¿à¤•à¤¾à¤²à¤¾à¤‚à¤šà¤¾ à¤…à¤šà¥‚à¤• à¤…à¤‚à¤¦à¤¾à¤œ à¤²à¤¾à¤µà¤¾",
      "earn-community-desc": "à¤¤à¥à¤®à¤šà¥à¤¯à¤¾ à¤šà¤¾à¤¹à¤¤à¥à¤¯à¤¾à¤‚à¤šà¥à¤¯à¤¾ à¤¸à¤®à¥à¤¦à¤¾à¤¯à¤¾à¤‚à¤®à¤§à¥à¤¯à¥‡ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤°à¤¹à¤¾",
      "earn-fanwar-desc": "à¤šà¤¾à¤¹à¤¤à¥à¤¯à¤¾à¤‚à¤šà¥à¤¯à¤¾ à¤²à¤¢à¤¾à¤ˆà¤¤ à¤¸à¤¹à¤­à¤¾à¤—à¥€ à¤µà¥à¤¹à¤¾",
      "level-bronze": "à¤•à¤¾à¤‚à¤¸à¥à¤¯ à¤ªà¤‚à¤–à¤¾",
      "level-silver": "à¤šà¤¾à¤‚à¤¦à¥€à¤šà¤¾ à¤ªà¤‚à¤–à¤¾",
      "level-gold": "à¤¸à¥‹à¤¨à¥à¤¯à¤¾à¤šà¤¾ à¤ªà¤‚à¤–à¤¾",
      "level-diamond": "à¤¡à¤¾à¤¯à¤®à¤‚à¤¡ à¤«à¥…à¤¨",
      "level-next": "à¤šà¤¾à¤²à¥‚ à¤ à¥‡à¤µà¤¾!",
      "level-benefits": "à¤¸à¥à¤¤à¤° à¤²à¤¾à¤­",
      "benefit-exclusive": "à¤…à¤¨à¤¨à¥à¤¯ à¤¸à¤¾à¤®à¤—à¥à¤°à¥€",
      "benefit-early-access": "à¤²à¤µà¤•à¤° à¤ªà¥à¤°à¤µà¥‡à¤¶",
      "benefit-badges": "à¤µà¤¿à¤¶à¥‡à¤· à¤¬à¥…à¤œ",
      "news-title": "à¤¬à¤¾à¤¤à¤®à¥à¤¯à¤¾ à¤†à¤£à¤¿ à¤…à¤ªà¤¡à¥‡à¤Ÿà¥à¤¸",
      "news-latest": "à¤¤à¤¾à¤œà¥à¤¯à¤¾ à¤¬à¤¾à¤¤à¤®à¥à¤¯à¤¾",
      "matches-title": "à¤¥à¥‡à¤Ÿ à¤¸à¤¾à¤®à¤¨à¥‡",
      "matches-upcoming": "à¤†à¤—à¤¾à¤®à¥€",
      "matches-live": "à¤²à¤¾à¤‡à¤µà¥à¤¹",
      "matches-completed": "à¤ªà¥‚à¤°à¥à¤£ à¤à¤¾à¤²à¥‡",
      "footer-copyright": "Â© 2024 FanConnact.",
      "theme-toggle-label": "à¤¥à¥€à¤® à¤Ÿà¥‰à¤—à¤² à¤•à¤°à¤¾",
    },
  es: {
      "nav-home": "Hogar",
      "nav-news": "Noticias",
      "nav-matches": "Partidos",
      "nav-communities": "Comunidades",
      "nav-leaderboard": "Tabla de clasificaciÃ³n",
      "nav-live": "Partidos en vivo",
      "nav-settings": "Ajustes",
      "nav-profile": "Perfil",
      "nav-notifications": "Notificaciones",
      "nav-logout": "Cerrar sesiÃ³n",
      "nav-login": "Acceso",
      "nav-signup": "Inscribirse",
      "nav-back": "AtrÃ¡s",
      "nav-global": "Global",
      "nav-player-zone": "Zona de jugador",
      "nav-predictions": "Predicciones",
      "welcome-guest": "Â¡Bienvenido, invitado!",
      "welcome-back": "Bienvenido de nuevo,",
      "search-placeholder": "Buscar...",
      "view-all": "Ver todo",
      "see-more": "Ver mÃ¡s",
      "no-results": "No se encontraron resultados",
      "loading": "Cargando...",
      "error-occured": "algo saliÃ³ mal",
      "retry": "Rever",
      "cancel": "Cancelar",
      "save": "Ahorrar",
      "delete": "Borrar",
      "confirm": "Confirmar",
      "version": "VersiÃ³n 1.0.0",
      "vs": "VS",
      "play-now": "Jugar ahora",
      "live-now": "VIVE AHORA",
      "app-unlock": "Desbloquear con la aplicaciÃ³n",
      "promo-join-now": "Ãšnete ahora",
      "match-center-view": "Ver centro de partidos",
      "welcome-subtitle": "Tu comunidad deportiva definitiva",
      "communities-title": "Comunidades de fans",
      "status-live": "Vivir",
      "promo-fan-war": "Guerra de fans",
      "promo-fan-war-desc": "Ãšnete a la batalla definitiva de fans",
      "quiz-title": "DesafÃ­o de prueba",
      "quiz-daily-cricket": "Prueba diaria de crÃ­quet",
      "quiz-description": "Pon a prueba tus conocimientos de cricket",
      "quiz-win": "Ganar",
      "predictions-trending": "Predicciones de tendencia",
      "leaderboard-top-fans": "FanÃ¡ticos principales",
      "leaderboard-full": "Tabla de clasificaciÃ³n completa",
      "time-this-week": "Esta semana",
      "stat-earned": "Ganado",
      "login-title": "Â¡Bienvenido de nuevo!",
      "login-email-label": "Correo electrÃ³nico o nombre de usuario",
      "login-email-placeholder": "Introduce tu correo electrÃ³nico o nombre de usuario",
      "login-password-label": "ContraseÃ±a",
      "login-password-placeholder": "Introduce tu contraseÃ±a",
      "login-submit": "Acceso",
      "login-forgot": "Â¿Has olvidado tu contraseÃ±a?",
      "login-no-account": "Â¿No tienes una cuenta?",
      "signup-title": "Crear una cuenta",
      "signup-name-label": "Nombre completo",
      "signup-email-label": "Correo electrÃ³nico",
      "signup-password-label": "ContraseÃ±a",
      "signup-submit": "Inscribirse",
      "signup-have-account": "Â¿Ya tienes una cuenta?",
      "forgot-title": "Restablecer contraseÃ±a",
      "forgot-submit": "Enviar enlace de reinicio",
      "settings-title": "Ajustes",
      "settings-subtitle": "Administre sus preferencias y configuraciÃ³n de cuenta",
      "appearance-title": "Apariencia",
      "appearance-subtitle": "Personaliza la apariencia de FanConnact",
      "theme-light": "Luz",
      "theme-light-desc": "Limpio y brillante",
      "theme-dark": "Oscuro",
      "theme-dark-desc": "Agradable a la vista",
      "theme-stadium": "Estadio",
      "theme-stadium-desc": "Siente el juego",
      "theme-esports": "Deportes electrÃ³nicos",
      "theme-esports-desc": "Para fanÃ¡ticos de los deportes electrÃ³nicos",
      "theme-royal": "azul real",
      "theme-royal-desc": "ClÃ¡sico y elegante",
      "compact-mode": "Modo compacto",
      "compact-mode-desc": "Mostrar mÃ¡s contenido en menos espacio",
      "reduce-animations": "Reducir animaciones",
      "reduce-animations-desc": "Reduzca el movimiento para una experiencia mÃ¡s fluida",
      "large-text": "Texto grande",
      "large-text-desc": "Aumente el tamaÃ±o del texto para una mejor legibilidad",
      "sports-title": "Preferencias deportivas",
      "sports-subtitle": "Selecciona tus deportes favoritos para recibir actualizaciones personalizadas",
      "sport-cricket": "Cricket",
      "sport-football": "FÃºtbol americano",
      "sport-basketball": "Baloncesto",
      "sport-tennis": "Tenis",
      "sport-hockey": "Hockey",
      "sport-kabaddi": "Kabaddi",
      "sport-volleyball": "Voleibol",
      "sport-tabletennis": "Tenis de mesa",
      "sport-esports": "Deportes electrÃ³nicos",
      "sport-baseball": "BÃ©isbol",
      "sport-add-more": "AÃ±adir mÃ¡s deportes",
      "notif-title": "Preferencias de notificaciÃ³n",
      "notif-subtitle": "Elige sobre quÃ© quieres recibir notificaciones",
      "notif-live": "Alertas de partidos en vivo",
      "notif-news": "Noticias de Ãºltima hora",
      "notif-predictions": "Resultados de predicciÃ³n",
      "notif-community": "Actualizaciones de la comunidad",
      "notif-email": "Notificaciones por correo electrÃ³nico",
      "notif-push": "Notificaciones push",
      "notif-mentions": "Menciones y respuestas",
      "notif-followers": "Nuevos seguidores",
      "security-title": "Seguridad",
      "security-subtitle": "Mantenga su cuenta segura y protegida",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "Conectado",
      "security-change-password": "Cambiar la contraseÃ±a",
      "security-2fa": "AutenticaciÃ³n de dos factores",
      "security-2fa-on": "En",
      "security-2fa-off": "Apagado",
      "security-logout-all": "Cerrar sesiÃ³n en todos los dispositivos",
      "lang-title": "Idioma y regiÃ³n",
      "lang-subtitle": "Administre sus preferencias de idioma y regiÃ³n",
      "lang-language": "Idioma",
      "lang-timezone": "Zona horaria",
      "lang-region": "RegiÃ³n",
      "support-title": "Soporte y acerca de",
      "support-subtitle": "Ayuda, comentarios e informaciÃ³n de la aplicaciÃ³n",
      "support-report-bug": "Informar error",
      "support-feedback": "Enviar comentarios",
      "support-contact": "Contactar con soporte",
      "support-privacy": "polÃ­tica de privacidad",
      "support-terms": "TÃ©rminos y condiciones",
      "profile-title": "Perfil",
      "profile-edit": "Editar perfil",
      "profile-level": "Nivel",
      "profile-achievements": "Logros",
      "profile-recent-activity": "Actividad reciente",
      "profile-identity": "Detalles de identidad",
      "profile-fullname": "Nombre completo",
      "profile-username": "Nombre de usuario",
      "profile-gender": "GÃ©nero",
      "profile-dob": "Fecha de nacimiento",
      "profile-contact": "InformaciÃ³n de contacto",
      "profile-email": "Correo electrÃ³nico",
      "profile-mobile": "MÃ³vil",
      "profile-location": "UbicaciÃ³n",
      "profile-save": "Guardar cambios",
      "profile-cancel": "Cancelar",
      "profile-signout": "Cerrar sesiÃ³n en la cuenta",
      "stats-total-predictions": "Predicciones totales",
      "stats-win-rate": "% de tasa de ganancia",
      "stats-xp-progress": "Progreso de XP",
      "stats-global-rank": "ClasificaciÃ³n global",
      "fancoin-title": "Monedero FanCoin",
      "fancoin-balance": "Balance",
      "fancoin-earn": "ganar monedas",
      "fancoin-history": "Historial de transacciones",
      "fancoin-tagline": "Gana monedas.",
      "fancoin-ways": "Formas de ganar Fan Coins",
      "fancoin-streak": "Racha del dÃ­a",
      "view-wallet": "Ver billetera",
      "earn-daily-quiz-title": "Prueba diaria",
      "earn-prediction-title": "PredicciÃ³n del partido",
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
      "level-next": "Â¡Sigue adelante!",
      "level-benefits": "Beneficios de nivel",
      "benefit-exclusive": "Contenido exclusivo",
      "benefit-early-access": "Acceso temprano",
      "benefit-badges": "Insignias especiales",
      "news-title": "Noticias y actualizaciones",
      "news-latest": "Ãšltimas noticias",
      "matches-title": "Partidos en vivo",
      "matches-upcoming": "PrÃ³ximo",
      "matches-live": "VIVIR",
      "matches-completed": "Terminado",
      "footer-copyright": "Â© 2024 FanConnact.",
      "theme-toggle-label": "Alternar tema",
    },
  fr: {
      "nav-home": "Maison",
      "nav-news": "Nouvelles",
      "nav-matches": "Matchs",
      "nav-communities": "CommunautÃ©s",
      "nav-leaderboard": "Classement",
      "nav-live": "Matchs en direct",
      "nav-settings": "ParamÃ¨tres",
      "nav-profile": "Profil",
      "nav-notifications": "Notifications",
      "nav-logout": "DÃ©connexion",
      "nav-login": "Se connecter",
      "nav-signup": "S'inscrire",
      "nav-back": "Dos",
      "nav-global": "Mondial",
      "nav-player-zone": "Espace Joueur",
      "nav-predictions": "PrÃ©dictions",
      "welcome-guest": "Bienvenue, invitÃ© !",
      "welcome-back": "Content de te revoir,",
      "search-placeholder": "Recherche...",
      "view-all": "Tout afficher",
      "see-more": "Voir plus",
      "no-results": "Aucun rÃ©sultat trouvÃ©",
      "loading": "Chargement...",
      "error-occured": "Quelque chose s'est mal passÃ©",
      "retry": "RÃ©essayer",
      "cancel": "Annuler",
      "save": "Sauvegarder",
      "delete": "Supprimer",
      "confirm": "Confirmer",
      "version": "Version 1.0.0",
      "vs": "CONTRE",
      "play-now": "Jouez maintenant",
      "live-now": "EN DIRECT MAINTENANT",
      "app-unlock": "DÃ©verrouiller avec l'application",
      "promo-join-now": "Inscrivez-vous maintenant",
      "match-center-view": "Voir le centre de correspondance",
      "welcome-subtitle": "Votre communautÃ© sportive ultime",
      "communities-title": "CommunautÃ©s de fans",
      "status-live": "En direct",
      "promo-fan-war": "Guerre des fans",
      "promo-fan-war-desc": "Rejoignez la bataille de fans ultime",
      "quiz-title": "DÃ©fi Quiz",
      "quiz-daily-cricket": "Quiz quotidien sur le cricket",
      "quiz-description": "Testez vos connaissances sur le cricket",
      "quiz-win": "Gagner",
      "predictions-trending": "PrÃ©dictions de tendances",
      "leaderboard-top-fans": "Meilleurs fans",
      "leaderboard-full": "Classement complet",
      "time-this-week": "Cette semaine",
      "stat-earned": "GagnÃ©",
      "login-title": "Content de te revoir!",
      "login-email-label": "E-mail ou nom d'utilisateur",
      "login-email-placeholder": "Entrez votre email ou votre nom d'utilisateur",
      "login-password-label": "Mot de passe",
      "login-password-placeholder": "Entrez votre mot de passe",
      "login-submit": "Se connecter",
      "login-forgot": "Mot de passe oubliÃ© ?",
      "login-no-account": "Vous n'avez pas de compte ?",
      "signup-title": "CrÃ©er un compte",
      "signup-name-label": "Nom et prÃ©nom",
      "signup-email-label": "E-mail",
      "signup-password-label": "Mot de passe",
      "signup-submit": "S'inscrire",
      "signup-have-account": "Vous avez dÃ©jÃ  un compte ?",
      "forgot-title": "RÃ©initialiser le mot de passe",
      "forgot-submit": "Envoyer le lien de rÃ©initialisation",
      "settings-title": "ParamÃ¨tres",
      "settings-subtitle": "GÃ©rer vos prÃ©fÃ©rences et paramÃ¨tres de compte",
      "appearance-title": "Apparence",
      "appearance-subtitle": "Personnalisez l'apparence et la convivialitÃ© de FanConnact",
      "theme-light": "LumiÃ¨re",
      "theme-light-desc": "Propre et lumineux",
      "theme-dark": "Sombre",
      "theme-dark-desc": "AgrÃ©able pour les yeux",
      "theme-stadium": "Stade",
      "theme-stadium-desc": "Ressentez le jeu",
      "theme-esports": "E-sport",
      "theme-esports-desc": "Pour les fans d'e-sport",
      "theme-royal": "Bleu roi",
      "theme-royal-desc": "Classique et Ã©lÃ©gant",
      "compact-mode": "Mode compact",
      "compact-mode-desc": "Afficher plus de contenu dans moins d'espace",
      "reduce-animations": "RÃ©duire les animations",
      "reduce-animations-desc": "RÃ©duisez les mouvements pour une expÃ©rience plus fluide",
      "large-text": "Grand texte",
      "large-text-desc": "Augmentez la taille du texte pour une meilleure lisibilitÃ©",
      "sports-title": "PrÃ©fÃ©rences sportives",
      "sports-subtitle": "SÃ©lectionnez vos sports prÃ©fÃ©rÃ©s pour obtenir des mises Ã  jour personnalisÃ©es",
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
      "notif-title": "PrÃ©fÃ©rences de notifications",
      "notif-subtitle": "Choisissez ce dont vous souhaitez Ãªtre informÃ©",
      "notif-live": "Alertes de match en direct",
      "notif-news": "DerniÃ¨res nouvelles",
      "notif-predictions": "RÃ©sultats de prÃ©diction",
      "notif-community": "Mises Ã  jour de la communautÃ©",
      "notif-email": "Notifications par courrier Ã©lectronique",
      "notif-push": "Notifications poussÃ©es",
      "notif-mentions": "Mentions et rÃ©ponses",
      "notif-followers": "Nouveaux abonnÃ©s",
      "security-title": "SÃ©curitÃ©",
      "security-subtitle": "Gardez votre compte en sÃ©curitÃ©",
      "security-google": "Google",
      "security-facebook": "Facebook",
      "security-connected": "ConnectÃ©",
      "security-change-password": "Changer le mot de passe",
      "security-2fa": "Authentification Ã  deux facteurs",
      "security-2fa-on": "Sur",
      "security-2fa-off": "DÃ©sactivÃ©",
      "security-logout-all": "DÃ©connecter tous les appareils",
      "lang-title": "Langue et rÃ©gion",
      "lang-subtitle": "GÃ©rez vos prÃ©fÃ©rences de langue et de rÃ©gion",
      "lang-language": "Langue",
      "lang-timezone": "Fuseau horaire",
      "lang-region": "RÃ©gion",
      "support-title": "Assistance et Ã  propos",
      "support-subtitle": "Aide, commentaires et informations sur l'application",
      "support-report-bug": "Signaler un bug",
      "support-feedback": "Envoyer des commentaires",
      "support-contact": "Contacter l'assistance",
      "support-privacy": "politique de confidentialitÃ©",
      "support-terms": "Conditions gÃ©nÃ©rales",
      "profile-title": "Profil",
      "profile-edit": "Modifier le profil",
      "profile-level": "Niveau",
      "profile-achievements": "RÃ©alisations",
      "profile-recent-activity": "ActivitÃ© rÃ©cente",
      "profile-identity": "DÃ©tails d'identitÃ©",
      "profile-fullname": "Nom et prÃ©nom",
      "profile-username": "Nom d'utilisateur",
      "profile-gender": "Genre",
      "profile-dob": "Date de naissance",
      "profile-contact": "CoordonnÃ©es",
      "profile-email": "E-mail",
      "profile-mobile": "Mobile",
      "profile-location": "Emplacement",
      "profile-save": "Enregistrer les modifications",
      "profile-cancel": "Annuler",
      "profile-signout": "Se dÃ©connecter du compte",
      "stats-total-predictions": "PrÃ©dictions totales",
      "stats-win-rate": "Taux de victoire %",
      "stats-xp-progress": "Progression XP",
      "stats-global-rank": "Classement mondial",
      "fancoin-title": "Portefeuille FanCoin",
      "fancoin-balance": "Ã‰quilibre",
      "fancoin-earn": "Gagnez des piÃ¨ces",
      "fancoin-history": "Historique des transactions",
      "fancoin-tagline": "Gagnez des piÃ¨ces.",
      "fancoin-ways": "FaÃ§ons de gagner des piÃ¨ces de fans",
      "fancoin-streak": "SÃ©rie d'une journÃ©e",
      "view-wallet": "Voir le portefeuille",
      "earn-daily-quiz-title": "Quiz quotidien",
      "earn-prediction-title": "PrÃ©diction du match",
      "earn-community-title": "ActivitÃ© communautaire",
      "earn-fanwar-title": "Guerre des fans",
      "earn-daily-quiz-desc": "RÃ©pondez aux questions du quiz quotidien et gagnez des piÃ¨ces",
      "earn-prediction-desc": "PrÃ©dire correctement les rÃ©sultats des matchs",
      "earn-community-desc": "Restez actif dans vos communautÃ©s de fans",
      "earn-fanwar-desc": "Participez Ã  des batailles de fans",
      "level-bronze": "Ã‰ventail en bronze",
      "level-silver": "Ã‰ventail en argent",
      "level-gold": "Ã‰ventail d'or",
      "level-diamond": "Ã‰ventail de diamants",
      "level-next": "Continue!",
      "level-benefits": "Avantages de niveau",
      "benefit-exclusive": "Contenu exclusif",
      "benefit-early-access": "AccÃ¨s anticipÃ©",
      "benefit-badges": "Insignes spÃ©ciaux",
      "news-title": "Nouvelles et mises Ã  jour",
      "news-latest": "DerniÃ¨res nouvelles",
      "matches-title": "Matchs en direct",
      "matches-upcoming": "Prochain",
      "matches-live": "EN DIRECT",
      "matches-completed": "ComplÃ©tÃ©",
      "footer-copyright": "Â© 2024 FanConnact.",
      "theme-toggle-label": "Changer de thÃ¨me",
    },
  ar: {
      "nav-home": "Ø¨ÙŠØª",
      "nav-news": "Ø£Ø®Ø¨Ø§Ø±",
      "nav-matches": "Ù…Ø¨Ø§Ø±ÙŠØ§Øª",
      "nav-communities": "Ø§Ù„Ù…Ø¬ØªÙ…Ø¹Ø§Øª",
      "nav-leaderboard": "Ø§Ù„Ù…ØªØµØ¯Ø±ÙŠÙ†",
      "nav-live": "Ø§Ù„Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ø§Ù„Ø­ÙŠØ©",
      "nav-settings": "Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª",
      "nav-profile": "Ø­Ø³Ø§Ø¨ ØªØ¹Ø±ÙŠÙÙŠ",
      "nav-notifications": "Ø¥Ø´Ø¹Ø§Ø±Ø§Øª",
      "nav-logout": "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬",
      "nav-login": "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
      "nav-signup": "Ø§Ø´ØªØ±Ø§Ùƒ",
      "nav-back": "Ø®Ù„Ù",
      "nav-global": "Ø¹Ø§Ù„Ù…ÙŠ",
      "nav-player-zone": "Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ù„Ø§Ø¹Ø¨",
      "nav-predictions": "Ø§Ù„ØªÙ†Ø¨Ø¤Ø§Øª",
      "welcome-guest": "Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø£ÙŠÙ‡Ø§ Ø§Ù„Ø¶ÙŠÙ!",
      "welcome-back": "Ù…Ø±Ø­Ø¨Ù‹Ø§ Ø¨Ø¹ÙˆØ¯ØªÙƒØŒ",
      "search-placeholder": "ÙŠØ¨Ø­Ø«...",
      "view-all": "Ø¹Ø±Ø¶ Ø§Ù„ÙƒÙ„",
      "see-more": "Ø´Ø§Ù‡Ø¯ Ø§Ù„Ù…Ø²ÙŠØ¯",
      "no-results": "Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬",
      "loading": "ØªØ­Ù…ÙŠÙ„...",
      "error-occured": "Ø­Ø¯Ø« Ø®Ø·Ø£ Ù…Ø§",
      "retry": "Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©",
      "cancel": "ÙŠÙ„ØºÙŠ",
      "save": "ÙŠØ­ÙØ¸",
      "delete": "ÙŠÙ…Ø³Ø­",
      "confirm": "ÙŠØªØ£ÙƒØ¯",
      "version": "Ø§Ù„Ø¥ØµØ¯Ø§Ø± 1.0.0",
      "vs": "Ù…Ù‚Ø§Ø¨Ù„",
      "play-now": "Ø§Ù„Ø¹Ø¨ Ø§Ù„Ø¢Ù†",
      "live-now": "Ø¹Ø´ Ø§Ù„Ø¢Ù†",
      "app-unlock": "ÙØªØ­ Ù…Ø¹ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚",
      "promo-join-now": "Ø§Ù†Ø¶Ù… Ø§Ù„Ø¢Ù†",
      "match-center-view": "Ø¹Ø±Ø¶ Ù…Ø±ÙƒØ² Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©",
      "welcome-subtitle": "Ù…Ø¬ØªÙ…Ø¹Ùƒ Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      "communities-title": "Ù…Ø¬ØªÙ…Ø¹Ø§Øª Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ†",
      "status-live": "ÙŠØ¹ÙŠØ´",
      "promo-fan-war": "Ø­Ø±Ø¨ Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ†",
      "promo-fan-war-desc": "Ø§Ù†Ø¶Ù… Ø¥Ù„Ù‰ Ù…Ø¹Ø±ÙƒØ© Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ† Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠØ©",
      "quiz-title": "Ø§Ù„ØªØ­Ø¯ÙŠ Ù…Ø³Ø§Ø¨Ù‚Ø©",
      "quiz-daily-cricket": "Ù…Ø³Ø§Ø¨Ù‚Ø© Ø§Ù„ÙƒØ±ÙŠÙƒÙŠØª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©",
      "quiz-description": "Ø§Ø®ØªØ¨Ø± Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙƒ ÙÙŠ Ù„Ø¹Ø¨Ø© Ø§Ù„ÙƒØ±ÙŠÙƒÙŠØª",
      "quiz-win": "ÙŠÙÙˆØ²",
      "predictions-trending": "ØªØªØ¬Ù‡ Ø§Ù„ØªÙˆÙ‚Ø¹Ø§Øª",
      "leaderboard-top-fans": "Ø£Ù‡Ù… Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ†",
      "leaderboard-full": "Ø§Ù„Ù…ØªØµØ¯Ø±ÙŠÙ† Ø§Ù„ÙƒØ§Ù…Ù„Ø©",
      "time-this-week": "Ù‡Ø°Ø§ Ø§Ù„Ø§Ø³Ø¨ÙˆØ¹",
      "stat-earned": "Ø­ØµÙ„",
      "login-title": "Ù…Ø±Ø­Ø¨Ù‹Ø§ Ø¨Ø¹ÙˆØ¯ØªÙƒ!",
      "login-email-label": "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø£Ùˆ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…",
      "login-email-placeholder": "Ø£Ø¯Ø®Ù„ Ø¨Ø±ÙŠØ¯Ùƒ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø£Ùˆ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…",
      "login-password-label": "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
      "login-password-placeholder": "Ø£Ø¯Ø®Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø®Ø§ØµØ© Ø¨Ùƒ",
      "login-submit": "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
      "login-forgot": "Ù‡Ù„ Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø±ØŸ",
      "login-no-account": "Ù„ÙŠØ³ Ù„Ø¯ÙŠÙƒ Ø­Ø³Ø§Ø¨ØŸ",
      "signup-title": "Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨",
      "signup-name-label": "Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„",
      "signup-email-label": "Ø¨Ø±ÙŠØ¯ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      "signup-password-label": "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
      "signup-submit": "Ø§Ø´ØªØ±Ø§Ùƒ",
      "signup-have-account": "Ù‡Ù„ Ù„Ø¯ÙŠÙƒ Ø­Ø³Ø§Ø¨ Ø¨Ø§Ù„ÙØ¹Ù„ØŸ",
      "forgot-title": "Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
      "forgot-submit": "Ø£Ø±Ø³Ù„ Ø±Ø§Ø¨Ø· Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ø¶Ø¨Ø·",
      "settings-title": "Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª",
      "settings-subtitle": "Ø¥Ø¯Ø§Ø±Ø© ØªÙØ¶ÙŠÙ„Ø§ØªÙƒ ÙˆØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨",
      "appearance-title": "Ù…Ø¸Ù‡Ø±",
      "appearance-subtitle": "Ù‚Ù… Ø¨ØªØ®ØµÙŠØµ Ø´ÙƒÙ„ ÙˆÙ…Ø¸Ù‡Ø± FanConnact",
      "theme-light": "Ø¶ÙˆØ¡",
      "theme-light-desc": "Ù†Ø¸ÙŠÙØ© ÙˆÙ…Ø´Ø±Ù‚Ø©",
      "theme-dark": "Ù…Ø¸Ù„Ù…",
      "theme-dark-desc": "Ø³Ù‡Ù„ Ø¹Ù„Ù‰ Ø§Ù„Ø¹ÙŠÙˆÙ†",
      "theme-stadium": "Ø§Ù„Ù…Ù„Ø¹Ø¨",
      "theme-stadium-desc": "Ø§Ø´Ø¹Ø± Ø¨Ø§Ù„Ù„Ø¹Ø¨Ø©",
      "theme-esports": "Ø§Ù„Ø±ÙŠØ§Ø¶Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ©",
      "theme-esports-desc": "Ù„Ø¹Ø´Ø§Ù‚ Ø§Ù„Ø±ÙŠØ§Ø¶Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ©",
      "theme-royal": "Ø§Ù„Ø£Ø²Ø±Ù‚ Ø§Ù„Ù…Ù„ÙƒÙŠ",
      "theme-royal-desc": "ÙƒÙ„Ø§Ø³ÙŠÙƒÙŠ ÙˆØ£Ù†ÙŠÙ‚",
      "compact-mode": "Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„Ù…Ø¶ØºÙˆØ·",
      "compact-mode-desc": "Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ÙÙŠ Ù…Ø³Ø§Ø­Ø© Ø£Ù‚Ù„",
      "reduce-animations": "ØªÙ‚Ù„ÙŠÙ„ Ø§Ù„Ø±Ø³ÙˆÙ… Ø§Ù„Ù…ØªØ­Ø±ÙƒØ©",
      "reduce-animations-desc": "ØªÙ‚Ù„ÙŠÙ„ Ø§Ù„Ø­Ø±ÙƒØ© Ù„ØªØ¬Ø±Ø¨Ø© Ø£ÙƒØ«Ø± Ø³Ù„Ø§Ø³Ø©",
      "large-text": "Ù†Øµ ÙƒØ¨ÙŠØ±",
      "large-text-desc": "Ø²ÙŠØ§Ø¯Ø© Ø­Ø¬Ù… Ø§Ù„Ù†Øµ Ù„Ø³Ù‡ÙˆÙ„Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©",
      "sports-title": "Ø§Ù„ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ©",
      "sports-subtitle": "Ø§Ø®ØªØ± Ø±ÙŠØ§Ø¶Ø§ØªÙƒ Ø§Ù„Ù…ÙØ¶Ù„Ø© Ù„Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ ØªØ­Ø¯ÙŠØ«Ø§Øª Ù…Ø®ØµØµØ©",
      "sport-cricket": "Ù„Ø¹Ø¨Ø© Ø§Ù„ÙƒØ±ÙŠÙƒÙŠØª",
      "sport-football": "ÙƒØ±Ø© Ø§Ù„Ù‚Ø¯Ù…",
      "sport-basketball": "ÙƒØ±Ø© Ø§Ù„Ø³Ù„Ø©",
      "sport-tennis": "Ø§Ù„ØªÙ†Ø³",
      "sport-hockey": "Ø§Ù„Ù‡ÙˆÙƒÙŠ",
      "sport-kabaddi": "ÙƒØ¨Ø§Ø¯ÙŠ",
      "sport-volleyball": "Ø§Ù„ÙƒØ±Ø© Ø§Ù„Ø·Ø§Ø¦Ø±Ø©",
      "sport-tabletennis": "ÙƒØ±Ø© Ø§Ù„Ø·Ø§ÙˆÙ„Ø©",
      "sport-esports": "Ø§Ù„Ø±ÙŠØ§Ø¶Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ©",
      "sport-baseball": "Ø§Ù„Ø¨ÙŠØ³Ø¨ÙˆÙ„",
      "sport-add-more": "Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„Ø£Ù„Ø¹Ø§Ø¨ Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ©",
      "notif-title": "ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„Ø¥Ø®Ø·Ø§Ø±",
      "notif-subtitle": "Ø§Ø®ØªØ± Ù…Ø§ ØªØ±ÙŠØ¯ Ø£Ù† ÙŠØªÙ… Ø¥Ø¹Ù„Ø§Ù…Ùƒ Ø¨Ù‡",
      "notif-live": "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø© Ø§Ù„Ø­ÙŠØ©",
      "notif-news": "Ø§Ù„Ø£Ø®Ø¨Ø§Ø± Ø§Ù„Ø¹Ø§Ø¬Ù„Ø©",
      "notif-predictions": "Ù†ØªØ§Ø¦Ø¬ Ø§Ù„ØªÙ†Ø¨Ø¤",
      "notif-community": "ØªØ­Ø¯ÙŠØ«Ø§Øª Ø§Ù„Ù…Ø¬ØªÙ…Ø¹",
      "notif-email": "Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      "notif-push": "Ø¯ÙØ¹ Ø§Ù„Ø¥Ø®Ø·Ø§Ø±Ø§Øª",
      "notif-mentions": "Ø§Ù„Ø¥Ø´Ø§Ø±Ø§Øª ÙˆØ§Ù„Ø±Ø¯ÙˆØ¯",
      "notif-followers": "Ù…ØªØ§Ø¨Ø¹ÙŠÙ† Ø¬Ø¯Ø¯",
      "security-title": "Ø­Ù…Ø§ÙŠØ©",
      "security-subtitle": "Ø­Ø§ÙØ¸ Ø¹Ù„Ù‰ Ø­Ø³Ø§Ø¨Ùƒ Ø¢Ù…Ù†Ù‹Ø§ ÙˆÙ…Ø£Ù…ÙˆÙ†Ù‹Ø§",
      "security-google": "Ø¬ÙˆØ¬Ù„",
      "security-facebook": "ÙÙŠØ³Ø¨ÙˆÙƒ",
      "security-connected": "Ù…ØªØµÙ„",
      "security-change-password": "ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
      "security-2fa": "Ø§Ù„Ù…ØµØ§Ø¯Ù‚Ø© Ø§Ù„Ø«Ù†Ø§Ø¦ÙŠØ©",
      "security-2fa-on": "Ø¹Ù„Ù‰",
      "security-2fa-off": "Ø¹Ù†",
      "security-logout-all": "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø©",
      "lang-title": "Ø§Ù„Ù„ØºØ© ÙˆØ§Ù„Ù…Ù†Ø·Ù‚Ø©",
      "lang-subtitle": "Ø¥Ø¯Ø§Ø±Ø© ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„Ù„ØºØ© ÙˆØ§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø®Ø§ØµØ© Ø¨Ùƒ",
      "lang-language": "Ù„ØºØ©",
      "lang-timezone": "Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ©",
      "lang-region": "Ù…Ù†Ø·Ù‚Ø©",
      "support-title": "Ø§Ù„Ø¯Ø¹Ù… ÙˆØ§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª",
      "support-subtitle": "Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© ÙˆØ§Ù„ØªØ¹Ù„ÙŠÙ‚Ø§Øª ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªØ·Ø¨ÙŠÙ‚",
      "support-report-bug": "Ø§Ù„Ø¥Ø¨Ù„Ø§Øº Ø¹Ù† Ø§Ù„Ø®Ø·Ø£",
      "support-feedback": "Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª",
      "support-contact": "Ø§ØªØµÙ„ Ø¨Ø§Ù„Ø¯Ø¹Ù…",
      "support-privacy": "Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©",
      "support-terms": "Ø§Ù„Ø´Ø±ÙˆØ· ÙˆØ§Ù„Ø£Ø­ÙƒØ§Ù…",
      "profile-title": "Ø­Ø³Ø§Ø¨ ØªØ¹Ø±ÙŠÙÙŠ",
      "profile-edit": "ØªØ­Ø±ÙŠØ± Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ",
      "profile-level": "Ù…Ø³ØªÙˆÙ‰",
      "profile-achievements": "Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª",
      "profile-recent-activity": "Ø§Ù„Ù†Ø´Ø§Ø· Ø§Ù„Ø£Ø®ÙŠØ±",
      "profile-identity": "ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù‡ÙˆÙŠØ©",
      "profile-fullname": "Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„",
      "profile-username": "Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…",
      "profile-gender": "Ø¬Ù†Ø³",
      "profile-dob": "ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…ÙŠÙ„Ø§Ø¯",
      "profile-contact": "Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø§ØªØµØ§Ù„",
      "profile-email": "Ø¨Ø±ÙŠØ¯ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      "profile-mobile": "Ù…ØªØ­Ø±Ùƒ",
      "profile-location": "Ù…ÙˆÙ‚Ø¹",
      "profile-save": "Ø­ÙØ¸ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª",
      "profile-cancel": "ÙŠÙ„ØºÙŠ",
      "profile-signout": "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† Ø§Ù„Ø­Ø³Ø§Ø¨",
      "stats-total-predictions": "Ù…Ø¬Ù…ÙˆØ¹ Ø§Ù„ØªÙˆÙ‚Ø¹Ø§Øª",
      "stats-win-rate": "Ù…Ø¹Ø¯Ù„ Ø§Ù„ÙÙˆØ² %",
      "stats-xp-progress": "ØªÙ‚Ø¯Ù… XP",
      "stats-global-rank": "Ø§Ù„Ù…Ø±ØªØ¨Ø© Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠØ©",
      "fancoin-title": "Ù…Ø­ÙØ¸Ø© ÙØ§Ù† ÙƒÙˆÙŠÙ†",
      "fancoin-balance": "ØªÙˆØ§Ø²Ù†",
      "fancoin-earn": "ÙƒØ³Ø¨ Ø§Ù„Ø¹Ù…Ù„Ø§Øª Ø§Ù„Ù…Ø¹Ø¯Ù†ÙŠØ©",
      "fancoin-history": "ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª",
      "fancoin-tagline": "ÙƒØ³Ø¨ Ø§Ù„Ø¹Ù…Ù„Ø§Øª Ø§Ù„Ù…Ø¹Ø¯Ù†ÙŠØ©.",
      "fancoin-ways": "Ø·Ø±Ù‚ Ù„ÙƒØ³Ø¨ Ø¹Ù…Ù„Ø§Øª Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ†",
      "fancoin-streak": "Ø®Ø· Ø§Ù„ÙŠÙˆÙ…",
      "view-wallet": "Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø­ÙØ¸Ø©",
      "earn-daily-quiz-title": "Ù…Ø³Ø§Ø¨Ù‚Ø© ÙŠÙˆÙ…ÙŠØ©",
      "earn-prediction-title": "ØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©",
      "earn-community-title": "Ù†Ø´Ø§Ø· Ø§Ù„Ù…Ø¬ØªÙ…Ø¹",
      "earn-fanwar-title": "Ø­Ø±Ø¨ Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ†",
      "earn-daily-quiz-desc": "Ø£Ø¬Ø¨ Ø¹Ù† Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ø§Ù„ÙŠÙˆÙ…ÙŠ ÙˆØ§ÙƒØ³Ø¨ Ø§Ù„Ø¹Ù…Ù„Ø§Øª Ø§Ù„Ù…Ø¹Ø¯Ù†ÙŠØ©",
      "earn-prediction-desc": "ØªÙˆÙ‚Ø¹ Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø© Ø¨Ø´ÙƒÙ„ ØµØ­ÙŠØ­",
      "earn-community-desc": "Ø§Ø¨Ù‚ Ù†Ø´Ø·Ù‹Ø§ ÙÙŠ Ù…Ø¬ØªÙ…Ø¹Ø§Øª Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ† Ø¨Ùƒ",
      "earn-fanwar-desc": "Ø§Ù„Ù…Ø´Ø§Ø±ÙƒØ© ÙÙŠ Ù…Ø¹Ø§Ø±Ùƒ Ø§Ù„Ù…Ø¹Ø¬Ø¨ÙŠÙ†",
      "level-bronze": "Ù…Ø±ÙˆØ­Ø© Ø¨Ø±ÙˆÙ†Ø²ÙŠØ©",
      "level-silver": "Ø§Ù„Ù…Ø±ÙˆØ­Ø© Ø§Ù„ÙØ¶ÙŠØ©",
      "level-gold": "Ù…Ø±ÙˆØ­Ø© Ø§Ù„Ø°Ù‡Ø¨",
      "level-diamond": "Ù…Ø±ÙˆØ­Ø© Ø§Ù„Ù…Ø§Ø³",
      "level-next": "ÙŠØ³ØªÙ…Ø± ÙÙŠ Ø§Ù„ØªÙ‚Ø¯Ù…!",
      "level-benefits": "ÙÙˆØ§Ø¦Ø¯ Ø§Ù„Ù…Ø³ØªÙˆÙ‰",
      "benefit-exclusive": "Ù…Ø­ØªÙˆÙ‰ Ø­ØµØ±ÙŠ",
      "benefit-early-access": "Ø§Ù„ÙˆØµÙˆÙ„ Ø§Ù„Ù…Ø¨ÙƒØ±",
      "benefit-badges": "Ø´Ø§Ø±Ø§Øª Ø®Ø§ØµØ©",
      "news-title": "Ø§Ù„Ø£Ø®Ø¨Ø§Ø± ÙˆØ§Ù„Ù…Ø³ØªØ¬Ø¯Ø§Øª",
      "news-latest": "Ø¢Ø®Ø± Ø§Ù„Ø£Ø®Ø¨Ø§Ø±",
      "matches-title": "Ø§Ù„Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ø§Ù„Ø­ÙŠØ©",
      "matches-upcoming": "Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©",
      "matches-live": "ÙŠØ¹ÙŠØ´",
      "matches-completed": "Ù…ÙƒØªÙ…Ù„",
      "footer-copyright": "Â© 2024 ÙØ§Ù†ÙƒÙˆÙ†Ø§ÙƒØª.",
      "theme-toggle-label": "ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹",
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

  // 2. Theme handled by theme.js â€” only sync icons on load

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
      // Mobile: slide the drawer in. Must ALSO drop `sidebar-collapsed`
      // because its CSS forces width:0 on every screen size â€” otherwise the
      // drawer stays invisible on phones (the hamburger "does nothing").
      sidebar.classList.remove("-translate-x-full");
      sidebar.classList.remove("sidebar-collapsed");
      sidebarBackdrop?.classList.remove("opacity-0", "pointer-events-none");
    }
    localStorage.setItem("sidebar-hidden", "false");
    headerLogo?.classList.add("header-logo-hidden");
    headerLogo?.classList.remove("header-logo-show");
  }
  function closeSidebar() {
    if (!sidebar) return;
    if (window.innerWidth >= 1024) {
      // Desktop: collapse the sidebar to 0 width so main content expands
      sidebar.classList.add("sidebar-collapsed");
    } else {
      sidebar.classList.add("-translate-x-full");
      sidebar.classList.add("sidebar-collapsed");
      sidebarBackdrop?.classList.add("opacity-0", "pointer-events-none");
    }
    localStorage.setItem("sidebar-hidden", "true");
    headerLogo?.classList.remove("header-logo-hidden");
    headerLogo?.classList.add("header-logo-show");
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

  // 8. Search Autocomplete â€” opens player.html on result click
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
          var detail = p.sport + (p.country ? " â€¢ " + p.country : "");
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

