const copy = {
  zh: {
    title: "SPLATTERDRIFT",
    eyebrow: "溅迹漂移",
    time: "秒",
    integrity: "完整度",
    targets: "场上",
    score: "分",
    hint: "朝哪里射，就往反方向漂",
    hintBrake: "穿过粒子涡旋，立刻消除惯性",
    won: "轨道清空",
    failed: "完整度归零",
    timeEnd: "漂移结束",
    cleared: "清除",
    accuracy: "命中",
    maxCombo: "最高连击",
    brakes: "主动制动",
    best: "最高分",
    replay: "再漂一次",
    unsupported: "当前浏览器不支持 Pointer Events，无法安全运行这款触控游戏。",
  },
  en: {
    title: "SPLATTERDRIFT",
    eyebrow: "RECOIL ORBIT",
    time: "SEC",
    integrity: "HULL",
    targets: "FIELD",
    score: "SCORE",
    hint: "Fire one way. Drift the other.",
    hintBrake: "Cross a particle vortex to cut your momentum.",
    won: "ORBIT CLEARED",
    failed: "HULL LOST",
    timeEnd: "DRIFT COMPLETE",
    cleared: "CLEARED",
    accuracy: "ACCURACY",
    maxCombo: "MAX CHAIN",
    brakes: "BRAKES",
    best: "BEST",
    replay: "DRIFT AGAIN",
    unsupported: "This browser does not support Pointer Events, so touch control cannot run safely.",
  },
};

export function detectLocale() {
  const override = localStorage.getItem("game_locale");
  if (override === "zh" || override === "en") return override;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const locale = detectLocale();

export function t(key) {
  return copy[locale][key] ?? key;
}
