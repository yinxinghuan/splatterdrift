# SPLATTERDRIFT 纵向切片 QA

## 结论

粒子重构版已通过确定性机械验证、390×844 / 320×568 真触摸自动化、platform-layout
构图复验、结果按钮尺寸、粒子预算、连续帧、基线路由和静态 UI 审计。当前结论只支持继续
真人试玩，不构成发布验收；正式海报、平台 UUID、真机音频/震动和外部访客状态尚未完成。

## 机械验证

`npm run verify` 通过：

- 向右射击产生向左反冲，触屏单位方向在飞船移动后保持稳定。
- 大岩体命中后分裂为两个小岩体，并生成一个权威制动涡旋。
- 穿过制动涡旋把速度从 120 降到约 57，记录主动制动并加分。
- 飞船碰撞扣除 1 点完整度。
- 30fps 与 60fps 在相同输入下的飞船位置、岩体数和射击数一致。
- 45 秒后进入 time 状态。

## 触摸与运行证据

Chromium 移动上下文使用 `Input.dispatchTouchEvent`：

- 按下 25ms：`shots=0`、`held=false`、`aimMode=direction`，预瞄与误射分离。
- 长按：产生 2 发并命中 1 次；松手后 `held=false`。
- 制动：`vx 120 → 约 57.1`，`brakeEvents 0 → 1`，制动涡旋被消费。
- 390×844 和 320×568：`scrollY=0`，无横向溢出，场地完全在视口内。
- 命中证据中活跃粒子分别为 43 与 31；连续尾迹分别达到 28 与 18 个采样点。
- 14 个同时命中的标准档压力注入达到 420 粒子硬上限，p95 帧间隔 9ms；窄屏
  8 个同时命中峰值 153 粒子，p95 约 9.3ms，均低于 28ms 自动化门限。
- 结果重开按钮在两种尺寸均不小于 44×44px。
- `?baseline=1` 真触摸后存在弹丸、粒子或残留节点。

最终证据：

- `particle-final-platform-layout-idle-390x844.png`
- `particle-final-platform-layout-motion-a-390x844.png`
- `particle-final-platform-layout-motion-b-390x844.png`
- `particle-final-platform-layout-hit-390x844.png`
- `particle-final-platform-layout-brake-390x844.png`
- `particle-final-platform-layout-result-390x844.png`
- `particle-final-platform-layout-idle-320x568.png`
- `particle-final-platform-layout-hit-320x568.png`
- `particle-final-platform-layout-brake-320x568.png`
- `particle-final-platform-layout-result-320x568.png`
- `particle-final-baseline-390x844.png`

## 本轮视觉重构

### 用户反馈：颜色俗气、缺少粒子主体、运动不流畅

- 原因：产品层沿用了高饱和循环色和双圆环制动花；实际粒子数量少、寿命短，并以
  多个 DOM 节点逐帧更新，效果像附加装饰，没有持续说明反冲与速度。
- 修复：产品层重建为单 Canvas 2D；只保留石墨、暖白、离子青和危险珊瑚色；
  射击产生反向压力尘，飞船保留真实历史尾迹，命中沿冲击方向生成火花/碎片，
  制动目标改为切向粒子涡旋，吸收时向飞船收束。
- 性能：使用固定对象池、DPR 上限和窄屏/低动态分档；视觉事件不参与权威碰撞。
- 复验：双尺寸真触摸、连续运动帧、命中、吸收、结果及峰值粒子压力均通过。

## 发现与修复

### P1：触摸 focus 导致高屏页面滚动

- 首轮：部分 390×844 hit/brake 截图在触摸后标题离开视口。
- 影响：真机游戏中 HUD 可能漂移，玩家失去计时与完整度信息。
- 修复：触摸不再获取键盘焦点；游戏 `#app` 根层固定到视口；键盘/鼠标焦点路径保留。
- 复验：两个尺寸完成相同触摸序列后 `scrollY=0`，matched 截图标题稳定。

### P2：ready 岩体初始裁切

- 首轮：6 个岩体中有两个初始生成在环绕边缘，只显示半个。
- 影响：首帧容易读成布局裁切错误，而不是经典环绕。
- 修复：首轮生成半径从 `152–210` 收到 `136–154`，开始后仍正常环绕。
- 复验：两个尺寸 ready 均完整显示 6 个岩体。

### QA harness：隐藏访客栏后残留滚动

- 首轮 platform 截图隐藏 external guest banner 后没有重置 scroll。
- 修复只存在于 QA harness：注入隐藏样式后 `scrollTo(0,0)`；生产代码保留 guest shell。

### external-guest 发布检查

- `final-external-guest-idle-390x844.png` 保留真实访客栏。
- 访客栏覆盖顶部标题/HUD 的一部分，但场地、飞船、岩体和首轮教学仍可见且可操作。
- 按项目门禁不据此下移 platform-layout；平台内主构图继续以无访客栏证据为准。

## UI 与视觉评分

| 维度 | 分数 | 证据 |
|---|---:|---|
| 层级 | 4 | 飞船/岩体为主，HUD 安静，结果层单一主动作 |
| 一致性 | 4 | 石墨底、暖白轮廓、离子青能量与珊瑚危险色 |
| 可读性 | 4 | 双尺寸无溢出，状态不只靠颜色 |
| 手感 | 4 | 同帧预瞄、真实路径尾迹、方向命中、制动收束层级明确 |
| 素材质量 | 4 | 无外部素材拼贴；Canvas 粒子与几何轮廓同一形状语言 |
| 响应式 | 4 | 360×520 权威场地缩放，短屏删减辅助信息 |
| 完成度 | 3 | 纵向切片完整，但未做真机音频/震动和正式发布 |

平均 `3.86`，无低于 3 的类别。适合交给用户本地连续试玩；不应在真机手感确认前发布。
