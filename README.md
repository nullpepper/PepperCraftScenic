# PepperCraft 官网 · 实景单页

PepperCraft（`pepper.ltd`）的单页官网：整屏实景首屏、三张 2:3 世界图卡、承诺合影、进服面板与米白纸色 FAQ。没有前端框架，也没有构建步骤。

**纯静态站点，直接打开或丢到任意静态托管即可。**

```text
index.html                 页面内容
404.html                   404 页
assets/css/style.css       配色、版式、响应式、字体声明
assets/js/main.js          在线人数、复制地址、开服天数、移动导航
assets/img/                实景图、图卡、OG、图标
assets/fonts/              中文子集 WOFF2 + OFL 许可
scripts/build-fonts.sh     文案改动后重建字体子集
```

## 本地预览

```bash
cd /home/pepper/projects/web/PepperCraftScenic
python3 -m http.server 8799
```

打开 <http://localhost:8799>。手机测试用 `http://<本机内网 IP>:8799`。

## 常改的地方

| 想改什么 | 去哪里 |
|---|---|
| 文案、问答、入服步骤 | `index.html`，直接搜中文 |
| 配色、字号、断点 | `assets/css/style.css` 顶部 `:root` 与底部响应式 |
| 服务器地址 / 群号 | 搜 `pepper.ltd`、`754966689`，同步修改 `data-copy` |
| 首屏、承诺、进服大图 | `assets/img/` 同名 WebP；保留 `width` / `height` |
| 三张世界图卡 | `redstone-tile.webp`、`garden-tile.webp`、`cabin-tile.webp`，均为 2:3 |
| 社交分享图 | 当前是 1200×630 站内首屏截图（隐藏实时状态）；换图时同步 `og:image:alt` / `width` / `height` |
| 新增中文文案 | 跑一次 `./scripts/build-fonts.sh`，避免子集字体缺字 |

## 已实现

- 整屏实景首屏，文字叠在暗色渐变上；不依赖 JavaScript 也能读完整页。
- 世界区三张 2:3 竖构图卡，分别标注“山间红石 / 主城花园 / 夜灯木屋”，不再用 16:9 横图硬裁。
- 实时在线：`uapis.cn` 主接口，失败自动切 `mcstatus.io`；60 秒刷新，页面隐藏时暂停。在线但 0 人时显示“在线 0 人 · 此刻安静”，不误判成离线。
- 开服天数按上海时区自动计算；HTML 里只放“3 年+”兜底，不会在无脚本时显示过期数字。
- 一键复制服务器地址，剪贴板失败时回退到选中文本；复制结果有 `aria-live` 提示。
- 移动端导航：≤820px 显示汉堡按钮，支持 Escape、点击外部关闭、打开后焦点进入菜单。
- 自托管中文子集字体（SIL OFL 1.1），首屏只预加载粗体；不依赖访问者系统里的中文字体。
- OG / Twitter 卡片、1200×630 站内首屏分享图、`apple-touch-icon`、FAQPage 结构化数据。
- 原生 `<details>` 问答、`prefers-reduced-motion`、语义化状态提示、404 页。

## 字体与素材

- `assets/fonts/pepper-sans-*.woff2` 与 `pepper-serif-bold.woff2` 是 Noto Sans CJK / Noto Serif CJK 的子集，许可见 `assets/fonts/OFL.txt`。
- 页面文案增删后运行 `./scripts/build-fonts.sh`；脚本默认读取系统 Noto CJK 与 `~/.cache/pptenv/bin/pyftsubset`，可用 `PYFTSUBSET`、`NOTO_DIR` 覆盖。
- `assets/img/og.jpg` 是手工维护的 1200×630 站内首屏截图；换图时同步 meta 的 `width` / `height` / `alt`。社交平台可能缓存旧图，换完后用平台调试工具重新抓取。
- 世界图卡由 `redstone-1600.webp`、`garden-1280.webp`、`cabin-1280.webp` 竖裁而来；进服整屏仍使用 `garden-1280.webp`。

## 部署

推送到 `main` 后，GitHub Actions 会把整个目录发布到 GitHub Pages。首次需要在仓库 **Settings → Pages** 把 Source 设为 **GitHub Actions**，并让 `web.pepper.ltd` 的 CNAME 指向 `<用户名>.github.io`。

404 页使用 `/assets/...` 根绝对路径，前提是自定义域名部署在域名根；若部署在 `/<repo>/` 子路径，需要改成带前缀的路径或 `<base href="/<repo>/">`。

上线前注意：当前 `index.html` 的 `canonical`、`og:url`、`og:image`，以及 `sitemap.xml` 仍使用 `web.pepper.ltd`；该域名目前会 307 到 `www.pepper.ltd`。这一项本次按需求保留未改，正式切换域名时需要一起统一。如果分享抓取器跨 307 丢图，还需要同时统一 `og:url` / `og:image` 的域名。

`www.pepper.ltd` 目前是另一套 Vue 站点，分享预览走的是它的 `https://web.pcraft.eu.org/og.jpg`（夜景木屋）；只改本目录的 `assets/img/og.jpg` 不会改变 307 之后的分享卡。要让分享预览用上本项目的首页截图，需要先让 Scenic 在用户分享的域名上直接提供页面。

## 说明

- 联盟数、日均在线为 2026.10 的展示数据；页面已标注截止时间。
- 真正的“2023 vs 2026 同机位对照”需要一张 2023 年的同构图，当前仓库没有，因此只做了真实时间线，没有伪造拖动对比。
- 非官方 Minecraft 项目，与 Mojang 无关，完全遵守官方 EULA。© 2023–2026 PepperCraft
