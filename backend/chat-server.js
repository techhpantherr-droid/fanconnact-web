const { WebSocketServer } = require('ws');
const https = require('https');

const CHAT_HISTORY_LIMIT = 100;
// Chat history is PER MATCH ROOM — rooms never share messages.
const messageHistory = {};
function roomHistory(matchId) {
  const key = matchId || 'default';
  if (!messageHistory[key]) messageHistory[key] = [];
  return messageHistory[key];
}
function pushHistory(matchId, message) {
  const hist = roomHistory(matchId);
  hist.push(message);
  if (hist.length > CHAT_HISTORY_LIMIT) {
    messageHistory[matchId || 'default'] = hist.slice(-CHAT_HISTORY_LIMIT);
  }
}
let onlineUsers = new Map();
let userCounter = 0;

const SPORT_EMOJIS = {
  cricket: ['🏏', '🏆', '🔥', '💥', '🎯', '👏', '💪', '⭐'],
  football: ['⚽', '🥅', '🔥', '💪', '👏', '🎯', '⭐', '🏆'],
  basketball: ['🏀', '🔥', '💪', '👏', '🎯', '⭐', '🏆', '💥'],
  tennis: ['🎾', '🔥', '💪', '👏', '🎯', '⭐', '🏆', '💥'],
};

function getRandomEmojis(sport) {
  const emojis = SPORT_EMOJIS[sport] || SPORT_EMOJIS.cricket;
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function getSportFromMatchId(matchId) {
  if (!matchId) return 'cricket';
  const sportPrefixes = ['cricket', 'football', 'basketball', 'tennis', 'baseball', 'hockey', 'vollyeball', 'kabbaddi', 'e-sports', 'tabletennis'];
  for (const prefix of sportPrefixes) {
    if (matchId.startsWith(prefix)) return prefix;
  }
  return 'cricket';
}

// Resolve a real player photo from Wikipedia (cached). Falls back to initials avatar.
const WIKI_AVATAR_CACHE = {};
function wikiAvatar(name, fallbackBg) {
  const key = (name || '').toLowerCase();
  if (WIKI_AVATAR_CACHE[key]) return WIKI_AVATAR_CACHE[key];
  const fb = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'Fan') + '&background=' + (fallbackBg || '2196f3') + '&color=fff&size=64';
  WIKI_AVATAR_CACHE[key] = fb;
  const searchUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(name + ' cricketer') + '&format=json&origin=*&srlimit=1';
  https.get(searchUrl, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const title = data.query && data.query.search && data.query.search[0] && data.query.search[0].title;
        if (!title) return;
        https.get('https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(title) + '&prop=pageimages&format=json&origin=*&pithumbsize=200', r2 => {
          let b2 = '';
          r2.on('data', d => b2 += d);
          r2.on('end', () => {
            try {
              const d2 = JSON.parse(b2);
              const pages = d2.query && d2.query.pages ? d2.query.pages : {};
              for (const p in pages) {
                if (pages[p].thumbnail && pages[p].thumbnail.source) {
                  WIKI_AVATAR_CACHE[key] = pages[p].thumbnail.source;
                }
              }
            } catch (e) {}
          });
        }).on('error', () => {});
      } catch (e) {}
    });
  }).on('error', () => {});
  return fb;
}

function createSystemMessage(text, user) {
  return {
    type: 'system',
    text,
    user: user || null,
    time: Date.now(),
    id: 'sys_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  };
}

function createUserMessage(user, payload, matchId) {
  const msg = {
    type: 'message',
    matchId: matchId || 'default',
    user: {
      name: user.name,
      img: user.img,
      id: user.id,
      cid: user.cid || null
    },
    time: Date.now(),
    likes: 0,
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  };
  if (payload.kind === 'image' && payload.image) {
    msg.kind = 'image';
    msg.image = String(payload.image).slice(0, 1500000); // cap ~1.5MB data URL
    if (payload.text) msg.text = String(payload.text).slice(0, 200);
  } else if (payload.kind === 'sticker' && payload.sticker) {
    msg.kind = 'sticker';
    msg.sticker = String(payload.sticker).slice(0, 16);
  } else {
    msg.kind = 'text';
    msg.text = String(payload.text || '').slice(0, 500);
  }
  msg.seenBy = []; // ids of users who have seen this message
  return msg;
}

function getOnlineCount() {
  let count = 0;
  onlineUsers.forEach(u => { if (u.alive) count++; });
  return count || onlineUsers.size;
}

// ---- Per-room unique members (no fake online users) ----
// roomMembers: matchId -> Map(identityKey -> { ws, user }).
// One slot per real identity per room: same user rejoining (reload, second
// tab, reconnect) replaces the old socket instead of inflating the count.
// leaveTimers delay the leave announcement so quick reconnects stay silent.
const roomMembers = new Map();
const leaveTimers = new Map();

function identityKey(user, fallbackId) {
  const uid = user && user.uid ? String(user.uid).slice(0, 80) : '';
  return uid || ('conn:' + fallbackId);
}
function roomCount(matchId) {
  const room = roomMembers.get(matchId);
  return room ? room.size : 0;
}

function createChatServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const matchId = new URL(req.url, 'http://localhost').searchParams.get('match') || 'default';
    ws.matchId = matchId;
    const sport = getSportFromMatchId(matchId);
    userCounter++;
    const userId = 'user_' + userCounter;
    const userColors = ['#2196f3', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const userName = 'Fan_' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const userAvatar = `https://ui-avatars.com/api/?name=${userName}&background=${userColors[userCounter % userColors.length].replace('#', '')}&color=fff&size=32`;
    const user = { name: userName, img: userAvatar, id: userId, color: userColors[userCounter % userColors.length] };

    onlineUsers.set(ws, { name: userName, id: userId, alive: true, matchId });
    ws.isAlive = true;

    ws.send(JSON.stringify({
      type: 'connected',
      user,
      onlineCount: roomCount(matchId),
      recentMessages: roomHistory(matchId).slice(-30)
    }));

    // Announce join only AFTER the client identifies with its real profile
    // (so the join/leave message shows the real name + photo, not the temp Fan_XXXX).
    let announced = false;
    const announceJoin = () => {
      if (announced) return;
      announced = true;
      const joinMsg = createSystemMessage(`👋 ${user.name} joined the chat`, { name: user.name, img: user.img });
      broadcast(wss, joinMsg, matchId);
    };
    // Fallback: if the client never identifies, announce with the temp name after 1.2s
    const joinTimer = setTimeout(announceJoin, 1200);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'identify' && msg.user) {
          // Client sends its real profile (name + photo + stable uid) from Firebase.
          // Same identity rejoining (reload/second tab/reconnect) REPLACES the old
          // socket in this room: no duplicate online slot, no repeated join spam.
          if (msg.user.name) user.name = String(msg.user.name).slice(0, 40);
          if (msg.user.img) user.img = String(msg.user.img).slice(0, 2000);
          if (msg.user.uid) user.uid = String(msg.user.uid).slice(0, 80);
          if (msg.user.cid) user.cid = String(msg.user.cid).slice(0, 40);
          user.key = identityKey(user, userId);
          onlineUsers.set(ws, { name: user.name, id: userId, alive: true, matchId });
          let room = roomMembers.get(matchId);
          if (!room) { room = new Map(); roomMembers.set(matchId, room); }
          const timerKey = matchId + '::' + user.key;
          if (leaveTimers.has(timerKey)) {
            clearTimeout(leaveTimers.get(timerKey));
            leaveTimers.delete(timerKey);
          }
          const existing = room.get(user.key);
          ws.send(JSON.stringify({ type: 'identified', user }));
          clearTimeout(joinTimer);
          if (existing && existing.ws !== ws) {
            try { existing.ws.replaced = true; } catch (e) {}
            room.set(user.key, { ws, user });
            announced = true; // silent rejoin: already announced earlier
          } else {
            room.set(user.key, { ws, user });
            announceJoin();
          }
          broadcast(wss, { type: 'online_count', onlineCount: room.size }, matchId);
          return;
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (msg.type === 'message' && msg.payload) {
          const message = createUserMessage(user, msg.payload, matchId);
          pushHistory(matchId, message);
          broadcast(wss, message, matchId);
        }

        if (msg.type === 'system' && msg.text) {
          // Client-sent system question (e.g. match poll). Broadcast to room.
          broadcast(wss, createSystemMessage(String(msg.text).slice(0, 200), { name: 'FanConnect', img: '' }), matchId);
        }

        if (msg.type === 'react' && msg.messageId) {
          const target = roomHistory(matchId).find(m => m.id === msg.messageId);
          if (target && target.type === 'message') {
            target.likes = (target.likes || 0) + 1;
            broadcast(wss, {
              type: 'like_update',
              messageId: msg.messageId,
              likes: target.likes
            }, matchId);
          }
        }

        if (msg.type === 'like' && msg.messageId) {
          const target = roomHistory(matchId).find(m => m.id === msg.messageId);
          if (target && target.type === 'message') {
            target.likes = (target.likes || 0) + 1;
            broadcast(wss, {
              type: 'like_update',
              messageId: msg.messageId,
              likes: target.likes
            }, matchId);
          }
        }

        if (msg.type === 'typing') {
          broadcast(wss, {
            type: 'typing',
            userId: userId,
            userName: userName,
            isTyping: msg.isTyping
          }, matchId);
        }

        if (msg.type === 'seen' && msg.messageId) {
          const target = roomHistory(matchId).find(m => m.id === msg.messageId);
          if (target && target.type === 'message' && !target.seenBy.includes(userId)) {
            target.seenBy.push(userId);
            broadcast(wss, {
              type: 'seen_update',
              messageId: msg.messageId,
              seenBy: target.seenBy
            }, matchId);
          }
        }
      } catch (e) {
        // ignore invalid messages
      }
    });

    ws.on('close', () => {
      onlineUsers.delete(ws);
      const room = roomMembers.get(matchId);
      const slot = (user.key && room) ? room.get(user.key) : null;
      if (slot && slot.ws === ws && !ws.replaced) {
        // Grace period: a quick reconnect replaces this socket silently,
        // so leave spam + fake count jumps never appear.
        const timerKey = matchId + '::' + user.key;
        const t = setTimeout(() => {
          leaveTimers.delete(timerKey);
          const r2 = roomMembers.get(matchId);
          if (r2 && r2.get(user.key) && r2.get(user.key).ws === ws) {
            r2.delete(user.key);
            broadcast(wss, createSystemMessage(`🚶 ${user.name} left the chat`, { name: user.name, img: user.img }), matchId);
            broadcast(wss, { type: 'online_count', onlineCount: r2.size }, matchId);
          }
        }, 15000);
        leaveTimers.set(timerKey, t);
      } else {
        const r3 = roomMembers.get(matchId);
        broadcast(wss, { type: 'online_count', onlineCount: r3 ? r3.size : 0 }, matchId);
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
      const rec = onlineUsers.get(ws);
      if (rec) rec.alive = true;
    });

    ws.on('error', () => {
      onlineUsers.delete(ws);
    });
  });

  // Real heartbeat: drop dead sockets so ghost users never linger online.
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.readyState !== ws.OPEN) return;
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch (e) {}
        return;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch (e) {}
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

function broadcast(wss, message, matchId) {
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN && (client.matchId || 'default') === matchId) {
      client.send(data);
    }
  });
}

module.exports = { createChatServer, broadcast };
