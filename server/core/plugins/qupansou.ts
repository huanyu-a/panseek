import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import { ofetch } from "ofetch";

const API_URL = "https://v.funletu.com/search";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

interface QuPanSouItem {
  id: number;
  title: string;
  filename: string;
  url: string;
  link: string;
  searchtext: string;
  extcode: string;
  unzipcode: string;
  size: string;
  categoryid: number;
  category: string;
  courseid: number;
  course: string;
  filetype: string;
  updatetime: string;
  createtime: string;
  views: number;
  state: number;
  sort: number;
  top: number;
  valid: number;
}

interface QuPanSouResponse {
  text: string;
  data: QuPanSouItem[];
  total: number;
  status: number;
  message: string;
}

function determineLinkType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("pan.baidu.com")) return "baidu";
  if (u.includes("aliyundrive.com") || u.includes("alipan.com")) return "aliyun";
  if (u.includes("pan.quark.cn")) return "quark";
  if (u.includes("cloud.189.cn")) return "tianyi";
  if (u.includes("pan.xunlei.com")) return "xunlei";
  if (u.includes("caiyun.139.com") || u.includes("www.caiyun.139.com")) return "mobile";
  if (u.includes("115.com")) return "115";
  if (u.includes("drive.uc.cn")) return "uc";
  if (u.includes("123pan.com") || u.includes("123912.com") || u.includes("123684.com") || u.includes("123865.com")) return "123";
  if (u.includes("mypikpak.com")) return "pikpak";
  if (u.includes("lanzou") || u.includes("lanzo")) return "lanzou";
  return "others";
}

function cleanHTMLTags(html: string): string {
  return html
    .replace(/<\/?(em|b|strong|i)>/gi, "")
    .trim();
}

export class QupansouPlugin extends BaseAsyncPlugin {
  constructor() {
    super("qupansou", 3);
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

    try {
      const reqBody = {
        style: "get",
        datasrc: "search",
        query: {
          id: "",
          datetime: "",
          courseid: 1,
          categoryid: "",
          filetypeid: "",
          filetype: "",
          reportid: "",
          validid: "",
          searchtext: keyword,
        },
        page: {
          pageSize: 1000,
          pageIndex: 1,
        },
        order: {
          prop: "sort",
          order: "desc",
        },
        message: "请求资源列表数据",
      };

      const resp = await ofetch<QuPanSouResponse>(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": UA,
          Referer: "https://pan.funletu.com/",
        },
        body: reqBody,
        timeout,
        retry: 1,
        signal,
      }).catch(() => null);

      if (!resp || resp.status !== 200 || !Array.isArray(resp.data)) {
        return [];
      }

      const results: SearchResult[] = [];
      for (const item of resp.data) {
        if (!item.url) continue;

        const linkType = determineLinkType(item.url);
        const title = cleanHTMLTags(item.title || item.filename || "");
        if (!title) continue;

        // Parse datetime
        let datetime = new Date().toISOString();
        if (item.updatetime) {
          const parsed = new Date(item.updatetime.replace(/-/g, "/"));
          if (!isNaN(parsed.getTime())) {
            datetime = parsed.toISOString();
          }
        }

        results.push({
          message_id: "",
          unique_id: `qupansou-${item.id}`,
          channel: "",
          datetime,
          title,
          content: `类别: ${item.category}, 文件类型: ${item.filetype}, 大小: ${item.size}`,
          links: [{ type: linkType, url: item.url, password: item.extcode || "" }],
        });
      }

      return results;
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new QupansouPlugin());
