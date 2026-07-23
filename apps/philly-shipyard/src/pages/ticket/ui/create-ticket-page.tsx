import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, TicketPlus, Check } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { TicketTypeSelector } from './ticket-type-selector';
import type { TicketType } from './ticket-type-selector';
import { CreateTicketForm } from './create-ticket-form';

export function CreateTicketPage() {
  const { t } = useTranslation('ticket');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('type') as TicketType | null;

  const [selectedType, setSelectedType] = useState<TicketType | null>(
    initial === 'repair' || initial === 'inspection' || initial === 'parts' ? initial : null,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
            <TicketPlus className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
        </div>
      </div>

      {/* 스테퍼 */}
      <div className="flex items-center gap-2">
        <StepDot active={true} done={!!selectedType} num={1} label={t('stepper.selectType', { defaultValue: 'Select Type' })} />
        <StepBar active={!!selectedType} />
        <StepDot active={!!selectedType} done={false} num={2} label={t('stepper.fillInfo', { defaultValue: 'Fill Information' })} />
        <StepBar active={false} />
        <StepDot active={false} done={false} num={3} label={t('stepper.submit', { defaultValue: 'Submit' })} />
      </div>

      {/* 타입 선택 */}
      <TicketTypeSelector selected={selectedType} onChange={setSelectedType} />

      {/* 통합 폼 */}
      {selectedType && (
        <CreateTicketForm
          key={selectedType}
          type={selectedType}
          onSuccess={(id) => {
            if (selectedType === 'repair') navigate(`/maintenance/${id!}`);
            else if (selectedType === 'inspection') navigate(`/inspection/${id!}`);
            else navigate('/inventory');
          }}
        />
      )}
    </div>
  );
}

function StepDot({ active, done, num, label }: { active: boolean; done: boolean; num: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
          done
            ? 'bg-primary text-primary-foreground'
            : active
              ? 'border-2 border-primary bg-background text-primary'
              : 'border-2 border-border bg-background text-muted-foreground',
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : num}
      </div>
      {/* sm 미만에서는 번호 점만 표시해 스테퍼가 넘치지 않게 한다 */}
      <span className={cn('hidden text-xs font-medium sm:inline', active ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  );
}

function StepBar({ active }: { active: boolean }) {
  return <div className={cn('h-px flex-1 transition-colors', active ? 'bg-primary' : 'bg-border')} />;
}
