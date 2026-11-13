// 关卡可通过性检查：找出跳不过去的坑、够不着的墙
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/core.js', 'utf8');
globalThis.window = { addEventListener: () => {} };
globalThis.document = { getElementById: () => ({ getContext: () => ({}), addEventListener: () => {}, style: {} }) };
globalThis.requestAnimationFrame = () => {};
eval(src.replace(/const /g, 'var ').replace(/^let /gm, 'var '));

// ---- 算玩家能力 ----
const G = 0.62, VJ = -11.4;
const airFrames = Math.abs(VJ) / G * 2;          // 完整滞空帧数
const maxJumpDist = airFrames * MAX_RUN;          // 最远水平跳跃
const maxJumpH = VJ * VJ / (2 * G);               // 最大跳跃高度

console.log('=== 玩家能力 ===');
console.log(`  最大跳跃高度  ${maxJumpH.toFixed(1)} px  = ${(maxJumpH / TILE).toFixed(2)} 格`);
console.log(`  单跳最远水平  ${maxJumpDist.toFixed(0)} px  = ${(maxJumpDist / TILE).toFixed(2)} 格`);
console.log(`  滞空帧数      ${airFrames.toFixed(1)}`);

// 安全余量：设计时按 70% 算，留出容错
const SAFE_GAP = Math.floor(maxJumpDist / TILE * 0.7);   // 最大可跨越坑（格）
const SAFE_UP = Math.floor(maxJumpH / TILE * 0.75);      // 最大可上平台高度（格）
console.log(`\n  设计安全值：坑宽 ≤ ${SAFE_GAP} 格，台阶高 ≤ ${SAFE_UP} 格`);

let problems = 0;

for (let li = 0; li < LEVELS.length; li++) {
    const lv = parseLevel(LEVELS[li]);
    console.log(`\n=== 第 ${li + 1} 关：${lv.name} ===`);

    // 找地面层（最下面连续实心的那一行）
    let groundRow = -1;
    for (let r = lv.h - 1; r >= 0; r--) {
        let cnt = 0;
        for (let c = 0; c < lv.w; c++) if (lv.grid[r][c] === 1) cnt++;
        if (cnt > lv.w * 0.2) { groundRow = r; break; }
    }
    if (groundRow < 0) { console.log('  ! 找不到地面层'); problems++; continue; }
    console.log(`  地面在第 ${groundRow} 行`);

    // 扫描地面缺口宽度
    let gaps = [];
    let start = -1;
    for (let c = 0; c <= lv.w; c++) {
        const solid = c < lv.w && lv.grid[groundRow][c] === 1;
        if (!solid && start < 0) start = c;
        else if (solid && start >= 0) {
            gaps.push({ from: start, to: c - 1, w: c - start });
            start = -1;
        }
    }
    // 忽略地图边缘的缺口（世界外）
    gaps = gaps.filter(g => g.from > 0 && g.to < lv.w - 1);
    if (gaps.length === 0) {
        console.log('  地面连续，无缺口');
    } else {
        for (const g of gaps) {
            const ok = g.w <= SAFE_GAP;
            console.log(`  ${ok ? '✓' : '✗'} 缺口 x=${g.from}~${g.to}  宽 ${g.w} 格`
                + (ok ? '' : `  ← 超过 ${SAFE_GAP} 格，跳不过去`));
            if (!ok) problems++;
        }
    }

    // 检查出生点是否在地面上
    const sp = lv.spawns.player;
    if (sp) {
        const col = Math.floor(sp.x / TILE);
        const row = Math.floor(sp.y / TILE);
        // 往下找最近的实心
        let found = false;
        for (let r = row; r < lv.h; r++) {
            if (lv.grid[r][col] === 1) { found = true; break; }
        }
        console.log(`  ${found ? '✓' : '✗'} 出生点 (col=${col}, row=${row}) 下方有地面`);
        if (!found) problems++;
    }

    // 检查门是否在地面上
    if (lv.spawns.door) {
        const col = Math.floor(lv.spawns.door.x / TILE);
        const row = Math.floor(lv.spawns.door.y / TILE);
        let ok = false;
        for (let r = row; r < lv.h; r++) if (lv.grid[r][col] === 1) { ok = true; break; }
        console.log(`  ${ok ? '✓' : '✗'} 门 (col=${col}) 下方有地面`);
        if (!ok) problems++;
    }

    // 检查悬空平台高度差（能不能跳上去）
    for (let r = 0; r < lv.h; r++) {
        let run = 0, runStart = -1;
        for (let c = 0; c <= lv.w; c++) {
            const isP = c < lv.w && lv.grid[r][c] === 1;
            if (isP) { if (run === 0) runStart = c; run++; }
            else if (run > 0) {
                // 这是一段平台，看它离地面或下面支撑多高
                if (r < groundRow) {
                    const heightAboveGround = groundRow - r;
                    if (heightAboveGround > SAFE_UP && run < 8) {
                        console.log(`  ⚠ 平台 row=${r} col=${runStart}~${c-1} 高出地面 ${heightAboveGround} 格`
                            + `（可跳 ${SAFE_UP} 格）`);
                    }
                }
                run = 0;
            }
        }
    }
}

console.log('\n' + '='.repeat(50));
if (problems === 0) console.log('关卡可通过性：OK ✅');
else { console.log(`发现 ${problems} 处会导致卡关的问题 ❌`); process.exitCode = 1; }