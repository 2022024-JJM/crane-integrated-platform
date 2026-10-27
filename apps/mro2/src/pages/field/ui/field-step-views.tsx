import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Camera, Minus, Plus, X } from 'lucide-react';
import type { CraneAsset } from '@crane/domain/asset';
import type { RepairWO } from '@crane/domain/maintenance';
import type { ChecklistItem } from '@crane/domain/inspection';
import type { InventoryItem } from '@crane/domain/inventory';
import { KC } from '../../../shared/ui/kc';
import {
  FIELD_MAX_PHOTOS,
  FIELD_SYMPTOM_MAX,
  addPhotos,
  hasSymptomPreset,
  setPartLine,
  toggleSymptomPreset,
  type FieldDraft,
} from '../lib/field-draft';
import { failedItems } from '../lib/field-checklist';
import { fieldTicketPath, type FieldKind } from '../lib/field-route';
import { FieldChecklistStep } from './field-checklist-step';
import { FieldChip } from './field-shell';

/* 단계별 화면 — 한 화면 한 질문. 상태는 부모(field-new-ticket)가 들고 있다. */

type Patch = (patch: Partial<FieldDraft>) => void;

const INPUT_STYLE = {
  background: 'var(--kc-bg)',
  border: `1px solid ${KC.borderStrong}`,
  color: KC.ink,
  borderRadius: KC.radius,
} as const;

export function AssetStep({
  assets,
  recent,
  draft,
  patch,
}: {
  assets: CraneAsset[];
  recent: string[];
  draft: FieldDraft;
  patch: Patch;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    const filtered = query
      ? assets.filter(
          (a) =>
            a.name.toLowerCase().includes(query) ||
            a.model.toLowerCase().includes(query),
        )
      : assets;
    // 최근 쓴 자산을 앞으로.
    const rank = (a: CraneAsset) => {
      const i = recent.indexOf(a.id);
      return i < 0 ? recent.length : i;
    };
    return [...filtered].sort((a, b) => rank(a) - rank(b));
  }, [assets, recent, query]);
  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('mro2:field.searchAsset')}
        className="h-12 w-full px-3 text-[16px]"
        style={INPUT_STYLE}
      />
      <ul className="flex flex-col gap-2">
        {list.map((a) => {
          const active = draft.assetId === a.id;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => patch({ assetId: a.id })}
                aria-pressed={active}
                className="flex min-h-14 w-full items-center justify-between rounded px-4 text-left"
                style={{
                  background: active ? KC.inverseBg : KC.bgSubtle,
                  color: active ? KC.inverseText : KC.ink,
                  border: `1px solid ${active ? 'transparent' : KC.border}`,
                  borderRadius: KC.radius,
                }}
              >
                <span className="text-[16px] font-semibold">{a.name}</span>
                <span
                  className="text-[14px]"
                  style={{ color: active ? KC.inverseMuted : KC.muted }}
                >
                  {a.model}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const REPAIR_PRESETS = [
  'wireDamage',
  'brakeAbnormal',
  'noise',
  'motorStop',
  'limitFault',
  'leak',
] as const;
const FINDING_PRESETS = ['wear', 'crack', 'loose', 'corrosion'] as const;

export function SymptomStep({
  draft,
  patch,
  presets,
  placeholder,
  openReports = [],
}: {
  draft: FieldDraft;
  patch: Patch;
  presets: 'repair' | 'findings';
  placeholder: string;
  /** 같은 장비에 이미 열린 고장 신고 — 중복 신고 방지 안내. */
  openReports?: RepairWO[];
}) {
  const { t } = useTranslation();
  const keys = presets === 'repair' ? REPAIR_PRESETS : FINDING_PRESETS;
  return (
    <div className="flex flex-col gap-3">
      {openReports.length > 0 ? (
        <div
          className="rounded p-3"
          style={{
            background: KC.bgSubtle,
            border: `1px solid ${KC.production}`,
            borderRadius: KC.radius,
          }}
        >
          <div
            className="mb-1.5 text-[14px] font-bold"
            style={{ color: KC.ink }}
          >
            {t('mro2:field.duplicate.title', { n: openReports.length })}
          </div>
          <ul className="flex flex-col gap-1">
            {openReports.map((r) => (
              <li key={r.id}>
                <Link
                  to={fieldTicketPath('repair', r.id)}
                  className="flex min-h-10 items-center justify-between gap-2 text-[14px]"
                  style={{ color: KC.ink }}
                >
                  <span className="min-w-0 truncate">
                    <span
                      className="font-mono text-[13px]"
                      style={{ color: KC.muted }}
                    >
                      {r.woNumber}
                    </span>{' '}
                    {r.failureDescription}
                  </span>
                  <span
                    className="shrink-0 text-[14px] font-semibold"
                    style={{ color: KC.link }}
                  >
                    {t('mro2:field.duplicate.addPhoto')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[13px]" style={{ color: KC.muted }}>
            {t('mro2:field.duplicate.hint')}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => {
          const phrase = t(`mro2:field.preset.${k}`);
          return (
            <FieldChip
              key={k}
              label={phrase}
              active={hasSymptomPreset(draft.symptom, phrase)}
              onClick={() =>
                patch({ symptom: toggleSymptomPreset(draft.symptom, phrase) })
              }
            />
          );
        })}
      </div>
      <textarea
        value={draft.symptom}
        maxLength={FIELD_SYMPTOM_MAX}
        onChange={(e) => patch({ symptom: e.target.value })}
        placeholder={placeholder}
        rows={4}
        className="w-full p-3 text-[16px]"
        style={INPUT_STYLE}
      />
      {presets === 'repair' ? (
        <input
          value={draft.component}
          onChange={(e) => patch({ component: e.target.value })}
          placeholder={t('mro2:field.componentPlaceholder')}
          className="h-12 w-full px-3 text-[16px]"
          style={INPUT_STYLE}
        />
      ) : null}
    </div>
  );
}

export function InspectionStep({
  draft,
  patch,
  template,
}: {
  draft: FieldDraft;
  patch: Patch;
  template: ChecklistItem[];
}) {
  const { t } = useTranslation();
  const types = ['frequent', 'periodic', 'emergency', 'special'] as const;
  const anyFail = failedItems(template, draft.checklist).length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div
          className="mb-2 text-[14px] font-semibold"
          style={{ color: KC.muted }}
        >
          {t('mro2:field.inspType')}
        </div>
        <div className="flex flex-wrap gap-2">
          {types.map((k) => (
            <FieldChip
              key={k}
              label={t(`calendar:type.${k}`)}
              active={draft.inspectionType === k}
              onClick={() => patch({ inspectionType: k, checklist: {} })}
            />
          ))}
        </div>
      </div>
      <FieldChecklistStep
        template={template}
        judgments={draft.checklist}
        onChange={(checklist) => patch({ checklist })}
      />
      {anyFail ? (
        <div>
          <div
            className="mb-2 text-[14px] font-semibold"
            style={{ color: KC.muted }}
          >
            {t('mro2:field.confirm.findings')}
          </div>
          <SymptomStep
            draft={draft}
            patch={patch}
            presets="findings"
            placeholder={t('mro2:field.findingsPlaceholder')}
          />
        </div>
      ) : null}
    </div>
  );
}

export function PartsStep({
  inventory,
  draft,
  patch,
}: {
  inventory: InventoryItem[];
  draft: FieldDraft;
  patch: Patch;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    const chosen = new Set(draft.parts.map((p) => p.partId));
    const filtered = query
      ? inventory.filter(
          (i) =>
            i.partName.toLowerCase().includes(query) ||
            i.partNumber.toLowerCase().includes(query),
        )
      : inventory;
    // 선택한 부품을 앞으로, 그다음 이름순.
    return [...filtered].sort(
      (a, b) => Number(chosen.has(b.partId)) - Number(chosen.has(a.partId)),
    );
  }, [inventory, draft.parts, query]);
  const qtyOf = (partId: string) =>
    draft.parts.find((p) => p.partId === partId)?.qty ?? 0;
  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('mro2:field.searchPart')}
        className="h-12 w-full px-3 text-[16px]"
        style={INPUT_STYLE}
      />
      <ul className="flex flex-col gap-2">
        {list.slice(0, 30).map((item) => {
          const qty = qtyOf(item.partId);
          return (
            <li
              key={item.partId}
              className="flex min-h-14 items-center gap-2 rounded px-3"
              style={{
                background: qty > 0 ? KC.bgRow : KC.bgSubtle,
                border: `1px solid ${KC.border}`,
                borderRadius: KC.radius,
              }}
            >
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[15px] font-semibold"
                  style={{ color: KC.ink }}
                >
                  {item.partName}
                </span>
                <span
                  className="block font-mono text-[13px]"
                  style={{ color: KC.muted }}
                >
                  {item.partNumber}
                </span>
              </span>
              <button
                type="button"
                aria-label={t('mro2:field.qtyMinus')}
                className="flex h-11 w-11 items-center justify-center rounded"
                style={{ border: `1px solid ${KC.border}`, color: KC.ink }}
                onClick={() =>
                  patch({
                    parts: setPartLine(draft.parts, item.partId, qty - 1),
                  })
                }
              >
                <Minus size={18} />
              </button>
              <span
                className="w-7 text-center text-[16px] font-bold"
                style={{ color: KC.ink }}
              >
                {qty}
              </span>
              <button
                type="button"
                aria-label={t('mro2:field.qtyPlus')}
                className="flex h-11 w-11 items-center justify-center rounded"
                style={{ border: `1px solid ${KC.border}`, color: KC.ink }}
                onClick={() =>
                  patch({
                    parts: setPartLine(draft.parts, item.partId, qty + 1),
                  })
                }
              >
                <Plus size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PhotoStep({
  draft,
  patch,
}: {
  draft: FieldDraft;
  patch: Patch;
}) {
  const { t } = useTranslation();
  const previews = useMemo(
    () => draft.photos.map((f) => URL.createObjectURL(f)),
    [draft.photos],
  );
  return (
    <div className="flex flex-col gap-3">
      <label
        className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded text-[16px] font-bold"
        style={{
          border: `1px dashed ${KC.borderStrong}`,
          color: KC.ink,
          borderRadius: KC.radius,
        }}
      >
        <Camera size={20} /> {t('mro2:field.addPhoto')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            patch({ photos: addPhotos(draft.photos, files) });
            e.target.value = '';
          }}
        />
      </label>
      <div className="text-[13px]" style={{ color: KC.muted }}>
        {t('mro2:field.photoCount', {
          n: draft.photos.length,
          max: FIELD_MAX_PHOTOS,
        })}
      </div>
      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div
              key={src}
              className="relative aspect-square overflow-hidden rounded"
              style={{ background: KC.bgSubtle }}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={t('mro2:field.removePhoto')}
                className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: KC.inverseBg, color: KC.inverseText }}
                onClick={() =>
                  patch({ photos: draft.photos.filter((_, j) => j !== i) })
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PriorityStep({
  kind,
  draft,
  patch,
}: {
  kind: FieldKind;
  draft: FieldDraft;
  patch: Patch;
}) {
  const { t } = useTranslation();
  if (kind === 'parts') {
    return (
      <div className="flex flex-col gap-3">
        <FieldChip
          label={t('mro2:field.prio.urgent')}
          active={draft.partsPriority === 'urgent'}
          activeBg={KC.safety}
          activeText={KC.onSafety}
          onClick={() => patch({ partsPriority: 'urgent' })}
        />
        <FieldChip
          label={t('mro2:field.prio.normal')}
          active={draft.partsPriority === 'normal'}
          onClick={() => patch({ partsPriority: 'normal' })}
        />
        <textarea
          value={draft.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder={t('mro2:field.notePlaceholder')}
          rows={3}
          className="w-full p-3 text-[16px]"
          style={INPUT_STYLE}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <FieldChip
        label={t('mro2:field.prio.emergency')}
        active={draft.repairPriority === 'emergency'}
        activeBg={KC.safety}
        activeText={KC.onSafety}
        onClick={() => patch({ repairPriority: 'emergency' })}
      />
      <FieldChip
        label={t('mro2:field.prio.high')}
        active={draft.repairPriority === 'high'}
        activeBg={KC.production}
        activeText={KC.onProduction}
        onClick={() => patch({ repairPriority: 'high' })}
      />
      <FieldChip
        label={t('mro2:field.prio.normal')}
        active={draft.repairPriority === 'normal'}
        onClick={() => patch({ repairPriority: 'normal' })}
      />
    </div>
  );
}
