# -*- coding: utf-8 -*-
"""关卡地图生成器：按玩家实际能力生成，保证可通过。

玩家能力（core.js 的参数）：
  跳高 104.8px = 3.28 格  → 设计安全值 2 格
  跳远 169.0px = 5.29 格  → 设计安全值 3 格
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

W = 100          # 地图宽（列）
H = 18           # 地图高（行）
GROUND_TOP = 15  # 地面从这一行开始（15,16,17 三行实心）
MAX_GAP = 3      # 地面缺口最大宽度（安全值）
MAX_STEP = 2     # 平台台阶最大高度差（安全值）


def blank():
    return [['.'] * W for _ in range(H)]


def fill_ground(g, holes=()):
    """铺地面，holes 是 (start, width) 的缺口列表"""
    for r in range(GROUND_TOP, H):
        for c in range(W):
            g[r][c] = '#'
    for start, width in holes:
        for r in range(GROUND_TOP, H):
            for c in range(start, start + width):
                if 0 <= c < W:
                    g[r][c] = '.'


def platform(g, row, col, width):
    """在第 row 行、第 col 列开始放一段实心平台"""
    for c in range(col, col + width):
        if 0 <= c < W and 0 <= row < H:
            g[row][c] = '#'


def put(g, row, col, ch):
    g[row][col] = ch


def finish(g):
    """转成字符串数组，右端补空格对齐"""
    lines = []
    for r in range(H):
        lines.append(''.join(g[r]))
    return lines


def ladder_right(g, base_row, rail_col, steps, step_w=5):
    """向右上方的阶梯，每级升 2 格（安全值）"""
    r = base_row
    c = rail_col
    for i in range(steps):
        platform(g, r, c, step_w)
        r -= MAX_STEP
        c += step_w + 2      # 水平间隔 2 格，远小于 5.29 格跳跃距离
    return r, c


# ============ 第 1 关：宿舍（教学，最简单）============
def level1():
    g = blank()
    fill_ground(g, holes=[(42, 2), (62, 3)])   # 两个小坑，都能跳过去

    # 一个矮平台，上面放第一份报告
    platform(g, 13, 26, 6)          # 高出地面 2 格
    put(g, 12, 28, 'R')

    # 咖啡
    put(g, 14, 52, 'C')

    # 敌人（地面巡逻）
    put(g, 14, 36, 'E')
    put(g, 14, 72, 'E')

    # 小深在起点附近
    put(g, 14, 11, 'N')

    put(g, 14, 6, 'P')
    put(g, 14, 94, 'D')
    return finish(g)


# ============ 第 2 关：实验室（阶梯 + 更多敌人）============
def level2():
    g = blank()
    fill_ground(g, holes=[(30, 3), (56, 3), (78, 2)])

    # 阶梯：地面 → 13 行（一级，够得着）→ 11 行（可选，放咖啡）
    platform(g, 13, 18, 6)
    put(g, 12, 20, 'R')             # 报告在一级平台上，跳一下就有
    platform(g, 11, 26, 5)
    put(g, 10, 28, 'C')             # 咖啡在二级，想要得多跳一次

    # 中段：两块可跳平台
    platform(g, 12, 48, 4)
    platform(g, 12, 62, 4)
    put(g, 11, 63, 'C')

    # 尾段：一份报告放在高台上
    platform(g, 13, 84, 5)
    put(g, 12, 86, 'R')

    put(g, 14, 40, 'E')
    put(g, 14, 68, 'E')
    platform(g, 13, 72, 6)
    put(g, 12, 74, 'E')             # 平台上的敌人

    put(g, 14, 11, 'N')
    put(g, 14, 6, 'P')
    put(g, 14, 96, 'D')
    return finish(g)


# ============ 第 3 关：教学楼（最难）============
def level3():
    g = blank()
    fill_ground(g, holes=[(24, 3), (44, 3), (64, 3), (84, 3)])

    # 三份报告都放在一级平台上，从地面一跳就能拿
    platform(g, 13, 14, 6)
    put(g, 12, 16, 'R')

    platform(g, 13, 34, 6)
    put(g, 12, 36, 'R')

    platform(g, 13, 74, 6)
    put(g, 12, 76, 'R')

    # 高台只是可选路线，放咖啡
    platform(g, 11, 20, 4)
    put(g, 10, 21, 'C')
    platform(g, 11, 40, 4)


    # 敌人
    put(g, 14, 30, 'E')
    put(g, 14, 60, 'E')
    platform(g, 12, 66, 5)
    put(g, 11, 67, 'E')

    put(g, 14, 8, 'N')
    put(g, 14, 6, 'P')
    put(g, 14, 96, 'D')
    return finish(g)


# ============ 检查 ============
def check(name, rows):
    errs = []
    if not all(len(r) == W for r in rows):
        errs.append('行宽不一致')

    # 地面缺口
    start = -1
    for c in range(W + 1):
        solid = c < W and rows[GROUND_TOP][c] == '#'
        if not solid and start < 0:
            start = c
        elif solid and start >= 0:
            w = c - start
            if start > 0 and c < W and w > MAX_GAP:
                errs.append('地面缺口 x=%d~%d 宽 %d 格（上限 %d）'
                            % (start, c - 1, w, MAX_GAP))
            start = -1

    # 实体数量
    flat = ''.join(rows)
    cnt = {ch: flat.count(ch) for ch in 'PREDCN'}
    if cnt['P'] != 1:
        errs.append('P 数量 %d' % cnt['P'])
    if cnt['D'] != 1:
        errs.append('D 数量 %d' % cnt['D'])
    if cnt['R'] < 1:
        errs.append('没有报告')
    if cnt['E'] < 1:
        errs.append('没有敌人')

    # 平台高度：从地面往上最高 3 级（每级 2 格）
    for r in range(H):
        c = 0
        while c < W:
            if rows[r][c] == '#':
                c0 = c
                while c < W and rows[r][c] == '#':
                    c += 1
                if r < GROUND_TOP:
                    height = GROUND_TOP - r
                    if height > 6:
                        errs.append('平台 row=%d col=%d~%d 高出地面 %d 格（上限 6）'
                                    % (r, c0, c - 1, height))
            else:
                c += 1

    status = '✓' if not errs else '✗'
    print('\n=== %s %s  报告 %d 份 / 敌人 %d 个 ==='
          % (status, name, cnt['R'], cnt['E']))
    for e in errs:
        print('   ! ' + e)
    return not errs


levels = [
    ('宿舍', level1()),
    ('实验室', level2()),
    ('教学楼', level3()),
]

ok = all(check(n, r) for n, r in levels)

# ============ 输出为 JS ============
out = []
out.append('const LEVELS = [')
for i, (name, rows) in enumerate(levels):
    hints = [
        '先学会走和跳。A / D 移动，空格跳跃，按住跳得更高。',
        'ddl 会巡逻，撞上扣时间。咖啡能加速。',
        '最后一关。报告在高台上，一级一级往上跳。',
    ]
    out.append('    {')
    out.append("        name: '%s'," % name)
    out.append("        hint: '%s'," % hints[i])
    out.append('        map: [')
    for r in rows:
        out.append("            '%s'," % r)
    out.append('        ],')
    out.append('    },')
out.append('];')

js = '\n'.join(out)
D = r"C:\Users\a3248\Documents\deepseek-harness\default-workspace\game"
io.open(D + r"\_levels.js", "w", encoding="utf-8").write(js)

print('\n' + '=' * 50)
print('关卡生成 %s，已写入 _levels.js (%d 行)'
      % ('全部通过 ✅' if ok else '有问题 ❌', len(js.splitlines())))