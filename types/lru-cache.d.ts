declare module 'lru-cache' {
  export class LRUCache<K = any, V = any> {
    constructor(options?: LRUCache.Options<K, V>);
    set(key: K, value: V, options?: { ttl?: number }): boolean;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    clear(): void;
    has(key: K): boolean;
    forEach(callbackFn: (value: V, key: K, cache: LRUCache<K, V>) => void): void;
    keys(): Iterator<K>;
    values(): Iterator<V>;
    entries(): Iterator<[K, V]>;
    size: number;
  }

  namespace LRUCache {
    interface Options<K = any, V = any> {
      max?: number;
      ttl?: number;
      maxSize?: number;
      sizeCalculation?: (value: V, key: K) => number;
      dispose?: (value: V, key: K) => void;
      disposeAfter?: (value: V, key: K) => void;
      noDisposeOnSet?: boolean;
      updateAgeOnGet?: boolean;
      updateAgeOnHas?: boolean;
      allowStale?: boolean;
    }
  }
}
