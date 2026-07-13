/**
 * 插件共享工具模块
 * 为所有从 pansou 迁移的插件提供公共函数
 */

import { load } from "cheerio";
import type { SearchResult, Link } from "../types/models";
import { fetchWithRetry } from "../utils/fetch";
import {
  getLinkType,
  extractPassword,
  extractNetDiskLinks,
} from "../utils/regex";

/** 通用 UA */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 清理 HTML 标签，返回纯文本 */
export function cleanHTML(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 从任意文本中提取所有网盘链接 + 密码 */
export function extractLinksFromText(
  content: string,
  keyword?: string
): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  const urls = extractNetDiskLinks(content);

  for (const url of urls) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const type = getLinkType(url);
    const password = extractPassword(content, url);

    links.push({ type, url, password });
  }

  return links;
}

/** 从 HTML 内容中提取所有网盘链接（先 cleanHTML 再 extractLinksFromText） */
export function extractLinksFromHTML(html: string, keyword?: string): Link[] {
  // 先从原始 HTML 中提取 href 链接
  const $ = load(html);
  const allText: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (href) allText.push(href);
    if (text) allText.push(text);
  });

  // 合并 a 标签内容和纯文本
  const textContent = cleanHTML(html);
  const combined = allText.join("\n") + "\n" + textContent;

  return extractLinksFromText(combined, keyword);
}

/** 通用搜索页面抓取器 — 抓取 HTML，提取链接 */
/**
 * 抓取搜索结果页，提取详情页链接，再从详情页提取网盘链接
 * 这是大部分 pansou 插件的核心模式
 */
export async function searchWithDetailPages(
  searchUrl: string,
  options?: {
    headers?: Record<string, string>;
    timeout?: number;
    /** 详情页链接选择器（CSS），默认自动检测 */
    detailSelector?: string;
    /** 最多抓取多少个详情页，默认 8 */
    maxDetails?: number;
    /** 详情页超时时间，默认 6s */
    detailTimeout?: number;
  }
): Promise<{ results: SearchResult[]; html: string }> {
  const maxDetails = options?.maxDetails ?? 8;
  const detailTimeout = options?.detailTimeout ?? 6000;
  const headers = {
    "user-agent": UA,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    ...(options?.headers || {}),
  };

  try {
    // 1. 抓取搜索结果页
    const html = await fetchWithRetry<string>(searchUrl, {
      headers,
    }, {
      maxRetries: 1,
      timeout: options?.timeout || 8000,
      logWarnings: false,
      responseType: "text",
    }).catch(() => "");

    if (!html) return { results: [], html: "" };

    // 2. 先尝试直接从搜索页提取网盘链接
    const directLinks = extractLinksFromHTML(html);

    // 3. 从搜索页提取详情页链接
    const $ = load(html);
    const detailUrls: string[] = [];
    const seenUrls = new Set<string>();

    // 常见文章/帖子链接选择器
    const selectors = options?.detailSelector
      ? [options.detailSelector]
      : [
          "article .entry-title a",
          "article h2 a",
          "article h3 a",
          ".post-item .entry-title a",
          ".post .entry-title a",
          ".entry-title a",
          ".post-title a",
          ".article-title a",
          ".item-title a",
          ".ss-box a",
          ".ssbox a",
          ".search-result a",
          ".result-item a",
          ".post-list .post a",
          ".list .item a",
          ".box .title a",
          "h2 a",
          "h3 a",
          ".card a",
          ".topic a",
          ".thread a",
        ];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const href = $(el).attr("href") || "";
        if (
          href &&
          href.startsWith("http") &&
          !href.includes("pan.baidu.com") &&
          !href.includes("pan.quark.cn") &&
          !href.includes("aliyundrive.com") &&
          !href.includes("alipan.com") &&
          !href.includes("drive.uc.cn") &&
          !href.includes("pan.xunlei.com") &&
          !href.includes("cloud.189.cn") &&
          !href.includes("115.com") &&
          !href.includes("123pan.com") &&
          !href.includes("mypikpak.com") &&
          !href.includes("caiyun.139.com") &&
          !seenUrls.has(href)
        ) {
          seenUrls.add(href);
          detailUrls.push(href);
        }
      });
      if (detailUrls.length >= maxDetails) break;
    }

    // 也尝试从所有 <a> 标签中提取可能的文章链接
    if (detailUrls.length < maxDetails) {
      $("a[href]").each((_, el) => {
        if (detailUrls.length >= maxDetails) return;
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        // 只抓取有文本内容的、非网盘链接的、看起来像文章的链接
        if (
          href &&
          href.startsWith("http") &&
          text.length > 4 &&
          !href.includes("pan.baidu.com") &&
          !href.includes("pan.quark.cn") &&
          !href.includes("aliyundrive.com") &&
          !href.includes("alipan.com") &&
          !href.includes("drive.uc.cn") &&
          !href.includes("pan.xunlei.com") &&
          !href.includes("cloud.189.cn") &&
          !href.includes("115.com") &&
          !href.includes("123pan.com") &&
          !href.includes("mypikpak.com") &&
          !href.includes("caiyun.139.com") &&
          !href.includes("javascript:") &&
          !href.includes("#") &&
          !seenUrls.has(href)
        ) {
          // 排除导航/分类等链接
          const $el = $(el);
          const parentTag = $el.parent().prop("tagName") || "";
          if (["H1", "H2", "H3", "H4", "H5", "LI", "DD", "DT"].includes(parentTag) ||
              $el.closest("article, .post, .item, .entry, .card, .topic, .thread, .ssbox, .ss-box").length > 0) {
            seenUrls.add(href);
            detailUrls.push(href);
          }
        }
      });
    }

    // 4. 并发抓取详情页
    const results: SearchResult[] = [];

    if (detailUrls.length > 0) {
      const detailPromises = detailUrls.slice(0, maxDetails).map(async (detailUrl, i) => {
        try {
          const detailHtml = await fetchWithRetry<string>(detailUrl, {
            headers: { ...headers, referer: searchUrl },
          }, {
            maxRetries: 1,
            timeout: detailTimeout,
            logWarnings: false,
            responseType: "text",
          }).catch(() => "");

          if (!detailHtml) return null;

          const links = extractLinksFromHTML(detailHtml);
          if (links.length === 0) return null;

          // 从详情页提取标题
          const $detail = load(detailHtml);
          let title = $detail("title").first().text().trim();
          const h1 = $detail("h1").first().text().trim();
          if (h1) title = h1;
          const ogTitle = $detail('meta[property="og:title"]').attr("content");
          if (ogTitle) title = ogTitle;

          // 提取内容摘要
          let content = "";
          const contentSelectors = [
            ".post-content", ".article-content", ".entry-content",
            ".content", ".post-body", ".article-body",
            "#content", ".main-content", ".detail-content",
          ];
          for (const sel of contentSelectors) {
            const text = $detail(sel).first().text().trim();
            if (text.length > 20) {
              content = text.slice(0, 500);
              break;
            }
          }
          if (!content) content = cleanHTML(detailHtml).slice(0, 500);

          // 提取时间
          let datetime = "";
          const timeEl = $detail("time, .date, .post-date, .published, .entry-date").first();
          if (timeEl.length) {
            datetime = timeEl.attr("datetime") || timeEl.text().trim();
          }

          return createSearchResult({
            pluginName: "",
            id: `detail-${i}-${Date.now()}`,
            title: title || `Result ${i + 1}`,
            content,
            links,
            datetime,
          });
        } catch {
          return null;
        }
      });

      const detailResults = await Promise.all(detailPromises);
      for (const r of detailResults) {
        if (r) results.push(r);
      }
    }

    // 5. 如果搜索页本身有网盘链接，也加入结果
    if (directLinks.length > 0) {
      results.push(createSearchResult({
        pluginName: "",
        id: `direct-${Date.now()}`,
        title: "Search Result",
        content: cleanHTML(html).slice(0, 500),
        links: directLinks,
      }));
    }

    return { results, html };
  } catch {
    return { results: [], html: "" };
  }
}

/** 通用 JSON API 请求器 */
export async function fetchJSON<T = any>(
  url: string,
  options?: {
    headers?: Record<string, string>;
    timeout?: number;
  }
): Promise<T | null> {
  try {
    return await fetchWithRetry<T>(url, {
      headers: {
        "user-agent": UA,
        accept: "application/json, text/plain, */*",
        ...(options?.headers || {}),
      },
    }, {
      maxRetries: 1,
      timeout: options?.timeout || 8000,
      logWarnings: false,
    });
  } catch {
    return null;
  }
}

/**
 * 从 JSON API 响应中提取搜索结果
 * 自动适配各种常见 JSON 结构
 */
export function extractResultsFromJSON(
  json: any,
  pluginName: string,
  keyword: string
): SearchResult[] {
  const results: SearchResult[] = [];
  if (!json) return results;

  // 自动检测数据数组的位置
  let items: any[] = [];
  if (Array.isArray(json)) {
    items = json;
  } else if (json.data && Array.isArray(json.data)) {
    items = json.data;
  } else if (json.results && Array.isArray(json.results)) {
    items = json.results;
  } else if (json.list && Array.isArray(json.list)) {
    items = json.list;
  } else if (json.posts && Array.isArray(json.posts)) {
    items = json.posts;
  } else if (json.items && Array.isArray(json.items)) {
    items = json.items;
  } else if (json.records && Array.isArray(json.records)) {
    items = json.records;
  } else if (json.rows && Array.isArray(json.rows)) {
    items = json.rows;
  } else {
    // 尝试遍历第一层属性找数组
    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key]) && json[key].length > 0) {
        items = json[key];
        break;
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;

    // 提取标题（适配各种字段名）
    const title =
      item.title || item.name || item.share_title ||
      item.subject || item.thread_title ||
      (item.attributes && (item.attributes.title || item.attributes.name)) ||
      (item.topic && item.topic.title) ||
      "";

    // 提取内容
    const content =
      item.content || item.description || item.blurb ||
      item.cooked || item.content_html || item.contentHtml ||
      item.text || item.body ||
      (item.attributes && (item.attributes.content || item.attributes.contentHtml)) ||
      "";

    // 将整个 item 序列化后提取链接
    const contentStr = typeof content === "string" ? content : String(content || "");
    const itemStr = contentStr + " " + JSON.stringify(item);
    const links = extractLinksFromText(itemStr);

    if (links.length === 0) continue;

    // 提取时间
    const datetime =
      item.created_at || item.createdAt || item.time || item.date ||
      item.published_at || item.publishedAt ||
      (item.attributes && (item.attributes.createdAt || item.attributes.created_at)) ||
      "";

    // 提取 ID
    const id = item.id || item.share_id || item._id ||
      (item.attributes && item.attributes.id) || i;

    results.push(createSearchResult({
      pluginName,
      id,
      title: typeof title === "string" ? title : String(title || ""),
      content: typeof content === "string" ? cleanHTML(content) : "",
      links,
      datetime: typeof datetime === "string" ? datetime : "",
    }));
  }

  return filterByKeyword(results, keyword);
}

/** 关键词过滤 */
export function filterByKeyword(
  results: SearchResult[],
  keyword: string
): SearchResult[] {
  if (!keyword) return results;
  const lowerKw = keyword.toLowerCase();
  const kws = lowerKw.split(/\s+/).filter(Boolean);

  return results.filter((r) => {
    const lowerTitle = (r.title || "").toLowerCase();
    const lowerContent = (r.content || "").toLowerCase();
    return kws.every((kw) => lowerTitle.includes(kw) || lowerContent.includes(kw));
  });
}

/** 生成唯一 ID */
export function genUniqueID(pluginName: string, id: string | number): string {
  return `${pluginName}-${id}`;
}

/** 创建 SearchResult */
export function createSearchResult(params: {
  pluginName: string;
  id: string | number;
  title: string;
  content: string;
  links: Link[];
  datetime?: string;
  tags?: string[];
}): SearchResult {
  return {
    message_id: "",
    unique_id: genUniqueID(params.pluginName || "plugin", params.id),
    channel: "",
    datetime: params.datetime || new Date().toISOString(),
    title: params.title,
    content: params.content,
    links: params.links,
    tags: params.tags,
  };
}
