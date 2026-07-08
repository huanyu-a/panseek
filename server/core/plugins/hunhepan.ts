import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const APIS = [
  { url: "https://hunhepan.com/open/search/disk", referer: "https://hunhepan.com/search" },
  { url: "https://qkpanso.com/v1/search/disk", referer: "https://qkpanso.com/search" },
  { url: "https://kuake8.com/v1/search/disk", referer: "https://kuake8.com/search" },
  { url: "https://www.misoso.cc/v1/search/disk", referer: "https://www.misoso.cc/search" },
];

const PAGE_SIZE = 30;

function convertDiskType(diskType: string): string {
  switch (diskType) {
    case "BDY": return "baidu";
    case "ALY": return "aliyun";
    case "QUARK": return "quark";
    case "TIANYI": return "tianyi";
    case "UC": return "uc";
    case "CAIYUN": return "mobile";
    case "115": return "115";
    case "XUNLEI": return "xunlei";
    case "123PAN": return "123";
    case "PIKPAK": return "pikpak";
    default: return "others";
  }
}

function cleanTitle(title: string): string {
  return title
    .replace(/<\/?(?:em|b|strong|i)>/g, "")
    .trim();
}

interface HunhepanItem {
  disk_id: string;
  disk_name: string;
  disk_pass: string;
  disk_type: string;
  files: string;
  shared_time: string;
  link: string;
}

async function searchOneAPI(apiUrl: string, referer: string, keyword: string): Promise<HunhepanItem[]> {
  const allItems: HunhepanItem[] = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: referer,
      };
      if (apiUrl.includes("misoso.cc")) {
        headers["Origin"] = "https://www.misoso.cc";
      }

      const resp = await ofetch<{
        code: number;
        msg: string;
        data: { total: number; per_size: number; list: HunhepanItem[] };
      }>(apiUrl, {
        method: "POST",
        headers,
        body: {
          page,
          q: keyword,
          user: "",
          exact: false,
          format: [],
          share_time: "",
          size: PAGE_SIZE,
          type: "",
          exclude_user: [],
          adv_params: { wechat_pwd: "", platform: "pc" },
        },
        timeout: 8000,
      }).catch(() => null);

      if (!resp || resp.code !== 200 || !resp.data?.list) break;
      allItems.push(...resp.data.list);
      if (resp.data.list.length < PAGE_SIZE) break;
    } catch {
      break;
    }
  }
  return allItems;
}

export class HunhepanPlugin extends BaseAsyncPlugin {
  constructor() {
    super("hunhepan", 3);
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    const results = await Promise.all(
      APIS.map((api) => searchOneAPI(api.url, api.referer, keyword))
    );

    // Flatten and deduplicate
    const uniqueMap = new Map<string, HunhepanItem>();
    for (const items of results) {
      for (const item of items) {
        const cleanedName = cleanTitle(item.disk_name);
        const key = item.disk_id || (item.link + "|" + cleanedName) || (cleanedName + "|" + item.disk_type);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, { ...item, disk_name: cleanedName });
        }
      }
    }

    const out: SearchResult[] = [];
    let idx = 0;
    for (const item of uniqueMap.values()) {
      if (!item.link) continue;
      const linkType = convertDiskType(item.disk_type);
      if (linkType === "others") continue;

      let datetime = "";
      if (item.shared_time) {
        const t = new Date(item.shared_time);
        if (!isNaN(t.getTime())) datetime = t.toISOString();
      }

      out.push({
        message_id: "",
        unique_id: `hunhepan-${item.disk_id || Date.now() + "-" + idx}`,
        channel: "",
        datetime,
        title: cleanTitle(item.disk_name),
        content: item.files || "",
        links: [{ type: linkType, url: item.link, password: item.disk_pass || "" }],
      });
      idx++;
    }
    return out;
  }
}

registerGlobalPlugin(new HunhepanPlugin());
