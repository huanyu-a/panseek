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

const SEARCH_URL = "https://haisou.cc/api/pan/share/search?query=";

export class HaisouPlugin extends BaseAsyncPlugin {
  constructor() {
    super("haisou", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "&scope=title&pan=&page=1&filter_valid=true&filter_has_files=false";
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, 'haisou', keyword);
    return results;
    } catch {
      return [];
    }
  }
}

