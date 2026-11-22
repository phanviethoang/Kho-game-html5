/**
 * ============================================================================
 * UNIVERSAL EDTECH GAME BRIDGE v2.0 (00_SHARED_ASSETS/pyquest-bridge.js)
 * Tương thích: PyQuest Arena & mọi dự án EdTech nhúng qua iframe hoặc chạy độc lập.
 * Tính năng:
 *   - Tự động bắt tay GAME_READY tránh mất gói tin khởi tạo.
 *   - Hỗ trợ đa dự án (projectId, currencyLabel, theme, soundEnabled, language).
 *   - Nhận cấu hình động (gameConfig), bộ câu hỏi (questions) & tiến trình cũ (savedState).
 *   - Tự động đếm thao tác chống gian lận (inputEvents) & gửi kết quả chuẩn GAME_OVER.
 * ============================================================================
 */
(function (global) {
  "use strict";

  const params = new URLSearchParams(window.location.search);

  const PyQuestBridge = {
    version: "2.0",

    // Trạng thái chuẩn dùng chung cho mọi game
    state: {
      projectId: params.get("projectId") || (window.parent === window ? "standalone" : "pyquest_arena"),
      currencyLabel: params.get("currency") || "XP",
      theme: params.get("theme") || "cyber_arena",
      soundEnabled: params.get("sound") !== "0",
      language: params.get("lang") || "vi",
      mode: params.get("mode") || "normal",

      studentId: params.get("studentId") || "",
      sessionId: params.get("sessionId") || "",
      subtopicId: params.get("subtopicId") || "",
      level: Number(params.get("level") || 1),
      currentXp: Number(params.get("xp") || 0),
      winCount: Number(params.get("wins") || 0),
      totalAttempts: Number(params.get("attempts") || 0),
      potentialRewardXp: 0,

      // Dữ liệu mở rộng cho khả năng tái sử dụng đa màn / đa môn
      gameConfig: {},
      questions: [],
      savedState: null,

      // Bộ đếm vận hành & chống gian lận tự động
      startedAt: Date.now(),
      isFinished: false,
      inputEvents: 0,
      focusLostCount: 0
    },

    _handlers: {
      onInit: null,
      onStart: null,
      onPowerup: null,
      onRestart: null,
      onSettingsChange: null
    },

    /**
     * Khởi tạo cầu nối trong từng game
     * @param {Object} handlers { onInit, onStart, onPowerup, onRestart, onSettingsChange }
     */
    setup(handlers = {}) {
      Object.assign(this._handlers, handlers);
      this._applyThemeAttribute();
      this._renderTopStatusBar();
      this._bindTelemetryListeners();

      // Báo hiệu cho hệ thống cha biết game đã tải xong và sẵn sàng nhận GAME_INIT
      this.sendToParent({
        type: "GAME_READY",
        bridgeVersion: this.version
      });

      // Nếu chạy độc lập (Standalone) hoặc đã có tham số URL, kích hoạt onInit ngay
      if (this.state.projectId === "standalone" || this.state.studentId) {
        if (typeof this._handlers.onInit === "function") {
          this._handlers.onInit(this.state);
        }
      }
    },

    /**
     * Lấy giá trị cấu hình động từ gameConfig kèm giá trị mặc định an toàn
     */
    getConfig(key, defaultValue) {
      if (this.state.gameConfig && Object.prototype.hasOwnProperty.call(this.state.gameConfig, key)) {
        return this.state.gameConfig[key];
      }
      return defaultValue;
    },

    sendToParent(payload) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, "*");
      }
    },

    /**
     * Cập nhật tiến độ hạ Boss theo thời gian thực (0 -> 100)
     */
    reportProgress(scorePercent) {
      if (this.state.isFinished) return;
      const cleanScore = Math.min(100, Math.max(0, Math.round(Number(scorePercent || 0))));
      this.sendToParent({
        type: "GAME_PROGRESS",
        projectId: this.state.projectId,
        studentId: this.state.studentId,
        sessionId: this.state.sessionId,
        progress: cleanScore,
        score: cleanScore
      });
    },

    /**
     * Lưu điểm dừng (Checkpoint) giữa ván chơi mà chưa kết thúc game
     */
    saveCheckpoint(savedStateObj) {
      this.state.savedState = savedStateObj;
      this.sendToParent({
        type: "GAME_CHECKPOINT",
        projectId: this.state.projectId,
        studentId: this.state.studentId,
        sessionId: this.state.sessionId,
        savedState: savedStateObj
      });
    },

    /**
     * Gọi 1 lần khi ván chơi kết thúc để lưu điểm & thống kê vào CSDL dự án mẹ
     * @param {boolean} won true = Thắng, false = Thua
     * @param {number} score Điểm số (0..100)
     * @param {Object} extraData { stats: {...}, nextSavedState: {...} }
     */
    finishGame(won, score = 100, extraData = {}) {
      if (this.state.isFinished) return;
      this.state.isFinished = true;

      const durationSec = Math.max(1, Math.round((Date.now() - this.state.startedAt) / 1000));
      const cleanScore = Math.min(100, Math.max(0, Math.round(Number(score || 0))));

      this.sendToParent({
        type: "GAME_OVER",
        projectId: this.state.projectId,
        studentId: this.state.studentId,
        sessionId: this.state.sessionId,
        won: Boolean(won),
        score: cleanScore,
        durationSec: durationSec,
        stats: extraData.stats || {},
        nextSavedState: extraData.nextSavedState !== undefined ? extraData.nextSavedState : this.state.savedState,
        antiCheat: {
          inputEvents: this.state.inputEvents,
          focusLostCount: this.state.focusLostCount
        }
      });
    },

    _applyThemeAttribute() {
      if (document.documentElement) {
        document.documentElement.setAttribute("data-pq-theme", this.state.theme);
      }
    },

    _bindTelemetryListeners() {
      if (this._telemetryBound) return;
      this._telemetryBound = true;

      const countInput = () => {
        if (!this.state.isFinished) this.state.inputEvents++;
      };
      window.addEventListener("pointerdown", countInput, { passive: true });
      window.addEventListener("keydown", countInput, { passive: true });
      window.addEventListener("blur", () => {
        if (!this.state.isFinished) this.state.focusLostCount++;
      });
    },

    _renderTopStatusBar() {
      // Cho phép tắt HUD nếu gameConfig.hideHud === true
      if (this.state.gameConfig && this.state.gameConfig.hideHud) return;

      let bar = document.getElementById("pq-shared-hud");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "pq-shared-hud";
        document.body.prepend(bar);
      }
      const s = this.state;
      const modeBadge = s.mode === "preview" ? `<div class="pq-hud-item pq-badge-warn">🛠️ Chế độ Kiểm thử</div>` : "";
      bar.innerHTML = `
        <div class="pq-hud-group">
          <div class="pq-hud-item">👤 <strong>${s.studentId || "Chế độ Thử"}</strong></div>
          <div class="pq-hud-item">⚡ ${s.currencyLabel}: <strong>${s.currentXp}</strong></div>
          <div class="pq-hud-item">🏆 Thắng: <strong>${s.winCount}</strong></div>
          <div class="pq-hud-item">🎯 Lượt: <strong>${s.totalAttempts}</strong></div>
          <div class="pq-hud-item">👾 Cấp: <strong>${s.level}</strong></div>
        </div>
        <div class="pq-hud-group">
          ${modeBadge}
          <div class="pq-hud-item">${s.soundEnabled ? "🔊 Âm bật" : "🔇 Tắt tiếng"}</div>
        </div>
      `;
    }
  };

  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    switch (data.type) {
      case "GAME_INIT":
      case "GAME_START": {
        const s = PyQuestBridge.state;
        s.projectId = data.projectId || s.projectId;
        s.currencyLabel = data.currencyLabel || s.currencyLabel;
        s.theme = data.theme || s.theme;
        if (data.soundEnabled !== undefined) s.soundEnabled = Boolean(data.soundEnabled);
        s.language = data.language || s.language;
        s.mode = data.mode || s.mode;

        s.studentId = data.studentId || s.studentId;
        s.sessionId = data.sessionId || s.sessionId;
        s.subtopicId = data.subtopicId || s.subtopicId;
        s.level = Number(data.level || s.level || 1);
        s.currentXp = Number(data.currentXp ?? s.currentXp);
        s.winCount = Number(data.winCount ?? s.winCount);
        s.totalAttempts = Number(data.totalAttempts ?? s.totalAttempts);
        s.potentialRewardXp = Number(data.potentialRewardXp || 0);

        if (data.gameConfig && typeof data.gameConfig === "object") s.gameConfig = data.gameConfig;
        if (Array.isArray(data.questions)) s.questions = data.questions;
        if (data.savedState !== undefined) s.savedState = data.savedState;

        PyQuestBridge._applyThemeAttribute();
        PyQuestBridge._renderTopStatusBar();

        if (data.type === "GAME_INIT" && typeof PyQuestBridge._handlers.onInit === "function") {
          PyQuestBridge._handlers.onInit(s);
        }
        if (data.type === "GAME_START" && typeof PyQuestBridge._handlers.onStart === "function") {
          s.startedAt = Date.now();
          s.isFinished = false;
          s.inputEvents = 0;
          s.focusLostCount = 0;
          PyQuestBridge._handlers.onStart(s);
        }
        break;
      }

      case "GAME_POWERUP":
        if (typeof PyQuestBridge._handlers.onPowerup === "function") {
          PyQuestBridge._handlers.onPowerup(data.item, Number(data.cost || 0));
        }
        break;

      case "GAME_SYNC_SETTINGS":
        if (data.soundEnabled !== undefined) PyQuestBridge.state.soundEnabled = Boolean(data.soundEnabled);
        if (data.theme) {
          PyQuestBridge.state.theme = data.theme;
          PyQuestBridge._applyThemeAttribute();
        }
        PyQuestBridge._renderTopStatusBar();
        if (typeof PyQuestBridge._handlers.onSettingsChange === "function") {
          PyQuestBridge._handlers.onSettingsChange(PyQuestBridge.state);
        }
        break;

      case "GAME_RESTART":
        PyQuestBridge.state.startedAt = Date.now();
        PyQuestBridge.state.isFinished = false;
        PyQuestBridge.state.inputEvents = 0;
        PyQuestBridge.state.focusLostCount = 0;
        if (typeof PyQuestBridge._handlers.onRestart === "function") {
          PyQuestBridge._handlers.onRestart(PyQuestBridge.state);
        }
        break;
    }
  });

  global.PyQuestBridge = PyQuestBridge;
})(window);
