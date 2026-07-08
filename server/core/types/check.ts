/**
 * 链接有效性检测数据模型
 * 直接翻译自 pansou/model/check.go
 */

export interface CheckItem {
  disk_type: string;
  url: string;
  password?: string;
}

export interface CheckRequest {
  items: CheckItem[];
  view_token?: string;
  proxy?: string;
  proxy_url?: string;
}

export interface CheckResult {
  disk_type: string;
  url: string;
  normalized_url?: string;
  state: string; // "ok" | "bad" | "locked" | "unsupported" | "uncertain"
  cache_hit: boolean;
  checked_at: number; // UnixMilli
  expires_at: number; // UnixMilli
  summary?: string;
}

export interface CheckResponse {
  results: CheckResult[];
}
