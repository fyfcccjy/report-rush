// 逻辑测试：蒙住浏览器 API，验证物理、碰撞、收集、状态机
const fs = require('fs');

// ---- mock 浏览器环境 ----
const listeners = {};
global.window = {
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    innerWidth: 1280, innerHeight: 720,
};
global.document = {
    getElementById: () => ({
        getContext: () => mockCtx,
        addEventListener: () => {},
        style: {},
        width: 960, height: 540,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
    }),
};
global.requestAnimationFrame = () => {};
const noop = () => {};
const mockCtx = new Proxy({}, {
    get: (t, k) => {
        if (k === 'canvas') return { width: 960, height: 540 };
        if (k === 'measureText') return () => ({ width: 100 });
        if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
        return noop;
    },
    set: () => true,
});

// ---- 加载 core.js ----
const src = fs.readFileSync(__dirname + '/core.js', 'utf8');
eval(src);

const fails = [];
function check(name, cond, detail) {
    if (cond) console.log(`  ✓ ${name}`);
    else { console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); fails.push(name); }
}

console.log('=== 1. 地图解析 ===');
Game.startLevel(0);
check('关卡解析成功', Game.level !== null);
check('瓦片网格行数 = 18', Game.level.h === 18, `实际 ${Game.level.h}`);
check('玩家出生在 P 位置', Game.player.x === 6 * 32 && Game.player.y === 14 * 32,
    `实际 (${Game.player.x}, ${Game.player.y})`);
check('第1关有 1 份报告', Game.totalReports === 1, `实际 ${Game.totalReports}`);
check('第1关有敌人', Game.enemies.length >= 1, `实际 ${Game.enemies.length}`);
check('第1关有小深', Game.npcs.length >= 1, `实际 ${Game.npcs.length}`);
check('门存在', Game.door !== null);

console.log('\n=== 2. 重力与落地 ===');
// 让玩家自由下落，看他会不会停在地面上
let frames = 0;
while (frames < 120 && !Game.player.onGround) {
    Game.update();
    frames++;
}
check('会落地', Game.player.onGround, `${frames} 帧后 onGround=${Game.player.onGround}`);
const groundY = Game.player.y;
// 再跑 60 帧，位置应该不变（不会陷进地面）
for (let i = 0; i < 60; i++) Game.update();
check('落地后不下沉', Math.abs(Game.player.y - groundY) < 0.01,
    `原 ${groundY} → 现 ${Game.player.y}`);

console.log('\n=== 3. 跳跃 ===');
const yBefore = Game.player.y;
// 按住跳跃键 20 帧（长按 = 高跳）
Keys[' '] = true;
Game.update();
let peak = Game.player.y;
for (let i = 0; i < 20; i++) {
    Game.update();
    peak = Math.min(peak, Game.player.y);
}
Keys[' '] = false;
for (let i = 0; i < 20; i++) {
    Game.update();
    peak = Math.min(peak, Game.player.y);
}
const jumpHeight = yBefore - peak;
check('能跳起来', jumpHeight > 30, `跳了 ${jumpHeight.toFixed(1)}px`);
check('跳跃高度合理(<200px)', jumpHeight < 200, `${jumpHeight.toFixed(1)}px`);

// 等落地
for (let i = 0; i < 120 && !Game.player.onGround; i++) Game.update();
check('跳完能落回地面', Game.player.onGround);

// 短按应该跳得比长按低
const yb2 = Game.player.y;
Keys[' '] = true; Game.update(); Keys[' '] = false;
let peak2 = Game.player.y;
for (let i = 0; i < 40; i++) { Game.update(); peak2 = Math.min(peak2, Game.player.y); }
const shortJump = yb2 - peak2;
check('短按跳得比长按低（可变跳跃高度）', shortJump < jumpHeight * 0.6,
    `短按 ${shortJump.toFixed(1)} vs 长按 ${jumpHeight.toFixed(1)}`);

console.log('\n=== 4. 水平移动与撞墙 ===');
const xBefore = Game.player.x;
Keys['d'] = true;
for (let i = 0; i < 40; i++) Game.update();
Keys['d'] = false;
check('按 D 向右移动', Game.player.x > xBefore + 20,
    `${xBefore.toFixed(1)} → ${Game.player.x.toFixed(1)}`);
check('速度有上限', Math.abs(Game.player.vx) <= MAX_RUN * 1.6, `vx=${Game.player.vx}`);

// 撞左侧边界（世界外）
Game.startLevel(0);
Keys['a'] = true;
for (let i = 0; i < 200; i++) Game.update();
Keys['a'] = false;
check('撞左边界不会穿出', Game.player.x >= -2, `x=${Game.player.x}`);

console.log('\n=== 5. 敌人巡逻 ===');
Game.startLevel(0);
const e = Game.enemies[0];
const ex0 = e.x;
for (let i = 0; i < 120; i++) Game.update();
check('敌人会移动', Math.abs(e.x - ex0) > 1, `${ex0.toFixed(1)} → ${e.x.toFixed(1)}`);
check('敌人不会掉出地图', e.y < Game.level.h * TILE, `y=${e.y.toFixed(1)}`);

console.log('\n=== 6. 收集报告 ===');
Game.startLevel(0);
// 把玩家瞬移到报告位置
const rep = Game.reports[0];
Game.player.x = rep.x - 10;
Game.player.y = rep.y - 15;
Game.update();
check('拾取报告', Game.collected === 1, `collected=${Game.collected}`);

console.log('\n=== 7. 门需要集齐报告 ===');
Game.startLevel(0);
Game.player.x = Game.door.x + 4;
Game.player.y = Game.door.y;
Game.update();
check('没集齐时门不开', Game.state === 'playing', `state=${Game.state}`);
check('给出提示', Game.message.includes('还差'), `message="${Game.message}"`);

// 集齐后再试
Game.collected = Game.totalReports;
Game.player.x = Game.door.x + 4;
Game.player.y = Game.door.y;
Game.update();
check('集齐后进门通关', Game.state === 'clear', `state=${Game.state}`);

console.log('\n=== 8. 三关都能解析 ===');
for (let i = 0; i < LEVELS.length; i++) {
    Game.startLevel(i);
    check(`第${i + 1}关(${LEVELS[i].name}) 出生点有效`,
        Game.player.x >= 0 && Game.player.y >= 0,
        `(${Game.player.x}, ${Game.player.y})`);
    check(`第${i + 1}关 有报告`, Game.totalReports > 0, `${Game.totalReports} 份`);
    check(`第${i + 1}关 门坐标有效`, Game.door && Game.door.x > 0);
    // 跑 100 帧不崩
    let ok = true;
    try { for (let f = 0; f < 100; f++) Game.update(); } catch (err) { ok = false; console.log('  异常:', err.message); }
    check(`第${i + 1}关 跑 100 帧不崩`, ok);
}

console.log('\n=== 9. 超时判定 ===');
Game.startLevel(0);
Game.timeLeft = 0.01;
Game.update();
check('时间归零判负', Game.state === 'fail', `state=${Game.state}`);

console.log('\n' + '='.repeat(46));
if (fails.length === 0) {
    console.log('全部通过 ✅');
} else {
    console.log(`失败 ${fails.length} 项：`);
    fails.forEach(f => console.log('  · ' + f));
    process.exitCode = 1;
}