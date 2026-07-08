/**
 * 结构化日志系统
 * 支持不同级别的日志输出，便于调试和监控
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_COLORS = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bright: "\x1b[1m",
};

export interface LogOptions {
  level?: LogLevel;
  service?: string;
  enableColors?: boolean;
}

export interface LogMeta {
  [key: string]: any;
}

export class Logger {
  private level: LogLevel;
  private service: string;
  private enableColors: boolean;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: LogOptions = {}) {
    const rawLevel = options.level || process.env.LOG_LEVEL || "info";
    const validLevels: string[] = ["debug", "info", "warn", "error"];
    this.level = (validLevels.includes(rawLevel) ? rawLevel : "info") as LogLevel;
    this.service = options.service || "panseek";
    this.enableColors = options.enableColors ?? process.env.NODE_ENV !== "production";
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }

  private colorize(text: string, type: LogLevel | "dim" | "bright" | "reset" = "reset"): string {
    if (!this.enableColors) return text;
    const color = LOG_LEVEL_COLORS[type] || LOG_LEVEL_COLORS.reset;
    return `${color}${text}${LOG_LEVEL_COLORS.reset}`;
  }

  private formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();

    const parts: string[] = [];

    // 时间戳
    parts.push(this.colorize(`[${timestamp}]`, "dim"));

    // 级别
    parts.push(this.colorize(`[${level.toUpperCase()}]`, level));

    // 服务名
    parts.push(this.colorize(`[${this.service}]`, "bright"));

    // 消息
    parts.push(message);

    // 元数据
    if (meta && Object.keys(meta).length > 0) {
      parts.push(this.colorize(JSON.stringify(meta, null, 2), "dim"));
    }

    return parts.join(" ");
  }

  debug(message: string, meta?: LogMeta): void {
    if (!this.shouldLog("debug")) return;
    console.debug(this.formatMessage("debug", message, meta));
  }

  info(message: string, meta?: LogMeta): void {
    if (!this.shouldLog("info")) return;
    console.info(this.formatMessage("info", message, meta));
  }

  warn(message: string, meta?: LogMeta): void {
    if (!this.shouldLog("warn")) return;
    console.warn(this.formatMessage("warn", message, meta));
  }

  error(message: string, error?: Error | LogMeta): void {
    if (!this.shouldLog("error")) return;
    const meta =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : error;
    console.error(this.formatMessage("error", message, meta as LogMeta));
  }

  /**
   * 性能计时开始
   */
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const elapsed = Date.now() - start;
      this.debug(`${label} 完成`, { elapsedMs: elapsed });
    };
  }

  /**
   * 异步性能计时
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.startTimer(label);
    try {
      const result = await fn();
      endTimer();
      return result;
    } catch (error) {
      this.error(`${label} 失败`, error as Error);
      throw error;
    }
  }

  // 创建子 logger
  child(service: string): Logger {
    return new Logger({
      level: this.level,
      service: `${this.service}:${service}`,
      enableColors: this.enableColors,
    });
  }
}

// 默认导出实例
export const logger = new Logger({ service: "main" });

// 工厂函数
export function createLogger(service: string): Logger {
  return new Logger({ service });
}

// 模块专用日志器
export const loggers = {
  search: createLogger("Search"),
  cache: createLogger("Cache"),
  plugin: createLogger("Plugin"),
  tg: createLogger("TG"),
  api: createLogger("API"),
  hotSearch: createLogger("HotSearch"),
  health: createLogger("Health"),
};
