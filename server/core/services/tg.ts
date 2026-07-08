/**
 * TG 频道搜索服务
 * 直接翻译自 pansou/service/search_service.go searchChannel + util.ParseSearchResults
 *
 * 关键：使用 https://t.me/s/{channel}?q={keyword} 让 Telegram 服务端搜索
 */
import { load } from "cheerio";
import { ofetch } from "ofetch";
import type { SearchResult } from "../types/models";
import { logger } from "../utils/logger";

export interface TgFetchOptions {
  limitPerChannel?: number;
  userAgent?: string;
  signal?: AbortSignal;
}

/**
 * 搜索 TG 频道
 * 对应 pansou searchChannel: 构建 ?q= 搜索URL -> 请求 -> 解析
 */
export async function fetchTgChannelPosts(
  channel: string,
  keyword: string,
  options: TgFetchOptions = {}
): Promise<SearchResult[]> {
  const ua =
    options.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

  const limit = options.limitPerChannel ?? 50;
  const maxPages = Math.ceil(limit / 20);
  const allResults: SearchResult[] = [];
  let before: string | undefined;

  for (let page = 0; page < maxPages && allResults.length < limit; page++) {
    if (options.signal?.aborted) break;

    // 构建搜索 URL，对应 pansou util.BuildSearchURL
    const baseUrl = `https://t.me/s/${encodeURIComponent(channel)}`;
    const searchQuery = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
    const beforeParam = before
      ? keyword
        ? `&before=${before}`
        : `?before=${before}`
      : "";
    const url = `${baseUrl}${searchQuery}${beforeParam}`;

    // 请求搜索结果页
    let html = "";
    const fetchOpts: Record<string, any> = {
      headers: { "user-agent": ua },
      responseType: "text",
      timeout: 15000,
    };
    if (options.signal) fetchOpts.signal = options.signal;

    try {
      html = await ofetch<string>(url, fetchOpts);
    } catch (e: any) {
      logger.debug?.(`TG fetch failed for ${url}: ${e?.message || e}`);
    }

    // 如果直接请求失败，尝试 mirror
    if (!html || !html.includes("tgme_widget_message")) {
      const mirrorBase = `https://r.jina.ai/https://t.me/s/${encodeURIComponent(channel)}`;
      const mirrorUrl = keyword
        ? before
          ? `${mirrorBase}?q=${encodeURIComponent(keyword)}&before=${before}`
          : `${mirrorBase}?q=${encodeURIComponent(keyword)}`
        : before
          ? `${mirrorBase}?before=${before}`
          : mirrorBase;

      try {
        html = await ofetch<string>(mirrorUrl, {
          headers: { "user-agent": ua },
          responseType: "text",
          timeout: 15000,
          ...(options.signal ? { signal: options.signal } : {}),
        });
      } catch (e: any) {
        logger.debug?.(`TG mirror fetch failed for ${mirrorUrl}: ${e?.message || e}`);
      }
    }

    if (!html || !html.includes("tgme_widget_message")) {
      break;
    }

    // 解析搜索结果页
    const $ = load(html);
    const pageResults = parseChannelPage($, channel, keyword, limit - allResults.length, allResults.length);
    allResults.push(...pageResults);

    // 查找下一页参数
    const nextLink = $('a[href*="before="]').first();
    const href = nextLink.attr("href");
    if (href) {
      const match = href.match(/before=([^&]+)/);
      if (match) {
        before = match[1];
      } else {
        break;
      }
    } else {
      break;
    }

    // 随机 jitter 避免被 t.me 限流
    if (page < maxPages - 1 && allResults.length < limit) {
      const jitter = 50 + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  return allResults;
}

/**
 * 解析 TG 频道搜索结果页
 * 对应 pansou util.ParseSearchResults
 */
export function parseChannelPage(
  $: cheerio.CheerioAPI,
  channel: string,
  _keyword: string,
  limit: number,
  startIndex = 0
): SearchResult[] {
  const results: SearchResult[] = [];

  const deproxyUrl = (raw: string): string => {
    try {
      const u = new URL(raw);
      if (u.hostname === "r.jina.ai") {
        const path = decodeURIComponent(u.pathname || "");
        if (path.startsWith("/http://") || path.startsWith("/https://")) {
          return path.slice(1);
        }
      }
      return raw;
    } catch {
      return raw;
    }
  };

  const classifyByHostname = (hostname: string): string => {
    const host = hostname.toLowerCase();
    if (host === "t.me" || host.endsWith(".t.me")) return "";
    if (host === "r.jina.ai") return "";
    // 使用 includes 匹配，兼容各种子域名（如 m.123pan.com、www.115cdn.com 等）
    if (host.includes("alipan.com") || host.includes("aliyundrive.com")) return "aliyun";
    if (host.includes("pan.baidu.com")) return "baidu";
    if (host.includes("pan.quark.cn")) return "quark";
    if (host.includes("pan.xunlei.com")) return "xunlei";
    // 123网盘有多个域名
    if (host.includes("123684.com") || host.includes("123685.com") ||
        host.includes("123865.com") || host.includes("123912.com") ||
        host.includes("123pan.com") || host.includes("123pan.cn") ||
        host.includes("123592.com")) return "123";
    if (host.includes("cloud.189.cn") || host.includes("tianyi.cloud")) return "tianyi";
    // 115网盘有多个域名
    if (host.includes("115.com") || host.includes("115cdn.com") ||
        host.includes("anxia.com")) return "115";
    if (host.includes("drive.uc.cn")) return "uc";
    // 移动云盘
    if (host.includes("yun.139.com") || host.includes("caiyun.139.com") ||
        host.includes("caiyun.feixin.10086.cn") || host.includes("pan.139.com")) return "mobile";
    if (host.includes("guangyapan.com")) return "guangya";
    if (host.includes("mypikpak.com")) return "pikpak";
    return "";
  };

  /**
   * 规范化网盘URL：去除非必要的query参数和hash片段
   * 保留密码等关键参数，确保同一资源的不同URL变体能被正确去重
   */
  const normalizePanUrl = (url: string, type: string): string => {
    switch (type) {
      case "quark": {
        const m = url.match(/https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/);
        return m ? m[0] : url;
      }
      case "baidu": {
        const m = url.match(/https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+(?:\?pwd=[a-zA-Z0-9]{4})?/);
        return m ? m[0] : url;
      }
      case "115": {
        const m = url.match(/https?:\/\/(?:115\.com|115cdn\.com|anxia\.com)\/s\/[a-zA-Z0-9]+(?:\?password=[a-zA-Z0-9]{4})?/);
        return m ? m[0] : url;
      }
      case "123": {
        const m = url.match(/https?:\/\/(?:www\.)?123(?:684|865|685|912|pan|592)\.(?:com|cn)\/s\/[a-zA-Z0-9_-]+/);
        return m ? m[0] : url;
      }
      case "aliyun": {
        const m = url.match(/https?:\/\/(?:www\.)?(?:alipan|aliyundrive)\.com\/s\/[a-zA-Z0-9]+/);
        return m ? m[0] : url;
      }
      case "xunlei": {
        const m = url.match(/https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9]+/);
        return m ? m[0] : url;
      }
      case "tianyi": {
        const m = url.match(/https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+/);
        return m ? m[0] : url;
      }
      case "uc": {
        const m = url.match(/https?:\/\/drive\.uc\.cn\/s\/[a-zA-Z0-9]+/);
        return m ? m[0] : url;
      }
      case "guangya": {
        const m = url.match(/https?:\/\/(?:www\.)?guangyapan\.com\/s\/[a-zA-Z0-9_-]+/);
        return m ? m[0] : url;
      }
      case "mobile": {
        const m = url.match(/https?:\/\/(?:www\.)?(?:yun\.139\.com\/shareweb\/#\/w\/i\/[a-zA-Z0-9]+|caiyun\.139\.com\/(?:w\/i\/[a-zA-Z0-9]+|m\/i\?[a-zA-Z0-9]+)|caiyun\.feixin\.10086\.cn\/[a-zA-Z0-9]+)/);
        return m ? m[0] : url;
      }
      case "pikpak": {
        const m = url.match(/https?:\/\/mypikpak\.com\/s\/[a-zA-Z0-9]+/);
        return m ? m[0] : url;
      }
      default:
        return url;
    }
  };

  $(".tgme_widget_message_wrap").each((i, el) => {
    if (results.length >= limit) return false;
    const root = $(el);
    const text = root.find(".tgme_widget_message_text").text().trim();
    const dateTitle = root.find("time").attr("datetime") || "";
    const postId = root.find(".tgme_widget_message").attr("data-post") || "";
    const firstLine = text.split("\n")[0] || text.slice(0, 80);

    // Telegram ?q= 已做服务端搜索，无需客户端再过滤

    const links: { type: string; url: string; password: string }[] = [];
    const seenUrls = new Set<string>();
    const urlPattern = /https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+|magnet:\?[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+/g;
    // pass(?!word) 防止匹配 URL 中的 password= 参数
    const passwdPattern = /(?:提取码|密码|pwd|pass(?!word))[:：\s]*([a-zA-Z0-9]{3,6})/i;

    // 优先从 URL 参数中提取密码（115: ?password=xxxx, 百度/迅雷: ?pwd=xxxx）
    const extractPasswordFromUrl = (url: string): string => {
      // 115 网盘
      if (/(?:115\.com|115cdn\.com|anxia\.com)/.test(url) && url.includes("password=")) {
        const m = /password=([a-zA-Z0-9]{4})/.exec(url);
        if (m) return m[1];
      }
      // 百度网盘
      if (url.includes("pan.baidu.com") && url.includes("pwd=")) {
        const m = /[?&]pwd=([a-zA-Z0-9]{4})/.exec(url);
        if (m) return m[1];
      }
      // 迅雷网盘
      if (url.includes("pan.xunlei.com") && url.includes("pwd=")) {
        const m = /[?&]pwd=([a-zA-Z0-9]{4})/.exec(url);
        if (m) return m[1];
      }
      return "";
    };

    const resolveUrl = (raw: string): { url: string; type: string } | null => {
      if (raw.startsWith("magnet:")) return { url: raw, type: "magnet" };
      const deproxied = deproxyUrl(raw);
      let parsed: URL;
      try {
        parsed = new URL(deproxied);
      } catch {
        return null;
      }
      const type = classifyByHostname(parsed.hostname);
      if (type) return { url: deproxied, type };

      const nestedRaw = parsed.searchParams.get("url");
      if (nestedRaw) {
        const nestedDeproxied = deproxyUrl(nestedRaw);
        try {
          const nestedType = classifyByHostname(new URL(nestedDeproxied).hostname);
          if (nestedType) return { url: nestedDeproxied, type: nestedType };
        } catch {
          return null;
        }
      }
      return null;
    };

    const addUrl = (raw: string) => {
      const resolved = resolveUrl(raw);
      if (!resolved) return;
      // 规范化URL：去除非必要的query参数和hash片段，确保去重正确
      const normalizedUrl = normalizePanUrl(resolved.url, resolved.type);
      const key = normalizedUrl.toLowerCase();
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
      // 优先从 URL 参数提取密码，其次从消息文本提取
      let password = extractPasswordFromUrl(resolved.url);
      if (!password) {
        const m = text.match(passwdPattern);
        password = m ? m[1] : "";
      }
      links.push({ type: resolved.type, url: normalizedUrl, password });
    };

    const urlsFromText = text.match(urlPattern) || [];
    for (const u of urlsFromText) addUrl(u);

    root.find(".tgme_widget_message_text a[href]").each((_, a) => {
      const href = $(a).attr("href");
      if (href) addUrl(href);
    });

    let title = firstLine;
    for (const link of links) {
      const escaped = link.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      title = title.replace(new RegExp(escaped, "g"), "");
    }
    title = title
      .replace(
        /(名称|描述|链接|大小|标签|夸克|UC|百度|阿里|迅雷|115|天翼|123|移动|提取码|密码|📧|📿|：|,|\.|\||-|\s)+/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (!title) title = firstLine.slice(0, 80);

    let content = text;
    for (const link of links) {
      const escaped = link.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      content = content.replace(new RegExp(escaped, "g"), "");
      if (link.password) {
        content = content.replace(
          new RegExp(`(?:提取码|密码|pwd|pass(?!word))[:：\\s]*${link.password}`, "gi"),
          ""
        );
      }
    }
    content = content
      .replace(/(夸克|UC|百度|阿里|迅雷|115|天翼|123|移动|：|,|\.|\||-)+/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    results.push({
      message_id: postId,
      unique_id: `tg-${channel}-${postId || startIndex + i}`,
      channel,
      datetime: dateTitle ? new Date(dateTitle).toISOString() : "",
      title,
      content,
      links,
    });
  });

  return results;
}
