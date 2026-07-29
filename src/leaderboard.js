import { t } from "./i18n.js";

const ALTERU_APP_URL = "https://alteru.app";
const POSTER_URL = "https://yinxinghuan.github.io/games/posters/splatterdrift.png";
const POSTER_PROMPT = "A lone ring-shaped spacecraft firing through a graphite asteroid field, leaving restrained cyan particle recoil trails and a bright impact vortex.";

function rowsFromResponse(response) {
  const rows = Array.isArray(response) ? response : response?.data;
  return Array.isArray(rows)
    ? rows
      .map((row) => ({ ...row, score: Number(row.score) || 0, rank: Number(row.rank) || 0 }))
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    : [];
}

function initialFor(name) {
  return ((name || "?").trim().charAt(0) || "?").toUpperCase();
}

function avatarFor(row, className) {
  const wrapper = document.createElement("span");
  wrapper.className = className;
  wrapper.setAttribute("aria-hidden", "true");
  if (row.head_url) {
    const image = document.createElement("img");
    image.src = row.head_url;
    image.alt = "";
    image.draggable = false;
    image.addEventListener("error", () => {
      wrapper.textContent = initialFor(row.user_name);
    }, { once: true });
    wrapper.appendChild(image);
  } else {
    wrapper.textContent = initialFor(row.user_name);
  }
  return wrapper;
}

export class SplatterdriftLeaderboard {
  constructor({ champion, modal, list, close, resultButton }) {
    this.champion = champion;
    this.modal = modal;
    this.list = list;
    this.closeButton = close;
    this.resultButton = resultButton;
    this.rows = [];
    this.preRunBest = 0;
    this.runSnapshotTaken = false;
    this.runSnapshotReliable = false;
    this.hasFetched = false;
    this.lastFocused = null;
    this.api = window.Aigram;
    this.meId = this.api?.telegramId ? String(this.api.telegramId) : "";

    this.champion.addEventListener("click", () => this.open());
    this.resultButton.addEventListener("click", () => this.open());
    this.closeButton.addEventListener("click", () => this.close());
    this.modal.addEventListener("click", (event) => {
      if (event.target === this.modal) this.close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.modal.hidden) this.close();
    });

    if (this.api?.canRank) {
      this.champion.hidden = false;
      this.renderChampion();
      this.refresh().catch(() => {});
    }
  }

  isMe(row) {
    return Boolean(this.meId && String(row.user_id) === this.meId);
  }

  beginRun() {
    if (this.runSnapshotTaken) return;
    this.runSnapshotTaken = true;
    this.runSnapshotReliable = this.hasFetched;
    const me = this.rows.find((row) => this.isMe(row));
    this.preRunBest = me ? rowScore(me) : 0;
  }

  resetRun() {
    this.runSnapshotTaken = false;
    this.runSnapshotReliable = false;
    this.preRunBest = 0;
  }

  async refresh() {
    if (!this.api?.canRank) return [];
    const response = await this.api.callAigramAPI(
      `/note/aigram/ai/game/rank/score/list/by/session_id?session_id=${encodeURIComponent(this.api.gameUuid)}`,
      "GET",
    );
    this.rows = rowsFromResponse(response);
    this.hasFetched = true;
    this.renderChampion();
    if (!this.modal.hidden) this.renderRows();
    return this.rows;
  }

  renderChampion() {
    this.champion.replaceChildren();
    const leader = this.rows[0];
    const orbit = document.createElement("span");
    orbit.className = "sd-champion__orbit";
    orbit.setAttribute("aria-hidden", "true");
    orbit.innerHTML = '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/><path d="M10 1.5v3M17.4 6.2l-2.6 1.5M17.4 13.8l-2.6-1.5"/></svg>';
    this.champion.appendChild(orbit);

    if (!leader) {
      const label = document.createElement("span");
      label.className = "sd-champion__fallback";
      label.textContent = t("leaders");
      this.champion.appendChild(label);
      this.champion.setAttribute("aria-label", t("openLeaderboard"));
      return;
    }

    if (!this.isMe(leader)) this.champion.appendChild(avatarFor(leader, "sd-champion__avatar"));
    const identity = document.createElement("span");
    identity.className = "sd-champion__identity";
    const name = document.createElement("span");
    name.className = "sd-champion__name";
    name.textContent = this.isMe(leader) ? t("you") : (leader.user_name || "?");
    const score = document.createElement("b");
    score.className = "sd-champion__score";
    score.textContent = String(rowScore(leader));
    identity.append(name, score);
    this.champion.appendChild(identity);
    this.champion.setAttribute("aria-label", `${t("openLeaderboard")}: ${name.textContent} ${score.textContent}`);
  }

  renderState(message, className = "") {
    this.list.replaceChildren();
    const state = document.createElement("div");
    state.className = `sd-leaderboard__state ${className}`.trim();
    state.textContent = message;
    this.list.appendChild(state);
  }

  renderDownload() {
    this.list.replaceChildren();
    const state = document.createElement("div");
    state.className = "sd-leaderboard__state sd-leaderboard__download";
    const mark = document.createElement("span");
    mark.className = "sd-leaderboard__download-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="9"/><path d="M16 2v5M26 7l-4 4M30 18h-5"/></svg>';
    const copy = document.createElement("p");
    copy.textContent = t("leaderboardAlterU");
    const link = document.createElement("a");
    link.href = ALTERU_APP_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = t("getAlterU");
    state.append(mark, copy, link);
    this.list.appendChild(state);
  }

  renderRows() {
    if (!this.api?.canRank) {
      this.renderDownload();
      return;
    }
    if (!this.rows.length) {
      this.renderState(t("leaderboardEmpty"));
      return;
    }
    this.list.replaceChildren();
    for (const row of this.rows) {
      const self = this.isMe(row);
      const item = document.createElement(self ? "div" : "button");
      item.className = `sd-leaderboard__row${self ? " is-self" : ""}`;
      if (!self) {
        item.type = "button";
        item.addEventListener("click", () => {
          if (this.api?.isInAigram && row.user_id) this.api.openAigramProfile(row.user_id);
        });
        item.setAttribute("aria-label", `${t("openProfile")} ${row.user_name || "?"}`);
      }
      const rank = document.createElement("span");
      rank.className = "sd-leaderboard__rank";
      rank.textContent = `#${row.rank || "—"}`;
      item.appendChild(rank);
      if (self) {
        const selfLabel = document.createElement("span");
        selfLabel.className = "sd-leaderboard__self";
        selfLabel.textContent = t("you");
        item.appendChild(selfLabel);
      } else {
        item.appendChild(avatarFor(row, "sd-leaderboard__avatar"));
        const name = document.createElement("span");
        name.className = "sd-leaderboard__name";
        name.textContent = row.user_name || "?";
        item.appendChild(name);
      }
      const score = document.createElement("b");
      score.className = "sd-leaderboard__score";
      score.textContent = String(rowScore(row));
      item.appendChild(score);
      this.list.appendChild(item);
    }
  }

  async open() {
    this.lastFocused = document.activeElement;
    this.modal.hidden = false;
    document.body.classList.add("sd-modal-open");
    if (!this.api?.canRank) {
      this.renderDownload();
    } else {
      this.renderRows();
      this.refresh().catch(() => {
        if (!this.rows.length) this.renderState(t("leaderboardError"));
      });
    }
    requestAnimationFrame(() => this.closeButton.focus({ preventScroll: true }));
  }

  close() {
    this.modal.hidden = true;
    document.body.classList.remove("sd-modal-open");
    this.lastFocused?.focus?.({ preventScroll: true });
  }

  async submit(score) {
    const finalScore = Math.max(0, Math.round(score));
    if (!this.api?.canRank || finalScore <= 0) return;
    if (!this.runSnapshotTaken) this.beginRun();
    try {
      await this.api.callAigramAPI("/note/aigram/ai/game/rank/score/save", "POST", {
        session_id: this.api.gameUuid,
        score: finalScore,
      });
      await this.sendBeatNotify(finalScore);
      window.setTimeout(() => this.refresh().catch(() => {}), 900);
    } catch {
      // Ranking must never delay or break the result screen.
    }
  }

  async sendBeatNotify(finalScore) {
    if (
      !this.api?.canRank
      || !this.api.telegramId
      || !this.runSnapshotReliable
      || finalScore <= this.preRunBest
    ) return;
    try {
      const fresh = await this.refresh();
      const beaten = fresh
        .filter((row) => !this.isMe(row))
        .map((row) => ({ id: String(row.user_id), score: rowScore(row) }))
        .filter((row) => row.score < finalScore && row.score > this.preRunBest)
        .sort((a, b) => b.score - a.score)[0];
      if (!beaten?.id || beaten.id === this.meId) return;
      this.api.postAigramAPI("/note/aigram/ai/game/record/play", {
        session_id: this.api.gameUuid,
        event: "score_beat",
        config_json: {
          actions: [{
            type: "notify",
            target_user_id: beaten.id,
            image: {
              ref_url: POSTER_URL,
              prompt: POSTER_PROMPT,
            },
            message: {
              template: `${t("notifyBeat")} ${finalScore} ${t("points")} — SPLATTERDRIFT.`,
              variables: ["sender_name"],
            },
          }],
        },
      });
    } catch {
      // Notifications are best-effort and intentionally silent.
    }
  }
}

function rowScore(row) {
  return Number(row?.score) || 0;
}
