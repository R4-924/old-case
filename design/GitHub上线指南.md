# GitHub Pages 上线指南（完整流程）

> 目标：把这个项目变成一个任何人都能打开的网址。
> 前置：只需要一个邮箱和浏览器。**不需要安装 git。**
> 上传包：`小城旧案-GitHub上线包.zip`（48 KB）

---

## 0. 先说清楚最后会得到什么

```
https://你的用户名.github.io/仓库名/
例：https://xiaoming.github.io/old-case/
```

这个网址是**永久免费**的，别人点开就能玩，手机也能开。

---

## 1. 注册 GitHub

1. 打开 https://github.com → 右上角 **Sign up**
2. 依次填：邮箱 → 密码 → 用户名 → 邮箱验证码
3. **用户名要想好**，它会成为你网址的一部分（只能用字母、数字、连字符）
4. 去邮箱点确认链接完成验证

> ⚠️ **不完成邮箱验证，Pages 会开不起来。**

---

## 2. 建仓库（Repository）

1. 右上角 **+** → **New repository**
2. **Repository name**：填 `old-case`
   - ⚠️ **不能有空格、不能用中文**，所以不能叫 "interactive fiction"
   - 其他可用名：`little-old-case`、`town-mystery`、`jiuan`
3. **Description**：随便填，例如「一个生成小城旧案的交互小说引擎」
4. 选 **Public**（免费账号只能公开仓库才能用 Pages）
5. 勾上 **Add a README file**
6. 点 **Create repository**

---

## 3. 上传文件（最容易出错的一步）

1. 把 `小城旧案-GitHub上线包.zip` 解压，得到一个 `gh-pages-upload` 文件夹
2. **打开**这个文件夹，里面应该是这 5 样东西：

```
gh-pages-upload\
├── index.html     ← 必须在最外层
├── README.md
├── src\
├── test\
└── design\
```

3. **Ctrl+A 全选这 5 样**（注意：是选里面的东西，不是选 gh-pages-upload 文件夹本身）
4. 在仓库页面点 **Add file** → **Upload files**
5. 把选中的 5 样直接**拖进**网页的上传框
6. 下面的 **Commit changes** 保持默认，点绿色按钮

### ✅ 传完必须检查

回到仓库首页，你应该**直接看到** `index.html` 和 `src`。
如果看到的是一个 `gh-pages-upload` 文件夹，说明你拖错了层级——
**必须删掉重传**，否则网站打开是空白。

> 为什么这么严：GitHub Pages 只会把仓库**最外层**的 `index.html` 当成首页。
> 如果它在子文件夹里，网址打开就是 404。

---

## 4. 开启 Pages

1. 仓库页面上方点 **Settings**
2. 左侧栏找到 **Code, planning, and automation** 分类 → 点 **Pages**
3. **Build and deployment** 下面，**Source** 选 **Deploy from a branch**
4. **Branch** 下拉选 **main**，右边的文件夹选 **/ (root)**
5. 点 **Save**
6. 等 1~10 分钟（第一次通常要几分钟），刷新这个页面
7. 顶部出现一行绿框：**Your site is live at https://你的用户名.github.io/old-case/**

点进去就是你的网站。

---

## 5. 建议加一个 `.nojekyll`（防止构建失败）

1. 仓库 → **Add file** → **Create new file**
2. 文件名填：`.nojekyll`（就这个，前后没有别的字）
3. 内容留空
4. 拉到底 **Commit changes**

**作用**：关掉 GitHub 自带的 Jekyll 处理，让文件原样发布。
本项目的 `design/设计笔记.md` 是中文文件名，加上这个文件能排除构建失败的风险。

---

## 6. 验证

- 打开网址，应该看到朱砂色的「案」字印章和标题「小城旧案」
- 随便玩一步，确认按钮和打字机效果正常
- 用手机打开同一网址试一次

---

## 7. 以后怎么更新

改完文件后：

**Add file** → **Upload files** → 把改过的文件拖进去（同名会覆盖）→ **Commit changes**
→ 等一两分钟，网站自动更新。

> 想更省事，以后可以装 **Git for Windows**，用 `git push` 更新。
> 但现在完全不必需。

---

## 8. 排错速查

| 症状 | 原因 | 解决 |
|---|---|---|
| 网址打开是 404 | `index.html` 不在仓库最外层 | 重传，确保层级正确（见第 3 步） |
| 打开是白屏 | 同上；或 `src/` 没传上去 | 检查仓库里有没有 `src` 文件夹 |
| Pages 设置里 Save 点了没反应 | 仓库是空的，或选了 Private | 先传文件；仓库设为 Public |
| 等很久还是 404 | 首次部署慢 | 最多等 10 分钟，去 **Actions** 标签看构建状态 |
| Actions 里构建失败 | Jekyll 处理出错 | 加 `.nojekyll`（见第 5 步） |
| 自己打得开、别人打不开 | 国内访问 `github.io` 不稳定 | 换 Cloudflare Pages / Netlify Drop，**代码一行都不用改** |
| 页面样式全丢 | 文件名大小写不符 | 本项目的路径已核对过，若你自己改过文件名要注意 |

---

## 9. 备选方案（如果 github.io 访问不畅）

三个平台都是纯静态托管，**本项目不用改一行代码**：

| 平台 | 操作 | 特点 |
|---|---|---|
| **Netlify Drop** | 打开 https://app.netlify.com/drop，把 `gh-pages-upload` 文件夹拖进去 | 30 秒出网址，最简单 |
| **Cloudflare Pages** | 连 GitHub 仓库，自动部署 | 国内访问通常比 github.io 稳 |
| **itch.io** | 上传 zip 作为 HTML 游戏 | 有游戏社区的天然流量 |

---

## 10. 分享时别忘了种子

这个项目每局的真相由**种子**决定。别人玩到的是不同的案子。
你可以这样分享：

> 「我玩了一局，凶手是最不可能的那个人。种子：`白露渡`，你去试试。」

对方在页面上打开控制台（F12），敲：

```js
LittleRoom.newGame('白露渡')
```

就能玩到跟你**一模一样的那一局**，然后你们可以对答案。
