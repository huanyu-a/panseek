import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import {
  searchWithDetailPages,
  fetchJSON,
  extractResultsFromJSON,
  filterByKeyword,
  cleanHTML,
  createSearchResult,
} from "./pluginUtils";

const SEARCH_URL = (keyword: string) => `https://www.1lou.me/search-${keyword}.htm`;

export class Lou1Plugin extends BaseAsyncPlugin {
  constructor() {
    super("lou1", 1);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL(encodeURIComponent(keyword));
    const { results } = await searchWithDetailPages(url, {
      maxDetails: 6,
      timeout: 8000,
      detailTimeout: 6000,
    });
    // 设置 pluginName
    for (const r of results) {
      r.unique_id = r.unique_id.replace('plugin-', 'lou1-');
    }
    return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }
}

