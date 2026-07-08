import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";

const BASE = "https://www.pioz.cn";
const SEARCH = (kw: string) => `${BASE}/search?q=${encodeURIComponent(kw)}`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const re = {
  quark: /https?:\/\/pan\.quark\.cn\/s\/[0-9a-zA-Z_-]+/g,
  detailId: /\/detail\/(\d+)/,
};

export class PiozPlugin extends BaseAsyncPlugin {
  constructor() {
    super("pioz", 2);
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    const html = await ofetch<string>(SEARCH(keyword), {
      headers: {
        "User-Agent": UA,
        Referer: BASE + "/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeout: 8000,
    }).catch(() => "");
    if (!html) return [];

    const $ = load(html);
    const out: SearchResult[] = [];

    // pioz.cn uses resource cards with links; extract quark links from each card
    $(".resource-card, .card, .item, .list-item").each((_, el) => {
      const s = $(el);
      const title = s.find(".card-title, .title, h3, h4").first().text().trim();
      const cardHtml = s.html() || "";

      const links: { type: string; url: string; password: string }[] = [];
      const seen = new Set<string>();

      // Check href attributes for quark links
      s.find("a[href]").each((_, a) => {
        const href = $(a).attr("href") || "";
        if (/pan\.quark\.cn\/s\//.test(href) && !seen.has(href)) {
          seen.add(href);
          links.push({ type: "quark", url: href, password: "" });
        }
      });

      // Also check data attributes and raw text
      const cloned = new RegExp(re.quark.source, "g");
      let m: RegExpExecArray | null;
      while ((m = cloned.exec(cardHtml)) !== null) {
        if (!seen.has(m[0])) {
          seen.add(m[0]);
          links.push({ type: "quark", url: m[0], password: "" });
        }
      }

      if (links.length === 0) return;

      const content = s.find(".card-text, .desc, .description, p").first().text().trim();
      const images: string[] = [];
      const img = s.find("img").attr("src");
      if (img) images.push(img);

      out.push({
        message_id: "",
        unique_id: `pioz-${out.length}`,
        channel: "",
        datetime: "",
        title: title || keyword,
        content,
        images,
        links,
      });
    });

    // If no structured cards found, try extracting all quark links from the page
    if (out.length === 0) {
      const seen = new Set<string>();
      const links: { type: string; url: string; password: string }[] = [];
      $("a[href]").each((_, a) => {
        const href = $(a).attr("href") || "";
        if (/pan\.quark\.cn\/s\//.test(href) && !seen.has(href)) {
          seen.add(href);
          const title = $(a).text().trim() || $(a).closest(".resource-card, .card, .item").find(".title, h3").text().trim() || keyword;
          links.push({ type: "quark", url: href, password: "" });
        }
      });
      if (links.length > 0) {
        out.push({
          message_id: "",
          unique_id: `pioz-0`,
          channel: "",
          datetime: "",
          title: keyword,
          content: "",
          links,
        });
      }
    }

    return out;
  }
}

registerGlobalPlugin(new PiozPlugin());
