# -*- coding: utf-8 -*-
from PIL import Image
from collections import deque
import os

src = r'd:\RTB优化工程\card\assets\workbench\_figma_tab\ai-frame-3x.png'
out = r'd:\RTB优化工程\card\assets\workbench\ai.png'

im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()


def is_bg(r, g, b, a):
    if a < 10:
        return True
    mn = min(r, g, b)
    mx = max(r, g, b)
    # Figma page fill ~247 and soft near-white fringe
    return mn >= 228 and (mx - mn) <= 22


visited = [[False] * h for _ in range(w)]
q = deque()
seeds = [
    (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
    (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
]
for x, y in seeds:
    r, g, b, a = px[x, y]
    if is_bg(r, g, b, a):
        q.append((x, y))
        visited[x][y] = True

cleared = 0
while q:
    x, y = q.popleft()
    r, g, b, a = px[x, y]
    if not is_bg(r, g, b, a):
        continue
    px[x, y] = (0, 0, 0, 0)
    cleared += 1
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
            visited[nx][ny] = True
            rr, gg, bb, aa = px[nx, ny]
            if is_bg(rr, gg, bb, aa):
                q.append((nx, ny))

# Soften remaining near-white fringe adjacent to transparent
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        mn = min(r, g, b)
        mx = max(r, g, b)
        if mn >= 210 and (mx - mn) <= 25:
            whiteness = (r + g + b) / 3 / 255.0
            if whiteness > 0.88:
                edge = False
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        edge = True
                        break
                if edge:
                    na = int(max(0, min(255, (1 - (whiteness - 0.88) / 0.12) * a)))
                    px[x, y] = (r, g, b, na)

im.save(out, 'PNG')
print('cleared', cleared)
print('corner', px[0, 0])
print('mid', px[5, 75])
print('center', px[75, 75])
print('bytes', os.path.getsize(out))
