import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import { extractLinksFromHTML, filterByKeyword, cleanHTML, createSearchResult } from "./pluginUtils";

const BASE_URL = "https://u3c3u3c3.u3c3u3c3u3c3.com";

export class U3c3Plugin extends BaseAsyncPlugin {
  constructor() {
    super("u3c3", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      // Step 1: Fetch the homepage to get the search2 parameter
      const homeHtml = await ofetch<string>(BASE_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 5000,
        retry: 0,
      }).catch(() => "");

      if (!homeHtml) return [];

      // Extract search2 parameter from the page
      let search2 = "";
      const search2Match = homeHtml.match(/search2=([a-zA-Z0-9]+)/);
      if (search2Match) {
        search2 = search2Match[1];
      } else {
        // Try to find it in script tags or data attributes
        const $ = load(homeHtml);
        const scriptText = $("script").text();
        const scriptMatch = scriptText.match(/search2["\s:=]+["']([a-zA-Z0-9]+)["']/);
        if (scriptMatch) search2 = scriptMatch[1];
      }

      if (!search2) return [];

      // Step 2: Search with the search2 parameter
      const searchUrl = `${BASE_URL}/?search2=${search2}&search=${encodeURIComponent(keyword)}`;
      const html = await ofetch<string>(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": `${BASE_URL}/`,
        },
        timeout: 8000,
        retry: 0,
      }).catch(() => "");

      if (!html) return [];

      // Extract links from the search results
      const $ = load(html);
      const results: SearchResult[] = [];
      const seen = new Set<string>();

      $("article, .post, .item, .entry, .card, .list-item, .search-result-item, li").each((i, el) => {
        const $el = $(el);
        const titleEl = $el.find("h2 a, h3 a, .title a, .entry-title a, a").first();
        const title = titleEl.text().trim();
        const href = titleEl.attr("href") || "";
        if (!title || seen.has(href || title)) return;
        seen.add(href || title);

        const links = extractLinksFromHTML($el.html() || "");
        if (links.length === 0) return;

        results.push(createSearchResult({
          pluginName: "u3c3",
          id: `u3c3-${i}-${Date.now()}`,
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
            pluginName: "u3c3",
            id: `u3c3-direct-${Date.now()}`,
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

registerGlobalPlugin(new U3c3Plugin());
