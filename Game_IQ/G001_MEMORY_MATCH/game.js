
/* ==========================================
   G001 - MEMORY MATCH
   Version: 4.0
   Protocol: 1.0
   Sound: Shared SoundManager.js
   ========================================== */

"use strict";

// ==========================================
// 1. CẤU HÌNH
// ==========================================

const GAME_ID = "G001";
const PROTOCOL = "1.0";

const symbols = [
    "🐶", "🐱", "🐰", "🦊",
    "🐼", "🦁", "🐸", "🐵"
];

// ==========================================
// 2. DOM ELEMENTS
// ==========================================

const board = document.getElementById("gameBoard");
const scoreElement = document.getElementById("score");
const movesElement = document.getElementById("moves");
const timerElement = document.getElementById("timer");

const restartBtn = document.getElementById("restartBtn");
const messageElement = document.getElementById("message");

const resultModal = document.getElementById("resultModal");
const finalResult = document.getElementById("finalResult");
const playAgainBtn = document.getElementById("playAgainBtn");
const soundBtn = document.getElementById("soundBtn");

// ==========================================
// 3. TRẠNG THÁI GAME
// ==========================================

let firstCard = null;
let secondCard = null;

let lockBoard = false;

let matchedPairs = 0;
let moves = 0;
let score = 0;
let seconds = 0;

let timerInterval = null;
let timerStarted = false;
let gameFinished = false;

let studentId = "";
let sessionId = "";

let soundEnabled = true;

// ==========================================
// 4. ÂM THANH - SỬ DỤNG SOUNDMANAGER
// ==========================================

function playGameSound(name) {
    if (!soundEnabled) return;

    if (
        typeof SoundManager !== "undefined" &&
        SoundManager &&
        typeof SoundManager.play === "function"
    ) {
        SoundManager.play(name);
    }
}

function soundFlip() {
    playGameSound("flip");
}

function soundMatch() {
    playGameSound("correct");
}

function soundWrong() {
    playGameSound("wrong");
}

function soundWin() {
    playGameSound("win");
}

function soundRestart() {
    playGameSound("start");
}

function soundClick() {
    playGameSound("click");
}

// ==========================================
// 5. KHỞI TẠO GAME
// ==========================================

function initGame() {

    clearInterval(timerInterval);

    firstCard = null;
    secondCard = null;

    lockBoard = false;

    matchedPairs = 0;
    moves = 0;
    score = 0;
    seconds = 0;

    timerStarted = false;
    gameFinished = false;

    updateStats();
    updateTimer();

    messageElement.textContent = "Hãy tìm các cặp hình giống nhau!";

    resultModal.classList.remove("show");

    // Xáo trộn 16 thẻ
    const cards = [...symbols, ...symbols];
    shuffleArray(cards);

    // Xóa bảng cũ
    board.innerHTML = "";

    // Tạo thẻ
    cards.forEach((symbol, index) => {

        const card = document.createElement("div");

        card.className = "card";
        card.dataset.symbol = symbol;
        card.dataset.index = index;

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">?</div>
                <div class="card-back">${symbol}</div>
            </div>
        `;

        card.addEventListener("click", () => {
            flipCard(card);
        });

        board.appendChild(card);

    });

    // Báo cho website cha biết game đã sẵn sàng
    sendToParent({
        type: "GAME_READY",
        gameId: GAME_ID,
        protocol: PROTOCOL
    });
}

// ==========================================
// 6. XÁO TRỘN MẢNG
// ==========================================

function shuffleArray(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [array[j], array[i]];

    }

    return array;
}

// ==========================================
// 7. BẮT ĐẦU ĐẾM GIỜ
// ==========================================

function startTimer() {

    if (timerStarted) return;

    timerStarted = true;

    timerInterval = setInterval(() => {

        seconds++;

        updateTimer();

    }, 1000);

}

// ==========================================
// 8. CẬP NHẬT THỜI GIAN
// ==========================================

function updateTimer() {

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    timerElement.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0");

}

// ==========================================
// 9. CẬP NHẬT ĐIỂM VÀ LƯỢT
// ==========================================

function updateStats() {

    scoreElement.textContent = score;
    movesElement.textContent = moves;

}

// ==========================================
// 10. LẬT THẺ
// ==========================================

function flipCard(card) {

    if (gameFinished) return;
    if (lockBoard) return;
    if (card.classList.contains("flipped")) return;
    if (card.classList.contains("matched")) return;

    // Bắt đầu tính giờ khi học sinh lật thẻ đầu tiên
    startTimer();

    card.classList.add("flipped");

    soundFlip();

    if (!firstCard) {

        firstCard = card;

        return;

    }

    secondCard = card;

    moves++;

    updateStats();

    checkForMatch();

}

// ==========================================
// 11. KIỂM TRA CẶP
// ==========================================

function checkForMatch() {

    const isMatch =
        firstCard.dataset.symbol === secondCard.dataset.symbol;

    if (isMatch) {

        disableMatchedCards();

    } else {

        unflipCards();

    }

}

// ==========================================
// 12. GHÉP ĐÚNG
// ==========================================

function disableMatchedCards() {

    firstCard.classList.add("matched");
    secondCard.classList.add("matched");

    matchedPairs++;

    score += 10;

    soundMatch();

    messageElement.textContent = "Chính xác! Bạn tìm được một cặp.";

    updateStats();

    resetTurn();

    if (matchedPairs === symbols.length) {

        finishGame();

    }

}

// ==========================================
// 13. GHÉP SAI
// ==========================================

function unflipCards() {

    lockBoard = true;

    soundWrong();

    messageElement.textContent = "Chưa đúng! Hãy thử lại nhé.";

    setTimeout(() => {

        firstCard.classList.remove("flipped");
        secondCard.classList.remove("flipped");

        resetTurn();

    }, 900);

}

// ==========================================
// 14. RESET LƯỢT
// ==========================================

function resetTurn() {

    firstCard = null;
    secondCard = null;

    lockBoard = false;

}

// ==========================================
// 15. KẾT THÚC GAME
// ==========================================

function finishGame() {

    gameFinished = true;

    clearInterval(timerInterval);

    const accuracy = moves > 0
        ? Math.round((matchedPairs / moves) * 100)
        : 0;

    const wrong = moves - matchedPairs;

    const result = {
        gameId: GAME_ID,
        protocol: PROTOCOL,

        score: score,
        totalPairs: symbols.length,
        correct: matchedPairs,
        wrong: wrong,
        moves: moves,
        duration: seconds,
        accuracy: accuracy,
        status: "completed",

        studentId: studentId,
        sessionId: sessionId
    };

    soundWin();

    finalResult.innerHTML = `
        <div>🎉 Chúc mừng bạn!</div>
        <p>Điểm số: <strong>${score}</strong></p>
        <p>Số lượt: <strong>${moves}</strong></p>
        <p>Thời gian: <strong>${timerElement.textContent}</strong></p>
        <p>Độ chính xác: <strong>${accuracy}%</strong></p>
    `;

    resultModal.classList.add("show");

    sendToParent({
        type: "GAME_COMPLETED",
        ...result
    });

}

// ==========================================
// 16. CHƠI LẠI
// ==========================================

function restartGame() {

    soundRestart();

    initGame();

}

// ==========================================
// 17. BẬT / TẮT ÂM THANH
// ==========================================

function toggleSound() {

    soundEnabled = !soundEnabled;

    if (soundEnabled) {

        soundBtn.textContent = "🔊 Âm thanh: Bật";

        if (typeof SoundManager !== "undefined") {
            SoundManager.enable();
        }

        soundClick();

    } else {

        soundBtn.textContent = "🔇 Âm thanh: Tắt";

        if (typeof SoundManager !== "undefined") {
            SoundManager.disable();
        }

    }

}

// ==========================================
// 18. GỬI DỮ LIỆU VỀ WEBSITE CHA
// ==========================================

function sendToParent(data) {

    if (window.parent !== window) {

        window.parent.postMessage(data, "*");

    }

}

// ==========================================
// 19. NHẬN LỆNH TỪ WEBSITE CHA
// ==========================================

window.addEventListener("message", function(event) {

    const data = event.data;

    if (!data || typeof data !== "object") return;

    switch (data.type) {

        case "GAME_START":

            studentId = data.studentId || "";
            sessionId = data.sessionId || "";

            // Không khởi tạo lại game tại đây
            break;

        case "GAME_INIT":

            studentId = data.studentId || "";
            sessionId = data.sessionId || "";

            break;

        case "GAME_RESTART":

            restartGame();

            break;

    }

});

// ==========================================
// 20. GẮN SỰ KIỆN NÚT
// ==========================================

if (restartBtn) {
    restartBtn.addEventListener("click", restartGame);
}

if (playAgainBtn) {
    playAgainBtn.addEventListener("click", restartGame);
}

if (soundBtn) {
    soundBtn.addEventListener("click", toggleSound);
}

// ==========================================
// 21. KHỞI CHẠY
// ==========================================

initGame();
