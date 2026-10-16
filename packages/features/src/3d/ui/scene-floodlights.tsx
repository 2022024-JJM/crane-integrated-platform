import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Object3D, SpotLight, Vector3 } from 'three';
import { floodlightAimPoint, type SavedFloodlightInfo } from '@crane/domain/3d';
import {
  FLOODLIGHT_COLOR,
  resolveFloodlightSpot,
} from '../lib/floodlight-spot';
import {
  assignFloodlightSlots,
  isSlotAssignmentEqual,
  quantizeFloodlightFocus,
  resolveFloodlightSlotCount,
  PLAN_VIEW_FLOODLIGHT_SCALE,
} from '../lib/floodlight-slots';
import { resolveShadowFocus } from '../lib/scene-shadow';
import { sceneLightingInfo } from '../model/scene-lighting-info';

const NO_FLOODLIGHTS: readonly SavedFloodlightInfo[] = [];

interface FloodlightSlot {
  light: SpotLight;
  target: Object3D;
}

interface SlotFrameState {
  lights: readonly SavedFloodlightInfo[] | null;
  focusX: number;
  focusZ: number;
  assignment: number[];
  /** 슬롯별 칸델라(점등 비율을 곱하기 전). 빈 슬롯은 0. */
  candela: number[];
}

/**
 * 씬에 놓인 투광등의 **빛** — 그림자 없는 SpotLight 슬롯 N 개(세 캔버스 공용).
 *
 * 기구·글로우는 조명마다 SceneFloodlightFixture 가 그리고, 여기는 바닥을
 * 실제로 비추는 SpotLight 만 든다. 슬롯이 고정 개수인 이유는 three 가 보이는
 * 조명 수를 셰이더 프로그램 키로 쓰기 때문이다 — 수가 바뀌는 프레임마다 씬의
 * 전 머티리얼이 재컴파일되어(지도급 씬에서 수 초) 화면이 멈춘다. 그래서
 * **점등 중에는 슬롯 수가 변하면 안 된다**(lib/floodlight-slots
 * resolveFloodlightSlotCount):
 * - 관제·3D 플레이: 조명 수와 상한 중 작은 쪽. 로드 뒤 조명 수가 변하지
 *   않으니 수가 바뀔 일이 없고 빈 슬롯의 픽셀 비용도 내지 않는다.
 * - 에디터(`reserveSlots`): 조명 수와 무관하게 상한을 처음부터 예약한다.
 *   조명을 놓고 지워도 수가 같다.
 * 보임은 슬롯별 세기가 아니라 점등 여부 하나로 정한다 — 빈 슬롯도 밤에는
 * 세기 0 으로 보여야 배정·편집이 조명 수를 흔들지 않는다. 슬롯은 카메라
 * 초점(시선과 지면의 교점)에 조준점이 가까운 조명에 배정하고, 초점은 격자로
 * 양자화해 경계의 깜빡임을 막는다.
 *
 * 점등은 SceneLighting 이 발행한 `sceneLightingInfo.floodlightOn`(작업등
 * 점등 비율)을 따른다 — 같은 프레임에서 먼저 돈 SceneLighting 뒤에 마운트
 * 되어야 한다(같은 priority 의 useFrame 은 마운트 순). 낮(0)에는 슬롯 전부
 * visible=false 라 셰이더 조명 수에 들어가지 않고, 점등·소등 때 보조 투광등과
 * 같은 프레임에(floodlightOn 이 같은 문턱으로 0 이 된다) 한 번 재컴파일된다.
 *
 * useFrame 안에서는 invalidate 를 부르지 않는다 — 이 프레임의 렌더 전에
 * 값을 쓰므로 그 프레임에 바로 반영되고, 조명 목록이 바뀐 경우만 effect 가
 * 한 프레임을 요청한다. 캔버스가 `frameloop='demand'` 라 이 규칙이 맞다.
 */
export function SceneFloodlights({
  floodlights,
  reserveSlots = false,
}: {
  floodlights?: readonly SavedFloodlightInfo[] | null;
  /**
   * 조명 수와 무관하게 슬롯을 상한만큼 미리 만든다(빈 슬롯은 밤에 세기 0 으로
   * 보임). 조명을 놓고 지우는 에디터 캔버스가 켠다 — 켜지 않으면 조명을 하나
   * 놓을 때마다 보이는 SpotLight 수가 바뀌어 전 머티리얼이 재컴파일된다.
   */
  reserveSlots?: boolean;
}) {
  const lights = floodlights ?? NO_FLOODLIGHTS;
  const slotCount = resolveFloodlightSlotCount(lights.length, reserveSlots);
  const invalidate = useThree((s) => s.invalidate);

  // 슬롯은 개수가 바뀔 때만 다시 만든다 — SpotLight 는 three 가 셰이더에 넣는
  // 객체라 React 가 리마운트하지 않게 여기서 만들고 primitive 로 올린다.
  const slots = useMemo<FloodlightSlot[]>(
    () =>
      Array.from({ length: slotCount }, () => {
        const light = new SpotLight();
        light.color.setRGB(
          FLOODLIGHT_COLOR[0],
          FLOODLIGHT_COLOR[1],
          FLOODLIGHT_COLOR[2],
        );
        light.intensity = 0;
        light.visible = false;
        light.castShadow = false;
        light.decay = 2;
        const target = new Object3D();
        light.target = target;
        return { light, target };
      }),
    [slotCount],
  );
  useEffect(() => {
    return () => {
      for (const slot of slots) slot.light.dispose();
    };
  }, [slots]);

  // useFrame 은 메모 값(slots)을 직접 고치지 않고 ref 를 거친다 — 훅이 돌려준
  // 값을 변경하면 react-hooks/immutability 에 걸린다(SceneLighting 의 스프라이트
  // ref 와 같은 사정). 배정이 바뀐 뒤의 한 프레임은 아래 effect 가 요청한다.
  const slotsRef = useRef<FloodlightSlot[]>([]);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  // 조명 목록·슬롯 수가 바뀌면 한 프레임 — useFrame 이 새 배정을 쓴다.
  useEffect(() => {
    invalidate();
  }, [lights, slots, invalidate]);

  const stateRef = useRef<SlotFrameState>({
    lights: null,
    focusX: Number.NaN,
    focusZ: Number.NaN,
    assignment: [],
    candela: [],
  });
  const scratchForward = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    const slots = slotsRef.current;
    if (slots.length === 0) return;
    const state = stateRef.current;

    // 초점 — SceneLighting 의 shadow frustum 과 같은 정의, 격자 양자화.
    camera.getWorldDirection(scratchForward);
    const focus = resolveShadowFocus(
      [camera.position.x, camera.position.y, camera.position.z],
      [scratchForward.x, scratchForward.y, scratchForward.z],
    );
    const focusX = quantizeFloodlightFocus(focus.x);
    const focusZ = quantizeFloodlightFocus(focus.z);

    if (
      state.lights !== lights ||
      state.focusX !== focusX ||
      state.focusZ !== focusZ
    ) {
      const assignment = assignFloodlightSlots(
        lights,
        { x: focusX, z: focusZ },
        slots.length,
      );
      // 목록 참조가 바뀌면(편집) 같은 배정이라도 값이 달라졌을 수 있어 다시 쓴다.
      const rewrite =
        state.lights !== lights ||
        !isSlotAssignmentEqual(assignment, state.assignment);
      state.lights = lights;
      state.focusX = focusX;
      state.focusZ = focusZ;
      if (rewrite) {
        state.assignment = assignment;
        for (let i = 0; i < slots.length; i += 1) {
          const source = lights[assignment[i]];
          const { light, target } = slots[i];
          if (!source) {
            // 빈 슬롯(예약분·조명이 슬롯보다 적을 때) — 세기 0, 보임은 아래서.
            state.candela[i] = 0;
            continue;
          }
          const spot = resolveFloodlightSpot(source);
          const aim = floodlightAimPoint(source);
          light.position.set(
            source.position[0],
            source.position[1],
            source.position[2],
          );
          target.position.set(aim[0], aim[1], aim[2]);
          target.updateMatrixWorld();
          light.angle = spot.angle;
          light.penumbra = spot.penumbra;
          light.distance = spot.distance;
          state.candela[i] = spot.candela;
        }
      }
    }

    // 점등 비율 — SceneLighting 이 이 프레임에 발행한 값. 보임은 슬롯 전부가
    // 점등 여부 하나를 따른다(빈 슬롯도 밤에는 세기 0 으로 보임) — 조명 수가
    // 배정·편집에 따라 흔들리면 그 프레임마다 전 머티리얼이 재컴파일된다.
    const on = sceneLightingInfo.floodlightOn;
    const visible = on > 0;
    // 평면도에서는 바닥 빛 웅덩이를 거의 끈다(세기만, visible 은 그대로).
    const planScale =
      (camera as { isOrthographicCamera?: boolean }).isOrthographicCamera ===
      true
        ? PLAN_VIEW_FLOODLIGHT_SCALE
        : 1;
    for (let i = 0; i < slots.length; i += 1) {
      const { light } = slots[i];
      const intensity = (state.candela[i] ?? 0) * on * planScale;
      if (light.intensity !== intensity) light.intensity = intensity;
      if (light.visible !== visible) light.visible = visible;
    }
  });

  return (
    <>
      {slots.map((slot, i) => (
        // 슬롯은 자리(i)로 식별한다 — 어느 조명이 들어가든 같은 객체다.
        <group key={i}>
          <primitive object={slot.light} />
          <primitive object={slot.target} />
        </group>
      ))}
    </>
  );
}
