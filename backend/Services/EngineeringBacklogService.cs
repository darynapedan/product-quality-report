using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using ProductQualityReport.Jira;
using ProductQualityReport.Models;

namespace ProductQualityReport.Services;

public class EngineeringBacklogService
{
    private readonly JiraApiService _jira;
    private readonly IMemoryCache _cache;
    private readonly JiraConfiguration _config;

    private static readonly HashSet<string> ActiveStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "In Progress", "Code Review", "In Review", "QA", "Ready for QA", "QA In Progress", "Moved to Sprint" };

    private static readonly HashSet<string> QueuedStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "To Do", "New Request", "Pending", "Idea" };

    private static readonly HashSet<string> BlockedStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "Waiting for Customer", "Waiting on Customer", "Waiting on Support", "Waiting for support", "Blocked", "On Hold" };

    public EngineeringBacklogService(
        JiraApiService jira, IMemoryCache cache, IOptions<JiraConfiguration> config)
    {
        _jira = jira;
        _cache = cache;
        _config = config.Value;
    }

    public async Task<EngineeringBacklogReport> GetReportAsync(CancellationToken ct = default)
    {
        const string cacheKey = "backlog_current";
        if (_cache.TryGetValue(cacheKey, out EngineeringBacklogReport? cached) && cached != null)
            return cached;

        var sources = _config.BacklogSources.Count > 0
            ? _config.BacklogSources
            : new List<BacklogSource> { new() { ProjectKey = _config.BugProjectKey } };

        var fetchTasks = sources.Select(s => _jira.GetOpenTicketsForSourceAsync(s, ct));
        var results = await Task.WhenAll(fetchTasks);
        var issues = results.SelectMany(r => r).ToList();
        var now = DateTime.UtcNow;

        if (_config.DisplayNameOverrides.Count > 0)
            foreach (var issue in issues)
                if (issue.Assignee != null && _config.DisplayNameOverrides.TryGetValue(issue.Assignee, out var display))
                    issue.Assignee = display;

        var dsAssignees = new HashSet<string>(_config.DataServicesAssignees, StringComparer.OrdinalIgnoreCase);
        var dsRequestTypes = new HashSet<string>(_config.DataServicesRequestTypes, StringComparer.OrdinalIgnoreCase);

        bool IsDs(JiraIssue i) =>
            i.Assignee != null &&
            ((i.RequestType != null && dsRequestTypes.Contains(i.RequestType)) ||
             dsAssignees.Contains(i.Assignee));

        var dsTickets  = issues.Where(IsDs).ToList();
        var remaining  = issues.Where(i => !IsDs(i)).ToList();
        var engTickets = remaining.Where(i => i.Assignee != null).ToList();
        var unassigned = remaining.Where(i => i.Assignee == null).ToList();
        var engEngineerCount = engTickets.Select(i => i.Assignee).Distinct(StringComparer.OrdinalIgnoreCase).Count();

        var report = new EngineeringBacklogReport
        {
            GeneratedAt    = now.ToString("o"),
            JiraBaseUrl    = _config.BaseUrl,

            DsTicketCount    = dsTickets.Count,
            EngTicketCount   = engTickets.Count,
            UnassignedCount  = unassigned.Count,
            TotalCount       = issues.Count,
            DsEngineerCount  = _config.DataServicesEngineerCount,
            EngEngineerCount = engEngineerCount,

            DsTixPerEngineer  = _config.DataServicesEngineerCount > 0
                ? Math.Round((double)dsTickets.Count / _config.DataServicesEngineerCount, 1) : 0,
            EngTixPerEngineer = engEngineerCount > 0
                ? Math.Round((double)engTickets.Count / engEngineerCount, 1) : 0,
        };

        // DS/ENG split including unassigned (used for Avg Days, % Over 30, Priority Mix, Aging, Pipeline)
        bool IsDsTicket(JiraIssue i) =>
            (i.RequestType != null && dsRequestTypes.Contains(i.RequestType)) ||
            (i.Assignee != null && dsAssignees.Contains(i.Assignee));

        var dsAllTickets = issues.Where(IsDsTicket).ToList();
        var engAllTickets = issues.Where(i => !IsDsTicket(i)).ToList();
        report.DsAvgDaysOpen  = AvgDaysOpen(dsAllTickets, now);
        report.EngAvgDaysOpen = AvgDaysOpen(engAllTickets, now);
        report.DsMedianDaysOpen  = MedianDaysOpen(dsAllTickets, now);
        report.EngMedianDaysOpen = MedianDaysOpen(engAllTickets, now);

        // % over 30 days — based on request type, consistent with avg days open
        report.DsTicketsOver30   = dsAllTickets.Count(i => DaysOpen(i, now) > 30);
        report.EngTicketsOver30  = engAllTickets.Count(i => DaysOpen(i, now) > 30);
        report.DsPctOver30Days   = dsAllTickets.Count > 0
            ? Math.Round((double)report.DsTicketsOver30  / dsAllTickets.Count  * 100, 1) : 0;
        report.EngPctOver30Days  = engAllTickets.Count > 0
            ? Math.Round((double)report.EngTicketsOver30 / engAllTickets.Count * 100, 1) : 0;

        // Engineer workload
        var dsWorkload = dsTickets
            .GroupBy(i => i.Assignee!)
            .Select(g => new EngineerWorkloadItem
            {
                DisplayName = g.Key,
                Team        = "DS",
                TicketCount = g.Count(),
            });
        var engWorkload = engTickets
            .GroupBy(i => i.Assignee!)
            .Select(g => new EngineerWorkloadItem
            {
                DisplayName = g.Key,
                Team        = "ENG",
                TicketCount = g.Count(),
            });
        report.EngineerWorkload = dsWorkload.Concat(engWorkload)
            .OrderByDescending(e => e.TicketCount)
            .ToList();

        // Priority mix — based on request type
        report.DsPriorityMix  = BuildPriorityMix(dsAllTickets);
        report.EngPriorityMix = BuildPriorityMix(engAllTickets);

        // Aging distribution — based on request type
        report.DsAgingBuckets  = BuildAgingBuckets(dsAllTickets, now);
        report.EngAgingBuckets = BuildAgingBuckets(engAllTickets, now);

        // Pipeline state — based on request type
        report.DsPipelineState  = BuildPipelineState(dsAllTickets);
        report.EngPipelineState = BuildPipelineState(engAllTickets);

        // Diagnostics — based on request type (includes unassigned)
        report.DsBlockedCount     = dsAllTickets.Count(i => IsBlocked(i.Status));
        report.EngInProgressCount = engAllTickets.Count(i => IsActive(i.Status));
        report.EngNewUntouched    = engAllTickets.Count(i => IsQueued(i.Status));

        _cache.Set(cacheKey, report, TimeSpan.FromMinutes(30));
        return report;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static int DaysOpen(JiraIssue issue, DateTime now) =>
        issue.Created.HasValue ? (int)(now - issue.Created.Value).TotalDays : 0;

    private static double AvgDaysOpen(List<JiraIssue> tickets, DateTime now)
    {
        if (tickets.Count == 0) return 0;
        return Math.Round(tickets.Average(i => (double)DaysOpen(i, now)), 1);
    }

    private static int MedianDaysOpen(List<JiraIssue> tickets, DateTime now)
    {
        if (tickets.Count == 0) return 0;
        var sorted = tickets.Select(i => DaysOpen(i, now)).OrderBy(d => d).ToList();
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    private static TeamPriorityMix BuildPriorityMix(List<JiraIssue> tickets) => new()
    {
        Highest = tickets.Count(i => IsHighest(i.Priority)),
        High    = tickets.Count(i => IsHigh(i.Priority)),
        Medium  = tickets.Count(i => IsMedium(i.Priority)),
        Low     = tickets.Count(i => IsLow(i.Priority)),
        Lowest  = tickets.Count(i => IsLowest(i.Priority)),
    };

    private static AgingBuckets BuildAgingBuckets(List<JiraIssue> tickets, DateTime now) => new()
    {
        ZeroToSeven      = tickets.Count(i => DaysOpen(i, now) <= 7),
        EightToThirty    = tickets.Count(i => DaysOpen(i, now) is >= 8 and <= 30),
        ThirtyOneToSixty = tickets.Count(i => DaysOpen(i, now) is >= 31 and <= 60),
        SixtyPlus        = tickets.Count(i => DaysOpen(i, now) > 60),
    };

    private static PipelineState BuildPipelineState(List<JiraIssue> tickets) => new()
    {
        Active  = tickets.Count(i => IsActive(i.Status)),
        Queued  = tickets.Count(i => IsQueued(i.Status)),
        Blocked = tickets.Count(i => IsBlocked(i.Status)),
    };

    private static bool IsActive(string? s)  => s != null && ActiveStatuses.Contains(s);
    private static bool IsQueued(string? s)  => s != null && QueuedStatuses.Contains(s);
    private static bool IsBlocked(string? s) => s != null && BlockedStatuses.Contains(s);

    private static bool IsHighest(string? p) => p != null && (p.Equals("Highest", StringComparison.OrdinalIgnoreCase) || p.Equals("Blocker", StringComparison.OrdinalIgnoreCase));
    private static bool IsHigh(string? p)    => p != null && (p.Equals("Critical", StringComparison.OrdinalIgnoreCase) || p.Equals("High", StringComparison.OrdinalIgnoreCase));
    private static bool IsMedium(string? p)  => p != null && (p.Equals("Major", StringComparison.OrdinalIgnoreCase)    || p.Equals("Medium", StringComparison.OrdinalIgnoreCase));
    private static bool IsLow(string? p)     => p != null && (p.Equals("Minor", StringComparison.OrdinalIgnoreCase)    || p.Equals("Low", StringComparison.OrdinalIgnoreCase));
    private static bool IsLowest(string? p)  => p != null && (p.Equals("Trivial", StringComparison.OrdinalIgnoreCase)  || p.Equals("Lowest", StringComparison.OrdinalIgnoreCase));
}
