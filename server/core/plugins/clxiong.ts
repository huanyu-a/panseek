import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { load } from "cheerio";
import { filterByKeyword } from "./pluginUtils";

const BASE_URL = "https://www.cilixiong.org";
const SEARCH_URL = "https://www.cilixiong.org/e/search/index.php";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const MAX_RESULTS = 20;
const MAX_DETAILS = 5;
const FETCH_TIMEOUT = 6000;

interface DetailInfo {
  magnetLinks: { url: string; fileName: string }[];
  updateTime: string;
}

export class ClxiongPlugin extends BaseAsyncPlugin {
  constructor() {
    super("clxiong", 2);
  }
  override skipServiceFilter(): boolean {
    return true;
  }

  override async search(
    keyword: string,
    ext?: Record<string, any>
  ): Promise<SearchResult[]> {
    const signal = ext?.signal as AbortSignal | undefined;
    try {
      // Step 1: POST to get searchid via 302 redirect
      const formData = new URLSearchParams();
      formData.set("classid", "1,2");
      formData.set("show", "title");
      formData.set("tempid", "1");
      formData.set("keyboard", keyword);

      const resp = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: BASE_URL + "/",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        body: formData.toString(),
        redirect: "manual",
        signal,
      }).catch(() => null);

      if (!resp) return [];

      const location = resp.headers.get("location") || "";
      const searchIdMatch = location.match(/searchid=(\d+)/);
      if (!searchIdMatch || !searchIdMatch[1]) return [];
      const searchId = searchIdMatch[1];

      // Step 2: GET search results page
      const resultUrl = `${BASE_URL}/e/search/result/?searchid=${searchId}`;
      const resultResp = await fetch(resultUrl, {
        headers: {
          "User-Agent": UA,
          Referer: BASE_URL + "/",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        signal,
      }).catch(() => null);

      if (!resultResp || !resultResp.ok) return [];
      const html = await resultResp.text();

      // Step 3: Parse search results - extract detail page links
      const $ = load(html);
      const detailItems: { url: string; title: string }[] = [];

      $(".row.row-cols-2.row-cols-lg-4 .col").each((i, el) => {
        if (i >= MAX_RESULTS) return;
        const linkEl = $(el).find("a[href*='/drama/'], a[href*='/movie/']");
        if (linkEl.length === 0) return;
        const detailPath = linkEl.attr("href") || "";
        if (!detailPath) return;
        const detailURL = detailPath.startsWith("http")
          ? detailPath
          : BASE_URL + detailPath;
        const title = linkEl.find("h2.h4").text().trim();
        if (!title) return;
        detailItems.push({ url: detailURL, title });
      });

      if (detailItems.length === 0) return [];

      // Step 4: Fetch detail pages concurrently to get magnet links
      const detailPromises = detailItems
        .slice(0, MAX_DETAILS)
        .map(async (item) => {
          try {
            const detailResp = await fetch(item.url, {
              headers: {
                "User-Agent": UA,
                Referer: BASE_URL + "/",
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              },
              signal,
            }).catch(() => null);

            if (!detailResp || !detailResp.ok) return null;
            const detailHtml = await detailResp.text();
            return this.parseDetailPage(detailHtml);
          } catch {
            return null;
          }
        });

      const detailResults = await Promise.all(detailPromises);

      // Step 5: Build search results - each magnet link becomes a separate result
      const results: SearchResult[] = [];
      let counter = 0;

      for (const detail of detailResults) {
        if (!detail || detail.magnetLinks.length === 0) continue;

        for (const magnet of detail.magnetLinks) {
          counter++;
          const title = magnet.fileName
            ? `${detail.title || ""}-${magnet.fileName}`
            : detail.title || `Result ${counter}`;

          results.push({
            message_id: `clxiong-${counter}`,
            unique_id: `clxiong-${counter}`,
            channel: "",
            datetime: detail.updateTime || new Date().toISOString(),
            title,
            content: "",
            links: [{ type: "magnet", url: magnet.url, password: "" }],
            tags: ["磁力链接", "影视"],
          });
        }
      }

      return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }

  private parseDetailPage(html: string): { magnetLinks: { url: string; fileName: string }[]; updateTime: string } | null {
    try {
      const $ = load(html);
      const magnetLinks: { url: string; fileName: string }[] = [];

      // Extract magnet links from .mv_down area
      $(".mv_down a[href^='magnet:']").each((_, el) => {
        const href = $(el).attr("href") || "";
        const fileName = $(el).text().trim();
        if (href) {
          magnetLinks.push({ url: href, fileName });
        }
      });

      // Fallback: search entire page for magnet links
      if (magnetLinks.length === 0) {
        $("a[href^='magnet:']").each((_, el) => {
          const href = $(el).attr("href") || "";
          const fileName = $(el).text().trim();
          if (href) {
            magnetLinks.push({ url: href, fileName });
          }
        });
      }

      // Extract update time
      let updateTime = "";
      $(".mv_detail p").each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes("最后更新于：")) {
          const dateStr = text.replace("最后更新于：", "").trim();
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            updateTime = parsed.toISOString();
          }
        }
      });

      return { magnetLinks, updateTime };
    } catch {
      return null;
    }
  }
}

registerGlobalPlugin(new ClxiongPlugin());
