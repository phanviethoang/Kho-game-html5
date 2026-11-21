
// ==========================================
// G001 - MEMORY MATCH
// Trò chơi lật thẻ tìm cặp giống nhau
// Protocol: 1.0
// ==========================================

const symbols = [
    "🐶", "🐱", "🐰", "🦊",
    "🐼", "🦁", "🐸", "🐵"
];

const board = document.getElementById("gameBoard");
const scoreElement = document.getElementById("score");
const movesElement = document.getElementById("moves");
const timerElement = document.getElementById("timer");
const messageElement = document.getElementById("message");
const modal = document.getElementById("resultModal");
const finalResult = document.getElementById("finalResult");

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


// ==========================================
// HỆ THỐNG ÂM THANH
// ==========================================

let audioContext = null;
let soundEnabled = true;

function initAudio() {
    if (!audioContext) {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        }
    }

    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.12, delay = 0) {
    if (!soundEnabled) return;

    initAudio();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime + delay
    );

    gain.gain.setValueAtTime(0.001, audioContext.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(
        volume,
        audioContext.currentTime + delay + 0.015
    );
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + delay + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + duration + 0.02);
}

// Tiếng lật thẻ
function soundFlip() {
    playTone(520, 0.07, "sine", 0.07);
}

// Tiếng tìm đúng cặp
function soundMatch() {
    playTone(660, 0.12, "sine", 0.12);
    playTone(880, 0.18, "sine", 0.12, 0.12);
}

// Tiếng tìm sai cặp
function soundWrong() {
    playTone(240, 0.18, "triangle", 0.08);
}

// Nhạc chiến thắng
function soundWin() {
    const notes = [523, 659, 784, 1047, 784, 1047];

    notes.forEach((note, index) => {
        playTone(note, 0.22, "sine", 0.13, index * 0.16);
    });
}

// Tiếng bắt đầu lại
function soundRestart() {
    playTone(440, 0.1, "sine", 0.08);
    playTone(660, 0.12, "sine", 0.08, 0.1);
}

// Thông tin phiên chơi nhận từ website
let gameSession = {
    sessionId: null,
    studentId: null,
    gameId: "G001",
    studentName: "",
    level: "easy"
};

// Gửi thông tin về website cha
function sendToParent(type, payload = {}) {
    if (window.parent !== window) {
        window.parent.postMessage({
            type: type,
            protocol: "1.0",
            ...payload
        }, "*");
    }
}

// Nhận thông tin khởi tạo từ website
window.addEventListener("message", function(event) {
    if (event.source !== window.parent) return;

    const data = event.data;

    if (!data || typeof data !== "object") return;

    if (data.type === "GAME_INIT") {
        gameSession = {
            ...gameSession,
            ...(data.payload || {})
        };

        sendToParent("GAME_READY", {
            gameId: gameSession.gameId,
            sessionId: gameSession.sessionId
        });
    }

    if (data.type === "GAME_START") {
        startGame();
    }
});

// Xáo trộn thẻ
function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

// Khởi tạo trò chơi
function initGame() {
    clearInterval(timerInterval);

    cards = shuffle([...symbols, ...symbols]);

    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    score = 0;
    seconds = 0;
    started = false;
    locked = false;
    completed = false;

    scoreElement.textContent = score;
    movesElement.textContent = moves;
    timerElement.textContent = "00:00";

    messageElement.textContent =
        "Hãy tìm đủ 8 cặp hình giống nhau nhé!";

    modal.classList.add("hidden");

    renderCards();
}

// Hiển thị các thẻ
function renderCards() {
    board.innerHTML = "";

    cards.forEach((symbol, index) => {
        const card = document.createElement("button");

        card.className = "card";
        card.type = "button";
        card.textContent = "❓";
        card.dataset.symbol = symbol;
        card.dataset.index = index;
        card.setAttribute("aria-label", "Thẻ chưa mở");

        card.addEventListener("click", () => {
            flipCard(card);
        });

        board.appendChild(card);
    });
}

// Bắt đầu đồng hồ
function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        seconds++;

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        timerElement.textContent =
            String(minutes).padStart(2, "0") + ":" +
            String(remainingSeconds).padStart(2, "0");

    }, 1000);
}

// Lật thẻ
function flipCard(card) {
    if (
        locked ||
        completed ||
        card.classList.contains("flipped") ||
        card.classList.contains("matched")
    ) {
        return;
    }

    if (!started) {
        started = true;
        startTimer();

        sendToParent("GAME_START", {
            gameId: gameSession.gameId,
            sessionId: gameSession.sessionId
        });
    }

    card.textContent = card.dataset.symbol;
    card.classList.add("flipped");
    soundFlip();
    card.setAttribute("aria-label", "Thẻ " + card.dataset.symbol);

    flippedCards.push(card);

    if (flippedCards.length === 2) {
        moves++;
        movesElement.textContent = moves;
        checkMatch();
    }
}

// Kiểm tra hai thẻ
function checkMatch() {
    const [first, second] = flippedCards;

    if (first.dataset.symbol === second.dataset.symbol) {
        soundMatch();
        first.classList.remove("flipped");
        second.classList.remove("flipped");

        first.classList.add("matched");
        second.classList.add("matched");

        first.disabled = true;
        second.disabled = true;

        matchedPairs++;
        score += 100;

        scoreElement.textContent = score;

        flippedCards = [];

        messageElement.textContent =
            "🎉 Chính xác! Bạn tìm được một cặp hình!";

        sendToParent("GAME_PROGRESS", {
            gameId: gameSession.gameId,
            sessionId: gameSession.sessionId,
            score: score,
            correct: matchedPairs,
            moves: moves
        });

        if (matchedPairs === symbols.length) {
            finishGame();
        }

    } else {
        soundWrong();
        locked = true;

        messageElement.textContent =
            "Chưa đúng rồi! Hãy cố gắng ghi nhớ nhé!";

        setTimeout(() => {
            first.textContent = "❓";
            second.textContent = "❓";

            first.classList.remove("flipped");
            second.classList.remove("flipped");

            first.setAttribute("aria-label", "Thẻ chưa mở");
            second.setAttribute("aria-label", "Thẻ chưa mở");

            flippedCards = [];
            locked = false;
        }, 850);
    }
}

// Hoàn thành trò chơi
function finishGame() {
    completed = true;
    soundWin();
    clearInterval(timerInterval);
    timerInterval = null;

    const accuracy = moves > 0
        ? Math.round((symbols.length / moves) * 100)
        : 100;

    const finalScore = Math.max(
        0,
        Math.round(score + Math.max(0, 100 - moves * 3))
    );

    score = finalScore;
    scoreElement.textContent = score;

    messageElement.textContent =
        "🏆 Xuất sắc! Bạn đã tìm được tất cả các cặp!";

    finalResult.innerHTML = `
        <p>⭐ Điểm số: ${score}</p>
        <p>🔄 Số lượt lật: ${moves}</p>
        <p>⏱️ Thời gian: ${timerElement.textContent}</p>
        <p>🎯 Số cặp tìm được: ${matchedPairs}/8</p>
    `;

    modal.classList.remove("hidden");

    // Gửi kết quả về website quản lý
    sendToParent("GAME_COMPLETED", {
        sessionId: gameSession.sessionId,
        studentId: gameSession.studentId,
        gameId: gameSession.gameId,
        score: score,
        totalPairs: symbols.length,
        correct: matchedPairs,
        wrong: moves - matchedPairs,
        moves: moves,
        duration: seconds,
        accuracy: accuracy,
        status: "completed"
    });
}

// Bắt đầu hoặc chơi lại
function startGame() {
    initGame();
}

// Nút chơi lại
document.getElementById("restartBtn").addEventListener("click", () => {
    soundRestart();
    initGame();
});

document.getElementById("playAgainBtn").addEventListener("click", () => {
    soundRestart();
    initGame();
});

// Khởi động khi mở trang
initGame();

// Thông báo sẵn sàng cho website cha
sendToParent("GAME_READY", {
    gameId: gameSession.gameId,
    protocol: "1.0"
});
