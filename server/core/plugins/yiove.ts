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

const SEARCH_URL = "https://bbs.yiove.com/search-";

export class YiovePlugin extends BaseAsyncPlugin {
  constructor() {
    super("yiove", 3);
  }
  override skipServiceFilter(): boolean {
    return true;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "-1.htm";
    const { results } = await searchWithDetailPages(url, {
      maxDetails: 6,
      timeout: 8000,
      detailTimeout: 6000,
    });
    // 设置 pluginName
    for (const r of results) {
      r.unique_id = r.unique_id.replace('plugin-', 'yiove-');
    }
    return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }
}

