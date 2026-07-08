import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import {
  extractLinksFromHTML,
  filterByKeyword,
  cleanHTML,
  createSearchResult,
} from "./pluginUtils";

const BASE_URL = "https://www.66ss.org";
const SEARCH_PATH = "/e/search/1index.php";

export class Xb6vPlugin extends BaseAsyncPlugin {
  constructor() {
    super("xb6v", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      const formData = new URLSearchParams();
      formData.set("show", "title");
      formData.set("tempid", "1");
      formData.set("tbname", "article");
      formData.set("mid", "1");
      formData.set("dopost", "search");
      formData.set("submit", "");
      formData.set("keyboard", keyword);

      const html = await ofetch<string>(`${BASE_URL}${SEARCH_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": `${BASE_URL}/`,
        },
        body: formData.toString(),
        timeout: 8000,
        retry: 0,
      }).catch(() => "");

      if (!html) return [];

      const $ = load(html);
      const results: SearchResult[] = [];
      const seen = new Set<string>();

      // Try to find result items
      $("article, .post, .item, .entry, .card, .list-item, li").each((i, el) => {
        const $el = $(el);
        const titleEl = $el.find("h2 a, h3 a, .title a, .entry-title a, a").first();
        const title = titleEl.text().trim();
        const href = titleEl.attr("href") || "";
        if (!title || !href || seen.has(href)) return;
        seen.add(href);

        const links = extractLinksFromHTML($el.html() || "");
        if (links.length === 0) return;

        const detailUrl = href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`;
        results.push(createSearchResult({
          pluginName: "xb6v",
          id: `xb6v-${i}-${Date.now()}`,
          title,
          content: cleanHTML($el.text()).slice(0, 500),
          links,
        }));
      });

      // Also try direct links from the page
      if (results.length === 0) {
        const directLinks = extractLinksFromHTML(html);
        if (directLinks.length > 0) {
          results.push(createSearchResult({
            pluginName: "xb6v",
            id: `xb6v-direct-${Date.now()}`,
            title: "Search Result",
            content: cleanHTML(html).slice(0, 500),
            links: directLinks,
          }));
        }
      }

      return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new Xb6vPlugin());
