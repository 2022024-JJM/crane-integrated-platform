/**
 * WebGL 컨텍스트 유실 뒤 복원을 기다리는 상한(ms). 브라우저는 대개 수 초 안에
 * 복원 이벤트를 주고, 안 오면(GPU 프로세스 종료·블랙리스트) 새로 고침이
 * 유일한 복구다. 관제 PC 에서 10초 검은 화면은 허용 범위다.
 */
export const CONTEXT_RESTORE_TIMEOUT_MS = 10_000;
