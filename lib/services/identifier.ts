import { Card } from '@/models/Card';
import { Project } from '@/models/Project';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache with expiration
 */
class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;

  constructor(ttlMs: number = 5 * 60 * 1000) { // Default 5 minutes TTL
    this.ttl = ttlMs;
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Service for resolving various entities by their identifiers.
 * Supports both MD5 hash-based IDs and slugs for flexible lookup.
 */
export class IdentifierService {
  private static cardCache = new Cache<any>();
  private static projectCache = new Cache<any>();
  /**
   * Resolves a card by either its MD5 hash ID or slug
   * @param identifier - Either a 32-character MD5 hash or a slug string
   * @returns The matching Card document or null if not found
   */
  static async resolveCard(identifier: string) {
    // Check cache first
    const cached = this.cardCache.get(identifier);
    if (cached) return cached;

    const isHash = /^[a-f0-9]{32}$/i.test(identifier);
    const query = isHash 
      ? { _id: identifier }
      : { slug: identifier };
    
    const card = await Card.findOne(query);
    if (card) {
      this.cardCache.set(identifier, card);
    }
    return card;
  }

  /**
   * Resolves a project by either its MD5 hash ID or slug
   * @param identifier - Either a 32-character MD5 hash or a slug string
   * @returns The matching Project document or null if not found
   */
  static async resolveProject(identifier: string) {
    // Check cache first
    const cached = this.projectCache.get(identifier);
    if (cached) return cached;

    const isHash = /^[a-f0-9]{32}$/i.test(identifier);
    const query = isHash 
      ? { _id: identifier }
      : { slug: identifier };
    
    const project = await Project.findOne(query);
    if (project) {
      this.projectCache.set(identifier, project);
    }
    return project;
  }
}
