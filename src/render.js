// ==================== 8. 渲染 ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = (VIEW_W * scale) + 'px';
    canvas.style.height = (VIEW_H * scale) + 'px';
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
}
window.addEventListener('resize', resize);

// ---------- 背景 ----------
function drawBackground(camX, camY) {
    // 天空渐变
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, C.sky);
    g.addColorStop(1, C.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 远景楼群（视差 0.2）
    const px1 = camX * 0.2;
    ctx.fillStyle = C.far;
    for (let i = 0; i < 40; i++) {
        const bx = (i * 180 - px1) % (40 * 180);
        const bh = 90 + ((i * 37) % 130);
        ctx.fillRect(bx, VIEW_H - bh - 60, 110, bh);
        // 窗
        ctx.fillStyle = 'rgba(255,220,150,0.10)';
        for (let wy = 0; wy < Math.floor(bh / 34); wy++) {
            for (let wx = 0; wx < 3; wx++) {
                if ((i + wy + wx) % 3 === 0) {
                    ctx.fillRect(bx + 14 + wx * 30, VIEW_H - bh - 46 + wy * 32, 16, 16);
                }
            }
        }
        ctx.fillStyle = C.far;
    }

    // 近景楼群（视差 0.45）
    const px2 = camX * 0.45;
    ctx.fillStyle = C.near;
    for (let i = 0; i < 40; i++) {
        const bx = (i * 240 - px2) % (40 * 240);
        const bh = 130 + ((i * 53) % 90);
        ctx.fillRect(bx, VIEW_H - bh - 20, 150, bh);
    }
}

// ---------- 瓦片 ----------
function drawTiles(level, camX, camY) {
    const c0 = Math.max(0, Math.floor(camX / TILE));
    const c1 = Math.min(level.w - 1, Math.ceil((camX + VIEW_W) / TILE));
    const r0 = Math.max(0, Math.floor(camY / TILE));
    const r1 = Math.min(level.h - 1, Math.ceil((camY + VIEW_H) / TILE));

    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const t = level.grid[r][c];
            if (!t) continue;
            const x = Math.round(c * TILE - camX);
            const y = Math.round(r * TILE - camY);

            if (t === 1) {
                // 砖块
                ctx.fillStyle = C.tileBody;
                ctx.fillRect(x, y, TILE, TILE);
                // 顶面亮线
                const above = isSolidAt(level, c, r - 1);
                if (!above) {
                    ctx.fillStyle = C.tileTop;
                    ctx.fillRect(x, y, TILE, 7);
                    ctx.fillStyle = C.tileEdge;
                    ctx.fillRect(x, y, TILE, 2);
                }
                // 砖缝
                ctx.fillStyle = 'rgba(0,0,0,0.16)';
                ctx.fillRect(x, y + TILE - 2, TILE, 2);
                if ((c + r) % 2 === 0) ctx.fillRect(x + TILE - 2, y, 2, TILE);
            } else if (t === 2) {
                // 单向平台
                ctx.fillStyle = '#6b7a9e';
                ctx.fillRect(x, y, TILE, 8);
                ctx.fillStyle = C.tileEdge;
                ctx.fillRect(x, y, TILE, 2);
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(x, y + 8, TILE, 2);
            }
        }
    }
}

// ---------- 玩家 ----------
function drawPlayer(p, camX, camY, tick) {
    const x = Math.round(p.x - camX);
    const y = Math.round(p.y - camY);

    if (p.invuln > 0 && Math.floor(tick / 4) % 2 === 0) return;  // 受损闪烁

    const flip = p.face < 0;
    ctx.save();
    if (flip) {
        ctx.translate(x + p.w / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(x + p.w / 2), 0);
    }

    const body = p.hurtFlash > 0 ? '#ffffff' : C.player;
    const dark = p.hurtFlash > 0 ? '#ffffff' : C.playerDark;

    // 腿（走路摆动）
    const swing = p.onGround ? Math.sin(p.walkPhase) * 4 : -2;
    ctx.fillStyle = dark;
    ctx.fillRect(x + 3, y + p.h - 8 + swing, 6, 8 - swing);
    ctx.fillRect(x + p.w - 9, y + p.h - 8 - swing, 6, 8 + swing);

    // 身体
    ctx.fillStyle = body;
    ctx.fillRect(x + 2, y + 10, p.w - 4, p.h - 18);

    // 头
    ctx.fillStyle = body;
    ctx.fillRect(x + 4, y, p.w - 8, 12);
    // 头发
    ctx.fillStyle = '#3a2f22';
    ctx.fillRect(x + 4, y, p.w - 8, 4);

    // 眼睛（朝向前方）
    ctx.fillStyle = '#1b2038';
    ctx.fillRect(x + p.w - 8, y + 6, 2, 3);
    ctx.fillRect(x + p.w - 13, y + 6, 2, 3);

    // 加速时的拖影光
    if (p.speedBoost > 0) {
        ctx.fillStyle = 'rgba(224,177,85,0.35)';
        ctx.fillRect(x - 6, y + 6, 6, p.h - 12);
    }

    ctx.restore();
}

// ---------- 敌人 ----------
function drawEnemy(e, camX, camY) {
    if (!e.alive) return;
    const x = Math.round(e.x - camX);
    const y = Math.round(e.y - camY);
    const wob = Math.sin(e.phase) * 2;

    // 身体
    ctx.fillStyle = C.enemyDark;
    ctx.fillRect(x, y + 4, e.w, e.h - 4);
    ctx.fillStyle = C.enemy;
    ctx.fillRect(x + 2, y + wob * 0.3, e.w - 4, e.h - 6);

    // 尖刺
    ctx.fillStyle = C.enemyDark;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 3 + i * 8, y);
        ctx.lineTo(x + 7 + i * 8, y - 6);
        ctx.lineTo(x + 11 + i * 8, y);
        ctx.closePath();
        ctx.fill();
    }

    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + 10, 5, 5);
    ctx.fillRect(x + e.w - 11, y + 10, 5, 5);
    ctx.fillStyle = '#1b2038';
    const look = e.vx > 0 ? 2 : 0;
    ctx.fillRect(x + 7 + look, y + 11, 2, 3);
    ctx.fillRect(x + e.w - 10 + look, y + 11, 2, 3);

    // 腿
    ctx.fillStyle = C.enemyDark;
    ctx.fillRect(x + 3, y + e.h - 2, 6, 3);
    ctx.fillRect(x + e.w - 9, y + e.h - 2, 6, 3);
}

// ---------- 报告 ----------
function drawReport(rep, camX, camY) {
    if (rep.got) return;
    const bobY = Math.sin(rep.bob) * 4;
    const x = Math.round(rep.x - camX);
    const y = Math.round(rep.y - camY + bobY);

    // 光晕
    ctx.fillStyle = 'rgba(244,241,232,0.12)';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, 6.28);
    ctx.fill();

    // 纸
    ctx.fillStyle = C.paper;
    ctx.fillRect(x - 9, y - 12, 18, 24);
    // 折角
    ctx.fillStyle = '#d8d3c2';
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 12);
    ctx.lineTo(x + 9, y - 12);
    ctx.lineTo(x + 9, y - 6);
    ctx.closePath();
    ctx.fill();
    // 横线
    ctx.fillStyle = C.paperLine;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 6, y - 6 + i * 5, 12, 1);
}

// ---------- 咖啡 ----------
function drawCoffee(cf, camX, camY) {
    if (cf.got) return;
    const bobY = Math.sin(cf.bob) * 3;
    const x = Math.round(cf.x - camX);
    const y = Math.round(cf.y - camY + bobY);

    ctx.fillStyle = 'rgba(224,177,85,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, 6.28);
    ctx.fill();

    // 杯身
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(x - 7, y - 6, 14, 15);
    // 咖啡液
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 6, y - 3, 12, 6);
    // 把手
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 9, y + 1, 4, -1.2, 1.2);
    ctx.stroke();
    // 热气
    ctx.strokeStyle = 'rgba(232,228,216,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 3 + i * 6, y - 9);
        ctx.quadraticCurveTo(x - 5 + i * 6, y - 14, x - 3 + i * 6, y - 19);
        ctx.stroke();
    }
}

// ---------- NPC 小深 ----------
function drawNpc(n, camX, camY, tick) {
    const x = Math.round(n.x - camX);
    const y = Math.round(n.y - camY);
    const float = Math.sin(tick * 0.05) * 3;

    // 光晕
    ctx.fillStyle = 'rgba(126,200,227,0.10)';
    ctx.beginPath();
    ctx.arc(x + 12, y + 14 + float, 26, 0, 6.28);
    ctx.fill();

    // 身体（小一点，漂浮）
    ctx.fillStyle = C.npcDark;
    ctx.fillRect(x + 4, y + 8 + float, 16, 20);
    ctx.fillStyle = C.npc;
    ctx.fillRect(x + 5, y + 9 + float, 14, 18);
    // 头
    ctx.fillStyle = C.npc;
    ctx.fillRect(x + 6, y + float, 12, 10);
    // 眼睛
    ctx.fillStyle = '#1b2038';
    ctx.fillRect(x + 9, y + 4 + float, 2, 3);
    ctx.fillRect(x + 14, y + 4 + float, 2, 3);
    // 呆毛
    ctx.strokeStyle = C.npc;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + float);
    ctx.quadraticCurveTo(x + 16, y - 6 + float, x + 13, y - 9 + float);
    ctx.stroke();
}

// ---------- 门 ----------
function drawDoor(door, camX, camY, open, tick) {
    const x = Math.round(door.x - camX);
    const y = Math.round(door.y - camY);

    // 门框
    ctx.fillStyle = open ? '#4a7c59' : '#4a4a5e';
    ctx.fillRect(x, y - 4, TILE, TILE + 4);
    // 门内
    ctx.fillStyle = open ? '#2e5c3c' : '#2a2a38';
    ctx.fillRect(x + 4, y, TILE - 8, TILE);
    // 把手
    ctx.fillStyle = open ? C.accent : '#6b6b80';
    ctx.fillRect(x + TILE - 12, y + TILE / 2, 3, 3);

    if (open) {
        // 门口的光
        const a = 0.12 + Math.sin(tick * 0.08) * 0.05;
        ctx.fillStyle = `rgba(224,177,85,${a})`;
        ctx.fillRect(x - 12, y - 20, TILE + 24, TILE + 20);
    }
}

// ---------- 粒子 ----------
function drawParticles(parts, camX, camY) {
    for (const pt of parts) {
        const a = clamp(pt.life / 30, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x - camX), Math.round(pt.y - camY), 3, 3);
    }
    ctx.globalAlpha = 1;
}

// ---------- HUD ----------
function drawHUD(g) {
    // 时间条
    const barW = 240, barH = 14;
    const bx = 24, by = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

    const ratio = g.timeLeft / g.totalTime;
    const col = ratio > 0.5 ? '#5aa469' : (ratio > 0.22 ? C.accent : C.enemy);
    ctx.fillStyle = '#2a2a38';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = col;
    ctx.fillRect(bx, by, barW * ratio, barH);

    ctx.fillStyle = C.text;
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`截止 ${Math.ceil(g.timeLeft)} 秒`, bx + barW + 12, by + barH / 2);

    // 报告计数
    const rx = VIEW_W - 150, ry = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(rx - 8, ry - 6, 132, 30);
    // 小图标
    ctx.fillStyle = C.paper;
    ctx.fillRect(rx, ry, 12, 16);
    ctx.fillStyle = C.paperLine;
    for (let i = 0; i < 3; i++) ctx.fillRect(rx + 2, ry + 4 + i * 4, 8, 1);

    ctx.fillStyle = C.text;
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${g.collected} / ${g.totalReports}`, rx + 22, ry + 8);

    // 关卡名
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = C.dim;
    ctx.fillText(`第 ${g.levelIndex + 1} 关　${g.level.name}`, VIEW_W / 2, 26);

    // 提示消息
    if (g.messageTimer > 0) {
        const a = clamp(g.messageTimer / 40, 0, 1);
        ctx.globalAlpha = a;
        ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
        const tw = ctx.measureText(g.message).width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(VIEW_W / 2 - tw / 2 - 18, VIEW_H - 100, tw + 36, 40);
        ctx.fillStyle = C.text;
        ctx.fillText(g.message, VIEW_W / 2, VIEW_H - 80);
        ctx.globalAlpha = 1;
    }

    // 小深对话
    if (g.npcTalk) {
        ctx.textAlign = 'left';
        ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
        const tw = ctx.measureText(g.npcTalk.text).width;
        const bx2 = 40, by2 = VIEW_H - 190;
        // 气泡
        ctx.fillStyle = 'rgba(126,200,227,0.92)';
        ctx.fillRect(bx2, by2, tw + 32, 44);
        ctx.fillStyle = '#1b2038';
        ctx.fillText(g.npcTalk.text, bx2 + 16, by2 + 22);
        // 小尾巴
        ctx.fillStyle = 'rgba(126,200,227,0.92)';
        ctx.beginPath();
        ctx.moveTo(bx2 + 24, by2 + 44);
        ctx.lineTo(bx2 + 36, by2 + 44);
        ctx.lineTo(bx2 + 26, by2 + 54);
        ctx.closePath();
        ctx.fill();
    }
}

// ---------- 状态界面 ----------
function drawTitle(tick) {
    ctx.fillStyle = 'rgba(12,15,26,0.92)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 装饰线
    ctx.strokeStyle = 'rgba(224,177,85,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const y = 120 + i * 60;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VIEW_W, y);
        ctx.stroke();
    }

    ctx.textAlign = 'center';

    // 标题
    const float = Math.sin(tick * 0.04) * 4;
    ctx.font = 'bold 72px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = C.accent;
    ctx.fillText('赶 报 告', VIEW_W / 2, 200 + float);

    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = C.dim;
    ctx.fillText('一个关于期末的小游戏', VIEW_W / 2, 248 + float);

    // 操作说明
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = C.text;
    const lines = [
        'A / D 或 ← → 移动　　空格 / W 跳跃',
        '收集所有报告，别让倒计时归零',
        'ddl 撞不得，咖啡能加速',
    ];
    lines.forEach((t, i) => ctx.fillText(t, VIEW_W / 2, 330 + i * 34));

    // 开始提示
    const blink = Math.floor(tick / 30) % 2 === 0;
    if (blink) {
        ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.player;
        ctx.fillText('按 空格 开始', VIEW_W / 2, 470);
    }
}

function drawEnd(g, win, tick) {
    ctx.fillStyle = 'rgba(12,15,26,0.90)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';

    if (win) {
        ctx.font = 'bold 56px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.tone || '#8fd18f';
        ctx.fillText('赶完了', VIEW_W / 2, 200);

        ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.text;
        ctx.fillText(`用时 ${Math.ceil(g.totalTime - g.timeLeft)} 秒　剩余 ${Math.ceil(g.timeLeft)} 秒`, VIEW_W / 2, 260);

        // 小深的评语
        ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.npc;
        const quips = [
            '小深：就这？我还以为多难。',
            '小深：交了吧，别拖了。',
            '小深：干得还行，勉强夸你一句。',
        ];
        ctx.fillText(quips[g.levelIndex % quips.length], VIEW_W / 2, 330);
    } else {
        ctx.font = 'bold 56px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.enemy;
        ctx.fillText('来不及了', VIEW_W / 2, 210);

        ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.text;
        ctx.fillText(`报告 ${g.collected} / ${g.totalReports}`, VIEW_W / 2, 270);

        ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.npc;
        ctx.fillText('小深：重来一次呗，又不丢人。', VIEW_W / 2, 330);
    }

    const blink = Math.floor(tick / 30) % 2 === 0;
    if (blink) {
        ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = C.player;
        ctx.fillText('按 空格 继续', VIEW_W / 2, 450);
    }
}

// ---------- 主绘制 ----------
function render(g, tick) {
    if (g.state === 'title') {
        drawTitle(tick);
        return;
    }

    const shakeX = g.shake > 0.5 ? rand(-g.shake, g.shake) : 0;
    const shakeY = g.shake > 0.5 ? rand(-g.shake, g.shake) : 0;
    const camX = g.camX - shakeX;
    const camY = g.camY - shakeY;

    drawBackground(camX, camY);
    drawTiles(g.level, camX, camY);

    // 门
    const allGot = g.collected >= g.totalReports;
    drawDoor(g.door, camX, camY, allGot, tick);

    // 收集品
    for (const cf of g.coffees) drawCoffee(cf, camX, camY);
    for (const rep of g.reports) drawReport(rep, camX, camY);
    for (const n of g.npcs) drawNpc(n, camX, camY, tick);

    // 敌人
    for (const e of g.enemies) drawEnemy(e, camX, camY);

    // 玩家
    drawPlayer(g.player, camX, camY, tick);

    // 粒子
    drawParticles(g.particles, camX, camY);

    // HUD
    drawHUD(g);

    // 结束界面
    if (g.state === 'clear') drawEnd(g, true, tick);
    else if (g.state === 'fail') drawEnd(g, false, tick);

    // 触屏提示（仅移动端）
    if ('ontouchstart' in window && g.state === 'playing') {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#fff';
        ctx.fillRect(40, VIEW_H - 120, 70, 70);
        ctx.fillRect(130, VIEW_H - 120, 70, 70);
        ctx.fillRect(VIEW_W - 130, VIEW_H - 120, 90, 70);
        ctx.globalAlpha = 1;
    }
}