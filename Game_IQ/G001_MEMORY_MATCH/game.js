
/* ==========================================
   G001 - MEMORY MATCH
   Version 3.0
   Protocol 1.0
========================================== */

// 1. CẤU HÌNH

const GAME_ID = "G001";
const PROTOCOL = "1.0";

const symbols = [
    "🐶", "🐱", "🐰", "🦊",
    "🐼", "🦁", "🐸", "🐵"
];

const board = document.getElementById("gameBoard");
const scoreDisplay = document.getElementById("score");
const movesDisplay = document.getElementById("moves");
const timerDisplay = document.getElementById("timer");
const restartBtn = document.getElementById("restartBtn");
const messageDisplay = document.getElementById("message");
const resultModal = document.getElementById("resultModal");
const finalResult = document.getElementById("finalResult");
const playAgainBtn = document.getElementById("playAgainBtn");
const soundBtn = document.getElementById("soundBtn");

if (!board) {
    throw new Error("Không tìm thấy gameBoard trong index.html");
}


// 2. ÂM THANH DÙNG CHUNG

let soundEnabled = true;

const SOUND_BASE = "../../00_SHARED_ASSETS/sounds/";

const soundFiles = {
    flip: "flip.ogg",
    correct: "correct.ogg",
    wrong: "wrong.ogg",
    win: "win.ogg",
    click: "click.ogg",
    start: "start.ogg"
};

const soundCache = {};

function playSound(name) {
    if (!soundEnabled) return;

    const file = soundFiles[name];
    if (!file) return;

    if (!soundCache[name]) {
        soundCache[name] = new Audio(SOUND_BASE + file);
    }

    const audio = soundCache[name];
    audio.currentTime = 0;

    audio.play().catch(() => {});
}

function soundFlip() {
    playSound("flip");
}

function soundMatch() {
    playSound("correct");
}

function soundWrong() {
    playSound("wrong");
}

function soundWin() {
    playSound("win");
}

function soundRestart() {
    playSound("start");
}


// 3. BIẾN TRẠNG THÁI

let cards = [];
let flippedCards = [];

let matchedPairs = 0;
let moves = 0;
let score = 0;
let seconds = 0;

let timerInterval = null;

let started = false;
let locked = false;
let completed = false;

let studentId = null;
let sessionId = null;


// 4. XÁO TRỘN

function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}


// 5. GỬI KẾT QUẢ VỀ WEBSITE CHA

function sendToParent(type, payload = {}) {
    if (window.parent === window) return;

    window.parent.postMessage({
        type,
        protocol: PROTOCOL,
        ...payload
    }, "*");
}


// 6. HIỂN THỊ THẺ

function renderCards(gameCards) {
    board.innerHTML = "";
    cards = [];

    gameCards.forEach((symbol, index) => {
        const card = document.createElement("div");

        card.className = "card";
        card.dataset.symbol = symbol;
        card.dataset.index = index;

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front"></div>
                <div class="card-back">${symbol}</div>
            </div>
        `;

        card.addEventListener("click", () => {
            flipCard(card);
        });

        board.appendChild(card);
        cards.push(card);
    });
}


// 7. CẬP NHẬT THÔNG TIN

function updateDisplay() {
    scoreDisplay.textContent = score;
    movesDisplay.textContent = moves;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    timerDisplay.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0");
}


// 8. ĐẾM THỜI GIAN

function startTimer() {
    if (timerInterval !== null) return;

    timerInterval = setInterval(() => {
        if (completed) return;

        seconds++;
        updateDisplay();
    }, 1000);
}


// 9. KHỞI TẠO VÁN MỚI

function initGame() {
    clearInterval(timerInterval);
    timerInterval = null;

    flippedCards = [];

    matchedPairs = 0;
    moves = 0;
    score = 0;
    seconds = 0;

    started = false;
    locked = false;
    completed = false;

    if (resultModal) {
        resultModal.style.display = "none";
    }

    messageDisplay.textContent =
        "Hãy tìm các cặp hình giống nhau!";

    updateDisplay();

    // XÁO TRỘN NGAY LẬP TỨC
    const newCards = shuffle([
        ...symbols,
        ...symbols
    ]);

    // TẠO 16 THẺ ÚP
    renderCards(newCards);

    sendToParent("GAME_READY", {
        gameId: GAME_ID
    });
}


// 10. BẮT ĐẦU CHƠI KHI BẤM THẺ ĐẦU TIÊN

function startGame() {
    if (started) return;

    started = true;

    startTimer();

    sendToParent("GAME_START", {
        gameId: GAME_ID,
        studentId,
        sessionId
    });
}


// 11. LẬT THẺ

function flipCard(card) {
    if (locked || completed) return;
    if (card.classList.contains("flipped")) return;
    if (card.classList.contains("matched")) return;

    startGame();

    card.classList.add("flipped");
    flippedCards.push(card);

    soundFlip();

    if (flippedCards.length === 2) {
        moves++;
        updateDisplay();
        checkMatch();
    }
}


// 12. KIỂM TRA CẶP

function checkMatch() {
    const [card1, card2] = flippedCards;

    if (
        card1.dataset.symbol ===
        card2.dataset.symbol
    ) {
        card1.classList.add("matched");
        card2.classList.add("matched");

        matchedPairs++;
        score = matchedPairs * 100;

        soundMatch();

        flippedCards = [];

        updateDisplay();

        sendToParent("GAME_PROGRESS", {
            gameId: GAME_ID,
            score,
            moves,
            matchedPairs,
            totalPairs: symbols.length
        });

        if (matchedPairs === symbols.length) {
            finishGame();
        }

    } else {
        locked = true;

        soundWrong();

        messageDisplay.textContent =
            "Chưa đúng! Hãy thử lại nhé.";

        setTimeout(() => {
            card1.classList.remove("flipped");
            card2.classList.remove("flipped");

            flippedCards = [];
            locked = false;

            if (!completed) {
                messageDisplay.textContent =
                    "Hãy tiếp tục tìm các cặp hình!";
            }
        }, 800);
    }
}


// 13. KẾT THÚC

function finishGame() {
    completed = true;

    clearInterval(timerInterval);
    timerInterval = null;

    soundWin();

    messageDisplay.textContent =
        "Chúc mừng! Bạn đã tìm được tất cả các cặp!";

    const accuracy = moves > 0
        ? Math.round((matchedPairs / moves) * 100)
        : 100;

    finalResult.innerHTML = `
        <p>Điểm số: <strong>${score}</strong></p>
        <p>Số lượt chơi: <strong>${moves}</strong></p>
        <p>Số cặp đúng: <strong>${matchedPairs}</strong></p>
        <p>Số lượt sai: <strong>${moves - matchedPairs}</strong></p>
        <p>Thời gian: <strong>${timerDisplay.textContent}</strong></p>
        <p>Độ chính xác: <strong>${accuracy}%</strong></p>
    `;

    resultModal.style.display = "flex";

    sendToParent("GAME_COMPLETED", {
        gameId: GAME_ID,
        studentId,
        sessionId,
        score,
        totalPairs: symbols.length,
        correct: matchedPairs,
        wrong: moves - matchedPairs,
        moves,
        duration: seconds,
        accuracy,
        status: "completed"
    });
}


// 14. CHƠI LẠI

function restartGame() {
    soundRestart();
    initGame();
}

restartBtn.addEventListener("click", restartGame);
playAgainBtn.addEventListener("click", restartGame);


// 15. BẬT TẮT ÂM THANH

if (soundBtn) {
    soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;

        soundBtn.textContent = soundEnabled
            ? "🔊 Âm thanh: BẬT"
            : "🔇 Âm thanh: TẮT";

        if (soundEnabled) {
            playSound("click");
        }
    });
}


// 16. NHẬN DỮ LIỆU TỪ WEBSITE CHA

window.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || data.protocol !== PROTOCOL) return;

    switch (data.type) {
        case "GAME_INIT":
            studentId = data.studentId || null;
            sessionId = data.sessionId || null;
            break;

        case "GAME_RESTART":
            restartGame();
            break;

        // GAME_START không khởi tạo lại bàn chơi.
        // Tránh xáo trộn ngoài ý muốn.
        case "GAME_START":
            studentId = data.studentId || studentId;
            sessionId = data.sessionId || sessionId;
            break;
    }
});


// 17. KHỞI ĐỘNG DUY NHẤT KHI TẢI TRANG

initGame();
