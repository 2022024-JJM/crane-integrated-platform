import { useCallback, useEffect, useState } from 'react';
import type { AssetDraft } from './use-create-asset';

const SITE_NAME: Record<string, string> = {
  'dock-4': 'Dock No.4',
};

export type AssetFormErrors = Partial<Record<keyof AssetDraft, string>>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusYears(base: string, years: number): string {
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function initialDraft(): AssetDraft {
  return {
    name: '',
    craneType: 'overhead',
    manufacturer: '',
    model: '',
    capacityTon: 0,
    spanM: undefined,
    liftHeightM: undefined,
    serialNumber: '',
    manufactureDate: today(),
    installationDate: today(),
    warrantyStart: today(),
    warrantyEnd: plusYears(today(), 5),
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    locationZone: '',
    indoorOutdoor: 'outdoor',
    status: 'operating',
  };
}

interface ValidationMessages {
  nameRequired: string;
  manufacturerRequired: string;
  modelRequired: string;
  serialRequired: string;
  capacityRequired: string;
  locationRequired: string;
}

export interface UseAssetFormOptions {
  /** 폼을 초기 상태로 리셋할 트리거 (모달 open 등) */
  resetKey?: unknown;
  messages: ValidationMessages;
}

export function useAssetForm({ resetKey, messages }: UseAssetFormOptions) {
  const [form, setForm] = useState<AssetDraft>(initialDraft);
  const [errors, setErrors] = useState<AssetFormErrors>({});

  useEffect(() => {
    setForm(initialDraft());
    setErrors({});
  }, [resetKey]);

  const set = useCallback(<K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const setSite = useCallback((siteId: string) => {
    setForm((f) => ({ ...f, siteId, siteName: SITE_NAME[siteId] ?? siteId }));
    setErrors((e) => ({ ...e, siteId: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const e: AssetFormErrors = {};
    if (!form.name.trim()) e.name = messages.nameRequired;
    if (!form.manufacturer.trim()) e.manufacturer = messages.manufacturerRequired;
    if (!form.model.trim()) e.model = messages.modelRequired;
    if (!form.serialNumber.trim()) e.serialNumber = messages.serialRequired;
    if (form.capacityTon <= 0) e.capacityTon = messages.capacityRequired;
    if (!form.locationZone.trim()) e.locationZone = messages.locationRequired;
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, messages]);

  return { form, errors, set, setSite, validate };
}
