import { describe, expect, it } from 'vitest';
import {
  SEA_COVER_BARRIER,
  SEA_COVER_BELOW,
  SEA_COVER_NONE,
  SEA_REACH_DRY,
  SEA_REACH_WET,
  createSeaReachFrame,
  markSeaTriangle,
  resolveSeaReach,
  seaReachUvTransform,
  type SeaReachFrame,
  type SeaTriangle,
} from '../sea-reach-grid';

const SEA = 0;

function drain<T>(task: Generator<void, T>): { value: T; steps: number } {
  let steps = 0;
  for (;;) {
    const step = task.next();
    steps += 1;
    if (step.done) return { value: step.value, steps };
  }
}

function frameOf(width: number, height: number, cellSize = 1): SeaReachFrame {
  return { minX: 0, minZ: 0, cellSize, width, height };
}

function triangle(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  overrides: Partial<Pick<SeaTriangle, 'side' | 'mirrored'>> = {},
): SeaTriangle {
  return {
    ax: a[0],
    ay: a[1],
    az: a[2],
    bx: b[0],
    by: b[1],
    bz: b[2],
    cx: c[0],
    cy: c[1],
    cz: c[2],
    side: 'front',
    mirrored: false,
    ...overrides,
  };
}

/** 위를 향한(법선 +y) 직사각형을 삼각형 둘로. */
function upQuad(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
): SeaTriangle[] {
  return [
    triangle([x0, y, z0], [x0, y, z1], [x1, y, z1]),
    triangle([x0, y, z0], [x1, y, z1], [x1, y, z0]),
  ];
}

/** 격자를 행 문자열로 — '.' NONE, 'b' BELOW, '#' BARRIER. */
function coverRows(cover: Uint8Array, frame: SeaReachFrame): string[] {
  const glyph = ['.', 'b', '#'];
  const rows: string[] = [];
  for (let j = 0; j < frame.height; j += 1) {
    let row = '';
    for (let i = 0; i < frame.width; i += 1) {
      row += glyph[cover[j * frame.width + i]];
    }
    rows.push(row);
  }
  return rows;
}

/** 행 문자열로 덮개 격자를 만든다. */
function coverOf(rows: string[]): {
  cover: Uint8Array;
  width: number;
  height: number;
} {
  const width = rows[0].length;
  const cover = new Uint8Array(width * rows.length);
  rows.forEach((row, j) => {
    for (let i = 0; i < width; i += 1) {
      cover[j * width + i] =
        row[i] === '#'
          ? SEA_COVER_BARRIER
          : row[i] === 'b'
            ? SEA_COVER_BELOW
            : SEA_COVER_NONE;
    }
  });
  return { cover, width, height: rows.length };
}

/** 마스크를 행 문자열로 — 'w' 바다가 닿음, '-' 마름. */
function resolveRows(rows: string[]): string[] {
  const { cover, width, height } = coverOf(rows);
  const mask = drain(resolveSeaReach(cover, width, height)).value;
  const out: string[] = [];
  for (let j = 0; j < height; j += 1) {
    let row = '';
    for (let i = 0; i < width; i += 1) {
      const value = mask[j * width + i];
      expect([SEA_REACH_DRY, SEA_REACH_WET]).toContain(value);
      row += value === SEA_REACH_WET ? 'w' : '-';
    }
    out.push(row);
  }
  return out;
}

describe('createSeaReachFrame', () => {
  const base = {
    minX: 0,
    minZ: 0,
    maxX: 10,
    maxZ: 6,
    cellSize: 2,
    maxCells: 100,
  };

  it('범위를 칸 크기로 나눠 올림한 격자를 만든다', () => {
    expect(createSeaReachFrame(base)).toEqual({
      minX: 0,
      minZ: 0,
      cellSize: 2,
      width: 5,
      height: 3,
    });
    expect(createSeaReachFrame({ ...base, maxX: 9 })?.width).toBe(5);
    expect(createSeaReachFrame({ ...base, maxX: 0.1 })?.width).toBe(1);
  });

  it('한 변이 maxCells 와 같으면 칸 크기를 유지하고, 넘으면 칸이 커진다', () => {
    const exact = createSeaReachFrame({ ...base, maxX: 20, maxCells: 10 });
    expect(exact).toMatchObject({ cellSize: 2, width: 10 });

    const over = createSeaReachFrame({ ...base, maxX: 22, maxCells: 10 });
    expect(over?.cellSize).toBeCloseTo(2.2);
    expect(over?.width).toBe(10);
    // 다른 변도 커진 칸으로 나눈다.
    expect(over?.height).toBe(3);
  });

  it('maxCells 의 소수부는 버린다', () => {
    const frame = createSeaReachFrame({ ...base, maxX: 20, maxCells: 4.9 });
    expect(frame).toMatchObject({ cellSize: 5, width: 4 });
  });

  it.each([
    ['NaN 범위', { minX: Number.NaN }],
    ['무한 범위', { maxX: Number.POSITIVE_INFINITY }],
    ['빈 범위(min = max)', { maxX: 0 }],
    ['뒤집힌 범위', { maxZ: -1 }],
    ['비어 있는 범위(±Infinity)', { minX: Infinity, maxX: -Infinity }],
    ['칸 크기 0', { cellSize: 0 }],
    ['칸 크기 음수', { cellSize: -2 }],
    ['칸 크기 NaN', { cellSize: Number.NaN }],
    ['maxCells 0', { maxCells: 0 }],
    ['maxCells NaN', { maxCells: Number.NaN }],
  ])('%s 이면 null 이다', (_label, patch) => {
    expect(createSeaReachFrame({ ...base, ...patch })).toBeNull();
  });
});

describe('seaReachUvTransform', () => {
  it('격자 모서리를 uv (0,0)·(1,1) 로 보낸다', () => {
    const frame: SeaReachFrame = {
      minX: -10,
      minZ: 30,
      cellSize: 2,
      width: 5,
      height: 10,
    };
    const m = seaReachUvTransform(frame);
    const uv = (x: number, z: number) => [
      m[0] * x + m[1] * z + m[2],
      m[3] * x + m[4] * z + m[5],
    ];
    expect(uv(-10, 30)).toEqual([0, 0]);
    expect(uv(0, 50)).toEqual([1, 1]);
    expect(uv(-5, 40)).toEqual([0.5, 0.5]);
    expect(m.slice(6)).toEqual([0, 0, 1]);
  });
});

describe('markSeaTriangle', () => {
  it('위를 향한 면은 높이에 따라 BARRIER·BELOW 로 찍는다', () => {
    const frame = frameOf(6, 4);
    const cover = new Uint8Array(24);
    for (const t of upQuad(0, 0, 3, 4, 1))
      markSeaTriangle(cover, frame, t, SEA);
    for (const t of upQuad(3, 0, 6, 4, -5)) {
      markSeaTriangle(cover, frame, t, SEA);
    }
    // 경계 x=3 의 칸은 두 면의 가장자리가 함께 찍혀 높은 쪽(BARRIER)이 남는다.
    expect(coverRows(cover, frame)).toEqual([
      '####bb',
      '####bb',
      '####bb',
      '####bb',
    ]);
  });

  it('수면과 정확히 같은 높이는 BARRIER, 바로 아래는 BELOW 다', () => {
    const frame = frameOf(2, 2);
    const atSea = new Uint8Array(4);
    for (const t of upQuad(0, 0, 2, 2, SEA)) {
      markSeaTriangle(atSea, frame, t, SEA);
    }
    expect(coverRows(atSea, frame)).toEqual(['##', '##']);

    const below = new Uint8Array(4);
    for (const t of upQuad(0, 0, 2, 2, SEA - 1e-6)) {
      markSeaTriangle(below, frame, t, SEA);
    }
    expect(coverRows(below, frame)).toEqual(['bb', 'bb']);
  });

  it('BARRIER 는 나중에 찍힌 BELOW 로 내려가지 않는다', () => {
    const frame = frameOf(2, 2);
    const cover = new Uint8Array(4);
    for (const t of upQuad(0, 0, 2, 2, 3))
      markSeaTriangle(cover, frame, t, SEA);
    for (const t of upQuad(0, 0, 2, 2, -3)) {
      markSeaTriangle(cover, frame, t, SEA);
    }
    expect(coverRows(cover, frame)).toEqual(['##', '##']);
  });

  it('아래를 향한 단면은 건너뛴다 — 컬링된 면이 바다를 막지 않는다', () => {
    const frame = frameOf(4, 4);
    const cover = new Uint8Array(16);
    // upQuad 의 감는 방향을 뒤집으면 법선이 -y 다.
    const down = triangle([0, 1, 0], [4, 1, 4], [0, 1, 4]);
    expect(markSeaTriangle(cover, frame, down, SEA)).toBe(0);
    expect(coverRows(cover, frame)).toEqual(['....', '....', '....', '....']);
  });

  it.each([
    ['양면', { side: 'double' as const }],
    ['뒷면만 그리는 머티리얼', { side: 'back' as const }],
    ['거울상 변환(앞면 판정이 뒤집힌다)', { mirrored: true }],
  ])('아래를 향한 면이라도 %s 이면 위에서 보이므로 찍는다', (_l, overrides) => {
    const frame = frameOf(4, 4);
    const cover = new Uint8Array(16);
    const down = triangle([0, 1, 0], [4, 1, 4], [0, 1, 4], overrides);
    expect(markSeaTriangle(cover, frame, down, SEA)).toBeGreaterThan(0);
    expect(cover.some((state) => state === SEA_COVER_BARRIER)).toBe(true);
  });

  it('위를 향한 면도 뒷면만 그리거나 거울상이면 건너뛴다', () => {
    const frame = frameOf(4, 4);
    const [up] = upQuad(0, 0, 4, 4, 1);
    const cover = new Uint8Array(16);
    expect(markSeaTriangle(cover, frame, { ...up, side: 'back' }, SEA)).toBe(0);
    expect(markSeaTriangle(cover, frame, { ...up, mirrored: true }, SEA)).toBe(
      0,
    );
    expect(cover.every((state) => state === SEA_COVER_NONE)).toBe(true);
  });

  it('수직 벽은 면적이 없어도 지나는 칸을 찍는다 — 면의 방향과 무관', () => {
    const frame = frameOf(5, 3);
    // z=1.5 를 따라 x 0‥5, y -4‥2 인 벽. 두 감는 방향 모두.
    const front = triangle([0, -4, 1.5], [5, -4, 1.5], [5, 2, 1.5]);
    const back = triangle([0, -4, 1.5], [5, 2, 1.5], [5, -4, 1.5]);
    for (const wall of [front, back]) {
      const cover = new Uint8Array(15);
      expect(markSeaTriangle(cover, frame, wall, SEA)).toBeGreaterThan(0);
      // 윗변(y=2)이 지나는 칸은 BARRIER. 대각 가장자리는 수면 아래 구간이
      // BELOW 지만 밑변·윗변과 같은 칸 줄이라 가장 높은 값이 남는다.
      expect(coverRows(cover, frame)[1]).toContain('#');
      expect(coverRows(cover, frame)[0]).toBe('.....');
      expect(coverRows(cover, frame)[2]).toBe('.....');
    }
  });

  it('윗변이 수면 아래인 벽은 BARRIER 를 만들지 않는다 — 물이 넘는다', () => {
    const frame = frameOf(5, 3);
    const cover = new Uint8Array(15);
    markSeaTriangle(
      cover,
      frame,
      triangle([0, -4, 1.5], [5, -4, 1.5], [5, -1, 1.5]),
      SEA,
    );
    markSeaTriangle(
      cover,
      frame,
      triangle([0, -4, 1.5], [5, -1, 1.5], [0, -1, 1.5]),
      SEA,
    );
    expect(coverRows(cover, frame)).toEqual(['.....', 'bbbbb', '.....']);
  });

  it('대각선 벽이 지나는 칸은 8방향으로 이어진다', () => {
    const frame = frameOf(8, 8);
    const cover = new Uint8Array(64);
    markSeaTriangle(
      cover,
      frame,
      triangle([0.2, 1, 0.2], [7.8, 1, 7.8], [7.8, 5, 7.8]),
      SEA,
    );
    for (let k = 0; k < 8; k += 1) {
      expect(cover[k * 8 + k]).toBe(SEA_COVER_BARRIER);
    }
  });

  it('벽 판정 문턱 — 법선 y 가 작으면 벽, 크면 면(아래 향한 단면은 건너뜀)', () => {
    const frame = frameOf(8, 8);
    // 아래로 기운 면 — 단위 법선의 y 가 -normalY 다. 기울기만 바꾼다.
    const tilted = (normalY: number) => {
      const run = Math.sqrt(1 - normalY * normalY);
      // 가장자리 (1,0,0) 과 (0, run, normalY) 의 외적은 (0, -normalY, run).
      return triangle([1, 2, 4], [7, 2, 4], [1, 2 + 4 * run, 4 + 4 * normalY]);
    };
    const wallCover = new Uint8Array(64);
    expect(
      markSeaTriangle(wallCover, frame, tilted(0.19), SEA),
    ).toBeGreaterThan(0);

    const faceCover = new Uint8Array(64);
    expect(markSeaTriangle(faceCover, frame, tilted(0.21), SEA)).toBe(0);
    expect(faceCover.every((state) => state === SEA_COVER_NONE)).toBe(true);
  });

  it.each([
    ['NaN 좌표', triangle([Number.NaN, 0, 0], [1, 0, 1], [1, 0, 0])],
    ['무한 좌표', triangle([Infinity, 0, 0], [1, 0, 1], [1, 0, 0])],
    ['세 점이 같은 삼각형', triangle([1, 1, 1], [1, 1, 1], [1, 1, 1])],
    ['세 점이 한 직선 위', triangle([0, 1, 0], [1, 1, 1], [2, 1, 2])],
  ])('%s 은 건너뛴다', (_label, bad) => {
    const frame = frameOf(4, 4);
    const cover = new Uint8Array(16);
    expect(markSeaTriangle(cover, frame, bad, SEA)).toBe(0);
    expect(cover.every((state) => state === SEA_COVER_NONE)).toBe(true);
  });

  it('격자 밖 삼각형은 건너뛰고, 걸친 삼각형은 안쪽만 찍는다', () => {
    const frame = frameOf(4, 4);
    const outside = new Uint8Array(16);
    for (const t of upQuad(10, 10, 14, 14, 1)) {
      expect(markSeaTriangle(outside, frame, t, SEA)).toBe(0);
    }
    expect(outside.every((state) => state === SEA_COVER_NONE)).toBe(true);

    const partial = new Uint8Array(16);
    for (const t of upQuad(-100, -100, 2, 2, 1)) {
      markSeaTriangle(partial, frame, t, SEA);
    }
    // x·z 가 2 인 가장자리가 칸 (2,*)·(*,2) 에 걸쳐 찍힌다.
    expect(coverRows(partial, frame)).toEqual(['###.', '###.', '###.', '....']);
  });

  it('칸 크기가 1 이 아니어도 월드 좌표를 칸으로 옮긴다', () => {
    const frame: SeaReachFrame = {
      minX: -4,
      minZ: 10,
      cellSize: 2,
      width: 4,
      height: 2,
    };
    const cover = new Uint8Array(8);
    for (const t of upQuad(-4, 10, -0.5, 13.5, -2)) {
      markSeaTriangle(cover, frame, t, SEA);
    }
    expect(coverRows(cover, frame)).toEqual(['bb..', 'bb..']);
  });
});

describe('resolveSeaReach', () => {
  it('지면이 없으면 전부 바다다', () => {
    expect(resolveRows(['...', '...'])).toEqual(['www', 'www']);
  });

  it('전부 육지면 전부 마른 곳이다', () => {
    expect(resolveRows(['###', '###'])).toEqual(['---', '---']);
  });

  it('벽으로 막힌 수면 아래 분지는 마른 곳이고, 그 벽도 마른 곳이다', () => {
    expect(
      resolveRows([
        '.......',
        '.#####.',
        '.#bbb#.',
        '.#bbb#.',
        '.#####.',
        '.......',
      ]),
    ).toEqual([
      'wwwwwww',
      'w-----w',
      'w-----w',
      'w-----w',
      'w-----w',
      'wwwwwww',
    ]);
  });

  it('벽에 틈이 있으면 분지에 물이 든다 — 벽은 잠긴 곳이 된다', () => {
    expect(
      resolveRows([
        '.......',
        '.##b##.',
        '.#bbb#.',
        '.#bbb#.',
        '.#####.',
        '.......',
      ]),
    ).toEqual([
      'wwwwwww',
      'wwwwwww',
      'wwwwwww',
      'wwwwwww',
      'wwwwwww',
      'wwwwwww',
    ]);
  });

  it('대각선으로만 이어진 벽도 물이 새지 않는다(4방향 확산)', () => {
    expect(
      resolveRows([
        '...#...',
        '..#b#..',
        '.#bbb#.',
        '#bbbbb#',
        '.#bbb#.',
        '..#b#..',
        '...#...',
      ]),
    ).toEqual([
      'www-www',
      'ww---ww',
      'w-----w',
      '-------',
      'w-----w',
      'ww---ww',
      'www-www',
    ]);
  });

  it('격자 테두리의 수면 아래 지면은 바다로 이어진 것으로 본다', () => {
    // 테두리 칸 (0,1) 에서 물이 들어와 b 세 칸이 잠기고, 거기에 8방향으로
    // 붙은 벽도 잠긴 곳이 된다. 물에서 떨어진 오른쪽 끝 열만 마른 곳이다.
    expect(resolveRows(['#####', 'bbb##', '#####'])).toEqual([
      'wwww-',
      'wwww-',
      'wwww-',
    ]);
  });

  it('테두리에 닿지 않은 수면 아래 지면은 벽 안에서 마른 곳으로 남는다', () => {
    expect(resolveRows(['#####', '#bbb#', '#####'])).toEqual([
      '-----',
      '-----',
      '-----',
    ]);
  });

  it('물에만 붙은 벽(안벽)은 잠긴 곳, 육지 안쪽은 마른 곳이다', () => {
    expect(resolveRows(['..###', '..###', '..###'])).toEqual([
      'www--',
      'www--',
      'www--',
    ]);
  });

  it('바다와 마른 분지 사이의 한 칸 벽(도크 게이트)은 마른 곳이다', () => {
    expect(resolveRows(['#####', '#bbb#', '#bbb#', '#####', '.....'])).toEqual([
      '-----',
      '-----',
      '-----',
      '-----',
      'wwwww',
    ]);
  });

  it('육지에 둘러싸인 지면 없는 칸도 바다로 본다 — 다리 밑 수로와 같은 규칙', () => {
    expect(resolveRows(['#####', '##.##', '#####'])).toEqual([
      '-www-',
      '-www-',
      '-www-',
    ]);
  });

  it('1×1 격자', () => {
    expect(resolveRows(['.'])).toEqual(['w']);
    expect(resolveRows(['b'])).toEqual(['w']);
    expect(resolveRows(['#'])).toEqual(['-']);
  });

  it('큰 격자는 여러 번 나눠 돌고 결과는 한 번에 돌린 것과 같다', () => {
    const width = 600;
    const height = 500;
    const cover = new Uint8Array(width * height);
    // 가운데에 벽으로 둘러싼 분지.
    for (let j = 100; j <= 400; j += 1) {
      for (let i = 100; i <= 500; i += 1) {
        const edge = j === 100 || j === 400 || i === 100 || i === 500;
        cover[j * width + i] = edge ? SEA_COVER_BARRIER : SEA_COVER_BELOW;
      }
    }
    const { value: mask, steps } = drain(resolveSeaReach(cover, width, height));
    expect(steps).toBeGreaterThan(3);
    expect(mask).toHaveLength(width * height);
    expect(mask[250 * width + 300]).toBe(SEA_REACH_DRY);
    expect(mask[100 * width + 300]).toBe(SEA_REACH_DRY);
    expect(mask[50 * width + 300]).toBe(SEA_REACH_WET);
    expect(mask[0]).toBe(SEA_REACH_WET);
  });

  it('입력 덮개 격자를 바꾸지 않는다', () => {
    const { cover, width, height } = coverOf(['.#b', 'b#.', '###']);
    const before = Uint8Array.from(cover);
    drain(resolveSeaReach(cover, width, height));
    expect(cover).toEqual(before);
  });
});
