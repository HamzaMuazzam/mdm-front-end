import type { BulkTarget } from '@/types/bulk.types';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EARLY_LEAVE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEK_OFF';
export type LeaveType = 'CASUAL' | 'SICK' | 'ANNUAL' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  deviceUuid?: string | null;
  deviceName?: string | null;
  deviceId?: number | null;
  casualLeaveQuota: number;
  sickLeaveQuota: number;
  annualLeaveQuota: number;
  active: boolean;
  hasReferencePhoto: boolean;
  createdAt: string;
}

export interface EmployeeRequest {
  employeeCode: string;
  fullName: string;
  designation?: string;
  department?: string;
  phone?: string;
  deviceUuid?: string | null;
  casualLeaveQuota?: number;
  sickLeaveQuota?: number;
  annualLeaveQuota?: number;
  active?: boolean;
}

export interface AttendanceSite {
  id: number;
  name: string;
  address?: string | null;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  active: boolean;
  rosterCount: number;
}

export interface SiteRequest {
  name: string;
  address?: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  active?: boolean;
}

export interface Roster {
  id: number;
  name: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  overnight: boolean;
  workingDays: number[];
  timezone: string;
  graceMinutes: number;
  earlyLeaveMinutes: number;
  checkInWindowBeforeMinutes: number;
  autoCloseAfterHours: number;
  minDutyMinutes: number;
  checkOutSelfieRequired: boolean;
  siteId?: number | null;
  siteName?: string | null;
  active: boolean;
  assignedDeviceCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RosterRequest {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  workingDays: number[];
  timezone?: string;
  graceMinutes?: number;
  earlyLeaveMinutes?: number;
  checkInWindowBeforeMinutes?: number;
  autoCloseAfterHours?: number;
  minDutyMinutes?: number;
  checkOutSelfieRequired?: boolean;
  siteId?: number | null;
  active?: boolean;
}

export interface RosterAssignRequest {
  rosterId: number;
  deviceUuids?: string[];
  target?: BulkTarget;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export interface RosterAssignment {
  id: number;
  rosterId: number;
  rosterName: string;
  deviceUuid: string;
  deviceName: string;
  employeeName?: string | null;
  employeeCode?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  assignedByEmail?: string | null;
  createdAt: string;
}

export interface BulkAssignResult {
  requested: number;
  assigned: number;
  failed: number;
  assignments: RosterAssignment[];
  errors: string[];
}

export interface DutySegment {
  id: number;
  startAt: string;
  endAt?: string | null;
  endReason?: string | null;
  seconds: number;
}

export interface AttendanceEvent {
  id: number;
  type: string;
  occurredAt: string;
  lat?: number | null;
  lng?: number | null;
  violation: boolean;
  details?: string | null;
  actorEmail?: string | null;
  deviceUuid?: string | null;
  deviceName?: string | null;
  recordId?: number | null;
}

export interface AttendanceRecord {
  id: number;
  rosterDate: string;
  status: AttendanceStatus;
  deviceUuid: string;
  deviceName: string;
  employeeId?: number | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  rosterId?: number | null;
  rosterName?: string | null;
  shiftStartAt?: string | null;
  shiftEndAt?: string | null;
  checkInAt?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInAccuracy?: number | null;
  livenessPassed?: boolean | null;
  hasSelfie: boolean;
  hasCheckOutSelfie: boolean;
  checkOutAt?: string | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutType?: string | null;
  onDuty: boolean;
  totalDutySeconds: number;
  overtimeSeconds: number;
  lateMinutes: number;
  source?: string | null;
  flagged?: boolean | null;
  flagReason?: string | null;
  note?: string | null;
  segments?: DutySegment[];
  events?: AttendanceEvent[];
}

export interface RecordOverrideRequest {
  status?: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  reason: string;
}

export interface AttendanceSummary {
  date: string;
  scheduled: number;
  checkedIn: number;
  onDutyNow: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  violationsToday: number;
}

export interface Holiday {
  id: number;
  name: string;
  date: string;
  recurringYearly: boolean;
}

export interface HolidayRequest {
  name: string;
  date: string;
  recurringYearly?: boolean;
}

export interface LeaveRequestItem {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string | null;
  status: LeaveStatus;
  decisionNote?: string | null;
  createdByEmail?: string | null;
  decidedByEmail?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface LeaveCreateRequest {
  employeeId: number;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason?: string;
  autoApprove?: boolean;
}

export interface LeaveBalance {
  employeeId: number;
  year: number;
  lines: { type: LeaveType; quota: number; used: number; remaining: number }[];
}

export interface MonthlySummaryRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  deviceUuid?: string | null;
  deviceName?: string | null;
  scheduledDays: number;
  present: number;
  late: number;
  absent: number;
  earlyLeave: number;
  onLeave: number;
  holidays: number;
  totalDutySeconds: number;
  overtimeSeconds: number;
  violations: number;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  EARLY_LEAVE: 'Early leave',
  ON_LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
  WEEK_OFF: 'Week off',
};

export const ATTENDANCE_STATUS_CLASSES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-50 text-green-700 border-green-200',
  LATE: 'bg-amber-50 text-amber-700 border-amber-200',
  ABSENT: 'bg-red-50 text-red-700 border-red-200',
  EARLY_LEAVE: 'bg-orange-50 text-orange-700 border-orange-200',
  ON_LEAVE: 'bg-blue-50 text-blue-700 border-blue-200',
  HOLIDAY: 'bg-purple-50 text-purple-700 border-purple-200',
  WEEK_OFF: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDuration(seconds?: number | null): string {
  const s = seconds ?? 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
