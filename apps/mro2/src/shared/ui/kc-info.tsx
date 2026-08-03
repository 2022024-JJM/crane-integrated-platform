import { Info } from 'lucide-react';
import { KC } from './kc';

/** ⓘ 컨텍스트 도움말 아이콘 */
export function KcInfo({ className }: { className?: string }) {
  return <Info size={14} className={className} style={{ color: KC.ink }} aria-label="More information" />;
}
