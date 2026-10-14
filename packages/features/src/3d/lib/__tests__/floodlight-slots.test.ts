import { describe, expect, it } from 'vitest';
import type { SavedFloodlightInfo } from '@crane/domain/3d';
import {
  FLOODLIGHT_FOCUS_STEP,
  assignFloodlightSlots,
  isSlotAssignmentEqual,
  quantizeFloodlightFocus,
  resolveFloodlightSlotCount,
} from '../floodlight-slots';
import { FLOODLIGHT_SLOT_COUNT } from '../floodlight-spot';

function light(x: number, z: number, id = `${x},${z}`): SavedFloodlightInfo {
  return { id, name: '', position: [x, 30, z], aim: [0, -30, 0] };
}

describe('assignFloodlightSlots', () => {
  const lights = [light(0, 0), light(100, 0), light(200, 0), light(300, 0)];

  it('초점에 조준점이 가까운 순으로 슬롯 수만큼 고른다', () => {
    expect(assignFloodlightSlots(lights, { x: 210, z: 0 }, 2)).toEqual([2, 3]);
    expect(assignFloodlightSlots(lights, { x: -50, z: 0 }, 3)).toEqual([
      0, 1, 2,
    ]);
  });

  it('조명이 슬롯보다 적거나 같으면 전부, 원래 순서', () => {
    expect(assignFloodlightSlots(lights, { x: 999, z: 0 }, 4)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(assignFloodlightSlots(lights, { x: 999, z: 0 }, 10)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('슬롯 0·빈 목록은 빈 배정', () => {
    expect(assignFloodlightSlots(lights, { x: 0, z: 0 }, 0)).toEqual([]);
    expect(assignFloodlightSlots([], { x: 0, z: 0 }, 8)).toEqual([]);
    expect(assignFloodlightSlots(lights, { x: 0, z: 0 }, -1)).toEqual([]);
  });

  it('거리가 같으면 목록 순서 — 같은 입력에 같은 답', () => {
    const tie = [light(-10, 0, 'a'), light(10, 0, 'b'), light(0, 10, 'c')];
    expect(assignFloodlightSlots(tie, { x: 0, z: 0 }, 2)).toEqual([0, 1]);
    expect(assignFloodlightSlots(tie, { x: 0, z: 0 }, 2)).toEqual([0, 1]);
  });

  it('조준점(기구 + 오프셋) 기준이다 — 기구 위치가 아니다', () => {
    const tilted: SavedFloodlightInfo = {
      id: 't',
      name: '',
      position: [0, 30, 0],
      aim: [300, -30, 0],
    };
    expect(
      assignFloodlightSlots([light(100, 0), tilted], { x: 290, z: 0 }, 1),
    ).toEqual([1]);
  });

  it('비유한 초점은 원점으로 본다', () => {
    expect(
      assignFloodlightSlots(lights, { x: Number.NaN, z: Number.NaN }, 1),
    ).toEqual([0]);
  });
});

describe('quantizeFloodlightFocus', () => {
  it('격자 단위로 반올림한다', () => {
    expect(quantizeFloodlightFocus(0)).toBe(0);
    expect(quantizeFloodlightFocus(FLOODLIGHT_FOCUS_STEP * 1.4)).toBe(
      FLOODLIGHT_FOCUS_STEP,
    );
    expect(quantizeFloodlightFocus(FLOODLIGHT_FOCUS_STEP * 1.6)).toBe(
      FLOODLIGHT_FOCUS_STEP * 2,
    );
    expect(quantizeFloodlightFocus(-37, 10)).toBe(-40);
  });

  it('비유한은 0, 단위가 0 이하면 그대로', () => {
    expect(quantizeFloodlightFocus(Number.NaN)).toBe(0);
    expect(quantizeFloodlightFocus(12.3, 0)).toBe(12.3);
    expect(quantizeFloodlightFocus(12.3, -5)).toBe(12.3);
  });
});

describe('isSlotAssignmentEqual', () => {
  it('길이·원소가 같을 때만 true', () => {
    expect(isSlotAssignmentEqual([], [])).toBe(true);
    expect(isSlotAssignmentEqual([1, 2], [1, 2])).toBe(true);
    expect(isSlotAssignmentEqual([1, 2], [2, 1])).toBe(false);
    expect(isSlotAssignmentEqual([1], [1, 2])).toBe(false);
  });
});

describe('resolveFloodlightSlotCount', () => {
  it('기본(예약 없음)은 조명 수와 상한 중 작은 쪽 — 상한 정확값은 통과, +1 은 상한', () => {
    expect(resolveFloodlightSlotCount(0, false)).toBe(0);
    expect(resolveFloodlightSlotCount(3, false)).toBe(3);
    expect(resolveFloodlightSlotCount(FLOODLIGHT_SLOT_COUNT, false)).toBe(
      FLOODLIGHT_SLOT_COUNT,
    );
    expect(resolveFloodlightSlotCount(FLOODLIGHT_SLOT_COUNT + 1, false)).toBe(
      FLOODLIGHT_SLOT_COUNT,
    );
  });

  it('예약이면 조명 수와 무관하게 상한 — 0개도, 상한 초과도 같다(배치 중 수가 변하지 않는다)', () => {
    expect(resolveFloodlightSlotCount(0, true)).toBe(FLOODLIGHT_SLOT_COUNT);
    expect(resolveFloodlightSlotCount(3, true)).toBe(FLOODLIGHT_SLOT_COUNT);
    expect(resolveFloodlightSlotCount(FLOODLIGHT_SLOT_COUNT + 5, true)).toBe(
      FLOODLIGHT_SLOT_COUNT,
    );
  });

  it('상한을 직접 주면 정수로 내린 그 값, 비유한·음수 입력은 0', () => {
    expect(resolveFloodlightSlotCount(10, true, 4)).toBe(4);
    expect(resolveFloodlightSlotCount(10, false, 4.9)).toBe(4);
    expect(resolveFloodlightSlotCount(2.7, false)).toBe(2);
    expect(resolveFloodlightSlotCount(-1, false)).toBe(0);
    expect(resolveFloodlightSlotCount(Number.NaN, false)).toBe(0);
    expect(resolveFloodlightSlotCount(3, true, Number.POSITIVE_INFINITY)).toBe(
      0,
    );
    expect(resolveFloodlightSlotCount(3, false, -2)).toBe(0);
  });
});
