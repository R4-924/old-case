/* ==========================================================================
   交互小说引擎 · game.js
   状态机：开局、移动、翻找、问话、出示、指认、推进时间。

   时间：6 时段 × 每天。移动花 2 步，其他行动花 1 步；
   2 步 = 1 个时段。入夜过后是第二天清晨。
   ========================================================================== */

const Game = (() => {
  'use strict';

  const TIME_ORDER = ['清晨', '上午', '正午', '午后', '黄昏', '入夜'];
  const STEPS_PER_SLOT = 2;

  /* ------------------------------------------------------------------
     开局
     ------------------------------------------------------------------ */

  function newGame(seed) {
    seed = seed || RNG.randomSeed();
    const rng = RNG.makeRng(seed);

    Names.reset();
    const world = World.generate(rng);
    const { people, roleById: byId } = People.generate(rng, world);
    const truth = Truth.generate(rng, world, byId);

    // 人名已定，把三件套里的占位符补上
    People.resolveTemplates(world, people, {
      victim: truth.victim,
      murderer: truth.murderer,
      winnerFamily: world.fateFamilies.b,
      loserFamily: world.fateFamilies.a,
      sceneName: truth.sceneName,
      histories: world.histories,
    });

    const player = {
      place: 'dock',
      step: 0,                       // 步数，每 2 步一个时段
      clues: [],                     // 已找到的线索（含描述）
      foundIds: {},                  // clueId → true
      alibis: {},                    // personName → { where, placeName }
      met: {},                       // personId → true
      accused: 0,                    // 错误指认次数
    };

    return {
      seed, rng, world, people, byId, truth, player,
      over: false, won: false, solvedBy: null,
      log: [],
    };
  }

  /* ------------------------------------------------------------------
     地点列表：抽到的机构 + 剧本场景 + 人物的家
     ------------------------------------------------------------------ */

  function places(game) {
    const list = game.world.institutions.map(i => ({
      id: i.id, name: i.name, flavor: i.flavor,
    }));

    const ensure = (id, name, flavor) => {
      if (!list.find(p => p.id === id)) list.push({ id, name, flavor });
    };

    // 案发现场必须在
    ensure(game.truth.scene, game.truth.sceneName,
      '案发现场。这里的一切都还保持着那晚之后的样子。');

    // 人物常驻的地方
    Object.values(game.byId).forEach(p => {
      const inst = game.world.institutions.find(i => i.id === p.home);
      if (inst) ensure(p.home, inst.name, inst.flavor);
    });
    ensure('marginal', '镇口的破屋', '边缘人的栖身处，门板永远半掩着。');

    // ★ 每条线索所在的地点都必须可达，否则线索永远找不到
    game.truth.clues.forEach(c => {
      if (game.byId[c.place]) return;             // 人物手里的线索不在这里
      if (list.find(p => p.id === c.place)) return;
      const inst = game.world.institutions.find(i => i.id === c.place);
      if (inst) ensure(c.place, inst.name, inst.flavor);
      else ensure(c.place, '一处角落', '……');
    });

    return list;
  }

  function place(game, id) {
    return places(game).find(p => p.id === id);
  }

  /* ------------------------------------------------------------------
     时间
     ------------------------------------------------------------------ */

  function slot(game) {
    const idx = Math.floor(game.player.step / STEPS_PER_SLOT) % TIME_ORDER.length;
    return { time: TIME_ORDER[idx], index: idx };
  }

  /** 天数直接由步数推导，不增量累加——从根上避免跨天 bug */
  function dayOf(game) {
    return 1 + Math.floor(game.player.step / (STEPS_PER_SLOT * TIME_ORDER.length));
  }

  function timeLabel(game) {
    return '第 ' + dayOf(game) + ' 天 · ' + slot(game).time;
  }

  function advance(game, steps) {
    game.player.step += steps;
    return slot(game);
  }

  /** 谁是此刻在这个地点的人 */
  function peopleHere(game, placeId) {
    const s = slot(game);
    return game.people.filter(p => p.schedule[s.time] === placeId);
  }

  /* ------------------------------------------------------------------
     行动
     ------------------------------------------------------------------ */

  function go(game, placeId) {
    if (!place(game, placeId)) return { ok: false, text: '没有这个地方。' };
    game.player.place = placeId;
    advance(game, 2);
    const p = place(game, placeId);
    return {
      ok: true,
      text: `你来到${p.name}。${p.flavor}`,
      place: placeId,
      here: peopleHere(game, placeId),
    };
  }

  /** 翻找当前地点 */
  function search(game) {
    advance(game, 1);
    const here = game.player.place;

    // 此地的线索，还没找到的
    // 注意：place 是人物 id 的线索不能靠翻找得到，要撬开那个人
    const pending = game.truth.clues.filter(c =>
      c.place === here && !game.byId[c.place] && !game.player.foundIds[c.id]);

    if (pending.length) {
      const clue = RNG.pick(game.rng, pending);
      game.player.foundIds[clue.id] = true;
      game.player.clues.push(clue);
      return {
        ok: true,
        found: clue,
        text: `你仔细翻找……发现了【${clue.name}】。\n${clue.desc}`,
      };
    }

    // 没线索了：看谁在
    const herePeople = peopleHere(game, here);
    if (herePeople.length) {
      return {
        ok: true,
        found: null,
        text: `这里已经没什么可翻的了。${herePeople.map(p => p.name).join('、')}在这附近。`,
        here: herePeople,
      };
    }

    return { ok: true, found: null, text: '这里没有更多值得注意的东西了。' };
  }

  /** 问话 */
  function ask(game, personId, topicId) {
    advance(game, 1);
    const person = game.byId[personId];
    if (!person) return { ok: false, text: '没有这个人。' };
    game.player.met[personId] = true;

    const topics = Dialogue.topicsFor(game, person);
    const topic = topics.find(t => t.id === topicId) || topics[0];

    const r = Dialogue.ask(game, person, topic);

    // ★ 只要是问"出事那晚"，就把对方的声称记进不在场证明表——
    //   哪怕是谎话也要记。玩家之后要自己去核实哪条是假的。
    if (topicId === 'night') {
      const claimed = person.schedule[game.truth.time];
      game.player.alibis[person.name] = {
        where: claimed,
        placeName: Dialogue.placeNameOf(game, claimed),
      };
    }
    if (r.alibi) game.player.alibis[person.name] = r.alibi;

    return { ok: true, person, topic, ...r };
  }

  /** 出示证据 */
  function present(game, personId, clueId) {
    advance(game, 1);
    const person = game.byId[personId];
    if (!person) return { ok: false, text: '没有这个人。' };
    const clue = game.truth.clues.find(c => c.id === clueId);
    if (!clue) return { ok: false, text: '手里没有这个东西。' };
    if (!game.player.foundIds[clueId]) {
      return { ok: false, text: '你还没有找到这件东西。' };
    }

    const r = Dialogue.present(game, person, clueId);

    // 撬开了一个人 → 他藏着的线索自动到手
    if (r.brokeLie && r.factId) {
      const held = game.truth.clues.filter(c =>
        c.place === person.id && !game.player.foundIds[c.id]);
      if (held.length) {
        held.forEach(c => {
          game.player.foundIds[c.id] = true;
          game.player.clues.push(c);
        });
        r.text += `\n（${person.name}把藏着的东西交给了你：${held.map(c => '【' + c.name + '】').join('、')}）`;
      }

      // ★ 目击者开口 → 他的证词成为一件正式证据，可以拿去对峙凶手
      if (person.id === 'marginal' && r.factId === 'a2' &&
          !game.player.foundIds['witness']) {
        game.player.foundIds['witness'] = true;
        game.player.clues.push({
          id: 'witness',
          name: '目击者的证词',
          desc: game.truth.facts.a2.text,
          factId: 'a2',
          pointsTo: game.truth.facts.a2,
        });
        r.text += `\n（你得到证据：【目击者的证词】）`;
      }
    }

    return { ok: true, person, clue, ...r };
  }

  /** 指认 */
  function accuse(game, personId) {
    advance(game, 1);
    const person = game.byId[personId];
    if (!person) return { ok: false, text: '没有这个人。' };

    if (person === game.truth.murderer) {
      game.over = true;
      game.won = true;
      return {
        ok: true,
        correct: true,
        text: `你看着${person.name}的眼睛，一字一句地说出了你的推断。\n${person.name}僵在原地，很久，很久。\n"……是。是我做的。"`,
      };
    }

    // 错误指认：对方拿出不在场证明
    game.player.accused++;
    const claimed = person.schedule[game.truth.time];
    const placeName = Dialogue.placeNameOf(game, claimed);
    let text = `${person.name}愣住了："你疯了。那晚我在${placeName}，一晚上都有人看着。"`;

    // 红鲱鱼有硬邦邦的不在场证明
    if (person === game.truth.redHerring) {
      text = `${person.name}的脸色先是白，然后涨红："你说什么？！那晚我在${placeName}，茶馆里十几个人都能作证。你尽管去问。"\n（你意识到，这个人的不在场证明是实打实的。）`;
    }

    return { ok: true, correct: false, text };
  }

  /* ------------------------------------------------------------------
     查询
     ------------------------------------------------------------------ */

  function clueById(game, id) {
    return game.truth.clues.find(c => c.id === id);
  }

  function hasClue(game, id) {
    return !!game.player.foundIds[id];
  }

  /** 所有"已被击穿"的谎言（揭示屏用） */
  function brokenFacts(game) {
    const out = [];
    game.people.forEach(p => {
      Object.keys(p.broken).forEach(f => {
        if (p.broken[f] && game.truth.facts[f]) out.push({ who: p.name, fact: game.truth.facts[f] });
      });
    });
    return out;
  }

  return {
    newGame, places, place, slot, timeLabel, dayOf, advance,
    peopleHere, go, search, ask, present, accuse,
    clueById, hasClue, brokenFacts,
    TIME_ORDER,
  };
})();

window.Game = Game;
