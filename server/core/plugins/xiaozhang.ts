import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { load } from "cheerio";
import { filterByKeyword } from "./pluginUtils";

const BASE_URL = "https://xzys.fun";
const SEARCH_PATH = "/search.html";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const MAX_DETAILS = 8;

function determineLinkType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("pan.quark.cn/s/")) return "quark";
  if (u.includes("drive.uc.cn/s/")) return "uc";
  if (u.includes("pan.baidu.com/s/")) return "baidu";
  if (u.includes("aliyundrive.com/s/") || u.includes("alipan.com/s/"))
    return "aliyun";
  if (u.includes("pan.xunlei.com/s/")) return "xunlei";
  if (u.includes("cloud.189.cn/t/")) return "tianyi";
  if (u.includes("115.com/s/")) return "115";
  if (
    u.includes("123pan.com/s/") ||
    u.includes("123912.com/s/") ||
    u.includes("123684.com/s/") ||
    u.includes("123865.com/s/")
  )
    return "123";
  if (u.includes("mypikpak.com/s/")) return "pikpak";
  if (u.includes("feixin.10086.cn") || u.includes("yun.139.com") || u.includes("caiyun.139.com"))
    return "mobile";
  if (u.includes("share.weiyun.com")) return "weiyun";
  if (u.includes("lanzou") || u.includes("lanzo")) return "lanzou";
  if (u.includes("jianguoyun.com/p/")) return "jianguoyun";
  if (u.startsWith("magnet:")) return "magnet";
  if (u.startsWith("ed2k://")) return "ed2k";
  return "";
}

function isValidPanLink(url: string): boolean {
  const patterns = [
    "pan.baidu.com", "pan.quark.cn", "aliyundrive.com", "alipan.com",
    "115.com", "cloud.189.cn", "pan.xunlei.com", "123pan.com",
    "123912.com", "123684.com", "123865.com", "jianguoyun.com",
    "mypikpak.com", "feixin.10086.cn", "yun.139.com", "caiyun.139.com",
    "share.weiyun.com", "lanzou", "lanzo",
  ];
  return patterns.some((p) => url.includes(p));
}

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export class XiaozhangPlugin extends BaseAsyncPlugin {
  constructor() {
    super("xiaozhang", 3);
  }

  override async search(
    keyword: string,
    ext?: Record<string, any>
  ): Promise<SearchResult[]> {
    const signal = ext?.signal as AbortSignal | undefined;
    try {
      const searchUrl = `${BASE_URL}${SEARCH_PATH}?keyword=${encodeURIComponent(keyword)}`;

      // Step 1: Fetch search results page
      const resp = await fetch(searchUrl, {
        headers: { ...COMMON_HEADERS, Referer: BASE_URL },
        signal,
      }).catch(() => null);

      if (!resp || !resp.ok) return [];
      const html = await resp.text();
      const $ = load(html);

      // Step 2: Extract search result items
      const detailItems: {
        url: string; title: string; content: string;
        id: string; datetime: string;
      }[] = [];

      $(".list-boxes").each((i, s) => {
        const titleElem = $(s).find("a.text_title_p");
        const title = titleElem.text().trim();
        const detailPath = titleElem.attr("href") || "";
        if (!title || !detailPath) return;

        const detailURL = BASE_URL + detailPath;
        const content = $(s).find("p.text_p").text().trim();

        let timeText = $(s).find(".list-actions span").first().text().trim();
        timeText = timeText.replace(/&nbsp;/g, " ").trim();
        let datetime = new Date().toISOString();
        if (timeText) {
          const parsed = new Date(timeText);
          if (!isNaN(parsed.getTime())) datetime = parsed.toISOString();
        }

        const idMatch = detailPath.match(/\/subject\/(\d+)\.html/);
        const resourceId = idMatch ? idMatch[1] : `${Date.now()}-${i}`;

        detailItems.push({ url: detailURL, title, content, id: resourceId, datetime });
      });

      if (detailItems.length === 0) return [];

      // Step 3: Fetch detail pages concurrently
      const detailPromises = detailItems
        .slice(0, MAX_DETAILS)
        .map(async (item) => {
          try {
            const links = await this.fetchDetailPageLinks(item.url, signal);
            if (links.length === 0) return null;
            return { item, links };
          } catch {
            return null;
          }
        });

      const detailResults = await Promise.all(detailPromises);

      // Step 4: Build search results
      const results: SearchResult[] = [];
      for (const dr of detailResults) {
        if (!dr) continue;
        results.push({
          message_id: `xiaozhang-${dr.item.id}`,
          unique_id: `xiaozhang-${dr.item.id}`,
          channel: "",
          datetime: dr.item.datetime,
          title: dr.item.title,
          content: dr.item.content,
          links: dr.links,
        });
      }

      return filterByKeyword(results, keyword);
    } catch {
      return [];
    }
  }

  private async fetchDetailPageLinks(
    detailURL: string,
    signal?: AbortSignal
  ): Promise<{ type: string; url: string; password: string }[]> {
    const resp1 = await fetch(detailURL, {
      headers: { ...COMMON_HEADERS, Referer: BASE_URL },
      redirect: "manual",
      signal,
    }).catch(() => null);

    if (!resp1) return [];

    let finalHtml = "";

    if (resp1.status === 301 || resp1.status === 302) {
      const location = resp1.headers.get("location") || "";
      if (location) {
        const realUrl = location.startsWith("http") ? location : BASE_URL + location;
        const resp2 = await fetch(realUrl, {
          headers: { ...COMMON_HEADERS, Referer: detailURL },
          signal,
        }).catch(() => null);
        if (resp2 && resp2.ok) {
          finalHtml = await resp2.text();
        }
      }
    } else if (resp1.ok) {
      finalHtml = await resp1.text();
    }

    if (!finalHtml) return [];

    // Extract download links from detail page
    const $ = load(finalHtml);
    const links: { type: string; url: string; password: string }[] = [];
    const linkMap = new Set<string>();

    $("p").each((_, p) => {
      $(p).find("a[href]").each((_, a) => {
        const href = $(a).attr("href") || "";
        if (!href || !isValidPanLink(href)) return;
        if (linkMap.has(href)) return;
        linkMap.add(href);

        let password = "";
        const pText = $(p).text().trim();
        if (pText.includes("提取码") || pText.includes("密码")) {
          const pm = pText.match(/(?:提取码|密码)[：:]?\s*([a-zA-Z0-9]+)/);
          if (pm && pm[1]) password = pm[1];
        }
        if (!password && href.includes("pwd=")) {
          try {
            const u = new URL(href);
            password = u.searchParams.get("pwd") || "";
          } catch { /* ignore */ }
        }

        const linkType = determineLinkType(href);
        if (!linkType) return;

        links.push({ type: linkType, url: href, password });
      });
    });

    return links;
  }
}

registerGlobalPlugin(new XiaozhangPlugin());
