import type { IHotSearchStore, HotSearchItem, HotSearchStats } from "./hotSearchStore";
import { MemoryHotSearchStore } from "./memoryHotSearchStore";

let sharedMemoryStore: MemoryHotSearchStore | null = null;

function getOrCreateSharedMemoryStore(): MemoryHotSearchStore {
  if (!sharedMemoryStore) {
    sharedMemoryStore = new MemoryHotSearchStore();
  }
  return sharedMemoryStore;
}

async function tryCreateSqliteStore(): Promise<IHotSearchStore | null> {
  try {
    const { SqliteHotSearchStore } = await import("./sqliteHotSearchStore");
    const store = new SqliteHotSearchStore();
    await (store as any)["waitForInit"]?.();
    return store;
  } catch {
    return null;
  }
}

export class HotSearchService {
  private store: IHotSearchStore;
  private storeType: "sqlite" | "memory";
  private initPromise: Promise<void> | null = null;

  constructor() {
    const memoryStore = getOrCreateSharedMemoryStore();
    this.store = memoryStore;
    this.storeType = "memory";
    this.initPromise = this.initializeWithFallback();
  }

  private async initializeWithFallback(): Promise<void> {
    const sqliteStore = await tryCreateSqliteStore();
    if (sqliteStore) {
      this.store = sqliteStore;
      this.storeType = "sqlite";
      console.log("[HotSearchService] ✅ 使用 SQLite 存储模式");
    } else {
      console.log("[HotSearchService] ⚠️ SQLite 不可用，使用内存存储模式");
    }
  }

  private async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  async recordSearch(term: string): Promise<void> {
    await this.waitForInit();
    const now = Date.now();
    await this.store.recordSearch(term, now);
  }

  async getHotSearches(limit: number = 30): Promise<HotSearchItem[]> {
    await this.waitForInit();
    return this.store.getHotSearches(limit);
  }

  async clearHotSearches(): Promise<{ success: boolean; message: string }> {
    await this.waitForInit();
    return this.store.clearHotSearches();
  }

  async deleteHotSearch(term: string): Promise<{ success: boolean; message: string }> {
    await this.waitForInit();
    return this.store.deleteHotSearch(term);
  }

  async getStats(): Promise<{ total: number; topTerms: HotSearchItem[]; mode: string }> {
    await this.waitForInit();
    const stats = await this.store.getStats();
    return {
      ...stats,
      mode: this.storeType,
    };
  }

  getDatabaseSize(): number {
    if (this.storeType === "sqlite") {
      try {
        return (this.store as any).getDbSize?.() ?? 0;
      } catch { return 0; }
    }
    return 0;
  }

  getStoreType(): "sqlite" | "memory" {
    return this.storeType;
  }

  close(): void {
    this.store.close();
  }
}

const HOT_SEARCH_SERVICE_KEY = "__panseek_hot_search_service_v3__";

export function getOrCreateHotSearchService(): HotSearchService {
  const context = (globalThis as any)[HOT_SEARCH_SERVICE_KEY];
  if (context?.service) {
    return context.service;
  }

  const service = new HotSearchService();
  (globalThis as any)[HOT_SEARCH_SERVICE_KEY] = { service };
  return service;
}

export function resetHotSearchService(): void {
  const context = (globalThis as any)[HOT_SEARCH_SERVICE_KEY];
  if (context?.service) {
    context.service.close();
  }
  delete (globalThis as any)[HOT_SEARCH_SERVICE_KEY];
}

export type { HotSearchItem, HotSearchStats };
