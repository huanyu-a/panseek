import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

type ApiItem = {
  vod_id: number;
  vod_name: string;
  vod_actor?: string;
  vod_director?: string;
  vod_down_from?: string;
  vod_down_url?: string;
  vod_remarks?: string;
  vod_pubdate?: string;
  vod_area?: string;
  vod_year?: string;
  vod_pic?: string;
};

type ApiResponse = { code: number; msg: string; list: ApiItem[] };

const PWD_RE = /\?pwd=([0-9a-zA-Z]+)/;

function mapCloudType(apiType: string, url: string): string {
  const upper = (apiType || "").toUpperCase();
  switch (upper) {
    case "BD": return "baidu";
    case "KG": return "quark";
    case "UC": return "uc";
    case "ALY": return "aliyun";
    case "XL": return "xunlei";
    case "TY": return "tianyi";
    case "115": return "115";
    case "MB": return "mobile";
    case "WY": return "weiyun";
    case "LZ": return "lanzou";
    case "JGY": return "jianguoyun";
    case "123": return "123";
    case "PK": return "pikpak";
    default: return determineLinkType(url);
  }
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
  if (u.includes("feixin.10086.cn") || u.includes("yun.139.com") || u.includes("caiyun.139.com")) return "mobile";
  if (u.includes("share.weiyun.com")) return "weiyun";
  if (u.includes("lanzou") || u.includes("lanzo")) return "lanzou";
  if (u.includes("jianguoyun.com/p/")) return "jianguoyun";
  if (u.includes("123pan.com/s/") || u.includes("123912.com/s/") || u.includes("123684.com/s/") || u.includes("123865.com/s/")) return "123";
  if (u.includes("mypikpak.com/s/")) return "pikpak";
  if (u.startsWith("magnet:")) return "magnet";
  if (u.startsWith("ed2k://")) return "ed2k";
  return "";
}

function parseLinks(fromStr: string, urlStr: string) {
  const fromParts = (fromStr || "").split("$$$");
  const urlParts = (urlStr || "").split("$$$");
  const min = Math.min(fromParts.length, urlParts.length);
  const links: SearchResult["links"] = [];
  for (let i = 0; i < min; i += 1) {
    const apiType = (fromParts[i] || "").trim();
    const u = (urlParts[i] || "").trim();
    if (!u) continue;
    const type = mapCloudType(apiType, u);
    if (!type) continue;
    const m = u.match(PWD_RE);
    const password = m ? m[1] : "";
    links.push({ type, url: u, password });
  }
  return links;
}

const OUGE_BASE = "https://woog.nxog.eu.org";

export class OugePlugin extends BaseAsyncPlugin {
  constructor() {
    super("ouge", 2);
  }
  override async search(
    keyword: string,
    ext?: Record<string, any>
  ): Promise<SearchResult[]> {
    const signal = ext?.signal as AbortSignal | undefined;
    const timeout = Math.max(
      3000,
      Number((ext as any)?.__plugin_timeout_ms) || 6000
    );
    const kw = (keyword || "").trim();
    if (!kw) return [];

    const r = await ofetch<ApiResponse>(
      `${OUGE_BASE}/api.php/provide/vod?ac=detail&wd=${encodeURIComponent(kw)}`,
      {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          accept: "application/json, text/plain, */*",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
          referer: `${OUGE_BASE}/`,
        },
        timeout,
        retry: 1,
        signal,
      }
    ).catch(() => ({ code: -1, msg: "error", list: [] } as ApiResponse));

    const list: ApiItem[] = [];
    if (r && r.code === 1 && Array.isArray(r.list)) list.push(...r.list);
    if (!list.length) return [];

    const out: SearchResult[] = [];
    for (const item of list) {
      const links = parseLinks(item.vod_down_from || "", item.vod_down_url || "");
      if (!links.length) continue;
      out.push({
        message_id: "",
        unique_id: `ouge-${item.vod_id}`,
        channel: "",
        datetime: new Date().toISOString(),
        title: (item.vod_name || "").trim(),
        content: [
          item.vod_actor && `主演: ${item.vod_actor}`,
          item.vod_director && `导演: ${item.vod_director}`,
          item.vod_area && `地区: ${item.vod_area}`,
          item.vod_year && `年份: ${item.vod_year}`,
          item.vod_remarks && `状态: ${item.vod_remarks}`,
        ].filter(Boolean).join(" | "),
        links,
        tags: [item.vod_year || "", item.vod_area || ""].filter(Boolean),
      });
    }
    return out;
  }
}

registerGlobalPlugin(new OugePlugin());
