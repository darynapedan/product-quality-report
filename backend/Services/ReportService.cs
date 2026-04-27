using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using ProductQualityReport.Jira;
using ProductQualityReport.Models;

namespace ProductQualityReport.Services;

public class ReportService
{
    private readonly JiraApiService _jira;
    private readonly IMemoryCache _cache;
    private readonly JiraConfiguration _config;

    public ReportService(JiraApiService jira, IMemoryCache cache, IOptions<JiraConfiguration> config)
    {
        _jira = jira;
        _cache = cache;
        _config = config.Value;
    }

    public async Task<ProductQualityMonthlyReport> GetReportAsync(
        DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        var cacheKey = $"pqr_{startDate:yyyyMMdd}_{endDate:yyyyMMdd}";
        if (_cache.TryGetValue(cacheKey, out ProductQualityMonthlyReport? cached) && cached != null)
            return cached;

        var now = DateTime.UtcNow;

        // Date windows
        var threeMonthStart = startDate.AddMonths(-3);
        var fetchStart = startDate.AddMonths(-14);
        var prev30Start = startDate.AddDays(-30);

        // Parallel Jira fetches
        var openTask     = _jira.GetOpenBugsDetailedAsync(ct);
        var createdTask  = _jira.GetAllBugsInDateRangeAsync(fetchStart, endDate, ct);
        var resolvedTask = _jira.GetResolvedBugsInDateRangeAsync(fetchStart, endDate, ct);
        await Task.WhenAll(openTask, createdTask, resolvedTask);

        var openBugs         = (await openTask).ToList();
        var historicCreated  = (await createdTask).Where(b => b.Created.HasValue).ToList();
        var historicResolved = (await resolvedTask).Where(b => b.ResolutionDate.HasValue).ToList();

        // ── KPI: Reported ──
        var periodBugs = historicCreated.Where(b => b.Created!.Value >= startDate && b.Created.Value < endDate).ToList();
        var totalReportedMtd    = periodBugs.Count;
        var blockersReportedMtd = periodBugs.Count(b => IsBlocker(b.Priority));
        var criticalsReportedMtd = periodBugs.Count(b => IsCritical(b.Priority));

        var threeMonthBugs = historicCreated.Where(b => b.Created!.Value >= threeMonthStart && b.Created.Value < startDate).ToList();
        var threeMonthAvgTotal    = Avg3(threeMonthBugs.Count);
        var threeMonthAvgBlockers = Avg3(threeMonthBugs.Count(b => IsBlocker(b.Priority)));
        var threeMonthAvgCriticals = Avg3(threeMonthBugs.Count(b => IsCritical(b.Priority)));

        // ── KPI: Resolved % ──
        var currCreated  = historicCreated.Where(b => b.Created!.Value >= startDate && b.Created.Value < endDate).ToList();
        var currResolved = historicResolved.Where(b => b.ResolutionDate!.Value >= startDate && b.ResolutionDate.Value < endDate).ToList();
        var prevCreated  = historicCreated.Where(b => b.Created!.Value >= prev30Start && b.Created.Value < startDate).ToList();
        var prevResolved = historicResolved.Where(b => b.ResolutionDate!.Value >= prev30Start && b.ResolutionDate.Value < startDate).ToList();

        var totalResolvedPct           = ResolvedPct(currCreated, currResolved);
        var blockersResolvedPct        = ResolvedPct(currCreated, currResolved, IsBlocker);
        var criticalsResolvedPct       = ResolvedPct(currCreated, currResolved, IsCritical);
        var prevTotalResolvedPct       = ResolvedPct(prevCreated, prevResolved);
        var prevBlockersResolvedPct    = ResolvedPct(prevCreated, prevResolved, IsBlocker);
        var prevCriticalsResolvedPct   = ResolvedPct(prevCreated, prevResolved, IsCritical);

        // ── Monthly chart (12 months) ──
        var monthlyBugs = GenerateMonths(endDate.AddMonths(-12), endDate)
            .Select(m =>
            {
                var mb = historicCreated.Where(b => b.Created!.Value >= m.Start && b.Created.Value < m.End).ToList();
                return new MonthlyBugCountPoint
                {
                    MonthLabel = m.Start.ToString("MMM yy", CultureInfo.InvariantCulture),
                    MonthStart = m.Start,
                    Blocker  = mb.Count(b => IsBlocker(b.Priority)),
                    Critical = mb.Count(b => IsCritical(b.Priority)),
                    Major    = mb.Count(b => IsMajor(b.Priority)),
                    Minor    = mb.Count(b => IsMinor(b.Priority))
                };
            }).ToList();

        // ── Week-to-week chart ──
        var weekToWeek = GenerateWeeks(startDate, endDate)
            .Select(w =>
            {
                var wCreated  = historicCreated.Count(b => b.Created!.Value >= w.Start && b.Created.Value < w.End);
                var wResolved = historicResolved.Count(b => b.ResolutionDate!.Value >= w.Start && b.ResolutionDate.Value < w.End);
                var totalOpen =
                    openBugs.Count(b => b.Created.HasValue && b.Created.Value < w.End) +
                    historicResolved.Count(b => b.Created.HasValue && b.Created.Value < w.End && b.ResolutionDate!.Value >= w.End);
                return new WeekToWeekPoint
                {
                    WeekLabel = $"{w.Start.ToString("MMM d", CultureInfo.InvariantCulture)} – {w.End.AddDays(-1).ToString("MMM d", CultureInfo.InvariantCulture)}",
                    WeekStart = w.Start,
                    WeekEnd   = w.End,
                    TotalOpen = totalOpen,
                    Created   = wCreated,
                    Resolved  = wResolved
                };
            }).ToList();

        // ── Backlog growth (6 months) ──
        var backlogGrowth = GenerateMonths(endDate.AddMonths(-6), endDate)
            .Select(m =>
            {
                var snap = m.End > now ? now : m.End;
                return new BacklogGrowthPoint
                {
                    Label    = m.Start.ToString("MMM yy", CultureInfo.InvariantCulture),
                    Date     = snap,
                    Critical = openBugs.Count(b => b.Created.HasValue && b.Created.Value < snap && IsCritical(b.Priority))
                             + historicResolved.Count(b => b.Created.HasValue && b.Created.Value < snap && b.ResolutionDate!.Value >= snap && IsCritical(b.Priority)),
                    Major    = openBugs.Count(b => b.Created.HasValue && b.Created.Value < snap && IsMajor(b.Priority))
                             + historicResolved.Count(b => b.Created.HasValue && b.Created.Value < snap && b.ResolutionDate!.Value >= snap && IsMajor(b.Priority))
                };
            }).ToList();

        var jiraBase = _config.BaseUrl.TrimEnd('/');

        // ── Ticket lists ──
        var criticalBlockerTickets = openBugs
            .Where(b => IsBlocker(b.Priority) || IsCritical(b.Priority))
            .OrderByDescending(b => b.Created)
            .Take(50)
            .Select(b => ToTicketItem(b, jiraBase, now))
            .ToList();

        var majorTickets = openBugs
            .Where(b => IsMajor(b.Priority))
            .OrderByDescending(b => b.Created)
            .Take(50)
            .Select(b => ToTicketItem(b, jiraBase, now))
            .ToList();

        // ── SLA ──
        var criticalSla = BuildSlaRow("Critical", openBugs.Where(b => IsBlocker(b.Priority) || IsCritical(b.Priority)).ToList(), now);
        var majorSla    = BuildSlaRow("Major",    openBugs.Where(b => IsMajor(b.Priority)).ToList(), now);

        var fmt = CultureInfo.InvariantCulture;
        var result = new ProductQualityMonthlyReport
        {
            ReportMonth  = $"{startDate.ToString("MMM d, yyyy", fmt)} – {endDate.AddDays(-1).ToString("MMM d, yyyy", fmt)}",
            GeneratedAt  = now,
            JiraBaseUrl  = jiraBase,
            TotalReportedMtd    = totalReportedMtd,
            BlockersReportedMtd = blockersReportedMtd,
            CriticalsReportedMtd = criticalsReportedMtd,
            ThreeMonthAvgTotal    = threeMonthAvgTotal,
            ThreeMonthAvgBlockers = threeMonthAvgBlockers,
            ThreeMonthAvgCriticals = threeMonthAvgCriticals,
            TotalReportedMtdChangePct     = ChangePct(totalReportedMtd,    threeMonthAvgTotal),
            BlockersReportedMtdChangePct  = ChangePct(blockersReportedMtd, threeMonthAvgBlockers),
            CriticalsReportedMtdChangePct = ChangePct(criticalsReportedMtd, threeMonthAvgCriticals),
            TotalResolvedPct    = totalResolvedPct,
            BlockersResolvedPct = blockersResolvedPct,
            CriticalsResolvedPct = criticalsResolvedPct,
            PrevPeriodTotalResolvedPct    = prevTotalResolvedPct,
            PrevPeriodBlockersResolvedPct = prevBlockersResolvedPct,
            PrevPeriodCriticalsResolvedPct = prevCriticalsResolvedPct,
            TotalResolvedChangePct     = ChangePct(totalResolvedPct,    prevTotalResolvedPct),
            BlockersResolvedChangePct  = ChangePct(blockersResolvedPct, prevBlockersResolvedPct),
            CriticalsResolvedChangePct = ChangePct(criticalsResolvedPct, prevCriticalsResolvedPct),
            MonthlyBugsByMonth        = monthlyBugs,
            WeekToWeekTrend           = weekToWeek,
            BacklogGrowth             = backlogGrowth,
            CriticalAndBlockerTickets = criticalBlockerTickets,
            MajorTickets              = majorTickets,
            CriticalSla = criticalSla,
            MajorSla    = majorSla
        };

        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(30));
        return result;
    }

    // ── Priority helpers ──────────────────────────────────────────────────────

    private static bool IsBlocker(string? p) =>
        string.Equals(p, "Blocker", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(p, "Highest", StringComparison.OrdinalIgnoreCase);

    private static bool IsCritical(string? p) =>
        string.Equals(p, "Critical", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(p, "High", StringComparison.OrdinalIgnoreCase);

    private static bool IsMajor(string? p) =>
        string.Equals(p, "Major", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(p, "Medium", StringComparison.OrdinalIgnoreCase);

    private static bool IsMinor(string? p) =>
        string.Equals(p, "Minor", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(p, "Low", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(p, "Lowest", StringComparison.OrdinalIgnoreCase);

    // ── Calculation helpers ───────────────────────────────────────────────────

    private static decimal Avg3(int count) => Math.Round((decimal)count / 3, 1);

    private static decimal ChangePct(decimal current, decimal avg) =>
        avg == 0 ? 0 : Math.Round((current - avg) / avg * 100, 1);

    private static decimal ResolvedPct(
        IEnumerable<JiraIssue> created,
        IEnumerable<JiraIssue> resolved,
        Func<string?, bool>? filter = null)
    {
        var c = filter == null ? created.ToList() : created.Where(b => filter(b.Priority)).ToList();
        var r = filter == null ? resolved.ToList() : resolved.Where(b => filter(b.Priority)).ToList();
        return c.Count == 0 ? 0 : Math.Round((decimal)r.Count / c.Count * 100, 1);
    }

    private static BugTicketItem ToTicketItem(JiraIssue b, string jiraBase, DateTime now) => new()
    {
        Key      = b.Key,
        Summary  = b.Summary ?? string.Empty,
        Priority = b.Priority ?? "Unknown",
        Status   = b.Status ?? string.Empty,
        DaysOpen = b.Created.HasValue ? (int)(now - b.Created.Value).TotalDays : 0,
        Component = b.Components.Count > 0 ? b.Components[0] : string.Empty,
        JiraUrl  = $"{jiraBase}/browse/{b.Key}"
    };

    private static BugsOutOfSlaRow BuildSlaRow(string severity, List<JiraIssue> bugs, DateTime now)
    {
        var ages = bugs.Where(b => b.Created.HasValue)
                       .Select(b => (int)(now - b.Created!.Value).TotalDays)
                       .ToList();
        return new BugsOutOfSlaRow
        {
            Severity           = severity,
            Lt30               = ages.Count(d => d < 30),
            Bt3060             = ages.Count(d => d >= 30 && d < 60),
            Bt6090             = ages.Count(d => d >= 60 && d < 90),
            Gt90               = ages.Count(d => d >= 90),
            AvgDaysOutstanding = ages.Count > 0 ? Math.Round((decimal)ages.Average(), 1) : 0
        };
    }

    // ── Date range generators ─────────────────────────────────────────────────

    private static List<(DateTime Start, DateTime End)> GenerateWeeks(DateTime startDate, DateTime endDate)
    {
        var weeks = new List<(DateTime, DateTime)>();
        var cur = startDate.Date;
        while (cur.DayOfWeek != DayOfWeek.Monday) cur = cur.AddDays(-1);
        var end = endDate.Date;
        while (end.DayOfWeek != DayOfWeek.Monday) end = end.AddDays(1);
        while (cur < end) { weeks.Add((cur, cur.AddDays(7))); cur = cur.AddDays(7); }
        return weeks;
    }

    private static List<(DateTime Start, DateTime End)> GenerateMonths(DateTime startDate, DateTime endDate)
    {
        var months = new List<(DateTime, DateTime)>();
        var cur = new DateTime(startDate.Year, startDate.Month, 1);
        while (cur < endDate)
        {
            months.Add((cur, cur.AddMonths(1)));
            cur = cur.AddMonths(1);
        }
        return months;
    }
}
