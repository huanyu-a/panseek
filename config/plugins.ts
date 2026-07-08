// 插件名称常量
// 警告：此名单同时用于 Web 前端（设置面板勾选）、后端（默认启用列表）、小程序（默认启用列表）
// 修改时请同时检查：
//   - server/core/services/index.ts 中的插件注册
//   - server/core/plugins/ 下的插件实现
//   - server/core/plugins/registerAllPlugins.ts 中的插件注册
//
// 已注释（端点死亡）：ahhhhfs, cldi, clmao, cyg, daishudj, ddys, erxiao, feikuai,
//   fox4k, hdmoli, hdr4k, jikepan, muou, panta, qiwei, qingying, qupanshe,
//   qupansou, sdso, shandian, torrentgalaxy, xinjuc, xuexizhinan, ypfxw, zhizhen
export const ALL_PLUGIN_NAMES = [
  // 高优先级插件（priority 1-2）— 快速、高质量
  "pansearch",
  "nyaa",
  "susu",
  "wanou",
  "labi",
  "lou1",
  "panyq",
  "ouge",
  "huban",
  "yunsou",
  "alupan",
  "discourse",
  "duoduo",
  "nsgame",
  "jsnoteclub",
  "kkmao",
  "mikuclub",
  "pioz",
  "panzun",
  "quarktv",
  "dyyjpro",
  "clxiong",
  // 标准优先级插件（priority 3）
  "pan666",
  "thepiratebay",
  "hunhepan",
  "xiaozhang",
  "aikanzy",
  "ash",
  "bixin",
  "djgou",
  "duanjuw",
  "dyyj",
  "gaoqing888",
  "gying",
  "haisou",
  "javdb",
  "jupansou",
  "jutoushe",
  "kkv",
  "leijing",
  "libvio",
  "lingjisp",
  "meitizy",
  "melost",
  "miaoso",
  "mizixing",
  "panlian",
  "panwiki",
  "pianku",
  "qqpd",
  "quark4k",
  "quarksoo",
  "sousou",
  "weibo",
  "wuji",
  "xb6v",
  "xdpan",
  "xdyh",
  "xiaoji",
  "xys",
  "yiove",
  "yuhuage",
  "yulinshufa",
  "yunso",
  "zxzj",
  // 低优先级插件（priority 4-5）
  "1337x",
  "solidtorrents",
  "u3c3",
] as const;

// 设置版本号 — 当 ALL_PLUGIN_NAMES 变化时递增，用于自动迁移老用户的 localStorage
export const SETTINGS_VERSION = 3;

// 网盘类型列表（对照 pansou 13 种网盘类型）
export const CLOUD_TYPES = [
  "baidu",
  "aliyun",
  "quark",
  "uc",
  "tianyi",
  "115",
  "xunlei",
  "mobile",
  "pikpak",
  "123",
  "guangya",
  "magnet",
  "ed2k",
] as const;

// 平台信息配置 — icon 为官方 favicon 图片路径
export const PLATFORM_INFO: Record<
  string,
  { name: string; color: string; icon: string }
> = {
  baidu: { name: "百度网盘", color: "#2563eb", icon: "/icons/baidu.png" },
  aliyun: { name: "阿里云盘", color: "#7c3aed", icon: "/icons/aliyun.png" },
  quark: { name: "夸克网盘", color: "#6366f1", icon: "/icons/quark.png" },
  uc: { name: "UC网盘", color: "#ef4444", icon: "/icons/uc.png" },
  tianyi: { name: "天翼云盘", color: "#ec4899", icon: "/icons/tianyi.png" },
  "115": { name: "115网盘", color: "#f59e0b", icon: "/icons/115.png" },
  xunlei: { name: "迅雷云盘", color: "#fbbf24", icon: "/icons/xunlei.png" },
  mobile: { name: "移动云盘", color: "#0ea5e9", icon: "/icons/mobile.png" },
  pikpak: { name: "PikPak", color: "#8b5cf6", icon: "/icons/pikpak.png" },
  "123": { name: "123网盘", color: "#10b981", icon: "/icons/123.png" },
  guangya: { name: "光鸭云盘", color: "#14b8a6", icon: "/icons/guangya.png" },
  magnet: { name: "磁力链接", color: "#f97316", icon: "/icons/magnet.png" },
  ed2k: { name: "电驴链接", color: "#a855f7", icon: "/icons/ed2k.png" },
  others: { name: "其他", color: "#6b7280", icon: "/icons/others.png" },
};

// 默认用户设置
export const DEFAULT_USER_SETTINGS = {
  enabledPlugins: [...ALL_PLUGIN_NAMES],
  enabledCloudTypes: [...CLOUD_TYPES],
  concurrency: 4,
  pluginTimeoutMs: 5000,
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
  settings: "panseek.settings",
  searchMode: "searchMode",
  settingsVersion: "panseek.settingsVersion",
} as const;
