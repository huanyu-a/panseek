/**
 * 搜索服务
 * 所有算法直接翻译自 pansou/service/search_service.go
 * 评分排序、结果合并去重、链接-标题匹配、过滤逻辑、缓存键生成 均与 Go 版本一致
 */

import crypto from "node:crypto";
import pLimit from "p-limit";
import { UnifiedCache, CacheNamespace } from "../cache/unifiedCache";
import { safeExecute } from "../utils/fetch";
import type {
  MergedLinks,
  SearchResponse,
  SearchResult,
  Link,
  FilterConfig,
} from "../types/models";
import { PluginManager, type AsyncSearchPlugin } from "../plugins/manager";
import {
  PluginHealthChecker,
  createPluginHealthChecker,
} from "../plugins/pluginHealth";
import {
  ErrorCollector,
  classifyError,
  type WarningInfo,
} from "../utils/errors";
import { buildSearchKeywordVariants } from "../utils/searchKeyword";
import { loggers } from "../utils/logger";
import { getCheckService } from "./checkService";
import type { CheckItem } from "../types/check";
import {
  cutTitleByKeywords,
  getLinkType,
  BaiduPanPattern,
  QuarkPanPattern,
  XunleiPanPattern,
  TianyiPanPattern,
  UCPanPattern,
  Pan123Pattern,
  Pan115Pattern,
  AliyunPanPattern,
  MobilePanPattern,
} from "../utils/regex";

// ============ 常量 (对应 search_service.go L53) ============

/** 优先关键词列表，直接翻译自 pansou/service/search_service.go priorityKeywords */
const PRIORITY_KEYWORDS = ["合集", "系列", "全", "完", "最新", "附", "complete"];

// ============ 评分结构 (对应 search_service.go ResultScore) ============

interface ResultScore {
  result: SearchResult;
  timeScore: number;
  keywordScore: number;
  pluginScore: number;
  totalScore: number;
}

// ============ 缓存键生成 (对应 cache_key.go) ============

/**
 * 为TG搜索生成缓存键
 * 直接翻译自 pansou/util/cache/cache_key.go GenerateTGCacheKey
 */
function generateTGCacheKey(keyword: string, channels: string[]): string {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const channelsHash = getChannelsHash(channels);
  const keyStr = `tg:${normalizedKeyword}:${channelsHash}`;
  return crypto.createHash("md5").update(keyStr).digest("hex");
}

/**
 * 为插件搜索生成缓存键
 * 直接翻译自 pansou/util/cache/cache_key.go GeneratePluginCacheKey
 */
function generatePluginCacheKey(keyword: string, plugins: string[]): string {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const pluginsHash = getPluginsHash(plugins);
  const keyStr = `plugin:${normalizedKeyword}:${pluginsHash}`;
  return crypto.createHash("md5").update(keyStr).digest("hex");
}

function getChannelsHash(channels: string[]): string {
  if (!channels || channels.length === 0) return "all";
  const sorted = [...channels].sort();
  if (channels.length < 5) return sorted.join(",");
  const key = sorted.join(",");
  return crypto.createHash("md5").update(key).digest("hex");
}

function getPluginsHash(plugins: string[]): string {
  if (!plugins || plugins.length === 0) return "all";
  const filtered = plugins.filter((p) => p && p.trim() !== "");
  if (filtered.length === 0) return "all";
  const sorted = filtered.sort();
  if (filtered.length < 5) return sorted.join(",");
  const key = sorted.join(",");
  return crypto.createHash("md5").update(key).digest("hex");
}

// ============ 评分函数 (对应 search_service.go L1476-L1556) ============

/**
 * 从SearchResult推断数据来源
 * 直接翻译自 pansou/service/search_service.go getResultSource
 */
function getResultSource(result: SearchResult): string {
  if (result.channel) return "tg:" + result.channel;
  if (result.unique_id && result.unique_id.includes("-")) {
    const parts = result.unique_id.split("-", 2);
    if (parts.length >= 1) return "plugin:" + parts[0];
  }
  return "unknown";
}

/**
 * 根据来源获取插件等级
 * 直接翻译自 pansou/service/search_service.go getPluginLevelBySource
 */
function getPluginLevelBySource(
  source: string,
  pluginManager: PluginManager
): number {
  const parts = source.split(":");
  if (parts.length !== 2) return 3;
  if (parts[0] === "tg") return 3;
  if (parts[0] === "plugin") {
    return getPluginPriorityByName(parts[1], pluginManager);
  }
  return 3;
}

/**
 * 根据插件名获取优先级
 * 直接翻译自 pansou/service/search_service.go getPluginPriorityByName
 */
function getPluginPriorityByName(
  pluginName: string,
  pluginManager: PluginManager
): number {
  const plugins = pluginManager.getPlugins();
  const found = plugins.find(
    (p) => p.name().toLowerCase() === pluginName.toLowerCase()
  );
  if (found) return found.priority();
  return 3;
}

/**
 * 获取插件等级得分
 * 直接翻译自 pansou/service/search_service.go getPluginLevelScore
 */
function getPluginLevelScore(
  source: string,
  pluginManager: PluginManager
): number {
  const level = getPluginLevelBySource(source, pluginManager);
  switch (level) {
    case 1:
      return 1000;
    case 2:
      return 500;
    case 3:
      return 0;
    case 4:
      return -200;
    default:
      return 0;
  }
}

/**
 * 计算时间得分
 * 直接翻译自 pansou/service/search_service.go calculateTimeScore
 */
function calculateTimeScore(datetime: string): number {
  if (!datetime) return 0;
  const dt = new Date(datetime);
  if (isNaN(dt.getTime())) return 0;

  const now = Date.now();
  const daysDiff = (now - dt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 1) return 500;
  if (daysDiff <= 3) return 400;
  if (daysDiff <= 7) return 300;
  if (daysDiff <= 30) return 200;
  if (daysDiff <= 90) return 100;
  if (daysDiff <= 365) return 50;
  return 20;
}

/**
 * 获取标题中包含优先关键词的优先级
 * 直接翻译自 pansou/service/search_service.go getKeywordPriority
 */
function getKeywordPriority(title: string): number {
  const lowerTitle = title.toLowerCase();
  for (let i = 0; i < PRIORITY_KEYWORDS.length; i++) {
    if (lowerTitle.includes(PRIORITY_KEYWORDS[i])) {
      return (PRIORITY_KEYWORDS.length - i) * 70;
    }
  }
  return 0;
}

/**
 * 按综合得分排序结果
 * 直接翻译自 pansou/service/search_service.go sortResultsByTimeAndKeywords
 */
function sortResultsByTimeAndKeywords(
  results: SearchResult[],
  pluginManager: PluginManager
): void {
  const scores: ResultScore[] = results.map((result) => {
    const source = getResultSource(result);
    const timeScore = calculateTimeScore(result.datetime);
    const keywordScore = getKeywordPriority(result.title);
    const pluginScore = getPluginLevelScore(source, pluginManager);
    const totalScore = timeScore + keywordScore + pluginScore;
    return { result, timeScore, keywordScore, pluginScore, totalScore };
  });

  scores.sort((a, b) => b.totalScore - a.totalScore);

  for (let i = 0; i < scores.length; i++) {
    results[i] = scores[i].result;
  }
}

// ============ 结果合并去重 (对应 search_service.go L104-L198) ============

/**
 * 生成结果的唯一标识键
 * 直接翻译自 pansou/service/search_service.go generateResultKey
 */
function generateResultKey(result: SearchResult): string {
  if (result.unique_id) return result.unique_id;
  if (result.message_id) return result.message_id;
  return `title_${result.title}_${result.channel}`;
}

/**
 * 计算结果信息的完整度得分
 * 直接翻译自 pansou/service/search_service.go calculateCompletenessScore
 */
function calculateCompletenessScore(result: SearchResult): number {
  let score = 0;
  if (result.unique_id) score += 10;
  if (result.links && result.links.length > 0) {
    score += 5;
    score += result.links.length;
  }
  if (result.content) score += 3;
  score += Math.floor(result.title.length / 10);
  if (result.channel) score += 2;
  if (result.tags) score += result.tags.length;
  return score;
}

/**
 * 选择信息更完整的结果
 * 直接翻译自 pansou/service/search_service.go selectBetterResult
 */
function selectBetterResult(
  existing: SearchResult,
  neu: SearchResult
): SearchResult {
  const existingScore = calculateCompletenessScore(existing);
  const newScore = calculateCompletenessScore(neu);
  return newScore > existingScore ? neu : existing;
}

/**
 * 智能合并搜索结果，去重并保留最完整的信息
 * 直接翻译自 pansou/service/search_service.go mergeSearchResults
 */
function mergeSearchResults(
  existing: SearchResult[],
  newResults: SearchResult[]
): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (const result of existing) {
    const key = generateResultKey(result);
    resultMap.set(key, result);
  }

  for (const newResult of newResults) {
    const key = generateResultKey(newResult);
    const existingResult = resultMap.get(key);
    if (existingResult) {
      resultMap.set(key, selectBetterResult(existingResult, newResult));
    } else {
      resultMap.set(key, newResult);
    }
  }

  const merged = Array.from(resultMap.values());

  // 按时间排序（最新的在前）
  merged.sort((a, b) => {
    const ta = a.datetime ? new Date(a.datetime).getTime() : 0;
    const tb = b.datetime ? new Date(b.datetime).getTime() : 0;
    return tb - ta;
  });

  return merged;
}

// ============ 链接-标题匹配 (对应 search_service.go L628-L987) ============

/**
 * 判断一行是否为链接行
 * 直接翻译自 pansou/service/search_service.go isLinkLine
 */
function isLinkLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  return (
    lowerLine.startsWith("链接：") ||
    lowerLine.startsWith("地址：") ||
    lowerLine.startsWith("资源地址：") ||
    lowerLine.startsWith("网盘：") ||
    lowerLine.startsWith("网盘地址：") ||
    lowerLine.startsWith("链接:")
  );
}

/**
 * 判断是否为链接前缀词（包括网盘名称）
 * 直接翻译自 pansou/service/search_service.go isLinkPrefix
 */
function isLinkPrefix(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (["链接", "地址", "资源地址", "网盘", "网盘地址"].includes(t)) return true;

  const cloudDiskNames = [
    "夸克", "夸克网盘", "quark", "夸克云盘",
    "百度", "百度网盘", "baidu", "百度云", "bdwp", "bdpan",
    "迅雷", "迅雷网盘", "xunlei", "迅雷云盘",
    "115", "115网盘", "115云盘",
    "123", "123pan", "123网盘", "123云盘",
    "阿里", "阿里云", "阿里云盘", "aliyun", "alipan", "阿里网盘",
    "光鸭", "光鸭云盘", "光鸭网盘", "guangya",
    "天翼", "天翼云", "天翼云盘", "tianyi", "天翼网盘",
    "uc", "uc网盘", "uc云盘",
    "移动", "移动云", "移动云盘", "caiyun", "彩云",
    "pikpak", "pikpak网盘",
  ];
  return cloudDiskNames.includes(t);
}

/**
 * 清理标题文本
 * 直接翻译自 pansou/service/search_service.go cleanTitle
 */
function cleanTitle(title: string): string {
  title = title.trim();
  title = title.replace(/^名称：/, "");
  title = title.replace(/^标题：/, "");
  title = title.replace(/^片名：/, "");
  title = title.replace(/^名称:/, "");
  title = title.replace(/^标题:/, "");
  title = title.replace(/^片名:/, "");
  // 移除表情符号和特殊字符
  title = title.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "");
  return title.trim();
}

/**
 * 从链接行中提取可能的标题
 * 直接翻译自 pansou/service/search_service.go extractTitleFromLinkLine
 */
function extractTitleFromLinkLine(line: string): string {
  const parts = line.split("：", 2);
  if (parts.length === 2 && !parts[0].includes("http") && !isLinkPrefix(parts[0])) {
    return cleanTitle(parts[0]);
  }
  const parts2 = line.split(":", 2);
  if (parts2.length === 2 && !parts2[0].includes("http") && !isLinkPrefix(parts2[0])) {
    return cleanTitle(parts2[0]);
  }
  return "";
}

/**
 * 从文本中提取第一个URL
 * 直接翻译自 pansou/util/parser_util.go extractFirstURL
 */
function extractFirstURL(text: string): string {
  let endIdx = text.length;
  const spaceIdx = text.indexOf(" ");
  if (spaceIdx > 0 && spaceIdx < endIdx) endIdx = spaceIdx;
  const newlineIdx = text.indexOf("\n");
  if (newlineIdx > 0 && newlineIdx < endIdx) endIdx = newlineIdx;
  const crIdx = text.indexOf("\r");
  if (crIdx > 0 && crIdx < endIdx) endIdx = crIdx;
  return text.slice(0, endIdx).trim();
}

/**
 * 从链接前的文本中提取标题
 * 直接翻译自 pansou/service/search_service.go extractTitleBeforeLink
 */
function extractTitleBeforeLink(text: string): string {
  text = text.trim();
  const linkIdx = text.indexOf("链接：");
  if (linkIdx > 0) return cleanTitle(text.slice(0, linkIdx));

  // 尝试匹配常见的标题模式
  const titlePattern = /([^链地资网\s]+?(?:\([^)]+\))?(?:\s*\d+K)?(?:\s*臻彩)?(?:\s*MAX)?(?:\s*HDR)?(?:\s*更(?:新)?\d+集))$/;
  const matches = titlePattern.exec(text);
  if (matches && matches.length > 1) return cleanTitle(matches[1]);

  return cleanTitle(text);
}

/**
 * 处理有换行符的情况：提取链接-标题对应关系
 * 直接翻译自 pansou/service/search_service.go extractLinkTitlePairsWithNewlines
 */
function extractLinkTitlePairsWithNewlines(content: string): Map<string, string> {
  const linkTitleMap = new Map<string, string>();
  const lines = content.split("\n");
  const linkRegex = /https?:\/\/[^\s"']+/g;

  let lastTitle = "";
  let lastTitleIndex = -1;

  // 第一遍扫描：识别标题-链接对
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const links = line.match(linkRegex);

    if (links && links.length > 0) {
      const isStandardLinkLine = isLinkLine(line);

      if (isStandardLinkLine && lastTitle) {
        for (const link of links) linkTitleMap.set(link, lastTitle);
      } else if (!isStandardLinkLine) {
        const titleFromLine = extractTitleFromLinkLine(line);
        if (titleFromLine) {
          for (const link of links) linkTitleMap.set(link, titleFromLine);
        } else if (lastTitle) {
          for (const link of links) linkTitleMap.set(link, lastTitle);
        }
      }
    } else {
      // 当前行不包含链接，可能是标题行
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (isLinkLine(nextLine) || linkRegex.test(nextLine)) {
          lastTitle = cleanTitle(line);
          lastTitleIndex = i;
        }
      } else {
        lastTitle = cleanTitle(line);
        lastTitleIndex = i;
      }
    }
  }

  // 第二遍扫描：处理没有匹配到标题的链接
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const links = line.match(linkRegex);
    if (!links || links.length === 0) continue;

    for (const link of links) {
      if (!linkTitleMap.has(link)) {
        let nearestTitle = "";
        for (let j = i - 1; j >= 0; j--) {
          if (
            j === lastTitleIndex ||
            (j + 1 < lines.length &&
              linkRegex.test(lines[j + 1]) &&
              !linkRegex.test(lines[j]))
          ) {
            const candidateTitle = cleanTitle(lines[j]);
            if (candidateTitle) {
              nearestTitle = candidateTitle;
              break;
            }
          }
        }
        if (nearestTitle) linkTitleMap.set(link, nearestTitle);
      }
    }
  }

  return linkTitleMap;
}

/**
 * 标准化URL（将URL编码转换为中文）
 * 直接翻译自 pansou/util/parser_util.go normalizeUrl
 */
function normalizeUrl(rawUrl: string): string {
  try {
    return decodeURIComponent(rawUrl);
  } catch {
    return rawUrl;
  }
}

/**
 * 处理没有换行符的情况：提取链接-标题对应关系
 * 直接翻译自 pansou/service/search_service.go extractLinkTitlePairsWithoutNewlines
 */
function extractLinkTitlePairsWithoutNewlines(content: string): Map<string, string> {
  const linkTitleMap = new Map<string, string>();

  const linkPatterns = [
    new RegExp(TianyiPanPattern.source, "g"),
    new RegExp(BaiduPanPattern.source, "g"),
    new RegExp(QuarkPanPattern.source, "g"),
    new RegExp(AliyunPanPattern.source, "g"),
    new RegExp(MobilePanPattern.source, "g"),
    new RegExp(UCPanPattern.source, "g"),
    new RegExp(Pan123Pattern.source, "g"),
    new RegExp(Pan115Pattern.source, "g"),
    new RegExp(XunleiPanPattern.source, "g"),
  ];

  type LinkInfo = { url: string; pos: number };
  const allLinks: LinkInfo[] = [];

  for (const pattern of linkPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      allLinks.push({ url: match[0], pos: match.index });
    }
  }

  allLinks.sort((a, b) => a.pos - b.pos);

  // URL标准化和去重
  const uniqueLinks = new Map<string, string>();
  const links: string[] = [];
  for (const li of allLinks) {
    const normalized = normalizeUrl(li.url);
    if (!uniqueLinks.has(normalized)) {
      uniqueLinks.set(normalized, li.url);
      links.push(li.url);
    }
  }

  if (links.length === 0) return linkTitleMap;

  // 使用链接位置分割内容
  const segments: string[] = new Array(links.length + 1).fill("");
  let lastPos = 0;

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const idx = content.indexOf(link, lastPos);
    if (idx === -1) continue;
    const pos = idx;
    if (pos > lastPos) segments[i] = content.slice(lastPos, pos);
    lastPos = pos + link.length;
  }
  if (lastPos < content.length) segments[links.length] = content.slice(lastPos);

  // 从每个段落中提取标题
  for (let i = 0; i < links.length; i++) {
    const title = extractTitleBeforeLink(segments[i]);
    if (title) linkTitleMap.set(links[i], title);
  }

  return linkTitleMap;
}

/**
 * 从消息内容中提取链接-标题对应关系
 * 直接翻译自 pansou/service/search_service.go extractLinkTitlePairs
 */
function extractLinkTitlePairs(content: string): Map<string, string> {
  if (content.includes("\n")) {
    return extractLinkTitlePairsWithNewlines(content);
  }
  return extractLinkTitlePairsWithoutNewlines(content);
}

// ============ 过滤逻辑 (对应 pansou/api/filter.go) ============

/**
 * 检查文本是否匹配过滤条件
 * 直接翻译自 pansou/api/filter.go matchFilter
 */
function matchFilter(
  text: string,
  includeKeywords: string[],
  excludeKeywords: string[]
): boolean {
  const lowerText = text.toLowerCase();

  for (const kw of excludeKeywords) {
    if (lowerText.includes(kw)) return false;
  }

  if (includeKeywords.length > 0) {
    let matched = false;
    for (const kw of includeKeywords) {
      if (lowerText.includes(kw)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }

  return true;
}

/**
 * 过滤 merged_by_type 中的链接
 * 直接翻译自 pansou/api/filter.go filterMergedByType
 */
function filterMergedByType(
  mergedLinks: MergedLinks,
  includeKeywords: string[],
  excludeKeywords: string[]
): MergedLinks {
  if (!mergedLinks) return {};

  const filtered: MergedLinks = {};
  for (const [linkType, links] of Object.entries(mergedLinks)) {
    const filteredLinks = links.filter((link) =>
      matchFilter(link.note, includeKeywords, excludeKeywords)
    );
    if (filteredLinks.length > 0) filtered[linkType] = filteredLinks;
  }
  return filtered;
}

/**
 * 过滤 results 数组
 * 直接翻译自 pansou/api/filter.go filterResults
 */
function filterResults(
  results: SearchResult[],
  includeKeywords: string[],
  excludeKeywords: string[]
): SearchResult[] {
  if (!results) return [];

  const filtered: SearchResult[] = [];
  for (const result of results) {
    if (!matchFilter(result.title, includeKeywords, excludeKeywords)) continue;

    const filteredLinks: Link[] = [];
    for (const link of result.links || []) {
      const checkText = link.work_title || result.title;
      if (matchFilter(checkText, includeKeywords, excludeKeywords)) {
        filteredLinks.push(link);
      }
    }

    if (filteredLinks.length > 0) {
      result.links = filteredLinks;
      filtered.push(result);
    }
  }
  return filtered;
}

/**
 * 应用过滤器到搜索响应
 * 直接翻译自 pansou/api/filter.go applyResultFilter
 */
function applyResultFilter(
  response: SearchResponse,
  filter: FilterConfig | undefined,
  resultType: string
): SearchResponse {
  if (!filter || ((!filter.include || filter.include.length === 0) && (!filter.exclude || filter.exclude.length === 0))) {
    return response;
  }

  const includeKeywords = (filter.include || []).map((kw) => kw.toLowerCase());
  const excludeKeywords = (filter.exclude || []).map((kw) => kw.toLowerCase());

  if (resultType === "merged_by_type" || resultType === "") {
    response.merged_by_type = filterMergedByType(
      response.merged_by_type || {},
      includeKeywords,
      excludeKeywords
    );
    let total = 0;
    for (const links of Object.values(response.merged_by_type)) {
      total += links.length;
    }
    response.total = total;
  } else if (resultType === "all" || resultType === "results") {
    response.results = filterResults(
      response.results || [],
      includeKeywords,
      excludeKeywords
    );
    response.total = response.results.length;
    if (resultType === "all") {
      response.merged_by_type = filterMergedByType(
        response.merged_by_type || {},
        includeKeywords,
        excludeKeywords
      );
    }
  }

  return response;
}

/**
 * 提取网盘URL的规范化键（去除query参数和hash片段）
 * 用于跨来源去重：同一资源的不同URL变体（带不同query参数）应合并为一条
 * 例如 https://pan.quark.cn/s/826a1010fd5c?entry=funletu#/list/share
 *   和 https://pan.quark.cn/s/826a1010fd5c?entry=funletu#/list/share
 *   应识别为同一个资源
 */
function getCanonicalUrlKey(url: string): string {
  // 夸克
  let m = url.match(/https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/);
  if (m) return m[0];
  // 百度（保留pwd参数）
  m = url.match(/https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+(?:\?pwd=[a-zA-Z0-9]{4})?/);
  if (m) return m[0];
  // 115（保留password参数）
  m = url.match(/https?:\/\/(?:115\.com|115cdn\.com|anxia\.com)\/s\/[a-zA-Z0-9]+(?:\?password=[a-zA-Z0-9]{4})?/);
  if (m) return m[0];
  // 123
  m = url.match(/https?:\/\/(?:www\.)?123(?:684|865|685|912|pan|592)\.(?:com|cn)\/s\/[a-zA-Z0-9_-]+/);
  if (m) return m[0];
  // 阿里
  m = url.match(/https?:\/\/(?:www\.)?(?:alipan|aliyundrive)\.com\/s\/[a-zA-Z0-9]+/);
  if (m) return m[0];
  // 迅雷
  m = url.match(/https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9]+/);
  if (m) return m[0];
  // 天翼
  m = url.match(/https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+/);
  if (m) return m[0];
  // UC
  m = url.match(/https?:\/\/drive\.uc\.cn\/s\/[a-zA-Z0-9]+/);
  if (m) return m[0];
  // 光鸭
  m = url.match(/https?:\/\/(?:www\.)?guangyapan\.com\/s\/[a-zA-Z0-9_-]+/);
  if (m) return m[0];
  // 移动云盘
  m = url.match(/https?:\/\/(?:www\.)?(?:yun\.139\.com\/shareweb\/#\/w\/i\/[a-zA-Z0-9]+|caiyun\.139\.com\/(?:w\/i\/[a-zA-Z0-9]+|m\/i\?[a-zA-Z0-9]+)|caiyun\.feixin\.10086\.cn\/[a-zA-Z0-9]+)/);
  if (m) return m[0];
  // pikpak
  m = url.match(/https?:\/\/mypikpak\.com\/s\/[a-zA-Z0-9]+/);
  if (m) return m[0];
  return url;
}

// ============ SearchService 主类 ============

export interface SearchServiceOptions {
  priorityChannels: string[];
  defaultChannels: string[];
  defaultConcurrency: number;
  pluginTimeoutMs: number;
  cacheEnabled: boolean;
  cacheTtlMinutes: number;
}

export class SearchService {
  private static readonly TG_CHANNEL_LIMIT = 80;
  private static readonly TG_DEEP_CHANNEL_LIMIT = 160;
  private static readonly TG_DEEP_SEARCH_TRIGGER = 3;
  private static readonly PLUGIN_VARIANT_TRIGGER = 5;

  private options: SearchServiceOptions;
  private pluginManager: PluginManager;
  private cache: UnifiedCache;
  private healthChecker: PluginHealthChecker;

  constructor(options: SearchServiceOptions, pluginManager: PluginManager) {
    this.options = options;
    this.pluginManager = pluginManager;
    this.cache = new UnifiedCache(
      {
        enabled: options.cacheEnabled,
        ttlMinutes: options.cacheTtlMinutes,
      },
      "search"
    );

    this.healthChecker = createPluginHealthChecker();
  }

  getPluginManager() {
    return this.pluginManager;
  }

  async search(
    keyword: string,
    channels: string[] | undefined,
    concurrency: number | undefined,
    forceRefresh: boolean | undefined,
    resultType: string | undefined,
    sourceType: "all" | "tg" | "plugin" | undefined,
    plugins: string[] | undefined,
    cloudTypes: string[] | undefined,
    ext: Record<string, any> | undefined,
    signal?: AbortSignal,
    filter?: FilterConfig
  ): Promise<SearchResponse> {
    const { response } = await this.searchWithWarnings(
      keyword,
      channels,
      concurrency,
      forceRefresh,
      resultType,
      sourceType,
      plugins,
      cloudTypes,
      ext,
      signal,
      filter
    );
    return response;
  }

  async searchWithWarnings(
    keyword: string,
    channels: string[] | undefined,
    concurrency: number | undefined,
    forceRefresh: boolean | undefined,
    resultType: string | undefined,
    sourceType: "all" | "tg" | "plugin" | undefined,
    plugins: string[] | undefined,
    cloudTypes: string[] | undefined,
    ext: Record<string, any> | undefined,
    signal?: AbortSignal,
    filter?: FilterConfig
  ): Promise<{ response: SearchResponse; warnings: WarningInfo[] }> {
    if (signal?.aborted) {
      return { response: { total: 0 }, warnings: [] };
    }

    const errorCollector = new ErrorCollector();
    const requestStart = Date.now();
    const effChannels =
      channels && channels.length > 0 ? channels : this.options.defaultChannels;
    const effConcurrency =
      concurrency && concurrency > 0
        ? concurrency
        : this.options.defaultConcurrency;
    const effResultType =
      !resultType || resultType === "merge" ? "merged_by_type" : resultType;
    const effSourceType = sourceType ?? "all";

    // 插件参数规范化处理 (对应 search_service.go L366-L426)
    let effPlugins = plugins;
    if (effSourceType === "tg") {
      effPlugins = undefined;
    } else if (effSourceType === "all" || effSourceType === "plugin") {
      if (effPlugins && effPlugins.length > 0 && effPlugins.some((p) => !!p)) {
        const allPlugins = this.pluginManager.getPlugins();
        const allPluginNames = allPlugins.map((p) => p.name().toLowerCase());
        const requestedPlugins = effPlugins.filter((p) => p).map((p) => p.toLowerCase());
        if (requestedPlugins.length === allPluginNames.length) {
          const pluginSet = new Set(requestedPlugins);
          const allIncluded = allPluginNames.every((name) => pluginSet.has(name));
          if (allIncluded) effPlugins = undefined;
        }
      } else {
        effPlugins = undefined;
      }
    }

    let tgResults: SearchResult[] = [];
    let pluginResults: SearchResult[] = [];

    const tasks: Array<() => Promise<void>> = [];

    if (effSourceType === "all" || effSourceType === "tg") {
      tasks.push(async () => {
        const concOverride =
          typeof concurrency === "number" && concurrency > 0
            ? concurrency
            : undefined;
        tgResults = await this.searchTG(
          keyword,
          effChannels,
          !!forceRefresh,
          concOverride,
          ext,
          signal
        );
      });
    }
    if (effSourceType === "all" || effSourceType === "plugin") {
      tasks.push(async () => {
        pluginResults = await this.searchPlugins(
          keyword,
          effPlugins,
          !!forceRefresh,
          effConcurrency,
          ext ?? {},
          errorCollector,
          signal
        );
      });
    }

    await Promise.all(tasks.map((task) => task()));

    // 合并结果 (使用智能合并，对应 search_service.go mergeSearchResults)
    const allResults = mergeSearchResults(tgResults, pluginResults);

    // 按综合得分排序 (对应 search_service.go sortResultsByTimeAndKeywords)
    sortResultsByTimeAndKeywords(allResults, this.pluginManager);

    // 过滤结果：只保留有时间/有优先关键词/高等级插件的结果
    // 直接翻译自 search_service.go L477-L486
    const filteredForResults: SearchResult[] = [];
    for (const result of allResults) {
      const source = getResultSource(result);
      const pluginLevel = getPluginLevelBySource(source, this.pluginManager);
      const hasTime = !!result.datetime;
      const keywordPrio = getKeywordPriority(result.title);
      if (hasTime || keywordPrio > 0 || pluginLevel <= 2) {
        filteredForResults.push(result);
      }
    }

    // 合并链接按网盘类型分组
    let mergedLinks = this.mergeResultsByType(
      allResults,
      keyword,
      cloudTypes
    );

    // ============ 失效链接过滤 ============
    // 收集所有唯一链接进行检测
    const checkItems: CheckItem[] = [];
    const seenUrls = new Set<string>();
    for (const result of allResults) {
      for (const link of result.links || []) {
        if (seenUrls.has(link.url)) continue;
        seenUrls.add(link.url);
        const linkType = link.type || getLinkType(link.url);
        // 只检测支持的网盘类型
        if (linkType && linkType !== "others" && linkType !== "unknown" && linkType !== "magnet" && linkType !== "ed2k") {
          checkItems.push({
            disk_type: linkType,
            url: link.url,
            password: link.password || "",
          });
        }
      }
    }

    // 批量检测链接有效性（带缓存+并行+超时）
    let deadLinkUrls = new Set<string>();
    let checkedCount = 0;
    let cachedBadCount = 0;
    if (checkItems.length > 0) {
      try {
        const checkResults = await getCheckService().batchCheckForFilter(checkItems, {
          timeoutMs: 8000,
          concurrency: 15,
        });
        for (const [url, result] of checkResults) {
          checkedCount++;
          if (result.state === "bad") {
            deadLinkUrls.add(url);
            if (result.cache_hit) cachedBadCount++;
          }
        }
      } catch (e) {
        loggers.search.warn("链接有效性检测失败", { error: String(e) });
      }
    }

    // 从 filteredForResults 中过滤掉含失效链接的结果项
    let filteredResults = filteredForResults;
    if (deadLinkUrls.size > 0) {
      filteredResults = filteredForResults
        .map((result) => {
          if (!result.links || result.links.length === 0) return result;
          const aliveLinks = result.links.filter((link) => !deadLinkUrls.has(link.url));
          if (aliveLinks.length === 0) return null; // 所有链接都失效，移除整个结果
          if (aliveLinks.length === result.links.length) return result; // 没有失效链接
          return { ...result, links: aliveLinks };
        })
        .filter(Boolean) as SearchResult[];
    }

    // 从 mergedLinks 中过滤掉失效链接
    if (deadLinkUrls.size > 0) {
      const filteredMergedLinks: MergedLinks = {};
      for (const [linkType, links] of Object.entries(mergedLinks)) {
        const aliveLinks = links.filter((link) => !deadLinkUrls.has(link.url));
        if (aliveLinks.length > 0) {
          filteredMergedLinks[linkType] = aliveLinks;
        }
      }
      mergedLinks = filteredMergedLinks;
    }

    if (deadLinkUrls.size > 0) {
      loggers.search.info("失效链接过滤完成", {
        keyword,
        totalLinks: checkItems.length,
        checkedLinks: checkedCount,
        cachedBad: cachedBadCount,
        deadLinks: deadLinkUrls.size,
        resultsBefore: filteredForResults.length,
        resultsAfter: filteredResults.length,
      });
    }

    let total = 0;
    let response: SearchResponse = { total: 0 };

    // 根据resultType过滤返回结果 (对应 search_service.go filterResponseByType)
    if (effResultType === "merged_by_type") {
      total = Object.values(mergedLinks).reduce(
        (sum, items) => sum + items.length,
        0
      );
      response = { total, merged_by_type: mergedLinks };
    } else if (effResultType === "results") {
      total = filteredResults.length;
      response = { total, results: filteredResults };
    } else {
      // "all" 类型
      total = filteredResults.length;
      response = {
        total,
        results: filteredResults,
        merged_by_type: mergedLinks,
      };
    }

    // 应用过滤器 (对应 pansou/api/filter.go applyResultFilter)
    if (filter) {
      response = applyResultFilter(response, filter, effResultType);
    }

    const requestMs = Date.now() - requestStart;
    loggers.search.info("搜索请求完成", {
      keyword,
      total,
      tgCount: tgResults.length,
      pluginSources: pluginResults.length,
      sourceType: effSourceType,
      requestedPlugins: effPlugins ?? "all",
      requestedChannels: effChannels.length,
      durationMs: requestMs,
      filteredResultCount: filteredResults.length,
    });

    return {
      response,
      warnings: errorCollector.getWarnings(),
    };
  }

  private async searchTG(
    keyword: string,
    channels: string[] | undefined,
    forceRefresh: boolean,
    concurrencyOverride?: number,
    ext?: Record<string, any>,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const chList = Array.isArray(channels) ? channels : [];
    // 使用 MD5 哈希缓存键 (对应 pansou GenerateTGCacheKey)
    const cacheKey = generateTGCacheKey(keyword, chList);
    const { cacheEnabled, priorityChannels } = this.options;

    if (!forceRefresh && cacheEnabled) {
      const cached = this.cache.get(CacheNamespace.TG_SEARCH, cacheKey);
      if (cached.hit && cached.value) {
        return cached.value;
      }
    }

    const { fetchTgChannelPosts } = await import("./tg");
    const requestedTimeout = Number((ext as any)?.__plugin_timeout_ms) || 0;
    const timeoutMs = Math.max(
      3000,
      requestedTimeout > 0
        ? requestedTimeout
        : this.options.pluginTimeoutMs || 0
    );
const concurrency = Math.max(
2,
Math.min(concurrencyOverride ?? this.options.defaultConcurrency, 20)
);

    const prioritySet = new Set(priorityChannels || []);
    const priorityList = chList.filter((channel) => prioritySet.has(channel));
    const normalList = chList.filter((channel) => !prioritySet.has(channel));

    const createChannelTask =
      (channel: string, limitPerChannel: number) => async () => {
        if (signal?.aborted) return [];
        const controller = new AbortController();
        const mergedSignal = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal;
        const result = await safeExecute(
          () =>
            this.withTimeout<SearchResult[]>(
              fetchTgChannelPosts(channel, keyword, {
                limitPerChannel,
                signal: mergedSignal,
              }),
              timeoutMs,
              [],
              controller
            ),
          []
        );
        return result;
      };

    const flattenResults = (items: SearchResult[][]) => {
      const flattened: SearchResult[] = [];
      for (const arr of items) {
        if (Array.isArray(arr)) flattened.push(...arr);
      }
      return flattened;
    };

    const shallowTasks = [...priorityList, ...normalList].map((channel) =>
      createChannelTask(channel, SearchService.TG_CHANNEL_LIMIT)
    );
    const shallowResults = flattenResults(
      await this.runWithConcurrency(shallowTasks, concurrency, signal)
    );

    let results = shallowResults;
    if (
      results.length < SearchService.TG_DEEP_SEARCH_TRIGGER &&
      keyword.trim().length > 1 &&
      chList.length > 0
    ) {
      const deepTasks = [...priorityList, ...normalList].map((channel) =>
        createChannelTask(channel, SearchService.TG_DEEP_CHANNEL_LIMIT)
      );
      const deepResults = flattenResults(
        await this.runWithConcurrency(deepTasks, concurrency, signal)
      );
      results = mergeSearchResults(results, deepResults);
    }

    if (cacheEnabled && results.length > 0) {
      this.cache.set(CacheNamespace.TG_SEARCH, cacheKey, results);
    }

    loggers.search.debug("TG 搜索汇总", {
      keyword,
      channelCount: chList.length,
      priorityCount: priorityList.length,
      normalCount: normalList.length,
      shallow: shallowResults.length,
      deep: results.length - shallowResults.length,
      wentDeep: results.length > shallowResults.length,
    });

    return results;
  }

  private async searchPlugins(
    keyword: string,
    plugins: string[] | undefined,
    forceRefresh: boolean,
    concurrency: number,
    ext: Record<string, any>,
    errorCollector: ErrorCollector,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    // 使用 MD5 哈希缓存键 (对应 pansou GeneratePluginCacheKey)
    const cacheKey = generatePluginCacheKey(keyword, plugins || []);
    const { cacheEnabled } = this.options;

    if (!forceRefresh && cacheEnabled) {
      const cached = this.cache.get(CacheNamespace.PLUGIN_SEARCH, cacheKey);
      if (cached.hit && cached.value) {
        return cached.value;
      }
    }

    const allPlugins = this.pluginManager.getPlugins();
    const healthyPlugins = allPlugins.filter((plugin) =>
      this.healthChecker.isHealthy(plugin.name())
    );

    let available: AsyncSearchPlugin[] = [];
    if (plugins && plugins.length > 0 && plugins.some((plugin) => !!plugin)) {
      const wanted = new Set(plugins.map((plugin) => plugin.toLowerCase()));
      available = healthyPlugins.filter((plugin) =>
        wanted.has(plugin.name().toLowerCase())
      );
    } else {
      available = healthyPlugins;
    }

    const requestedTimeout = Number((ext as any)?.__plugin_timeout_ms) || 0;
    const timeoutMs = Math.max(
      3000,
      requestedTimeout > 0
        ? requestedTimeout
        : this.options.pluginTimeoutMs || 0
    );

    const pluginPromises = available.map((plugin) => async () => {
      plugin.setMainCacheKey(cacheKey);
      plugin.setCurrentKeyword(keyword);

      const startTime = Date.now();
      const pluginName = plugin.name();

      try {
        // 只使用原始关键词搜索，避免多变体导致超时
        const queries = [keyword];

        let results: SearchResult[] = [];
        for (const [index, query] of queries.entries()) {
          if (signal?.aborted) break;

          const controller = new AbortController();
          const mergedSignal = signal
            ? AbortSignal.any([signal, controller.signal])
            : controller.signal;
          const currentResults = await this.withTimeout<SearchResult[]>(
            plugin.search(query, { ...ext, signal: mergedSignal }),
            timeoutMs,
            [],
            controller
          );

          results = mergeSearchResults(results, currentResults || []);

          if (
            results.length >= SearchService.PLUGIN_VARIANT_TRIGGER ||
            index === queries.length - 1
          ) {
            break;
          }
        }

        const responseTime = Date.now() - startTime;
        this.healthChecker.recordSuccess(pluginName, responseTime);

        loggers.search.debug("单插件完成", {
          plugin: pluginName,
          ms: responseTime,
          count: results.length,
          empty: results.length === 0,
          keyword,
        });

        return results;
      } catch (error) {
        const errorMs = Date.now() - startTime;
        this.healthChecker.recordFailure(pluginName);

        loggers.search.debug("单插件失败", {
          plugin: pluginName,
          ms: errorMs,
          error: error instanceof Error ? error.message : String(error),
          keyword,
        });

        throw error;
      }
    });

    // 插件搜索使用更高并发：每个插件是独立的外部 HTTP 请求，可以安全并发
    // 最少 20 并发，最多不超过 available 数量
    const pluginConcurrency = Math.min(
      Math.max(concurrency, 20),
      available.length
    );

    const resultsByPlugin = await this.runWithConcurrency(
      pluginPromises.map((promiseFactory) => async () => {
        try {
          return await promiseFactory();
        } catch (error) {
          const errorDetail = classifyError(error, "plugin_search");
          errorCollector.record(errorDetail);
          return [];
        }
      }),
      pluginConcurrency,
      signal
    );

    const merged: SearchResult[] = [];
    for (const arr of resultsByPlugin) {
      if (Array.isArray(arr)) merged.push(...arr);
    }

    if (cacheEnabled && merged.length > 0) {
      this.cache.set(CacheNamespace.PLUGIN_SEARCH, cacheKey, merged);
    }

    return merged;
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    fallback: T,
    controller?: AbortController
  ): Promise<T> {
    if (!ms || ms <= 0) return promise;
    let timeoutHandle: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutHandle = setTimeout(() => {
        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
        resolve(fallback);
      }, ms);
    });
    return Promise.race([
      promise.finally(() => clearTimeout(timeoutHandle)),
      timeoutPromise,
    ]) as Promise<T>;
  }

  /**
   * 合并链接按网盘类型分组
   * 直接翻译自 pansou/service/search_service.go mergeResultsByType
   * 包含完整的链接-标题匹配逻辑
   */
  private mergeResultsByType(
    results: SearchResult[],
    keyword: string,
    cloudTypes?: string[]
  ): MergedLinks {
    const mergedLinks: MergedLinks = {};
    const uniqueLinks = new Map<string, any>();
    const lowerKeyword = keyword.toLowerCase();

    for (const result of results) {
      // 提取消息中的链接-标题对应关系
      const linkTitleMap = extractLinkTitlePairs(result.content);

      // 如果没有从内容中提取到标题，尝试直接从内容中匹配（无换行符的情况）
      if (
        linkTitleMap.size === 0 &&
        result.links &&
        result.links.length > 0 &&
        !result.content.includes("\n")
      ) {
        const content = result.content;
        const linkPrefixes = [
          "天翼链接：", "百度链接：", "夸克链接：", "阿里链接：",
          "UC链接：", "115链接：", "迅雷链接：", "123链接：", "链接：",
        ];

        let parts: string[] = [];
        for (const prefix of linkPrefixes) {
          if (content.includes(prefix)) {
            parts = content.split(prefix);
            break;
          }
        }

        if (parts.length > 1 && result.links.length <= parts.length - 1) {
          const titles: string[] = [cleanTitle(parts[0])];
          for (let i = 1; i < parts.length - 1; i++) {
            const part = parts[i];
            let linkEnd = -1;
            for (let j = 0; j < part.length; j++) {
              const c = part[j];
              if (" 窃东迎千我恋将野合集天翼网盘(（".includes(c)) {
                linkEnd = j;
                break;
              }
            }
            if (linkEnd > 0) {
              titles.push(cleanTitle(part.slice(linkEnd)));
            }
          }
          for (let i = 0; i < result.links.length; i++) {
            if (i < titles.length) {
              linkTitleMap.set(result.links[i].url, titles[i]);
            }
          }
        }
      }

      for (const link of result.links || []) {
        // 优先使用链接的work_title字段，如果为空则回退到传统方式
        let title = result.title;

        if (link.work_title) {
          title = link.work_title;
        } else {
          const specificTitle = linkTitleMap.get(link.url);
          if (specificTitle) {
            title = specificTitle;
          } else {
            // 尝试前缀匹配
            for (const [mappedLink, mappedTitle] of linkTitleMap) {
              if (mappedLink.startsWith(link.url)) {
                title = mappedTitle;
                break;
              }
            }
          }
        }

        // 检查插件是否需要跳过Service层过滤
        let skipKeywordFilter = false;
        if (result.unique_id && result.unique_id.includes("-")) {
          const parts = result.unique_id.split("-", 2);
          if (parts.length >= 1) {
            const pluginName = parts[0];
            const pluginInstance = this.pluginManager
              .getPlugins()
              .find((p) => p.name().toLowerCase() === pluginName.toLowerCase());
            if (pluginInstance) {
              skipKeywordFilter = pluginInstance.skipServiceFilter();
            }
          }
        }

        // 关键词过滤：检查每个链接的具体标题
        if (!skipKeywordFilter && keyword) {
          if (!title.toLowerCase().includes(lowerKeyword)) {
            // 如果链接具体标题不匹配，检查 result.title 是否匹配
            // 这种情况常见于 pansearch 等插件：result.title 是搜索关键词本身，
            // 但 linkTitleMap 从 content 中提取了第一个链接的具体标题（可能不包含关键词）
            if (result.title && result.title.toLowerCase().includes(lowerKeyword)) {
              title = result.title; // 回退到 result.title
            } else {
              continue;
            }
          }
        }

        // 裁剪标题
        title = cutTitleByKeywords(title, ["简介", "描述"]);

        // 确定数据来源
        let source = "unknown";
        if (result.channel) {
          source = "tg:" + result.channel;
        } else if (result.unique_id && result.unique_id.includes("-")) {
          const parts = result.unique_id.split("-", 2);
          if (parts.length >= 1) source = "plugin:" + parts[0];
        }

        // 优先使用链接自己的时间，如果没有则使用搜索结果的时间
        const linkDatetime = link.datetime || result.datetime;

        const mergedLink = {
          url: link.url,
          password: link.password,
          note: title,
          datetime: linkDatetime,
          source,
          images: result.images,
        };

        // 去重：使用规范化URL键进行去重，同一资源的不同URL变体只保留最新的一条
        const canonicalKey = getCanonicalUrlKey(link.url);
        const existingLink = uniqueLinks.get(canonicalKey);
        if (existingLink) {
          const existingTime = existingLink.datetime
            ? new Date(existingLink.datetime).getTime()
            : 0;
          const newTime = linkDatetime
            ? new Date(linkDatetime).getTime()
            : 0;
          if (newTime > existingTime) {
            uniqueLinks.set(canonicalKey, mergedLink);
          }
        } else {
          uniqueLinks.set(canonicalKey, mergedLink);
        }
      }
    }

    // 按原始results顺序收集唯一链接
    const orderedLinks: any[] = [];
    const linkTypeMap = new Map<string, string>();
    const addedUrls = new Set<string>();

    for (const result of results) {
      for (const link of result.links || []) {
        const canonicalKey = getCanonicalUrlKey(link.url);
        const mergedLink = uniqueLinks.get(canonicalKey);
        if (mergedLink && !addedUrls.has(canonicalKey)) {
          orderedLinks.push(mergedLink);
          linkTypeMap.set(canonicalKey, link.type);
          addedUrls.add(canonicalKey);
        }
      }
    }

    // 将有序链接按类型分组
    for (const mergedLink of orderedLinks) {
      // 使用 canonicalKey 查找类型，与 linkTypeMap.set(canonicalKey, ...) 保持一致
      const canonicalKey = getCanonicalUrlKey(mergedLink.url);
      let linkType = linkTypeMap.get(canonicalKey) || "unknown";
      // 如果通过 canonicalKey 找不到，再用原始 URL 和 getLinkType 兜底
      if (!linkType || linkType === "unknown") {
        const fallbackType = getLinkType(mergedLink.url);
        if (fallbackType && fallbackType !== "others") {
          linkType = fallbackType;
        }
      }
      linkType = linkType.toLowerCase();
      if (!mergedLinks[linkType]) mergedLinks[linkType] = [];
      mergedLinks[linkType].push(mergedLink);
    }

    // 如果指定了cloudTypes，则过滤结果
    if (cloudTypes && cloudTypes.length > 0) {
      const allowedTypes = new Set(
        cloudTypes.map((ct) => ct.toLowerCase().trim())
      );
      const filteredLinks: MergedLinks = {};
      for (const [linkType, links] of Object.entries(mergedLinks)) {
        if (allowedTypes.has(linkType.toLowerCase())) {
          filteredLinks[linkType] = links;
        }
      }
      return filteredLinks;
    }

    return mergedLinks;
  }

  private async runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    limit: number,
    signal?: AbortSignal
  ): Promise<T[]> {
    const limitFn = pLimit(limit);
    const limitedTasks = tasks.map((task) => limitFn(task));
    const results = await Promise.all(limitedTasks);
    return results;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache(namespace?: CacheNamespace) {
    if (namespace) {
      this.cache.clearNamespace(namespace);
    } else {
      this.cache.clearAll();
    }
  }

  getPluginHealthStatus() {
    return this.healthChecker.getAllStatus();
  }

  resetPluginHealth(pluginName?: string) {
    if (pluginName) {
      this.healthChecker.reset(pluginName);
    } else {
      this.healthChecker.resetAll();
    }
  }
}
