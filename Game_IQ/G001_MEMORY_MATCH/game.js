
function completeLevel() {
    if (gameFinished) return;

    completedLevels = 1;
    highestLevel = currentLevel + 1;

    updateLevelProgress();

    lockBoard = true;
    updateHelpButtons();

    setMessage("🎉 Tuyệt vời! Bạn đã tìm đủ tất cả các cặp hình!");

    playSound("win");

    setTimeout(() => {
        finishGame(true);
    }, 1000);
}
