// Real-time Live Chat for Match Center
// Connects to backend WS (/ws/chat). Falls back to a local in-page mode if the
// server is unavailable so the UI still works for demos.
(function () {
  'use strict';

  const WS_URL = (window.FC_API ? window.FC_API.ws() : 'ws://localhost:5000') + '/ws/chat';
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const statusEl = document.getElementById('chat-status');
  const onlineEl = document.getElementById('chat-online-count');
  const typingEl = document.getElementById('chat-typing');
  const stickerBtn = document.getElementById('chat-sticker-btn');
  const stickerBox = document.getElementById('chat-stickers');
  const imgBtn = document.getElementById('chat-img-btn');
  const imgInput = document.getElementById('chat-img-input');

  // Declared early so refreshIdentity() can reference it without a TDZ error
  let ws = null;

  if (!messagesEl) return; // panel not present

  // ---- Chat gating: open only when live or <30min to live; closed when finished ----
  function getMatchState() {
    const p = new URLSearchParams(location.search);
    const state = (p.get('state') || '').toLowerCase();
    const id = p.get('id') || '';
    if (id) {
      try {
        const ms = window.FANCONNECT_MATCHES && window.FANCONNECT_MATCHES.MATCHES;
        if (ms) {
          const m = ms.find(x => String(x.id) === String(id));
          if (m && m.status) {
            const s = String(m.status).toLowerCase();
            return {
              state: s === 'in' || /live|progress/.test(s) ? 'live'
                : s === 'post' || /finish|complete|done|result/.test(s) ? 'finished'
                : 'upcoming',
              sport: m.sport || 'cricket',
              home: m.home || '',
              away: m.away || ''
            };
          }
        }
      } catch (e) { /* fall through to URL params */ }
    }
    return {
      state: state || 'upcoming',
      sport: p.get('sport') || 'cricket',
      home: p.get('home') || '',
      away: p.get('away') || ''
    };
  }
  function getMatchStart() {
    try {
      const ms = window.FANCONNECT_MATCHES && window.FANCONNECT_MATCHES.MATCHES;
      if (!ms) return null;
      const s = getMatchState();
      const m = ms.find(x => x.sport === s.sport && x.home === s.home && x.away === s.away);
      if (!m || !m.date) return null;
      const t = (m.time || '').toString().replace(/\s*(GMT|IST|LOCAL).*$/i, '').trim();
      const dt = new Date(m.date + 'T' + (t || '00:00') + ':00');
      return isNaN(dt.getTime()) ? null : dt;
    } catch (e) { return null; }
  }
  function chatEligibility() {
    const s = getMatchState();
    if (s.state === 'finished') return { enabled: false, reason: 'Chat is closed — this match has finished.' };
    if (s.state === 'live') return { enabled: true, reason: 'Live chat is open.' };
    const start = getMatchStart();
    if (!start) return { enabled: false, reason: 'Chat opens 30 minutes before the match.' };
    const diffMin = (start.getTime() - Date.now()) / 60000;
    if (diffMin <= 30) return { enabled: true, reason: 'Live chat is open — match starting soon.' };
    return { enabled: false, reason: 'Chat opens 30 minutes before the match (' + start.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) + ').' };
  }
  const _elig = chatEligibility();
  if (!_elig.enabled) {
    const lock = document.createElement('div');
    lock.className = 'flex flex-col items-center justify-center text-center gap-2 py-10 px-4 text-gray-400';
    const ic = document.createElement('div'); ic.className = 'text-3xl'; ic.textContent = '🔒';
    const tx = document.createElement('p'); tx.className = 'text-sm'; tx.textContent = _elig.reason;
    lock.appendChild(ic); lock.appendChild(tx);
    messagesEl.appendChild(lock);
    if (inputEl) { inputEl.disabled = true; inputEl.placeholder = 'Chat is closed'; }
    if (sendBtn) sendBtn.disabled = true;
    if (stickerBtn) stickerBtn.disabled = true;
    if (imgBtn) imgBtn.disabled = true;
    if (statusEl) { statusEl.textContent = 'closed'; statusEl.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'; }
    return;
  }

  // Map of message id -> DOM node, for live "seen" updates
  const renderedMessages = {};

  // ---- Identity (from Firebase profile if available, else generated) ----
  // Read live from the header elements so the real name/photo (set by script.js
  // after Firebase auth resolves) are used even if chat loads first.
  let me = { name: 'You', img: '', id: 'me_' + Math.random().toString(36).slice(2, 7) };
  function refreshIdentity() {
    try {
      // Prefer the real database profile exposed by script.js (full name, no @)
      if (window.currentUserProfile && window.currentUserProfile.name) {
        me.name = window.currentUserProfile.name;
        if (window.currentUserProfile.photoURL) me.img = window.currentUserProfile.photoURL;
      } else {
        const nameEl = document.getElementById('user-name-display');
        const imgEl = document.getElementById('user-profile-img');
        if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
          me.name = nameEl.textContent.trim().replace(/^@/, '');
        }
        if (imgEl && imgEl.src && !imgEl.src.includes('ui-avatars')) me.img = imgEl.src;
      }
    } catch (e) {}
    if (!me.img) {
      me.img = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(me.name) + '&background=2196f3&color=fff&size=64';
    }
    // Update the chat header profile chip with the real DB name + photo
    try {
      const pImg = document.getElementById('chat-profile-img');
      const pName = document.getElementById('chat-profile-name');
      if (pImg) pImg.src = me.img;
      if (pName) pName.textContent = me.name || 'You';
    } catch (e) {}
  }
  refreshIdentity();
  // Re-check after Firebase auth populates the header (script.js runs async)
  setTimeout(refreshIdentity, 800);
  setTimeout(refreshIdentity, 2500);

  // ---- Stickers ----
  const STICKERS = ['🏏', '🔥', '💥', '👏', '💪', '⭐', '🎯', '🏆', '😂', '😮', '😍', '🥳', '👍', '🤯', '🙌', '❤️'];
  STICKERS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'text-2xl hover:scale-110 transition';
    b.textContent = s;
    b.addEventListener('click', () => sendPayload({ kind: 'sticker', sticker: s }));
    stickerBox.appendChild(b);
  });
  stickerBtn.addEventListener('click', () => stickerBox.classList.toggle('hidden'));

  // ---- Helpers ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function timeStr(t) {
    const d = new Date(t || Date.now());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function avatarFor(user) {
    return user && user.img ? user.img : 'https://ui-avatars.com/api/?name=' + encodeURIComponent((user && user.name) || 'Fan') + '&background=2196f3&color=fff&size=64';
  }

  function renderMessage(m) {
    const wrap = document.createElement('div');
    wrap.className = 'flex gap-3 items-start';
    const isMe = (m.user && m.user.id === me.id) || m.mine;
    if (m.id) renderedMessages[m.id] = wrap;
    const av = document.createElement('img');
    av.className = 'w-9 h-9 rounded-full border border-gray-200 dark:border-white/10 shrink-0';
    av.src = avatarFor(m.user);
    av.alt = (m.user && m.user.name) || 'Fan';
    av.onerror = function () { this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent((m.user && m.user.name) || 'Fan') + '&background=2196f3&color=fff&size=64'; };

    const body = document.createElement('div');
    body.className = 'min-w-0 flex-1';

    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-2 mb-0.5';
    meta.innerHTML = '<span class="text-xs font-semibold text-gray-800 dark:text-white">' + escapeHtml((m.user && m.user.name) || 'Fan') + '</span><span class="text-[10px] text-gray-400">' + timeStr(m.time) + '</span>';
    body.appendChild(meta);

    const content = document.createElement('div');
    if (m.kind === 'image') {
      const img = document.createElement('img');
      img.src = m.image;
      img.className = 'max-w-[220px] rounded-lg border border-gray-200 dark:border-white/10 cursor-pointer';
      img.addEventListener('click', () => window.open(m.image, '_blank'));
      content.appendChild(img);
      if (m.text) {
        const cap = document.createElement('p');
        cap.className = 'text-sm text-gray-700 dark:text-gray-200 mt-1';
        cap.textContent = m.text;
        content.appendChild(cap);
      }
    } else if (m.kind === 'sticker') {
      const st = document.createElement('div');
      st.className = 'text-5xl leading-none';
      st.textContent = m.sticker;
      content.appendChild(st);
    } else {
      const p = document.createElement('p');
      p.className = 'text-sm text-gray-700 dark:text-gray-200 break-words';
      p.textContent = m.text || '';
      content.appendChild(p);
    }
    body.appendChild(content);

    // React + Reply actions
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-3 mt-1 text-[11px] text-gray-400';
    const likeBtn = document.createElement('button');
    likeBtn.className = 'hover:text-blue-500 transition flex items-center gap-1';
    const likeCount = document.createElement('span');
    likeCount.textContent = (m.likes || 0);
    likeBtn.innerHTML = '👍 <span class="lc">' + (m.likes || 0) + '</span>';
    likeBtn.addEventListener('click', () => {
      const span = likeBtn.querySelector('.lc');
      let n = parseInt(span.textContent, 10) || 0; n += 1; span.textContent = n;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'react', messageId: m.id, emoji: '👍' }));
    });
    const replyBtn = document.createElement('button');
    replyBtn.className = 'hover:text-blue-500 transition';
    replyBtn.textContent = '↩ Reply';
    replyBtn.addEventListener('click', () => {
      if (inputEl) { inputEl.value = '@' + ((m.user && m.user.name) || 'Fan') + ' '; inputEl.focus(); }
    });
    actions.appendChild(likeBtn);
    actions.appendChild(replyBtn);
    body.appendChild(actions);

    // Seen indicator (only meaningful for own messages)
    const seenEl = document.createElement('div');
    seenEl.className = 'text-[10px] text-gray-400 mt-0.5 seen-line';
    seenEl.dataset.msgId = m.id || '';
    if (isMe && m.seenBy && m.seenBy.length) {
      seenEl.textContent = '✓✓ Seen by ' + m.seenBy.length;
    } else if (isMe) {
      seenEl.textContent = '✓ Sent';
    }
    body.appendChild(seenEl);

    if (isMe) { wrap.classList.add('flex-row-reverse'); body.classList.add('text-right'); meta.classList.add('justify-end'); }
    wrap.appendChild(av);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderSystem(text, user) {
    const d = document.createElement('div');
    d.className = 'flex items-center justify-center gap-2 my-2';
    if (user && user.img) {
      const av = document.createElement('img');
      av.src = user.img;
      av.className = 'w-5 h-5 rounded-full border border-gray-200 dark:border-white/10';
      av.alt = '';
      av.onerror = function () { this.style.display = 'none'; };
      d.appendChild(av);
    }
    const span = document.createElement('span');
    span.className = 'text-[11px] text-gray-400 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full';
    span.textContent = text;
    d.appendChild(span);
    messagesEl.appendChild(d);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---- Sending ----
  function sendPayload(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', payload }));
    } else if (fallback) {
      const m = Object.assign({ user: me, time: Date.now(), mine: true, likes: 0 }, payloadToMessage(payload));
      renderMessage(m);
    }
  }
  function payloadToMessage(p) {
    if (p.kind === 'image') return { kind: 'image', image: p.image, text: p.text };
    if (p.kind === 'sticker') return { kind: 'sticker', sticker: p.sticker };
    return { kind: 'text', text: p.text };
  }
  function sendText() {
    const v = inputEl.value.trim();
    if (!v) return;
    sendPayload({ kind: 'text', text: v });
    inputEl.value = '';
  }
  sendBtn.addEventListener('click', sendText);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendText(); });

  imgBtn.addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', () => {
    const file = imgInput.files && imgInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => sendPayload({ kind: 'image', image: reader.result, text: '' });
    reader.readAsDataURL(file);
    imgInput.value = '';
  });

  // ---- WebSocket ----
  let fallback = false;
  let retry = 0;
  const MAX_RETRY = 4;

  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'text-[10px] px-2 py-0.5 rounded-full ' + (cls || 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400');
  }

  function connect() {
    try {
      // Match id is driven by the Match Center URL params (sport/home/away/state)
      // so the chat room matches the match being viewed.
      const _p = new URLSearchParams(location.search);
      const _mid = _p.get('match') || (_p.get('sport') || 'cricket') + '-' + (_p.get('home') || 'ind') + '-' + (_p.get('away') || 'eng');
      ws = new WebSocket(WS_URL + '?match=' + encodeURIComponent(_mid));
      ws.onopen = () => {
        retry = 0; fallback = false; setStatus('live', 'bg-emerald-500/20 text-emerald-400');
        refreshIdentity();
        // Wait for the real Firebase/Firestore profile before identifying, so the
        // join message shows the real database name (not a placeholder). Fall back
        // after 1.5s if auth hasn't resolved yet.
        let identified = false;
        const doIdentify = () => {
          if (identified) return;
          identified = true;
          refreshIdentity();
          ws.send(JSON.stringify({ type: 'identify', user: { name: me.name, img: me.img } }));
        };
        // Wait until the real Firestore profile is resolved (it has a non-empty
        // `username`, unlike the early auth-only placeholder). Fall back after 2s.
        const profileReady = () => window.currentUserProfile && window.currentUserProfile.username && window.currentUserProfile.name && window.currentUserProfile.name !== 'You';
        if (profileReady()) {
          doIdentify();
        } else {
          let waited = 0;
          const iv = setInterval(() => {
            waited += 100;
            if (profileReady() || waited >= 2000) {
              clearInterval(iv); doIdentify();
            }
          }, 100);
        }
      };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.type === 'connected') {
          (m.recentMessages || []).forEach(renderMessage);
          if (m.onlineCount != null && onlineEl) onlineEl.textContent = m.onlineCount;
        } else if (m.type === 'identified') {
          if (m.user && m.user.name) me.name = m.user.name;
          if (m.user && m.user.img) me.img = m.user.img;
        } else if (m.type === 'message') {
          renderMessage(m);
          // Mark others' messages as seen (until match is live)
          if (m.id && !(m.user && m.user.id === me.id) && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'seen', messageId: m.id }));
          }
        } else if (m.type === 'seen_update') {
          const node = renderedMessages[m.messageId];
          if (node) {
            const line = node.querySelector('.seen-line');
            if (line) line.textContent = '✓✓ Seen by ' + (m.seenBy ? m.seenBy.length : 1);
          }
        } else if (m.type === 'system') {
          renderSystem(m.text, m.user);
        } else if (m.type === 'online_count') {
          if (onlineEl) onlineEl.textContent = m.onlineCount;
        } else if (m.type === 'typing') {
          if (m.isTyping && m.userName) {
            typingEl.textContent = m.userName + ' is typing…';
            clearTimeout(typingEl._t);
            typingEl._t = setTimeout(() => typingEl.textContent = '', 2000);
          }
        }
      };
      ws.onclose = () => { if (retry < MAX_RETRY) { retry++; setTimeout(connect, 1500); } else enableFallback(); };
      ws.onerror = () => { try { ws.close(); } catch (e) {} };
    } catch (e) { enableFallback(); }
  }

  function enableFallback() {
    fallback = true;
    setStatus('offline (local)', 'bg-amber-500/20 text-amber-400');
    renderSystem('Chat server offline — showing local demo mode. Start the backend (cd backend && npm start) for real-time chat.');
  }

  connect();

  // ---- System asks match-related questions periodically ----
  (function scheduleSystemQuestions() {
    const s = getMatchState();
    const homeN = (window.FANCONNECT_MATCHES && window.FANCONNECT_MATCHES.TEAMS && window.FANCONNECT_MATCHES.TEAMS[s.home] && window.FANCONNECT_MATCHES.TEAMS[s.home].name) || s.home.toUpperCase();
    const awayN = (window.FANCONNECT_MATCHES && window.FANCONNECT_MATCHES.TEAMS && window.FANCONNECT_MATCHES.TEAMS[s.away] && window.FANCONNECT_MATCHES.TEAMS[s.away].name) || s.away.toUpperCase();
    const Q = [
      'Who do you think wins the toss? 🏏',
      'Predict the ' + (s.sport === 'football' ? 'first goal' : s.sport === 'cricket' ? 'top scorer' : 'MVP') + '?',
      homeN + ' or ' + awayN + ' — who takes this one? 🔥',
      'What is your key player to watch today? ⭐',
      'Rate the first innings/quarter out of 10!',
      'Big moment coming up — who steps up? 💪'
    ];
    let qi = 0;
    const ask = () => {
      const q = Q[qi % Q.length]; qi++;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'system', text: q }));
      } else if (fallback) {
        renderSystem(q, { img: '' });
      }
    };
    setTimeout(ask, 6000);
    setInterval(ask, 45000);
  })();
})();
