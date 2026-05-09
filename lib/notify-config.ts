import { LineNotifyConfig } from '@/types';

export const DEFAULT_LINE_NOTIFY_CONFIG: LineNotifyConfig = {
  case_created: true,
  case_assigned: true,
  case_in_progress: false,
  case_on_hold: false,
  case_resolved: true,
  case_closed: true,
  case_cancelled: false,
  new_comment: false,
  new_attachment: false,
  sla_warning: true,
  sla_breached: true,
  confirmation_requested: true,
};
