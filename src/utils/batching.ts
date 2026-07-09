/** Splits an array into fixed-size chunks, preserving order. */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunkArray: size must be > 0');
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Runs `worker` over `items` with a bounded concurrency pool.
 * Keeps AI batch calls from overwhelming rate limits while still
 * parallelizing large CSV imports.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await worker(items[current], current);
    }
  }

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, runNext));
  return results;
}

/** Simple exponential backoff delay helper. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
