/**
 * 批量测试所有插件端点根域名可达性
 */
import { ofetch } from "ofetch";

// 从 TS 插件提取的所有唯一端点
const endpoints = [
  "https://www.ahhhhfs.com/",
  "https://www.aikanzy.com/",
  "https://www.aliupan.com/",
  "https://so.allsharehub.com/",
  "https://www.bixbiy.com/",
  "https://wvmzbxki.1122132.xyz/",
  "https://www.8800492.xyz",
  "https://www.cilixiong.org",
  "https://cyg.app/",
  "https://www.daishuduanju.com/",
  "https://ddys.pro",
  "https://linux.do/",
  "https://duanjugou.top",
  "https://sm3.cc",
  "https://tv.yydsys.top/",
  "https://bbs.dyyjmax.org",
  "https://dyyjpro.com",
  "https://erxiaofn.click/",
  "https://feikuai.tv/",
  "https://4kfox.com",
  "https://www.gaoqing888.com",
  "https://www.gying.net",
  "https://haisou.cc/",
  "https://www.hdmoli.pro",
  "https://www.4khdr.cn/",
  "http://xsayang.fun:12512/",
  "http://103.45.162.207:20720/",
  "https://hunhepan.com/",
  "https://qkpanso.com/",
  "https://kuake8.com/",
  "https://www.misoso.cc/",
  "https://javdb.com",
  "https://api.jikepan.xyz/",
  "https://jsnoteclub.com/",
  "https://pan.dyuzi.com/",
  "https://1.star2.cn",
  "https://www.kuakemao.com/",
  "http://kkv.q-23.cn",
  "http://xiaocge.fun/",
  "https://leijing.xyz",
  "https://www.libvio.mov",
  "https://web5.mukaku.com/",
  "https://www.1lou.me",
  "https://video.451024.xyz",
  "https://www.melost.cn",
  "https://miaosou.fun/",
  "https://www.mikuclub.uk/",
  "https://mizixing.com",
  "https://123.666291.xyz/",
  "https://666.666291.xyz/",  // Go 版本的 URL
  "https://nsthwj.com/",
  "https://nyaa.si",
  "https://woog.nxog.eu.org/",
  "https://pan666.net/",
  "https://pinglian.lol",
  "https://www.pansearch.me/",
  "https://www.91panta.cn/",
  "https://www.panwiki.com",
  "https://panyq.com",
  "https://www.panzun.cc",
  "https://btnull.pro",
  "https://www.pioz.cn",
  "http://revohd.com",
  "https://www.qnmp4.com",
  "https://quark4k.com/",
  "https://quarksoo.cc/",
  "https://www.quarktv.com",
  "https://www.qupanshe.com",
  "https://v.funletu.com/",
  "https://sdso.top/",
  "http://1.95.79.193",
  "https://solidtorrents.to/",
  "https://sousou.pro/",
  "https://susuifa.com/",
  "https://thpibay.xyz",
  "https://torrentgalaxy.to",
  "https://u3c3u3c3.u3c3u3c3u3c3.com",
  "https://1337x.to/",
  "https://www.66ss.org",
  "https://xiongdipan.com",
  "https://ys.66ds.de/",
  "https://www.xiaojitv.com",
  "https://xzys.fun",
  "https://www.xinjuc.com",
  "https://xuexizhinan.com",
  "https://www.yunso.net",
  "https://bbs.yiove.com",
  "https://ypfxw.com/",
  "https://www.iyuhuage.fun",
  "http://www.yulinshufa.cn",
  "https://yunsou.xyz/",
  "https://xiaomi666.fun/",
  "https://www.zxzjhd.com",
];

console.log(`测试 ${endpoints.length} 个端点\n`);

const results = { ok: [], fail: [] };

// 并发测试，每次 10 个
const batchSize = 10;
for (let i = 0; i < endpoints.length; i += batchSize) {
  const batch = endpoints.slice(i, i + batchSize);
  const promises = batch.map(async (url) => {
    const start = Date.now();
    try {
      const resp = await ofetch(url, {
        timeout: 5000,
        headers: { 
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "accept": "text/html,application/json,*/*;q=0.8",
        },
        redirect: "follow",
      });
      const ms = Date.now() - start;
      const status = typeof resp === 'string' ? `${resp.length} bytes` : 'json';
      return { url, ok: true, ms, status };
    } catch (e) {
      const ms = Date.now() - start;
      return { url, ok: false, ms, error: e.message?.substring(0, 80) };
    }
  });
  
  const batchResults = await Promise.all(promises);
  for (const r of batchResults) {
    if (r.ok) {
      results.ok.push(r);
      console.log(`✅ ${r.ms}ms ${r.url} (${r.status})`);
    } else {
      results.fail.push(r);
      console.log(`❌ ${r.ms}ms ${r.url} - ${r.error}`);
    }
  }
}

console.log(`\n=== 汇总 ===`);
console.log(`✅ 可达: ${results.ok.length}`);
console.log(`❌ 不可达: ${results.fail.length}`);
console.log(`\n不可达端点:`);
for (const r of results.fail.sort((a, b) => a.url.localeCompare(b.url))) {
  console.log(`  ${r.url} - ${r.error}`);
}
