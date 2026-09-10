/* ==========================================================================
   交互小说引擎 · truth.js
   ★ 引擎的心脏。"严谨"在这里实现，靠三条铁律：

   1. 真相倒推：先定凶手/动机/行动/掩盖，再让线索成为真相的"投影"。
   2. alibi 由日程保证：只有"案发时段日程有缺口"的人才能当凶手；
      凶手的那个时段是一句谎，红鲱鱼的时段是可核实的真话。
   3. 构造性可解：动机链 / 行动链 / 掩盖链 各自独立指向凶手——
      任何一条链走通就能破案（测试会断言这一点）。

   事实（fact）是唯一真相源：线索指向事实，人物的"所知/立场"挂在事实上。
   ========================================================================== */

const Truth = (() => {
  'use strict';

  /* ------------------------------------------------------------------
     凶案剧本池：按"凶手是谁"选场景、凶器、手法
     每个剧本都配齐三链的事实文本和线索文本
     ------------------------------------------------------------------ */

  const SCENARIOS = {

    /* 苦主在码头杀权威，伪装成失足落水 */
    bitter: {
      scene: 'dock',
      sceneName: '老码头',
      time: '入夜',
      method: '溺死（伪装成失足落水）',
      /** 凶手声称案发时在的地方——必须是可证伪的具体去向 */
      claim: 'ancestral',
      claimName: '祠堂',
      facts: {
        m1: '{murderer}家在{h1}和{h2}里两次吃了大亏，而{victim}两次都站在对面。',
        m2: '案发前几天，{murderer}和{victim}在街上当众吵了一架，好多人看见了。',
        m3: '{murderer}偷偷给{victim}写过一封没有署名的恐吓信。',
        a1: '凶器是一根撑船的竹篙——船边那根是新换的，旧的那根不见了。',
        a2: '入夜后有人看见{murderer}往码头方向去了——当时雾很大，那人影在雾里晃了两下。',
        a3: '死者的指甲缝里有淤泥，可码头当晚涨潮，落水处根本没有淤泥。',
        c1: '{murderer}说那晚在祠堂替人守夜，一步也没离开。',
        c2: '{murderer}家灶膛里有没烧尽的湿衣角。',
        c3: '船上的缆绳是从船外解开的——失足落水的人，不会先解开缆绳。',
      },
      clues: [
        { id: 'k1', fact: 'a1', place: 'dock',  name: '新换的竹篙',
          desc: '船边靠着一根新竹篙，竹节上的青皮还没磨掉。撑船的人都说，旧篙用得顺手，没有突然换新的道理。' },
        { id: 'k2', fact: 'c3', place: 'dock',  name: '缆绳的结',
          desc: '拴船的缆绳半浸在水里，绳结的方向很奇怪——是从船的外侧解开的。' },
        { id: 'k3', fact: 'm1', place: 'ancestral', name: '旧族谱上的记录',
          desc: '族谱里夹着一张发黄的纸：{h1}之后，谁家败了、谁家得了利，一笔一笔记得清楚。' },
        { id: 'k4', fact: 'm2', place: 'teahouse', name: '茶馆里的闲话',
          desc: '桥头茶馆的人都在说，前几天{bitter}和{victim}当街吵了一架，{bitter}走的时候说了一句"你等着"。' },
        { id: 'k5', fact: 'a3', place: 'clinic', name: '验尸的手记',
          desc: '济世堂大夫私下记了一笔：死者指甲缝里有淤泥，可落水处是涨潮后的清水区。这话他不敢往外说。' },
        { id: 'k6', fact: 'c2', place: 'mill', name: '灶膛里的衣角',
          desc: '老磨坊旁的灶膛里，有半截没烧尽的粗布衣角，湿过水，又沾着河泥。' },
        { id: 'k7', fact: 'c1', place: 'marginal', name: '那晚的灯影',
          desc: '入夜后，有人提着灯从镇子里往码头方向走。灯影在雾里晃了两下，就消失了。' },
        { id: 'k8', fact: 'm3', place: 'office', name: '没有署名的信',
          desc: '{victim}的桌案下面压着一封没署名的信，字是拿左手写的："旧账未清，天理难容。"' },
      ],
    },

    /* 新贵在大宅毒杀权威，伪装成畏债自尽 */
    nouveau: {
      scene: 'mansion',
      sceneName: '大宅院书房',
      time: '入夜',
      method: '毒杀（伪装成饮茶自尽）',
      claim: 'office',
      claimName: '镇公所',
      facts: {
        m1: '{murderer}发家的第一笔钱是{victim}牵的线，而{h1}里他占了天大的便宜，{victim}全都知情。',
        m2: '案发前几天，{murderer}和{victim}在街上当众吵了一架，好多人看见了。',
        m3: '{murderer}当年给{victim}送过一份谢礼，收据在{victim}手里——那是一张能索命的把柄。',
        a1: '凶器是茶壶里的乌头——茶渣里有乌头片，可泡茶的药渣被人倒进了花坛。',
        a2: '入夜后有人看见{murderer}提着一壶茶进了大宅院的后门。',
        a3: '桌上有两只茶杯，可{victim}从不与人共饮。',
        c1: '{murderer}说那晚去镇公所办地契，在门房等了大半夜。',
        c2: '花坛里的土是新翻的，下面埋着泡过乌头的药渣。',
        c3: '桌上留着一张"欠债难偿"的纸，可那字是左手写的——{victim}是个右撇子。',
      },
      clues: [
        { id: 'k1', fact: 'a1', place: 'mansion', name: '茶壶里的渣',
          desc: '书房桌上的茶壶还在。壶底沉着几片没化开的碎渣，黑褐色，不是寻常茶叶。' },
        { id: 'k9', fact: 'c2', place: 'mansion', name: '花坛新土',
          desc: '大宅院花坛里的土被人新翻过，土色深浅不一，拨开一点就能看见黑乎乎的渣子。' },
        { id: 'k2', fact: 'c3', place: 'mansion', name: '桌上的绝笔',
          desc: '书房桌上摊着一张纸，写着"欠债难偿"。可纸上的字迹发虚，起笔都是从左往右。' },
        { id: 'k3', fact: 'm3', place: 'ancestral', name: '收据的存根',
          desc: '祠堂的账册里夹着一张陈年收据的存根，上面的数目大得吓人，落款是{victim}的名字。' },
        { id: 'k4', fact: 'm2', place: 'teahouse', name: '茶馆里的闲话',
          desc: '桥头茶馆的人都在说，前几天{nouveau}和{victim}当街吵了一架，{nouveau}的脸色白得吓人。' },
        { id: 'k5', fact: 'a3', place: 'clinic', name: '两只茶杯',
          desc: '济世堂大夫去大宅时多看了一眼：桌上摆着两只茶杯，可{victim}独饮了半辈子。' },
        { id: 'k6', fact: 'c1', place: 'office', name: '门房的话',
          desc: '镇公所的门房赌咒发誓：那晚他值了一整夜的更，{murderer}根本就没来过。' },
        { id: 'k7', fact: 'a2', place: 'marginal', name: '后门的人影',
          desc: '入夜后，有人看见一个提茶壶的人影从大宅院后门出来，脚步很急。' },
        { id: 'k8', fact: 'm1', place: 'dock', name: '船行的旧账',
          desc: '码头船行里有一本旧账：{h1}那一年，{murderer}的第一桶金是谁出的钱、谁的货，记得清清楚楚。' },
      ],
    },

    /* 权威在镇公所杀新贵，伪装成盗贼入室 */
    authority: {
      scene: 'office',
      sceneName: '镇公所',
      time: '入夜',
      method: '钝器击杀（伪装成盗贼入室）',
      claim: 'church',
      claimName: '教堂',
      facts: {
        m1: '{victim}手里握着一本{h1}的旧账，正打算用它扳倒{murderer}。',
        m2: '案发前几天，{murderer}和{victim}在镇公所里关了门吵过一架。',
        m3: '{murderer}年轻时签过一份见不得光的文书，那份文书被{victim}拿到了。',
        a1: '凶器是桌上的铜镇纸——被擦干净放回了原处，但镇纸底下压出的印痕，和墙上的血渍形状吻合。',
        a2: '入夜后有人看见{murderer}进了镇公所，随后窗户上晃过两个影子。',
        a3: '死者是被人从背后击倒的，可门是反锁的——凶手有这间屋子的钥匙。',
        c1: '{murderer}说那晚在教堂做晚祷，可那晚教堂的钟根本没有响过。',
        c2: '铜镇纸被放回了原处，但摆反了方向——上头刻的字是倒着的。',
        c3: '窗子有撬痕，可撬痕在窗框外侧、还是新茬——像是有人从屋里往外撬，再伪装成有人从外头进来。',
      },
      clues: [
        { id: 'k1', fact: 'a1', place: 'office', name: '镇纸的印痕',
          desc: '书案上有一块长方形的浅印，像是镇纸常年压出来的。墙上有几点暗红色的渍。' },
        { id: 'k9', fact: 'c2', place: 'office', name: '倒放的镇纸',
          desc: '书案上的铜镇纸摆反了——上头刻的字头朝下。{authority}用了几十年，从没摆反过。' },
        { id: 'k2', fact: 'c3', place: 'office', name: '窗上的撬痕',
          desc: '窗框外侧有新的撬痕，可木茬都朝外翻——像是有人从屋里往外撬的。' },
        { id: 'k3', fact: 'm3', place: 'ancestral', name: '压在族谱下的文书',
          desc: '祠堂供桌的族谱底下压着一份文书，上面的字已经洇开了，还认得出一个名字。' },
        { id: 'k4', fact: 'm2', place: 'teahouse', name: '茶馆里的闲话',
          desc: '有人听见镇公所里传出过吵架声，{authority}出来的时候，脸色比天色还难看。' },
        { id: 'k5', fact: 'a3', place: 'clinic', name: '反锁的门',
          desc: '济世堂大夫记得清楚：赶到的时候门是反锁的，是砸开进去的——可屋里的人已经死了。' },
        { id: 'k6', fact: 'c1', place: 'church', name: '没响的钟',
          desc: '教堂的杂役说，那晚的晚祷根本没敲钟。可{murderer}说自己是听着钟声做完祷告的。' },
        { id: 'k7', fact: 'a2', place: 'marginal', name: '窗上的两个影子',
          desc: '入夜后，有人看见镇公所的灯亮着，窗纸上晃过两个影子，一个倒下了。' },
        { id: 'k8', fact: 'm1', place: 'dock', name: '没送出去的账本',
          desc: '码头有人提起，{victim}死前几天说过一句："等我拿到{h1}那本账，看谁还敢装糊涂。"' },
      ],
    },
  };

  /* ------------------------------------------------------------------
     生成真相
     ------------------------------------------------------------------ */

  function generate(rng, world, byId) {
    /* ---- 1. 选死者：权威优先（7 成），新贵次之 ---- */
    const victim = rng() < 0.7 ? byId.authority : byId.nouveau;

    /* ---- 1b. 关系网需要知道死者是谁 → 在这里生成 ---- */
    const relations = Relations.generate(world, byId, victim);

    /* ---- 2. 凶嫌 = 与死者有"旧怨/债务"边的人 ----
       死者是权威 → 苦主与新贵；死者是新贵 → 苦主与权威 */
    const candidates = victim.id === 'authority'
      ? [byId.bitter, byId.nouveau]
      : [byId.bitter, byId.authority];

    /* ---- 3. 凶手与红鲱鱼 ---- */
    const murderer = RNG.pick(rng, candidates);
    const redHerring = candidates.find(p => p !== murderer);

    /* ---- 3b. "案发前当街吵架"发生在凶手与死者之间 ---- */
    const murderEdge = relations.edges.find(e =>
      (e.a === victim.id && e.b === murderer.id) ||
      (e.a === murderer.id && e.b === victim.id));
    if (murderEdge) {
      murderEdge.fresh = true;
      murderEdge.desc += ' 案发前几天，两人在街上当众吵过一架，好多人看见了。';
    }

    /* ---- 4. 剧本：按凶手角色取场景 ---- */
    const sc = SCENARIOS[murderer.id];
    const fill = (t) => t
      .replace(/\{victim\}/g, victim.name)
      .replace(/\{murderer\}/g, murderer.name)
      .replace(/\{authority\}/g, byId.authority.name)
      .replace(/\{nouveau\}/g, byId.nouveau.name)
      .replace(/\{bitter\}/g, byId.bitter.name)
      .replace(/\{marginal\}/g, byId.marginal.name)
      .replace(/\{h1\}/g, world.histories[0].name)
      .replace(/\{h2\}/g, world.histories[1].name)
      .replace(/\{h3\}/g, world.histories[2].name);

    /* ---- 5. 事实注册表：真相的唯一来源 ---- */
    const facts = {};
    for (const id in sc.facts) facts[id] = {
      id,
      text: fill(sc.facts[id]),
      chain: id[0] === 'm' ? 'motive' : (id[0] === 'a' ? 'action' : 'cover'),
    };

    /* ---- 6. 线索 = 事实的投影 ---- */
    const clues = sc.clues.map(c => Object.assign({}, c, {
      desc: fill(c.desc),
      factId: c.fact,
      pointsTo: facts[c.fact],
    }));

    /* ---- 7. 日程：真相由日程保证 ---- */
    const TIMES = World.TIMES;
    const placeName = {};
    world.institutions.forEach(inst => { placeName[inst.id] = inst.name; });

    Object.values(byId).forEach(p => {
      const s = {};
      TIMES.forEach(t => { s[t] = p.home; });
      p.schedule = s;
    });

    // 案发时：死者在现场；凶手"声称"去了别处（可证伪的谎）；目击者真的在附近
    victim.schedule[sc.time] = sc.scene;
    murderer.schedule[sc.time] = sc.claim;               // ← 这是句谎
    byId.marginal.schedule[sc.time] = nearScene(sc.scene); // 真目击
    redHerring.schedule[sc.time] = 'teahouse';             // 可核实的不在场

    /* ---- 8. 所知（knowledge）与立场（stance） ---- */
    const K_ALL = { m1: 2, m2: 2, m3: 2, a1: 2, a2: 2, a3: 2, c1: 2, c2: 2, c3: 2 };
    const K_NONE = {};

    murderer.knowledge = Object.assign({}, K_ALL);
    murderer.stance = { m1: 'lie', m2: 'evade', m3: 'lie', a1: 'lie', a2: 'evade', a3: 'evade', c1: 'lie', c2: 'lie', c3: 'evade' };

    redHerring.knowledge = { m2: 2 };         // 知道自己吵过架
    redHerring.stance = { m2: 'honest' };

    byId.marginal.knowledge = { a2: 2, c1: 1, a1: 1 };  // 看见了，但不敢说
    byId.marginal.stance = { a2: 'refuse', c1: 'evade', a1: 'evade' };

    byId.elder.knowledge = { m1: 2 };         // 历史的活记忆
    byId.elder.stance = { m1: 'honest' };

    byId.kin.knowledge = { m2: 1, c1: 1 };    // 只知道碎片
    byId.kin.stance = { m2: 'honest', c1: 'evade' };

    // 若权威/新贵不是凶手也不是死者，他们各自知道一点
    const leftover = [byId.authority, byId.nouveau].find(p => p !== victim && p !== murderer && p !== redHerring);
    if (leftover) {
      leftover.knowledge = { m1: 1 };
      leftover.stance = { m1: 'evade' };
    }

    /* ---- 9. 破绽映射：每条谎要用哪件证据击穿 ---- */
    const breaks = {
      bitter:   { m1: 'k3', m3: 'k8', a1: 'k1', a2: 'k7', a3: 'k5', c1: 'k7', c2: 'k6', c3: 'k2' },
      nouveau:  { m1: 'k8', m3: 'k3', a1: 'k1', a2: 'k7', a3: 'k5', c1: 'k6', c2: 'k1', c3: 'k2' },
      authority:{ m1: 'k8', m3: 'k3', a1: 'k1', a2: 'k7', a3: 'k5', c1: 'k6', c2: 'k1', c3: 'k2' },
    };

    return {
      victim, murderer, redHerring,
      relations,
      scene: sc.scene,
      sceneName: sc.sceneName,
      time: sc.time,
      method: sc.method,
      claim: sc.claim,
      claimName: sc.claimName,
      facts, clues, breaks: breaks[murderer.id],
      chains: {
        motive: ['m1', 'm2', 'm3'],
        action: ['a1', 'a2', 'a3'],
        cover: ['c1', 'c2', 'c3'],
      },
    };
  }

  function nearScene(sceneId) {
    const near = {
      dock: 'dock',
      mansion: 'ancestral',
      office: 'office',
    };
    return near[sceneId] || sceneId;
  }

  return { generate, SCENARIOS };
})();

window.Truth = Truth;
