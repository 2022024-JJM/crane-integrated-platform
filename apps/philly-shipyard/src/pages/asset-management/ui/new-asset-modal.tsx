import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useCreateAsset, useAssetForm } from '@crane/features/asset';
import type { AssetStatus, CraneType } from '@crane/domain/asset';
import { Button } from '@crane/ui/atoms/button';
import { DatePicker } from '@crane/ui/molecules/date-picker';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_MODAL } from '../../../shared/ui/surface';
import {
  FormField as Field,
  inputClass,
  selectClass,
  TOGGLE_ACTIVE,
  TOGGLE_BASE,
  TOGGLE_INACTIVE,
} from '../../../shared/ui/form';
import { SITES } from '../../../shared/config/sites';
import { FOCUS_RING } from '../../../shared/ui/controls';

// 사이트 옵션은 공용 사이트 카탈로그에서 파생 — 사이트 추가 시 sites.ts만 수정
const SITE_OPTIONS: Array<{ id: string; nameKey: string; fallback: string }> =
  SITES.map((s) => ({ id: s.id, nameKey: `sites.${s.i18nKey}`, fallback: s.fallbackName }));

const CRANE_TYPES: CraneType[] = ['goliath', 'overhead', 'gantry', 'jib', 'ttc', 'llc', 'luffing'];
const STATUSES: AssetStatus[] = ['operating', 'inspection', 'repair', 'idle', 'decommissioned'];

export function NewAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('asset-management');
  const createAsset = useCreateAsset();

  const { form, errors, set, setSite, validate } = useAssetForm({
    resetKey: open,
    messages: {
      nameRequired: t('modal.validation.nameRequired', { defaultValue: 'Name is required.' }),
      manufacturerRequired: t('modal.validation.manufacturerRequired', { defaultValue: 'Manufacturer is required.' }),
      modelRequired: t('modal.validation.modelRequired', { defaultValue: 'Model is required.' }),
      serialRequired: t('modal.validation.serialRequired', { defaultValue: 'Serial number is required.' }),
      capacityRequired: t('modal.validation.capacityRequired', { defaultValue: 'Capacity must be > 0.' }),
      locationRequired: t('modal.validation.locationRequired', { defaultValue: 'Location is required.' }),
    },
  });

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // 첫 진입 시 다이얼로그 첫 포커스 가능 요소로 이동
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      // 트리거가 unmount된 경우 focus가 body로 빠지지 않도록 가드.
      if (
        previouslyFocused &&
        document.body.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const asset = createAsset(form);
    toast.success(t('modal.toastCreated', { name: asset.name, defaultValue: `Asset ${asset.name} added.` }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-asset-modal-title"
        aria-describedby="new-asset-modal-desc"
        className={cn(SURFACE_MODAL, 'relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden')}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
          <div>
            <h2 id="new-asset-modal-title" className="text-base font-bold">
              {t('modal.title', { defaultValue: 'Register New Asset' })}
            </h2>
            <p id="new-asset-modal-desc" className="text-xs text-muted-foreground">
              {t('modal.description', { defaultValue: 'Add a new crane asset to the registry.' })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn('flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
            aria-label={t('modal.close', { defaultValue: 'Close' })}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
            <Field label={t('modal.fields.name', { defaultValue: 'Asset Name' })} required error={errors.name}>
              <input
                className={inputClass}
                placeholder={t('modal.placeholders.name', { defaultValue: 'e.g. GC-106' })}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>

            <Field label={t('modal.fields.craneType', { defaultValue: 'Crane Type' })}>
              <select
                className={selectClass}
                value={form.craneType}
                onChange={(e) => set('craneType', e.target.value as CraneType)}
              >
                {CRANE_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{t(`craneType.${ct}`, { defaultValue: ct })}</option>
                ))}
              </select>
            </Field>

            <Field label={t('modal.fields.manufacturer', { defaultValue: 'Manufacturer' })} required error={errors.manufacturer}>
              <input
                className={inputClass}
                placeholder={t('modal.placeholders.manufacturer', { defaultValue: 'e.g. Konecranes' })}
                value={form.manufacturer}
                onChange={(e) => set('manufacturer', e.target.value)}
              />
            </Field>

            <Field label={t('modal.fields.model', { defaultValue: 'Model' })} required error={errors.model}>
              <input
                className={inputClass}
                placeholder={t('modal.placeholders.model', { defaultValue: 'e.g. Goliath 900T' })}
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
              />
            </Field>

            <Field label={t('modal.fields.capacityTon', { defaultValue: 'Capacity (Ton)' })} required error={errors.capacityTon}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.capacityTon || ''}
                onChange={(e) => set('capacityTon', Number(e.target.value))}
              />
            </Field>

            <Field label={t('modal.fields.serialNumber', { defaultValue: 'Serial Number' })} required error={errors.serialNumber}>
              <input
                className={inputClass}
                placeholder={t('modal.placeholders.serialNumber', { defaultValue: 'e.g. KC-2026-GC-001' })}
                value={form.serialNumber}
                onChange={(e) => set('serialNumber', e.target.value)}
              />
            </Field>

            <Field label={t('modal.fields.spanM', { defaultValue: 'Span (m)' })}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.spanM ?? ''}
                onChange={(e) => set('spanM', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>

            <Field label={t('modal.fields.liftHeightM', { defaultValue: 'Lift Height (m)' })}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.liftHeightM ?? ''}
                onChange={(e) => set('liftHeightM', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>

            <Field label={t('modal.fields.siteId', { defaultValue: 'Site' })}>
              <select
                className={selectClass}
                value={form.siteId}
                onChange={(e) => setSite(e.target.value)}
              >
                {SITE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{t(s.nameKey, { defaultValue: s.fallback })}</option>
                ))}
              </select>
            </Field>

            <Field label={t('modal.fields.indoorOutdoor', { defaultValue: 'Indoor / Outdoor' })}>
              <select
                className={selectClass}
                value={form.indoorOutdoor}
                onChange={(e) => set('indoorOutdoor', e.target.value as 'indoor' | 'outdoor')}
              >
                <option value="outdoor">{t('modal.indoorOutdoor.outdoor', { defaultValue: 'Outdoor' })}</option>
                <option value="indoor">{t('modal.indoorOutdoor.indoor', { defaultValue: 'Indoor' })}</option>
              </select>
            </Field>

            <Field label={t('modal.fields.locationZone', { defaultValue: 'Location Zone' })} required error={errors.locationZone} colSpan={2}>
              <input
                className={inputClass}
                placeholder={t('modal.placeholders.locationZone', { defaultValue: 'e.g. Dock No.1 West' })}
                value={form.locationZone}
                onChange={(e) => set('locationZone', e.target.value)}
              />
            </Field>

            <Field label={t('modal.fields.manufactureDate', { defaultValue: 'Manufacture Date' })}>
              <DatePicker value={form.manufactureDate} onChange={(v) => set('manufactureDate', v)} />
            </Field>

            <Field label={t('modal.fields.installationDate', { defaultValue: 'Installation Date' })}>
              <DatePicker value={form.installationDate} onChange={(v) => set('installationDate', v)} />
            </Field>

            <Field label={t('modal.fields.warrantyStart', { defaultValue: 'Warranty Start' })}>
              <DatePicker value={form.warrantyStart} onChange={(v) => set('warrantyStart', v)} />
            </Field>

            <Field label={t('modal.fields.warrantyEnd', { defaultValue: 'Warranty End' })}>
              <DatePicker value={form.warrantyEnd} onChange={(v) => set('warrantyEnd', v)} />
            </Field>

            <Field label={t('modal.fields.status', { defaultValue: 'Status' })} colSpan={2}>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className={cn(
                      TOGGLE_BASE,
                      form.status === s ? TOGGLE_ACTIVE + ' shadow-sm' : TOGGLE_INACTIVE,
                    )}
                  >
                    {t(`status.${s}`, { defaultValue: s })}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('modal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit">
              {t('modal.submit', { defaultValue: 'Register Asset' })}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
