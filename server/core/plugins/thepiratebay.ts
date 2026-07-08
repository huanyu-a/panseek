import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";

const BASE = "https://thpibay.xyz";
const SEARCH_URL = (kw: string) => `${BASE}/search/${encodeURIComponent(kw)}/1/99/0`;
const SEARCH_PAGE_URL = (kw: string, page: number) => `${BASE}/search/${encodeURIComponent(kw)}/${page}/99/0`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const MAX_PAGES = 30;

const re = {
  magnet: /magnet:\?xt=urn:btih:[0-9a-fA-F]{40}[^"'\s]*/,
  torrentId: /\/torrent\/(\d+)\//,
  timeFormat1: /(\d{2}-\d{2})\s+(\d{2}:\d{2})/,
  timeFormat2: /(\d{2}-\d{2})\s+(\d{4})/,
  fileSize: /Size\s+([0-9.]+)\s*(&nbsp;)?\s*([KMGT]?i?B)/,
};

function parseUploadTime(timeStr: string): string {
  timeStr = timeStr.replace(/&nbsp;/g, " ");

  const m1 = re.timeFormat1.exec(timeStr);
  if (m1) {
    const year = new Date().getFullYear();
    const t = new Date(`${year}-${m1[1]} ${m1[2]}`);
    if (!isNaN(t.getTime())) return t.toISOString();
  }

  const m2 = re.timeFormat2.exec(timeStr);
  if (m2) {
    const t = new Date(`${m2[2]}-${m2[1]}`);
    if (!isNaN(t.getTime())) return t.toISOString();
  }

  return new Date().toISOString();
}

async function searchPage(encodedKeyword: string, page: number): Promise<{ results: SearchResult[]; totalPages: number }> {
  const url = page === 1 ? SEARCH_URL(decodeURIComponent(encodedKeyword)) : SEARCH_PAGE_URL(decodeURIComponent(encodedKeyword), page);
  try {
    const html = await ofetch<string>(url, {
      headers: {
        "User-Agent": UA,
        Referer: BASE + "/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeout: 10000,
    }).catch(() => "");
    if (!html) return { results: [], totalPages: 1 };

    const $ = load(html);
    const results: SearchResult[] = [];

    // Parse total pages from pagination
    let totalPages = 1;
    if (page === 1) {
      $("table#searchResult").next().find("a").each((_, a) => {
        const href = $(a).attr("href") || "";
        const parts = href.split("/");
        if (parts.length >= 4) {
          const pageNum = parseInt(parts[3], 10);
          if (!isNaN(pageNum) && pageNum > totalPages) totalPages = pageNum;
        }
      });
      $("td[colspan='9'] a").each((_, a) => {
        const text = $(a).text().trim();
        const pageNum = parseInt(text, 10);
        if (!isNaN(pageNum) && pageNum > totalPages) totalPages = pageNum;
      });
      if (totalPages > MAX_PAGES) totalPages = MAX_PAGES;
    }

    $("table#searchResult tr").each((_, el) => {
      const s = $(el);
      if (s.hasClass("header")) return;

      const titleEl = s.find(".detName a.detLink").first();
      if (titleEl.length === 0) return;

      let title = titleEl.text().trim();
      if (!title) return;
      title = title.replace(/\./g, " ");

      const detailURL = titleEl.attr("href") || "";
      const idMatch = re.torrentId.exec(detailURL);
      if (!idMatch) return;
      const torrentId = idMatch[1];

      const magnetEl = s.find("a[href^='magnet:']").first();
      const magnetURL = magnetEl.attr("href") || "";
      if (!magnetURL || !re.magnet.test(magnetURL)) return;

      const tags: string[] = [];
      s.find(".vertTh a").each((_, t) => {
        const tag = $(t).text().trim();
        if (tag) tags.push(tag);
      });

      const detDesc = s.find(".detDesc").text();
      const datetime = parseUploadTime(detDesc);

      let content = "";
      const sizeMatch = re.fileSize.exec(detDesc);
      if (sizeMatch) content = `文件大小: ${sizeMatch[1]}${sizeMatch[3]}`;
      content += (content ? ", " : "") + `上传信息: ${detDesc.trim()}`;

      const seeders = s.find("td").eq(2).text().trim();
      const leechers = s.find("td").eq(3).text().trim();
      if (seeders && leechers) content += `, Seeders: ${seeders}, Leechers: ${leechers}`;

      results.push({
        message_id: "",
        unique_id: `thepiratebay-${torrentId}`,
        channel: "",
        datetime,
        title,
        content,
        tags,
        links: [{ type: "magnet", url: magnetURL, password: "" }],
      });
    });

    return { results, totalPages };
  } catch {
    return { results: [], totalPages: 1 };
  }
}

export class ThePirateBayPlugin extends BaseAsyncPlugin {
  constructor() {
    super("thepiratebay", 3);
  }

  override skipServiceFilter(): boolean {
    return true;
  }

  override async search(keyword: string, ext?: Record<string, any>): Promise<SearchResult[]> {
    // Use English title if provided
    let searchKeyword = keyword;
    if (ext?.title_en && typeof ext.title_en === "string" && ext.title_en.trim()) {
      searchKeyword = ext.title_en;
    }

    const encoded = encodeURIComponent(searchKeyword);
    const { results: firstPageResults, totalPages } = await searchPage(encoded, 1);
    let allResults = firstPageResults;

    if (totalPages > 1) {
      const pagePromises: Promise<SearchResult[]>[] = [];
      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(searchPage(encoded, p).then((r) => r.results));
      }
      const laterPages = await Promise.all(pagePromises);
      for (const pageResults of laterPages) {
        allResults.push(...pageResults);
      }
    }

    return allResults;
  }
}

registerGlobalPlugin(new ThePirateBayPlugin());
