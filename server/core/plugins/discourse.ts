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

const SEARCH_URL = "https://linux.do/search.json?q=";

export class DiscoursePlugin extends BaseAsyncPlugin {
  constructor() {
    super("discourse", 2);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword);
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, 'discourse', keyword);
    return results;
    } catch {
      return [];
    }
  }
}

