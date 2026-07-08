/**
 * 显式注册所有插件
 * 通过导入插件类并显式调用 registerGlobalPlugin，避免 Rollup 树摇
 */
import { registerGlobalPlugin } from "./manager";

// 原有插件
import { PansearchPlugin } from "./pansearch";
import { NyaaPlugin } from "./nyaa";
import { SusuPlugin } from "./susu";
import { X1337xPlugin } from "./x1337x";
// import { ZhizhenPlugin } from "./zhizhen"; // 端点死亡
import { WanouPlugin } from "./wanou";
// import { TorrentGalaxyPlugin } from "./torrentgalaxy"; // 端点死亡
import { SolidTorrentsPlugin } from "./solidtorrents";
// import { ShandianPlugin } from "./shandian"; // 端点死亡
import { PanyqPlugin } from "./panyq";
import { Pan666Plugin } from "./pan666";
import { OugePlugin } from "./ouge";
// import { MuouPlugin } from "./muou"; // 端点死亡
import { HubanPlugin } from "./huban";
// import { Hdr4kPlugin } from "./hdr4k"; // 端点死亡
// import { Fox4kPlugin } from "./fox4k"; // 端点死亡

// 从 pansou 迁移的插件（端点死亡的已注释）
// import { AhhhhfsPlugin } from "./ahhhhfs"; // 端点死亡
import { AikanzyPlugin } from "./aikanzy";
import { AlupanPlugin } from "./alupan";
import { AshPlugin } from "./ash";
import { BixinPlugin } from "./bixin";
// import { CldiPlugin } from "./cldi"; // 端点死亡
// import { ClmaoPlugin } from "./clmao"; // 端点死亡
import { ClxiongPlugin } from "./clxiong";
// import { CygPlugin } from "./cyg"; // 端点死亡
// import { DaishudjPlugin } from "./daishudj"; // 端点死亡
// import { DdysPlugin } from "./ddys"; // 端点死亡
import { DiscoursePlugin } from "./discourse";
import { DjgouPlugin } from "./djgou";
import { DuanjuwPlugin } from "./duanjuw";
import { DyyjPlugin } from "./dyyj";
import { DyyjproPlugin } from "./dyyjpro";
// import { ErxiaoPlugin } from "./erxiao"; // 端点死亡
// import { FeikuaiPlugin } from "./feikuai"; // 端点死亡
import { Gaoqing888Plugin } from "./gaoqing888";
import { GyingPlugin } from "./gying";
import { HaisouPlugin } from "./haisou";
// import { HdmoliPlugin } from "./hdmoli"; // 端点死亡
import { JavdbPlugin } from "./javdb";
import { JsnoteclubPlugin } from "./jsnoteclub";
import { JupansouPlugin } from "./jupansou";
import { JutoushePlugin } from "./jutoushe";
import { KkmaoPlugin } from "./kkmao";
import { KkvPlugin } from "./kkv";
import { LeijingPlugin } from "./leijing";
import { LibvioPlugin } from "./libvio";
import { LingjispPlugin } from "./lingjisp";
import { Lou1Plugin } from "./lou1";
import { MeitizyPlugin } from "./meitizy";
import { MelostPlugin } from "./melost";
import { MiaosoPlugin } from "./miaoso";
import { MikuclubPlugin } from "./mikuclub";
import { MizixingPlugin } from "./mizixing";
import { NsgamePlugin } from "./nsgame";
import { PanlianPlugin } from "./panlian";
import { PanwikiPlugin } from "./panwiki";
import { PanzunPlugin } from "./panzun";
import { PiankuPlugin } from "./pianku";
// import { QingyingPlugin } from "./qingying"; // 端点死亡 (410 Gone)
// import { QiweiPlugin } from "./qiwei"; // 端点死亡
import { QqpdPlugin } from "./qqpd";
import { Quark4kPlugin } from "./quark4k";
import { QuarksooPlugin } from "./quarksoo";
import { QuarktvPlugin } from "./quarktv";
// import { QupanshePlugin } from "./qupanshe"; // 端点死亡
// import { SdsoPlugin } from "./sdso"; // 端点死亡
import { SousouPlugin } from "./sousou";
import { U3c3Plugin } from "./u3c3";
import { WeiboPlugin } from "./weibo";
import { WujiPlugin } from "./wuji";
import { Xb6vPlugin } from "./xb6v";
import { XdpanPlugin } from "./xdpan";
import { XdyhPlugin } from "./xdyh";
import { XiaojiPlugin } from "./xiaoji";
import { XiaozhangPlugin } from "./xiaozhang";
// import { XinjucPlugin } from "./xinjuc"; // 端点死亡
import { XysPlugin } from "./xys";
import { YiovePlugin } from "./yiove";
// import { YpfxwPlugin } from "./ypfxw"; // 端点死亡
import { YuhuagePlugin } from "./yuhuage";
import { YulinshufaPlugin } from "./yulinshufa";
import { YunsoPlugin } from "./yunso";
import { YunsouPlugin } from "./yunsou";
import { ZxzjPlugin } from "./zxzj";

// 新增的插件（端点死亡的已注释）
import { DuoduoPlugin } from "./duoduo";
import { HunhepanPlugin } from "./hunhepan";
// import { JikepanPlugin } from "./jikepan"; // 端点死亡 (522)
import { LabiPlugin } from "./labi";
// import { PantaPlugin } from "./panta"; // 端点死亡
import { PiozPlugin } from "./pioz";
import { ThePirateBayPlugin } from "./thepiratebay";
// import { XuexizhinanPlugin } from "./xuexizhinan"; // 端点死亡
// import { QupansouPlugin } from "./qupansou"; // 端点死亡 (502)

/** 注册全部插件到全局注册表 */
export function registerAllPlugins(): void {
  // 原有插件（端点死亡的已注释）
  registerGlobalPlugin(new PansearchPlugin());
  registerGlobalPlugin(new NyaaPlugin());
  registerGlobalPlugin(new SusuPlugin());
  registerGlobalPlugin(new X1337xPlugin());
  // registerGlobalPlugin(new ZhizhenPlugin()); // 端点死亡
  registerGlobalPlugin(new WanouPlugin());
  // registerGlobalPlugin(new TorrentGalaxyPlugin()); // 端点死亡
  registerGlobalPlugin(new SolidTorrentsPlugin());
  // registerGlobalPlugin(new ShandianPlugin()); // 端点死亡
  registerGlobalPlugin(new PanyqPlugin());
  registerGlobalPlugin(new Pan666Plugin());
  registerGlobalPlugin(new OugePlugin());
  // registerGlobalPlugin(new MuouPlugin()); // 端点死亡
  registerGlobalPlugin(new HubanPlugin());
  // registerGlobalPlugin(new Hdr4kPlugin()); // 端点死亡
  // registerGlobalPlugin(new Fox4kPlugin()); // 端点死亡

  // 从 pansou 迁移的插件（端点死亡的已注释）
  // registerGlobalPlugin(new AhhhhfsPlugin()); // 端点死亡
  registerGlobalPlugin(new AikanzyPlugin());
  registerGlobalPlugin(new AlupanPlugin());
  registerGlobalPlugin(new AshPlugin());
  registerGlobalPlugin(new BixinPlugin());
  // registerGlobalPlugin(new CldiPlugin()); // 端点死亡
  // registerGlobalPlugin(new ClmaoPlugin()); // 端点死亡
  registerGlobalPlugin(new ClxiongPlugin());
  // registerGlobalPlugin(new CygPlugin()); // 端点死亡
  // registerGlobalPlugin(new DaishudjPlugin()); // 端点死亡
  // registerGlobalPlugin(new DdysPlugin()); // 端点死亡
  registerGlobalPlugin(new DiscoursePlugin());
  registerGlobalPlugin(new DjgouPlugin());
  registerGlobalPlugin(new DuanjuwPlugin());
  registerGlobalPlugin(new DyyjPlugin());
  registerGlobalPlugin(new DyyjproPlugin());
  // registerGlobalPlugin(new ErxiaoPlugin()); // 端点死亡
  // registerGlobalPlugin(new FeikuaiPlugin()); // 端点死亡
  registerGlobalPlugin(new Gaoqing888Plugin());
  registerGlobalPlugin(new GyingPlugin());
  registerGlobalPlugin(new HaisouPlugin());
  // registerGlobalPlugin(new HdmoliPlugin()); // 端点死亡
  registerGlobalPlugin(new JavdbPlugin());
  registerGlobalPlugin(new JsnoteclubPlugin());
  registerGlobalPlugin(new JupansouPlugin());
  registerGlobalPlugin(new JutoushePlugin());
  registerGlobalPlugin(new KkmaoPlugin());
  registerGlobalPlugin(new KkvPlugin());
  registerGlobalPlugin(new LeijingPlugin());
  registerGlobalPlugin(new LibvioPlugin());
  registerGlobalPlugin(new LingjispPlugin());
  registerGlobalPlugin(new Lou1Plugin());
  registerGlobalPlugin(new MeitizyPlugin());
  registerGlobalPlugin(new MelostPlugin());
  registerGlobalPlugin(new MiaosoPlugin());
  registerGlobalPlugin(new MikuclubPlugin());
  registerGlobalPlugin(new MizixingPlugin());
  registerGlobalPlugin(new NsgamePlugin());
  registerGlobalPlugin(new PanlianPlugin());
  registerGlobalPlugin(new PanwikiPlugin());
  registerGlobalPlugin(new PanzunPlugin());
  registerGlobalPlugin(new PiankuPlugin());
  // registerGlobalPlugin(new QingyingPlugin()); // 端点死亡
  // registerGlobalPlugin(new QiweiPlugin()); // 端点死亡
  registerGlobalPlugin(new QqpdPlugin());
  registerGlobalPlugin(new Quark4kPlugin());
  registerGlobalPlugin(new QuarksooPlugin());
  registerGlobalPlugin(new QuarktvPlugin());
  // registerGlobalPlugin(new QupanshePlugin()); // 端点死亡
  // registerGlobalPlugin(new SdsoPlugin()); // 端点死亡
  registerGlobalPlugin(new SousouPlugin());
  registerGlobalPlugin(new U3c3Plugin());
  registerGlobalPlugin(new WeiboPlugin());
  registerGlobalPlugin(new WujiPlugin());
  registerGlobalPlugin(new Xb6vPlugin());
  registerGlobalPlugin(new XdpanPlugin());
  registerGlobalPlugin(new XdyhPlugin());
  registerGlobalPlugin(new XiaojiPlugin());
  registerGlobalPlugin(new XiaozhangPlugin());
  // registerGlobalPlugin(new XinjucPlugin()); // 端点死亡
  registerGlobalPlugin(new XysPlugin());
  registerGlobalPlugin(new YiovePlugin());
  // registerGlobalPlugin(new YpfxwPlugin()); // 端点死亡
  registerGlobalPlugin(new YuhuagePlugin());
  registerGlobalPlugin(new YulinshufaPlugin());
  registerGlobalPlugin(new YunsoPlugin());
  registerGlobalPlugin(new YunsouPlugin());
  registerGlobalPlugin(new ZxzjPlugin());

  // 新增的插件（端点死亡的已注释）
  registerGlobalPlugin(new DuoduoPlugin());
  registerGlobalPlugin(new HunhepanPlugin());
  // registerGlobalPlugin(new JikepanPlugin()); // 端点死亡
  registerGlobalPlugin(new LabiPlugin());
  // registerGlobalPlugin(new PantaPlugin()); // 端点死亡
  registerGlobalPlugin(new PiozPlugin());
  registerGlobalPlugin(new ThePirateBayPlugin());
  // registerGlobalPlugin(new XuexizhinanPlugin()); // 端点死亡
  // registerGlobalPlugin(new QupansouPlugin()); // 端点死亡
}
