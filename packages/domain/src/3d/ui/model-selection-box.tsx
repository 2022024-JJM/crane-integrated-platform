import { useEffect, useMemo, type RefObject } from 'react';
import { Box3, Box3Helper, Object3D } from 'three';

interface ModelSelectionBoxProps {
  modelRef: RefObject<Object3D | null>;
  isSelected: boolean;
}

export function ModelSelectionBox({
  modelRef,
  isSelected,
}: ModelSelectionBoxProps) {
  const selectionBox = useMemo(() => new Box3(), []);
  const selectionHelper = useMemo(() => {
    const helper = new Box3Helper(selectionBox, '#ffff00');
    const material = Array.isArray(helper.material)
      ? helper.material[0]
      : helper.material;

    material.depthTest = false;
    helper.renderOrder = 1;

    return helper;
  }, [selectionBox]);

  useEffect(() => {
    if (!isSelected || !modelRef.current) {
      return;
    }

    selectionBox.setFromObject(modelRef.current);
  }, [isSelected, modelRef, selectionBox]);

  if (!isSelected) {
    return null;
  }

  return <primitive object={selectionHelper} />;
}
