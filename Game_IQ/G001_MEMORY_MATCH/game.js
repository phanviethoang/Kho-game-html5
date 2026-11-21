
// ==========================================
// G001 - MEMORY MATCH
// Trò chơi lật thẻ tìm cặp giống nhau
// Protocol: 1.0
// Version: 2.0
// ==========================================


// ==========================================
// 1. CẤU HÌNH GAME
// ==========================================

const GAME_ID = "G001";
const PROTOCOL = "1.0";

const symbols = [
    "🐶", "🐱", "🐰", "🦊",
    "🐼", "🦁", "🐸", "🐵"
];


// ==========================================
// 2. QUẢN LÝ ÂM THANH DÙNG CHUNG
// ==========================================

let soundEnabled = true;

const SOUND_BASE =
    "../../00_SHARED_ASSETS/sounds/";

const soundFiles = {
    flip: "flip.mp3",
    correct: "correct.mp3",
    wrong: "wrong.mp3",
    win: "win.mp3",
    click: "click.mp3",
    collect: "collect.mp3",
    levelUp: "level-up.mp3",
    start: "start.mp3",
    gameOver: "game-over.mp3",
    notification: "notification.mp3"
};

const soundCache = {};

function playSound(name) {
    if (!soundEnabled) return;

    const file = soundFiles[name];

    if (!file) return;

    if (!soundCache[name]) {
        soundCache[name] = new Audio(SOUND_BASE + file);
        soundCache[name].preload = "none";
    }

    const audio = soundCache[name];

    audio.currentTime = 0;

    audio.play().catch(() => {
        // Bình thường nếu file âm thanh chưa được thêm
        // hoặc trình duyệt chưa cho phép phát âm thanh.
    });
}

// Các hàm âm thanh tương thích với game

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


// ==========================================
// 3. KHAI BÁO BIẾN GAME
// ==========================================

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


// ==========================================
// 4. GỬI DỮ LIỆU VỀ WEBSITE CHA
// ==========================================

function sendToParent(type, payload = {}) {
    window.parent.postMessage({
        type: type,
        protocol: PROTOCOL,
        ...payload
    }, "*");
}


// ==========================================
// 5. XÁO TRỘN THẺ
// ==========================================

function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [result[i], result[j]] =
            [result[j], result[i]];
    }

    return result;
}


// ==========================================
// 6. KHỞI TẠO GAME
// ==========================================

function initGame() {
    
function initGame() {
    clearInterval(timerInterval);
    timerInterval = null;

    cards = [];
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

    if (messageDisplay) {
        messageDisplay.textContent =
            "Hãy tìm các cặp hình giống nhau!";
    }

    updateDisplay();

    // Tạo và xáo trộn 16 thẻ ngay khi khởi động
    const gameCards = shuffle([
        ...symbols,
        ...symbols
    ]);

    // Hiển thị ngay bàn chơi
    renderCards(gameCards);

    sendToParent("GAME_READY", {
        gameId: GAME_ID
    });
}



// ==========================================
// 7. HIỂN THỊ THẺ
// ==========================================

function renderCards(gameCards) {
    board.innerHTML = "";

    gameCards.forEach((symbol, index) => {
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

        cards.push(card);
    });
}


// ==========================================
// 8. BẮT ĐẦU ĐẾM THỜI GIAN
// ==========================================

function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        if (completed) return;

        seconds++;

        updateDisplay();

    }, 1000);
}


// ==========================================
// 9. LẬT THẺ
// ==========================================

function flipCard(card) {
    if (locked || completed) return;

    if (card.classList.contains("flipped")) return;

    if (card.classList.contains("matched")) return;

    if (!started) {
        started = true;

        startTimer();

        sendToParent("GAME_START", {
            gameId: GAME_ID,
            studentId: studentId,
            sessionId: sessionId
        });
    }

    card.classList.add("flipped");

    flippedCards.push(card);

    soundFlip();

    if (flippedCards.length === 2) {
        moves++;

        updateDisplay();

        checkMatch();
    }
}


// ==========================================
// 10. KIỂM TRA CẶP THẺ
// ==========================================

function checkMatch() {
    const [card1, card2] = flippedCards;

    const symbol1 = card1.dataset.symbol;
    const symbol2 = card2.dataset.symbol;

    if (symbol1 === symbol2) {

        // Ghép đúng
        card1.classList.add("matched");
        card2.classList.add("matched");

        matchedPairs++;

        score = matchedPairs * 100;

        soundMatch();

        flippedCards = [];

        updateDisplay();

        sendToParent("GAME_PROGRESS", {
            gameId: GAME_ID,
            score: score,
            moves: moves,
            matchedPairs: matchedPairs,
            totalPairs: symbols.length
        });

        if (matchedPairs === symbols.length) {
            finishGame();
        }

    } else {

        // Ghép sai
        locked = true;

        soundWrong();

        if (messageDisplay) {
            messageDisplay.textContent =
                "Chưa đúng! Hãy thử lại nhé.";
        }

        setTimeout(() => {

            card1.classList.remove("flipped");
            card2.classList.remove("flipped");

            flippedCards = [];

            locked = false;

            if (messageDisplay && !completed) {
                messageDisplay.textContent =
                    "Hãy tiếp tục tìm các cặp hình!";
            }

        }, 800);
    }
}


// ==========================================
// 11. CẬP NHẬT THÔNG TIN
// ==========================================

function updateDisplay() {
    if (scoreDisplay) {
        scoreDisplay.textContent = score;
    }

    if (movesDisplay) {
        movesDisplay.textContent = moves;
    }

    if (timerDisplay) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        timerDisplay.textContent =
            String(minutes).padStart(2, "0") +
            ":" +
            String(remainingSeconds).padStart(2, "0");
    }
}


// ==========================================
// 12. KẾT THÚC GAME
// ==========================================

function finishGame() {
    completed = true;

    clearInterval(timerInterval);

    timerInterval = null;

    soundWin();

    if (messageDisplay) {
        messageDisplay.textContent =
            "Chúc mừng! Bạn đã tìm được tất cả các cặp!";
    }

    const correct = matchedPairs;
    const wrong = moves - matchedPairs;

    const accuracy = moves > 0
        ? Math.round((correct / moves) * 100)
        : 100;

    if (finalResult) {
        finalResult.innerHTML = `
            <p>🏆 Hoàn thành trò chơi!</p>
            <p>Điểm số: <strong>${score}</strong></p>
            <p>Số lượt chơi: <strong>${moves}</strong></p>
            <p>Số cặp đúng: <strong>${correct}</strong></p>
            <p>Số lượt sai: <strong>${wrong}</strong></p>
            <p>Thời gian: <strong>${timerDisplay.textContent}</strong></p>
            <p>Độ chính xác: <strong>${accuracy}%</strong></p>
        `;
    }

    if (resultModal) {
        resultModal.style.display = "flex";
    }

    sendToParent("GAME_COMPLETED", {
        gameId: GAME_ID,
        studentId: studentId,
        sessionId: sessionId,

        score: score,
        totalPairs: symbols.length,
        correct: correct,
        wrong: wrong,

        moves: moves,
        duration: seconds,
        accuracy: accuracy,

        status: "completed"
    });
}


// ==========================================
// 13. CHƠI LẠI
// ==========================================

function restartGame() {
    soundRestart();

    initGame();
}

if (restartBtn) {
    restartBtn.addEventListener("click", restartGame);
}

if (playAgainBtn) {
    playAgainBtn.addEventListener("click", restartGame);
}


// ==========================================
// 14. BẬT / TẮT ÂM THANH
// ==========================================

if (soundBtn) {
    soundBtn.textContent = "🔊 Âm thanh: BẬT";

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


// ==========================================
// 15. NHẬN DỮ LIỆU TỪ WEBSITE CHA
// ==========================================

window.addEventListener("message", (event) => {

    const data = event.data;

    if (!data || data.protocol !== PROTOCOL) return;

    switch (data.type) {

        case "GAME_INIT":

            studentId = data.studentId || null;
            sessionId = data.sessionId || null;

            initGame();

            break;

        case "GAME_START":

            studentId = data.studentId || studentId;
            sessionId = data.sessionId || sessionId;

            initGame();

            started = true;

            startTimer();

            break;

        case "GAME_RESTART":

            restartGame();

            break;
    }
});


// ==========================================
// 16. KHỞI ĐỘNG
// ==========================================

initGame();
