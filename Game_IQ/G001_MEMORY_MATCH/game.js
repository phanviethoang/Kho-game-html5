
/* =====================================================
   G001 - MEMORY MATCH
   Version: 7.0.0
   Protocol: PyQuest Bridge 1.0

   - Fixed board: 6 x 6 = 36 cards
   - 18 matching pairs, no distractor cards
   - Level supplied by external system
   - 72 initial manual opens at every level
   - Help: reveal a pair (-10 XP)
   - Help: add 10 opens (-10 XP)
   ===================================================== */

(() => {
  "use strict";

  // -----------------------------------------------------
  // 1. GAME CONFIGURATION
  // -----------------------------------------------------

  const TOTAL_PAIRS = 18;
  const TOTAL_CARDS = 36;
  const INITIAL_OPENS = 72;
  const HELP_COST = 10;
  const EXTRA_OPENS = 10;

  const LEVELS = [
    { level: 1, types: 2, title: "Khởi động" },
    { level: 2, types: 3, title: "Dễ" },
    { level: 3, types: 4, title: "Trung bình" },
    { level: 4, types: 5, title: "Khó" },
    { level: 5, types: 6, title: "Thử thách" }
  ];

  const SYMBOLS = [
    "🐶", "🐱", "🐰", "🦊", "🐼", "🦁",
    "🐸", "🐵", "🐯", "🐷", "🐨", "🐮",
    "🐻", "🐔", "🐧", "🐦", "🦉", "🦋",
    "🐢", "🐙", "🦀", "🐬", "🐳", "🦈",
    "🍎", "🍊", "🍉", "🍇", "🍓", "🍍",
    "🍌", "🥕", "🌽", "🍄", "⚽", "🚗"
  ];

  // -----------------------------------------------------
  // 2. DOM ELEMENTS
  // -----------------------------------------------------

  const $ = (id) => document.getElementById(id);

  const boardElement = $("gameBoard");
  const remainingOpensElement = $("remainingOpens");
  const matchedCountElement = $("matchedCount");
  const timerElement = $("timer");
  const progressTextElement = $("progressText");
  const progressBarElement = $("progressBar");
  const xpValueElement = $("xpValue");
  const messageElement = $("message");

  const revealPairButton = $("revealPairBtn");
  const addOpensButton = $("addOpensBtn");
  const soundButton = $("soundBtn");

  const resultModal = $("resultModal");
  const resultIcon = $("resultIcon");
  const resultTitle = $("resultTitle");
  const resultMessage = $("resultMessage");
  const finalPairsElement = $("finalPairs");
  const finalOpensElement = $("finalOpens");
  const finalTimeElement = $("finalTime");
  const finalXpSpentElement = $("finalXpSpent");
  const finalXpTextElement = $("finalXpText");

  // -----------------------------------------------------
  // 3. GAME STATE
  // -----------------------------------------------------

  let currentLevel = 1;
  let currentLevelConfig = LEVELS[0];

  let cards = [];
  let firstCard = null;
  let secondCard = null;

  let matchedPairs = 0;
  let remainingOpens = INITIAL_OPENS;
  let totalManualOpens = 0;
  let totalMoves = 0;
  let wrongPairs = 0;
  let assistedPairs = 0;
  let extraOpenPurchases = 0;
  let helpRevealUses = 0;

  let initialXp = 0;
  let currentXp = 0;
  let xpSpent = 0;

  let gameStarted = false;
  let gameFinished = false;
  let lockBoard = false;
  let soundEnabled = true;

  let startedAt = 0;
  let elapsedSeconds = 0;
  let timerInterval = null;
  let turnTimeout = null;

  let bridgeInitialized = false;
  let standaloneMode = false;

  // -----------------------------------------------------
  // 4. UTILITIES
  // -----------------------------------------------------

  function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0")
    );
  }

  function getElapsedSeconds() {
    if (!startedAt) return elapsedSeconds;
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  }

  function playSound(name) {
    if (!soundEnabled) return;

    try {
      if (window.SoundManager && typeof window.SoundManager.play === "function") {
        window.SoundManager.play(name);
      } else if (typeof window.playSound === "function") {
        window.playSound(name);
      }
    } catch (error) {
      console.warn("Không thể phát âm thanh:", error);
    }
  }

  function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.className = "message";

    if (type) {
      messageElement.classList.add(type);
    }
  }

  function getBridgeState() {
    try {
      if (window.PyQuestBridge && window.PyQuestBridge.state) {
        return window.PyQuestBridge.state;
      }
    } catch (error) {
      console.warn("Không đọc được trạng thái Bridge:", error);
    }

    return {};
  }

  function getLevelFromState(state) {
    const rawLevel =
      state?.level ??
      state?.gameConfig?.level ??
      1;

    const parsed = Number(rawLevel);

    if (!Number.isFinite(parsed)) return 1;

    return Math.min(5, Math.max(1, Math.floor(parsed)));
  }

  function getXpFromState(state) {
    const value = Number(state?.currentXp ?? 0);

    if (!Number.isFinite(value)) return 0;

    return Math.max(0, Math.floor(value));
  }

  // -----------------------------------------------------
  // 5. CREATE A COMPLETE PAIR DISTRIBUTION
  // -----------------------------------------------------

  /*
    Example:
    2 types: 9, 9 pairs
    3 types: 6, 6, 6 pairs
    4 types: 5, 5, 4, 4 pairs
    5 types: 4, 4, 4, 3, 3 pairs
    6 types: 3, 3, 3, 3, 3, 3 pairs

    Every symbol always appears an even number of times.
    Therefore every card belongs to a matching pair.
  */

  function getPairDistribution(typeCount) {
    const base = Math.floor(TOTAL_PAIRS / typeCount);
    const remainder = TOTAL_PAIRS % typeCount;

    return Array.from(
      { length: typeCount },
      (_, index) => base + (index < remainder ? 1 : 0)
    );
  }

  function createDeck() {
    const typeCount = currentLevelConfig.types;

    const selectedSymbols = shuffle(SYMBOLS).slice(0, typeCount);
    const distribution = getPairDistribution(typeCount);

    const deck = [];

    selectedSymbols.forEach((symbol, index) => {
      const numberOfCards = distribution[index] * 2;

      for (let i = 0; i < numberOfCards; i++) {
        deck.push(symbol);
      }
    });

    if (deck.length !== TOTAL_CARDS) {
      throw new Error("Lỗi tạo bộ thẻ: số lượng thẻ không bằng 36.");
    }

    return shuffle(deck).map((symbol, index) => ({
      id: index,
      symbol,
      matched: false,
      element: null
    }));
  }

  // -----------------------------------------------------
  // 6. RENDER BOARD
  // -----------------------------------------------------

  function renderBoard() {
    boardElement.innerHTML = "";

    cards.forEach((card) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "memory-card";
      button.dataset.cardId = String(card.id);
      button.setAttribute("aria-label", "Thẻ úp");

      const back = document.createElement("span");
      back.className = "card-back";
      back.textContent = "?";

      const front = document.createElement("span");
      front.className = "card-front";
      front.textContent = card.symbol;

      button.append(back, front);

      button.addEventListener("click", () => {
        handleCardClick(card);
      });

      card.element = button;
      boardElement.appendChild(button);
    });
  }

  // -----------------------------------------------------
  // 7. UPDATE USER INTERFACE
  // -----------------------------------------------------

  function updateStats() {
    remainingOpensElement.textContent = remainingOpens;
    matchedCountElement.textContent = `${matchedPairs}/${TOTAL_PAIRS}`;

    const percent = Math.round((matchedPairs / TOTAL_PAIRS) * 100);

    progressTextElement.textContent = `${percent}%`;
    progressBarElement.style.width = `${percent}%`;

    xpValueElement.textContent = currentXp;

    updateHelpButtons();
  }

  function updateHelpButtons() {
    const canUseHelp =
      gameStarted &&
      !gameFinished &&
      !lockBoard &&
      currentXp >= HELP_COST;

    revealPairButton.disabled =
      !canUseHelp || matchedPairs >= TOTAL_PAIRS;

    addOpensButton.disabled =
      !canUseHelp || matchedPairs >= TOTAL_PAIRS;
  }

  // -----------------------------------------------------
  // 8. TIMER
  // -----------------------------------------------------

  function startTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    startedAt = Date.now();

    timerInterval = setInterval(() => {
      if (!gameStarted || gameFinished) return;

      elapsedSeconds = getElapsedSeconds();
      timerElement.textContent = formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    elapsedSeconds = getElapsedSeconds();
    timerElement.textContent = formatTime(elapsedSeconds);
  }

  // -----------------------------------------------------
  // 9. START GAME
  // -----------------------------------------------------

  function startGame() {
    if (gameStarted || gameFinished) return;

    gameStarted = true;

    startTimer();
    updateStats();

    setMessage("Hãy lật hai thẻ để tìm cặp hình giống nhau!");
    playSound("start");
  }

  // -----------------------------------------------------
  // 10. FLIP A CARD
  // -----------------------------------------------------

  function flipCard(card) {
    card.element.classList.add("flipped");
    card.element.setAttribute("aria-label", `Thẻ ${card.symbol}`);
  }

  function hideCard(card) {
    card.element.classList.remove("flipped");
    card.element.setAttribute("aria-label", "Thẻ úp");
  }

  function handleCardClick(card) {
    if (gameFinished || lockBoard) return;

  // Nếu hệ thống chưa gửi GAME_START,
  // lần bấm thẻ đầu tiên sẽ tự khởi động game.
     if (!gameStarted) {
       startGame();
     }

    if (card.matched) return;
    if (firstCard === card) return;

    // The second card of an already-started turn is still allowed,
    // even if the remaining open count has just reached zero.
    if (!firstCard && remainingOpens <= 0) {
      handleNoMoreOpens();
      return;
    }

    flipCard(card);
    playSound("flip");

    remainingOpens--;
    totalManualOpens++;

    updateStats();

    if (!firstCard) {
      firstCard = card;

      if (remainingOpens <= 0) {
        setMessage("Bạn đã hết lượt mở. Có thể dùng trợ giúp nếu còn XP.", "warning");
      }

      return;
    }

    secondCard = card;
    totalMoves++;

    lockBoard = true;
    updateHelpButtons();

    if (firstCard.symbol === secondCard.symbol) {
      handleCorrectPair();
    } else {
      handleWrongPair();
    }
  }

  // -----------------------------------------------------
  // 11. HANDLE A CORRECT PAIR
  // -----------------------------------------------------

  function handleCorrectPair() {
    firstCard.matched = true;
    secondCard.matched = true;

    firstCard.element.classList.add("matched");
    secondCard.element.classList.add("matched");

    firstCard.element.disabled = true;
    secondCard.element.disabled = true;

    matchedPairs++;

    playSound("correct");

    setMessage("Chính xác! Bạn đã tìm được một cặp hình.", "success");

    firstCard = null;
    secondCard = null;
    lockBoard = false;

    updateStats();

    reportProgress();

    if (matchedPairs >= TOTAL_PAIRS) {
      setTimeout(() => finishGame(true), 500);
      return;
    }

    if (remainingOpens <= 0) {
      handleNoMoreOpens();
    }
  }

  // -----------------------------------------------------
  // 12. HANDLE A WRONG PAIR
  // -----------------------------------------------------

  function handleWrongPair() {
    wrongPairs++;

    playSound("wrong");

    setMessage("Chưa đúng! Hãy ghi nhớ vị trí các hình nhé.", "warning");

    turnTimeout = setTimeout(() => {
      hideCard(firstCard);
      hideCard(secondCard);

      firstCard = null;
      secondCard = null;
      lockBoard = false;
      turnTimeout = null;

      updateHelpButtons();

      if (remainingOpens <= 0) {
        handleNoMoreOpens();
      } else {
        setMessage("Tiếp tục tìm các cặp hình giống nhau!");
      }
    }, 850);
  }

  // -----------------------------------------------------
  // 13. HELP 1: REVEAL ONE MATCHING PAIR
  // -----------------------------------------------------

  function revealOnePair() {
    if (gameFinished || !gameStarted || lockBoard) return;

    if (currentXp < HELP_COST) {
      setMessage("Bạn không đủ 10 XP để sử dụng trợ giúp.", "warning");
      return;
    }

    const availableCards = cards.filter((card) => !card.matched);

    if (availableCards.length < 2) return;

    // Find two unmatched cards with the same symbol.
    const pairMap = new Map();
    let targetPair = null;

    for (const card of availableCards) {
      if (pairMap.has(card.symbol)) {
        targetPair = [pairMap.get(card.symbol), card];
        break;
      }

      pairMap.set(card.symbol, card);
    }

    if (!targetPair) return;

    // Deduct XP locally.
    currentXp -= HELP_COST;
    xpSpent += HELP_COST;
    helpRevealUses++;

    lockBoard = true;
    updateStats();

    const [cardA, cardB] = targetPair;

    flipCard(cardA);
    flipCard(cardB);

    cardA.element.classList.add("matched");
    cardB.element.classList.add("matched");

    playSound("correct");

    setMessage("Trợ giúp đã mở một cặp hình. Bạn đã sử dụng 10 XP.", "success");

    setTimeout(() => {
      if (gameFinished) return;

      cardA.matched = true;
      cardB.matched = true;

      cardA.element.disabled = true;
      cardB.element.disabled = true;

      matchedPairs++;
      assistedPairs++;

      lockBoard = false;

      updateStats();
      reportProgress();

      if (matchedPairs >= TOTAL_PAIRS) {
        finishGame(true);
        return;
      }

      if (remainingOpens <= 0) {
        handleNoMoreOpens();
      } else {
        setMessage("Tiếp tục tìm các cặp hình còn lại!");
      }
    }, 750);
  }

  // -----------------------------------------------------
  // 14. HELP 2: ADD 10 OPENS
  // -----------------------------------------------------

  function addMoreOpens() {
    if (gameFinished || !gameStarted || lockBoard) return;

    if (currentXp < HELP_COST) {
      setMessage("Bạn không đủ 10 XP để mua thêm lượt mở.", "warning");
      return;
    }

    // Deduct XP locally.
    currentXp -= HELP_COST;
    xpSpent += HELP_COST;

    remainingOpens += EXTRA_OPENS;
    extraOpenPurchases++;

    updateStats();

    setMessage("Đã thêm 10 lượt mở. Bạn đã sử dụng 10 XP.", "success");
    playSound("collect");
  }

  // -----------------------------------------------------
  // 15. WHEN NO OPENS REMAIN
  // -----------------------------------------------------

  function handleNoMoreOpens() {
    if (gameFinished || lockBoard || firstCard) return;

    if (remainingOpens > 0) return;

    updateHelpButtons();

    if (currentXp >= HELP_COST) {
      setMessage(
        "Đã hết lượt mở! Bạn có thể dùng trợ giúp để tiếp tục.",
        "warning"
      );
      return;
    }

    setMessage(
      "Bạn đã hết lượt mở và không đủ XP để tiếp tục.",
      "error"
    );

    setTimeout(() => {
      if (
        !gameFinished &&
        remainingOpens <= 0 &&
        !firstCard &&
        !lockBoard &&
        currentXp < HELP_COST
      ) {
        finishGame(false);
      }
    }, 900);
  }

  // -----------------------------------------------------
  // 16. REPORT PROGRESS TO BRIDGE
  // -----------------------------------------------------

  function reportProgress() {
    const percent = Math.round((matchedPairs / TOTAL_PAIRS) * 100);

    try {
      if (
        window.PyQuestBridge &&
        typeof window.PyQuestBridge.reportProgress === "function"
      ) {
        window.PyQuestBridge.reportProgress(percent);
      }
    } catch (error) {
      console.warn("Không gửi được tiến độ:", error);
    }
  }

  // -----------------------------------------------------
  // 17. FINISH GAME
  // -----------------------------------------------------

  function finishGame(won) {
    if (gameFinished) return;

    gameFinished = true;
    gameStarted = false;
    lockBoard = true;

    if (turnTimeout) {
      clearTimeout(turnTimeout);
      turnTimeout = null;
    }

    stopTimer();

    const score = Math.round((matchedPairs / TOTAL_PAIRS) * 100);

    const result = {
      level: currentLevel,
      levelTitle: currentLevelConfig.title,
      types: currentLevelConfig.types,

      totalCards: TOTAL_CARDS,
      totalPairs: TOTAL_PAIRS,
      matchedPairs: matchedPairs,

      initialOpens: INITIAL_OPENS,
      remainingOpens: remainingOpens,
      totalManualOpens: totalManualOpens,
      totalMoves: totalMoves,

      wrongPairs: wrongPairs,
      assistedPairs: assistedPairs,

      helpRevealUses: helpRevealUses,
      extraOpenPurchases: extraOpenPurchases,
      extraOpensAdded: extraOpenPurchases * EXTRA_OPENS,

      initialXp: initialXp,
      finalXp: currentXp,
      xpSpent: xpSpent,

      durationSec: elapsedSeconds,
      scorePercent: score
    };

    showResult(won, result);

    // Send the final result to the external system.
    try {
      if (
        window.PyQuestBridge &&
        typeof window.PyQuestBridge.finishGame === "function"
      ) {
        window.PyQuestBridge.finishGame(won, score, result);
      } else {
        console.warn("Không tìm thấy PyQuestBridge.finishGame().");
      }
    } catch (error) {
      console.error("Lỗi gửi kết quả về hệ thống:", error);
    }
  }

  // -----------------------------------------------------
  // 18. SHOW RESULT
  // -----------------------------------------------------

  function showResult(won, result) {
    resultModal.classList.remove("hidden");

    if (won) {
      resultIcon.textContent = "🏆";
      resultTitle.textContent = "Xuất sắc!";
      resultMessage.textContent = "Bạn đã tìm đủ 18 cặp hình và hoàn thành trò chơi!";
      playSound("win");
    } else {
      resultIcon.textContent = "💪";
      resultTitle.textContent = "Kết thúc lượt chơi";
      resultMessage.textContent = "Bạn chưa tìm đủ các cặp hình. Hãy cố gắng hơn ở lần tiếp theo!";
      playSound("gameover");
    }

    finalPairsElement.textContent = `${result.matchedPairs}/${TOTAL_PAIRS}`;
    finalOpensElement.textContent = result.totalManualOpens;
    finalTimeElement.textContent = formatTime(result.durationSec);
    finalXpSpentElement.textContent = result.xpSpent;

    finalXpTextElement.textContent =
      `XP ban đầu: ${result.initialXp} | XP còn lại: ${result.finalXp}`;
  }

  // -----------------------------------------------------
  // 19. RESET GAME DATA
  // -----------------------------------------------------

  function resetGameData() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (turnTimeout) {
      clearTimeout(turnTimeout);
      turnTimeout = null;
    }

    cards = [];
    firstCard = null;
    secondCard = null;

    matchedPairs = 0;
    remainingOpens = INITIAL_OPENS;
    totalManualOpens = 0;
    totalMoves = 0;
    wrongPairs = 0;
    assistedPairs = 0;
    extraOpenPurchases = 0;
    helpRevealUses = 0;

    xpSpent = 0;

    gameStarted = false;
    gameFinished = false;
    lockBoard = false;

    startedAt = 0;
    elapsedSeconds = 0;

    timerElement.textContent = "00:00";
    resultModal.classList.add("hidden");

    updateStats();
  }

  // -----------------------------------------------------
  // 20. INITIALIZE GAME FROM EXTERNAL SYSTEM
  // -----------------------------------------------------

  function initializeGame(state = {}) {
    resetGameData();

    currentLevel = getLevelFromState(state);
    currentLevelConfig = LEVELS[currentLevel - 1];

    initialXp = getXpFromState(state);
    currentXp = initialXp;

    cards = createDeck();
    renderBoard();

    updateStats();

    setMessage("Sẵn sàng! Hãy lật hai thẻ để tìm cặp hình giống nhau.");

    console.log("G001 initialized:", {
      level: currentLevel,
      types: currentLevelConfig.types,
      pairs: TOTAL_PAIRS,
      cards: TOTAL_CARDS,
      opens: INITIAL_OPENS,
      initialXp,
      distribution: getPairDistribution(currentLevelConfig.types)
    });
  }

  // -----------------------------------------------------
  // 21. BRIDGE EVENT HANDLERS
  // -----------------------------------------------------

  function handleInit(state) {
    bridgeInitialized = true;
    initializeGame(state || {});
  }

  function handleStart() {
    if (!bridgeInitialized) {
      initializeGame(getBridgeState());
      bridgeInitialized = true;
    }

    startGame();
  }

  function handleRestart(state) {
    const latestState = state || getBridgeState();

    initializeGame(latestState);
    startGame();
  }

  function handlePowerup(data) {
    /*
      The game already provides its own two help buttons.
      This handler is reserved for external power-up messages.
      It does not deduct XP unless the external system defines
      a separate power-up protocol.
    */
    console.log("G001 received external power-up:", data);
  }

  function handleSettingsChange(settings) {
    if (!settings) return;

    if (typeof settings.soundEnabled === "boolean") {
      soundEnabled = settings.soundEnabled;

      if (window.SoundManager) {
        if (soundEnabled && typeof window.SoundManager.enable === "function") {
          window.SoundManager.enable();
        } else if (!soundEnabled && typeof window.SoundManager.disable === "function") {
          window.SoundManager.disable();
        }
      }

      updateSoundButton();
    }
  }

  // -----------------------------------------------------
  // 22. SOUND BUTTON
  // -----------------------------------------------------

  function updateSoundButton() {
    soundButton.textContent = soundEnabled ? "🔊" : "🔇";
    soundButton.setAttribute(
      "aria-label",
      soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"
    );
  }

  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    try {
      if (window.SoundManager) {
        if (soundEnabled && typeof window.SoundManager.enable === "function") {
          window.SoundManager.enable();
        } else if (!soundEnabled && typeof window.SoundManager.disable === "function") {
          window.SoundManager.disable();
        }
      }
    } catch (error) {
      console.warn("Không thể thay đổi âm thanh:", error);
    }

    updateSoundButton();
  });

  // -----------------------------------------------------
  // 23. HELP BUTTON EVENTS
  // -----------------------------------------------------

  revealPairButton.addEventListener("click", revealOnePair);
  addOpensButton.addEventListener("click", addMoreOpens);

  // -----------------------------------------------------
  // 24. CONNECT TO PYQUEST BRIDGE
  // -----------------------------------------------------

  function connectBridge() {
    if (
      window.PyQuestBridge &&
      typeof window.PyQuestBridge.setup === "function"
    ) {
      window.PyQuestBridge.setup({
        onInit: handleInit,
        onStart: handleStart,
        onPowerup: handlePowerup,
        onRestart: handleRestart,
        onSettingsChange: handleSettingsChange
      });

      return true;
    }

    return false;
  }

  // -----------------------------------------------------
  // 25. STANDALONE MODE
  // -----------------------------------------------------

  function startStandalone() {
    standaloneMode = true;

    initializeGame({
      level: 1,
      currentXp: 100
    });

    startGame();
  }

  
function bootGame() {
  updateSoundButton();

  const connected = connectBridge();

  // Không có Bridge: chạy độc lập
  if (!connected) {
    console.warn("PyQuestBridge không khả dụng. Chạy chế độ độc lập.");
    startStandalone();
    return;
  }

  const state = getBridgeState();

  // Luôn tạo bàn chơi ngay khi tải game
  if (!bridgeInitialized) {
    initializeGame(state);
    bridgeInitialized = true;
  }

  // Chế độ độc lập thì tự chạy ngay
  if (state.projectId === "standalone") {
    standaloneMode = true;
    startGame();
  }

  console.log("G001 đã sẵn sàng.");
}


  // -----------------------------------------------------
  // 26. START APPLICATION
  // -----------------------------------------------------

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGame);
  } else {
    bootGame();
  }

})();
