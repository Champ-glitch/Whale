// lib/webpush.js
import webpush from 'web-push';
import { listPushSubscriptions, removePushSubscription } from './kv';

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushToAllDevices(payload) {
  if (!configured) {
    console.warn('VAPID keys not set - skipping push notification.');
    return;
  }

  const subs = await listPushSubscriptions();
  if (!subs.length) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        // 410/404 means the subscription is dead (uninstalled, expired) - clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await removePushSubscription(sub.id);
        } else {
          console.error('Push send error:', err.message);
        }
      }
    })
  );
}
