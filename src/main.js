/* ==========================================================================
   交互小说引擎 · main.js
   控制器：把 Game / Actions / UI 接起来。
   所有入口（按钮、指令）都汇到 execute()。
   ========================================================================== */

(() => {
  'use strict';

  let game = null;

  const HELP = [
    '你可以：',
    '· 去 [地点]——移动（消耗时间）',
    '· 翻找——在当前地点找线索',
    '· 问 [人物] 关于 [话题]——打听消息',
    '· 出示 [线索] 给 [人物]——用证据撬开嘴',
    '· 笔记——查看收集到的一切',
    '· 休息——让时间过去',
    '· 指认 [人物]——说出你的推断（错了有代价）',
    '· 话题：他自己 / 出事那晚 / 关于死者 / 镇上那些旧事 / 关于某人',
  ].join('\n');

  /* ------------------------------------------------------------------
     开局
     ------------------------------------------------------------------ */

  function newGame(seed) {
    game = Game.newGame(seed);
    UI.newGameUI(game);
    renderChoices();
  }

  /* ------------------------------------------------------------------
     行动分发
     ------------------------------------------------------------------ */

  function execute(parsed) {
    if (!game) return;
    if (!parsed) return;

    switch (parsed.type) {
      case 'help':
        UI.add('system', HELP);
        break;

      case 'error':
        UI.add('system', parsed.text);
        break;

      case 'go': {
        const r = Game.go(game, parsed.placeId);
        UI.add('narration', r.text);
        UI.refreshNotebook();
        break;
      }

      case 'search': {
        const r = Game.search(game);
        UI.add(r.found ? 'clue' : 'narration', r.text);
        UI.refreshNotebook();
        break;
      }

      case 'ask': {
        const r = Game.ask(game, parsed.person.id, parsed.topicId);
        if (r.ok) {
          UI.add('dialogue', r.text);
          UI.refreshNotebook();
        } else {
          UI.add('system', r.text);
        }
        break;
      }

      case 'topics': {
        UI.add('system', parsed.text);
        renderTopics(parsed.person);
        return;   // 话题按钮接管，不回到主选项
      }

      case 'present': {
        const r = Game.present(game, parsed.person.id, parsed.clueId);
        if (r.ok) {
          UI.add(r.brokeLie ? 'broke' : 'dialogue', r.text);
          UI.refreshNotebook();
        } else {
          UI.add('system', r.text);
        }
        break;
      }

      case 'accuse': {
        const r = Game.accuse(game, parsed.person.id);
        UI.add(r.correct ? 'broke' : 'narration', r.text);
        UI.refreshNotebook();
        if (game.over) {
          UI.clearChoices();
          setTimeout(() => UI.showReveal(game.won), 1800);
          return;
        }
        break;
      }

      case 'rest': {
        Game.advance(game, 1);
        UI.add('narration', `你站了一会儿，让时间慢慢过去。现在是${Game.timeLabel(game)}。`);
        UI.refreshNotebook();
        break;
      }

      case 'notebook': {
        UI.refreshNotebook();
        UI.add('system', '（笔记本在右侧。也可以随时点开。）');
        break;
      }

      case 'clueDetail': {
        UI.add('clue', `【${parsed.clue.name}】\n${parsed.clue.desc}`);
        break;
      }

      default:
        UI.add('system', '（没听懂。输入"帮助"看看能做什么。）');
    }

    renderChoices();
  }

  /* ------------------------------------------------------------------
     选项按钮
     ------------------------------------------------------------------ */

  function renderChoices() {
    if (!game || game.over) return;

    const list = [];
    const here = Game.peopleHere(game, game.player.place);

    // 1. 眼前的人
    here.forEach(p => {
      list.push({ label: `问 ${p.name}（${p.job}）`, run: () => renderTopics(p) });
    });

    // 2. 翻找（如果此地还有线索）
    const pending = game.truth.clues.filter(c =>
      c.place === game.player.place && !game.player.foundIds[c.id]);
    if (pending.length) list.push({ label: '翻找这里', run: () => execute({ type: 'search' }) });

    // 3. 出示证据（手里有线索才显示）
    if (game.player.clues.length) {
      list.push({ label: '出示证据……', run: pickPersonToPresent });
    }

    // 4. 去别处
    list.push({ label: '去别处……', run: pickPlace });

    // 5. 其他
    list.push({ label: '休息一会', run: () => execute({ type: 'rest' }) });
    list.push({ label: '笔记', run: () => execute({ type: 'notebook' }) });
    list.push({ label: '帮助', run: () => execute({ type: 'help' }) });

    // 6. 指认（永远在最后，红色）
    list.push({ label: '指认凶手……', run: pickAccuse, danger: true });

    UI.showChoices(list);
  }

  /** 问某人 → 话题列表 */
  function renderTopics(person) {
    const topics = Dialogue.topicsFor(game, person);
    const list = topics.map(t => ({
      label: t.label,
      run: () => {
        const r = Game.ask(game, person.id, t.id);
        if (r.ok) {
          UI.add('dialogue', r.text);
          UI.refreshNotebook();
        }
        renderChoices();
      },
    }));
    list.push({ label: '（不问了）', run: renderChoices });
    UI.showChoices(list);
  }

  /** 出示证据：先选人，再选线索 */
  function pickPersonToPresent() {
    const list = game.people.map(p => ({
      label: `${p.name}（${p.job}）`,
      run: () => pickClueToPresent(p),
    }));
    list.push({ label: '（算了）', run: renderChoices });
    UI.showChoices(list);
  }

  function pickClueToPresent(person) {
    const list = game.player.clues.map(c => ({
      label: `出示【${c.name}】`,
      run: () => execute({ type: 'present', person, clueId: c.id }),
    }));
    list.push({ label: '（算了）', run: renderChoices });
    UI.showChoices(list);
  }

  /** 指认：选一个人 */
  function pickAccuse() {
    const list = game.people.map(p => ({
      label: `指认 ${p.name}（${p.job}）`,
      run: () => execute({ type: 'accuse', person: p }),
      danger: true,
    }));
    list.push({ label: '（再想想）', run: renderChoices });
    UI.showChoices(list);
  }

  /** 去别处：选地点 */
  function pickPlace() {
    const list = Game.places(game).map(p => ({
      label: `去 ${p.name}`,
      run: () => execute({ type: 'go', placeId: p.id }),
    }));
    list.push({ label: '（先不去了）', run: renderChoices });
    UI.showChoices(list);
  }

  /* ------------------------------------------------------------------
     指令输入
     ------------------------------------------------------------------ */

  function onCommand(text) {
    const parsed = Actions.parse(game, text);
    if (parsed && parsed.type !== 'error') {
      UI.add('system', '＞ ' + text.trim());
    }
    execute(parsed);
  }

  /* ------------------------------------------------------------------
     启动
     ------------------------------------------------------------------ */

  function boot() {
    UI.init();

    document.getElementById('cmd-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('cmd-input');
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      onCommand(v);
    });

    document.getElementById('again-btn').addEventListener('click', () => newGame());

    newGame();
  }

  window.LittleRoom = window.LittleRoom || {};
  window.LittleRoom.newGame = newGame;
  window.LittleRoom.execute = execute;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
