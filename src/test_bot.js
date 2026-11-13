// 自动通关测试：写个简单的机器人一直往右走，遇坑/遇墙就跳
// 如果机器人能通关，说明关卡真的可通
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/core.js', 'utf8');
globalThis.window = { addEventListener: () => {} };
globalThis.document = { getElementById: () => ({ getContext: () => ({}), addEventListener: () => {}, style: {} }) };
globalThis.requestAnimationFrame = () => {};
eval(src.replace(/const /g, 'var ').replace(/^let /gm, 'var '));

// 机器人：看脚下和前方，决定跳不跳
function botDecide(g) {
    const p = g.player, lv = g.level;
    const footRow = Math.floor((p.y + p.h + 2) / TILE);
    const col = Math.floor((p.x + p.w / 2) / TILE);
    const aheadCol = col + 2;

    // 前方是否有墙
    const bodyRow = Math.floor((p.y + p.h / 2) / TILE);
    const wallAhead = isSolidAt(lv, aheadCol, bodyRow) || isSolidAt(lv, aheadCol, bodyRow - 1);

    // 前方脚下是否有地（判断坑）
    const gapAhead = !isSolidAt(lv, aheadCol, footRow) && !isPlatformAt(lv, aheadCol, footRow);

    // 头顶是否有障碍（别撞头）
    const ceilRow = Math.floor((p.y - 6) / TILE);
    const ceilBlocked = isSolidAt(lv, col, ceilRow);

    // 附近有没拿的报告吗？有就朝它跳
    let wantReport = null;
    for (const rep of g.reports) {
        if (rep.got) continue;
        const dx = rep.x - (p.x + p.w / 2);
        const dy = rep.y - (p.y + p.h / 2);
        if (Math.abs(dx) < 220 && dy < -20 && dy > -140) {
            wantReport = { dx, dy };
            break;
        }
    }

    let jump = false;
    let right = true, left = false;
    if (p.onGround) {
        if (wallAhead || gapAhead) jump = true;
        // 报告在正上方且够得着：原地跳
        if (wantReport && Math.abs(wantReport.dx) < 60) jump = true;
        // 报告在前上方：边走边跳
        if (wantReport && wantReport.dx > 60) jump = true;
    }
    return { right, left, jump: jump || (!p.onGround && p.vy < 0) };
}

// 覆盖 inputState，让机器人接管
function runBot(levelIndex, maxSeconds = 60) {
    Game.startLevel(levelIndex);
    const maxFrames = maxSeconds * 60;
    let frames = 0;
    let stuckTimer = 0;
    let lastX = Game.player.x;
    let maxX = 0;

    while (frames < maxFrames) {
        const d = botDecide(Game);
        Keys['d'] = d.right;
        Keys['a'] = d.left;
        Keys[' '] = d.jump;

        Game.update();
        frames++;

        maxX = Math.max(maxX, Game.player.x);

        if (Game.state === 'clear') {
            return { ok: true, frames, reports: Game.collected, maxX };
        }
        if (Game.state === 'fail') {
            return { ok: false, frames, reason: '时间到或掉坑', reports: Game.collected, maxX };
        }

        // 卡住检测：位置长时间不变
        if (Math.abs(Game.player.x - lastX) < 0.3) {
            stuckTimer++;
            if (stuckTimer > 180) {
                return { ok: false, frames, reason: `卡在 x=${Game.player.x.toFixed(0)}`, reports: Game.collected, maxX };
            }
        } else {
            stuckTimer = 0;
            lastX = Game.player.x;
        }
    }
    return { ok: false, frames, reason: '超时未到门', reports: Game.collected, maxX };
}

console.log('=== 机器人自动通关测试 ===\n');
let allOk = true;

for (let i = 0; i < LEVELS.length; i++) {
    const r = runBot(i);
    const doorX = (() => { Game.startLevel(i); return Game.door.x; })();
    const pct = (r.maxX / doorX * 100).toFixed(0);

    if (r.ok) {
        console.log(`✓ 第${i + 1}关 ${LEVELS[i].name}：通关！用时 ${(r.frames / 60).toFixed(1)} 秒，收集 ${r.reports} 份`);
    } else {
        allOk = false;
        console.log(`✗ 第${i + 1}关 ${LEVELS[i].name}：${r.reason}`);
        console.log(`   走到 x=${r.maxX.toFixed(0)} / 门 x=${doorX}（完成 ${pct}%），收集 ${r.reports} 份`);
    }
}

console.log('\n' + '='.repeat(46));
console.log(allOk ? '三关全部可通关 ✅' : '有关卡通不了 ❌');
if (!allOk) process.exitCode = 1;