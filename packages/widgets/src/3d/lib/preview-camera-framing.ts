import { Box3, Group, OrthographicCamera, Vector3 } from 'three';
import type { SceneModelPreviewPreset } from '@crane/domain/3d';

export function frameCameraToModel(
  cam: OrthographicCamera,
  group: Group,
  width: number,
  height: number,
  preset?: SceneModelPreviewPreset,
): void {
  const box = new Box3().setFromObject(group);

  if (box.isEmpty()) return;

  const center = new Vector3();
  const size = new Vector3();
  box.getSize(size);
  box.getCenter(center);

  const verticalOffset = size.y * (preset?.verticalOffsetRatio ?? 0);
  group.scale.setScalar(1);
  group.position.set(-center.x, -center.y + verticalOffset, -center.z);
  group.updateMatrixWorld(true);

  const target = new Vector3(0, 0, 0);
  const viewDirection = new Vector3(
    ...((preset?.cameraDirection ?? [1.16, 0.78, 1.16]) as [
      number,
      number,
      number,
    ]),
  ).normalize();
  const radius = size.length() * 0.5;
  const cameraDistance = Math.max(radius * 2.25, 3.5);

  cam.position.copy(target).add(viewDirection.multiplyScalar(cameraDistance));
  cam.near = 0.1;
  cam.far = Math.max(cameraDistance + radius * 4, 100);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);

  const fittedBox = new Box3().setFromObject(group);
  const corners = [
    new Vector3(fittedBox.min.x, fittedBox.min.y, fittedBox.min.z),
    new Vector3(fittedBox.min.x, fittedBox.min.y, fittedBox.max.z),
    new Vector3(fittedBox.min.x, fittedBox.max.y, fittedBox.min.z),
    new Vector3(fittedBox.min.x, fittedBox.max.y, fittedBox.max.z),
    new Vector3(fittedBox.max.x, fittedBox.min.y, fittedBox.min.z),
    new Vector3(fittedBox.max.x, fittedBox.min.y, fittedBox.max.z),
    new Vector3(fittedBox.max.x, fittedBox.max.y, fittedBox.min.z),
    new Vector3(fittedBox.max.x, fittedBox.max.y, fittedBox.max.z),
  ];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const corner of corners) {
    const p = corner.clone().applyMatrix4(cam.matrixWorldInverse);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  group.position
    .sub(right.multiplyScalar(centerX))
    .sub(up.multiplyScalar(centerY));
  group.updateMatrixWorld(true);

  const projW = maxX - minX;
  const projH = maxY - minY;
  const paddingScale = preset?.paddingScale ?? 1.22;
  const paddedX = Math.max((projW / 2) * paddingScale, 0.001);
  const paddedY = Math.max((projH / 2) * paddingScale, 0.001);
  const zoomW = width / (paddedX * 2);
  const zoomH = height / (paddedY * 2);

  cam.zoom = Math.max(0.01, Math.min(zoomW, zoomH));
  cam.updateProjectionMatrix();
}
