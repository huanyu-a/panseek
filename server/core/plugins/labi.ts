import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import pLimit from "p-limit";

const BASE = "http://xiaocge.fun";
const SEARCH = (kw: string) =>
  `${BASE}/index.php/vod/search/wd/${encodeURIComponent(kw)}.html`;
const DETAIL = (id: string) => `${BASE}/index.php/vod/detail/id/${id}.html`;

const re = {
  id: /\/vod\/detail\/id\/(\d+)\.html/,
  quark: /https?:\/\/pan\.quark\.cn\/s\/[0-9a-zA-Z]+/g,
};

function collectQuarkLinks(html: string): { type: string; url: string; password: string }[] {
  const links: { type: string; url: string; password: string }[] = [];
  const seen = new Set<string>();
  // Check data-clipboard-text attributes
  const $ = load(html);
  $("[data-clipboard-text]").each((_, el) => {
    const v = $(el).attr("data-clipboard-text") || "";
    if (v.startsWith("http") && /pan\.quark\.cn\/s\//.test(v) && !seen.has(v)) {
      seen.add(v);
      links.push({ type: "quark", url: v, password: "" });
    }
  });
  // Check href attributes
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/pan\.quark\.cn\/s\//.test(href) && !seen.has(href)) {
      seen.add(href);
      links.push({ type: "quark", url: href, password: "" });
    }
  });
  // Also check raw text
  const cloned = new RegExp(re.quark.source, "g");
  let m: RegExpExecArray | null;
  while ((m = cloned.exec(html)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      links.push({ type: "quark", url: m[0], password: "" });
    }
  }
  return links;
}

async function fetchDetailLinks(id: string) {
  try {
    const html = await ofetch<string>(DETAIL(id), {
      headers: { "user-agent": "Mozilla/5.0", referer: BASE + "/" },
      timeout: 6000,
    });
    const $ = load(html);
    const section = $("#download-list").html() || $("body").html() || "";
    return collectQuarkLinks(section);
  } catch {
    return [];
  }
}

export class LabiPlugin extends BaseAsyncPlugin {
  constructor() {
    super("labi", 1);
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
      const a = s.find(".module-item-pic a").first();
      const href = a.attr("href") || "";
      const m = re.id.exec(href);
      if (!m || !m[1]) return;
      const id = m[1];
      const title = s.find(".video-info-header h3 a").first().text().trim();
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
            unique_id: `labi-${id}`,
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

registerGlobalPlugin(new LabiPlugin());
