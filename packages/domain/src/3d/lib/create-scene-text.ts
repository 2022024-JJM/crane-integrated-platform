import type { SavedTextInfo } from '../model/types';
import { createId } from '@crane/core/lib/create-id';

interface CreateSceneTextParams {
  content?: string;
  position: [number, number, number];
}

export function createSceneText({
  content = 'Text',
  position,
}: CreateSceneTextParams): SavedTextInfo {
  return {
    id: createId(),
    content,
    color: '#ffffff',
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}
