# SPLATTERDRIFT / 溅迹漂移技术文档

## 1. 技术栈

- 原生 JavaScript ES modules、CSS 与 Vite 6，`base: './'`。
- 单个 Canvas 2D 绘制飞船、弹丸、岩体、连续尾迹、方向性粒子和制动涡旋。
- `requestAnimationFrame` 渲染，玩法引擎使用 `1/120s` 固定步长。
- Pointer Events + pointer capture 统一鼠标与触屏；Web Audio 合成音效。
- 无框架、字体或音频文件；海报是构建期静态资产。
- AlterU 环境通过 `callAigramAPI()` 使用玩家资料、按永久 UUID 隔离的排行榜和
  `score_beat` 通知；所有远程失败都不阻塞第一层玩法反馈。

## 2. 目录结构

- `index.html`：移动 viewport、iOS 长按防护与远程 guest shell。
- `src/main.js`：产品/基线路由、DOM 壳层、触摸/键盘生命周期、HUD、结果和 RAF。
- `src/engine.js`：权威固定步长物理、岩体分裂、碰撞、计分、连击和制动涡旋。
- `src/renderer.js`：Canvas 2D 绘制、对象池、连续路径、方向性粒子与吸收动效。
- `src/style.css`：视觉系统、双尺寸布局、结果层、动效与 reduced-motion。
- `src/audio.js`：用户手势解锁的 Web Audio 事件映射。
- `src/i18n.js`：zh/en 与 `game_locale` 调试覆盖。
- `src/aigram-bridge.js`：网页 / Android / iOS 的 Aigram bridge 统一封装、玩家资料读取与
  平台外 `AlterU` 身份降级。
- `src/leaderboard.js`：冠军入口、完整排行榜、成绩提交、跨用户资料跳转和单人超分通知。
- `src/vendor/recoil-splatter-field.*`：正式 Skill 的基线引擎与 CSS 合同。
- `scripts/verify-engine.mjs`：反冲、分裂、制动、CORE、穿透、双发、波次和 30/60fps 一致性。
- `_qa/capture-touch.cjs`：Chromium 真触摸、双尺寸、排行榜 bridge、跨用户跳转、通知、
  外部访客、粒子预算、连续帧与基线验证。
- `_production/generate_poster.py`：只通过 Aigram transit 接口生成正式 raster 海报。
- `_production/poster-source.json`：海报 endpoint、Origin、prompt、返回 URL 与生成时间。
- `public/THIRD_PARTY_NOTICES.txt`：David Aerne 原作来源与完整 MIT notice。

## 3. 核心模块

### 状态与主循环

`SplatterdriftEngine` 管理 `ready / playing / failed / time`。ready 只渲染，
第一次有效射击才启动 45 秒计时。`advance()` 把浏览器 delta 累积为 `1/120s` 固定步长；
页面隐藏时主入口不推进引擎并释放输入，恢复后从当前帧继续。

第一波为 4 个大岩体，后续每波增加 1 个、最多 7 个；速度每波增加 14%，最高
1.56 倍。清场后冻结射击 650ms、奖励 `250 × 已清波次`，然后生成下一波。局内不因清场
提前结束，45 秒内能推进多少扇区本身就是策略和排行榜差异。

### 碰撞与视觉隔离

飞船、弹丸、岩体和制动涡旋都在 `engine.js` 中以圆形权威几何判定。`renderer.js`
只读取状态和带方向向量的事件创建 Canvas 外观；粒子、路径、辉光和动画从不回写碰撞。
大岩体命中确定性分裂为两个小岩体；飞船/岩体/弹丸按逻辑场地环绕。

连续命中把 CORE 从 `×1` 升至 `×4`：速度、弹丸半径和反冲逐级增强；`×3` 单发可额外
穿透一个目标，`×4` 改为角度 `±0.065rad` 的双发。2 秒未命中、6 发落空或碰撞都会回到
`×1`。这些变化属于权威引擎参数，粒子只表现它们，不能代替弹丸或碰撞判定。

### 触屏与坐标

CSS 场地按视口缩放，指针坐标通过实际 `getBoundingClientRect()` 映射回 `360×520`。
触屏使用单位方向，准星始终位于飞船前方 92 逻辑像素；按下同帧预瞄，65ms 武装，
10px 移动提前开火，短点按松手发 1 颗。触摸不获取键盘焦点，应用根层固定，避免
移动浏览器自动滚动画布。鼠标保留绝对瞄准点，键盘使用方向旋转与 Space。

### 粒子、尾迹与性能

射击、命中、吸收、碰撞事件分别生成不同方向分布的火花、压力尘、碎片和收束粒子；
飞船保留最多 28 个真实历史采样点，弹丸保留短路径。命中同时生成一个有 8 秒寿命的
权威制动涡旋，飞船进入 29px 判定范围后速度乘 0.48。标准档 DPR 上限 1.5、粒子池
上限 420、尾迹 28 段、涡旋最多 12；320px 窄屏或 reduced-motion 档 DPR 上限 1.15、
粒子池上限 220、尾迹 18 段、涡旋最多 8。粒子复用对象，不创建逐帧 DOM 节点。
`?baseline=1` 保留原 `RecoilSplatterField` 的 DOM/CSS 爆裂与残留机制用于机械对照。

产品层只借鉴 `luminous-path-trails` 的“运动历史必须是真实路径”原则，没有引入其
WebGPU/TSL 实现；本作也没有使用 FFT 卷积辉光，因为持续星芒并非玩法信息，轻量
additive 能量衰减更符合移动预算。

### 音频、多语言、身份与排行榜

AudioContext 只在首次用户手势后创建，`?mute=1` 静默；错误不会中断游戏。zh/en
根据 `game_locale` 或浏览器语言选择。最高分本地镜像使用独立 key
`splatterdrift_best`。

永久 UUID 为 `13fd84e9-0d92-48a3-8693-2f1fc0a1b570`，沿用被本作替换的 Rainline
条目，避免同一平台内容槽在重做后分裂会话数据。AlterU 身份通过
`/note/telegram/user/get/info/by/telegram_id` 读取 `data.name / data.head_url`；
`?user_name=` 与 `?avatar_url=` 仅作浏览器调试覆盖，平台外显示 `AlterU`。
排行榜按 UUID 读取/保存；开始一局时只在成功取到旧榜后保存可靠快照，结算若刷新后
确认超越，则只向最接近且本轮新超越的一名玩家发送一次 `score_beat`。其他玩家行使用
`AW.PROFILE.OPEN`；当前玩家只显示 `YOU`，不伪装成跨用户入口。

## 4. 扩展点

- 调局长、射速、反冲、阻尼、限速、分裂和碰撞：`src/engine.js` 顶部常量。
- 调 CORE 的速度、半径、反冲、穿透与散射：`src/engine.js` 的 `CORE_CONFIG`。
- 调波次数量、加速、切换时长和奖励：`createWave()`、`WAVE_DELAY` 与波次结算分支。
- 调制动涡旋寿命、上限、减速和得分：`src/engine.js` 的 bloom 常量与 `resolveBloomCollect()`。
- 调触摸武装、移动阈值和中心死区：`src/main.js` 的 pointer handlers。
- 调粒子数量、寿命、DPR、对象池、尾迹和岩体形状：`src/renderer.js`。
- 调配色、构图、HUD、动效和窄屏规则：`src/style.css`。
- 调音高、包络、音量与震动事件：`src/audio.js` 和 `main.js` 的 `handleEvents()`。
- 调排行榜行、CTA、提交和通知：`src/leaderboard.js`；平台 bridge 合同在
  `src/aigram-bridge.js`。
- 换正式海报：重新运行 `_production/generate_poster.py` 并复验 1024 与 160 尺寸，
  然后同步 `public/poster.png` 和 games 汇总仓的同名文件。
