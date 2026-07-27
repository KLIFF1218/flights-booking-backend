#!/usr/bin/env node
/**
 * Phase 1: booking.created must NOT create an in-app notification or SSE push.
 * Verifies the notifications consumer skips checkout noise while SSE stays connected.
 */
const API = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const PASS = 'Password123!';
const TS = Date.now();
const EMAIL = `sse-verify-${TS}@test.local`;
const NOISE_WINDOW_MS = 5_000;

async function json(method, path, body, token, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findSearchOffer() {
  for (const offset of [2, 0, 3, 4, 5]) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    const dateFrom = d.toISOString().slice(0, 10);
    const search = await json('POST', '/flights/search', {
      directions: [{ origin: 'JFK', destination: 'SFO', dateFrom }],
      passengers: { adults: 1 },
      travelClass: 'ECONOMY',
      currencyCode: 'USD',
    });
    const offer = search.data?.data?.[0];
    if (offer?.offerId) {
      return { searchId: search.data.searchId, offerId: offer.offerId, dateFrom };
    }
  }
  throw new Error('No flight offers — run: docker exec max-airline-app-dev pnpm seed:demo');
}

async function collectSseEvents(token, durationMs) {
  const controller = new AbortController();
  const events = [];

  const streamPromise = (async () => {
    const res = await fetch(`${API}/users/me/notifications/stream`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`SSE connect failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        try {
          events.push(JSON.parse(line.replace(/^data:\s?/, '')));
        } catch {
          // ignore
        }
      }
    }
  })();

  await sleep(durationMs);
  controller.abort();
  await streamPromise.catch(() => {});

  return events;
}

async function main() {
  console.log('1. Register user...');
  const reg = await json('POST', '/auth/register', {
    email: EMAIL,
    password: PASS,
    firstName: 'SSE',
    lastName: 'Verify',
  });
  if (!reg.ok) throw new Error(`Register failed: ${reg.status} ${JSON.stringify(reg.data)}`);
  const token = reg.data.accessToken;

  console.log('2. Open SSE stream...');
  await sleep(500);

  console.log('3. Create booking (booking.created must NOT notify)...');
  const { searchId, offerId, dateFrom } = await findSearchOffer();
  console.log(`   date=${dateFrom} offer=${offerId}`);

  const before = await json('GET', '/users/me/notifications?unreadOnly=true&limit=10', null, token);
  const countBefore = Array.isArray(before.data) ? before.data.length : 0;

  const book = await json(
    'POST',
    '/booking',
    { searchId, offerId },
    token,
    { 'Idempotency-Key': `sse-verify-${TS}` },
  );
  if (!book.ok) throw new Error(`Booking failed: ${book.status} ${JSON.stringify(book.data)}`);
  const bookingId = book.data.id;
  console.log(`   bookingId=${bookingId}`);

  console.log(`4. Listen ${NOISE_WINDOW_MS / 1000}s — expect no notification.created SSE...`);
  const sseEvents = await collectSseEvents(token, NOISE_WINDOW_MS);
  const notificationSse = sseEvents.filter((e) => e.type === 'notification.created');

  const after = await json('GET', '/users/me/notifications?unreadOnly=true&limit=10', null, token);
  const notifications = Array.isArray(after.data) ? after.data : [];
  const created = notifications.find(
    (n) => n.bookingId === bookingId && n.type === 'BOOKING_CREATED',
  );

  console.log('\n=== RESULT ===');
  console.log(`unread before: ${countBefore} → after: ${notifications.length}`);
  console.log(`SSE notification.created events: ${notificationSse.length}`);
  console.log(`REST BOOKING_CREATED: ${created ? created.id : 'none (expected)'}`);

  if (created) {
    throw new Error('BOOKING_CREATED notification should not exist after booking.created');
  }
  if (notificationSse.length > 0) {
    throw new Error(
      `Unexpected SSE notification.created: ${JSON.stringify(notificationSse)}`,
    );
  }

  console.log('\n✅ Phase 1 verified: booking.created does not push in-app notifications.');
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
