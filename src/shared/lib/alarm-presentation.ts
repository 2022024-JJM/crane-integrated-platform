import type { Alarm, AlarmEventType } from "@/entities/alarm"

const alarmEventTranslationKey: Record<AlarmEventType, string> = {
  wind_warning_exceeded: "common:alarms.windWarningExceeded",
  load_warning_reached: "common:alarms.loadWarningReached",
  maintenance_due: "common:alarms.maintenanceDue",
  idle_mode_completed: "common:alarms.idleModeCompleted",
  emergency_stop_triggered: "common:alarms.emergencyStopTriggered",
  work_area_changed: "common:alarms.workAreaChanged",
  wind_stop_exceeded: "common:alarms.windStopExceeded",
  work_resumed: "common:alarms.workResumed",
}

export function getAlarmMessageTranslation(alarm: Alarm) {
  return {
    key: alarmEventTranslationKey[alarm.eventType],
    values: alarm.eventData,
  }
}
