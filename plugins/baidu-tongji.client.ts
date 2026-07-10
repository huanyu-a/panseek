/**
 * 百度统计客户端插件（分防爬层防护）
 *
 * 防护策略：
 *   1.  ID 走环境变量 NUXT_PUBLIC_BAIDU_TONGJI_ID，不进源码仓库
 *   2.  运行时动态拼接脚本 URL，源码中不出现 "hm.js?<FULL_ID>" 字面量
 *   3.  域名白名单校验，仅 panseek.bx9y.com.cn 触发，复制到别的域名不会统计
 *   4.  空闲期（requestIdleCallback）延迟注入，无头爬虫不等空闲回调就拿不到
 *
 * 注意：客户端统计 ID 必须到达浏览器，构建产物中仍含本域名的 ID，
 *       防的是源码泄露 / 整页复制 / 简单爬虫，不能对抗 DevTools 抓包。
 *       百度统计后台也注册了域名白名单，双重兜底。
 */

const ALLOWED_HOSTS = ["panseek.bx9y.com.cn"];
const MAX_IDLE_WAIT_MS = 3000;

export default defineNuxtPlugin(() => {
  // 服务端不执行
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // --- 第 3 层：域名白名单 ---
  const host = window.location.hostname;
  if (!ALLOWED_HOSTS.includes(host)) return;

  // --- 第 1 层：ID 来自环境变量（build 时内联） ---
  const config = useRuntimeConfig();
  const id = (config.public as any)?.baiduTongjiId as string | undefined;
  if (!id) return;

  // --- 第 4 层：空闲期延迟注入 ---
  const inject = () => injectBaiduTongji(id);
  if ("requestIdleCallback" in window) {
    requestIdleCallback(inject, { timeout: MAX_IDLE_WAIT_MS });
  } else {
    window.addEventListener("load", () => setTimeout(inject, 1000));
  }
});

/**
 * 注入百度统计脚本
 * URL 在运行时由 ID 动态拼接，源码中不出现完整 URL 字面量
 */
function injectBaiduTongji(id: string): void {
  // 防重复注入
  if (window._hmt && window._hmt._p) return;

  // 初始化全局队列
  const _hmt = (window._hmt = window._hmt || []);

  // --- 第 2 层：动态拼接脚本 URL ---
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://hm.baidu.com/hm.js?" + id;

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
}

// 扩展 Window 类型
declare global {
  interface Window {
    _hmt?: Array<[string, ...unknown[]]> & { _p?: boolean };
  }
}
