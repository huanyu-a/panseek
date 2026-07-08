import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

type MelostItem = {
  disk_id: string;
  title: string;
  url?: string;
  share_url?: string;
  pan_type?: string;
  share_time?: string;
  user?: string;
  links?: { type: string; url: string; password?: string }[];
};

type MelostResp = {
  code: number;
  msg: string;
  data: { list?: MelostItem[]; total?: number } | MelostItem[];
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

export class MelostPlugin extends BaseAsyncPlugin {
  constructor() {
    super("melost", 2);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      const resp = await ofetch<MelostResp>("https://www.melost.cn/v1/search/disk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({
          page: 1,
          q: keyword,
          user: "",
          exact: false,
          user_distinct: false,
          format: [],
          share_time: "",
          share_year: "",
          size: 20,
          order: "",
          type: "",
          search_ticket: "",
          exclude_user: [],
          adv_params: {
            wechat_pwd: "",
            search_code: "",
            platform: "pc",
            fp_data: "",
            automated: 0,
          },
        }),
        timeout: 8000,
        retry: 0,
      }).catch(() => null as any);

      if (!resp) return [];

      const items: MelostItem[] = Array.isArray(resp.data) ? resp.data : (resp.data?.list || []);
      const out: SearchResult[] = [];
      for (const item of items) {
        const links = item.links && item.links.length > 0
          ? item.links.map(l => ({ type: l.type || determineLinkType(l.url), url: l.url, password: l.password || extractPassword(l.url) }))
          : [];
        if (links.length === 0) {
          const url = item.url || item.share_url || "";
          if (!url || !/^https?:/.test(url)) continue;
          links.push({ type: determineLinkType(url), url, password: extractPassword(url) });
        }
        if (links.length === 0) continue;
        out.push({
          message_id: "",
          unique_id: `melost-${item.disk_id}`,
          channel: "",
          datetime: item.share_time || new Date().toISOString(),
          title: (item.title || "").trim(),
          content: item.user ? `用户: ${item.user}` : "",
          links,
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new MelostPlugin());
