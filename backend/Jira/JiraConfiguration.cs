namespace ProductQualityReport.Jira;

public class JiraConfiguration
{
    public const string SectionName = "Jira";

    public string BaseUrl { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ApiToken { get; set; } = string.Empty;
    /// <summary>The Jira project key where bugs are tracked by the Product Quality report.</summary>
    public string BugProjectKey { get; set; } = "APP";
    /// <summary>Jira display names of Data Services team members.</summary>
    public List<string> DataServicesAssignees { get; set; } = new();
    /// <summary>Jira custom field ID for request type (e.g. "customfield_10026").</summary>
    public string RequestTypeFieldId { get; set; } = string.Empty;
    /// <summary>Request type values that identify Data Services tickets.</summary>
    public List<string> DataServicesRequestTypes { get; set; } = new();
    public int DataServicesEngineerCount { get; set; } = 3;
    public Dictionary<string, string> DisplayNameOverrides { get; set; } = new();
    /// <summary>Per-project ticket sources for the Engineering Backlog report.</summary>
    public List<BacklogSource> BacklogSources { get; set; } = new();
}

/// <summary>
/// Defines how to fetch open tickets from a single Jira project for the backlog report.
/// </summary>
public class BacklogSource
{
    public string ProjectKey { get; set; } = string.Empty;
    /// <summary>
    /// Status names to exclude. When non-empty, uses "status NOT IN (...)" instead of "statusCategory != Done".
    /// </summary>
    public List<string> ExcludedStatuses { get; set; } = new();
    /// <summary>
    /// Jira account IDs to filter by reporter. Empty = no reporter filter.
    /// </summary>
    public List<string> ReporterIds { get; set; } = new();
    /// <summary>
    /// Optional lower bound for the created date on open-ticket queries (e.g. "2026-01-01").
    /// </summary>
    public DateTime? CreatedAfter { get; set; }
    /// <summary>
    /// Issue type names to include. Empty = no type filter.
    /// </summary>
    public List<string> IssueTypes { get; set; } = new();
    /// <summary>
    /// Additional raw JQL clauses appended as "AND &lt;clause&gt;".
    /// </summary>
    public List<string> ExtraJqlClauses { get; set; } = new();
    /// <summary>
    /// Custom ORDER BY clause. Default: "priority ASC, created ASC".
    /// </summary>
    public string OrderBy { get; set; } = "priority ASC, created ASC";
}
