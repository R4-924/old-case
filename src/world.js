/* ==========================================================================
   交互小说引擎 · world.js
   生成小镇：名字、地貌、三层历史、机构、传闻。

   ★ 三层历史是世界观的核心：
     每层历史 = 一件往事 + 受损的家族 + 得利的家族 + 留下的痕迹。
     家族在层与层之间重复出现——三十年前败落的那家，
     十二年前又被人踩一脚；这才是"恩怨"的土壤。
   ========================================================================== */

const World = (() => {
  'use strict';

  const TIMES = ['清晨', '上午', '正午', '午后', '黄昏', '入夜'];

  /* ------------------------------------------------------------------
     机构池：每局抽 5 个
     ------------------------------------------------------------------ */

  const INSTITUTIONS = [
    { id: 'ancestral', name: '祠堂', flavor: '族里议事、停灵、供祖先牌位的地方' },
    { id: 'office',    name: '镇公所', flavor: '老街上那栋砖楼，管着全镇的簿册' },
    { id: 'dock',      name: '老码头', flavor: '客船三天来一趟，货都从这里进出' },
    { id: 'factory',   name: '旧织布厂', flavor: '机器已经停了十二年，烟囱还立着' },
    { id: 'church',    name: '半山教堂', flavor: '传教士留下的，钟声全镇都听得见' },
    { id: 'mansion',   name: '大宅院', flavor: '镇上最气派的宅子，门楣上挂着旧匾' },
    { id: 'shop',      name: '陈家铺子', flavor: '卖油盐杂货，也替人代写书信' },
    { id: 'teahouse',  name: '桥头茶馆', flavor: '闲人们从早坐到晚的地方' },
    { id: 'clinic',    name: '济世堂', flavor: '全镇唯一的大夫坐诊处' },
    { id: 'school',    name: '义学', flavor: '十年前停办的学堂，门还开着' },
    { id: 'mill',      name: '老磨坊', flavor: '水车还在转，只是没人来磨面了' },
    { id: 'temple',    name: '河神庙', flavor: '渔民和跑船的人常来烧香' },
  ];

  /* ------------------------------------------------------------------
     历史层池。
     each: 事件名 + 受损方/得利方的角色描述 + 痕迹（会变成线索的引子）
     ------------------------------------------------------------------ */

  const HISTORIES = [
    {
      name: '三十一年前的大火',
      yearsAgo: 31,
      text: '一场大火烧掉了半条河街。起火原因众说纷纭，最后以"灯烛失慎"结了案。',
      loserRole: '沿街的商铺住户', winnerRole: '在火灾后低价买下整片河街的人',
      traces: ['当年结案的卷宗', '烧剩的半截房梁', '幸存者的回忆'],
    },
    {
      name: '十二年前的倒闭',
      yearsAgo: 12,
      text: '织布厂一夜倒闭。东家卷款跑了，几百个工人一分钱没拿到。',
      loserRole: '厂里的工人', winnerRole: '接手了厂子和机器的人',
      traces: ['厂里的旧账本', '没寄出去的讨薪信', '贴着封条的车间'],
    },
    {
      name: '四年前的征地',
      yearsAgo: 4,
      text: '修路要征地。给的补偿少得可怜，有人签字，有人连夜搬走。',
      loserRole: '被征走地的农户', winnerRole: '经手补偿款的人',
      traces: ['地契与收据', '没署名的请愿书', '路旁的新坟'],
    },
    {
      name: '二十六年前的沉船',
      yearsAgo: 26,
      text: '一条客船在渡口翻了，十三条人命。有人说是风浪，有人说是船板太旧。',
      loserRole: '遇难船客的家属', winnerRole: '卖船板起家的木行',
      traces: ['沉船时留下的缆绳', '当年登船的名单', '木行里的旧船板'],
    },
    {
      name: '九年前的瘟疫',
      yearsAgo: 9,
      text: '一场瘟疫带走了镇上半数的老人。药材价格翻了十倍。',
      loserRole: '买不起药的穷人', winnerRole: '囤积药材的商人',
      traces: ['当年的药方', '高价药材的账目', '关过病人的老屋'],
    },
    {
      name: '十七年前的走水',
      yearsAgo: 17,
      text: '祠堂走水，烧了三本族谱。重修祠堂的钱摊到每家头上。',
      loserRole: '拿不出钱的小户', winnerRole: '主持重修的族老',
      traces: ['重修祠堂的账本', '烧剩下的半本族谱', '祠堂墙上的焦痕'],
    },
    {
      name: '六年前的骗婚',
      yearsAgo: 6,
      text: '外地来的一门亲事骗走了聘礼，新娘子半路跑了。',
      loserRole: '被骗了聘礼的人家', winnerRole: '保媒的人',
      traces: ['婚书的抄本', '媒人的谢礼清单', '新娘留下的半张船票'],
    },
    {
      name: '二十年前的修堤',
      yearsAgo: 20,
      text: '那年大水，修堤的银子层层过手，堤还是垮了。',
      loserRole: '被淹了田的人', winnerRole: '经手修堤款的人',
      traces: ['修堤的账册', '当年决口处的界碑', '堤上的老照片'],
    },
  ];

  /* ------------------------------------------------------------------
     传闻池：一条真、一条假。真的那一条藏着一件真事。
     ------------------------------------------------------------------ */

  const LEGENDS = [
    {
      text: '都说每逢雾最大的夜晚，河街尽头会亮起一盏没人点的灯。',
      truth: '其实是守夜人半夜起来巡更，手里提的马灯。',
      connectsTo: 'witness',   // 指向目击者
    },
    {
      text: '有人说祠堂后院埋着前清年间的一坛金。',
      truth: '埋的不是金，是一箱地契——谁握着地契，谁就握着半条河街。',
      connectsTo: 'document',
    },
    {
      text: '都说织布厂的机器停了，半夜却还能听见梭子响。',
      truth: '是看厂人夜里纺线贴补家用，怕人知道。',
      connectsTo: 'witness',
    },
    {
      text: '老人说河神爷十年收一条命，今年又到年头了。',
      truth: '二十年前修堤那年，堤下死过人，一直没人查。',
      connectsTo: 'oldGrudge',
    },
    {
      text: '都说大宅院的后门夜里不锁，是给"那位"留的。',
      truth: '未亡人每天夜里等一个不会再回来的人。',
      connectsTo: 'love',
    },
    {
      text: '镇上传，陈家铺子代写的书信，十封里有九封是假的。',
      truth: '掌柜会把信里提到的要紧事都记下来，攒成一册。',
      connectsTo: 'document',
    },
  ];

  /* ------------------------------------------------------------------
     生成世界
     ------------------------------------------------------------------ */

  function generate(rng) {
    const tn = Names.townName(rng);
    const institutions = RNG.sample(rng, INSTITUTIONS, 5);

    // 三层历史：不能抽到同一件
    const hs = RNG.sample(rng, HISTORIES, 3);

    // 两家"命运家族"贯穿历史：
    //   甲家：历史 1 里受损 → 历史 2 里再次受损（苦主线）
    //   乙家：历史 1 里得利 → 历史 2 里继续得利（新贵线）
    // 用姓氏标记，具体人物由 people.js 领走
    const a = Names.personName(rng), b = Names.personName(rng);

    const histories = hs.map((h, i) => ({
      id: 'h' + (i + 1),
      name: h.name,
      yearsAgo: h.yearsAgo,
      text: h.text,
      // 第一层：甲受损、乙得利；第二层：甲再受损、乙再得利；
      // 第三层：角色倒转（甲家的年轻人开始得利、乙家开始出事）
      loser: i === 2 ? b.name : a.name,
      winner: i === 2 ? a.name : b.name,
      loserDesc: h.loserRole + (i === 2 ? '（这次轮到乙家）' : ''),
      winnerDesc: h.winnerRole + (i === 2 ? '（这次轮到甲家）' : ''),
      traces: h.traces,
    }));

    // 传闻：抽两条，一条为真
    const legends = RNG.sample(rng, LEGENDS, 2).map((l, i) => ({
      id: 'legend' + (i + 1),
      text: l.text,
      real: i === 0,           // 第一条为真
      truth: l.truth,
      connectsTo: l.connectsTo,
    }));

    return {
      town: tn,
      institutions,
      histories,
      legends,
      fateFamilies: { a: a.name, b: b.name },
    };
  }

  return { generate, TIMES };
})();

window.World = World;
