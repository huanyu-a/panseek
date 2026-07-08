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

const SEARCH_URL = "https://miaosou.fun/api/secendsearch?name=";

export class MiaosoPlugin extends BaseAsyncPlugin {
  constructor() {
    super("miaoso", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "&pageNo=1";
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, 'miaoso', keyword);
    return results;
    } catch {
      return [];
    }
  }
}

