import type { Material } from 'three';

/**
 * 드라이독 판정 — 지도의 수면 아래 지형 중 **물이 없는 곳**을 잠김 안개
 * (sea-submersion.ts)에서 뺀다.
 *
 * 잠김 안개는 월드 y 만 보므로 수면보다 낮은 지형은 전부 물 색으로 흐려진다.
 * 해안 경사·안벽은 그게 맞지만 드라이독은 수면보다 낮아도 물이 없는 작업
 * 공간이라 안개가 끼면 도크 바닥이 물에 잠긴 것처럼 보인다.
 *
 * 판정은 머티리얼 이름이다 — 지도 GLB 는 도크의 벽·바닥·바닥선을 `Dock` 으로
 * 시작하는 머티리얼(Dock_01, Dock_Floor, Dock_Wall, Dock_Line …)로 따로 갖고
 * 있고, GLTFLoader 가 프리미티브마다 메시를 만들어 메시 단위로 갈린다. 지도를
 * 반입할 때 이 이름 규칙을 지켜야 한다(docs/agents/assets-glb.md).
 *
 * 모델에는 적용하지 않는다 — 플로팅 도크처럼 이름이 Dock 으로 시작하는 모델
 * 머티리얼은 실제로 물에 잠긴다. 호출부(지도)가 `seaDryBasins` 로 켠다.
 */

/**
 * `Dock` 뒤에 글자가 이어지지 않는 이름. `Dock_Floor`·`Dock`·`Dock 01` 은
 * 드라이독, `Docking`·`DockFloor` 는 아니다. Lambert 변환본의 `#lambert`
 * 접미사(lambert-material.ts)는 앞머리만 보므로 영향이 없다.
 */
export const SEA_DRY_BASIN_MATERIAL_PATTERN = /^Dock(?![a-z])/i;

function isDryBasinName(material: Material): boolean {
  return (
    typeof material.name === 'string' &&
    SEA_DRY_BASIN_MATERIAL_PATTERN.test(material.name)
  );
}

/**
 * 메시의 머티리얼이 드라이독인지. 배열이면 **전부** 드라이독일 때만 true —
 * 잠김 상태 전이(mesh-material-binding.ts)가 메시 단위라 하나라도 잠기는
 * 머티리얼이 섞여 있으면 메시를 잠김 쪽으로 둔다. 빈 배열은 false.
 */
export function isSeaDryBasinMaterial(material: Material | Material[]): boolean {
  if (Array.isArray(material)) {
    return material.length > 0 && material.every(isDryBasinName);
  }
  return isDryBasinName(material);
}

/**
 * 메시 하나에 잠김 안개를 걸지. `seaSubmersion` 이 꺼져 있으면 항상 false,
 * `seaDryBasins` 가 켜져 있으면 드라이독 머티리얼의 메시만 뺀다.
 */
export function resolveMeshSeaSubmersion(
  material: Material | Material[],
  seaSubmersion: boolean,
  seaDryBasins: boolean,
): boolean {
  if (!seaSubmersion) return false;
  return !(seaDryBasins && isSeaDryBasinMaterial(material));
}
