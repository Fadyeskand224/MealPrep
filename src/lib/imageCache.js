// Keeps food photos loaded for the whole session so they never flicker or fall back
// to emoji when you switch tabs. Failed loads are retried with backoff and are NOT
// remembered, so the next time a photo is shown it gets another chance.

const done = new Set();      // ids whose photo is fully loaded
const pending = new Map();   // id -> Promise<boolean>
const keep = [];             // hold Image objects so the decoded bitmap stays cached

export const photoUrl = (id) => `/food/${id}.jpg`;
export const isLoaded = (id) => done.has(id);

export function loadPhoto(id) {
  if (done.has(id)) return Promise.resolve(true);
  if (pending.has(id)) return pending.get(id);

  const attemptLoad = (attempt) =>
    new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        done.add(id);
        keep.push(img);
        resolve(true);
      };
      img.onerror = () => {
        if (attempt >= 3) return resolve(false);
        setTimeout(() => attemptLoad(attempt + 1).then(resolve), 400 * 2 ** attempt);
      };
      img.src = photoUrl(id);
    });

  const p = attemptLoad(0).then((ok) => {
    pending.delete(id); // on failure, allow a fresh retry the next time it is shown
    return ok;
  });
  pending.set(id, p);
  return p;
}

/** Warm the cache in the background, a few at a time, so every tab is instant. */
export function preloadAll(ids, concurrency = 4) {
  const queue = ids.filter((id) => !done.has(id));
  const worker = async () => {
    while (queue.length) await loadPhoto(queue.shift());
  };
  const start = () => Array.from({ length: concurrency }, worker);
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 500);
}
