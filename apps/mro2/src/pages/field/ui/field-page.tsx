import { useParams } from 'react-router-dom';
import { matchFieldSubRoute } from '../lib/field-route';
import { FieldHome } from './field-home';
import { FieldMyTickets } from './field-my-tickets';
import { FieldNewTicket } from './field-new-ticket';
import { FieldTicketDetail } from './field-ticket-detail';
import { FieldEmergency } from './field-emergency';

/** `/mro2/field/*` — 서브라우트는 splat 을 lib 에서 판정해 가른다. */
export function Mro2FieldPage() {
  const params = useParams();
  const view = matchFieldSubRoute(params['*']);
  if (view.view === 'new')
    return <FieldNewTicket key={view.kind} kind={view.kind} />;
  if (view.view === 'emergency') return <FieldEmergency />;
  if (view.view === 'tickets') return <FieldMyTickets />;
  if (view.view === 'ticket') {
    return <FieldTicketDetail kind={view.kind} id={view.id} />;
  }
  return <FieldHome />;
}
