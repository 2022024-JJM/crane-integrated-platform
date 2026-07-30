import gcBody from '../assets/gc-body.png';
import gcTrolley from '../assets/gc-trolley.png';
import llcLeg from '../assets/llc-leg.png';
import llcJib from '../assets/llc-trolley.png';

/** 슬라이스 내 크레인 탑뷰 스프라이트 — Vite 모듈 import 로 base 경로 자동 처리 */
export const PHILLY_SPRITES = {
  /** GC 거더(본체) 탑뷰 — 원본 899×298 */
  gcBody,
  /** GC 트롤리 탑뷰 — 거더와 같은 세로폭 기준 */
  gcTrolley,
  /** LLC 포탈(레그) 탑뷰 — 원본 111×196 */
  llcLeg,
  /** LLC 상부 선회체(지브) 탑뷰 — 원본 412×77, 지브가 -x 방향 */
  llcJib,
} as const;
