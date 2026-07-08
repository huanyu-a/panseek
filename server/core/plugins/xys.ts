import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

type YunsoItem = {
  full_id?: string;
  qid?: string;
  id?: string;
  title?: string;
  name?: string;
  url?: string;
  share_url?: string;
  pan_type?: string;
  file_type?: string;
  share_time?: string;
  created_at?: string;
  user?: string;
};

type YunsoResp = {
  code?: number;
  msg?: string;
  data?: { list?: YunsoItem[]; total?: number } | YunsoItem[];
  results?: YunsoItem[];
  list?: YunsoItem[];
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

export class XysPlugin extends BaseAsyncPlugin {
  constructor() {
    super("xys", 2);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      // Step 1: Get DToken2 from the token URL
      const tokenUrl = `https://www.yunso.net/api/validate/searchX2?wd=${encodeURIComponent(keyword)}&mode=undefined&stype=undefined`;
      const tokenResp = await ofetch<any>(tokenUrl, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.yunso.net/",
        },
        timeout: 5000,
        retry: 0,
      }).catch(() => null as any);

      if (!tokenResp) return [];

      const dtoken2 = tokenResp.data?.DToken2 || tokenResp.DToken2 || tokenResp.data?.token || "";
      if (!dtoken2) return [];

      // Step 2: Search with DToken2
      const searchUrl = `https://www.yunso.net/api/Core/search2?DToken2=${dtoken2}&requestID=undefined&mode=90002&stype=undefined&scope_content=0&wd=${encodeURIComponent(keyword)}&uk=&page=1&limit=20&screen_filetype=`;
      const resp = await ofetch<YunsoResp>(searchUrl, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.yunso.net/",
        },
        timeout: 8000,
        retry: 0,
      }).catch(() => null as any);

      if (!resp) return [];

      const items: YunsoItem[] = resp.data && Array.isArray(resp.data) ? resp.data :
        (resp.data as any)?.list || resp.results || resp.list || [];
      const out: SearchResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const url = item.url || item.share_url || "";
        if (!url || !/^https?:/.test(url)) continue;
        const type = determineLinkType(url);
        if (type === "others") continue;
        out.push({
          message_id: "",
          unique_id: `xys-${item.full_id || item.qid || i}`,
          channel: "",
          datetime: item.share_time || item.created_at || new Date().toISOString(),
          title: (item.title || item.name || "").trim(),
          content: item.user ? `用户: ${item.user}` : "",
          links: [{ type, url, password: extractPassword(url) }],
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new XysPlugin());
