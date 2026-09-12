import { create } from 'zustand';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem } from './safe-storage';

/**
 * 관제 경보 알림 채널 — 충돌·영역 침범·critical 알람처럼 "지금 봐야 하는"
 * 사건을 화면 안 배너 밖으로도 내보낸다: toast(sonner, 앱 전역 Toaster),
 * 소리(WebAudio 두 음 비프 — 에셋 없음·폐쇄망 무관), 브라우저 알림(탭이
 * 뒤에 있을 때만 — 보고 있는 화면에 OS 알림까지 겹치면 소음이다).
 *
 * 설정은 사용자 단위 localStorage(`crane:alert-notify`)이고 페이지 설정
 * 팝업(features/page-settings)에서 바꾼다. 소리는 브라우저 자동재생 정책상
 * 사용자 입력이 한 번 있어야 AudioContext 가 열린다 — 첫 경보가 무음이면
 * 그 이유다(이후 경보부터 들린다).
 *
 * 발신자는 features 의 구독 컴포넌트(3d SceneAlertNotifier, alarm 의 critical
 * 배너 훅)이고, 이 파일은 i18n 을 모른다 — 제목·본문은 호출자가 번역해 넘긴다.
 */

export type AlertNotificationSeverity = 'warning' | 'critical';

export interface AlertNotification {
  /** 같은 사건의 중복 알림을 막는 키(sonner id). */
  id: string;
  severity: AlertNotificationSeverity;
  title: string;
  description?: string;
  /** toast 를 띄울지. 기본 true — 화면 안 배너가 이미 크게 뜨는 경우 false. */
  toast?: boolean;
}

export interface AlertNotificationSettings {
  sound: boolean;
  browser: boolean;
}

export const ALERT_NOTIFY_STORAGE_KEY = 'crane:alert-notify';
export const ALERT_NOTIFY_DEFAULTS: AlertNotificationSettings = {
  sound: true,
  browser: false,
};

export function readAlertNotificationSettings(): AlertNotificationSettings {
  const raw = getStorageItem(ALERT_NOTIFY_STORAGE_KEY);
  if (raw === null) return ALERT_NOTIFY_DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return ALERT_NOTIFY_DEFAULTS;
    }
    const p = parsed as Partial<AlertNotificationSettings>;
    return {
      sound:
        typeof p.sound === 'boolean' ? p.sound : ALERT_NOTIFY_DEFAULTS.sound,
      browser:
        typeof p.browser === 'boolean'
          ? p.browser
          : ALERT_NOTIFY_DEFAULTS.browser,
    };
  } catch {
    return ALERT_NOTIFY_DEFAULTS;
  }
}

interface AlertNotificationState extends AlertNotificationSettings {
  setSound: (sound: boolean) => void;
  setBrowser: (browser: boolean) => void;
}

export const useAlertNotificationSettings = create<AlertNotificationState>()(
  (set, get) => ({
    ...readAlertNotificationSettings(),
    setSound: (sound) => {
      if (get().sound === sound) return;
      set({ sound });
      setStorageItem(
        ALERT_NOTIFY_STORAGE_KEY,
        JSON.stringify({ sound, browser: get().browser }),
      );
    },
    setBrowser: (browser) => {
      if (get().browser === browser) return;
      set({ browser });
      setStorageItem(
        ALERT_NOTIFY_STORAGE_KEY,
        JSON.stringify({ sound: get().sound, browser }),
      );
    },
  }),
);

/** 브라우저 알림 권한 — 지원 안 하면 'unsupported'. */
export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

/** 권한 요청(사용자 제스처 안에서 부른다). 지원 안 하면 'unsupported'. */
export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioContext.state === 'suspended') {
    // 사용자 제스처 없이 만들어졌으면 재개가 거부될 수 있다 — 조용히 무시.
    void audioContext.resume().catch(() => undefined);
  }
  return audioContext;
}

/**
 * 경보음 — 경고는 짧은 두 음(880·660Hz), 위험은 세 음을 빠르게. 사각파를 게인
 * 엔벌로프로 감싸 클릭 노이즈 없이 짧게 끊는다. 총 길이 0.4s 이하.
 */
export function playAlertSound(severity: AlertNotificationSeverity): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;
  const tones =
    severity === 'critical'
      ? [
          [1046, 0, 0.09],
          [784, 0.12, 0.09],
          [1046, 0.24, 0.14],
        ]
      : [
          [880, 0, 0.1],
          [660, 0.14, 0.14],
        ];
  const now = ctx.currentTime;
  for (const [freq, offset, duration] of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + duration + 0.02);
  }
}

function showBrowserNotification(notification: AlertNotification): void {
  if (getBrowserNotificationPermission() !== 'granted') return;
  if (typeof document !== 'undefined' && !document.hidden) return;
  try {
    const n = new Notification(notification.title, {
      body: notification.description,
      tag: notification.id,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // 일부 브라우저는 페이지 컨텍스트의 Notification 생성자를 막는다 — 무시.
  }
}

/**
 * 경보 한 건을 설정에 따라 내보낸다. 어느 채널도 throw 하지 않는다.
 * `severity`: critical 은 sonner error(빨강)·세 음, warning 은 sonner
 * warning(주황)·두 음.
 */
export function notifyAlert(notification: AlertNotification): void {
  if (notification.toast !== false) {
    // 앱 Toaster 는 top-center 인데 3D 화면의 관제 HUD·경보 배너가 그 자리를
    // 쓴다 — 경보 toast 는 우하단으로 보내 겹치지 않게 한다.
    const options = {
      id: notification.id,
      description: notification.description,
      duration: notification.severity === 'critical' ? 8000 : 5000,
      position: 'bottom-right' as const,
    };
    if (notification.severity === 'critical') {
      toast.error(notification.title, options);
    } else {
      toast.warning(notification.title, options);
    }
  }
  const settings = useAlertNotificationSettings.getState();
  if (settings.sound) playAlertSound(notification.severity);
  if (settings.browser) showBrowserNotification(notification);
}
