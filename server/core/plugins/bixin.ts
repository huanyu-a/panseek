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

const SEARCH_URL = "https://www.bixbiy.com/api/discussions?filter[q]=";

export class BixinPlugin extends BaseAsyncPlugin {
  constructor() {
    super("bixin", 3);
  }
  override skipServiceFilter(): boolean {
    return true;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "&include=mostRelevantPost&page[offset]=0&page[limit]=20";
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, 'bixin', keyword);
    return results;
    } catch {
      return [];
    }
  }
}

