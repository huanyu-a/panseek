// https://nuxt.com/docs/api/configuration/nuxt-config
import channelsConfig from "./config/channels.json";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  devServer: {
    port: 4000,
  },
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
        },
        { name: "theme-color", content: "#111111" },
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },
  nitro: {
    // 根据环境变量动态选择部署预设
    preset: process.env.VERCEL
      ? "vercel"
      : process.env.NITRO_PRESET || "node-server",
    // Vercel serverless function 最大执行时间（Pro: 60s, Hobby: 10s）
    vercel: {
      functions: {
        maxDuration: 60,
      },
    },
  },
  routeRules: {
    // 热搜接口不缓存，否则 POST 写入后 GET 仍返回旧数据
    "/api/hot-searches": { swr: false, cache: false },
    // 豆瓣热搜允许短时缓存（服务端已有 60 分钟 cache）
    "/api/douban-hot": { swr: false, cache: false },
    // 密码门接口不缓存，确保 POST body 正常处理
    "/api/auth/**": { swr: false, cache: false },
    // 搜索接口依赖 Cookie 鉴权，禁止缓存避免 401 被缓存
    "/api/search": { swr: false, cache: false },
    // 图片代理依赖豆瓣，禁止 SWR 缓存避免错误响应被缓存
    "/api/img": { swr: false, cache: false },
    "/**": { swr: 3600 },
  },
  runtimeConfig: {
    // server-only 配置
    searchPassword: process.env.SEARCH_PASSWORD || "",
    priorityChannels: channelsConfig.priorityChannels,
    defaultChannels: channelsConfig.defaultChannels,
    defaultConcurrency: channelsConfig.defaultConcurrency,
    pluginTimeoutMs: channelsConfig.pluginTimeoutMs,
    cacheEnabled: true,
    cacheTtlMinutes: channelsConfig.cacheTtlMinutes,
    public: {
      apiBase: "/api",
      siteUrl: "https://panseek.bx9y.com.cn",
      // 向前端暴露默认频道清单
      tgDefaultChannels: channelsConfig.defaultChannels,
      // 百度统计 ID（环境变量注入，不提交到仓库）
      baiduTongjiId: process.env.NUXT_PUBLIC_BAIDU_TONGJI_ID || "",
    },
  },
});
