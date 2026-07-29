import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, TicketPlus } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { PAGE_CONTAINER, PAGE_TITLE, PAGE_SUBTITLE } from '../../../shared/ui/page';
import { TicketTypeSelector } from './ticket-type-selector';
import type { TicketType } from './ticket-type-selector';
import { CreateTicketForm } from './create-ticket-form';
import { FOCUS_RING } from '../../../shared/ui/controls';

export function CreateTicketPage() {
  const { t } = useTranslation('ticket');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('type') as TicketType | null;

  const [selectedType, setSelectedType] = useState<TicketType | null>(
    initial === 'repair' || initial === 'inspection' || initial === 'parts' ? initial : null,
  );

  return (
    <div className={cn(PAGE_CONTAINER, 'mx-auto max-w-6xl')}>
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={cn('flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', FOCUS_RING)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
            <TicketPlus className="size-4 text-primary" />
          </div>
          <div>
            <h1 className={PAGE_TITLE}>{t('title')}</h1>
            <p className={PAGE_SUBTITLE}>{t('description')}</p>
          </div>
        </div>
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
