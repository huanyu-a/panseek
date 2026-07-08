import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import { filterByKeyword, createSearchResult } from "./pluginUtils";

const BASE_URL = "https://jsnoteclub.com";
const DATA_KEY_REGEX = /data-key="([0-9a-fA-F]+)"/;

type GhostPost = {
  id: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  url?: string;
  updated_at?: string;
  visibility?: string;
};

function determineLinkType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("pan.quark.cn/s/")) return "quark";
  if (u.includes("drive.uc.cn/s/")) return "uc";
  if (u.includes("pan.baidu.com/s/")) return "baidu";
  if (u.includes("aliyundrive.com/s/") || u.includes("alipan.com/s/")) return "aliyun";
  if (u.includes("pan.xunlei.com/s/")) return "xunlei";
  if (u.includes("cloud.189.cn/t/")) return "tianyi";
  if (u.includes("115.com/s/")) return "115";
  if (u.includes("123pan.com/s/") || u.includes("123684.com/s/")) return "123";
  if (u.includes("caiyun.139.com") || u.includes("feixin.10086.cn")) return "mobile";
  if (u.includes("share.weiyun.com")) return "weiyun";
  if (u.includes("lanzou") || u.includes("lanzo")) return "lanzou";
  if (u.includes("mypikpak.com/s/")) return "pikpak";
  return "others";
}

function extractPassword(url: string): string {
  const m = url.match(/[?&](?:pwd|password|passcode|code)=([0-9a-zA-Z]+)/);
  return m ? m[1] : "";
}

function extractLinksFromText(text: string): { type: string; url: string; password: string }[] {
  const links: { type: string; url: string; password: string }[] = [];
  const seen = new Set<string>();
  const urlRegex = /https?:\/\/[^\s"'<>\]}]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const lower = url.toLowerCase();
    if (seen.has(lower)) continue;
    if (!lower.match(/pan\.(quark|baidu)\.cn|drive\.uc\.cn|aliyundrive\.com|alipan\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|123pan\.com|123684\.com|caiyun\.139\.com|share\.weiyun\.com|lanzou|lanzo|mypikpak\.com/)) continue;
    seen.add(lower);
    links.push({ type: determineLinkType(url), url, password: extractPassword(url) });
  }
  return links;
}

let cachedDataKey = "";
let cachedKeyTime = 0;

export class JsnoteclubPlugin extends BaseAsyncPlugin {
  constructor() {
    super("jsnoteclub", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }

  private async fetchDataKey(): Promise<string> {
    // Cache for 1 hour
    if (cachedDataKey && Date.now() - cachedKeyTime < 3600000) return cachedDataKey;

    const html = await ofetch<string>(BASE_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 5000,
      retry: 0,
    }).catch(() => "");
    if (!html) return "";

    const match = html.match(DATA_KEY_REGEX);
    if (match) {
      cachedDataKey = match[1];
      cachedKeyTime = Date.now();
      return match[1];
    }
    return "";
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      const dataKey = await this.fetchDataKey();
      if (!dataKey) return [];

      const params = new URLSearchParams();
      params.set("key", dataKey);
      params.set("limit", "10000");
      params.set("fields", "id,slug,title,excerpt,url,updated_at,visibility");
      params.set("order", "updated_at DESC");

      const resp = await ofetch<{ posts: GhostPost[] }>(
        `${BASE_URL}/ghost/api/content/posts/?${params.toString()}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
          },
          timeout: 8000,
          retry: 0,
        }
      ).catch(() => null as any);

      if (!resp || !resp.posts) return [];

      const lowerKw = keyword.toLowerCase();
      const out: SearchResult[] = [];
      for (const post of resp.posts) {
        const title = (post.title || "").toLowerCase();
        const excerpt = (post.excerpt || "").toLowerCase();
        if (!title.includes(lowerKw) && !excerpt.includes(lowerKw)) continue;

        const links = extractLinksFromText(post.excerpt || "");
        if (links.length === 0) continue;

        out.push({
          message_id: "",
          unique_id: `jsnoteclub-${post.id}`,
          channel: "",
          datetime: post.updated_at || new Date().toISOString(),
          title: post.title || "",
          content: post.excerpt || "",
          links,
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new JsnoteclubPlugin());
