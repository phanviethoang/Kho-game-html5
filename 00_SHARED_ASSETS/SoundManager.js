
/* ==========================================
   SOUND MANAGER - VERSION 1.0
   Thư viện âm thanh dùng chung cho game HTML5
   Nguồn âm thanh: URL từ máy chủ bên ngoài
   ========================================== */

const SOUND_LIBRARY = {
    // Giao diện chung
    click: "https://sfxmint.com/dl/ready-click-04.mp3",
    flip: "https://sfxmint.com/dl/paper-fabric-card-flip-06.mp3",
    correct: "https://sfxmint.com/dl/ui-chime-93.mp3",

    // Chiến đấu Space Battle
    shoot: "https://sfxmint.com/dl/magic-scifi-laser-62.mp3",
    hit: "https://sfxmint.com/dl/bullet-impact-08.mp3",
    explosion: "https://sfxmint.com/dl/retro-game-explosion-55.mp3",
    bossExplosion: "https://sfxmint.com/dl/impact-explosion-36.mp3",

    // Hiệu ứng bổ sung
    wrong: "https://sfxmint.com/dl/feedback-buzzer-19.mp3",
    win: "https://sfxmint.com/dl/game-show-win-08.mp3",
    start: "https://sfxmint.com/dl/ui-app-open-38.mp3",
    complete: "https://sfxmint.com/dl/feedback-level-up-71.mp3",
    collect: "https://sfxmint.com/dl/ui-chime-114.mp3",
    notification: "https://sfxmint.com/dl/ui-chime-82.mp3",
    gameover: "https://sfxmint.com/dl/retro-game-game-over-66.mp3"
};

const SoundManager = (() => {

    let enabled = true;
    let volume = 0.7;

    // Bộ nhớ âm thanh đã tải
    const audioCache = {};

    // Tạo Audio và lưu cache
    function getAudio(name) {
        const url = SOUND_LIBRARY[name];

        if (!url || typeof url !== "string") {
            return null;
        }

        if (!audioCache[name]) {
            const audio = new Audio(url);
            audio.preload = "auto";
            audioCache[name] = audio;
        }

        return audioCache[name];
    }

    // Phát âm thanh
    function play(name, options = {}) {
        if (!enabled) return;

        const audio = getAudio(name);
        if (!audio) return;

        const playback = audio.cloneNode();

        playback.volume = Math.max(
            0,
            Math.min(1, options.volume ?? volume)
        );

        playback.play().catch(error => {
            console.warn("Không phát được âm thanh:", name, error);
        });
    }

    // Bật âm thanh
    function enable() {
        enabled = true;
    }

    // Tắt âm thanh
    function disable() {
        enabled = false;
    }

    // Bật / tắt
    function toggle() {
        enabled = !enabled;
        return enabled;
    }

    // Kiểm tra trạng thái
    function isEnabled() {
        return enabled;
    }

    // Điều chỉnh âm lượng
    function setVolume(value) {
        volume = Math.max(0, Math.min(1, Number(value)));
    }

    // Lấy âm lượng
    function getVolume() {
        return volume;
    }

    // Xóa cache
    function clearCache() {
        Object.values(audioCache).forEach(audio => {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        });

        Object.keys(audioCache).forEach(key => {
            delete audioCache[key];
        });
    }

    return {
        play,
        enable,
        disable,
        toggle,
        isEnabled,
        setVolume,
        getVolume,
        clearCache
    };

})();

// Hàm gọi nhanh trong game
function playSound(name, options) {
    SoundManager.play(name, options);
}
