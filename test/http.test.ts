import test from 'node:test';
import assert from 'node:assert/strict';

import { resilientFetch } from '../src/http.ts';

// Fast timings so the suite doesn't wait out real timeouts
const fast = { timeoutMs: 30, retryDelaysMs: [1, 1] };

async function withFetch(stub: typeof fetch, fn: () => Promise<void>): Promise<void> {
  const orig = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test('GET passes through on the first try', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    return new Response('ok');
  }, async () => {
    assert.equal(await (await resilientFetch('https://x.test/', undefined, fast)).text(), 'ok');
  });
  assert.equal(calls, 1);
});

test('GET retries a network failure and then succeeds', async () => {
  let calls = 0;
  await withFetch(async () => {
    if (++calls === 1) throw new TypeError('fetch failed');
    return new Response('ok');
  }, async () => {
    assert.equal(await (await resilientFetch('https://x.test/', undefined, fast)).text(), 'ok');
  });
  assert.equal(calls, 2);
});

test('GET retries 5xx and then succeeds', async () => {
  let calls = 0;
  await withFetch(async () => {
    if (++calls < 3) return new Response('bad gateway', { status: 502 });
    return new Response('ok');
  }, async () => {
    assert.equal(await (await resilientFetch('https://x.test/', undefined, fast)).text(), 'ok');
  });
  assert.equal(calls, 3);
});

test('GET returns the last 5xx instead of throwing once retries run out', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    return new Response('unavailable', { status: 503 });
  }, async () => {
    assert.equal((await resilientFetch('https://x.test/', undefined, fast)).status, 503);
  });
  assert.equal(calls, 3);
});

test('GET on a hung server fails fast with a timeout message', async () => {
  let calls = 0;
  await withFetch((_url, init) => {
    calls++;
    // Behave like real fetch: reject when the abort signal fires
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')));
    });
  }, async () => {
    await assert.rejects(
      resilientFetch('https://x.test/slow', undefined, fast),
      /timed out after 30ms \(GET https:\/\/x\.test\/slow, attempt 3\/3\)/,
    );
  });
  assert.equal(calls, 3);
});

test('POST is never retried, so a timed-out write cannot land twice', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    throw new TypeError('fetch failed');
  }, async () => {
    await assert.rejects(resilientFetch('https://x.test/', { method: 'POST' }, fast), TypeError);
  });
  assert.equal(calls, 1);
});

test('POST returns 5xx as-is without retrying', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls++;
    return new Response('error', { status: 500 });
  }, async () => {
    assert.equal((await resilientFetch('https://x.test/', { method: 'POST' }, fast)).status, 500);
  });
  assert.equal(calls, 1);
});
