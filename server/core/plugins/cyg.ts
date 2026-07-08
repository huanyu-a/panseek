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

const SEARCH_URL = "https://cyg.app/wp-json/wp/v2/posts";

export class CygPlugin extends BaseAsyncPlugin {
  constructor() {
    super("cyg", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword);
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, 'cyg', keyword);
    return results;
    } catch {
      return [];
    }
  }
}

