// ==================== 9. 主循环与状态机 ====================
let lastTime = 0;
let acc = 0;
const STEP = 1000 / 60;
let tick = 0;

function handleConfirm() {
    const g = Game;
    if (g.state === 'title') {
        g.startLevel(0);
    } else if (g.state === 'clear') {
        if (g.levelIndex + 1 < LEVELS.length) {
            g.startLevel(g.levelIndex + 1);
        } else {
            // 全部通关：回到标题并标记完成
            g.state = 'title';
            g.allClear = true;
        }
    } else if (g.state === 'fail') {
        g.startLevel(g.levelIndex);
    }
}

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') {
        if (Game.state !== 'playing') handleConfirm();
    }
    if (k === 'r' && Game.state === 'playing') {
        Game.startLevel(Game.levelIndex);
    }
});

// 触屏点击也能确认
canvas.addEventListener('touchend', e => {
    if (Game.state !== 'playing') {
        handleConfirm();
    }
});

function loop(now) {
    requestAnimationFrame(loop);

    if (!lastTime) lastTime = now;
    let delta = now - lastTime;
    lastTime = now;
    if (delta > 200) delta = 200;   // 切标签页回来别一次性补太多

    acc += delta;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
        tick++;
        Game.update();
        acc -= STEP;
        steps++;
    }

    render(Game, tick);
}

// ---------- 启动 ----------
resize();
bindTouch(canvas);
requestAnimationFrame(loop);