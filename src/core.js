/*
 * 赶报告 —— 一个像素风横版闯关小游戏
 * 单文件 HTML5 Canvas 实现，无任何外部依赖。
 *
 * 结构：
 *   1. 常量与工具
 *   2. 输入（键盘 + 触屏）
 *   3. 关卡数据（瓦片地图 + 实体标记）
 *   4. 物理与碰撞（AABB 分轴解算）
 *   5. 实体：玩家 / 敌人 / 收集品 / NPC
 *   6. 摄像机与渲染
 *   7. 游戏状态机（标题 / 游戏中 / 通关 / 失败）
 */

// ==================== 1. 常量 ====================
const TILE = 32;
const VIEW_W = 960, VIEW_H = 540;

const GRAVITY = 0.62;
const MAX_FALL = 14;
const ACCEL = 0.85;
const FRICTION = 0.80;
const AIR_FRICTION = 0.92;
const MAX_RUN = 4.6;
const JUMP_V = -11.4;          // 起跳初速
const JUMP_CUT = 0.42;         // 松手时速度乘数（可变跳跃高度）
const COYOTE = 7;              // 离开平台后仍可跳的帧数
const JUMP_BUFFER = 7;         // 落地前按跳的缓冲帧数

// 调色板：冷色为主，标题用暖色点缀
const C = {
    sky: '#1b2038',
    sky2: '#252c4a',
    far: '#2c3457',
    near: '#39436b',
    tileTop: '#5a6b8c',
    tileBody: '#3d4763',
    tileEdge: '#7b8db0',
    player: '#f0c674',
    playerDark: '#b8913f',
    paper: '#f4f1e8',
    paperLine: '#c9c2ab',
    enemy: '#e06c75',
    enemyDark: '#a84b52',
    npc: '#7ec8e3',
    npcDark: '#4a93ad',
    text: '#e8ecf4',
    dim: '#8b93ad',
    accent: '#e0b155',
};

// ==================== 2. 工具 ====================
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

// ==================== 3. 输入 ====================
const Keys = Object.create(null);
const justPressed = Object.create(null);

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!Keys[k]) justPressed[k] = true;
    Keys[k] = true;
});
window.addEventListener('keyup', e => {
    Keys[e.key.toLowerCase()] = false;
});

// 触屏：左右两个虚拟区 + 跳跃
const Touch = { left: false, right: false, jump: false };
function bindTouch(canvas) {
    const zones = [
        { id: 'left',  x0: 0,    x1: 0.18 },
        { id: 'right', x0: 0.18, x1: 0.36 },
        { id: 'jump',  x0: 0.60, x1: 1.0  },
    ];
    const active = new Map();

    function handle(e) {
        e.preventDefault();
        Touch.left = Touch.right = Touch.jump = false;
        for (const t of e.touches) {
            const r = canvas.getBoundingClientRect();
            const fx = (t.clientX - r.left) / r.width;
            const fy = (t.clientY - r.top) / r.height;
            if (fy > 0.45) {
                for (const z of zones) {
                    if (fx >= z.x0 && fx < z.x1) Touch[z.id] = true;
                }
            }
        }
    }
    canvas.addEventListener('touchstart', handle, { passive: false });
    canvas.addEventListener('touchmove', handle, { passive: false });
    canvas.addEventListener('touchend', handle, { passive: false });
    canvas.addEventListener('touchcancel', handle, { passive: false });
}

// 统一的控制查询
function inputState() {
    const left  = Keys['a'] || Keys['arrowleft']  || Touch.left;
    const right = Keys['d'] || Keys['arrowright'] || Touch.right;
    const jump  = Keys['w'] || Keys[' '] || Keys['arrowup'] || Touch.jump;
    return { left, right, jump };
}

// ==================== 4. 关卡 ====================
// 图例：
//   .  空        #  地面/砖块      =  单向平台（可从下穿过）
//   P  玩家出生   R  报告（收集）    D  门（终点）
//   E  敌人（巡逻）  C  咖啡（加速）  N  小深（对话）
//   ^  尖刺（碰到扣时间）
const LEVELS = [
    {
        name: '宿舍',
        hint: '先学会走和跳。A / D 移动，空格跳跃，按住跳得更高。',
        map: [
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '............................R.......................................................................',
            '..........................######....................................................................',
            '......P....N........................E...............C...................E.....................D.....',
            '##########################################..##################...###################################',
            '##########################################..##################...###################################',
            '##########################################..##################...###################################',
        ],
    },
    {
        name: '实验室',
        hint: 'ddl 会巡逻，撞上扣时间。咖啡能加速。',
        map: [
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '............................C.......................................................................',
            '..........................#####................................C....................................',
            '....................R...........................####..........####........E...........R.............',
            '..................######................................................######......#####...........',
            '......P....N............................E...........................E...........................D...',
            '##############################...#######################...###################..####################',
            '##############################...#######################...###################..####################',
            '##############################...#######################...###################..####################',
        ],
    },
    {
        name: '教学楼',
        hint: '最后一关。报告在高台上，一级一级往上跳。',
        map: [
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '....................................................................................................',
            '.....................C..............................................................................',
            '....................####................####.......................E................................',
            '................R...................R.............................#####.....R.......................',
            '..............######..............######..................................######....................',
            '......P.N.....................E.............................E...................................D...',
            '########################...#################...#################...#################...#############',
            '########################...#################...#################...#################...#############',
            '########################...#################...#################...#################...#############',
        ],
    },
];

// 解析地图为对象
function parseLevel(def) {
    const rows = def.map;
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    const grid = [];
    const spawns = { player: null, enemies: [], reports: [], coffees: [], npcs: [], door: null };

    for (let y = 0; y < h; y++) {
        const line = rows[y];
        const row = [];
        for (let x = 0; x < w; x++) {
            const ch = x < line.length ? line[x] : '.';
            let solid = false, platform = false;

            // 1 = 实心砖块，2 = 单向平台，0 = 空
            if (ch === '#') { solid = true; row.push(1); }
            else if (ch === '=') { platform = true; row.push(2); }
            else row.push(0);

            if (ch === 'P') spawns.player = { x: x * TILE, y: y * TILE };
            else if (ch === 'D') spawns.door = { x: x * TILE, y: y * TILE };
            else if (ch === 'E') spawns.enemies.push({ x: x * TILE, y: y * TILE });
            else if (ch === 'R') spawns.reports.push({ x: x * TILE + 16, y: y * TILE + 16 });
            else if (ch === 'C') spawns.coffees.push({ x: x * TILE + 16, y: y * TILE + 16 });
            else if (ch === 'N') spawns.npcs.push({ x: x * TILE, y: y * TILE });
            else if (ch === '^') { row[x] = 2; spawns.spikes = spawns.spikes || []; }
        }
        grid.push(row);
    }
    return { grid, w, h, spawns, name: def.name, hint: def.hint };
}

// 瓦片查询
function tileAt(level, col, row) {
    if (row < 0 || row >= level.h || col < 0 || col >= level.w) return col < 0 || col >= level.w ? 1 : 0;
    return level.grid[row][col];
}
function isSolidAt(level, col, row) {
    const t = tileAt(level, col, row);
    return t === 1;
}
function isPlatformAt(level, col, row) {
    return tileAt(level, col, row) === 2;
}

// ==================== 5. 玩家 ====================
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 22; this.h = 30;
        this.vx = 0; this.vy = 0;
        this.onGround = false;
        this.face = 1;
        this.coyote = 0;
        this.buffer = 0;
        this.jumping = false;
        this.walkPhase = 0;
        this.hurtFlash = 0;
        this.invuln = 0;
        this.speedBoost = 0;   // 咖啡加速剩余帧
    }

    update(level) {
        const { left, right, jump } = inputState();

        // ---- 水平移动 ----
        const maxSpeed = this.speedBoost > 0 ? MAX_RUN * 1.55 : MAX_RUN;
        const accel = this.speedBoost > 0 ? ACCEL * 1.4 : ACCEL;

        if (left && !right) { this.vx -= accel; this.face = -1; }
        else if (right && !left) { this.vx += accel; this.face = 1; }
        else { this.vx *= this.onGround ? FRICTION : AIR_FRICTION; }

        this.vx = clamp(this.vx, -maxSpeed, maxSpeed);
        if (Math.abs(this.vx) < 0.08) this.vx = 0;

        // ---- 跳跃：缓冲 + coyote ----
        if (jump) {
            if (!this.jumpHeld) this.buffer = JUMP_BUFFER;
            this.jumpHeld = true;
        } else {
            this.jumpHeld = false;
        }
        if (this.buffer > 0) this.buffer--;
        if (this.coyote > 0) this.coyote--;

        if (this.buffer > 0 && this.coyote > 0) {
            this.vy = JUMP_V;
            this.buffer = 0;
            this.coyote = 0;
            this.jumping = true;
            this.onGround = false;
        }
        // 松手减速（短跳）
        if (this.jumping && !jump && this.vy < 0) {
            this.vy *= JUMP_CUT;
            this.jumping = false;
        }

        // ---- 重力 ----
        this.vy += GRAVITY;
        this.vy = clamp(this.vy, -99, MAX_FALL);

        // ---- 分轴碰撞 ----
        this.moveX(level);
        this.moveY(level);

        // ---- 状态衰减 ----
        if (this.onGround) this.coyote = COYOTE;
        if (this.hurtFlash > 0) this.hurtFlash--;
        if (this.invuln > 0) this.invuln--;
        if (this.speedBoost > 0) this.speedBoost--;
        if (this.onGround && Math.abs(this.vx) > 0.5) this.walkPhase += 0.22;
        else if (!this.onGround) this.walkPhase = 0;

        // 掉出世界
        if (this.y > (level.h - 2) * TILE) return 'fell';
        return null;
    }

    moveX(level) {
        this.x += this.vx;
        const top = Math.floor(this.y / TILE);
        const bottom = Math.floor((this.y + this.h - 1) / TILE);

        if (this.vx > 0) {
            const col = Math.floor((this.x + this.w - 1) / TILE);
            for (let r = top; r <= bottom; r++) {
                if (isSolidAt(level, col, r)) {
                    this.x = col * TILE - this.w;
                    this.vx = 0;
                    break;
                }
            }
        } else if (this.vx < 0) {
            const col = Math.floor(this.x / TILE);
            for (let r = top; r <= bottom; r++) {
                if (isSolidAt(level, col, r)) {
                    this.x = (col + 1) * TILE;
                    this.vx = 0;
                    break;
                }
            }
        }
    }

    moveY(level) {
        this.y += this.vy;
        const leftC = Math.floor(this.x / TILE);
        const rightC = Math.floor((this.x + this.w - 1) / TILE);

        if (this.vy > 0) {   // 下落
            const row = Math.floor((this.y + this.h - 1) / TILE);
            for (let c = leftC; c <= rightC; c++) {
                if (isSolidAt(level, c, row)) {
                    this.y = row * TILE - this.h;
                    this.vy = 0;
                    this.onGround = true;
                    this.jumping = false;
                    return;
                }
                if (isPlatformAt(level, c, row)) {
                    // 单向平台：只在下落且脚落在平台顶面时接住
                    const top = row * TILE;
                    if (this.y + this.h - this.vy <= top + 2) {
                        this.y = top - this.h;
                        this.vy = 0;
                        this.onGround = true;
                        this.jumping = false;
                        return;
                    }
                }
            }
            this.onGround = false;
        } else if (this.vy < 0) {  // 上升
            const row = Math.floor(this.y / TILE);
            for (let c = leftC; c <= rightC; c++) {
                if (isSolidAt(level, c, row)) {
                    this.y = (row + 1) * TILE;
                    this.vy = 0;
                    return;
                }
            }
            this.onGround = false;
        } else {
            // 速度为 0 时检查脚下
            const row = Math.floor((this.y + this.h) / TILE);
            let grounded = false;
            for (let c = leftC; c <= rightC; c++) {
                if (isSolidAt(level, c, row)) { grounded = true; break; }
                if (isPlatformAt(level, c, row) && Math.abs(this.y + this.h - row * TILE) < 3) { grounded = true; break; }
            }
            this.onGround = grounded;
        }
    }
}

// ==================== 6. 敌人 ====================
class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y + 2;
        this.w = 26; this.h = 30;
        this.vx = -0.9;
        this.vy = 0;
        this.alive = true;
        this.phase = rand(0, 6.28);
    }

    update(level) {
        this.vy = clamp(this.vy + GRAVITY, -99, MAX_FALL);
        this.y += this.vy;

        // 落地
        const row = Math.floor((this.y + this.h - 1) / TILE);
        const lc = Math.floor(this.x / TILE), rc = Math.floor((this.x + this.w - 1) / TILE);
        for (let c = lc; c <= rc; c++) {
            if (isSolidAt(level, c, row)) {
                this.y = row * TILE - this.h;
                this.vy = 0;
                break;
            }
        }

        // 水平巡逻：撞墙或前方无路就掉头
        const nextX = this.x + this.vx;
        const frontCol = this.vx > 0 ? Math.floor((nextX + this.w) / TILE) : Math.floor(nextX / TILE);
        const bodyRow = Math.floor((this.y + this.h / 2) / TILE);
        const footRow = Math.floor((this.y + this.h + 4) / TILE);

        const hitWall = isSolidAt(level, frontCol, bodyRow);
        const noFloor = !isSolidAt(level, frontCol, footRow) && !isPlatformAt(level, frontCol, footRow);

        if (hitWall || (noFloor && this.vy === 0)) {
            this.vx = -this.vx;
        } else {
            this.x = nextX;
        }

        this.phase += 0.12;
    }
}

// ==================== 7. 游戏主体 ====================
const Game = {
    state: 'title',        // title | playing | clear | fail
    levelIndex: 0,
    level: null,
    player: null,
    enemies: [],
    reports: [],
    coffees: [],
    npcs: [],
    door: null,
    camX: 0,
    camY: 0,
    timeLeft: 0,
    totalTime: 0,
    collected: 0,
    totalReports: 0,
    message: '',
    messageTimer: 0,
    npcTalk: null,
    shake: 0,
    tick: 0,
    particles: [],

    startLevel(i) {
        this.levelIndex = i;
        const def = LEVELS[i];
        this.level = parseLevel(def);
        const sp = this.level.spawns;

        this.player = new Player(sp.player.x, sp.player.y);
        this.enemies = sp.enemies.map(e => new Enemy(e.x, e.y));
        this.reports = sp.reports.map(r => ({ ...r, got: false, bob: rand(0, 6.28) }));
        this.coffees = sp.coffees.map(c => ({ ...c, got: false, bob: rand(0, 6.28) }));
        this.npcs = sp.npcs.map(n => ({ ...n, said: false }));
        this.door = sp.door;

        this.totalReports = this.reports.length;
        this.collected = 0;
        this.timeLeft = 60 + this.totalReports * 12;
        this.totalTime = this.timeLeft;
        this.camX = 0; this.camY = 0;
        this.shake = 0;
        this.particles = [];
        this.doorMsgCd = 0;
        this.state = 'playing';
        this.showMessage(def.hint, 180);
    },

    showMessage(text, frames) {
        this.message = text;
        this.messageTimer = frames;
    },

    update() {
        if (this.state !== 'playing') return;
        this.tick++;

        // 计时
        this.timeLeft -= 1 / 60;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.state = 'fail';
            return;
        }

        const p = this.player;
        const r = p.update(this.level);

        if (r === 'fell') {
            this.state = 'fail';
            return;
        }

        // ---- 敌人 ----
        for (const e of this.enemies) {
            if (!e.alive) continue;
            e.update(this.level);
            if (p.invuln <= 0 && rectsOverlap(p, e)) {
                this.hurt(8, '被 ddl 撞了');
            }
        }

        // ---- 收集报告 ----
        for (const rep of this.reports) {
            if (rep.got) continue;
            const box = { x: rep.x - 14, y: rep.y - 18, w: 28, h: 36 };
            if (rectsOverlap(p, box)) {
                rep.got = true;
                this.collected++;
                this.burst(rep.x, rep.y, C.paper, 14);
                this.showMessage(`拿到第 ${this.collected}/${this.totalReports} 份报告`, 90);
            }
        }

        // ---- 咖啡 ----
        for (const cf of this.coffees) {
            if (cf.got) continue;
            const box = { x: cf.x - 12, y: cf.y - 16, w: 24, h: 32 };
            if (rectsOverlap(p, box)) {
                cf.got = true;
                p.speedBoost = 300;
                this.burst(cf.x, cf.y, C.accent, 12);
                this.showMessage('咖啡！速度提升 5 秒', 90);
            }
        }

        // ---- NPC 对话 ----
        for (const n of this.npcs) {
            if (n.said) continue;
            const box = { x: n.x - 20, y: n.y - 20, w: 72, h: 60 };
            if (rectsOverlap(p, box)) {
                n.said = true;
                this.npcTalk = { text: NPC_LINES[this.levelIndex % NPC_LINES.length], t: 240 };
            }
        }
        if (this.npcTalk) {
            this.npcTalk.t--;
            if (this.npcTalk.t <= 0) this.npcTalk = null;
        }

        // ---- 门 ----
        const doorBox = { x: this.door.x + 4, y: this.door.y - 4, w: 24, h: 40 };
        if (rectsOverlap(p, doorBox)) {
            if (this.collected >= this.totalReports) {
                this.state = 'clear';
            } else if (this.doorMsgCd <= 0) {
                // 门口提示优先于普通提示，加 50 帧冷却防刷屏
                this.showMessage(`还差 ${this.totalReports - this.collected} 份报告`, 60);
                this.doorMsgCd = 50;
            }
        }

        // ---- 摄像机 ----
        const targetX = p.x + p.w / 2 - VIEW_W / 2;
        const targetY = p.y + p.h / 2 - VIEW_H / 2 - 20;
        this.camX = lerp(this.camX, targetX, 0.12);
        this.camY = lerp(this.camY, targetY, 0.10);
        this.camX = clamp(this.camX, 0, this.level.w * TILE - VIEW_W);
        this.camY = clamp(this.camY, -80, this.level.h * TILE - VIEW_H + 60);

        // ---- 杂项 ----
        if (this.messageTimer > 0) this.messageTimer--;
        if (this.doorMsgCd > 0) this.doorMsgCd--;
        if (this.shake > 0) this.shake *= 0.88;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.22; pt.life--;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
        for (const rep of this.reports) rep.bob += 0.07;
        for (const cf of this.coffees) cf.bob += 0.09;
    },

    hurt(sec, why) {
        this.timeLeft = Math.max(0, this.timeLeft - sec);
        this.player.invuln = 60;
        this.player.hurtFlash = 20;
        this.shake = 8;
        this.showMessage(`${why}  时间 -${sec} 秒`, 90);
    },

    burst(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x, y,
                vx: rand(-3, 3), vy: rand(-4, 1),
                life: rand(18, 34), color,
            });
        }
    },
};

const NPC_LINES = [
    '小深：这个平台能跳上去，别看它高。',
    '小深：ddl 是撞不得的，绕开就行。',
    '小深：报告凑齐了门才开，别急着跑。',
];