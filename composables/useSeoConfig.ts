/**
 * 全局 SEO 配置中心
 *
 * 统一管理 TDK（Title / Description / Keywords）、
 * Open Graph、Twitter Card 及 JSON-LD 结构化数据。
 *
 * 用法：在 app.vue 中调用 useSeoConfig() 即可全局注入。
 */

export function useSeoConfig() {
  const config = useRuntimeConfig();
  const siteUrl = (config.public?.siteUrl as string) || "";

  const SEO = {
    title: "PanSeek-全网最全的网盘搜索_知识分享萌",
    description:
      "PanSeek 是一款网盘资源聚合搜索工具，支持阿里云盘、夸克网盘、百度网盘、115、迅雷云盘等多平台一键检索，快速发现电影、剧集、音乐、软件等分享资源。",
    keywords:
      "网盘搜索,阿里云盘搜索,夸克网盘搜索,百度网盘搜索,115网盘,迅雷云盘,资源搜索,盘搜,网盘资源,电影资源,剧集搜索,PanSeek,网盘聚合搜索",
    siteName: "PanSeek",
    ogImage: siteUrl ? `${siteUrl}/og.svg` : "/og.svg",
  };

  // useSeoMeta —— 覆盖 title / description / keywords / OG / Twitter
  useSeoMeta({
    title: SEO.title,
    description: SEO.description,
    ogTitle: SEO.title,
    ogDescription: SEO.description,
    ogType: "website",
    ogSiteName: SEO.siteName,
    ogImage: SEO.ogImage,
    twitterCard: "summary_large_image",
    twitterTitle: SEO.title,
    twitterDescription: SEO.description,
    twitterImage: SEO.ogImage,
  });

  // useHead —— canonical / keywords / JSON-LD 结构化数据
  useHead({
    link: [{ rel: "canonical", href: siteUrl ? `${siteUrl}/` : "/" }],
    meta: [{ name: "keywords", content: SEO.keywords }],
    script: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SEO.siteName,
          url: siteUrl || "",
          potentialAction: {
            "@type": "SearchAction",
            target: (siteUrl || "") + "/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  });
}
