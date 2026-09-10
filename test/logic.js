/* ==========================================================================
   交互小说引擎 · 逻辑测试
   ★ 这是"严谨"的证明，不是走过场：

   1. 事实完整性：每条线索都指向一个真实存在的事实节点
   2. 不在场证明：凶手的案发时段是句谎；红鲱鱼的是可核实的真话
   3. 关系网：无孤立者
   4. 知情约束：一个人不知道的事，永远不会说（knowledge 是硬约束）
   5. 构造性可解：模拟一个"完美玩家"，从零走到破案——必须走得通
   6. 错误指认：指认红鲱鱼必须失败，并给出可核实的反证
   7. 模糊测试：300 个种子，核心不变量每个都必须成立

   跑法：node test\logic.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

/* ---------------- 无 DOM 环境 ---------------- */

const sandbox = {
  console,
  Date, Math, JSON, Number, String, Object, Array, Set, parseInt, parseFloat, isNaN,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = [
  'rng.js', 'names.js', 'world.js', 'people.js',
  'relations.js', 'truth.js', 'dialogue.js', 'game.js', 'actions.js',
];
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
}

const { RNG, Names, World, People, Relations, Truth, Dialogue, Game, Actions } = sandbox;

/* ---------------- 断言工具 ---------------- */

let pass = 0, fail = 0;
const failures = [];
function chk(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else {
    fail++;
    failures.push(name + (detail ? '  → ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? '  → ' + detail : ''));
  }
}

function section(title) { console.log('\n=== ' + title + ' ==='); }

/* ==================================================================
   第一部分：单局不变量
   ================================================================== */

section('1. 单局不变量');
const game = Game.newGame('logic-test-seed');
const t = game.truth;

/* --- 1.1 事实完整性 --- */
chk('线索都指向存在的事实', t.clues.every(c => !!t.facts[c.factId]),
    t.clues.filter(c => !t.facts[c.factId]).map(c => c.id).join(',') || '');

{
  // 每条事实（除 a2 目击证词）都必须至少有一件线索
  const covered = new Set(t.clues.map(c => c.factId));
  covered.add('a2');
  const uncovered = Object.keys(t.facts).filter(f => !covered.has(f));
  chk('★ 每条事实都有线索投影（除目击证词）', uncovered.length === 0,
      uncovered.join(',') || '');
}

chk('每条事实都有链条标签', Object.values(t.facts).every(f =>
    f.chain === 'motive' || f.chain === 'action' || f.chain === 'cover'));
chk('三条链各有 3 条事实',
    t.chains.motive.length === 3 && t.chains.action.length === 3 && t.chains.cover.length === 3);
chk('场景线索至少 2 条', t.clues.filter(c => c.place === t.scene).length >= 2,
    t.clues.filter(c => c.place === t.scene).length + ' 条');

/* --- 1.2 不在场证明 --- */
chk('死者案发时在现场', t.victim.schedule[t.time] === t.scene,
    t.victim.schedule[t.time] + ' ≠ ' + t.scene);
chk('凶手的案发时段是一句谎（声称在别处）',
    t.murderer.schedule[t.time] === t.claim,
    '凶手声称 ' + t.murderer.schedule[t.time] + '，应为 ' + t.claim);
chk('凶手声称的地点 ≠ 现场', t.murderer.schedule[t.time] !== t.scene);
chk('凶手声称的地点 ≠ 自己家（不然不算谎）',
    t.murderer.schedule[t.time] !== t.murderer.home,
    '声称 ' + t.murderer.schedule[t.time] + '，家 ' + t.murderer.home);
chk('红鲱鱼有可核实的不在场证明', t.redHerring.schedule[t.time] === 'teahouse',
    t.redHerring.schedule[t.time]);
chk('目击者案发时在附近', game.byId.marginal.schedule[t.time] !== 'marginal');

/* --- 1.3 关系网 --- */
{
  const touched = new Set([t.victim.id]);
  t.relations.edges.forEach(e => { touched.add(e.a); touched.add(e.b); });
  chk('关系网无孤立者', Object.keys(game.byId).every(id => touched.has(id)),
      Object.keys(game.byId).filter(id => !touched.has(id)).join(',') || '');
  chk('没有自环', t.relations.edges.every(e => e.a !== e.b));
}

/* --- 1.4 知情约束（严谨的核心之一）--- */
{
  let bad = null;
  for (const p of game.people) {
    for (const fid of Object.keys(p.stance)) {
      if (p.stance[fid] !== 'honest' && (p.knowledge[fid] || 0) === 0) {
        bad = `${p.name} 对 ${fid} 立场是 ${p.stance[fid]} 却不知情`;
        break;
      }
    }
    if (bad) break;
  }
  chk('没有人会隐瞒自己不知道的事', !bad, bad);
}

/* --- 1.5 凶手必须有谎可撒 --- */
{
  const lies = Object.keys(t.murderer.stance).filter(f => t.murderer.stance[f] === 'lie');
  chk('凶手至少撒 3 个谎', lies.length >= 3, lies.length + ' 个');
}

/* --- 1.6 链条独立性：每条链都指名凶手 --- */
chk('动机链指名凶手', t.facts.m1.text.includes(t.murderer.name));
chk('行动链指名凶手（目击证词）', t.facts.a2.text.includes(t.murderer.name));
chk('掩盖链指名凶手', t.facts.c1.text.includes(t.murderer.name));

/* --- 1.7 红鲱鱼也有动机假象（不然不像嫌疑）--- */
{
  const edge = Relations.between(t.relations.edges, t.victim.id, t.redHerring.id);
  chk('红鲱鱼与死者有仇怨/债务边', edge && (edge.type === '旧怨' || edge.type === '债务'),
      edge ? edge.type : '无边');
}

/* ==================================================================
   第二部分：构造性可解（完美玩家模拟）
   ================================================================== */

section('2. 完美玩家：从零走到破案');

{
  const g2 = Game.newGame('perfect-player-seed');
  const t2 = g2.truth;

  // 2.1 逛遍所有地点，翻找所有线索
  for (const place of Game.places(g2)) {
    Game.go(g2, place.id);
    for (let i = 0; i < 5; i++) Game.search(g2);
  }
  const foundCount = g2.player.clues.length;
  chk('翻遍全镇能找到线索（≥4）', foundCount >= 4, foundCount + ' 条');

  // 2.2 问每个人案发那晚（收不在场证明）
  for (const p of g2.people) {
    if (p === t2.victim) continue;
    Game.ask(g2, p.id, 'night');
  }
  chk('问过之后记录了不在场证明', Object.keys(g2.player.alibis).length >= 5,
      Object.keys(g2.player.alibis).length + ' 人');

  // 2.3 撬开边缘人的嘴（出示行动链证据，一直试到他说出目击证词）
  const marginal = g2.byId.marginal;
  for (const c of g2.player.clues.slice()) {
    if (marginal.broken['a2']) break;
    Game.present(g2, marginal.id, c.id);
  }
  chk('边缘人开口了', marginal.broken['a2'] === true,
      Object.keys(marginal.broken).join(',') || '一条都没破');
  chk('目击证词成为正式证据', !!g2.player.foundIds['witness']);

  // 2.4 对凶手按链施压：把手里每件证据都出示一遍（包括证词）
  const murderer = t2.murderer;
  for (const c of g2.player.clues.slice()) {
    Game.present(g2, murderer.id, c.id);
  }
  const stillHiding = Object.keys(murderer.stance).filter(f =>
    murderer.stance[f] !== 'honest' && !murderer.broken[f]);
  chk('凶手的谎言全部可以击穿', stillHiding.length === 0,
      stillHiding.join(',') || '');

  // 2.5 指认 → 必须赢
  const verdict = Game.accuse(g2, murderer.id);
  chk('★ 完美玩家能破案（构造性可解）', g2.won === true && verdict.correct === true);
}

/* ==================================================================
   第三部分：错误指认必须失败且有反证
   ================================================================== */

section('3. 错误指认');

{
  const g3 = Game.newGame('wrong-accuse-seed');
  const r = Game.accuse(g3, g3.truth.redHerring.id);
  chk('指认红鲱鱼不会赢', r.correct === false && g3.over === false);
  chk('失败时给出可核实的反证', r.text.includes('茶馆') || r.text.includes('作证'),
      r.text.slice(0, 60));
  chk('错误指认被记数', g3.player.accused === 1);
}

/* ==================================================================
   第四部分：模糊测试（300 个种子）
   ================================================================== */

section('4. 模糊测试：300 局');

{
  let fatal = null;
  let badCount = 0;
  const badSeeds = [];

  for (let i = 1; i <= 300; i++) {
    const seed = 'fuzz-' + i;
    try {
      const g = Game.newGame(seed);
      const tt = g.truth;

      const ok =
        tt.murderer !== tt.victim &&
        tt.redHerring !== tt.murderer &&
        tt.victim.schedule[tt.time] === tt.scene &&
        tt.murderer.schedule[tt.time] !== tt.scene &&
        tt.murderer.schedule[tt.time] !== tt.murderer.home &&
        tt.redHerring.schedule[tt.time] === 'teahouse' &&
        tt.clues.every(c => !!tt.facts[c.factId]) &&
        (() => {
          const covered = new Set(tt.clues.map(c => c.factId));
          covered.add('a2');
          return Object.keys(tt.facts).every(f => covered.has(f));
        })() &&
        tt.facts.m1.text.includes(tt.murderer.name) &&
        tt.facts.a2.text.includes(tt.murderer.name) &&
        tt.facts.c1.text.includes(tt.murderer.name) &&
        tt.clues.filter(c => c.place === tt.scene).length >= 2;

      // 知情约束
      for (const p of g.people) {
        for (const fid of Object.keys(p.stance)) {
          if (p.stance[fid] !== 'honest' && (p.knowledge[fid] || 0) === 0) throw new Error('知情约束被破坏');
        }
      }

      if (!ok) { badCount++; badSeeds.push(seed); }
    } catch (e) {
      fatal = { seed, e };
      break;
    }
  }

  chk('300 局没有抛异常', !fatal,
      fatal ? fatal.seed + ': ' + fatal.e.message : '');
  chk('300 局核心不变量全部成立', badCount === 0,
      badCount + ' 局失败：' + badSeeds.slice(0, 5).join(', '));
}

/* ==================================================================
   第五部分：指令解析器
   ================================================================== */

section('5. 指令解析器');

{
  const g5 = Game.newGame('parser-seed');
  const victim = g5.truth.victim;

  const h = Actions.parse(g5, '帮助');
  chk('识别"帮助"', h && h.type === 'help');

  const sceneName = g5.truth.sceneName;
  const goR = Actions.parse(g5, '去' + sceneName);
  chk('识别"去 + 地点名"', goR && goR.type === 'go', JSON.stringify(goR));

  const a1 = Actions.parse(g5, '问' + g5.people[0].name + '关于出事那晚');
  chk('识别"问某人关于某事"', a1 && a1.type === 'ask', a1 ? a1.type : 'null');

  const acc = Actions.parse(g5, '指认' + victim.name);
  chk('识别"指认某人"', acc && acc.type === 'accuse');

  const err = Actions.parse(g5, '来一瓶酱油');
  chk('听不懂的话给错误提示', err && err.type === 'error');
}

/* ==================================================================
   结果
   ================================================================== */

console.log('\n' + '='.repeat(56));
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) {
  console.log('\n  失败清单：');
  failures.forEach(f => console.log('   · ' + f));
}
console.log('='.repeat(56) + '\n');

process.exit(fail ? 1 : 0);
