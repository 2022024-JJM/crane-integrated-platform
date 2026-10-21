import { useTranslation } from 'react-i18next';
import { resolveAge } from '@crane/features/3d';

/** 경과 시간 문구 — "0.3초 전" / "12초 전" / "1분 3초 전". */
export function AgeText({ ageMs }: { ageMs: number }) {
  const { t } = useTranslation();
  const age = resolveAge(ageMs);
  return (
    <>
      {age.unit === 'seconds'
        ? t('monitoring:tags.age.seconds', { value: age.value })
        : t('monitoring:tags.age.minutes', {
            minutes: age.minutes,
            seconds: age.seconds,
          })}
    </>
  );
}
