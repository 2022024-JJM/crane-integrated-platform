export type {
  FailureType,
  MaintenanceSummary,
  PartUsed,
  RepairLevel,
  RepairPriority,
  RepairSource,
  RepairStatus,
  RepairWO,
} from './model/types';
export {
  addPartUsedToRepair,
  addRepairWO,
  getAllRepairWOs,
  getMaintenanceSummary,
  getRepairWOById,
  restoreRepairStatus,
  updateRepairDetails,
  updateRepairStatus,
  updateRepairSchedule,
} from './model/mock-data';
export type { RepairDetailsUpdate } from './model/mock-data';
