type CacheItem<T> = {
  metas: T[];
  extras?: string;
};

class LRUCache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): CacheItem<T> | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Move to end to show that it was recently used
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: string, value: CacheItem<T>): void {
    if (this.cache.size >= this.maxSize) {
      // Remove the oldest item
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

export const lruCache = new LRUCache<StremioMeta>(100);
