/**
 * Optional FCM dispatch via firebase-admin when credentials are configured.
 * Never embeds secrets. No-op when FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS missing.
 */

let messaging = null;
let initAttempted = false;
let initError = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && String(raw).trim()) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      initError = `FIREBASE_SERVICE_ACCOUNT_JSON parse error: ${e.message}`;
      return null;
    }
  }
  return null;
}

function ensureMessaging() {
  if (initAttempted) return messaging;
  initAttempted = true;
  try {
    // Lazy require so the app boots without firebase-admin installed until configured
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length) {
      messaging = admin.messaging();
      return messaging;
    }
    const sa = getServiceAccount();
    if (sa) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      messaging = admin.messaging();
      return messaging;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      messaging = admin.messaging();
      return messaging;
    }
    initError = 'FCM disabled: set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS';
    return null;
  } catch (e) {
    initError = `FCM unavailable: ${e.message}. Install firebase-admin and provide credentials to enable push.`;
    return null;
  }
}

function fcmStatus() {
  ensureMessaging();
  return {
    enabled: Boolean(messaging),
    error: messaging ? null : initError,
  };
}

/**
 * Send to a list of FCM tokens. Returns delivery diagnostics; never throws to callers.
 */
async function sendToTokens(tokens, { title, body, data = {}, androidChannelId = 'safety_alerts' }) {
  const msg = ensureMessaging();
  if (!msg) {
    return { sent: 0, failed: 0, skipped: true, reason: initError || 'fcm_not_configured', invalidTokens: [] };
  }
  const list = (tokens || []).map((t) => String(t).trim()).filter(Boolean);
  if (list.length === 0) {
    return { sent: 0, failed: 0, skipped: true, reason: 'no_tokens', invalidTokens: [] };
  }

  const invalidTokens = [];
  let sent = 0;
  let failed = 0;

  // Prefer sendEachForMulticast when available
  try {
    const payload = {
      tokens: list,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
      android: {
        priority: 'high',
        notification: { channelId: androidChannelId },
      },
    };
    if (typeof msg.sendEachForMulticast === 'function') {
      const res = await msg.sendEachForMulticast(payload);
      sent = res.successCount || 0;
      failed = res.failureCount || 0;
      (res.responses || []).forEach((r, i) => {
        if (!r.success) {
          const code = r.error && r.error.code;
          if (code === 'messaging/registration-token-not-registered'
            || code === 'messaging/invalid-registration-token') {
            invalidTokens.push(list[i]);
          }
        }
      });
      return { sent, failed, skipped: false, invalidTokens };
    }
  } catch (e) {
    // fall through to per-token
  }

  for (const token of list) {
    try {
      await msg.send({
        token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
        android: {
          priority: 'high',
          notification: { channelId: androidChannelId },
        },
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      const code = e && e.code;
      if (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') {
        invalidTokens.push(token);
      }
    }
  }
  return { sent, failed, skipped: false, invalidTokens };
}

module.exports = {
  fcmStatus,
  sendToTokens,
  ensureMessaging,
};
