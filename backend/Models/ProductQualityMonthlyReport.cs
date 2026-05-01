namespace ProductQualityReport.Models;

public class ProductQualityMonthlyReport
{
    public string ReportMonth { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; }
    public string JiraBaseUrl { get; set; } = string.Empty;

    // KPI: Reported in period
    public int TotalReportedMtd { get; set; }
    public int BlockersReportedMtd { get; set; }
    public int CriticalsReportedMtd { get; set; }
    public decimal ThreeMonthAvgTotal { get; set; }
    public decimal ThreeMonthAvgBlockers { get; set; }
    public decimal ThreeMonthAvgCriticals { get; set; }
    public decimal TotalReportedMtdChangePct { get; set; }
    public decimal BlockersReportedMtdChangePct { get; set; }
    public decimal CriticalsReportedMtdChangePct { get; set; }

    // KPI: Resolved counts (absolute) and percentages
    public int TotalResolvedCount { get; set; }
    public int BlockersResolvedCount { get; set; }
    public int CriticalsResolvedCount { get; set; }
    public decimal TotalResolvedPct { get; set; }
    public decimal BlockersResolvedPct { get; set; }
    public decimal CriticalsResolvedPct { get; set; }
    public decimal PrevPeriodTotalResolvedPct { get; set; }
    public decimal PrevPeriodBlockersResolvedPct { get; set; }
    public decimal PrevPeriodCriticalsResolvedPct { get; set; }
    public decimal TotalResolvedChangePct { get; set; }
    public decimal BlockersResolvedChangePct { get; set; }
    public decimal CriticalsResolvedChangePct { get; set; }

    // Charts
    public List<MonthlyBugCountPoint> MonthlyBugsByMonth { get; set; } = new();
    public List<WeekToWeekPoint> WeekToWeekTrend { get; set; } = new();
    public List<BacklogGrowthPoint> BacklogGrowth { get; set; } = new();

    // Ticket lists
    public List<BugTicketItem> CriticalAndBlockerTickets { get; set; } = new();
    public List<BugTicketItem> MajorTickets { get; set; } = new();

    // SLA
    public BugsOutOfSlaRow CriticalSla { get; set; } = new();
    public BugsOutOfSlaRow MajorSla { get; set; } = new();
}

public class MonthlyBugCountPoint
{
    public string MonthLabel { get; set; } = string.Empty;
    public DateTime MonthStart { get; set; }
    public int Blocker { get; set; }
    public int Critical { get; set; }
    public int Major { get; set; }
    public int Minor { get; set; }
}

public class WeekToWeekPoint
{
    public string WeekLabel { get; set; } = string.Empty;
    public DateTime WeekStart { get; set; }
    public DateTime WeekEnd { get; set; }
    public int TotalOpen { get; set; }
    public int Created { get; set; }
    public int Resolved { get; set; }
}

public class BacklogGrowthPoint
{
    public string Label { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int Critical { get; set; }
    public int Major { get; set; }
}

public class BugTicketItem
{
    public string Key { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int DaysOpen { get; set; }
    public string Component { get; set; } = string.Empty;
    public string JiraUrl { get; set; } = string.Empty;
}

public class BugsOutOfSlaRow
{
    public string Severity { get; set; } = string.Empty;
    public int Lt30 { get; set; }
    public int Bt3060 { get; set; }
    public int Bt6090 { get; set; }
    public int Gt90 { get; set; }
    public decimal AvgDaysOutstanding { get; set; }
}
