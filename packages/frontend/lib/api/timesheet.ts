import { apiFetch } from './client';

export interface TimesheetData {
  [date: string]: number; // Date string (YYYY-MM-DD) to hours mapping
}

export const timesheetApi = {
  getHoursByDay: (
    studentId: number,
    startDate: string,
    endDate: string
  ): Promise<TimesheetData> =>
    apiFetch(
      `/timesheet/hours-by-day?studentId=${studentId}&startDate=${startDate}&endDate=${endDate}`,
    ),
};
