let intervalHandle: NodeJS.Timeout | null = null;
let initialized = false;

export function initKeepAlive() {
  if (initialized) return;
  initialized = true;

  const url = process.env.KEEP_ALIVE_URL?.trim();
  if (!url) return;

  const minutes = Math.max(1, parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES || '14', 10));
  const ms = minutes * 60 * 1000;

  console.log(`[Keep-Alive] Initialized self-ping every ${minutes}m to ${url}`);

  if (intervalHandle) clearInterval(intervalHandle);

  intervalHandle = setInterval(async () => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MopedMomos-KeepAlive/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      console.log(`[Keep-Alive] Pinged ${url} - status ${res.status}`);
    } catch (err) {
      console.warn(`[Keep-Alive] Self-ping failed:`, err instanceof Error ? err.message : err);
    }
  }, ms);

  // Unref so it does not block graceful process exit
  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
}
