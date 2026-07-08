// 批量生成68个插件TS文件的脚本 v2
// 改进：使用 searchWithDetailPages 和 extractResultsFromJSON
const fs = require('fs');
const path = require('path');

const plugins = [
  ["ahhhhfs","ahhhhfs",2,false,"https://www.ahhhhfs.com/?cat=&s=","html"],
  ["aikanzy","aikanzy",3,false,"https://www.aikanzy.com/search?word=","html"],
  ["alupan","alupan",2,false,"https://www.aliupan.com/?s=","html"],
  ["ash","ash",3,false,"https://so.allsharehub.com/s/","html"],
  ["bixin","bixin",3,true,"https://www.bixbiy.com/api/discussions","json"],
  ["cldi","cldi",3,true,"https://wvmzbxki.1122132.xyz/search-","html"],
  ["clmao","clmao",3,true,"https://www.8800492.xyz","html"],
  ["clxiong","clxiong",2,true,"https://www.cilixiong.org","html"],
  ["cyg","cyg",3,false,"https://cyg.app/wp-json/wp/v2/posts","json"],
  ["daishudj","daishudj",3,false,"https://www.daishuduanju.com/?s=","html"],
  ["ddys","ddys",3,false,"https://ddys.pro","html"],
  ["discourse","discourse",2,false,"https://linux.do/search.json?q=","json"],
  ["djgou","djgou",3,false,"https://duanjugou.top","html"],
  ["duanjuw","duanjuw",3,false,"https://sm3.cc","html"],
  ["dyyj","dyyj",3,false,"https://bbs.dyyjmax.org","html"],
  ["dyyjpro","dyyjpro",2,false,"https://dyyjpro.com","html"],
  ["erxiao","erxiao",3,false,"https://erxiaofn.click/index.php/vod/search/wd/","html"],
  ["feikuai","feikuai",3,true,"https://feikuai.tv/t_search/bm_search.php?kw=","html"],
  ["gaoqing888","gaoqing888",3,false,"https://www.gaoqing888.com","html"],
  ["gying","gying",3,false,"https://www.gying.net","html"],
  ["haisou","haisou",3,false,"https://haisou.cc/api/pan/share/search?query=","json"],
  ["hdmoli","hdmoli",3,false,"https://www.hdmoli.pro","html"],
  ["javdb","javdb",3,true,"https://javdb.com","html"],
  ["jsnoteclub","jsnoteclub",2,false,"https://jsnoteclub.com/","html"],
  ["jupansou","jupansou",3,false,"https://pan.dyuzi.com/api/other/web_search?title=","json"],
  ["jutoushe","jutoushe",3,false,"https://1.star2.cn","html"],
  ["kkmao","kkmao",2,false,"https://www.kuakemao.com/?s=","html"],
  ["kkv","kkv",3,false,"http://kkv.q-23.cn","html"],
  ["leijing","leijing",3,false,"https://leijing.xyz","html"],
  ["libvio","libvio",3,true,"https://www.libvio.mov","html"],
  ["lingjisp","lingjisp",3,false,"https://web5.mukaku.com/prod/api/v1/","json"],
  ["lou1","lou1",1,false,"https://www.1lou.me","html"],
  ["meitizy","meitizy",3,false,"https://video.451024.xyz","html"],
  ["melost","melost",3,false,"https://www.melost.cn/v1/search/disk","json"],
  ["miaoso","miaoso",3,false,"https://miaosou.fun/api/secendsearch","json"],
  ["mikuclub","mikuclub",2,false,"https://www.mikuclub.uk/wp-json/utils/v2/post_list","json"],
  ["mizixing","mizixing",3,false,"https://mizixing.com","html"],
  ["nsgame","nsgame",2,false,"https://nsthwj.com/thwj/game/query","json"],
  ["panlian","panlian",3,false,"https://pinglian.lol","html"],
  ["panwiki","panwiki",3,true,"https://www.panwiki.com","html"],
  ["panzun","panzun",2,false,"https://www.panzun.cc","html"],
  ["pianku","pianku",3,false,"https://btnull.pro","html"],
  ["qingying","qingying",3,false,"http://revohd.com","html"],
  ["qiwei","qiwei",3,false,"https://www.qnmp4.com","html"],
  ["qqpd","qqpd",3,false,"https://your-domain.com/qqpd/","json"],
  ["quark4k","quark4k",3,true,"https://quark4k.com/api/discussions","json"],
  ["quarksoo","quarksoo",3,false,"https://quarksoo.cc/search.php","html"],
  ["quarktv","quarktv",2,false,"https://www.quarktv.com","html"],
  ["qupanshe","qupanshe",3,false,"https://www.qupanshe.com","html"],
  ["sdso","sdso",3,false,"https://sdso.top/api/sd/search?name=","json"],
  ["sousou","sousou",3,false,"https://sousou.pro/api.php","json"],
  ["u3c3","u3c3",5,true,"https://u3c3u3c3.u3c3u3c3u3c3.com","html"],
  ["weibo","weibo",3,false,"https://weibo.com/","json"],
  ["wuji","wuji",3,true,"https://xcili.net","html"],
  ["xb6v","xb6v",3,true,"https://www.66ss.org","html"],
  ["xdpan","xdpan",3,false,"https://xiongdipan.com","html"],
  ["xdyh","xdyh",3,false,"https://ys.66ds.de/search","html"],
  ["xiaoji","xiaoji",3,false,"https://www.xiaojitv.com","html"],
  ["xiaozhang","xiaozhang",3,false,"https://xzys.fun","html"],
  ["xinjuc","xinjuc",3,false,"https://www.xinjuc.com","html"],
  ["xys","xys",3,false,"https://www.yunso.net","html"],
  ["yiove","yiove",3,true,"https://bbs.yiove.com","html"],
  ["ypfxw","ypfxw",2,false,"https://ypfxw.com/search.php?q=","html"],
  ["yuhuage","yuhuage",3,true,"https://www.iyuhuage.fun","html"],
  ["yulinshufa","yulinshufa",3,false,"http://www.yulinshufa.cn","html"],
  ["yunso","yunso",3,false,"https://www.yunso.net/api/Core/search2","json"],
  ["yunsou","yunsou",2,false,"https://yunsou.xyz/s/","html"],
  ["zxzj","zxzj",3,false,"https://www.zxzjhd.com","html"],
];

const outDir = path.join(__dirname, 'server', 'core', 'plugins');
let count = 0;

for (const [name, cname, prio, skip, baseUrl, type] of plugins) {
  const className = name.charAt(0).toUpperCase() + name.slice(1) + 'Plugin';
  const skipStr = skip ? 'true' : 'false';
  const isJson = type === 'json';

  let searchBody;
  if (isJson) {
    searchBody = `    const url = SEARCH_URL + encodeURIComponent(keyword);
    const resp = await fetchJSON<any>(url);
    if (!resp) return [];
    const results = extractResultsFromJSON(resp, '${cname}', keyword);
    return results;`;
  } else {
    searchBody = `    const url = SEARCH_URL + encodeURIComponent(keyword);
    const { results } = await searchWithDetailPages(url, {
      maxDetails: 6,
      timeout: 8000,
      detailTimeout: 6000,
    });
    // 设置 pluginName
    for (const r of results) {
      r.unique_id = r.unique_id.replace('plugin-', '${cname}-');
    }
    return filterByKeyword(results, keyword);`;
  }

  const template = `import { BaseAsyncPlugin, registerGlobalPlugin } from "./manager";
import type { SearchResult } from "../types/models";
import {
  searchWithDetailPages,
  fetchJSON,
  extractResultsFromJSON,
  filterByKeyword,
  cleanHTML,
  createSearchResult,
} from "./pluginUtils";

const SEARCH_URL = "${baseUrl}";

export class ${className} extends BaseAsyncPlugin {
  constructor() {
    super("${cname}", ${prio});
  }
  override skipServiceFilter(): boolean {
    return ${skipStr};
  }
  override async search(keyword: string): Promise<SearchResult[]> {
    try {
${searchBody}
    } catch {
      return [];
    }
  }
}

registerGlobalPlugin(new ${className}());
`;

  const outFile = path.join(outDir, `${name}.ts`);
  fs.writeFileSync(outFile, template, 'utf8');
  count++;
}

console.log(`Created ${count} plugin files`);
