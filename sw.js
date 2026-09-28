/* 一起练 Service Worker
 * 职责：
 *  1. 让 App 可安装、离线可打开（缓存应用外壳）。
 *  2. 接收页面 postMessage 传来的当日提醒计划，尽力而为地用
 *     Notification API 触发提醒（移动端 SW 常被系统回收，
 *     所以这是"尽力"路径；可靠路径是页面打开时的 in-page 定时器）。
 */
const CACHE_NAME = 'yiqilian-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 同源 GET：缓存优先，兜底网络；CDN 脚本走网络（不缓存第三方）。
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return resp;
      });
    })
  );
});

/* ---------- 提醒计划（尽力路径） ---------- */
let reminderPlan = null; // { date: 'YYYY-MM-DD', times: ['08:12', ...] }
let reminderTimers = [];

function clearReminderTimers() {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
}

function armReminders() {
  clearReminderTimers();
  if (!reminderPlan || !Array.isArray(reminderPlan.times)) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // SW 用 UTC 日期做粗略兜底
  reminderPlan.times.forEach((t) => {
    const [h, m] = t.split(':').map(Number);
    const fireAt = new Date(now);
    fireAt.setHours(h, m, 0, 0);
    const delay = fireAt.getTime() - now.getTime();
    if (delay <= 0) return;
    // setTimeout 上限约 24.8 天，这里最长不到 24 小时，安全。
    reminderTimers.push(setTimeout(() => fireReminder(t), delay));
  });
}

function fireReminder(timeStr) {
  const title = '一起练 · 该运动啦 💪';
  const options = {
    body: `今天第 ${timeStr} 次提醒：起来动一动，点我打开一起练`,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'yiqilian-reminder-' + timeStr,
    renotify: true,
  };
  if (self.Notification && self.Notification.permission === 'granted') {
    self.registration.showNotification(title, options);
  }
  // 通知页面：标记这次提醒已触发（页面打开时的定时器会跳过已触发项）
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) => c.postMessage({ type: 'REMINDER_FIRED', time: timeStr }));
  });
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SET_REMINDERS') {
    reminderPlan = { date: data.date, times: data.times };
    armReminders();
  } else if (data.type === 'CLEAR_REMINDERS') {
    reminderPlan = null;
    clearReminderTimers();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
