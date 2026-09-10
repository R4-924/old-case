/* ==========================================================================
   交互小说引擎 · 内容审读工具
   生成一局并完整打印：镇子、人物、关系、真相、线索。
   用途：不玩游戏也能检查文字质量。

   跑法：node test\demo.js [种子]
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const sandbox = {
  console,
  Date, Math, JSON, Number, String, Object, Array, Set, parseInt, parseFloat, isNaN,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['rng.js', 'names.js', 'world.js', 'people.js', 'relations.js',
                 'truth.js', 'dialogue.js', 'game.js', 'actions.js']) {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
}

const { Game } = sandbox;
const seed = process.argv[2] || 'demo';
const g = Game.newGame(seed);
const t = g.truth;
const w = g.world;

console.log('════════════════════════════════════════════════');
console.log('  种子：' + seed);
console.log('════════════════════════════════════════════════');

console.log('\n◆ 镇子');
console.log(`${w.town.name}——${w.town.flavor}`);

console.log('\n◆ 三层历史');
w.histories.forEach(h => {
  console.log(`\n【${h.yearsAgo} 年前 · ${h.name}】`);
  console.log(h.text);
  console.log(`  受损：${h.loser}（${h.loserDesc}）　得利：${h.winner}（${h.winnerDesc}）`);
  console.log(`  痕迹：${h.traces.join(' / ')}`);
});

console.log('\n◆ 机构');
w.institutions.forEach(i => console.log(`  ${i.name}——${i.flavor}`));

console.log('\n◆ 镇上传闻');
w.legends.forEach(l => {
  console.log(`  "${l.text}"`);
  console.log(`    真相：${l.truth}（指向：${l.connectsTo}）`);
});

console.log('\n◆ 人物');
g.people.forEach(p => {
  console.log(`\n  ${p.name}（${p.age} 岁，${p.label}，${p.job}）——"${p.given}"，${p.meaning}`);
  console.log(`    欲望：${p.desire}`);
  console.log(`    恐惧：${p.fear}`);
  console.log(`    秘密：${p.secret}`);
  console.log(`    口头禅：${p.phrase}`);
  console.log(`    小动作：${p.tell}`);
  console.log(`    案发时段声称：${p.schedule[t.time]}`);
});

console.log('\n◆ 关系网');
t.relations.edges.forEach(e => {
  const a = g.byId[e.a] ? g.byId[e.a].name : t.victim.name;
  const b = g.byId[e.b] ? g.byId[e.b].name : t.victim.name;
  console.log(`  [${e.type}] ${a} ↔ ${b}：${e.desc}${e.fresh ? ' ★近期冲突' : ''}`);
});

console.log('\n◆ 案件');
console.log(`  死者：${t.victim.name}（${t.victim.label}）`);
console.log(`  凶手：${t.murderer.name}（${t.murderer.label}）`);
console.log(`  现场：${t.sceneName} · ${t.time}`);
console.log(`  手法：${t.method}`);
console.log(`  凶手声称：${t.claimName}`);
console.log(`  红鲱鱼：${t.redHerring.name}（有可核实不在场证明）`);

console.log('\n◆ 三条链');
['motive', 'action', 'cover'].forEach(ch => {
  const names = { motive: '动机链', action: '行动链', cover: '掩盖链' };
  console.log(`\n【${names[ch]}】`);
  t.chains[ch].forEach(f => console.log(`  · ${t.facts[f].text}`));
});

console.log('\n◆ 线索（地点 → 名称）');
t.clues.forEach(c => {
  console.log(`  [${c.id}] ${c.place.padEnd(9)} ${c.name} → ${c.factId}`);
  console.log(`      ${c.desc}`);
});

console.log('\n◆ 破绽映射（凶手的谎 → 能击穿的证据）');
Object.keys(t.murderer.stance).forEach(f => {
  const s = t.murderer.stance[f];
  if (s !== 'honest') {
    console.log(`  ${f}（${s}）：${t.facts[f].text.slice(0, 40)}…`);
  }
});

console.log('\n════════════════════════════════════════════════');
