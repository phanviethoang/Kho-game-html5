
/* =====================================================
   G001 - MEMORY MATCH
   Version: 6.0
   Protocol: PyQuest Bridge v2.0

   XP được quản lý nội bộ trong game.
   Chỉ gửi XP cuối cùng qua GAME_OVER.
===================================================== */

const GAME_ID = "G001_MEMORY_MATCH";
const GAME_VERSION = "6.0";

const XP_HELP_COST = 10;
const EXTRA_OPENS = 10;

const LEVELS = [
    { level: 1, pairs: 4, title: "Khởi động", opens: 24 },
    { level: 2, pairs: 6, title: "Dễ", opens: 36 },
    { level: 3, pairs: 8, title: "Trung bình", opens: 48 },
    { level: 4, pairs: 10, title: "Khó", opens: 60 },
    { level: 5, pairs: 12, title: "Thử thách", opens: 72 }
];

const SYMBOLS = [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊",
    "🐻", "🐼", "🐨", "🐯", "🦁", "🐸",
    "🐵", "🐷", "🐮", "🐔", "🐧", "🐦",
    "🦋", "🐢", "🐙", "🦄", "🍎", "🍉"
];

// =====================================================
// DOM
// =====================================================

const gameBoard = document.getElementById("gameBoard");
const messageElement = document.getElementById("message");

const xpValue = document.getElementById("xpValue");
const openValue = document.getElementById("openValue");
const movesValue = document.getElementById("movesValue");
const timeValue = document.getElementById("timeValue");

const levelTitle = document.getElementById("levelTitle");
const levelProgress = document.getElementById("levelProgress");

const revealBtn = document.getElementById("revealBtn");
const addOpensBtn = document.getElementById("addOpensBtn");

const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultDetails = document.getElementById("resultDetails");

// =====================================================
// STATE
// =====================================================

let initialXp = 0;
let currentXp = 0;
let xpSpent = 0;

let currentLevel = 0;
let remainingOpens = 0;

let cards = [];
let firstCard = null;
let secondCard = null;

let lockBoard = true;
let gameStarted = false;
let gameFinished = false;
let boardCreated = false;

let matchedPairs = 0;

let totalMoves = 0;
let totalManualOpens = 0;
let totalWrongPairs = 0;
let totalCorrectPairs = 0;

let totalAssistedPairs = 0;
let revealHelpCount = 0;
let extraOpensHelpCount = 0;

let completedLevels = 0;
let highestLevel = 0;

let levelMoves = 0;
let levelWrongPairs = 0;
let levelCorrectPairs = 0;
let levelManualOpens = 0;
let levelAssistedPairs = 0;

let seconds = 0;
let timerInterval = null;
let mismatchTimeout = null;
let transitionTimeout = null;
let startedAt = null;

// =====================================================
// UTILS
// =====================================================

function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

function playSound(name) {
    if (typeof SoundManager !== "undefined") {
        SoundManager.play(name);
    }
}

function formatTime(value) {
    const minutes = Math.floor(value / 60);
    const secs = value % 60;

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function updateTimer() {
    timeValue.textContent = formatTime(seconds);
}

function updateXpDisplay() {
    xpValue.textContent = currentXp;
}

function updateOpenDisplay() {
    openValue.textContent = remainingOpens;
}

function updateMovesDisplay() {
    movesValue.textContent = totalMoves;
}

function updateHelpButtons() {
    const canUseHelp = gameStarted && !gameFinished && !lockBoard;

    revealBtn.disabled =
        !canUseHelp ||
        matchedPairs >= LEVELS[currentLevel].pairs ||
        currentXp < XP_HELP_COST;

    addOpensBtn.disabled =
        !canUseHelp ||
        currentXp < XP_HELP_COST;
}

function setMessage(message) {
    messageElement.textContent = message;
}

// =====================================================
// SOUND SETTINGS
// =====================================================

function syncSoundSettings(state) {
    if (typeof SoundManager === "undefined") return;

    if (state && state.soundEnabled === false) {
        SoundManager.disable();
    } else {
        SoundManager.enable();
    }
}

// =====================================================
// XP MANAGEMENT
// =====================================================

function spendXp(amount) {
    if (currentXp < amount) {
        setMessage("Bạn không đủ XP để sử dụng trợ giúp!");
        playSound("wrong");
        return false;
    }

    currentXp -= amount;
    xpSpent += amount;

    updateXpDisplay();

    return true;
}

// =====================================================
// LEVEL MANAGEMENT
// =====================================================

function updateLevelProgress() {
    const steps = levelProgress.querySelectorAll(".level-step");

    steps.forEach((step, index) => {
        step.classList.remove("active", "done");

        if (index < completedLevels) {
            step.classList.add("done");
            step.textContent = `✓ Level ${index + 1}`;
        } else {
            step.textContent = `Level ${index + 1}`;
        }

        if (index === currentLevel && !gameFinished) {
            step.classList.add("active");
        }
    });
}

function prepareLevel(levelIndex) {
    if (levelIndex < 0 || levelIndex >= LEVELS.length) {
        return;
    }

    currentLevel = levelIndex;

    const config = LEVELS[currentLevel];

    matchedPairs = 0;
    remainingOpens = config.opens;

    levelMoves = 0;
    levelWrongPairs = 0;
    levelCorrectPairs = 0;
    levelManualOpens = 0;
    levelAssistedPairs = 0;

    firstCard = null;
    secondCard = null;

    lockBoard = true;

    levelTitle.textContent =
        `Level ${config.level} - ${config.title} (${config.pairs} cặp)`;

    updateLevelProgress();
    updateOpenDisplay();

    createBoard();

    setMessage(
        `Level ${config.level}: Tìm ${config.pairs} cặp hình giống nhau!`
    );

    updateHelpButtons();
}

function createBoard() {
    const config = LEVELS[currentLevel];

    const selectedSymbols = shuffle(SYMBOLS).slice(0, config.pairs);

    const deck = shuffle([
        ...selectedSymbols,
        ...selectedSymbols
    ]);

    cards = deck.map((symbol, index) => ({
        id: index,
        symbol,
        matched: false
    }));

    gameBoard.innerHTML = "";

    cards.forEach(card => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "card";
        button.dataset.id = card.id;
        button.setAttribute("aria-label", "Thẻ chưa mở");

        button.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-front">?</div>
                <div class="card-face card-back">${card.symbol}</div>
            </div>
        `;

        button.addEventListener("click", () => {
            handleCardClick(card.id, button);
        });

        gameBoard.appendChild(button);
    });

    boardCreated = true;
}

function startLevel() {
    if (gameFinished) return;

    lockBoard = false;

    setMessage("Hãy lật thẻ để tìm các cặp giống nhau!");

    updateHelpButtons();
}

function completeLevel() {
    if (gameFinished) return;

    completedLevels++;
    highestLevel = Math.max(highestLevel, currentLevel + 1);

    updateLevelProgress();

    lockBoard = true;
    updateHelpButtons();

    playSound("complete");

    if (currentLevel === LEVELS.length - 1) {
        setMessage("🎉 Tuyệt vời! Bạn đã hoàn thành cả 5 cấp độ!");

        transitionTimeout = setTimeout(() => {
            finishGame(true);
        }, 1300);

        return;
    }

    setMessage(
        `🎉 Hoàn thành Level ${currentLevel + 1}! Chuẩn bị cấp độ tiếp theo...`
    );

    transitionTimeout = setTimeout(() => {
        if (gameFinished) return;

        prepareLevel(currentLevel + 1);
        startLevel();
    }, 1400);
}

// =====================================================
// CARD FLIP
// =====================================================

function handleCardClick(cardId, button) {
    if (!gameStarted || gameFinished || lockBoard) return;

    const card = cards[cardId];

    if (!card || card.matched) return;

    if (button.classList.contains("flipped")) return;

    // Nếu đã hết lượt mở thì kiểm tra trước khi lật thẻ đầu tiên.
    // Khi đã có thẻ thứ nhất đang mở, vẫn cho phép lật thẻ thứ hai.
    if (remainingOpens <= 0 && !firstCard) {
        handleNoMoreOpens();
        return;
    }

    button.classList.add("flipped");
    button.setAttribute("aria-label", `Hình ${card.symbol}`);

    remainingOpens--;
    totalManualOpens++;
    levelManualOpens++;

    updateOpenDisplay();

    playSound("flip");

    if (!firstCard) {
        firstCard = { card, button };
        return;
    }

    secondCard = { card, button };

    totalMoves++;
    levelMoves++;

    updateMovesDisplay();

    checkMatch();
}

function checkMatch() {
    if (!firstCard || !secondCard) return;

    lockBoard = true;

    const isMatch =
        firstCard.card.symbol === secondCard.card.symbol;

    if (isMatch) {
        handleCorrectPair();
    } else {
        handleWrongPair();
    }
}

function handleCorrectPair() {
    firstCard.card.matched = true;
    secondCard.card.matched = true;

    firstCard.button.classList.add("matched");
    secondCard.button.classList.add("matched");

    firstCard.button.disabled = true;
    secondCard.button.disabled = true;

    matchedPairs++;
    totalCorrectPairs++;
    levelCorrectPairs++;

    playSound("correct");

    resetTurn();

    reportProgress();

    if (matchedPairs === LEVELS[currentLevel].pairs) {
        completeLevel();
    } else {
        setMessage(`Chính xác! Bạn đã tìm được ${matchedPairs} cặp.`);
        updateHelpButtons();

        if (remainingOpens <= 0) {
            handleNoMoreOpens();
        }
    }
}

function handleWrongPair() {
    totalWrongPairs++;
    levelWrongPairs++;

    playSound("wrong");

    setMessage("Chưa đúng rồi! Hãy thử lại nhé.");

    mismatchTimeout = setTimeout(() => {
        if (gameFinished) return;

        if (firstCard) {
            firstCard.button.classList.remove("flipped");
            firstCard.button.setAttribute("aria-label", "Thẻ chưa mở");
        }

        if (secondCard) {
            secondCard.button.classList.remove("flipped");
            secondCard.button.setAttribute("aria-label", "Thẻ chưa mở");
        }

        resetTurn();

        updateHelpButtons();

        if (remainingOpens <= 0) {
            handleNoMoreOpens();
        }
    }, 850);
}

function resetTurn() {
    firstCard = null;
    secondCard = null;

    lockBoard = false;

    updateHelpButtons();
}

// =====================================================
// HELP 1: REVEAL ONE PAIR
// =====================================================

function revealOnePair() {
    if (!gameStarted || gameFinished || lockBoard) return;

    if (currentXp < XP_HELP_COST) {
        setMessage("Bạn cần ít nhất 10 XP để mở trợ giúp!");
        playSound("wrong");
        return;
    }

    const unmatched = cards.filter(card => !card.matched);

    if (unmatched.length < 2) return;

    const symbol = unmatched[0].symbol;

    const pair = unmatched.filter(card => card.symbol === symbol);

    if (pair.length !== 2) return;

    if (!spendXp(XP_HELP_COST)) return;

    revealHelpCount++;
    totalAssistedPairs++;
    levelAssistedPairs++;

    lockBoard = true;
    updateHelpButtons();

    const buttons = pair.map(card =>
        gameBoard.querySelector(`[data-id="${card.id}"]`)
    );

    buttons.forEach(button => {
        button.classList.add("flipped");
        button.setAttribute("aria-label", `Hình ${pair[0].symbol}`);
    });

    setMessage("💡 Trợ giúp đã mở một cặp hình!");

    playSound("flip");

    setTimeout(() => {
        if (gameFinished) return;

        pair.forEach(card => {
            card.matched = true;

            const button = gameBoard.querySelector(
                `[data-id="${card.id}"]`
            );

            if (button) {
                button.classList.add("matched");
                button.disabled = true;
            }
        });

        matchedPairs++;

        totalCorrectPairs++;
        levelCorrectPairs++;

        playSound("correct");

        resetTurn();

        reportProgress();

        if (matchedPairs === LEVELS[currentLevel].pairs) {
            completeLevel();
        } else {
            setMessage("Đã mở và ghép thành công một cặp!");
            updateHelpButtons();

            if (remainingOpens <= 0) {
                handleNoMoreOpens();
            }
        }
    }, 700);
}

// =====================================================
// HELP 2: ADD 10 OPENS
// =====================================================

function addMoreOpens() {
    if (!gameStarted || gameFinished || lockBoard) return;

    if (!spendXp(XP_HELP_COST)) return;

    extraOpensHelpCount++;

    remainingOpens += EXTRA_OPENS;

    updateOpenDisplay();
    updateHelpButtons();

    playSound("collect");

    setMessage("🎁 Bạn đã được cộng thêm 10 lượt mở!");
}

// =====================================================
// NO MORE OPENS
// =====================================================

function handleNoMoreOpens() {
    if (gameFinished || lockBoard) return;

    if (remainingOpens > 0) return;

    lockBoard = true;
    updateHelpButtons();

    if (currentXp >= XP_HELP_COST) {
        setMessage(
            "Bạn đã hết lượt mở. Hãy dùng trợ giúp để mua thêm 10 lượt!"
        );

        addOpensBtn.disabled = false;
        revealBtn.disabled = false;

        return;
    }

    setMessage("Bạn đã hết lượt mở và không đủ XP để tiếp tục!");

    setTimeout(() => {
        if (!gameFinished) {
            finishGame(false);
        }
    }, 1200);
}

// =====================================================
// PROGRESS REPORT
// =====================================================

function reportProgress() {
    if (!window.PyQuestBridge) return;

    const totalPairsAllLevels = LEVELS.reduce(
        (sum, level) => sum + level.pairs,
        0
    );

    const completedPairsBefore = LEVELS
        .slice(0, completedLevels)
        .reduce((sum, level) => sum + level.pairs, 0);

    const currentPairs = matchedPairs;

    const progressPairs = Math.min(
        totalPairsAllLevels,
        completedPairsBefore + currentPairs
    );

    const percent = Math.round(
        progressPairs / totalPairsAllLevels * 100
    );

    PyQuestBridge.reportProgress(percent);
}

// =====================================================
// TIMER
// =====================================================

function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        if (!gameStarted || gameFinished) return;

        seconds++;
        updateTimer();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// =====================================================
// GAME START / RESET
// =====================================================

function resetGameData() {
    stopTimer();

    if (mismatchTimeout) clearTimeout(mismatchTimeout);
    if (transitionTimeout) clearTimeout(transitionTimeout);

    currentLevel = 0;
    remainingOpens = 0;

    matchedPairs = 0;

    totalMoves = 0;
    totalManualOpens = 0;
    totalWrongPairs = 0;
    totalCorrectPairs = 0;

    totalAssistedPairs = 0;
    revealHelpCount = 0;
    extraOpensHelpCount = 0;

    completedLevels = 0;
    highestLevel = 0;

    seconds = 0;

    gameStarted = false;
    gameFinished = false;
    lockBoard = true;

    startedAt = null;

    updateTimer();
    updateMovesDisplay();

    updateXpDisplay();

    resultModal.classList.remove("show");

    prepareLevel(0);
}

function initGame(state) {
    const receivedXp = Number(state?.currentXp);

    initialXp = Number.isFinite(receivedXp)
        ? Math.max(0, Math.floor(receivedXp))
        : 0;

    currentXp = initialXp;
    xpSpent = 0;

    syncSoundSettings(state);

    resetGameData();

    boardCreated = true;

    setMessage("Đang chờ chương trình bắt đầu trò chơi...");
}

function startGame() {
    if (gameFinished || gameStarted) return;

    if (!boardCreated) {
        prepareLevel(0);
    }

    gameStarted = true;
    startedAt = Date.now();

    startTimer();
    startLevel();

    playSound("start");

    setMessage("Bắt đầu! Hãy tìm các cặp hình giống nhau.");

    updateHelpButtons();
}

// =====================================================
// FINISH GAME
// =====================================================

function finishGame(won) {
    if (gameFinished) return;

    gameFinished = true;
    gameStarted = false;
    lockBoard = true;

    stopTimer();

    if (mismatchTimeout) clearTimeout(mismatchTimeout);
    if (transitionTimeout) clearTimeout(transitionTimeout);

    updateHelpButtons();

    const totalPairs = LEVELS.reduce(
        (sum, level) => sum + level.pairs,
        0
    );

    const accuracy = totalMoves > 0
        ? Math.round(totalCorrectPairs / totalMoves * 100)
        : (totalCorrectPairs > 0 ? 100 : 0);

    const completionPercent = Math.round(
        completedLevels / LEVELS.length * 100
    );

    // Điểm kết quả: dựa trên tiến độ hoàn thành 5 cấp độ.
    const finalScore = completionPercent;

    const durationSec = seconds;

    const stats = {
        gameId: GAME_ID,
        gameVersion: GAME_VERSION,

        won: Boolean(won),

        completedLevels,
        totalLevels: LEVELS.length,
        highestLevel,

        totalPairs,
        correctPairs: totalCorrectPairs,
        wrongPairs: totalWrongPairs,
        assistedPairs: totalAssistedPairs,

        moves: totalMoves,
        manualOpens: totalManualOpens,
        accuracy,

        durationSec,

        initialXp,
        finalXp: currentXp,
        xpSpent,

        helpUsage: {
            revealPair: revealHelpCount,
            addOpens: extraOpensHelpCount
        },

        levelResults: LEVELS.map((level, index) => ({
            level: level.level,
            pairs: level.pairs,
            completed: index < completedLevels
        }))
    };

    const nextSavedState = {
        completed: Boolean(won),
        gameId: GAME_ID,
        gameVersion: GAME_VERSION,

        completedLevels,
        highestLevel,

        initialXp,
        currentXp,
        finalXp: currentXp,
        xpSpent,

        helpUsage: {
            revealPair: revealHelpCount,
            addOpens: extraOpensHelpCount
        },

        stats
    };

    resultTitle.textContent = won
        ? "🏆 CHÚC MỪNG!"
        : "🎮 KẾT THÚC TRÒ CHƠI";

    resultDetails.innerHTML = `
        <strong>Cấp độ hoàn thành:</strong>
        ${completedLevels}/5<br>

        <strong>Số cặp tìm đúng:</strong>
        ${totalCorrectPairs}/${totalPairs}<br>

        <strong>Số lần ghép sai:</strong>
        ${totalWrongPairs}<br>

        <strong>Tổng lượt ghép:</strong>
        ${totalMoves}<br>

        <strong>Thời gian:</strong>
        ${formatTime(seconds)}<br>

        <hr>

        <strong>XP ban đầu:</strong>
        ${initialXp}<br>

        <strong>XP đã sử dụng:</strong>
        ${xpSpent}<br>

        <strong>XP còn lại:</strong>
        ${currentXp}<br>

        <hr>

        <strong>Trợ giúp mở cặp:</strong>
        ${revealHelpCount} lần<br>

        <strong>Trợ giúp thêm lượt:</strong>
        ${extraOpensHelpCount} lần
    `;

    resultModal.classList.add("show");

    setMessage(
        won
            ? "Bạn đã chinh phục thành công cả 5 cấp độ!"
            : "Bạn đã kết thúc lượt chơi."
    );

    if (won) {
        playSound("win");
    } else {
        playSound("gameover");
    }

    // Chỉ gửi kết quả cuối cùng.
    // Không gửi yêu cầu trừ XP trong quá trình chơi.
    if (window.PyQuestBridge) {
        PyQuestBridge.reportProgress(completionPercent);

        PyQuestBridge.finishGame(
            Boolean(won),
            finalScore,
            {
                stats,
                nextSavedState,

                initialXp,
                finalXp: currentXp,
                xpSpent,

                helpUsage: stats.helpUsage
            }
        );
    }
}

// =====================================================
// BRIDGE
// =====================================================

revealBtn.addEventListener("click", revealOnePair);
addOpensBtn.addEventListener("click", addMoreOpens);

if (window.PyQuestBridge) {
    PyQuestBridge.setup({

        onInit: function(state) {
            initGame(state);

            // Chạy độc lập khi mở trực tiếp trên trình duyệt.
            if (state && state.projectId === "standalone") {
                startGame();
            }
        },

        onStart: function(state) {
            syncSoundSettings(state);
            startGame();
        },

        onRestart: function(state) {
            const latestXp = Number(state?.currentXp);

            if (Number.isFinite(latestXp)) {
                initialXp = Math.max(0, Math.floor(latestXp));
                currentXp = initialXp;
            }

            xpSpent = 0;

            resetGameData();
            startGame();
        },

        onSettingsChange: function(state) {
            syncSoundSettings(state);
        },

        onPowerup: function(powerup) {
            // Không tự động sử dụng trợ giúp từ chương trình ngoài.
            // Hai trợ giúp được thao tác trực tiếp trong giao diện game.
        }
    });

} else {
    // Chế độ chạy thử nếu chưa có file cầu nối.
    initGame({ currentXp: 50, projectId: "standalone" });
    startGame();
}
