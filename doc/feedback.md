# SPLATTERDRIFT 手感反馈矩阵

| Event | Player intent | Immediate acknowledgement | Result | Visual/motion | Audio/haptic | Intensity 1–5 | Recovery/next | Reduced mode |
|---|---|---|---|---|---|---:|---|---|
| 触摸预瞄 | 确认方向 | 同帧转向并更新虚线准星 | 65ms 内不误射 | 枪口和准星转向 | 无 | 1 | 移动 10px 或按住武装 | 保留 |
| 射击 | 攻击并推进 | 同帧弹丸、飞船压缩 | 反向 42px/s 冲量 | 彩色短弹丸、90ms 压缩 | 低频脉冲 | 1 | 松手或继续连射 | 取消压缩 |
| 大岩体命中 | 分裂目标 | 命中点爆墨 | 生成 2 个小岩体与制动花 | 10–14 粒子、彩色双环 | 双层命中音、10ms 震动 | 2 | 追击分裂体或规划回收 | 5–7 粒子 |
| 小岩体清除 | 清场得分 | 更亮的命中声与爆墨 | 清除、计分、连击 | 8–11 粒子、制动花 | 上扬三角波、14ms 震动 | 3 | 连续命中维持倍率 | 4–6 粒子 |
| 制动花吸收 | 主动消除惯性 | 同帧速度乘 0.48 | 加分、延长连击窗口 | 双环收束、墨点向飞船聚拢 | 下降正弦、12ms 震动 | 3 | 重新选择射击方向 | 瞬时消失，不聚拢 |
| 连击提升 | 维持精准命中 | 飞船附近出现 ×N | 倍率最高 ×4 | 无面板浮标 | 复用命中音 | 3 | 2 秒内继续命中 | 保留文本 |
| 碰撞 | 识别风险与损失 | 同帧危险环和轮廓闪烁 | -1 完整度、回中心、1.15s 无敌 | 红环、闪烁 | 低频锯齿 | 4 | 无敌期重新定向 | 不闪烁，保留红环 |
| 获胜 | 清空轨道 | 结局层出现 | 保存最高分 | 米白结果层 + 墨色底线 | 四音上行 | 4 | 再漂一次 | 保留 |
| 失败 | 理解完整度耗尽 | “完整度归零” | 保存最高分 | 结果层 | 碰撞低音追加尾音 | 5 | 再漂一次 | 保留 |

## Timing notes

- Input-to-feedback target：触摸预瞄同帧；移动超过 10 逻辑像素立即开火；静止按住 65ms 武装。
- Anticipation duration：只用于防误射的 65ms，不阻塞方向反馈。
- Contact/impact frame：权威弹丸命中帧生成 hit 事件。
- Peak duration：射击 90ms；命中粒子 240–520ms；制动吸收 180ms；碰撞 220ms。
- Settle/recovery duration：制动花 8s；碰撞无敌 1.15s；结果层即时稳定。
- Async completion behavior：无网络、生成或保存阻塞；最高分只写本地。

## Intensity ladder

1. Routine：预瞄、单发、连射。
2. Success：大岩体分裂。
3. Streak/progress：小岩体清除、连击、制动花吸收。
4. Rare reward/completion：轨道清空。
5. Critical danger/failure：碰撞与完整度归零。

## Verification evidence

- Required video/frame sequence：`_qa/ui/final-platform-layout-{idle,hit,brake,result}-*.png`。
- Repetition stress test：引擎 30/60fps 固定步长一致；浏览器触摸序列验证按住、松手与对象上限。
- Audio-muted behavior：`?mute=1` 不创建 AudioContext，玩法不受影响。
- Reduced-motion behavior：低粒子档、无压缩/呼吸/聚拢动画，权威运动保留。
- Known exceptions：无真机音频/震动证据；上线前仍需 iOS 与 Android 真人试玩。
