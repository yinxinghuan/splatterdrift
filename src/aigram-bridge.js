/* aigram-bridge.js — vanilla-JS twin of shared/runtime/bridge.ts
 *
 * Synced from /Users/yin/code/games/shared/vanilla/aigram-bridge.js.
 * Keep the callAigramAPI / postAigramAPI envelope and iOS bridge intact.
 */
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const rawOrigin = params.get("api_origin");
  const apiOrigin = rawOrigin ? decodeURIComponent(rawOrigin) : null;
  const telegramId = params.get("telegram_id") || null;
  const metaUuid = document.querySelector('meta[name="game-uuid"]');
  const gameUuid = window.__GAME_UUID__
    || (metaUuid && metaUuid.getAttribute("content"))
    || params.get("session_id")
    || null;
  const isGuestShellVisitor = telegramId === "__alteru_guest__";
  const isInAigram = Boolean(apiOrigin && telegramId && !isGuestShellVisitor);
  const canRank = isInAigram && Boolean(gameUuid);

  function toB64(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function fromB64(value) {
    return decodeURIComponent(escape(atob(value)));
  }

  function sendEnvelope(payload) {
    const target = window;
    if (
      target.webkit
      && target.webkit.messageHandlers
      && target.webkit.messageHandlers.aigram
    ) {
      target.webkit.messageHandlers.aigram.postMessage(`callAPI-${payload}`);
    } else {
      window.parent.postMessage(`callAPI-${payload}`, apiOrigin || "*");
    }
  }

  function callAigramAPI(url, method = "GET", data = null) {
    return new Promise((resolve, reject) => {
      const requestId = crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let timer;
      const payload = toB64(JSON.stringify({
        url,
        method,
        data,
        request_id: requestId,
        emitter: window.location.origin,
      }));

      function cleanup() {
        window.removeEventListener("message", handler);
        try {
          delete window[callbackKey];
        } catch {
          window[callbackKey] = undefined;
        }
      }

      function finish(result) {
        clearTimeout(timer);
        cleanup();
        if (result.success) resolve(result.data);
        else reject(new Error(result.error || "API error"));
      }

      const callbackKey = `__aigram_cb_${requestId.replace(/-/g, "_")}`;
      window[callbackKey] = (resultJson) => {
        try {
          const result = JSON.parse(resultJson);
          if (result.request_id !== requestId) return;
          finish(result);
        } catch {
          // Ignore malformed native responses; timeout is the fallback.
        }
      };

      function handler(event) {
        if (apiOrigin && event.origin !== apiOrigin) return;
        const message = typeof event.data === "string" ? event.data : "";
        if (!message.startsWith("callAPIResult-")) return;
        try {
          const result = JSON.parse(fromB64(message.slice("callAPIResult-".length)));
          if (result.request_id !== requestId) return;
          finish(result);
        } catch {
          // Ignore unrelated or malformed messages.
        }
      }
      window.addEventListener("message", handler);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error("timeout"));
      }, 10000);

      sendEnvelope(payload);
    });
  }

  function postAigramAPI(url, data) {
    const requestId = crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = toB64(JSON.stringify({
      url,
      method: "post",
      data,
      request_id: requestId,
      emitter: window.location.origin,
    }));
    sendEnvelope(payload);
  }

  function sendAW(message) {
    try {
      if (
        window.webkit
        && window.webkit.messageHandlers
        && window.webkit.messageHandlers.aigram
      ) {
        window.webkit.messageHandlers.aigram.postMessage(message);
        return;
      }
      if (apiOrigin) window.parent.postMessage(message, new URL(apiOrigin).origin);
    } catch {
      // System navigation is best-effort.
    }
  }

  function openAigramProfile(userId) {
    if (!userId) return;
    sendAW(`AW.PROFILE.OPEN-${btoa(JSON.stringify({ id: String(userId) }))}`);
  }

  function openAigramPost(postId) {
    if (!postId) return;
    sendAW(`AW.POST.OPEN-${btoa(JSON.stringify({ post_id: String(postId) }))}`);
  }

  window.Aigram = {
    apiOrigin,
    telegramId,
    gameUuid,
    isInAigram,
    canRank,
    callAigramAPI,
    postAigramAPI,
    openAigramProfile,
    openAigramPost,
  };
})();
