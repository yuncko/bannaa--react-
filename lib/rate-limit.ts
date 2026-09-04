/**
 * In-memory sliding-window rate limiter for the generate endpoint.
 *
 * The endpoint is unauthenticated and every call spends provider credits, so an
 * unthrottled route is a direct billing risk. This is deliberately the simplest
 * thing that closes that hole: per-process counters, no dependencies.
 *
 * Its limits are worth stating plainly. State lives in the Node process, so it
 * resets on redeploy and is not shared across instances — on a multi-instance or
 * serverless deployment each instance enforces its own quota, making the real
 * limit `limit × instances`. It also keys on a client-supplied IP header, which
 * a determined caller can rotate. For real abuse protection this needs a shared
 * store (Redis, Upstash) or a platform WAF rule; this stops accidental loops and
 * casual scraping, which is what an open demo endpoint actually faces.
 */

interface Window {
  hits: number[];
  /** Wall-clock time of the last hit, used to expire idle keys. */
  seen: number;
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
/** Cap on tracked keys so a rotating-IP flood cannot grow the map without bound. */
const MAX_KEYS = 5_000;

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the oldest hit expires; only meaningful when blocked. */
  retryAfter: number;
  limit: number;
}

function sweep(now: number): void {
  for (const [key, win] of windows) {
    if (now - win.seen > WINDOW_MS) windows.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  limit: number = MAX_PER_WINDOW
): RateLimitResult {
  if (windows.size > MAX_KEYS) sweep(now);

  const cutoff = now - WINDOW_MS;
  const win = windows.get(key) ?? { hits: [], seen: now };
  const hits = win.hits.filter((t) => t > cutoff);

  if (hits.length >= limit) {
    windows.set(key, { hits, seen: now });
    const retryAfter = Math.max(1, Math.ceil((hits[0] + WINDOW_MS - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter, limit };
  }

  hits.push(now);
  windows.set(key, { hits, seen: now });
  return { allowed: true, remaining: limit - hits.length, retryAfter: 0, limit };
}

/**
 * Best-effort client identity from proxy headers.
 *
 * `x-forwarded-for` is client-controllable when the app is not behind a trusted
 * proxy, so this is an abuse-cost measure, not an identity check.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "unknown";
}

/** Test-only: drops all tracked windows. */
export function resetRateLimits(): void {
  windows.clear();
}
