import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import pLimit from "p-limit";

const BASE = "https://tv.yydsys.top";
const SEARCH = (kw: string) =>
  `${BASE}/index.php/vod/search/wd/${encodeURIComponent(kw)}.html`;
const DETAIL = (id: string) => `${BASE}/index.php/vod/detail/id/${id}.html`;

const re = {
  id: /\/vod\/detail\/id\/(\d+)\.html/,
  quark: /https?:\/\/pan\.quark\.cn\/s\/[0-9a-zA-Z]+/g,
  uc: /https?:\/\/drive\.uc\.cn\/s\/[0-9a-zA-Z]+(?:\?[^"'\s]*)?/g,
  baidu: /https?:\/\/pan\.baidu\.com\/s\/[0-9a-zA-Z_\-]+(?:\?pwd=[0-9a-zA-Z]+)?/g,
  aliyun: /https?:\/\/(?:www\.)?(?:aliyundrive\.com|alipan\.com)\/s\/[0-9a-zA-Z]+/g,
  xunlei: /https?:\/\/pan\.xunlei\.com\/s\/[0-9a-zA-Z_\-]+(?:\?pwd=[0-9a-zA-Z]+)?/g,
  tianyi: /https?:\/\/cloud\.189\.cn\/t\/[0-9a-zA-Z]+/g,
  link115: /https?:\/\/115\.com\/s\/[0-9a-zA-Z]+/g,
  mobile: /https?:\/\/caiyun\.feixin\.10086\.cn\/[0-9a-zA-Z]+/g,
  weiyun: /https?:\/\/share\.weiyun\.com\/[0-9a-zA-Z]+/g,
  link123: /https?:\/\/123pan\.com\/s\/[0-9a-zA-Z]+/g,
  pikpak: /https?:\/\/mypikpak\.com\/s\/[0-9a-zA-Z]+/g,
  magnet: /magnet:\?xt=urn:btih:[0-9a-fA-F]{40}/g,
  ed2k: /ed2k:\/\/\|file\|[^|]+\|\d+\|[0-9a-fA-F]{32}\|\/?/g,
};

const patterns: Record<string, RegExp> = {
  quark: re.quark, uc: re.uc, baidu: re.baidu, aliyun: re.aliyun,
  xunlei: re.xunlei, tianyi: re.tianyi, "115": re.link115, mobile: re.mobile,
  weiyun: re.weiyun, "123": re.link123, pikpak: re.pikpak, magnet: re.magnet, ed2k: re.ed2k,
};

function collectLinks(html: string): { type: string; url: string }[] {
  const out: { type: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const [type, regex] of Object.entries(patterns)) {
    const cloned = new RegExp(regex.source, "g");
    let m: RegExpExecArray | null;
    while ((m = cloned.exec(html)) !== null) {
      if (!seen.has(m[0])) {
        seen.add(m[0]);
        out.push({ type, url: m[0] });
      }
    }
  }
  return out;
}

async function fetchDetailLinks(id: string) {
  try {
    const html = await ofetch<string>(DETAIL(id), {
      headers: { "user-agent": "Mozilla/5.0", referer: BASE + "/" },
      timeout: 6000,
    });
    const $ = load(html);
    const section = $("#download-list").html() || $("body").html() || "";
    // Also check data-clipboard-text attributes
    const clipboardLinks: string[] = [];
    $("[data-clipboard-text]").each((_, el) => {
      const v = $(el).attr("data-clipboard-text") || "";
      if (v.startsWith("http") || v.startsWith("magnet:") || v.startsWith("ed2k:")) {
        clipboardLinks.push(v);
      }
    });
    const allHtml = section + "\n" + clipboardLinks.join("\n");
    const raw = collectLinks(allHtml);
    return raw.map((r) => ({ type: r.type, url: r.url, password: "" }));
  } catch {
    return [];
  }
}

export class DuoduoPlugin extends BaseAsyncPlugin {
  constructor() {
    super("duoduo", 2);
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    const html = await ofetch<string>(SEARCH(keyword), {
      headers: { "user-agent": "Mozilla/5.0", referer: BASE + "/" },
      timeout: 8000,
    }).catch(() => "");
    if (!html) return [];

    const $ = load(html);
    const out: SearchResult[] = [];
    const tasks: Promise<void>[] = [];
    const limit = pLimit(20);

    $(".module-search-item").each((_, el) => {
      const s = $(el);
      const a = s.find(".video-info-header h3 a").first();
      const href = a.attr("href") || "";
      const m = re.id.exec(href);
      if (!m || !m[1]) return;
      const id = m[1];
      const title = a.text().trim();
      if (!title) return;

      const quality = s.find(".video-serial").first().text().trim();
      const tags: string[] = [];
      s.find(".video-info-aux .tag-link a").each((_, t) => {
        const tagText = $(t).text().trim();
        if (tagText) tags.push(tagText);
      });
      const director = s.find(".video-info-items .video-info-itemtitle:contains(导演)").siblings(".video-info-actor").text().trim();
      const actors: string[] = [];
      s.find(".video-info-items .video-info-itemtitle:contains(主演)").siblings(".video-info-actor").find("a").each((_, ac) => {
        const name = $(ac).text().trim();
        if (name) actors.push(name);
      });
      const plot = s.find(".video-info-items .video-info-itemtitle:contains(剧情)").siblings(".video-info-item").text().trim();
      const content = [quality && `【${quality}】`, director && `导演：${director}`, actors.length && `主演：${actors.slice(0, 3).join("、")}${actors.length > 3 ? "等" : ""}`, plot].filter(Boolean).join("\n");
      const images: string[] = [];
      const pic = s.find(".module-item-pic > img").attr("data-src") || "";
      if (pic) images.push(pic);

      tasks.push(
        limit(async () => {
          const links = await fetchDetailLinks(id);
          if (links.length === 0) return;
          out.push({
            message_id: "",
            unique_id: `duoduo-${id}`,
            channel: "",
            datetime: "",
            title,
            content,
            tags,
            images,
            links,
          });
        })
      );
    });

    await Promise.all(tasks);
    return out;
  }
}

// Self-register
registerGlobalPlugin(new DuoduoPlugin());
