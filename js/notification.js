/* ==========================
NOTIFICATION DATABASE
========================== */

const notifications = [
  {
    id: 1,
    type: "rewards",
    sport: "system",
    team: "system",
    title: "Coin Reward",
    message: "Daily login reward claimed successfully.",
    reward: "+20 Coins",
    time: "5m",
    icon: "💰",
  },

  {
    id: 2,
    type: "match",
    sport: "cricket",
    team: "RCB",
    title: "Match Alert",
    message: "RCB vs MI starts in 30 mins.",
    time: "15m",
    icon: "❤️",
  },

  {
    id: 3,
    type: "news",
    sport: "cricket",
    team: "India",
    title: "Breaking News",
    message: "India squad announced.",
    time: "22m",
    icon: "📰",
  },

  {
    id: 4,
    type: "social",
    sport: "football",
    team: "Real Madrid",
    title: "Social Activity",
    message: "12 fans liked your prediction.",
    time: "2h",
    icon: "⚽",
  },

  {
    id: 5,
    type: "account",
    sport: "system",
    team: "system",
    title: "Username Updated",
    message: "Username updated successfully.",
    time: "1h",
    icon: "⚙",
  },
];

/* ==========================
ELEMENTS
========================== */

const tabs = document.querySelectorAll(".tab");

const cards = document.querySelectorAll(".notification-card");

const badge = document.querySelector(".badge-count");

const markReadBtn = document.querySelector(".mark-read-btn");

const pinnedBtn = document.querySelector(".pinned-btn");

const filterBtn = document.getElementById("filterBtn");

const dropdown = document.getElementById("filterDropdown");

const soundBtn = document.querySelector(".sound-btn");

const pinnedContainer = document.getElementById("pinnedContainer");

const settingsBtn = document.querySelector(".settings-btn");

const settingsModal = document.querySelector(".settings-modal");

const closeSettings = document.querySelector(".close-settings");

const backBtn = document.querySelector(".back-btn");

/* ==========================
BACK BUTTON
========================== */

backBtn.addEventListener("click", () => {
  history.back();
});

/* ==========================
SETTINGS MODAL
========================== */

settingsBtn.addEventListener("click", () => {
  settingsModal.classList.add("show");
});

closeSettings.addEventListener("click", () => {
  settingsModal.classList.remove("show");
});

/* click outside close */

window.addEventListener("click", (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove("show");
  }
});

/* TAB SWITCH */

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));

    tab.classList.add("active");

    const type = tab.dataset.type;

    document.querySelectorAll(".notification-card").forEach((card) => {
      if (type === "all") {
        card.style.display = "flex";
      } else {
        card.style.display = card.dataset.type === type ? "flex" : "none";
      }
    });
  });
});

/* FILTER OPEN/CLOSE */

filterBtn.addEventListener("click", function (e) {
  console.log("clicked");

  e.stopPropagation();

  dropdown.classList.toggle("show");
});

/* FILTER CHANGE */

dropdown.addEventListener("change", () => {
  const value = dropdown.value;

  tabs.forEach((tab) => {
    tab.classList.remove("active");

    if (tab.dataset.type === value) {
      tab.classList.add("active");
    }
  });
  document.querySelectorAll(".notification-card").forEach((card) => {
    if (value === "all") {
      card.style.display = "flex";
    } else {
      card.style.display = card.dataset.type === value ? "flex" : "none";
    }
  });
});

/* CLICK OUTSIDE CLOSE */

document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target) && e.target !== filterBtn) {
    dropdown.classList.remove("show");
  }
});
/* PIN SYSTEM */

let pinnedCards = JSON.parse(localStorage.getItem("pinnedCards")) || [];

function attachPinEvents() {
  document.querySelectorAll(".pin-btn").forEach((btn) => {
    btn.onclick = function (e) {
      e.stopPropagation();

      const card = this.closest(".notification-card");

      const cardId = Number(card.dataset.id);

      /* PIN */
      if (!pinnedCards.includes(cardId)) {
        pinnedCards.push(cardId);

        card.classList.add("pinned");

        this.innerHTML = "📌";

        /* pin section me bhejo */
        pinnedContainer.appendChild(card);
      } else {

      /* UNPIN */
        pinnedCards = pinnedCards.filter((id) => id !== cardId);

        card.classList.remove("pinned");

        this.innerHTML = "📍";

        /* recent me bhejo */
        feed.appendChild(card);
      }

      localStorage.setItem("pinnedCards", JSON.stringify(pinnedCards));
    };
  });
}

/* PINNED FILTER */

let showPinned = false;

pinnedBtn.addEventListener("click", () => {
  showPinned = !showPinned;

  document.querySelectorAll(".notification-card").forEach((card) => {
    if (showPinned) {
      card.style.display = card.classList.contains("pinned") ? "flex" : "none";
    } else {
      card.style.display = "flex";
    }
  });
});

/* DELETE CARD */

document.querySelectorAll(".notification-card").forEach((card) => {
  card.addEventListener("dblclick", () => {
    card.style.opacity = "0";

    card.style.transform = "translateX(100px)";

    setTimeout(() => {
      card.remove();
    }, 300);
  });
});

/* ==========================
MARK ALL READ
========================== */

markReadBtn.addEventListener("click", () => {
  document.querySelectorAll(".notification-card").forEach((card) => {
    card.classList.add("read");
  });
});

/* ==========================
SOUND TOGGLE
========================== */

let soundOn = true;

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;

  soundBtn.innerHTML = soundOn ? "🔊 Sound ON" : "🔇 Sound OFF";
});

/* ==========================
BADGE COUNT
========================== */

function updateBadge() {
  const visible = [...cards].filter((card) => card.style.display !== "none");

  badge.innerText = visible.length;
}

updateBadge();

/* ==========================
RENDER NOTIFICATIONS
========================== */

const feed = document.querySelector(".notification-feed");

function renderNotifications() {
  feed.innerHTML = "";

  notifications.forEach((notification) => {
    const card = document.createElement("div");

    card.className = "notification-card";

    card.dataset.type = notification.type;

    card.dataset.sport = notification.sport;

    card.dataset.team = notification.team;

    card.dataset.id = notification.id;

    card.innerHTML = `
<button class="pin-btn">
📍
</button>

<div class="icon">
${notification.icon}
</div>

<div class="card-content">

<h3>
${notification.title}
</h3>

<p>
${notification.message}
</p>

${
  notification.reward
    ? `<span class="reward">
${notification.reward}
</span>`
    : ""
}

</div>

<span class="time">
${notification.time}
</span>
`;

    const pinnedCards = JSON.parse(localStorage.getItem("pinnedCards")) || [];

    if (pinnedCards.includes(notification.id)) {
      card.classList.add("pinned");

      card.querySelector(".pin-btn").innerHTML = "📌";

      pinnedContainer.appendChild(card);
    } else {
      feed.appendChild(card);
    }
  });
  attachPinEvents();
}

/* Connect to notification WebSocket for real-time updates */
(function() {
  var notifWs = null;
  function connectNotif() {
    try {
      notifWs = new WebSocket((window.FC_API ? window.FC_API.ws() : 'ws://localhost:5000') + '/ws/notifications');
      notifWs.onmessage = function(ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data.type === 'new_notification') {
            var n = data.notification;
            if (n && !notifications.find(function(ex) { return ex.id === n.id; })) {
              var entry = {
                id: n.id,
                type: n.type || 'match',
                sport: n.sport || 'general',
                team: n.sport || 'general',
                title: n.title || '',
                message: n.message || '',
                time: formatTimeAgo(n.time),
                icon: n.icon || '🔔'
              };
              notifications.unshift(entry);
              renderNotifications();
            }
          }
        } catch(e) {}
      };
      notifWs.onclose = function() {
        setTimeout(connectNotif, 10000);
      };
      notifWs.onerror = function() { notifWs.close(); };
    } catch(e) {}
  }
  function formatTimeAgo(ts) {
    var sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h';
    return Math.floor(hr / 24) + 'd';
  }
  connectNotif();
})();

/* first render */

renderNotifications();
attachPinEvents();

/* INTERESTS */

const sportBtns = document.querySelectorAll(".interest-card");

const teamsContainer = document.getElementById("teamsContainer");

/* SPORT DATA */

const sportTeams = {
  cricket: ["RCB", "MI", "CSK", "India", "Australia"],

  football: ["Real Madrid", "Barcelona", "Arsenal", "Manchester United"],

  basketball: ["Lakers", "Warriors", "Celtics"],

  tennis: ["Djokovic", "Nadal", "Alcaraz"],

  esports: ["BGMI", "Valorant", "Free Fire"],
};

/* LOAD TEAMS */
function loadTeams(sport) {
  teamsContainer.innerHTML = "";

  const savedTeams = JSON.parse(localStorage.getItem("selectedTeams")) || [];

  sportTeams[sport].forEach((team) => {
    const btn = document.createElement("button");

    btn.className = "team-card";

    btn.innerText = team;

    /* restore selected */

    if (savedTeams.includes(team)) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", function () {
      this.classList.toggle("active");

      saveTeams();
    });

    teamsContainer.appendChild(btn);
  });
}

/* SPORT CLICK */

sportBtns.forEach((btn) => {
  btn.addEventListener("click", function () {
    sportBtns.forEach((b) => b.classList.remove("active"));

    this.classList.add("active");

    const sport = this.dataset.sport;

    loadTeams(sport);

    localStorage.setItem("selectedSport", sport);
  });
});

/* SAVE TEAMS */

function saveTeams() {
  let allTeams = JSON.parse(localStorage.getItem("selectedTeams")) || [];

  document.querySelectorAll(".team-card").forEach((team) => {
    const name = team.innerText;

    if (team.classList.contains("active")) {
      if (!allTeams.includes(name)) {
        allTeams.push(name);
      }
    } else {
      allTeams = allTeams.filter((t) => t !== name);
    }
  });

  localStorage.setItem("selectedTeams", JSON.stringify(allTeams));
}

window.addEventListener("DOMContentLoaded", () => {
  const savedSport = localStorage.getItem("selectedSport") || "cricket";

  document.querySelectorAll(".interest-card").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeSport = document.querySelector(`[data-sport="${savedSport}"]`);

  if (activeSport) {
    activeSport.classList.add("active");
  }

  loadTeams(savedSport);

  renderNotifications();
});
