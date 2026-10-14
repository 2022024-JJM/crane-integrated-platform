import { describe, expect, it } from 'vitest';
import {
  CONTROL_ROOM_FOG_FAR,
  CONTROL_ROOM_FOG_NEAR,
  controlRoomFogRange,
} from '../control-room-fog';

describe('controlRoomFogRange', () => {
  it('높이만큼 near/far 를 민다, 음수·NaN 은 0', () => {
    expect(controlRoomFogRange(0)).toEqual({
      near: CONTROL_ROOM_FOG_NEAR,
      far: CONTROL_ROOM_FOG_FAR,
    });
    expect(controlRoomFogRange(5000)).toEqual({
      near: CONTROL_ROOM_FOG_NEAR + 5000,
      far: CONTROL_ROOM_FOG_FAR + 5000,
    });
    expect(controlRoomFogRange(-10)).toEqual(controlRoomFogRange(0));
    expect(controlRoomFogRange(NaN)).toEqual(controlRoomFogRange(0));
  });
});
