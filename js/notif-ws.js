(function() {
  'use strict';

  var notifWs = null;
  var wsConnected = false;
  var notifCount = 0;
  var reconnectTimer = null;
  var retryCount = 0;
  var MAX_RETRIES = 5;

  function getNotifBadge() {
    return document.getElementById('notifBadge');
  }

  function updateBadge(count) {
    var badge = getNotifBadge();
    if (!badge) return;
    notifCount = count;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function showToast(notif) {
    var existing = document.getElementById('notifToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'notifToast';
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e293b;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;max-width:320px;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;animation:slideInUp 0.3s ease;cursor:pointer';
    toast.onclick = function() {
      window.location.href = 'notification.html';
    };
    toast.innerHTML = '<span style="font-size:20px">' + (notif.icon || '🔔') + '</span><div style="flex:1;min-width:0"><p style="margin:0;font-size:12px;font-weight:700">' + notif.title + '</p><p style="margin:2px 0 0;font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + notif.message + '</p></div><span style="cursor:pointer;font-size:14px;color:#64748b" onclick="event.stopPropagation();this.parentElement.remove()">✕</span>';
    document.body.appendChild(toast);

    setTimeout(function() {
      if (toast.parentElement) {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(function() { if (toast.parentElement) toast.remove(); }, 300);
      }
    }, 5000);
  }

  function connectNotifWS() {
    if (retryCount >= MAX_RETRIES) return;
    retryCount++;

    try {
      var url = (window.FC_API ? window.FC_API.ws() : 'ws://localhost:5000') + '/ws/notifications';
      notifWs = new WebSocket(url);

      notifWs.onopen = function() {
        wsConnected = true;
        retryCount = 0;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      };

      notifWs.onmessage = function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'notif_history') {
            var unread = (data.notifications || []).filter(function(n) { return !n.read; }).length;
            updateBadge(unread);
          } else if (data.type === 'new_notification') {
            var n = data.notification;
            if (!n.read) {
              updateBadge(notifCount + 1);
              showToast(n);
            }
          }
        } catch(e) {}
      };

      notifWs.onclose = function() {
        wsConnected = false;
        if (!reconnectTimer && retryCount < MAX_RETRIES) {
          reconnectTimer = setTimeout(function() {
            reconnectTimer = null;
            connectNotifWS();
          }, 10000);
        }
      };

      notifWs.onerror = function() {
        if (notifWs && notifWs.readyState !== WebSocket.CLOSED && notifWs.readyState !== WebSocket.CLOSING) {
          notifWs.close();
        }
      };
    } catch(e) {}
  }

  function addBadges() {
    document.querySelectorAll('.notification-trigger').forEach(function(trigger) {
      if (!trigger.querySelector('#notifBadge')) {
        var badge = document.createElement('span');
        badge.id = 'notifBadge';
        badge.style.cssText = 'display:none;position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;border-radius:50%;align-items:center;justify-content:center;border:2px solid var(--card-bg,#fff);z-index:5';
        badge.textContent = '0';
        trigger.style.position = 'relative';
        trigger.appendChild(badge);
      }
    });
  }

  var style = document.createElement('style');
  style.textContent = '@keyframes slideInUp {from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);

  function init() {
    addBadges();
    setTimeout(connectNotifWS, 2000);
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 100);
  }
})();
