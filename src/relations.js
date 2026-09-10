/* ==========================================================================
   交互小说引擎 · relations.js
   关系网。铁律：
     1. 无孤立者——每个人都至少连着一个人；
     2. 无单向的恨——每条仇恨都配着理由（关联到具体历史层）；
     3. 死者必须是"关系枢纽"——他的死会牵动整个网。
   ========================================================================== */

const Relations = (() => {
  'use strict';

  /**
   * @param {object} world  World.generate() 的结果
   * @param {object} byId   { authority: person, elder: person, ... }
   * @param {object} victim 受害者本人（truth.js 选出后传入）
   */
  function generate(world, byId, victim) {
    const edges = [];
    const V = victim.name;

    /** 帮凶：把关系里的占位符换掉 */
    const fill = (t) => t
      .replace(/\{V\}/g, V)
      .replace(/\{kin\}/g, byId.kin.name)
      .replace(/\{elder\}/g, byId.elder.name)
      .replace(/\{nouveau\}/g, byId.nouveau.name)
      .replace(/\{bitter\}/g, byId.bitter.name)
      .replace(/\{marginal\}/g, byId.marginal.name)
      .replace(/\{authority\}/g, byId.authority.name)
      .replace(/\{rich\}/g, otherRich === 'nouveau' ? byId.nouveau.name : byId.authority.name)
      .replace(/\{h1\}/g, world.histories[0].name)
      .replace(/\{h2\}/g, world.histories[1].name)
      .replace(/\{h3\}/g, world.histories[2].name);
    /* ---------------- 死者枢纽：六条边 ---------------- */

    // 债务边指向"另一个富人"：死者是权威就连新贵，死者是新贵就连权威
    const otherRich = victim.id === 'authority' ? 'nouveau' : 'authority';

    const hubEdges = [
      {
        a: victim.id, b: 'kin',
        type: '姻亲',
        depth: 3,
        desc: '{kin}与{V}做了半辈子夫妻，人前从不多话，人后谁也不懂谁。',
      },
      {
        a: victim.id, b: 'elder',
        type: '旧识',
        depth: 2,
        desc: '{elder}年轻时和{V}一起在镇上做事，后来因为{h1}分道扬镳。',
      },
      {
        a: victim.id, b: otherRich,
        type: '债务',
        depth: 3,
        desc: '{rich}发家的第一笔钱，是{V}给牵的线。这笔人情，{rich}背了半辈子。',
      },
      {
        a: victim.id, b: 'bitter',
        type: '旧怨',
        depth: 3,
        desc: '{bitter}家当年在{h1}和{h2}里两次吃了大亏，而{V}两次都站在对面。',
      },
      {
        a: victim.id, b: 'marginal',
        type: '雇佣',
        depth: 1,
        desc: '{marginal}在镇上的差事，是{V}当年随口一句话给安排的。',
      },
    ];

    // 与死者有"旧怨/债务"边的两人 = 凶嫌池（真凶与红鲱鱼由 truth.js 决定）
    edges.push(...hubEdges.map(e => Object.assign({ a: victim.id }, e)));

    /* ---------------- 环上其余的人，两两之间 ---------------- */

    const ring = [
      { a: 'elder', b: 'bitter', type: '师徒', depth: 2,
        desc: '{bitter}小时候跟着{elder}学过几年手艺，后来家里败了，才去做了苦力。' },
      { a: 'elder', b: 'nouveau', type: '仇恨', depth: 2,
        desc: '{elder}亲眼见过{h1}那晚的事，从此看{nouveau}的眼神就没好过。' },
      { a: 'nouveau', b: 'kin', type: '交易', depth: 2,
        desc: '{nouveau}惦记着{V}家的一块地，托{kin}递过几次话，都没成。' },
      { a: 'nouveau', b: 'marginal', type: '旧情', depth: 2,
        desc: '没人知道，{nouveau}和{marginal}是同一年从外地来的，当年坐的是同一条船。' },
      { a: 'kin', b: 'elder', type: '信托', depth: 2,
        desc: '{V}生前有话，说将来若出了事，让{elder}作个见证。{elder}一直没告诉{kin}。' },
      { a: 'bitter', b: 'marginal', type: '患难', depth: 2,
        desc: '{bitter}最穷的那几年，{marginal}分过自己的一半饭给他。' },
    ];

    edges.push(...ring.map(e => Object.assign({}, e)));

    /* ---------------- 校验：无孤立者 ---------------- */
    const touched = new Set([victim.id]);
    edges.forEach(e => { touched.add(e.a); touched.add(e.b); });
    const orphans = Object.keys(byId).filter(id => !touched.has(id));
    if (orphans.length) {
      // 兜底：把孤立者挂到 kin 上（至少是"同镇旧识"）
      orphans.forEach(id => {
        edges.push({
          a: 'kin', b: id, type: '邻里', depth: 1,
          desc: '{kin}和' + byId[id].name + '是多年的邻居，抬头不见低头见。',
        });
      });
    }

    return {
      edges: edges.map(e => Object.assign({}, e, {
        a: e.a === victim.id ? victim.id : e.a,
        desc: fill(e.desc),
      })),
      /** 与死者有仇的边（动机池） */
      grudges: edges.filter(e =>
        (e.type === '旧怨' || e.type === '债务' || e.type === '仇恨') &&
        (e.a === victim.id || e.b === victim.id)
      ),
    };
  }

  /** 找两人之间的边 */
  function between(edges, x, y) {
    return edges.find(e =>
      (e.a === x && e.b === y) || (e.a === y && e.b === x)
    );
  }

  /** 与某人有关系的人 */
  function related(edges, id) {
    const out = new Set();
    edges.forEach(e => {
      if (e.a === id) out.add(e.b);
      if (e.b === id) out.add(e.a);
    });
    out.delete(id);
    return [...out];
  }

  return { generate, between, related };
})();

window.Relations = Relations;
