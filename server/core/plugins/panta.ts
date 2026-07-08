import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";
import { load } from "cheerio";
import pLimit from "p-limit";

const BASE = "https://www.91panta.cn";
const SEARCH = (kw: string) => `${BASE}/search?keyword=${encodeURIComponent(kw)}`;
const THREAD = (topicId: string) => `${BASE}/thread?topicId=${topicId}`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const re = {
  topicId: /topicId=(\d+)/,
  postTime: /发表时间：(.+)/,
  year: /\(([0-9]{4})\)/,
  pwdParam: /[?&]pwd=([0-9a-zA-Z]+)/,
  pwdPatterns: [
    /提取码[：:]\s*([0-9a-zA-Z]+)/,
    /密码[：:]\s*([0-9a-zA-Z]+)/,
    /pwd[=:：]\s*([0-9a-zA-Z]+)/,
  ],
  netDiskPatterns: [
    /https?:\/\/pan\.baidu\.com\/s\/[0-9a-zA-Z_\-]+(?:\?pwd=[0-9a-zA-Z]+)?/g,
    /https?:\/\/pan\.quark\.cn\/s\/[0-9a-zA-Z]+/g,
    /https?:\/\/(?:www\.)?(?:aliyundrive\.com|alipan\.com)\/s\/[0-9a-zA-Z]+/g,
    /https?:\/\/pan\.xunlei\.com\/s\/[0-9a-zA-Z_\-]+(?:\?pwd=[0-9a-zA-Z]+)?[#]?/g,
    /https?:\/\/cloud\.189\.cn\/t\/[0-9a-zA-Z]+/g,
    /https?:\/\/(?:www\.)?caiyun\.139\.com\/[mw]\/i\?[0-9a-zA-Z]+(?:\?pwd=[0-9a-zA-Z]+)?/g,
    /https?:\/\/drive\.uc\.cn\/s\/[0-9a-zA-Z]+/g,
    /https?:\/\/115\.com\/s\/[0-9a-zA-Z]+/g,
    /https?:\/\/mypikpak\.com\/s\/[0-9a-zA-Z]+/g,
  ],
};

const netDiskDomains = [
  "pan.baidu.com", "pan.quark.cn", "aliyundrive.com", "alipan.com",
  "pan.xunlei.com", "cloud.189.cn", "caiyun.139.com", "drive.uc.cn",
  "115.com", "mypikpak.com",
];

function determineLinkType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("pan.baidu.com")) return "baidu";
  if (u.includes("pan.quark.cn")) return "quark";
  if (u.includes("alipan.com") || u.includes("aliyundrive.com")) return "aliyun";
  if (u.includes("cloud.189.cn")) return "tianyi";
  if (u.includes("caiyun.139.com")) return "mobile";
  if (u.includes("115.com")) return "115";
  if (u.includes("pan.xunlei.com")) return "xunlei";
  if (u.includes("mypikpak.com")) return "pikpak";
  if (u.includes("drive.uc.cn")) return "uc";
  if (u.includes("123")) return "123";
  return "others";
}

function extractPassword(content: string, url: string): string {
  const pwdMatch = re.pwdParam.exec(url);
  if (pwdMatch && pwdMatch[1]) return pwdMatch[1];
  for (const pattern of re.pwdPatterns) {
    const m = pattern.exec(content);
    if (m && m[1]) return m[1];
  }
  return "";
}

function extractLinksFromElement($el: any): { type: string; url: string; password: string }[] {
  const links: { type: string; url: string; password: string }[] = [];
  const seen = new Set<string>();

  $el.find("a[href^='http']").each((_: number, a: any) => {
    const href = a.attribs.href || "";
    const lowerHref = href.toLowerCase();
    if (!netDiskDomains.some((d) => lowerHref.includes(d))) return;
    if (seen.has(href)) return;
    seen.add(href);

    const linkType = determineLinkType(href);
    if (linkType === "others") return;

    let surroundingText = a.children?.[0]?.data || $el.text() || "";
    let password = extractPassword(surroundingText, href);

    // For quark: only use password if there's a password keyword nearby
    if (linkType === "quark" && password) {
      const hasHint = ["提取码", "密码", "pwd", "验证码", "口令"].some((kw) => surroundingText.includes(kw));
      if (!hasHint) password = "";
    }

    links.push({ type: linkType, url: href, password });
  });

  return links;
}

async function fetchThreadLinks(topicId: string): Promise<{ type: string; url: string; password: string }[]> {
  try {
    const html = await ofetch<string>(THREAD(topicId), {
      headers: {
        "User-Agent": UA,
        Referer: BASE + "/index",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 6000,
    }).catch(() => "");
    if (!html) return [];

    const $ = load(html);
    const links: { type: string; url: string; password: string }[] = [];
    const seen = new Set<string>();

    $("div.topicContent a[href^='http']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const lowerHref = href.toLowerCase();
      if (!netDiskDomains.some((d) => lowerHref.includes(d))) return;
      if (seen.has(href)) return;
      seen.add(href);

      const linkType = determineLinkType(href);
      if (linkType === "others") return;

      let surroundingText = $(a).text() || $(a).parent().text() || "";
      let password = extractPassword(surroundingText, href);

      if (linkType === "quark" && password) {
        const hasHint = ["提取码", "密码", "pwd", "验证码", "口令"].some((kw) => surroundingText.includes(kw));
        if (!hasHint) password = "";
      }

      links.push({ type: linkType, url: href, password });
    });

    // Also try extracting from text content
    const textContent = $("div.topicContent").html() || "";
    for (const pattern of re.netDiskPatterns) {
      const cloned = new RegExp(pattern.source, "g");
      let m: RegExpExecArray | null;
      while ((m = cloned.exec(textContent)) !== null) {
        const url = m[0];
        if (seen.has(url)) continue;
        seen.add(url);
        const linkType = determineLinkType(url);
        if (linkType === "others") continue;
        const password = extractPassword(textContent, url);
        links.push({ type: linkType, url, password });
      }
    }

    return links;
  } catch {
    return [];
  }
}

export class PantaPlugin extends BaseAsyncPlugin {
  constructor() {
    super("panta", 1);
  }

  override async search(keyword: string): Promise<SearchResult[]> {
    const html = await ofetch<string>(SEARCH(keyword), {
      headers: {
        "User-Agent": UA,
        Referer: BASE + "/index",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeout: 8000,
    }).catch(() => "");
    if (!html) return [];

    const $ = load(html);
    const out: SearchResult[] = [];
    const tasks: Promise<void>[] = [];
    const limit = pLimit(30);

    $("div.topicItem").each((_, el) => {
      const s = $(el);
      const topicLink = s.find("a[href^='thread?topicId=']").first();
      const href = topicLink.attr("href") || "";
      const m = re.topicId.exec(href);
      if (!m || !m[1]) return;
      const topicId: string = m[1];
      const title = topicLink.text().trim();
      if (!title) return;

      const summary = s.find("h2.summary").text().trim();
      const postTimeText = s.find("span.postTime").text();
      let datetime = "";
      const timeMatch = re.postTime.exec(postTimeText);
      if (timeMatch && timeMatch[1]) {
        const t = new Date(timeMatch[1].trim());
        if (!isNaN(t.getTime())) datetime = t.toISOString();
      }

      tasks.push(
        limit(async () => {
          // First try extracting links from the search result element
          let links = extractLinksFromElement(s);
          // If no links found, fetch the detail page
          if (links.length === 0) {
            links = await fetchThreadLinks(topicId);
          }
          if (links.length === 0) return;

          out.push({
            message_id: "",
            unique_id: `panta-${topicId}`,
            channel: "",
            datetime,
            title,
            content: summary,
            tags: ["panta"],
            links,
          });
        })
      );
    });

    await Promise.all(tasks);
    return out;
  }
}

registerGlobalPlugin(new PantaPlugin());
