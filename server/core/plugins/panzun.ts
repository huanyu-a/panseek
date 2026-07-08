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

const SEARCH_URL = "https://www.panzun.cc/api/discussions?filter[q]=";

export class PanzunPlugin extends BaseAsyncPlugin {
  constructor() {
    super("panzun", 2);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "&page[offset]=0";
    const { results } = await searchWithDetailPages(url, {
      maxDetails: 6,
      timeout: 8000,
      detailTimeout: 6000,
    });
    // 设置 pluginName
    for (const r of results) {
      r.unique_id = r.unique_id.replace('plugin-', 'panzun-');
    }
    return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }
}

