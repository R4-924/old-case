/* ==========================================================================
   交互小说引擎 · dialogue.js
   ★ 谎言状态机。玩法核心：收集证据 → 出示 → 击穿谎言。

   立场阶梯：
     honest（说真话）→ evade（回避）→ lie（撒谎）→ refuse（拒绝开口）
   出示对口的证据 → 立场降一级 → 最终全盘托出。

   铁律：一个人不知道的事，永远说不出来（knowledge 是硬约束）。
   ========================================================================== */

const Dialogue = (() => {
  'use strict';

  /* ------------------------------------------------------------------
     话题：玩家能问什么
     ------------------------------------------------------------------ */

  function topicsFor(game, person) {
    const t = [
      { id: 'self', label: '他自己 / 这些年的日子', kind: 'self' },
      { id: 'night', label: '出事那晚', kind: 'facts', facts: ['a1', 'a2', 'a3', 'c1', 'c2', 'c3'] },
      { id: 'victim', label: '关于死者', kind: 'victim' },
      { id: 'grudge', label: '镇上那些旧事', kind: 'facts', facts: ['m1', 'm3'] },
    ];

    // 与他有关的人
    const related = Relations.related(game.truth.relations.edges, person.id)
      .filter(id => id !== 'victim')
      .filter(id => game.byId[id]);
    related.forEach(id => {
      t.push({ id: 'rel:' + id, label: '关于' + game.byId[id].name, kind: 'rel', other: id });
    });

    return t;
  }

  /* ------------------------------------------------------------------
     问话
     ------------------------------------------------------------------ */

  function ask(game, person, topic) {
    // 1. 关于他自己
    if (topic.kind === 'self') {
      return selfTalk(person, game);
    }

    // 2. 关于某个具体的人
    if (topic.kind === 'rel') {
      const other = game.byId[topic.other];
      const edge = Relations.between(game.truth.relations.edges, person.id, topic.other);
      if (!edge) return say(person, '我跟他没什么可说的。');
      let text = `${edge.desc}`;
      // 吵架是"新鲜事"，会先说
      if (edge.fresh) {
        text = `一说起${other.name}，${person.name}的脸色就变了。${edge.desc}`;
      }
      return { speaker: person.name, text, tell: person.tell };
    }

    // 3. 关于死者
    if (topic.kind === 'victim') {
      const v = game.truth.victim;
      if (person.id === 'kin') {
        const broke = person.broken['m2'];
        if (broke) {
          return say(person, `"那晚我们吵了架……他说他要去${game.truth.sceneName}，让我别等门。那是最后一面。"`);
        }
        return say(person, `"别问了……求你别问了。"（${person.tell}）`, 'evade');
      }
      const edge = Relations.between(game.truth.relations.edges, person.id, 'victim');
      return say(person, edge ? edge.desc : `${v.name}这个人，说不好。`);
    }

    // 4. 事实类话题：挑他知道的那件
    if (topic.kind === 'facts') {
      const known = topic.facts.filter(f => (person.knowledge[f] || 0) > 0);
      if (known.length === 0) {
        // ★ 问"那晚在哪"是收集不在场证明的正路——
        //   每个被问到的人都会说一个"声称"的去向（可能是假的）
        if (topic.id === 'night') {
          const claimed = person.schedule[game.truth.time];
          const placeName = placeNameOf(game, claimed);
          return {
            speaker: person.name,
            text: `"那晚？我在${placeName}。问这个做什么。"（${person.tell}）`,
            alibi: { who: person.name, where: claimed, placeName },
          };
        }
        return say(person, `${person.name}摇头："这事我不清楚。"（${person.tell}）`);
      }
      const factId = known[0];
      return answerFact(game, person, factId);
    }

    return say(person, '……');
  }

  /* ------------------------------------------------------------------
     回答一条事实：由 所知 × 立场 决定
     ------------------------------------------------------------------ */

  function answerFact(game, person, factId) {
    const fact = game.truth.facts[factId];
    const k = person.knowledge[factId] || 0;
    let stance = person.broken[factId] ? 'honest' : (person.stance[factId] || 'honest');

    if (stance === 'refuse') {
      return {
        speaker: person.name,
        text: `"……"（${person.tell}）`,
        stance: 'refuse',
        factId,
      };
    }

    if (stance === 'honest') {
      return {
        speaker: person.name,
        text: `${person.name}看了你一会儿，慢慢说："${fact.text}"`,
        stance: 'honest',
        factId,
      };
    }

    if (stance === 'evade') {
      const evasions = [
        `"这事我记不清了。人上了年纪，脑子就钝。"`,
        `"你问这个做什么？跟案子有关系吗？"`,
        `"那天的事……（${person.tell}）……我是真不知道。"`,
      ];
      return {
        speaker: person.name,
        text: RNG.pick(game.rng, evasions),
        stance: 'evade',
        factId,
      };
    }

    // lie：撒谎
    const lies = {
      motive: `"少拿那些陈年旧账来套我。我跟{谁}没仇，你们别听风就是雨。"`,
      action: `"那晚我就在家里，哪儿也没去。家里人能作证。"`,
      cover: `"我不知道你在说什么。话不能乱说。"`,
    };
    const chain = fact.chain;
    const tpl = lies[chain] || lies.motive;
    return {
      speaker: person.name,
      text: tpl.replace('{谁}', game.truth.victim.name) + `（${person.tell}）`,
      stance: 'lie',
      factId,
    };
  }

  /* ------------------------------------------------------------------
     出示证据
     规则（按链施压）：证据属于哪条链，就压垮对方在那条链上的隐瞒。
       优先级：refuse（拒绝开口）→ lie（撒谎）→ evade（回避）
     一次出示压垮一条事实。要全部撬开，就把三条链的证据都亮出来。
     ------------------------------------------------------------------ */

  function present(game, person, clueId) {
    const clue = game.truth.clues.find(c => c.id === clueId);
    if (!clue) return { speaker: '你', text: '手里没有这个东西。' };

    const chain = clue.pointsTo.chain;

    /** 先精确对口：这件证据正好针对此人隐瞒的那条事实 */
    const exact = clue.factId;
    const exactStance = person.stance[exact];
    if ((person.knowledge[exact] || 0) > 0 && !person.broken[exact] &&
        (exactStance === 'lie' || exactStance === 'evade' || exactStance === 'refuse')) {
      const fact = game.truth.facts[exact];
      person.broken[exact] = true;
      person.stance[exact] = 'honest';
      return {
        speaker: person.name,
        text: `${person.name}盯着那东西看了很久，手抖了一下。（${person.tell}）\n"……好。我说。${fact.text}"`,
        brokeLie: true,
        factId: exact,
      };
    }

    /** 再按链兜底：在此链上找此人还在隐瞒的第一条事实 */
    function findUnbroken(priorityStances) {
      for (const stance of priorityStances) {
        for (const fid of Object.keys(person.stance)) {
          const f = game.truth.facts[fid];
          if (!f || f.chain !== chain) continue;
          if (person.stance[fid] === stance && !person.broken[fid] &&
              (person.knowledge[fid] || 0) > 0) {
            return fid;
          }
        }
      }
      return null;
    }

    const factId = findUnbroken(['refuse', 'lie', 'evade']);

    // 1) 压垮一条隐瞒
    if (factId) {
      person.broken[factId] = true;
      person.stance[factId] = 'honest';
      const fact = game.truth.facts[factId];
      return {
        speaker: person.name,
        text: `${person.name}盯着那东西看了很久，手抖了一下。（${person.tell}）\n"……好。我说。${fact.text}"`,
        brokeLie: true,
        factId,
      };
    }

    // 2) 这条链上他没什么好瞒的：对口但本来就说真话
    const knowsClueFact = (person.knowledge[clue.factId] || 0) > 0;
    if (knowsClueFact) {
      const fact = game.truth.facts[clue.factId];
      return {
        speaker: person.name,
        text: `"这个我早就知道。${fact.text}"`,
        brokeLie: false,
        factId: clue.factId,
      };
    }

    // 3) 不对口：反应 + 一点指向
    const near = chain === 'action' ? '案发那晚'
              : chain === 'motive' ? '陈年旧事'
              : '有人想盖住什么';
    return {
      speaker: person.name,
      text: `"你给我看这个做什么？"${person.name}扫了一眼，"……这跟${near}有关？"`,
      brokeLie: false,
      factId: null,
    };
  }

  /* ------------------------------------------------------------------
     关于自己：三件套
     秘密要等"被击穿"或"信任"之后才说
     ------------------------------------------------------------------ */

  function selfTalk(person, game) {
    const opening = [
      `"我这一辈子啊，就图${person.desire}"`,
      `"我最怕的就是${person.fear}。（${person.tell}）"`,
    ];
    let out = `${person.name}${person.phrase}\n` + (game ? RNG.pick(game.rng, opening) : opening[0]);
    if (person.broken['self'] || person.trusted) {
      out += `\n"……罢了，说就说吧。${person.secret}"`;
      person.broken['self'] = true;
    }
    return { speaker: person.name, text: out };
  }

  function say(person, text, stance) {
    return { speaker: person.name, text, stance };
  }

  function placeNameOf(game, placeId) {
    const inst = game.world.institutions.find(i => i.id === placeId);
    if (inst) return inst.name;
    if (placeId === 'marginal') return '镇口的破屋';
    return placeId;
  }

  return { ask, present, topicsFor, placeNameOf };
})();

window.Dialogue = Dialogue;
