import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

type MikuclubPost = {
  id: number;
  title?: { rendered?: string } | string;
  content?: { rendered?: string } | string;
  excerpt?: { rendered?: string } | string;
  meta?: any;
  link?: string;
  date?: string;
};

type MikuclubResp = MikuclubPost[] | { data?: MikuclubPost[]; total?: number };

function extractTextFromHTML(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

export class MikuclubPlugin extends BaseAsyncPlugin {
  constructor() {
    super("mikuclub", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams();
      params.set("search", keyword);
      params.set("s", keyword);
      params.set("page", "");
      params.set("pagename", "search_page");
      params.set("page_type", "search");
      params.set("paged", "1");
      params.set("custom_orderby", "relevance");
      params.set("no_cache", "1");

      const resp = await ofetch<MikuclubResp>(
        `https://www.mikuclub.uk/wp-json/utils/v2/post_list?${params.toString()}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": "https://www.mikuclub.uk/",
          },
          timeout: 8000,
          retry: 0,
        }
      ).catch(() => null as any);

      if (!resp) return [];

      const posts = Array.isArray(resp) ? resp : (resp.data || []);
      const out: SearchResult[] = [];
      for (const post of posts) {
        const titleRaw = typeof post.title === "object" ? post.title?.rendered : post.title;
        const contentRaw = typeof post.content === "object" ? post.content?.rendered : post.content;
        const title = extractTextFromHTML(String(titleRaw || ""));
        const contentStr = String(contentRaw || "") + " " + JSON.stringify(post.meta || {});
        const links = extractLinksFromText(contentStr);
        if (links.length === 0) continue;
        out.push({
          message_id: "",
          unique_id: `mikuclub-${post.id}`,
          channel: "",
          datetime: post.date || new Date().toISOString(),
          title: title || `Result ${post.id}`,
          content: extractTextFromHTML(contentStr).slice(0, 500),
          links,
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new MikuclubPlugin());
