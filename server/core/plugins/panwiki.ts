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

const SEARCH_URL = "https://www.panwiki.com/search.php?mod=forum&srchtxt=";

export class PanwikiPlugin extends BaseAsyncPlugin {
  constructor() {
    super("panwiki", 3);
  }
  override skipServiceFilter(): boolean {
    return true;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "&searchsubmit=yes&orderby=lastpost";
    const { results } = await searchWithDetailPages(url, {
      maxDetails: 6,
      timeout: 8000,
      detailTimeout: 6000,
    });
    // 设置 pluginName
    for (const r of results) {
      r.unique_id = r.unique_id.replace('plugin-', 'panwiki-');
    }
    return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }
}

