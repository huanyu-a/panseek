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

const SEARCH_URL = "https://quark4k.com/api/discussions?include=user%2ClastPostedUser%2CmostRelevantPost%2CmostRelevantPost.user%2Ctags%2Ctags.parent%2CfirstPost&filter[q]=";

export class Quark4kPlugin extends BaseAsyncPlugin {
  constructor() {
    super("quark4k", 3);
  }
  override skipServiceFilter(): boolean {
    return true;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
    const url = SEARCH_URL + encodeURIComponent(keyword) + "&sort&page[offset]=0&page[limit]=20";
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, 'quark4k', keyword);
    return results;
    } catch {
      return [];
    }
  }
}

