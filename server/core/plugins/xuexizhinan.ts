import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import pLimit from "p-limit";

const BASE = "https://xuexizhinan.com";
const SEARCH = (kw: string) => `${BASE}/?post_type=book&s=${encodeURIComponent(kw)}`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36";

const re = {
  detailUrl: /https:\/\/xuexizhinan\.com\/book\/(\d+)\.html/,
  magnet: /magnet:\?xt=urn:btih:[0-9a-zA-Z]+/,
  date: /上映日期: (\d{4}-\d{2}-\d{2})/,
};

interface DetailResponse {
  title: string;
  imageUrl: string;
  magnetLinks: string[];
  quarkLinks: { url: string; password: string }[];
  tags: string[];
  content: string;
}

async function processDetailPage(detailURL: string): Promise<SearchResult | null> {
  try {
    const html = await ofetch<string>(detailURL, {
      headers: { "User-Agent": UA },
      timeout: 10000,
    }).catch(() => "");
    if (!html) return null;

    const $ = load(html);
    const title = $(".book-header h1").first().text().trim() || (() => {
      const pageTitle = $("title").text();
      return pageTitle.replace(/\s*\|\s*4K指南\s*$/, "").trim();
    })();

    const imageUrl = $(".book-cover img").attr("src") || "";
    const tags: string[] = [];
    $(".book-header .my-2 a").each((_, el) => {
      const tag = $(el).text().trim();
      if (tag) tags.push(tag);
    });

    const content = $(".panel-body.single").first().text().trim();
    const magnetLinks: string[] = [];
    const quarkLinks: { url: string; password: string }[] = [];

    // Extract magnet links from li elements
    $("li").each((_, el) => {
      const text = $(el).text();
      if (text.includes("magnet:?xt=urn:btih:")) {
        const match = re.magnet.exec(text);
        if (match) magnetLinks.push(match[0]);
      }
    });

    // Extract quark links from .site-go a elements
    $(".site-go a, a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const linkTitle = $(el).attr("title") || "";
      const name = $(el).find(".b-name").text() || "";
      if (href.includes("pan.quark.cn") || name.includes("夸克") || linkTitle.includes("夸克")) {
        if (href && !quarkLinks.some((q) => q.url === href)) {
          quarkLinks.push({ url: href, password: "" });
        }
      }
    });

    if (!title && magnetLinks.length === 0 && quarkLinks.length === 0) return null;

    // Extract ID
    const idMatch = re.detailUrl.exec(detailURL);
    const id = idMatch ? idMatch[1] : "unknown";

    // Parse date
    let datetime = "";
    const dateMatch = re.date.exec(content);
    if (dateMatch) {
      const t = new Date(dateMatch[1]);
      if (!isNaN(t.getTime())) datetime = t.toISOString();
    }

    // Build links array
    const links: { type: string; url: string; password: string }[] = [];
    for (const magnet of magnetLinks) {
      links.push({ type: "magnet", url: magnet, password: "" });
    }
    for (const quark of quarkLinks) {
      links.push({ type: "quark", url: quark.url, password: quark.password });
    }

    if (links.length === 0) return null;

    const images: string[] = imageUrl ? [imageUrl] : [];

    return {
      message_id: "",
      unique_id: `xuexizhinan-${id}`,
      channel: "",
      datetime,
      title,
      content,
      tags,
      images,
      links,
    };
  } catch {
    return null;
  }
}

export class XuexizhinanPlugin extends BaseAsyncPlugin {
  constructor() {
    super("xuexizhinan", 1);
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    const html = await ofetch<string>(SEARCH(keyword), {
      headers: { "User-Agent": UA },
      timeout: 10000,
    }).catch(() => "");
    if (!html) return [];

    const $ = load(html);
    const lowerKeyword = keyword.toLowerCase();
    const keywords = lowerKeyword.split(/\s+/);

    // Collect valid items
    const validItems: { url: string; title: string }[] = [];
    $(".url-card").each((_, el) => {
      const s = $(el);
      const titleEl = s.find(".list-title");
      const title = titleEl.text().trim();
      const link = titleEl.attr("href") || "";
      if (!link || !title) return;

      // Check keyword match
      const lowerTitle = title.toLowerCase();
      const matched = keywords.every((kw) => lowerTitle.includes(kw));
      if (matched) {
        validItems.push({ url: link, title });
      }
    });

    if (validItems.length === 0) return [];

    // Fetch detail pages concurrently
    const limit = pLimit(8);
    const tasks = validItems.map((item) =>
      limit(async () => {
        const result = await processDetailPage(item.url);
        return result;
      })
    );

    const results = await Promise.all(tasks);
    return results.filter(Boolean) as SearchResult[];
  }
}

registerGlobalPlugin(new XuexizhinanPlugin());
