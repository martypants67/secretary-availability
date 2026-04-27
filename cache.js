export function createCache(ttlSeconds) {
  let entry = null;
  return {
    async get(loader) {
      const now = Date.now();
      if (entry && entry.expiresAt > now) return entry.value;
      const value = await loader();
      entry = { value, expiresAt: now + ttlSeconds * 1000 };
      return value;
    },
    invalidate() {
      entry = null;
    },
  };
}
