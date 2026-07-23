import {
  type LucideIcon,
  ChartBar,
  Calendar,
  FileText,
  FileCheck2,
  MapPin,
  Package,
  Plus,
} from 'lucide-react';

export interface QuickLink {
  i18nKey: string;
  to: string;
  icon: LucideIcon;
}

export const QUICK_LINKS: QuickLink[] = [
  { i18nKey: 'quickLinks.businessReview', to: '/maintenance', icon: ChartBar },
  { i18nKey: 'quickLinks.serviceCalendar', to: '/service-calendar', icon: Calendar },
  { i18nKey: 'quickLinks.documents', to: '/compliance', icon: FileText },
  { i18nKey: 'quickLinks.agreements', to: '/asset-management', icon: FileCheck2 },
  { i18nKey: 'quickLinks.locationActivities', to: '/maintenance', icon: MapPin },
  { i18nKey: 'quickLinks.slings', to: '/inventory', icon: Package },
  { i18nKey: 'quickLinks.newTicket', to: '/ticket/create', icon: Plus },
];
