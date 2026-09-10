/* ==========================================================================
   交互小说引擎 · people.js
   生成六个人物。核心规格：

   ★ 三件套（欲望 / 恐惧 / 秘密）必须互相冲突：
       欲望和恐惧打架（想要的东西正是怕面对的东西）；
       秘密是冲突的引线（一旦暴露，欲望和恐惧同时爆炸）。
     生成时用模板占位，真相生成后再补上具体人名。

   ★ 声音：每个人有自己的口头禅、节奏、撒谎时的小动作。
   ========================================================================== */

const People = (() => {
  'use strict';

  /* ------------------------------------------------------------------
     角色模板
     ------------------------------------------------------------------ */

  const ROLES = {

    /* 权威：本应主持公道，却被自己的过去牵着走 */
    authority: {
      label: '权威',
      candidates: ['镇长', '族老', '教堂神父', '济世堂大夫'],
      ageRange: [45, 60],
      desires: [
        '想在任上把镇子的事办得体面，给自己留个身后名',
        '想压下最近几桩旧事，让镇子别再翻老账',
        '想保住这个位子，家里全靠这份体面撑着',
      ],
      fears: [
        '怕自己年轻时做下的那件事被人翻出来',
        '怕镇上的人发现他早就不想管了',
        '怕有人拿旧账来换他的人情',
      ],
      secrets: [
        '当年给{winner}签过一份见不得光的文书',
        '当年那件事的卷宗，其实一直锁在他柜子里',
        '他欠{winner}一条命，这条命早晚要还',
      ],
      phrases: ['"话不能乱说。"', '"按规矩来。"', '"当年的事，提它做什么。"'],
      tells: '说到关键处，总要去摸桌上的茶杯盖',
      home: 'office',
    },

    /* 老住户：镇子的活记忆 */
    elder: {
      label: '老住户',
      candidates: ['说书人', '老船工', '祠堂看门人', '旧学堂的先生'],
      ageRange: [62, 76],
      desires: [
        '想在闭眼之前，把{h1}的真相说出来',
        '想看着当年害人的人遭一回报应',
        '想把自己攒下的那点东西留给对的人',
      ],
      fears: [
        '怕说出来也没人信了',
        '怕连累家里的小辈',
        '怕自己记错了，白白冤枉人',
      ],
      secrets: [
        '他亲眼看见了{h1}前后发生的事，知道得比谁都多',
        '他手里留着半本当年的账册，谁也不知道',
        '他不是本镇人，是当年逃难来的，改了姓',
      ],
      phrases: ['"我活这么大岁数，什么没见过。"', '"别急，坐下，听我慢慢说。"', '"有些事，烂在肚子里也不能讲。"'],
      tells: '撒谎时会突然开始咳嗽，越咳越厉害',
      home: 'teahouse',
    },

    /* 新贵：旧灾难的得利者 */
    nouveau: {
      label: '新贵',
      candidates: ['木行掌柜', '米行东家', '药材商', '船行老板'],
      ageRange: [36, 52],
      desires: [
        '想把河街剩下的几间铺子也盘下来',
        '想给儿子说一门体面的亲事，借此洗掉过去',
        '想把家里那本旧账彻底烧掉',
      ],
      fears: [
        '怕当年起家的路数被人说破',
        '怕半夜有人来敲门',
        '怕自己儿子知道了家里的钱是怎么来的',
      ],
      secrets: [
        '当年{loser}家的家当，是被他半买半抢弄到手的',
        '他给{authority}送过一份"谢礼"，收据还在',
        '他其实不姓这个姓，是后来改的',
      ],
      phrases: ['"生意人，讲的是信誉。"', '"过去的事，翻它没意思。"', '"只要价钱合适，什么都好谈。"'],
      tells: '一紧张就转手上的玉扳指',
      home: 'mansion',
    },

    /* 苦主：旧灾难的受损者 */
    bitter: {
      label: '苦主',
      candidates: ['摆渡人', '帮人挑水的', '旧厂里的老工人', '被征了地的农户'],
      ageRange: [32, 58],
      desires: [
        '想要一个说法，哪怕晚了几十年',
        '想把自己家的地契赎回来',
        '想离开这个镇子，但没盘缠',
      ],
      fears: [
        '怕自己一冲动做出没法回头的事',
        '怕连累家里人跟着抬不起头',
        '怕日子已经定了，怎么争都没用',
      ],
      secrets: [
        '他藏着当年的一份证据，等一个时机',
        '他夜里偷偷去{scene}看过不止一次',
        '他给{winner}写过一封恐吓信，没有署名',
      ],
      phrases: ['"人穷，志不能短。"', '"老天爷看着呢。"', '"这口气，我咽不下去。"'],
      tells: '说到恨处，会不自觉地捏紧拳头，指节发白',
      home: 'dock',
    },

    /* 边缘人：看见一切、说不出话的目击者 */
    marginal: {
      label: '边缘人',
      candidates: ['哑巴钟表匠', '守夜人', '捡破烂的老头', '卖花人'],
      ageRange: [26, 60],
      desires: [
        '只想安安静静地把日子过下去',
        '想找个人，把那天夜里看见的事说出来',
        '想离开这个总是被人使唤的位子',
      ],
      fears: [
        '怕说出来的话没人当回事',
        '怕得罪了人，连这个落脚的地方都没了',
        '怕夜里再听见那个声音',
      ],
      secrets: [
        '案发那夜他在场，看得真真切切',
        '他捡到了凶手落下的东西，一直藏着',
        '他不是哑巴，是当年被吓哑的',
      ],
      phrases: ['"……"', '"我、我只是路过。"', '"别问我，我什么都不知道。"'],
      tells: '害怕的时候会往门后躲，只露出一只眼睛',
      home: 'mill',
    },

    /* 死者相关人：与案子的核心纠缠最深 */
    kin: {
      label: '死者相关人',
      candidates: ['未亡人', '继承人', '债主', '多年未见的旧识'],
      ageRange: [28, 52],
      desires: [
        '想弄清楚那晚到底发生了什么',
        '想拿回本该属于自己的东西',
        '想让这件事赶紧过去，别再有人提起',
      ],
      fears: [
        '怕自己其实是那个最希望他死的人',
        '怕查到最后，查到自家人头上',
        '怕没有他的日子，比想象中难过',
      ],
      secrets: [
        '那晚见过死者最后一面，说了很难听的话',
        '死者留下过一样东西，指名要交给{elder}',
        '其实早就想离开这个家了',
      ],
      phrases: ['"他这个人啊……"', '"别在我面前提那晚。"', '"我比你们谁都想知道真相。"'],
      tells: '一说到死者，就开始反复折手里的手绢',
      home: 'mansion',
    },
  };

  /* ------------------------------------------------------------------
     生成
     ------------------------------------------------------------------ */

  function generate(rng, world) {
    const roles = ['authority', 'elder', 'nouveau', 'bitter', 'marginal', 'kin'];
    const people = [];
    const roleById = {};

    for (const roleId of roles) {
      const tpl = ROLES[roleId];
      const nm = Names.personName(rng);
      const age = RNG.int(rng, tpl.ageRange[0], tpl.ageRange[1]);

      const p = {
        id: roleId,
        label: tpl.label,
        name: nm.name,
        given: nm.given,
        meaning: nm.meaning,
        age,
        ageText: ageText(age),
        job: RNG.pick(rng, tpl.candidates),
        desire: RNG.pick(rng, tpl.desires),
        fear: RNG.pick(rng, tpl.fears),
        secret: RNG.pick(rng, tpl.secrets),
        phrase: RNG.pick(rng, tpl.phrases),
        tell: tpl.tells,
        home: tpl.home,
        /** 日程：6 个时段，之后由 truth.js 补全与改写 */
        schedule: {},
        /** 对真相节点的知识：{ factId: 0|1|2 }，由 truth.js 填写 */
        knowledge: {},
        /** 谎言状态：{ factId: 'honest'|'evade'|'lie'|'refuse' }，由 truth.js 填写 */
        stance: {},
        /** 被击穿的谎言 */
        broken: {},
      };
      people.push(p);
      roleById[roleId] = p;
    }

    return { people, roleById };
  }

  function ageText(age) {
    if (age < 35) return '三十上下';
    if (age < 45) return '四十来岁';
    if (age < 55) return '五十出头';
    if (age < 65) return '花甲之年';
    return '古稀之年';
  }

  /* ------------------------------------------------------------------
     把模板里的占位符换成真人名。
     在真相生成（victim/murderer 等定下）之后调用。
     ------------------------------------------------------------------ */

  function resolveTemplates(world, people, ctx) {
    const byId = {};
    people.forEach(p => { byId[p.id] = p; });

    const repl = (text) => {
      if (typeof text !== 'string') return text;
      const hs = ctx.histories || [];
      return text
        .replace(/\{authority\}/g, byId.authority.name)
        .replace(/\{elder\}/g, byId.elder.name)
        .replace(/\{nouveau\}/g, byId.nouveau.name)
        .replace(/\{bitter\}/g, byId.bitter.name)
        .replace(/\{marginal\}/g, byId.marginal.name)
        .replace(/\{kin\}/g, byId.kin.name)
        .replace(/\{victim\}/g, ctx.victim.name)
        .replace(/\{murderer\}/g, ctx.murderer.name)
        .replace(/\{winner\}/g, ctx.winnerFamily || '那家人')
        .replace(/\{loser\}/g, ctx.loserFamily || '他们家')
        .replace(/\{h1\}/g, hs[0] ? hs[0].name : '那年')
        .replace(/\{h2\}/g, hs[1] ? hs[1].name : '那年')
        .replace(/\{h3\}/g, hs[2] ? hs[2].name : '那年')
        .replace(/\{scene\}/g, ctx.sceneName || '那儿');
    };

    people.forEach(p => {
      p.desire = repl(p.desire);
      p.fear = repl(p.fear);
      p.secret = repl(p.secret);
    });
  }

  return { generate, resolveTemplates, ROLES };
})();

window.People = People;
