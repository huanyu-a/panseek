export interface Link {
  type: string;
  url: string;
  password: string;
  work_title?: string; // 对应 pansou model.Link.WorkTitle
  datetime?: string; // 对应 pansou model.Link.Datetime (ISO string)
}

export interface SearchResult {
  message_id: string;
  unique_id: string;
  channel: string;
  datetime: string; // ISO string
  title: string;
  content: string;
  links: Link[];
  tags?: string[];
  images?: string[];
}

export interface MergedLink {
  url: string;
  password: string;
  note: string;
  datetime: string; // ISO string
  source?: string; // e.g. "tg:channel" or "plugin:name"
  images?: string[];
}

export type MergedLinks = Record<string, MergedLink[]>;

export interface SearchResponse {
  total: number;
  results?: SearchResult[];
  merged_by_type?: MergedLinks;
}

export interface GenericResponse<T> {
  code: number;
  message: string;
  data?: T;
}

/** 过滤配置，直接翻译自 pansou/model/request.go FilterConfig */
export interface FilterConfig {
  include?: string[]; // 包含关键词列表（OR关系）
  exclude?: string[]; // 排除关键词列表（AND关系）
}

export interface SearchRequest {
  kw: string;
  channels?: string[];
  conc?: number;
  refresh?: boolean;
  res?: "all" | "results" | "merge" | "merged_by_type";
  src?: "all" | "tg" | "plugin";
  plugins?: string[];
  ext?: Record<string, any>;
  cloud_types?: string[];
  filter?: FilterConfig; // 过滤配置，用于过滤返回结果
}
