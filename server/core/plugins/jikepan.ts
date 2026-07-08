import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

const API_URL = "https://api.jikepan.xyz/search";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

interface JikepanLink {
  service: string;
  link: string;
  pwd?: string;
}

function convertLinkType(service: string, link: string): string {
  const s = service.toLowerCase();
  switch (s) {
    case "baidu": return "baidu";
    case "aliyun": return "aliyun";
    case "xunlei": return "xunlei";
    case "quark": return "quark";
    case "189cloud": return "tianyi";
    case "115": return "115";
    case "123": return "123";
    case "pikpak": return "pikpak";
    case "caiyun": return "mobile";
    case "ed2k": return "ed2k";
    case "magnet": return "magnet";
    case "unknown": return "";
    default:
      // Check if it's actually a UC link
      if (link.toLowerCase().includes("drive.uc.cn")) return "uc";
      return "others";
  }
}

export class JikepanPlugin extends BaseAsyncPlugin {
  constructor() {
    super("jikepan", 3);
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    const resp = await ofetch<{ msg: string; list: { name: string; links: JikepanLink[] }[] }>(
      API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          referer: "https://jikepan.xyz/",
          "User-Agent": UA,
        },
        body: { name: keyword, is_all: false },
        timeout: 10000,
      }
    ).catch(() => null);

    if (!resp || resp.msg !== "success" || !resp.list) return [];

    const out: SearchResult[] = [];
    for (let i = 0; i < resp.list.length; i++) {
      const item = resp.list[i];
      if (!item || !item.links || item.links.length === 0) continue;

      const links = item.links
        .map((l) => {
          const type = convertLinkType(l.service, l.link);
          if (!type || type === "others") return null;
          return { type, url: l.link, password: l.pwd || "" };
        })
        .filter(Boolean) as { type: string; url: string; password: string }[];

      if (links.length === 0) continue;

      out.push({
        message_id: "",
        unique_id: `jikepan-${i}`,
        channel: "",
        datetime: "",
        title: item.name,
        content: "",
        links,
      });
    }
    return out;
  }
}

registerGlobalPlugin(new JikepanPlugin());
