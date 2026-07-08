import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

type MeitizyItem = {
  id: number;
  title: string;
  url: string;
  share_url?: string;
  pan_type?: string;
  create_time?: string;
};

type MeitizyResp = {
  code: number;
  msg: string;
  data: { list?: MeitizyItem[]; total?: number } | MeitizyItem[];
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
  if (u.includes("caiyun.139.com") || u.includes("feixin.10086.cn") || u.includes("yun.139.com")) return "mobile";
  if (u.includes("share.weiyun.com")) return "weiyun";
  if (u.includes("lanzou") || u.includes("lanzo")) return "lanzou";
  if (u.includes("mypikpak.com/s/")) return "pikpak";
  return "others";
}

function extractPassword(url: string): string {
  const m = url.match(/[?&](?:pwd|password|passcode|code)=([0-9a-zA-Z]+)/);
  return m ? m[1] : "";
}

export class MeitizyPlugin extends BaseAsyncPlugin {
  constructor() {
    super("meitizy", 3);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      const resp = await ofetch<MeitizyResp>("https://video.451024.xyz/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({ title: keyword, page: 1, size: 20 }),
        timeout: 8000,
        retry: 0,
      }).catch(() => null as any);

      if (!resp) return [];

      const items: MeitizyItem[] = Array.isArray(resp.data) ? resp.data : (resp.data?.list || []);
      const out: SearchResult[] = [];
      for (const item of items) {
        const url = item.url || item.share_url || "";
        if (!url || !/^https?:/.test(url)) continue;
        const type = item.pan_type || determineLinkType(url);
        if (type === "others" && !determineLinkType(url).match(/^(quark|uc|baidu|aliyun|xunlei|tianyi|115|123|mobile|weiyun|lanzou|pikpak)$/)) continue;
        out.push({
          message_id: "",
          unique_id: `meitizy-${item.id}`,
          channel: "",
          datetime: item.create_time || new Date().toISOString(),
          title: (item.title || "").trim(),
          content: "",
          links: [{ type: determineLinkType(url), url, password: extractPassword(url) }],
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new MeitizyPlugin());
