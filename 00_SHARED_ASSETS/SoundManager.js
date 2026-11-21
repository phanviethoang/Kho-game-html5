
/* ==========================================
   SOUND MANAGER - VERSION 1.0
   Thư viện âm thanh dùng chung cho game HTML5
   Nguồn âm thanh: URL từ máy chủ bên ngoài
   ========================================== */

const SOUND_LIBRARY = {
    click: "",        // Âm thanh bấm nút
    flip: "",         // Âm thanh lật thẻ
    correct: "",      // Trả lời đúng
    wrong: "",        // Trả lời sai
    win: "",          // Chiến thắng
    start: "",        // Bắt đầu trò chơi
    complete: "",     // Hoàn thành cấp độ
    collect: "",      // Nhận vật phẩm
    notification: "", // Thông báo
    gameover: ""      // Kết thúc thất bại
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
