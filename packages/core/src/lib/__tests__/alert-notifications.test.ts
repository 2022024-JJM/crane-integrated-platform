import { describe, expect, it } from 'vitest';
import {
  ALERT_NOTIFY_DEFAULTS,
  getBrowserNotificationPermission,
  readAlertNotificationSettings,
  useAlertNotificationSettings,
} from '../alert-notifications';

describe('alert-notifications (node — window 없음)', () => {
  it('저장소가 없으면 기본값(소리 ON·브라우저 OFF)', () => {
    expect(readAlertNotificationSettings()).toEqual(ALERT_NOTIFY_DEFAULTS);
  });

  it('브라우저 알림은 unsupported', () => {
    expect(getBrowserNotificationPermission()).toBe('unsupported');
  });

  it('설정 변경은 상태에 반영되고 같은 값은 참조 유지', () => {
    const store = useAlertNotificationSettings;
    store.getState().setSound(false);
    expect(store.getState().sound).toBe(false);
    const before = store.getState();
    store.getState().setSound(false);
    expect(store.getState()).toBe(before);
    store.getState().setBrowser(true);
    expect(store.getState().browser).toBe(true);
    store.getState().setSound(true);
    store.getState().setBrowser(false);
  });
});
