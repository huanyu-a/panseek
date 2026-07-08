/**
 * 网盘链接正则表达式和提取工具
 * 直接翻译自 pansou/util/regex_util.go
 * 所有正则模式和函数逻辑与 Go 版本完全一致
 */

// ============ 正则表达式定义 (对应 regex_util.go L10-L44) ============

// 通用网盘链接匹配正则表达式
export const AllPanLinksPattern =
  /(?:(?:magnet:\?xt=urn:btih:[a-zA-Z0-9]+)|(?:ed2k:\/\/\|file\|[^|]+\|\d+\|[A-Fa-f0-9]+\|\/?)|(?:https?:\/\/(?:(?:[\w.-]+\.)?(?:pan\.(?:baidu|quark)\.cn|(?:www\.)?(?:alipan|aliyundrive)\.com|drive\.uc\.cn|cloud\.189\.cn|(?:www\.)?(?:yun|caiyun)\.139\.com|caiyun\.feixin\.10086\.cn|(?:www\.)?123(?:684|685|865|912|pan|592)\.(?:com|cn)|115\.com|115cdn\.com|anxia\.com|pan\.xunlei\.com|mypikpak\.com|guangyapan\.com))(?:\/[^\s'"<>()]*)?))/gi;

// 百度网盘链接正则
export const BaiduPanPattern = /https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+(?:\?pwd=[a-zA-Z0-9]{4})?/g;

// 夸克网盘链接正则
export const QuarkPanPattern = /https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/g;

// 迅雷网盘链接正则
export const XunleiPanPattern = /https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9]+(?:\?pwd=[a-zA-Z0-9]{4})?(?:#)?/g;

// 天翼云盘链接正则
export const TianyiPanPattern = /https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+(?:%[0-9A-Fa-f]{2})*(?:（[^）]*）)?/g;

// UC网盘链接正则
export const UCPanPattern = /https?:\/\/drive\.uc\.cn\/s\/[a-zA-Z0-9]+(?:\?public=\d)?/g;

// 123网盘链接正则
export const Pan123Pattern = /https?:\/\/(?:www\.)?123(?:684|865|685|912|pan|592)\.(?:com|cn)\/s\/[a-zA-Z0-9_-]+(?:\?(?:%E6%8F%90%E5%8F%96%E7%A0%81|提取码)[:：][a-zA-Z0-9]+)?/g;

// 115网盘链接正则
export const Pan115Pattern = /https?:\/\/(?:115\.com|115cdn\.com|anxia\.com)\/s\/[a-zA-Z0-9]+(?:\?password=[a-zA-Z0-9]{4})?(?:#)?/g;

// 阿里云盘链接正则
export const AliyunPanPattern = /https?:\/\/(?:www\.)?(?:alipan|aliyundrive)\.com\/s\/[a-zA-Z0-9]+/g;

// 光鸭云盘链接正则
export const GuangyaPanPattern = /https?:\/\/(?:www\.)?guangyapan\.com\/s\/[a-zA-Z0-9_-]+/g;

// 移动云盘链接正则
export const MobilePanPattern = /https?:\/\/(?:(?:www\.)?yun\.139\.com\/shareweb\/#\/w\/i\/[a-zA-Z0-9]+|(?:www\.)?caiyun\.139\.com\/(?:w\/i\/[a-zA-Z0-9]+|m\/i\?[a-zA-Z0-9]+)[^\s<>"']*|caiyun\.feixin\.10086\.cn\/[a-zA-Z0-9]+)/g;

// 提取码匹配正则
export const PasswordPattern = /(?:(?:提取|访问|提取密|密)码|pwd)[：:]\s*([a-zA-Z0-9]{4})(?:[^a-zA-Z0-9]|$)/i;

// URL密码参数正则
export const UrlPasswordPattern = /[?&]pwd=([a-zA-Z0-9]{4})(?:[^a-zA-Z0-9]|$)/i;

// 百度网盘密码专用正则
export const BaiduPasswordPattern = /(?:链接：.*?提取码：|密码：|提取码：|pwd=|pwd:|pwd：)([a-zA-Z0-9]{4})(?:[^a-zA-Z0-9]|$)/i;

// ============ 工具函数 ============

function newRegExp(pattern: RegExp): RegExp {
  // 创建不带 g 标志的副本用于 test/match
  return new RegExp(pattern.source, pattern.flags.replace(/g/, ""));
}

/**
 * 获取链接类型
 * 直接翻译自 pansou/util/regex_util.go GetLinkType()
 */
export function getLinkType(url: string): string {
  let u = url.toLowerCase();

  // 处理可能带有"链接："前缀的情况
  if (u.includes("链接：") || u.includes("链接:")) {
    const idx = u.indexOf("链接");
    u = u.slice(idx);
    if (u.startsWith("：") || u.startsWith(":")) {
      u = u.slice(1);
    }
    u = u.trim();
  }

  if (u.includes("ed2k:")) return "ed2k";
  if (u.startsWith("magnet:")) return "magnet";
  if (u.includes("pan.baidu.com")) return "baidu";
  if (u.includes("pan.quark.cn")) return "quark";
  if (u.includes("alipan.com") || u.includes("aliyundrive.com")) return "aliyun";
  if (u.includes("guangyapan.com")) return "guangya";
  if (u.includes("cloud.189.cn")) return "tianyi";
  if (u.includes("drive.uc.cn")) return "uc";
  if (u.includes("caiyun.139.com") || u.includes("yun.139.com") || u.includes("caiyun.feixin.10086.cn")) return "mobile";
  if (u.includes("115.com") || u.includes("115cdn.com") || u.includes("anxia.com")) return "115";
  if (u.includes("mypikpak.com")) return "pikpak";
  if (u.includes("pan.xunlei.com")) return "xunlei";

  // 123网盘有多个域名
  const domains123 = ["123684.com", "123685.com", "123865.com", "123912.com", "123pan.com", "123pan.cn", "123592.com"];
  if (domains123.some((d) => u.includes(d))) return "123";

  return "others";
}

/**
 * 检查提取码是否有效（只包含字母和数字）
 * 直接翻译自 pansou/util/regex_util.go isValidPassword()
 */
export function isValidPassword(password: string): boolean {
  for (const c of password) {
    if (!((c >= "0" && c <= "9") || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"))) {
      return false;
    }
  }
  return true;
}

/**
 * 清理百度网盘URL
 * 直接翻译自 pansou/util/regex_util.go CleanBaiduPanURL()
 */
export function cleanBaiduPanURL(url: string): string {
  if (url.includes("https://pan.baidu.com/s/")) {
    const startIdx = url.indexOf("https://pan.baidu.com/s/");
    if (startIdx >= 0) {
      url = url.slice(startIdx);
      const endMarkers = [" ", "\n", "\t", "，", "。", "；", ";", ",", "?pwd="];
      let minEndIdx = url.length;
      for (const marker of endMarkers) {
        const idx = url.indexOf(marker);
        if (idx > 0 && idx < minEndIdx) minEndIdx = idx;
      }
      if (minEndIdx < url.length) url = url.slice(0, minEndIdx);

      if (url.includes("?pwd=")) {
        const pwdIdx = url.indexOf("?pwd=");
        if (pwdIdx >= 0 && url.length > pwdIdx + 5) {
          const pwdEndIdx = pwdIdx + 9; // ?pwd=xxxx 总共9个字符
          if (pwdEndIdx <= url.length) return url.slice(0, pwdEndIdx);
          return url;
        }
      }
    }
  }
  return url;
}

/**
 * 清理天翼云盘URL
 * 直接翻译自 pansou/util/regex_util.go CleanTianyiPanURL()
 */
export function cleanTianyiPanURL(url: string): string {
  if (url.includes("https://cloud.189.cn/t/")) {
    const startIdx = url.indexOf("https://cloud.189.cn/t/");
    if (startIdx >= 0) {
      url = url.slice(startIdx);
      const endMarkers = [" ", "\n", "\t", "，", "。", "；", ";", ",", "实时", "天翼", "更多"];
      let minEndIdx = url.length;
      for (const marker of endMarkers) {
        const idx = url.indexOf(marker);
        if (idx > 0 && idx < minEndIdx) minEndIdx = idx;
      }
      if (minEndIdx < url.length) url = url.slice(0, minEndIdx);

      // 标准化URL：将URL编码转换为中文
      try {
        url = decodeURIComponent(url);
      } catch {}
    }
  }
  return url;
}

/**
 * 清理UC网盘URL
 * 直接翻译自 pansou/util/regex_util.go CleanUCPanURL()
 */
export function cleanUCPanURL(url: string): string {
  if (url.includes("https://drive.uc.cn/s/")) {
    const startIdx = url.indexOf("https://drive.uc.cn/s/");
    if (startIdx >= 0) {
      url = url.slice(startIdx);
      const endMarkers = [" ", "\n", "\t", "，", "。", "；", ";", ",", "网盘", "123", "夸克", "阿里", "百度"];
      let minEndIdx = url.length;
      for (const marker of endMarkers) {
        const idx = url.indexOf(marker);
        if (idx > 0 && idx < minEndIdx) minEndIdx = idx;
      }
      if (minEndIdx < url.length) return url.slice(0, minEndIdx);

      if (url.includes("?public=")) {
        const publicIdx = url.indexOf("?public=");
        if (publicIdx > 0) {
          if (publicIdx + 9 <= url.length) return url.slice(0, publicIdx + 9);
          return url.slice(0, publicIdx + 8);
        }
      }
    }
  }
  return url;
}

/**
 * 清理123网盘URL
 * 直接翻译自 pansou/util/regex_util.go Clean123PanURL()
 */
export function clean123PanURL(url: string): string {
  const domains = ["123684.com", "123685.com", "123865.com", "123912.com", "123pan.com", "123pan.cn", "123592.com"];
  let isDomain123 = false;
  for (const domain of domains) {
    if (url.includes(domain + "/s/")) {
      isDomain123 = true;
      break;
    }
  }

  if (isDomain123) {
    const hasProtocol = url.startsWith("http://") || url.startsWith("https://");
    let startIdx = -1;
    for (const domain of domains) {
      const idx = url.indexOf(domain + "/s/");
      if (idx >= 0) {
        startIdx = idx;
        break;
      }
    }

    if (startIdx >= 0) {
      if (!hasProtocol) {
        const linkPart = url.slice(startIdx);
        url = "https://" + linkPart;
      } else if (startIdx > 0) {
        const protocolIdx = url.indexOf("://");
        if (protocolIdx >= 0) {
          const protocol = url.slice(0, protocolIdx + 3);
          url = protocol + url.slice(startIdx);
        }
      }

      const endMarkers = [
        " ", "\n", "\t", "，", "。", "；", ";", ",",
        "📁", "🔍", "标签", "🏷", "📎", "🔗", "📌", "📋", "📂", "🗂️", "🔖",
        "📚", "📒", "📔", "📕", "📓", "📗", "📘", "📙", "📄", "📃", "📑",
        "🧾", "📊", "📈", "📉", "🗒️", "🗓️", "📆", "📅", "🗑️",
        "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️",
      ];
      let minEndIdx = url.length;
      for (const marker of endMarkers) {
        const idx = url.indexOf(marker);
        if (idx > 0 && idx < minEndIdx) minEndIdx = idx;
      }
      if (minEndIdx < url.length) return url.slice(0, minEndIdx);

      if (url.includes("%E6%8F%90%E5%8F%96%E7%A0%81")) {
        url = url.replace("%E6%8F%90%E5%8F%96%E7%A0%81", "提取码");
      }
    }
  }
  return url;
}

/**
 * 清理115网盘URL
 * 直接翻译自 pansou/util/regex_util.go Clean115PanURL()
 */
export function clean115PanURL(url: string): string {
  if (url.includes("115.com/s/") || url.includes("115cdn.com/s/") || url.includes("anxia.com/s/")) {
    let startIdx = -1;
    const idx1 = url.indexOf("115.com/s/");
    const idx2 = url.indexOf("115cdn.com/s/");
    const idx3 = url.indexOf("anxia.com/s/");
    if (idx1 >= 0) startIdx = idx1;
    else if (idx2 >= 0) startIdx = idx2;
    else if (idx3 >= 0) startIdx = idx3;

    if (startIdx >= 0) {
      const hasProtocol = url.startsWith("http://") || url.startsWith("https://");
      if (!hasProtocol) {
        url = "https://" + url.slice(startIdx);
      } else if (startIdx > 0) {
        const protocolIdx = url.indexOf("://");
        if (protocolIdx >= 0) {
          const protocol = url.slice(0, protocolIdx + 3);
          url = protocol + url.slice(startIdx);
        }
      }

      if (url.includes("?password=")) {
        const pwdIdx = url.indexOf("?password=");
        if (pwdIdx > 0 && pwdIdx + 14 <= url.length) {
          return url.slice(0, pwdIdx + 14);
        }
      }

      const hashIdx = url.indexOf("#");
      if (hashIdx > 0) return url.slice(0, hashIdx);
    }
  }
  return url;
}

/**
 * 清理阿里云盘URL
 * 直接翻译自 pansou/util/regex_util.go CleanAliyunPanURL()
 */
export function cleanAliyunPanURL(url: string): string {
  if (url.includes("alipan.com/s/") || url.includes("aliyundrive.com/s/")) {
    let startIdx = -1;
    const candidates = ["www.alipan.com/s/", "alipan.com/s/", "www.aliyundrive.com/s/", "aliyundrive.com/s/"];
    for (const c of candidates) {
      const idx = url.indexOf(c);
      if (idx >= 0) {
        startIdx = idx;
        break;
      }
    }

    if (startIdx >= 0) {
      const hasProtocol = url.startsWith("http://") || url.startsWith("https://");
      if (!hasProtocol) {
        url = "https://" + url.slice(startIdx);
      } else if (startIdx > 0) {
        const protocolIdx = url.indexOf("://");
        if (protocolIdx >= 0) {
          const protocol = url.slice(0, protocolIdx + 3);
          url = protocol + url.slice(startIdx);
        }
      }

      const endMarkers = [
        " ", "\n", "\t", "，", "。", "；", ";", ",",
        "📁", "🔍", "标签", "🏷", "📎", "🔗", "📌", "📋", "📂", "🗂️", "🔖",
        "📚", "📒", "📔", "📕", "📓", "📗", "📘", "📙", "📄", "📃", "📑",
        "🧾", "📊", "📈", "📉", "🗒️", "🗓️", "📆", "📅", "🗑️",
        "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️",
      ];
      let minEndIdx = url.length;
      for (const marker of endMarkers) {
        const idx = url.indexOf(marker);
        if (idx > 0 && idx < minEndIdx) minEndIdx = idx;
      }
      if (minEndIdx < url.length) return url.slice(0, minEndIdx);
    }
  }
  return url;
}

/**
 * 清理移动云盘URL
 * 直接翻译自 pansou/util/regex_util.go CleanMobilePanURL()
 */
export function cleanMobilePanURL(url: string): string {
  const patterns = [
    "https://yun.139.com/shareweb/#/w/i/",
    "http://yun.139.com/shareweb/#/w/i/",
    "https://www.yun.139.com/shareweb/#/w/i/",
    "http://www.yun.139.com/shareweb/#/w/i/",
    "https://caiyun.139.com/w/i/",
    "http://caiyun.139.com/w/i/",
    "https://www.caiyun.139.com/w/i/",
    "http://www.caiyun.139.com/w/i/",
    "https://caiyun.139.com/m/i?",
    "http://caiyun.139.com/m/i?",
    "https://www.caiyun.139.com/m/i?",
    "http://www.caiyun.139.com/m/i?",
    "https://caiyun.feixin.10086.cn/",
    "http://caiyun.feixin.10086.cn/",
  ];

  let startIdx = -1;
  for (const prefix of patterns) {
    const idx = url.indexOf(prefix);
    if (idx >= 0) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx < 0) return url;

  url = url.slice(startIdx);

  const endMarkers = [" ", "\n", "\t", "，", "。", "；", ";", ",", "访问码", "提取码", "密码", "链接", "网盘"];
  let minEndIdx = url.length;
  for (const marker of endMarkers) {
    const idx = url.indexOf(marker);
    if (idx > 0 && idx < minEndIdx) minEndIdx = idx;
  }
  if (minEndIdx < url.length) url = url.slice(0, minEndIdx);

  return url.trim();
}

/**
 * 标准化URL用于比较
 * 直接翻译自 pansou/util/regex_util.go normalizeURLForComparison()
 */
export function normalizeURLForComparison(url: string): string {
  const idx = url.indexOf("://");
  if (idx >= 0) url = url.slice(idx + 3);
  if (url.includes("%E6%8F%90%E5%8F%96%E7%A0%81")) {
    url = url.replace("%E6%8F%90%E5%8F%96%E7%A0%81", "提取码");
  }
  return url;
}

/**
 * 从URL和内容中提取密码
 * 直接翻译自 pansou/util/regex_util.go ExtractPassword()
 */
export function extractPassword(content: string, url: string): string {
  // 特殊处理天翼云盘URL中的访问码
  if (url.includes("cloud.189.cn")) {
    const tianyiPasswordPattern = /(?:（访问码：|%EF%BC%88%E8%AE%BF%E9%97%AE%E7%A0%81%EF%BC%9A)([a-zA-Z0-9]+)(?:）|%EF%BC%89)/;
    const tianyiMatches = tianyiPasswordPattern.exec(url);
    if (tianyiMatches && tianyiMatches.length > 1) return tianyiMatches[1];
  }

  // 特殊处理迅雷网盘URL中的pwd参数
  if (url.includes("pan.xunlei.com") && url.includes("?pwd=")) {
    const pwdMatches = /\?pwd=([a-zA-Z0-9]{4})/.exec(url);
    if (pwdMatches && pwdMatches.length > 1) return pwdMatches[1];
  }

  // 先从URL中提取密码
  const urlMatches = UrlPasswordPattern.exec(url);
  if (urlMatches && urlMatches.length > 1) return urlMatches[1];

  // 特殊处理115网盘URL中的密码
  if ((url.includes("115.com") || url.includes("115cdn.com") || url.includes("anxia.com")) && url.includes("password=")) {
    const passwordMatches = /password=([a-zA-Z0-9]{4})/.exec(url);
    if (passwordMatches && passwordMatches.length > 1) return passwordMatches[1];
  }

  // 特殊处理123网盘URL中的提取码
  const domains123 = ["123684.com", "123685.com", "123865.com", "123912.com", "123pan.com", "123pan.cn", "123592.com"];
  const is123 = domains123.some((d) => url.includes(d));
  if (is123 && (url.includes("提取码") || url.includes("%E6%8F%90%E5%8F%96%E7%A0%81"))) {
    const extractCodePattern = /(?:提取码|%E6%8F%90%E5%8F%96%E7%A0%81)[:：]([a-zA-Z0-9]+)/;
    const codeMatches = extractCodePattern.exec(url);
    if (codeMatches && codeMatches.length > 1) return codeMatches[1];
  }

  // 检查123网盘URL中的提取码参数
  if (is123 && url.includes("提取码")) {
    const parts = url.split("提取码");
    if (parts.length > 1) {
      const codeStart = parts[1].search(/[:：]/);
      if (codeStart >= 0 && codeStart + 1 < parts[1].length) {
        let code = parts[1].slice(codeStart + 1).trim();
        const endChars = " \t\n\r，。；;,🏷📁🔍📎🔗📌📋📂🗂️🔖📚📒📔📕📓📗📘📙📄📃📑🧾📊📈📉🗒️🗓️📆📅🗑️🔒🔓🔏🔐🔑🗝️";
        let endIdx = -1;
        for (let i = 0; i < code.length; i++) {
          if (endChars.includes(code[i])) {
            endIdx = i;
            break;
          }
        }
        if (endIdx > 0) code = code.slice(0, endIdx);
        code = code.trim();
        if (code.length > 0 && code.length <= 6 && isValidPassword(code)) return code;
      }
    }
  }

  // 检查内容中是否包含"提取码"字样
  if (content.includes("提取码")) {
    const parts = content.split("提取码");
    for (const part of parts) {
      if (part.length > 0) {
        const codeStart = part.search(/[:：]/);
        if (codeStart >= 0 && codeStart + 1 < part.length) {
          let code = part.slice(codeStart + 1).trim();
          const endChars = " \t\n\r，。；;,🏷📁🔍📎🔗📌📋📂🗂️🔖📚📒📔📕📓📗📘📙📄📃📑🧾📊📈📉🗒️🗓️📆📅🗑️🔒🔓🔏🔐🔑🗝️";
          let endIdx = -1;
          for (let i = 0; i < code.length; i++) {
            if (endChars.includes(code[i])) {
              endIdx = i;
              break;
            }
          }
          if (endIdx > 0) {
            code = code.slice(0, endIdx);
          } else {
            if (code.length > 6) {
              for (let i = 4; i <= 6 && i <= code.length; i++) {
                if (isValidPassword(code.slice(0, i))) {
                  code = code.slice(0, i);
                  break;
                }
              }
              if (code.length > 6) code = code.slice(0, 4);
            }
          }
          code = code.trim();
          if (code !== "" && isValidPassword(code)) return code;
        }
      }
    }
  }

  // 百度网盘特定密码提取
  if (url.toLowerCase().includes("pan.baidu.com")) {
    const baiduMatches = BaiduPasswordPattern.exec(content);
    if (baiduMatches && baiduMatches.length > 1) return baiduMatches[1];
  }

  // 通用密码提取
  const matches = PasswordPattern.exec(content);
  if (matches && matches.length > 1) return matches[1];

  return "";
}

/**
 * 从文本中提取所有网盘链接
 * 直接翻译自 pansou/util/regex_util.go ExtractNetDiskLinks()
 */
export function extractNetDiskLinks(text: string): string[] {
  const links: string[] = [];

  const addLink = (url: string, cleanFn?: (u: string) => string) => {
    let cleanURL = cleanFn ? cleanFn(url) : url;
    if (cleanURL.endsWith("https")) cleanURL = cleanURL.slice(0, -5);
    if (cleanURL !== "") {
      const normalizedNew = normalizeURLForComparison(cleanURL);
      const isDuplicate = links.some(
        (existing) => normalizeURLForComparison(existing) === normalizedNew
      );
      if (!isDuplicate) links.push(cleanURL);
    }
  };

  // 提取百度网盘链接
  const baiduMatches = text.match(newRegExp(BaiduPanPattern));
  if (baiduMatches) for (const m of baiduMatches) addLink(m, cleanBaiduPanURL);

  // 提取天翼云盘链接
  const tianyiMatches = text.match(newRegExp(TianyiPanPattern));
  if (tianyiMatches) for (const m of tianyiMatches) addLink(m, cleanTianyiPanURL);

  // 提取UC网盘链接
  const ucMatches = text.match(newRegExp(UCPanPattern));
  if (ucMatches) for (const m of ucMatches) addLink(m, cleanUCPanURL);

  // 提取123网盘链接
  const pan123Matches = text.match(newRegExp(Pan123Pattern));
  if (pan123Matches) for (const m of pan123Matches) addLink(m, clean123PanURL);

  // 提取115网盘链接
  const pan115Matches = text.match(newRegExp(Pan115Pattern));
  if (pan115Matches) for (const m of pan115Matches) addLink(m, clean115PanURL);

  // 提取阿里云盘链接
  const aliyunMatches = text.match(newRegExp(AliyunPanPattern));
  if (aliyunMatches) for (const m of aliyunMatches) addLink(m, cleanAliyunPanURL);

  // 提取光鸭云盘链接
  const guangyaMatches = text.match(newRegExp(GuangyaPanPattern));
  if (guangyaMatches) for (const m of guangyaMatches) addLink(m);

  // 提取移动云盘链接
  const mobileMatches = text.match(newRegExp(MobilePanPattern));
  if (mobileMatches) for (const m of mobileMatches) addLink(m, cleanMobilePanURL);

  // 提取夸克网盘链接
  const quarkLinks = text.match(newRegExp(QuarkPanPattern));
  if (quarkLinks) {
    for (const match of quarkLinks) {
      let cleanURL = match;
      if (cleanURL.endsWith("https")) cleanURL = cleanURL.slice(0, -5);
      const isDuplicate = links.some(
        (existing) => existing.includes(cleanURL) || cleanURL.includes(existing)
      );
      if (!isDuplicate) links.push(cleanURL);
    }
  }

  // 提取迅雷网盘链接
  const xunleiLinks = text.match(newRegExp(XunleiPanPattern));
  if (xunleiLinks) {
    for (const match of xunleiLinks) {
      let cleanURL = match;
      if (cleanURL.endsWith("https")) cleanURL = cleanURL.slice(0, -5);
      const isDuplicate = links.some(
        (existing) => existing.includes(cleanURL) || cleanURL.includes(existing)
      );
      if (!isDuplicate) links.push(cleanURL);
    }
  }

  // 使用通用模式提取其他可能的链接
  const otherLinks = text.match(newRegExp(AllPanLinksPattern));
  if (otherLinks) {
    for (const link of otherLinks) {
      let cleanURL = link;
      if (cleanURL.endsWith("https")) cleanURL = cleanURL.slice(0, -5);

      // 跳过已经单独处理过的链接
      const skipDomains = [
        "pan.baidu.com", "pan.quark.cn", "pan.xunlei.com", "guangyapan.com",
        "cloud.189.cn", "drive.uc.cn", "yun.139.com", "caiyun.139.com",
        "caiyun.feixin.10086.cn", "123684.com", "123685.com", "123865.com",
        "123912.com", "123pan.com", "123pan.cn", "123592.com",
        "115.com", "115cdn.com", "anxia.com", "mypikpak.com",
      ];
      if (skipDomains.some((d) => cleanURL.includes(d))) continue;

      const isDuplicate = links.some((existing) => {
        const normalizedExisting = normalizeURLForComparison(existing);
        const normalizedNew = normalizeURLForComparison(cleanURL);
        return (
          normalizedExisting === normalizedNew ||
          normalizedExisting.includes(normalizedNew) ||
          normalizedNew.includes(normalizedExisting)
        );
      });
      if (!isDuplicate) links.push(cleanURL);
    }
  }

  return links;
}

/**
 * 检查链接是否为支持的网盘链接
 * 直接翻译自 pansou/util/parser_util.go isSupportedLink()
 */
export function isSupportedLink(url: string): boolean {
  const lowerURL = url.toLowerCase();
  if (newRegExp(BaiduPanPattern).test(lowerURL)) return true;
  if (newRegExp(TianyiPanPattern).test(lowerURL)) return true;
  if (newRegExp(UCPanPattern).test(lowerURL)) return true;
  if (newRegExp(Pan123Pattern).test(lowerURL)) return true;
  if (newRegExp(GuangyaPanPattern).test(lowerURL)) return true;
  if (newRegExp(QuarkPanPattern).test(lowerURL)) return true;
  if (newRegExp(XunleiPanPattern).test(lowerURL)) return true;
  if (newRegExp(Pan115Pattern).test(lowerURL)) return true;
  if (newRegExp(MobilePanPattern).test(lowerURL)) return true;
  return newRegExp(AllPanLinksPattern).test(lowerURL);
}

/**
 * 根据关键词裁剪标题，保留最前关键词前的部分
 * 直接翻译自 pansou/util/parser_util.go CutTitleByKeywords()
 */
export function cutTitleByKeywords(title: string, keywords: string[]): string {
  let minIdx = -1;
  for (const kw of keywords) {
    const idx = title.indexOf(kw);
    if (idx >= 0 && (minIdx === -1 || idx < minIdx)) minIdx = idx;
  }
  if (minIdx > 0) return title.slice(0, minIdx).trim();
  return title.trim();
}
