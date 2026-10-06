import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '@/api/services/attendance.service';
import { toast } from '@/hooks/useToast';
import type {
  AttendanceSettings,
  AttendanceStatus, EmployeeRequest, HolidayRequest, LeaveCreateRequest, LeaveStatus, RecordOverrideRequest,
  RosterAssignRequest, RosterRequest, SiteRequest,
} from '@/types/attendance.types';

export const ATTENDANCE_KEY = ['attendance'];

const errorMessage = (error: any, fallback: string) => error?.response?.data?.message || error?.message || fallback;

function useInvalidate(...parts: string[][]) {
  const qc = useQueryClient();
  return () => {
    if (parts.length === 0) qc.invalidateQueries({ queryKey: ATTENDANCE_KEY });
    parts.forEach((p) => qc.invalidateQueries({ queryKey: [...ATTENDANCE_KEY, ...p] }));
  };
}

function useAttendanceMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, ok: string, fail: string, invalidate: () => void, onOk?: (r: TResult) => void) {
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => { invalidate(); toast({ variant: 'success', title: ok }); onOk?.(r); },
    onError: (e: any) => toast({ variant: 'destructive', title: fail, description: errorMessage(e, 'Please try again.') }),
  });
}

// ── queries ────────────────────────────────────────────────────────────────

export const useEmployeesQuery = () => useQuery({ queryKey: [...ATTENDANCE_KEY, 'employees'], queryFn: attendanceService.listEmployees, staleTime: 60_000 });
export const useSitesQuery = () => useQuery({ queryKey: [...ATTENDANCE_KEY, 'sites'], queryFn: attendanceService.listSites, staleTime: 60_000 });
export const useRostersQuery = () => useQuery({ queryKey: [...ATTENDANCE_KEY, 'rosters'], queryFn: attendanceService.listRosters, staleTime: 60_000 });
export const useAssignmentsQuery = (deviceUuid?: string) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'assignments', deviceUuid ?? 'all'], queryFn: () => attendanceService.listAssignments(deviceUuid), staleTime: 30_000 });
export const useAttendanceSummaryQuery = (date?: string) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'summary', date ?? 'today'], queryFn: () => attendanceService.summary(date), refetchInterval: 60_000 });
export const useLiveBoardQuery = () =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'live'], queryFn: attendanceService.live, refetchInterval: 30_000 });
export const useRecordsQuery = (params: { from?: string; to?: string; deviceUuid?: string; status?: AttendanceStatus }, enabled = true) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'records', params], queryFn: () => attendanceService.records(params), enabled, staleTime: 30_000 });
export const useRecordQuery = (id: number | null) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'record', id], queryFn: () => attendanceService.record(id!), enabled: id != null });
export const useAttendanceEventsQuery = (params: { from?: string; to?: string; violationsOnly?: boolean; deviceUuid?: string }) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'events', params], queryFn: () => attendanceService.events(params), staleTime: 30_000 });
export const useHolidaysQuery = () => useQuery({ queryKey: [...ATTENDANCE_KEY, 'holidays'], queryFn: attendanceService.listHolidays, staleTime: 60_000 });
export const useLeavesQuery = (params: { status?: LeaveStatus; employeeId?: number }) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'leaves', params], queryFn: () => attendanceService.listLeaves(params), staleTime: 30_000 });
export const useLeaveBalanceQuery = (employeeId: number | null, year?: number) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'leaveBalance', employeeId, year], queryFn: () => attendanceService.leaveBalance(employeeId!, year), enabled: employeeId != null });
export const useAttendanceSettingsQuery = () => useQuery({ queryKey: [...ATTENDANCE_KEY, 'settings'], queryFn: attendanceService.settings, staleTime: 60_000 });
export const useMonthlyReportQuery = (year: number, month: number) =>
  useQuery({ queryKey: [...ATTENDANCE_KEY, 'monthly', year, month], queryFn: () => attendanceService.monthly(year, month), staleTime: 60_000 });

// ── mutations ──────────────────────────────────────────────────────────────

export const useCreateEmployee = () => useAttendanceMutation((r: EmployeeRequest) => attendanceService.createEmployee(r), 'Employee created', 'Could not create employee', useInvalidate(['employees'], ['assignments']));
export const useUpdateEmployee = () => useAttendanceMutation(({ id, ...r }: EmployeeRequest & { id: number }) => attendanceService.updateEmployee(id, r), 'Employee updated', 'Could not update employee', useInvalidate(['employees'], ['assignments']));
export const useDeleteEmployee = () => useAttendanceMutation((id: number) => attendanceService.deleteEmployee(id), 'Employee deactivated', 'Could not deactivate employee', useInvalidate(['employees']));
export const useUploadEmployeePhoto = () => useAttendanceMutation(({ id, file }: { id: number; file: File }) => attendanceService.uploadEmployeePhoto(id, file), 'Reference photo stored', 'Could not upload photo', useInvalidate(['employees']));

export const useCreateSite = () => useAttendanceMutation((r: SiteRequest) => attendanceService.createSite(r), 'Site created', 'Could not create site', useInvalidate(['sites']));
export const useUpdateSite = () => useAttendanceMutation(({ id, ...r }: SiteRequest & { id: number }) => attendanceService.updateSite(id, r), 'Site updated', 'Could not update site', useInvalidate(['sites'], ['rosters']));
export const useDeleteSite = () => useAttendanceMutation((id: number) => attendanceService.deleteSite(id), 'Site deleted', 'Could not delete site', useInvalidate(['sites']));

export const useCreateRoster = () => useAttendanceMutation((r: RosterRequest) => attendanceService.createRoster(r), 'Roster created', 'Could not create roster', useInvalidate(['rosters'], ['sites']));
export const useUpdateRoster = () => useAttendanceMutation(({ id, ...r }: RosterRequest & { id: number }) => attendanceService.updateRoster(id, r), 'Roster updated', 'Could not update roster', useInvalidate(['rosters'], ['sites'], ['assignments']));
export const useDeleteRoster = () => useAttendanceMutation((id: number) => attendanceService.deleteRoster(id), 'Roster deactivated', 'Could not deactivate roster', useInvalidate(['rosters']));
export const useAssignRoster = () => useAttendanceMutation((r: RosterAssignRequest) => attendanceService.assignRoster(r), 'Roster assigned', 'Could not assign roster', useInvalidate(['rosters'], ['assignments'], ['summary']));
export const useUnassignRoster = () => useAttendanceMutation((id: number) => attendanceService.unassign(id), 'Assignment removed', 'Could not remove assignment', useInvalidate(['rosters'], ['assignments']));

export const useOverrideRecord = () => useAttendanceMutation(({ id, ...r }: RecordOverrideRequest & { id: number }) => attendanceService.override(id, r), 'Record updated', 'Could not update record', useInvalidate(['records'], ['record'], ['summary'], ['live'], ['events'], ['monthly']));

export const useCreateHoliday = () => useAttendanceMutation((r: HolidayRequest) => attendanceService.createHoliday(r), 'Holiday added', 'Could not add holiday', useInvalidate(['holidays']));
export const useDeleteHoliday = () => useAttendanceMutation((id: number) => attendanceService.deleteHoliday(id), 'Holiday removed', 'Could not remove holiday', useInvalidate(['holidays']));
export const useCreateLeave = () => useAttendanceMutation((r: LeaveCreateRequest) => attendanceService.createLeave(r), 'Leave created', 'Could not create leave', useInvalidate(['leaves'], ['leaveBalance']));
export const useDecideLeave = () => useAttendanceMutation(({ id, approve, note }: { id: number; approve: boolean; note?: string }) => attendanceService.decideLeave(id, approve, note), 'Leave updated', 'Could not update leave', useInvalidate(['leaves'], ['leaveBalance']));
export const useCancelLeave = () => useAttendanceMutation((id: number) => attendanceService.cancelLeave(id), 'Leave cancelled', 'Could not cancel leave', useInvalidate(['leaves'], ['leaveBalance']));

export const useUpdateAttendanceSettings = () => useAttendanceMutation((r: Partial<AttendanceSettings>) => attendanceService.updateSettings(r), 'Settings saved', 'Could not save settings', useInvalidate(['settings']));
