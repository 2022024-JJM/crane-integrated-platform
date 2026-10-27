import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Siren } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useMaintenanceList } from '@crane/features/maintenance';
import { useCreateRepairTicket } from '@crane/features/ticket';
import { KC } from '../../../shared/ui/kc';
import { emptyDraft, type FieldDraft } from '../lib/field-draft';
import { FIELD_PATH } from '../lib/field-route';
import { useFieldWorker, useRecentAssets } from '../lib/field-storage';
import { openRepairsForAsset } from '../lib/open-reports';
import { FieldBigButton, FieldShell } from './field-shell';
import { AssetStep } from './field-step-views';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * 긴급 정지 신고 — 장비를 고르고 한 번 누르면 끝. 증상·사진·우선순위를 묻지
 * 않는다(안전 사건은 단계를 거치면 안 된다). 긴급 수리 티켓(emergency)이
 * 만들어져 접수함 맨 위에 선다. 한 줄 메모는 선택.
 */
export function FieldEmergency() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [worker] = useFieldWorker();
  const [recent, pushRecent] = useRecentAssets();
  const { assets } = useAssetList();
  const { repairs } = useMaintenanceList();
  const createRepair = useCreateRepairTicket();
  const [draft, setDraft] = useState<FieldDraft>(() => emptyDraft(null));
  const [done, setDone] = useState<string | null>(null);
  const asset = useMemo(
    () => assets.find((a) => a.id === draft.assetId) ?? null,
    [assets, draft.assetId],
  );
  const alreadyOpen = useMemo(
    () =>
      openRepairsForAsset(repairs, draft.assetId).filter(
        (r) => r.priority === 'emergency',
      ),
    [repairs, draft.assetId],
  );

  const submit = () => {
    if (!asset || !worker) return;
    const today = todayIso();
    const wo = createRepair({
      craneId: asset.id,
      craneName: asset.name,
      siteId: asset.siteId,
      siteName: asset.siteName,
      componentName: 'General',
      failureType: 'other',
      sourceType: 'breakdown',
      priority: 'emergency',
      repairLevel: 'minor',
      failureDescription: [
        t('mro2:field.emergency.description'),
        draft.note.trim(),
      ]
        .filter(Boolean)
        .join(' — '),
      performerType: 'internal',
      assignedTo: worker,
      scheduledStart: today,
      scheduledEnd: today,
      fieldReport: { reportedBy: worker, reportedAt: new Date().toISOString() },
    });
    pushRecent(asset.id);
    setDone(wo.woNumber);
  };

  if (done) {
    return (
      <FieldShell title={t('mro2:field.emergency.title')}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 size={56} style={{ color: KC.safety }} />
          <div className="text-[20px] font-bold" style={{ color: KC.ink }}>
            {t('mro2:field.emergency.sent')}
          </div>
          <div className="font-mono text-[18px]" style={{ color: KC.text }}>
            {done}
          </div>
          <p className="text-[14px]" style={{ color: KC.muted }}>
            {t('mro2:field.emergency.sentHint')}
          </p>
          <div className="mt-4 w-full">
            <FieldBigButton
              variant="outline"
              onClick={() => navigate(FIELD_PATH)}
            >
              {t('mro2:field.done.home')}
            </FieldBigButton>
          </div>
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell
      title={t('mro2:field.emergency.title')}
      onBack={() => navigate(FIELD_PATH)}
      backLabel={t('mro2:field.back')}
      footer={
        <button
          type="button"
          disabled={!asset || !worker}
          onClick={submit}
          className="flex h-16 w-full items-center justify-center gap-2 rounded text-[18px] font-bold disabled:opacity-40"
          style={{
            background: KC.safety,
            color: KC.onSafety,
            borderRadius: KC.radius,
          }}
        >
          <Siren size={22} /> {t('mro2:field.emergency.submit')}
        </button>
      }
    >
      <p className="mb-3 text-[14px]" style={{ color: KC.text }}>
        {t('mro2:field.emergency.hint')}
      </p>
      {!worker ? (
        <p className="mb-3 text-[14px]" style={{ color: KC.safety }}>
          {t('mro2:field.workerFirst')}
        </p>
      ) : null}
      <AssetStep
        assets={assets}
        recent={recent}
        draft={draft}
        patch={(p) => setDraft((d) => ({ ...d, ...p }))}
      />
      {alreadyOpen.length > 0 ? (
        <p
          className="mt-3 text-[14px] font-semibold"
          style={{ color: KC.safety }}
        >
          {t('mro2:field.emergency.alreadyOpen', {
            number: alreadyOpen[0]!.woNumber,
          })}
        </p>
      ) : null}
      <input
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        placeholder={t('mro2:field.emergency.notePlaceholder')}
        className="mt-3 h-12 w-full rounded px-3 text-[16px]"
        style={{
          background: KC.bg,
          border: `1px solid ${KC.borderStrong}`,
          color: KC.ink,
          borderRadius: KC.radius,
        }}
      />
    </FieldShell>
  );
}
