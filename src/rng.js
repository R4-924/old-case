/* ==========================================================================
   交互小说引擎 · rng.js
   带种子的伪随机数生成器。
   为什么必须带种子：
     1. 每局可以复现（"第 42 局"可以分享给别人重走一遍）
     2. 存档可以存种子而不是存整个世界
     3. 测试可以确定性断言
   ========================================================================== */

const RNG = (() => {
  'use strict';

  /** xmur3：把任意字符串种子搅成 32 位哈希 */
  function hashSeed(str) {
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < String(str).length; i++) {
      h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  /** mulberry32 */
  function makeRng(seed) {
    let a = hashSeed(seed);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 用当前时间和随机数生成一个种子字符串 */
  function randomSeed() {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return 'seed-' + t + '-' + r;
  }

  /* ------------------------------------------------------------------
     带 rng 的常用随机工具
     ------------------------------------------------------------------ */

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function int(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function chance(rng, p) {
    return rng() < p;
  }

  /** Fisher–Yates 洗牌（返回新数组） */
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 不重复地从数组里抽 n 个 */
  function sample(rng, arr, n) {
    return shuffle(rng, arr).slice(0, n);
  }

  return { hashSeed, makeRng, randomSeed, pick, int, chance, shuffle, sample };
})();

window.RNG = RNG;
