import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { useAssetForm, useCreateAsset } from '@crane/features/asset';
import { getAllCraneAssets } from '@crane/domain/asset';
import type { AssetStatus, CraneType } from '@crane/domain/asset';
import { KC, KC_FONT_DISPLAY } from '../../../shared/ui/kc';
import { KcButton, KcModal } from '../../../shared/ui/kc-ui';

const CRANE_TYPES: CraneType[] = ['goliath', 'overhead', 'gantry', 'jib', 'ttc', 'llc', 'luffing'];
const STATUSES: AssetStatus[] = ['operating', 'inspection', 'repair', 'idle', 'decommissioned'];

const inputBase =
  'w-full rounded-[4px] border px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-2';
const inputStyle = { borderColor: KC.border, color: KC.ink, background: KC.bg };

function Field({ label, required, error, colSpan2, children }: {
  label: string;
  required?: boolean;
  error?: string;
  colSpan2?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${colSpan2 ? 'sm:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold" style={{ color: KC.ink }}>
        {label}
        {required ? <span style={{ color: KC.safety }}> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-[10.5px]" style={{ color: KC.safety }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function NewAssetModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['mro2', 'asset-management']);
  const createAsset = useCreateAsset();

  // 필드 라벨·검증 문구는 MRO(asset-management) 네임스페이스를 재사용한다
  // — 티켓 모달이 calendar 네임스페이스를 쓰는 것과 같은 관례.
  const { form, errors, dirty, set, validate } = useAssetForm({
    messages: {
      nameRequired: t('asset-management:modal.validation.nameRequired'),
      manufacturerRequired: t('asset-management:modal.validation.manufacturerRequired'),
      modelRequired: t('asset-management:modal.validation.modelRequired'),
      serialRequired: t('asset-management:modal.validation.serialRequired'),
      capacityRequired: t('asset-management:modal.validation.capacityRequired'),
      locationRequired: t('asset-management:modal.validation.locationRequired'),
    },
  });

  // 사이트 옵션은 현재 플릿에서 파생 — MRO2에는 별도 사이트 카탈로그가 없다
  const siteOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of getAllCraneAssets()) map.set(a.siteId, a.siteName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, []);

  // 미저장 내용이 있으면 닫기 전 확인 (ESC·백드롭·취소 공통)
  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(t('asset-management:modal.unsavedConfirm'))) return;
    onClose();
  }, [dirty, onClose, t]);

  // 탭 닫기/새로고침 가드
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const submit = () => {
    if (!validate()) return;
    const asset = createAsset(form);
    toast.success(t('asset-management:modal.toastCreated', { name: asset.name }));
    onClose();
  };

  const fieldT = (key: string) => t(`asset-management:modal.fields.${key}`);

  return (
    <KcModal onClose={requestClose} maxWidth={640}>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: KC.hairline }}>
        <h2 className="text-[15px] font-semibold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
          {t('asset-management:modal.title')}
        </h2>
        <button type="button" aria-label={t('asset-management:modal.close')} onClick={requestClose} className="cursor-pointer">
          <X size={16} style={{ color: KC.ink }} />
        </button>
      </div>

      <div className="grid max-h-[70vh] grid-cols-1 gap-3.5 overflow-y-auto px-4 py-4 sm:grid-cols-2">
        <Field label={fieldT('name')} required error={errors.name}>
          <input
            className={inputBase}
            style={inputStyle}
            placeholder={t('asset-management:modal.placeholders.name')}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />
        </Field>

        <Field label={fieldT('craneType')}>
          <select
            className={inputBase}
            style={inputStyle}
            value={form.craneType}
            onChange={(e) => set('craneType', e.target.value as CraneType)}
          >
            {CRANE_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {t(`asset-management:craneType.${ct}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={fieldT('manufacturer')} required error={errors.manufacturer}>
          <input
            className={inputBase}
            style={inputStyle}
            placeholder={t('asset-management:modal.placeholders.manufacturer')}
            value={form.manufacturer}
            onChange={(e) => set('manufacturer', e.target.value)}
          />
        </Field>

        <Field label={fieldT('model')} required error={errors.model}>
          <input
            className={inputBase}
            style={inputStyle}
            placeholder={t('asset-management:modal.placeholders.model')}
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
          />
        </Field>

        <Field label={fieldT('capacityTon')} required error={errors.capacityTon}>
          <input
            type="number"
            min={0}
            className={inputBase}
            style={inputStyle}
            value={form.capacityTon || ''}
            onChange={(e) => set('capacityTon', Number(e.target.value))}
          />
        </Field>

        <Field label={fieldT('serialNumber')} required error={errors.serialNumber}>
          <input
            className={inputBase}
            style={inputStyle}
            placeholder={t('asset-management:modal.placeholders.serialNumber')}
            value={form.serialNumber}
            onChange={(e) => set('serialNumber', e.target.value)}
          />
        </Field>

        <Field label={fieldT('spanM')}>
          <input
            type="number"
            min={0}
            className={inputBase}
            style={inputStyle}
            value={form.spanM ?? ''}
            onChange={(e) => set('spanM', e.target.value ? Number(e.target.value) : undefined)}
          />
        </Field>

        <Field label={fieldT('liftHeightM')}>
          <input
            type="number"
            min={0}
            className={inputBase}
            style={inputStyle}
            value={form.liftHeightM ?? ''}
            onChange={(e) => set('liftHeightM', e.target.value ? Number(e.target.value) : undefined)}
          />
        </Field>

        <Field label={fieldT('siteId')}>
          <select
            className={inputBase}
            style={inputStyle}
            value={form.siteId}
            onChange={(e) => {
              const site = siteOptions.find((s) => s.id === e.target.value);
              set('siteId', e.target.value);
              set('siteName', site?.name ?? e.target.value);
            }}
          >
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={fieldT('indoorOutdoor')}>
          <div className="grid grid-cols-2 gap-1.5">
            {(['outdoor', 'indoor'] as const).map((v) => {
              const active = form.indoorOutdoor === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('indoorOutdoor', v)}
                  className="cursor-pointer rounded-[4px] border px-2 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? KC.accent : KC.bg,
                    color: active ? KC.onAccent : KC.text,
                    borderColor: active ? KC.accent : KC.border,
                  }}
                >
                  {t(`asset-management:modal.indoorOutdoor.${v}`)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={fieldT('locationZone')} required error={errors.locationZone} colSpan2>
          <input
            className={inputBase}
            style={inputStyle}
            placeholder={t('asset-management:modal.placeholders.locationZone')}
            value={form.locationZone}
            onChange={(e) => set('locationZone', e.target.value)}
          />
        </Field>

        <Field label={fieldT('manufactureDate')}>
          <input
            type="date"
            className={inputBase}
            style={inputStyle}
            value={form.manufactureDate}
            onChange={(e) => set('manufactureDate', e.target.value)}
          />
        </Field>

        <Field label={fieldT('installationDate')}>
          <input
            type="date"
            className={inputBase}
            style={inputStyle}
            value={form.installationDate}
            onChange={(e) => set('installationDate', e.target.value)}
          />
        </Field>

        <Field label={fieldT('warrantyStart')}>
          <input
            type="date"
            className={inputBase}
            style={inputStyle}
            value={form.warrantyStart}
            onChange={(e) => set('warrantyStart', e.target.value)}
          />
        </Field>

        <Field label={fieldT('warrantyEnd')}>
          <input
            type="date"
            className={inputBase}
            style={inputStyle}
            value={form.warrantyEnd}
            onChange={(e) => set('warrantyEnd', e.target.value)}
          />
        </Field>

        <Field label={fieldT('status')} colSpan2>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const active = form.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className="cursor-pointer rounded-[4px] border px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? KC.accent : KC.bg,
                    color: active ? KC.onAccent : KC.text,
                    borderColor: active ? KC.accent : KC.border,
                  }}
                >
                  {t(`asset-management:status.${s}`)}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: KC.hairline }}>
        <KcButton variant="ghost" onClick={requestClose}>
          {t('asset-management:modal.cancel')}
        </KcButton>
        <KcButton variant="teal" onClick={submit}>
          <Plus size={13} /> {t('asset-management:modal.submit')}
        </KcButton>
      </div>
    </KcModal>
  );
}
