/*=================================
FANCONNACT SETTINGS ENGINE
=================================*/
const STORAGE_KEY = "fanconnact-settings";

const defaultSettings = {
  theme: "light",
  compact: false,
  largeText: false,
  reduceAnimation: false,
  sports: [
    "cricket", "football", "basketball", "tennis", "hockey",
    "kabaddi", "volleyball", "tabletennis", "baseball"
  ],
  notifications: {
    liveMatchAlerts: true,
    breakingNews: true,
    predictionResults: true,
    communityUpdates: true,
    emailNotifications: true,
    pushNotifications: true,
    mentionsReplies: true,
    newFollowers: true
  },
  language: "English",
  timezone: "Asia/Kolkata",
  region: "India",
  twoFactorEnabled: false,
  customTheme: {
    pageBg: "#0b1220",
    cardBg: "#111827",
    border: "#243347",
    text: "#ffffff",
    textLight: "#94a3b8",
    primary: "#22c55e",
    hover: "#162132",
    bgImage: "",
    bgSize: "cover",
    bgPosition: "center top",
    bgRepeat: "no-repeat",
    bgAttachment: "fixed",
    isDark: true
  }
};

let settings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultSettings;

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/*=================================
THEME ENGINE
=================================*/
const themeCards = document.querySelectorAll("[data-theme]");

function applyTheme(theme) {
  document.body.classList.remove(
    "theme-light", "theme-dark", "theme-stadium", "theme-esports", "theme-royal", "theme-custom"
  );
  document.body.classList.add(`theme-${theme}`);
  settings.theme = theme;
  saveSettings();

  // Custom theme: apply the user's saved CSS variables to <body>
  if (theme === "custom") {
    applyCustomTheme();
  } else {
    // Clear any inline custom vars so named themes use their CSS file values
    clearCustomThemeVars();
  }

  themeCards.forEach((card) => {
    card.classList.remove("active-theme");
  });
  const active = document.querySelector(`[data-theme="${theme}"]`);
  if (active) active.classList.add("active-theme");

  // Sync html dark/light class with color-theme for theme.js compatibility
  let colorTheme;
  if (theme === "light") {
    colorTheme = "light";
  } else if (theme === "custom") {
    // Custom theme declares its own dark/light intent
    colorTheme = settings.customTheme && settings.customTheme.isDark ? "dark" : "light";
  } else {
    // dark, stadium, esports, royal are all dark-based
    colorTheme = "dark";
  }
  localStorage.setItem("color-theme", colorTheme);
  document.documentElement.classList.toggle("dark", colorTheme === "dark");
  document.documentElement.classList.toggle("light", colorTheme !== "dark");

  // Sync theme toggle icons
  const darkIcon = document.getElementById("theme-toggle-dark-icon");
  const lightIcon = document.getElementById("theme-toggle-light-icon");
  if (darkIcon && lightIcon) {
    darkIcon.classList.toggle("hidden", colorTheme !== "dark");
    lightIcon.classList.toggle("hidden", colorTheme === "dark");
  }
}

/* Apply the user-built custom theme by writing its values as inline
   CSS variables on <body>. These are read by the body.theme-custom rules
   in css/style.css. */
function applyCustomTheme() {
  const c = settings.customTheme || {};
  const s = document.body.style;
  s.setProperty("--page-bg", c.pageBg || "#0b1220");
  s.setProperty("--card-bg", c.cardBg || "#111827");
  s.setProperty("--border", c.border || "#243347");
  s.setProperty("--text", c.text || "#ffffff");
  s.setProperty("--text-light", c.textLight || "#94a3b8");
  s.setProperty("--primary", c.primary || "#22c55e");
  s.setProperty("--hover", c.hover || "#162132");
  // Background image (optional). Empty = solid color only.
  if (c.bgImage) {
    s.setProperty("--page-bg-image", `linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url("${c.bgImage}")`);
  } else {
    s.setProperty("--page-bg-image", "none");
  }
  s.setProperty("--page-bg-size", c.bgSize || "cover");
  s.setProperty("--page-bg-position", c.bgPosition || "center top");
  s.setProperty("--page-bg-repeat", c.bgRepeat || "no-repeat");
  s.setProperty("--page-bg-attachment", c.bgAttachment || "fixed");
}

/* Remove inline custom-theme variables so named themes fall back to CSS. */
function clearCustomThemeVars() {
  const s = document.body.style;
  [
    "--page-bg", "--card-bg", "--border", "--text", "--text-light",
    "--primary", "--hover", "--page-bg-image", "--page-bg-size",
    "--page-bg-position", "--page-bg-repeat", "--page-bg-attachment"
  ].forEach((v) => s.removeProperty(v));
}

themeCards.forEach((card) => {
  card.addEventListener("click", () => {
    // The "Custom / Make your own" card opens the builder modal instead of
    // just re-applying the previously saved custom theme.
    if (card.dataset.theme === "custom") {
      if (typeof window.openCustomThemeModal === "function") {
        window.openCustomThemeModal();
      } else {
        applyTheme("custom");
      }
      return;
    }
    applyTheme(card.dataset.theme);
  });
});

// Expose applyTheme globally so the inline Custom Theme Builder script
// (in setting.html) can call window.applyTheme('custom').
window.applyTheme = applyTheme;
window.applyCustomTheme = applyCustomTheme;
window.showToast = showToast;
// Expose the live settings object so the builder can update it in memory
// (not just localStorage) and have applyTheme reflect the new values immediately.
window.settings = settings;

/*=================================
APPEARANCE TOGGLES
=================================*/
const compactToggle = document.getElementById("compactMode");
const animationToggle = document.getElementById("reduceAnimation");
const largeTextToggle = document.getElementById("largeText");

function applyCompactMode() {
  document.documentElement.classList.toggle("compact-mode", settings.compact);
}

function applyLargeText() {
  document.documentElement.classList.toggle("large-text", settings.largeText);
}

function applyAnimation() {
  document.documentElement.classList.toggle("reduce-animation", settings.reduceAnimation);
}

/*=================================
CUSTOM DROPDOWN (Language / Timezone / Region)
=================================*/
const dropdownConfigs = [
  {
    selectorId: "languageSelector",
    displayId: "languageDisplay",
    settingKey: "language",
    options: ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Spanish", "French", "Arabic"]
  },
  {
    selectorId: "timezoneSelector",
    displayId: "timezoneDisplay",
    settingKey: "timezone",
    options: [
      "Asia/Kolkata",
      "Asia/Dubai",
      "Asia/Singapore",
      "Asia/Tokyo",
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Berlin",
      "Australia/Sydney"
    ],
    format: (v) => {
      const offsets = { "Asia/Kolkata": "+5:30", "Asia/Dubai": "+4:00", "Asia/Singapore": "+8:00", "Asia/Tokyo": "+9:00", "America/New_York": "-5:00", "America/Chicago": "-6:00", "America/Los_Angeles": "-8:00", "Europe/London": "+0:00", "Europe/Berlin": "+1:00", "Australia/Sydney": "+11:00" };
      return `(GMT${offsets[v] || "+0:00"}) ${v}`;
    }
  },
  {
    selectorId: "regionSelector",
    displayId: "regionDisplay",
    settingKey: "region",
    options: ["India", "USA", "UAE", "UK", "Singapore", "Australia", "Canada", "Germany", "Japan", "Brazil"]
  }
];

let activeDropdown = null;

function closeDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
}

function createDropdown(config) {
  closeDropdown();
  const selector = document.getElementById(config.selectorId);
  if (!selector) return;
  const rect = selector.getBoundingClientRect();
  const dropdown = document.createElement("div");
  dropdown.className = "fixed z-[100] bg-surface-container-lowest dark:bg-brand-card border border-outline-variant dark:border-brand-border rounded-lg shadow-xl max-h-48 overflow-y-auto";
  dropdown.style.minWidth = rect.width + "px";
  dropdown.style.top = (rect.bottom + 4) + "px";
  dropdown.style.left = rect.left + "px";

  const currentVal = settings[config.settingKey];
  config.options.forEach((opt) => {
    const item = document.createElement("button");
    item.className = "w-full text-left px-md py-sm text-body-sm text-on-surface dark:text-white hover:bg-surface-container-high dark:hover:bg-white/10 transition-colors flex items-center gap-sm";
    if (opt === currentVal) {
      item.classList.add("bg-primary/10", "text-primary", "font-semibold");
    }
    const displayText = config.format ? config.format(opt) : opt;
    item.textContent = displayText;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      settings[config.settingKey] = opt;
      saveSettings();
      const displayEl = document.getElementById(config.displayId);
      if (displayEl) displayEl.textContent = displayText;
      // Trigger language change globally across entire site
      if (config.settingKey === "language" && typeof window.applyLanguage === "function") {
        const codes = window.LANG_CODES || {};
        const langCode = codes[opt] || opt;
        window.applyLanguage(langCode);
      }
      if (config.settingKey === "language") {
        showToast(`Language changed to ${opt}`);
      }
      closeDropdown();
    });
    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
  activeDropdown = dropdown;
}

dropdownConfigs.forEach((cfg) => {
  const el = document.getElementById(cfg.selectorId);
  if (el) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activeDropdown && activeDropdown._configId === cfg.selectorId) {
        closeDropdown();
      } else {
        createDropdown(cfg);
        if (activeDropdown) activeDropdown._configId = cfg.selectorId;
      }
    });
  }
});

document.addEventListener("click", closeDropdown);

/*=================================
SECURITY
=================================*/
const changePasswordBtn = document.getElementById("changePasswordBtn");
const twoFactorBtn = document.getElementById("twoFactorBtn");
const twoFactorStatus = document.getElementById("twoFactorStatus");
const logoutAllBtn = document.getElementById("logoutAllBtn");

// Load 2FA state
if (twoFactorStatus) {
  twoFactorStatus.textContent = settings.twoFactorEnabled ? "On" : "Off";
}

twoFactorBtn?.addEventListener("click", () => {
  settings.twoFactorEnabled = !settings.twoFactorEnabled;
  saveSettings();
  if (twoFactorStatus) {
    twoFactorStatus.textContent = settings.twoFactorEnabled ? "On" : "Off";
  }
  const msg = settings.twoFactorEnabled
    ? "Two-Factor Authentication has been enabled."
    : "Two-Factor Authentication has been disabled.";
  showToast(msg);
});

changePasswordBtn?.addEventListener("click", () => {
  // Check if user is logged in
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ getAuth, sendPasswordResetEmail }) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && user.email) {
      sendPasswordResetEmail(auth, user.email)
        .then(() => {
          showToast(`Password reset email sent to ${user.email}`);
        })
        .catch((err) => {
          showToast("Error: " + err.message, "error");
        });
    } else {
      showToast("Please log in first to change your password.", "error");
    }
  }).catch(() => {
    showToast("Unable to load authentication. Please try again.", "error");
  });
});

logoutAllBtn?.addEventListener("click", () => {
  if (confirm("Are you sure you want to log out of all devices?")) {
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ getAuth, signOut }) => {
      const auth = getAuth();
      signOut(auth).then(() => {
        showToast("Logged out of all devices.");
        setTimeout(() => { window.location.href = "login.html"; }, 1000);
      }).catch((err) => {
        showToast("Error: " + err.message, "error");
      });
    });
  }
});

/*=================================
AUTH PROVIDER MANAGEMENT
=================================*/
const PROVIDER_NAMES = ['google', 'facebook'];
const PROVIDER_MAP = { google: 'google.com', facebook: 'facebook.com' };

function updateProviderUI() {
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ getAuth }) => {
    const auth = getAuth();
    const user = auth.currentUser;

    PROVIDER_NAMES.forEach(name => {
      const statusEl = document.getElementById(`${name}AuthStatus`);
      const iconEl = document.getElementById(`${name}AuthIcon`);
      if (!statusEl || !iconEl) return;

      const providerId = PROVIDER_MAP[name];
      const isConnected = user ? user.providerData.some(p => p.providerId === providerId) : false;

      if (!user) {
        statusEl.textContent = 'Login required';
        statusEl.className = 'text-[11px] text-on-surface-variant dark:text-slate-400 font-bold';
        iconEl.textContent = 'login';
        iconEl.className = 'material-symbols-outlined text-on-surface-variant dark:text-slate-400 text-sm';
      } else if (isConnected) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'text-[11px] text-tertiary-container font-bold';
        iconEl.textContent = 'check_circle';
        iconEl.className = 'material-symbols-outlined text-tertiary-container text-sm';
      } else {
        statusEl.textContent = 'Not Connected';
        statusEl.className = 'text-[11px] text-on-surface-variant dark:text-slate-400 font-bold';
        iconEl.textContent = 'add_circle';
        iconEl.className = 'material-symbols-outlined text-on-surface-variant dark:text-slate-400 text-sm';
      }
    });
  }).catch(() => {
    PROVIDER_NAMES.forEach(name => {
      const statusEl = document.getElementById(`${name}AuthStatus`);
      const iconEl = document.getElementById(`${name}AuthIcon`);
      if (statusEl) { statusEl.textContent = 'Unavailable'; }
      if (iconEl) { iconEl.textContent = 'cloud_off'; }
    });
  });
}

function handleProviderClick(providerName) {
  const providerId = PROVIDER_MAP[providerName];
  const providerClassName = providerName === 'google' ? 'GoogleAuthProvider' : 'FacebookAuthProvider';

  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(async ({ getAuth, GoogleAuthProvider, FacebookAuthProvider, linkWithPopup, unlink }) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      showToast('Please log in first to manage connected accounts.', 'error');
      return;
    }

    const isConnected = user.providerData.some(p => p.providerId === providerId);

    if (isConnected) {
      if (!confirm(`Disconnect your ${providerName === 'google' ? 'Google' : 'Facebook'} account?`)) return;
      try {
        await unlink(user, providerId);
        showToast(`${providerName === 'google' ? 'Google' : 'Facebook'} account disconnected.`);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    } else {
      const ProviderClass = providerName === 'google' ? GoogleAuthProvider : FacebookAuthProvider;
      const provider = new ProviderClass();
      try {
        await linkWithPopup(user, provider);
        showToast(`${providerName === 'google' ? 'Google' : 'Facebook'} account connected!`);
      } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') {
          showToast('Error: ' + err.message, 'error');
        }
      }
    }
    updateProviderUI();
  }).catch(() => {
    showToast('Could not load authentication service. Check your internet connection.', 'error');
  });
}

document.getElementById('googleAuthRow')?.addEventListener('click', () => handleProviderClick('google'));
document.getElementById('facebookAuthRow')?.addEventListener('click', () => handleProviderClick('facebook'));

/*=================================
SUPPORT & ABOUT
=================================*/
document.getElementById("contactSupportBtn")?.addEventListener("click", () => {
  window.location.href = "mailto:techh.pantherr@gmail.com?subject=Support%20Request";
});
document.getElementById("privacyPolicyBtn")?.addEventListener("click", () => {
  window.location.href = "terms.html#privacy";
});
document.getElementById("termsBtn")?.addEventListener("click", () => {
  window.location.href = "terms.html";
});

/*=================================
MODAL SYSTEM
=================================*/
const MODAL_EMAIL = "techh.pantherr@gmail.com";

function openModal(type) {
  closeModal();

  const overlay = document.createElement("div");
  overlay.className = "settings-modal-overlay fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm";
  overlay.id = "settingsModalOverlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const isDark = document.documentElement.classList.contains("dark");
  const isBug = type === "bug";

  const modal = document.createElement("div");
  modal.className = "settings-modal relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl border overflow-hidden animate-modal-in";
  modal.style.background = isDark ? "#111827" : "#ffffff";
  modal.style.borderColor = isDark ? "#243347" : "#e2e8f0";

  modal.innerHTML = `
    <div class="flex items-center justify-between px-6 py-4 border-b" style="border-color:${isDark ? "#243347" : "#e2e8f0"}">
      <div class="flex items-center gap-3">
        <img src="assets/fancoin/fanconnactlogo.png" alt="FanConnact" class="w-7 h-7" />
        <span class="font-bold text-base" style="color:${isDark ? "#ffffff" : "#191c1e"}">${isBug ? "Report a Bug" : "Send Feedback"}</span>
      </div>
      <button id="modalCloseBtn" class="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
        <span class="material-symbols-outlined" style="color:${isDark ? "#94a3b8" : "#64748b"}">close</span>
      </button>
    </div>
    <div class="px-6 py-5 space-y-4">
      <p class="text-sm" style="color:${isDark ? "#94a3b8" : "#64748b"}">${isBug ? "Help us improve by reporting the bug you encountered." : "We value your feedback! Let us know what you think."}</p>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold mb-1" style="color:${isDark ? "#cbd5e1" : "#475569"}">Your Name</label>
          <input id="modalName" type="text" placeholder="Enter your name" class="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2" style="background:${isDark ? "#0b1220" : "#f8fafc"};border-color:${isDark ? "#243347" : "#e2e8f0"};color:${isDark ? "#ffffff" : "#191c1e"};" />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1" style="color:${isDark ? "#cbd5e1" : "#475569"}">Your Email</label>
          <input id="modalEmail" type="email" placeholder="Enter your email" class="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2" style="background:${isDark ? "#0b1220" : "#f8fafc"};border-color:${isDark ? "#243347" : "#e2e8f0"};color:${isDark ? "#ffffff" : "#191c1e"};" />
        </div>
        ${!isBug ? `
        <div>
          <label class="block text-xs font-semibold mb-1.5" style="color:${isDark ? "#cbd5e1" : "#475569"}">Rating</label>
          <div id="starRating" class="flex items-center gap-1">
            ${[1,2,3,4,5].map(i => `<span class="star-icon text-2xl cursor-pointer transition-colors hover:text-yellow-400" data-value="${i}" style="color:#cbd5e1">&#9733;</span>`).join("")}
          </div>
        </div>
        ` : ""}
        <div>
          <label class="block text-xs font-semibold mb-1" style="color:${isDark ? "#cbd5e1" : "#475569"}">${isBug ? "Bug Description" : "Your Feedback"}</label>
          <textarea id="modalMessage" rows="4" placeholder="${isBug ? "Describe the bug in detail..." : "Share your thoughts..."}" class="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2 resize-none" style="background:${isDark ? "#0b1220" : "#f8fafc"};border-color:${isDark ? "#243347" : "#e2e8f0"};color:${isDark ? "#ffffff" : "#191c1e"};"></textarea>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t" style="border-color:${isDark ? "#243347" : "#e2e8f0"}">
      <button id="modalCancelBtn" class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-black/10 dark:hover:bg-white/10" style="color:${isDark ? "#94a3b8" : "#64748b"}">Cancel</button>
      <button id="modalSubmitBtn" class="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110" style="background:#10b981">${isBug ? "Send Report" : "Submit Feedback"}</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  // Focus first input
  setTimeout(() => {
    const firstInput = modal.querySelector("input");
    if (firstInput) firstInput.focus();
  }, 100);

  // Star rating logic
  if (!isBug) {
    let selectedRating = 0;
    const stars = modal.querySelectorAll(".star-icon");
    stars.forEach(star => {
      star.addEventListener("mouseenter", () => {
        const val = parseInt(star.dataset.value);
        stars.forEach(s => {
          s.style.color = parseInt(s.dataset.value) <= val ? "#eab308" : "#cbd5e1";
        });
      });
      star.addEventListener("mouseleave", () => {
        stars.forEach(s => {
          s.style.color = parseInt(s.dataset.value) <= selectedRating ? "#eab308" : "#cbd5e1";
        });
      });
      star.addEventListener("click", () => {
        selectedRating = parseInt(star.dataset.value);
        stars.forEach(s => {
          s.style.color = parseInt(s.dataset.value) <= selectedRating ? "#eab308" : "#cbd5e1";
        });
      });
    });
  }

  // Close handlers
  modal.querySelector("#modalCloseBtn").addEventListener("click", closeModal);
  modal.querySelector("#modalCancelBtn").addEventListener("click", closeModal);

  // Submit handler
  modal.querySelector("#modalSubmitBtn").addEventListener("click", () => {
    const name = modal.querySelector("#modalName").value.trim();
    const email = modal.querySelector("#modalEmail").value.trim();
    const message = modal.querySelector("#modalMessage").value.trim();

    if (!name) { showToast("Please enter your name", "error"); return; }
    if (!email || !email.includes("@")) { showToast("Please enter a valid email", "error"); return; }
    if (!message) { showToast(`Please enter ${isBug ? "a bug description" : "your feedback"}`, "error"); return; }

    let subject, bodyText;
    if (isBug) {
      subject = "Bug Report - FanConnact";
      bodyText = `Bug Report\n\nName: ${name}\nEmail: ${email}\n\nDescription:\n${message}`;
    } else {
      const stars = modal.querySelectorAll(".star-icon");
      let ratingText = "Not rated";
      if (stars.length) {
        const filled = [...stars].filter(s => s.style.color === "rgb(234, 179, 8)").length;
        ratingText = filled > 0 ? `${filled}/5` : "Not rated";
      }
      subject = "Feedback - FanConnact";
      bodyText = `Feedback\n\nName: ${name}\nEmail: ${email}\nRating: ${ratingText}\n\nMessage:\n${message}`;
    }

    const submitBtn = modal.querySelector("#modalSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    const payload = {
      _subject: subject, _captcha: "false", _template: "box",
      name, email, message: bodyText
    };

    // Use form + iframe for file:// protocol (fetch blocked in file://)
    if (window.location.protocol === "file:") {
      let iframe = document.getElementById("fsIframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "fsIframe"; iframe.name = "fsIframe";
        iframe.style.display = "none";
        iframe.sandbox = "allow-forms allow-scripts allow-same-origin";
        document.body.appendChild(iframe);
      }
      const form = document.createElement("form");
      form.action = "https://formsubmit.co/techh.pantherr@gmail.com";
      form.method = "POST"; form.target = "fsIframe";
      form.style.display = "none";
      for (const [k, v] of Object.entries(payload)) {
        const inp = document.createElement("input");
        inp.type = "hidden"; inp.name = k; inp.value = v;
        form.appendChild(inp);
      }
      document.body.appendChild(form);
      form.submit();
      showToast(isBug ? "Bug report sent! Thank you." : "Feedback sent! Thank you.");
      closeModal();
      setTimeout(() => form.remove(), 2000);
      return;
    }

    fetch("https://formsubmit.co/ajax/techh.pantherr@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(isBug ? "Bug report sent! Thank you." : "Feedback sent! Thank you.");
        closeModal();
      } else {
        showToast("Server error. Try again.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = isBug ? "Send Report" : "Submit Feedback";
      }
    })
    .catch(() => {
      showToast("Could not send. Try again later.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = isBug ? "Send Report" : "Submit Feedback";
    });
  });

  // Close on Escape
  document.addEventListener("keydown", modalEscHandler);
}

function closeModal() {
  const overlay = document.getElementById("settingsModalOverlay");
  if (overlay) {
    overlay.classList.add("opacity-0");
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = "";
    }, 200);
  }
  document.removeEventListener("keydown", modalEscHandler);
}

function modalEscHandler(e) {
  if (e.key === "Escape") closeModal();
}

document.getElementById("reportBugBtn")?.addEventListener("click", () => openModal("bug"));
document.getElementById("sendFeedbackBtn")?.addEventListener("click", () => openModal("feedback"));

/*=================================
TOAST NOTIFICATION
=================================*/
function showToast(message, type) {
  const existing = document.querySelector(".settings-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "settings-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] px-lg py-md rounded-xl shadow-2xl text-body-sm font-semibold";
  const isDark = document.documentElement.classList.contains("dark");
  if (type === "error") {
    toast.style.background = "#ef4444";
    toast.style.color = "#ffffff";
  } else {
    toast.style.background = isDark ? "#059669" : "#10b981";
    toast.style.color = "#ffffff";
  }
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/*=================================
LOGO TEXT SYNC
=================================*/
// The logo text colors (text-fan, text-connect) are controlled via CSS
// in style.css based on dark/light mode, so they auto-sync with theme changes.

/*=================================
INIT
=================================*/
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(settings.theme);

  if (compactToggle) compactToggle.checked = settings.compact;
  if (animationToggle) animationToggle.checked = settings.reduceAnimation;
  if (largeTextToggle) largeTextToggle.checked = settings.largeText;

  applyCompactMode();
  applyLargeText();
  applyAnimation();

  // Sync language display name with the active language code from fanconnect-lang
  const activeLangCode = localStorage.getItem("fanconnect-lang") || "en";
  const revMap = {};
  if (typeof window.LANG_CODES !== "undefined") {
    for (const [name, code] of Object.entries(window.LANG_CODES)) {
      revMap[code] = name;
    }
  }
  if (revMap[activeLangCode]) {
    settings.language = revMap[activeLangCode];
  }

  // Initialize auth provider connection status
  updateProviderUI();

  // Initialize all custom dropdown displays from saved settings
  dropdownConfigs.forEach((cfg) => {
    const displayEl = document.getElementById(cfg.displayId);
    if (!displayEl) return;
    const opt = settings[cfg.settingKey];
    const text = cfg.format ? cfg.format(opt) : opt;
    displayEl.textContent = text;
  });
});

if (compactToggle) {
  compactToggle.addEventListener("change", function () {
    settings.compact = this.checked;
    saveSettings();
    applyCompactMode();
  });
}

if (largeTextToggle) {
  largeTextToggle.addEventListener("change", function () {
    settings.largeText = this.checked;
    saveSettings();
    applyLargeText();
  });
}

if (animationToggle) {
  animationToggle.addEventListener("change", function () {
    settings.reduceAnimation = this.checked;
    saveSettings();
    applyAnimation();
  });
}

/*=================================
SYNC WITH THEME TOGGLE (theme.js)
=================================*/
// Listen for theme toggle clicks to keep settings.theme in sync
document.addEventListener("click", (e) => {
  const themeBtn = e.target.closest("#theme-toggle");
  if (!themeBtn) return;

  // After theme.js toggles, sync settings
  setTimeout(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const newTheme = isDark ? "dark" : "light";
    // Only sync for light/dark. If the user picked a named/custom theme
    // (stadium / esports / royal / custom), the toggle must NOT change it.
    const namedThemes = ["light", "dark", "stadium", "esports", "royal", "custom"];
    if (namedThemes.indexOf(settings.theme) !== -1 && settings.theme !== "light" && settings.theme !== "dark") {
      return;
    }
    if (settings.theme !== newTheme) {
      // The body class is updated by MutationObserver in HTML, but we
      // need to update settings and the theme card active state
      settings.theme = newTheme;
      saveSettings();
      themeCards.forEach((card) => {
        card.classList.remove("active-theme");
      });
      const active = document.querySelector(`[data-theme="${newTheme}"]`);
      if (active) active.classList.add("active-theme");
    }
  }, 50);
});

/*=================================
ADD ANIMATIONS
=================================*/
const style = document.createElement("style");
style.textContent = `
@keyframes settings-slide-up { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.settings-toast { animation: settings-slide-up 0.3s ease-out; }

@keyframes modal-in { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.settings-modal { animation: modal-in 0.25s ease-out; }
.settings-modal-overlay { transition: opacity 0.2s ease; }

.settings-modal input:focus, .settings-modal textarea:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
.settings-modal input::placeholder, .settings-modal textarea::placeholder { color: #94a3b8; }
`;
document.head.appendChild(style);
