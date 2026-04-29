'use client';

import { supabase } from '@/lib/auth/supabase-client';

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) {
    return { ok: false, error: 'VAPID public key not configured' };
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, error: 'Service workers not supported' };
  }
  const perm = await requestPushPermission();
  if (perm !== 'granted') {
    return { ok: false, error: 'Notification permission denied' };
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
    const json = sub.toJSON();
    const keys = json.keys as { p256dh?: string; auth?: string };
    if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
      return { ok: false, error: 'Invalid subscription keys' };
    }

    const res = await fetch('/api/notifications/subscribe-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: (j as { error?: string }).error || res.statusText };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'subscribe_failed' };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON();
      await sub.unsubscribe();
      if (json.endpoint) {
        await fetch('/api/notifications/unsubscribe-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: json.endpoint }),
        });
      }
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'unsubscribe_failed' };
  }
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
