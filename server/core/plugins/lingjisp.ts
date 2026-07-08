import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

const API_BASE = "https://web5.mukaku.com/prod/api/v1/";
const APP_ID = "83768d9ad4";
const IDENTITY = "23734adac0301bccdcb107c4aa21f96c";

type LingjiVideoItem = {
  doub_id?: number;
  title?: string;
  name?: string;
  cover_url?: string;
  release_date?: string;
  score?: string;
};

type LingjiListResp = {
  code?: number;
  msg?: string;
  data?: { list?: LingjiVideoItem[]; total?: number } | LingjiVideoItem[];
};

type LingjiDetailResp = {
  code?: number;
  msg?: string;
  data?: {
    doub_id?: number;
    title?: string;
    play_url_list?: { play_url?: string; source?: string }[];
    download_url_list?: { download_url?: string; source?: string }[];
  };
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

export class LingjispPlugin extends BaseAsyncPlugin {
  constructor() {
    super("lingjisp", 2);
  }
  override skipServiceFilter(): boolean {
    return false;
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
      // Step 1: Search for videos
      const params = new URLSearchParams();
      params.set("app_id", APP_ID);
      params.set("identity", IDENTITY);
      params.set("sb", keyword);
      params.set("page", "1");
      params.set("limit", "20");

      const listResp = await ofetch<LingjiListResp>(
        `${API_BASE}getVideoList?${params.toString()}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": API_BASE,
          },
          timeout: 6000,
          retry: 0,
        }
      ).catch(() => null as any);

      if (!listResp || listResp.code !== 0) return [];

      const items: LingjiVideoItem[] = Array.isArray(listResp.data) ? listResp.data : (listResp.data?.list || []);
      if (!items.length) return [];

      // Step 2: Get details for each video (limit to 8 to avoid timeout)
      const out: SearchResult[] = [];
      const detailPromises = items.slice(0, 8).map(async (item) => {
        const doubId = item.doub_id;
        if (!doubId) return null;

        const detailParams = new URLSearchParams();
        detailParams.set("app_id", APP_ID);
        detailParams.set("identity", IDENTITY);
        detailParams.set("id", String(doubId));

        const detailResp = await ofetch<LingjiDetailResp>(
          `${API_BASE}getVideoDetail?${detailParams.toString()}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Referer": API_BASE,
            },
            timeout: 5000,
            retry: 0,
          }
        ).catch(() => null as any);

        if (!detailResp || detailResp.code !== 0 || !detailResp.data) return null;

        const data = detailResp.data;
        const allUrls: string[] = [
          ...(data.play_url_list || []).map(p => p.play_url || ""),
          ...(data.download_url_list || []).map(d => d.download_url || ""),
        ];

        const links: { type: string; url: string; password: string }[] = [];
        const seen = new Set<string>();
        for (const url of allUrls) {
          if (!url || !/^https?:/.test(url) || seen.has(url.toLowerCase())) continue;
          seen.add(url.toLowerCase());
          const type = determineLinkType(url);
          if (type === "others") continue;
          links.push({ type, url, password: extractPassword(url) });
        }

        if (links.length === 0) return null;

        return {
          message_id: "",
          unique_id: `lingjisp-${doubId}`,
          channel: "",
          datetime: item.release_date || new Date().toISOString(),
          title: (item.title || item.name || "").trim(),
          content: item.score ? `评分: ${item.score}` : "",
          links,
        } as SearchResult;
      });

      const results = await Promise.allSettled(detailPromises);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) out.push(r.value);
      }

      return out;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new LingjispPlugin());
