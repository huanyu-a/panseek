import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

type XdyhResp = {
  code?: number;
  msg?: string;
  data?: any[];
  results?: any[];
  list?: any[];
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

export class XdyhPlugin extends BaseAsyncPlugin {
  constructor() {
    super("xdyh", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      const resp = await ofetch< XdyhResp>("https://ys.66ds.de/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://ys.66ds.de/",
        },
        body: JSON.stringify({
          keyword: keyword,
          sites: null,
          maxWorkers: 10,
          saveToFile: false,
          splitLinks: true,
        }),
        timeout: 8000,
        retry: 0,
      }).catch(() => null as any);

      if (!resp) return [];

      const items = resp.data || resp.results || resp.list || [];
      const out: SearchResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== "object") continue;
        const itemStr = JSON.stringify(item);
        const links = extractLinksFromText(itemStr);
        if (links.length === 0) continue;
        const title = item.title || item.name || item.share_title || `Result ${i + 1}`;
        out.push({
          message_id: "",
          unique_id: `xdyh-${item.id || i}`,
          channel: "",
          datetime: item.created_at || item.time || item.date || new Date().toISOString(),
          title: String(title),
          content: String(item.content || item.description || ""),
          links,
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new XdyhPlugin());
