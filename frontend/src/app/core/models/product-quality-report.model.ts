export interface ProductQualityMonthlyReport {
  reportMonth: string;
  generatedAt: string;
  jiraBaseUrl: string;

  // KPI: Reported MTD
  totalReportedMtd: number;
  blockersReportedMtd: number;
  criticalsReportedMtd: number;
  threeMonthAvgTotal: number;
  threeMonthAvgBlockers: number;
  threeMonthAvgCriticals: number;
  totalReportedMtdChangePct: number;
  blockersReportedMtdChangePct: number;
  criticalsReportedMtdChangePct: number;

  // KPI: Resolved counts and %
  totalResolvedCount: number;
  blockersResolvedCount: number;
  criticalsResolvedCount: number;
  totalResolvedPct: number;
  blockersResolvedPct: number;
  criticalsResolvedPct: number;
  prevPeriodTotalResolvedPct: number;
  prevPeriodBlockersResolvedPct: number;
  prevPeriodCriticalsResolvedPct: number;
  totalResolvedChangePct: number;
  blockersResolvedChangePct: number;
  criticalsResolvedChangePct: number;

  // Charts
  monthlyBugsByMonth: MonthlyBugCountPoint[];
  weekToWeekTrend: WeekToWeekPoint[];
  backlogGrowth: BacklogGrowthPoint[];

  // Ticket lists
  criticalAndBlockerTickets: BugTicketItem[];
  majorTickets: BugTicketItem[];

  // SLA
  criticalSla: BugsOutOfSlaRow;
  majorSla: BugsOutOfSlaRow;
}

export interface MonthlyBugCountPoint {
  monthLabel: string;
  monthStart: string;
  blocker: number;
  critical: number;
  major: number;
  minor: number;
}

export interface WeekToWeekPoint {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  totalOpen: number;
  created: number;
  resolved: number;
}

export interface BacklogGrowthPoint {
  label: string;
  date: string;
  critical: number;
  major: number;
}

export interface BugTicketItem {
  key: string;
  summary: string;
  priority: string;
  status: string;
  daysOpen: number;
  component: string;
  jiraUrl: string;
}

export interface BugsOutOfSlaRow {
  severity: string;
  lt30: number;
  bt3060: number;
  bt6090: number;
  gt90: number;
  avgDaysOutstanding: number;
}
