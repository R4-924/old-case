/* ==========================================================================
   交互小说引擎 · actions.js
   指令解析器（打字模式）。宽松匹配：
     "去码头"、"問 老板 關於 那晚"、"给老陈看那封信" 都能懂。
   规则：关键词 + 名字包含匹配；找不到时返回 null，UI 给出提示。
   ========================================================================== */

const Actions = (() => {
  'use strict';

  /** 清洗：去标点、去空格、转小写（英文部分） */
  function clean(input) {
    return String(input || '')
      .replace(/[，。、！？；：""''（）\s·…—,.!?;:'"()]/g, '')
      .toLowerCase();
  }

  function findPerson(game, text) {
    const c = clean(text);
    return game.people.find(p =>
      c.includes(clean(p.name)) ||
      c.includes(clean(p.given)) ||
      (p.label && c.includes(clean(p.label)))
    );
  }

  function findPlace(game, text) {
    const c = clean(text);
    return Game.places(game).find(p => c.includes(clean(p.name)));
  }

  function findClue(game, text) {
    const c = clean(text);
    return game.player.clues.find(cl => c.includes(clean(cl.name)));
  }

  function parse(game, input) {
    const c = clean(input);
    if (!c) return null;

    /* ---- 帮助 ---- */
    if (/^(帮助|help|说明|怎么玩)/.test(c)) {
      return { type: 'help' };
    }

    /* ---- 指认 ---- */
    const accuseMatch = c.match(/^(指认|指控|凶手是|我指认|我指控)(.+)$/);
    if (accuseMatch) {
      const p = findPerson(game, accuseMatch[2]);
      if (p) return { type: 'accuse', person: p };
      return { type: 'error', text: '指认谁？我没听懂这个名字。' };
    }

    /* ---- 移动 ---- */
    const goMatch = c.match(/^(去|前往|走到|到|回)(.+)$/);
    if (goMatch && !/^回到/.test(c)) {
      const p = findPlace(game, goMatch[2]);
      if (p) return { type: 'go', placeId: p.id };
      return { type: 'error', text: '镇子里没有这个地方。' };
    }

    /* ---- 出示证据 ---- */
    const showMatch = c.match(/^(出示|拿出|给|让他看|给她看|给他看)(.+)$/);
    if (showMatch) {
      const rest = showMatch[2];
      const person = findPerson(game, rest);
      const clue = findClue(game, rest);
      // 两种语序：出示X给Y / 给Y看X —— 用"给"字切
      const geIdx = rest.indexOf('给');
      if (geIdx > 0) {
        const a = findClue(game, rest.slice(0, geIdx));
        const b = findPerson(game, rest.slice(geIdx + 1));
        if (a && b) return { type: 'present', person: b, clueId: a.id };
      }
      if (person && clue) return { type: 'present', person, clueId: clue.id };
      if (clue && !person) return { type: 'error', text: '给谁看？' };
      if (person && !clue) return { type: 'error', text: '你还没有这个东西（或名字没打对）。' };
      return { type: 'error', text: '出示什么？给谁？' };
    }

    /* ---- 问话 ---- */
    if (/^问/.test(c)) {
      const rest = c.replace(/^问|询问|问一下|问问/, '');
      const person = findPerson(game, rest);
      if (!person) return { type: 'error', text: '问谁？我没听懂这个名字。' };
      // 关于什么
      const about = rest.match(/关于(.+)$/);
      const topics = Dialogue.topicsFor(game, person);
      if (about) {
        const kw = clean(about[1]);
        const topic = topics.find(t =>
          kw.includes(clean(t.label)) || clean(t.label).includes(kw) ||
          (t.kind === 'rel' && kw.includes(clean(game.byId[t.other].name)))
        );
        if (topic) return { type: 'ask', person, topicId: topic.id };
        return { type: 'topics', person, text: `想问他什么？可以问：${topics.map(t => t.label).join(' / ')}` };
      }
      // 没指定话题 → 列出话题
      return { type: 'topics', person, text: `想问他什么？可以问：${topics.map(t => t.label).join(' / ')}` };
    }

    /* ---- 翻找 / 查看 ---- */
    if (/^(翻找|搜索|找找|搜|翻)/.test(c)) {
      return { type: 'search' };
    }
    if (/^(看|查看|观察)(.+)$/.test(c)) {
      const rest = c.replace(/^(看|查看|观察)/, '');
      const clue = findClue(game, rest);
      if (clue) return { type: 'clueDetail', clue };
      const place = findPlace(game, rest);
      if (place) return { type: 'go', placeId: place.id };
      return { type: 'search' };
    }

    /* ---- 笔记 ---- */
    if (/^(笔记|线索|记录|手记)/.test(c)) {
      return { type: 'notebook' };
    }

    /* ---- 休息 ---- */
    if (/^(休息|等|等待|待着)/.test(c)) {
      return { type: 'rest' };
    }

    return { type: 'error', text: '没听懂。试试：去 码头 / 翻找 / 问 某人 关于 出事那晚 / 出示 某物 给 某人 / 笔记 / 指认 某人' };
  }

  return { parse, clean, findPerson, findPlace, findClue };
})();

window.Actions = Actions;
