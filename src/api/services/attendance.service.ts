import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type {
  AttendanceEvent, AttendanceRecord, AttendanceSettings, AttendanceSite, AttendanceStatus, AttendanceSummary, BulkAssignResult,
  Employee, EmployeeRequest, Holiday, HolidayRequest, LeaveBalance, LeaveCreateRequest, LeaveRequestItem, LeaveStatus,
  MonthlySummaryRow, RecordOverrideRequest, Roster, RosterAssignRequest, RosterAssignment, RosterRequest, SiteRequest,
} from '@/types/attendance.types';

const BASE = '/v1/attendance';

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiResponse<T>>(url, { params });
  return res.data.data;
}

export const attendanceService = {
  // employees
  listEmployees: () => get<Employee[]>(`${BASE}/employees`),
  async createEmployee(req: EmployeeRequest): Promise<Employee> {
    return (await apiClient.post<ApiResponse<Employee>>(`${BASE}/employees`, req)).data.data;
  },
  async updateEmployee(id: number, req: EmployeeRequest): Promise<Employee> {
    return (await apiClient.put<ApiResponse<Employee>>(`${BASE}/employees/${id}`, req)).data.data;
  },
  async deleteEmployee(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/employees/${id}`);
  },
  async uploadEmployeePhoto(id: number, file: File): Promise<Employee> {
    const fd = new FormData();
    fd.append('file', file);
    return (await apiClient.post<ApiResponse<Employee>>(`${BASE}/employees/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
  },
  employeePhotoUrl: (id: number) => `${BASE}/employees/${id}/photo`,

  // sites
  listSites: () => get<AttendanceSite[]>(`${BASE}/sites`),
  async createSite(req: SiteRequest): Promise<AttendanceSite> {
    return (await apiClient.post<ApiResponse<AttendanceSite>>(`${BASE}/sites`, req)).data.data;
  },
  async updateSite(id: number, req: SiteRequest): Promise<AttendanceSite> {
    return (await apiClient.put<ApiResponse<AttendanceSite>>(`${BASE}/sites/${id}`, req)).data.data;
  },
  async deleteSite(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/sites/${id}`);
  },

  // rosters + assignments
  listRosters: () => get<Roster[]>(`${BASE}/rosters`),
  async createRoster(req: RosterRequest): Promise<Roster> {
    return (await apiClient.post<ApiResponse<Roster>>(`${BASE}/rosters`, req)).data.data;
  },
  async updateRoster(id: number, req: RosterRequest): Promise<Roster> {
    return (await apiClient.put<ApiResponse<Roster>>(`${BASE}/rosters/${id}`, req)).data.data;
  },
  async deleteRoster(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/rosters/${id}`);
  },
  async assignRoster(req: RosterAssignRequest): Promise<BulkAssignResult> {
    return (await apiClient.post<ApiResponse<BulkAssignResult>>(`${BASE}/rosters/assign`, req)).data.data;
  },
  listAssignments: (deviceUuid?: string) => get<RosterAssignment[]>(`${BASE}/assignments`, deviceUuid ? { deviceUuid } : undefined),
  async unassign(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/assignments/${id}`);
  },

  // records
  summary: (date?: string) => get<AttendanceSummary>(`${BASE}/summary`, date ? { date } : undefined),
  records: (params: { from?: string; to?: string; deviceUuid?: string; status?: AttendanceStatus }) => get<AttendanceRecord[]>(`${BASE}/records`, params),
  record: (id: number) => get<AttendanceRecord>(`${BASE}/records/${id}`),
  live: () => get<AttendanceRecord[]>(`${BASE}/live`),
  events: (params: { from?: string; to?: string; violationsOnly?: boolean; deviceUuid?: string }) => get<AttendanceEvent[]>(`${BASE}/events`, params),
  async override(id: number, req: RecordOverrideRequest): Promise<AttendanceRecord> {
    return (await apiClient.put<ApiResponse<AttendanceRecord>>(`${BASE}/records/${id}/override`, req)).data.data;
  },
  /** Authenticated image fetch → object URL (the <img> tag cannot send the JWT). */
  async selfieObjectUrl(id: number, checkOut = false, session?: number): Promise<string> {
    const res = await apiClient.get(`${BASE}/records/${id}/selfie`, { params: { checkOut, session }, responseType: 'blob' });
    return window.URL.createObjectURL(new Blob([res.data], { type: 'image/jpeg' }));
  },

  // settings
  settings: () => get<AttendanceSettings>(`${BASE}/settings`),
  async updateSettings(req: Partial<AttendanceSettings>): Promise<AttendanceSettings> {
    return (await apiClient.put<ApiResponse<AttendanceSettings>>(`${BASE}/settings`, req)).data.data;
  },

  // holidays + leave
  listHolidays: () => get<Holiday[]>(`${BASE}/holidays`),
  async createHoliday(req: HolidayRequest): Promise<Holiday> {
    return (await apiClient.post<ApiResponse<Holiday>>(`${BASE}/holidays`, req)).data.data;
  },
  async deleteHoliday(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/holidays/${id}`);
  },
  listLeaves: (params: { status?: LeaveStatus; employeeId?: number }) => get<LeaveRequestItem[]>(`${BASE}/leaves`, params),
  async createLeave(req: LeaveCreateRequest): Promise<LeaveRequestItem> {
    return (await apiClient.post<ApiResponse<LeaveRequestItem>>(`${BASE}/leaves`, req)).data.data;
  },
  async decideLeave(id: number, approve: boolean, note?: string): Promise<LeaveRequestItem> {
    return (await apiClient.post<ApiResponse<LeaveRequestItem>>(`${BASE}/leaves/${id}/${approve ? 'approve' : 'reject'}`, { note })).data.data;
  },
  async cancelLeave(id: number): Promise<LeaveRequestItem> {
    return (await apiClient.post<ApiResponse<LeaveRequestItem>>(`${BASE}/leaves/${id}/cancel`)).data.data;
  },
  leaveBalance: (employeeId: number, year?: number) => get<LeaveBalance>(`${BASE}/leaves/balance`, { employeeId, year }),

  // reports
  monthly: (year: number, month: number) => get<MonthlySummaryRow[]>(`${BASE}/reports/monthly`, { year, month }),
  async downloadCsv(type: 'daily' | 'monthly' | 'violations', params: Record<string, unknown>): Promise<void> {
    const response = await apiClient.get(`${BASE}/reports/${type}/csv`, { params, responseType: 'blob' });
    const disposition = (response.headers['content-disposition'] as string | undefined) ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `attendance-${type}.csv`;
    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
