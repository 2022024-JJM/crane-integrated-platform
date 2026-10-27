import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Package, Wrench, Pencil, Siren } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { KC } from '../../../shared/ui/kc';
import {
  FIELD_EMERGENCY_PATH,
  FIELD_PATH,
  fieldNewPath,
} from '../lib/field-route';
import { useFieldWorker, useRecentAssets } from '../lib/field-storage';
import { FieldBigButton, FieldShell } from './field-shell';
import { MyTicketsList } from './field-my-tickets';

/** 작업자 이름 — 없으면 먼저 묻고, 있으면 한 줄로 보여 주며 바꿀 수 있다. */
function WorkerCard() {
  const { t } = useTranslation();
  const [worker, setWorker] = useFieldWorker();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(worker);
  if (worker && !editing) {
    return (
      <div
        className="flex items-center justify-between text-[14px]"
        style={{ color: KC.muted }}
      >
        <span>
          {t('mro2:field.reporter')}: <b style={{ color: KC.ink }}>{worker}</b>
        </span>
        <button
          type="button"
          className="flex h-9 items-center gap-1 px-2"
          style={{ color: KC.link }}
          onClick={() => {
            setDraft(worker);
            setEditing(true);
          }}
        >
          <Pencil size={14} /> {t('mro2:field.workerChange')}
        </button>
      </div>
    );
  }
  return (
    <form
      className="rounded p-3"
      style={{
        background: KC.bgSubtle,
        border: `1px solid ${KC.border}`,
        borderRadius: KC.radius,
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setWorker(draft);
        setEditing(false);
      }}
    >
      <label
        className="mb-1 block text-[14px] font-semibold"
        style={{ color: KC.ink }}
      >
        {t('mro2:field.workerPrompt')}
      </label>
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-12 flex-1 rounded px-3 text-[16px]"
          style={{
            background: KC.bg,
            border: `1px solid ${KC.borderStrong}`,
            color: KC.ink,
          }}
        />
        <button
          type="submit"
          className="h-12 rounded px-4 text-[15px] font-bold"
          style={{
            background: KC.tealFill,
            color: KC.onTeal,
            borderRadius: KC.radius,
          }}
        >
          {t('mro2:field.workerSave')}
        </button>
      </div>
      <p className="mt-1.5 text-[13px]" style={{ color: KC.muted }}>
        {t('mro2:field.workerHint')}
      </p>
    </form>
  );
}

export function FieldHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { assets } = useAssetList();
  const [recent] = useRecentAssets();
  const recentAssets = recent
    .map((id) => assets.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  return (
    <FieldShell title={t('mro2:field.title')}>
      <div className="flex flex-col gap-4">
        <WorkerCard />

        {/* 긴급 정지 — 안전 사건은 단계를 거치지 않는다. 맨 위 한 줄. */}
        <button
          type="button"
          onClick={() => navigate(FIELD_EMERGENCY_PATH)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded text-[16px] font-bold"
          style={{
            background: KC.safety,
            color: KC.onSafety,
            borderRadius: KC.radius,
          }}
        >
          <Siren size={20} /> {t('mro2:field.emergency.button')}
        </button>

        <div className="grid grid-cols-1 gap-3">
          <FieldBigButton onClick={() => navigate(fieldNewPath('repair'))}>
            <Wrench size={20} /> {t('mro2:field.reportRepair')}
          </FieldBigButton>
          <FieldBigButton onClick={() => navigate(fieldNewPath('parts'))}>
            <Package size={20} /> {t('mro2:field.reportParts')}
          </FieldBigButton>
          <FieldBigButton onClick={() => navigate(fieldNewPath('inspection'))}>
            <ClipboardCheck size={20} /> {t('mro2:field.reportInspection')}
          </FieldBigButton>
        </div>

        {recentAssets.length > 0 ? (
          <section>
            <h2
              className="mb-2 text-[14px] font-semibold tracking-wide uppercase"
              style={{ color: KC.muted }}
            >
              {t('mro2:field.recentAssets')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {recentAssets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(fieldNewPath('repair', a.id))}
                  className="min-h-11 rounded px-3.5 text-[15px] font-semibold"
                  style={{
                    background: KC.bgSubtle,
                    border: `1px solid ${KC.border}`,
                    color: KC.ink,
                    borderRadius: KC.radius,
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2
              className="text-[14px] font-semibold tracking-wide uppercase"
              style={{ color: KC.muted }}
            >
              {t('mro2:field.myTickets')}
            </h2>
            <Link
              to={`${FIELD_PATH}/tickets`}
              className="text-[14px]"
              style={{ color: KC.link }}
            >
              {t('mro2:field.seeAll')}
            </Link>
          </div>
          <MyTicketsList limit={3} />
        </section>
      </div>
    </FieldShell>
  );
}
