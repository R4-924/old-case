/* ==========================================================================
   交互小说引擎 · ui.js
   复古纸质 / 打字机。
   左栏：故事流（打字机逐字 + 可点击跳过）
   右栏：笔记本（人物 / 线索 / 不在场证明 / 传闻）
   底部：指令输入框
   ========================================================================== */

const UI = (() => {
  'use strict';

  const el = {};
  let game = null;
  let typing = null;

  const $ = (sel) => document.querySelector(sel);

  function init() {
    el.log = $('#story-log');
    el.choices = $('#choices');
    el.input = $('#cmd-input');
    el.cmdForm = $('#cmd-form');
    el.note = $('#notebook');
    el.head = $('#head');
    el.reveal = $('#reveal');
    el.day = $('#day-label');
  }

  /* ------------------------------------------------------------------
     开场
     ------------------------------------------------------------------ */

  function intro(g) {
    const t = g.truth;
    const w = g.world;
    add('narration', [
      `${w.town.name}。${w.town.flavor}`,
      `你是一个路过的调查人。昨天清晨，有人从${t.sceneName}旁的水边捞起了${t.victim.name}——${t.victim.ageText}，${t.victim.label}，本镇的${t.victim.job}。`,
      `官府的说法是意外。但镇上传言四起。你决定在天黑之前，把这件事弄个明白。`,
      `（输入"帮助"查看玩法）`,
    ].join('\n'));
  }

  /* ------------------------------------------------------------------
     打字机
     ------------------------------------------------------------------ */

  function add(kind, text, opts = {}) {
    const entry = document.createElement('div');
    entry.className = 'entry entry-' + kind;
    el.log.appendChild(entry);
    el.log.scrollTop = el.log.scrollHeight;

    type(entry, text, opts);
    return entry;
  }

  function type(entry, text, opts = {}) {
    if (typing) { skipTyping(); }
    let i = 0;
    const full = text;
    entry.textContent = '';
    entry.classList.add('typing');
    typing = { entry, timer: null };

    function step() {
      i += 1 + Math.floor(Math.random() * 2);
      entry.textContent = full.slice(0, i);
      if (i < full.length) {
        typing.timer = setTimeout(step, opts.speed || 14);
      } else {
        entry.classList.remove('typing');
        typing = null;
        if (opts.done) opts.done();
      }
      el.log.scrollTop = el.log.scrollHeight;
    }
    step();
  }

  function skipTyping() {
    if (!typing) return;
    clearTimeout(typing.timer);
    typing.entry.textContent = typing.entry.dataset.full || typing.entry.textContent;
    typing.entry.classList.remove('typing');
    typing = null;
  }

  /* ------------------------------------------------------------------
     选择按钮
     ------------------------------------------------------------------ */

  function showChoices(list) {
    el.choices.innerHTML = '';
    list.forEach(c => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = c.label;
      b.addEventListener('click', () => {
        el.choices.innerHTML = '';
        c.run();
      });
      el.choices.appendChild(b);
    });
  }

  function clearChoices() {
    el.choices.innerHTML = '';
  }

  /* ------------------------------------------------------------------
     笔记本
     ------------------------------------------------------------------ */

  function refreshNotebook() {
    const p = game.player;
    const t = game.truth;

    if (el.day) el.day.textContent = Game.timeLabel(game);

    const placeNow = Game.place(game, p.place);

    const alibiRows = Object.keys(p.alibis).map(name => {
      const a = p.alibis[name];
      return `<tr><td>${name}</td><td>${a.placeName}</td><td class="dim">声称</td></tr>`;
    }).join('');

    const peopleRows = game.people.map(x => {
      const isVictim = x === t.victim;
      const met = p.met[x.id] ? '' : ' dim';
      const broke = Object.keys(x.broken).length > 0 ? '（已松动）' : '';
      return `<div class="note-person${met}">
        <b>${x.name}</b> · ${x.ageText} · ${isVictim ? '已死' : x.job}
        ${isVictim ? '<span class="dead">（死者）</span>' : ''}
        ${broke}
      </div>`;
    }).join('');

    const clueRows = p.clues.map(c =>
      `<div class="note-clue"><b>${c.name}</b><br>${c.desc.slice(0, 60)}${c.desc.length > 60 ? '…' : ''}</div>`
    ).join('');

    el.note.innerHTML = `
      <section class="note-block">
        <h3>时 间</h3>
        <div class="note-time">${Game.timeLabel(game)}</div>
        <div class="dim">你在：${placeNow ? placeNow.name : '……'}</div>
      </section>

      <section class="note-block">
        <h3>人 物</h3>
        ${peopleRows || '<div class="dim">还没有人</div>'}
      </section>

      <section class="note-block">
        <h3>线 索（${p.clues.length}）</h3>
        ${clueRows || '<div class="dim">还没有线索</div>'}
      </section>

      <section class="note-block">
        <h3>不在场证明</h3>
        ${alibiRows ? `<table class="alibi"><tbody>${alibiRows}</tbody></table>` : '<div class="dim">去问问每个人"出事那晚"在哪</div>'}
      </section>

      <section class="note-block">
        <h3>镇上传闻</h3>
        ${game.world.legends.map(l => `<div class="note-legend">"${l.text}"</div>`).join('')}
      </section>
    `;
  }

  /* ------------------------------------------------------------------
     揭示屏
     ------------------------------------------------------------------ */

  function showReveal(won) {
    const t = game.truth;
    const p = game.player;
    const found = Object.keys(p.foundIds).length;
    const total = t.clues.length;
    const missedClues = t.clues.filter(c => !p.foundIds[c.id]);
    const unbroken = [];
    game.people.forEach(x => {
      Object.keys(x.stance).forEach(f => {
        if ((x.stance[f] === 'lie' || x.stance[f] === 'refuse') && !x.broken[f]) {
          unbroken.push(`${x.name} 关于「${t.facts[f].text.slice(0, 18)}…」的谎，你没有戳穿`);
        }
      });
    });
    const unmet = game.people.filter(x => !p.met[x.id]).map(x => x.name);

    const chains = ['motive', 'action', 'cover'].map(chainName => {
      const names = { motive: '动机链', action: '行动链', cover: '掩盖链' };
      const facts = t.chains[chainName].map(f => t.facts[f].text);
      return `<div class="chain">
        <h4>${names[chainName]}</h4>
        ${facts.map(f => `<div class="chain-fact">· ${f}</div>`).join('')}
      </div>`;
    }).join('');

    const day = Game.dayOf(game);
    el.reveal.innerHTML = `
      <div class="reveal-card">
        <div class="reveal-title">${won ? '案子破了' : '案子悬着'}</div>

        <div class="reveal-truth">
          凶手是 <b class="murderer">${t.murderer.name}</b>。
          ${t.method}，地点在${t.sceneName}，时间在${t.time}。
        </div>

        ${chains}

        <h3 class="reveal-h">你错过了什么</h3>
        <div class="reveal-miss">
          ${missedClues.map(c => `<div>· 线索【${c.name}】——${c.desc.slice(0, 50)}…</div>`).join('')}
          ${unbroken.map(u => `<div>· ${u}</div>`).join('')}
          ${unmet.length ? `<div>· 你始终没有去见过：${unmet.join('、')}</div>` : ''}
        </div>

        <div class="reveal-score">
          第 ${day} 天 · 找到线索 ${found}/${total} ·
          错误指认 ${p.accused} 次
        </div>

        <div class="reveal-seed">本局种子：${game.seed}</div>
        <button id="again" class="reveal-btn">再开一局</button>
      </div>
    `;
    el.reveal.style.display = 'flex';
    $('#again').addEventListener('click', () => {
      el.reveal.style.display = 'none';
      window.LittleRoom && LittleRoom.newGame && LittleRoom.newGame();
    });
  }

  function hideReveal() {
    el.reveal.style.display = 'none';
  }

  function newGameUI(g) {
    game = g;
    el.log.innerHTML = '';
    el.note.innerHTML = '';
    clearChoices();
    hideReveal();
    intro(g);
    refreshNotebook();
  }

  return {
    init, intro, add, type, showChoices, clearChoices,
    refreshNotebook, showReveal, hideReveal, newGameUI,
    get game() { return game; },
  };
})();

window.UI = UI;
