using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ProductQualityReport.Models;

namespace ProductQualityReport.Jira;

public class JiraApiService
{
    private readonly HttpClient _httpClient;
    private readonly JiraConfiguration _config;
    private readonly ILogger<JiraApiService> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public JiraApiService(
        HttpClient httpClient,
        IOptions<JiraConfiguration> config,
        ILogger<JiraApiService> logger)
    {
        _httpClient = httpClient;
        _config = config.Value;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        _httpClient.BaseAddress = new Uri(_config.BaseUrl);
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_config.Email}:{_config.ApiToken}"));
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", auth);
        _httpClient.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>All currently open APP bugs (not Done) with issue links for clone detection.</summary>
    public async Task<IEnumerable<JiraIssue>> GetOpenBugsDetailedAsync(CancellationToken ct = default)
    {
        var jql = $"project = {_config.BugProjectKey} AND issuetype = Bug AND statusCategory != Done AND status NOT IN (\"Awaiting release\") ORDER BY priority ASC, created ASC";
        var fields = "summary,assignee,created,status,issuetype,priority,components,issuelinks";
        return await FetchAllAsync(jql, fields, expand: null, ct);
    }

    /// <summary>All APP bugs created within the date range with issue links for clone detection.</summary>
    public async Task<IEnumerable<JiraIssue>> GetAllBugsInDateRangeAsync(
        DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        var jql = $"project = {_config.BugProjectKey} AND issuetype = Bug " +
                  $"AND created >= \"{startDate:yyyy-MM-dd}\" AND created < \"{endDate.AddDays(1):yyyy-MM-dd}\" " +
                  $"ORDER BY created ASC";
        var fields = "summary,assignee,created,resolutiondate,status,issuetype,priority,components,issuelinks";
        return await FetchAllAsync(jql, fields, expand: "changelog", ct);
    }

    /// <summary>Open tickets for a single backlog source using its specific filter rules.</summary>
    public async Task<IEnumerable<JiraIssue>> GetOpenTicketsForSourceAsync(
        BacklogSource source, CancellationToken ct = default)
    {
        var statusClause = source.ExcludedStatuses.Count > 0
            ? " AND status NOT IN (" + string.Join(", ", source.ExcludedStatuses.Select(s => s.Contains(' ') ? $"\"{s}\"" : s)) + ")"
            : " AND statusCategory != Done";

        var reporterClause = source.ReporterIds.Count > 0
            ? $" AND reporter IN ({string.Join(", ", source.ReporterIds)})"
            : string.Empty;

        var createdAfterClause = source.CreatedAfter.HasValue
            ? $" AND created >= \"{source.CreatedAfter.Value:yyyy-MM-dd}\""
            : string.Empty;

        var typeClause = source.IssueTypes.Count > 0
            ? " AND type IN (" + string.Join(", ", source.IssueTypes.Select(t => t.Contains(' ') ? $"\"{t}\"" : t)) + ")"
            : string.Empty;

        var extraClauses = source.ExtraJqlClauses.Count > 0
            ? " AND " + string.Join(" AND ", source.ExtraJqlClauses)
            : string.Empty;

        var jql = $"project = {source.ProjectKey}{statusClause}{reporterClause}{createdAfterClause}{typeClause}{extraClauses}" +
                  $" ORDER BY {source.OrderBy}";

        _logger.LogInformation("Backlog JQL [{Project}]: {Jql}", source.ProjectKey, jql);
        var fields = "summary,assignee,created,status,issuetype,priority,components";
        if (!string.IsNullOrEmpty(_config.RequestTypeFieldId))
            fields += $",{_config.RequestTypeFieldId}";
        return await FetchAllAsync(jql, fields, expand: null, ct);
    }

    /// <summary>All APP bugs resolved (transitioned to Done) within the date range.</summary>
    public async Task<IEnumerable<JiraIssue>> GetResolvedBugsInDateRangeAsync(
        DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        const string closedStatuses = "\"Canceled\",\"Closed\",\"Declined\",\"Done\",\"Released\",\"Resolved\",\"Will Not Do\",\"Awaiting release\"";
        var jql = $"project = {_config.BugProjectKey} AND issuetype = Bug " +
                  $"AND status changed TO ({closedStatuses}) AFTER \"{startDate:yyyy-MM-dd}\" BEFORE \"{endDate.AddDays(1):yyyy-MM-dd}\" " +
                  $"ORDER BY updated ASC";
        var fields = "summary,assignee,created,resolutiondate,status,issuetype,priority,components,issuelinks";
        return await FetchAllAsync(jql, fields, expand: "changelog", ct);
    }

    /// <summary>CSD open bugs matching reporter filter + status exclusions.</summary>
    public async Task<IEnumerable<JiraIssue>> GetCsdOpenBugsAsync(
        BacklogSource source, CancellationToken ct = default)
    {
        var statusClause = source.ExcludedStatuses.Count > 0
            ? " AND status NOT IN (" + string.Join(", ", source.ExcludedStatuses.Select(s => s.Contains(' ') ? $"\"{s}\"" : s)) + ")"
            : " AND statusCategory != Done";
        var reporterClause = source.ReporterIds.Count > 0
            ? $" AND reporter IN ({string.Join(", ", source.ReporterIds)})"
            : string.Empty;
        var createdAfterClause = source.CreatedAfter.HasValue
            ? $" AND created >= \"{source.CreatedAfter.Value:yyyy-MM-dd}\""
            : string.Empty;
        var jql = $"project = {source.ProjectKey} AND issuetype IN (Bug, Problem){statusClause}{reporterClause}{createdAfterClause} ORDER BY status ASC, created DESC";
        _logger.LogInformation("CSD open JQL: {Jql}", jql);
        var fields = "summary,assignee,created,status,issuetype,priority,components";
        return await FetchAllAsync(jql, fields, expand: null, ct);
    }

    /// <summary>CSD bugs created within the date range (all statuses) matching reporter filter.</summary>
    public async Task<IEnumerable<JiraIssue>> GetCsdBugsInDateRangeAsync(
        BacklogSource source, DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        var reporterClause = source.ReporterIds.Count > 0
            ? $" AND reporter IN ({string.Join(", ", source.ReporterIds)})"
            : string.Empty;
        var jql = $"project = {source.ProjectKey} AND issuetype IN (Bug, Problem){reporterClause} " +
                  $"AND created >= \"{startDate:yyyy-MM-dd}\" AND created < \"{endDate.AddDays(1):yyyy-MM-dd}\" " +
                  $"ORDER BY created ASC";
        _logger.LogInformation("CSD created JQL: {Jql}", jql);
        var fields = "summary,assignee,created,resolutiondate,status,issuetype,priority,components";
        return await FetchAllAsync(jql, fields, expand: "changelog", ct);
    }

    /// <summary>CSD bugs transitioned to a resolved/closed status within the date range.</summary>
    public async Task<IEnumerable<JiraIssue>> GetCsdResolvedBugsInDateRangeAsync(
        BacklogSource source, DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        var reporterClause = source.ReporterIds.Count > 0
            ? $" AND reporter IN ({string.Join(", ", source.ReporterIds)})"
            : string.Empty;
        var resolvedStatuses = source.ExcludedStatuses.Count > 0
            ? string.Join(", ", source.ExcludedStatuses.Select(s => $"\"{s}\""))
            : "\"Done\"";
        var jql = $"project = {source.ProjectKey} AND issuetype IN (Bug, Problem){reporterClause} " +
                  $"AND status changed TO ({resolvedStatuses}) AFTER \"{startDate:yyyy-MM-dd}\" BEFORE \"{endDate.AddDays(1):yyyy-MM-dd}\" " +
                  $"ORDER BY updated ASC";
        _logger.LogInformation("CSD resolved JQL: {Jql}", jql);
        var fields = "summary,assignee,created,resolutiondate,status,issuetype,priority,components";
        return await FetchAllAsync(jql, fields, expand: "changelog", ct);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private async Task<List<JiraIssue>> FetchAllAsync(
        string jql, string fields, string? expand, CancellationToken ct)
    {
        var allIssues = new List<JiraIssue>();
        string? nextPageToken = null;

        do
        {
            var url = BuildSearchUrl(jql, fields, nextPageToken, expand);
            var response = await _httpClient.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Jira API error {Status}: {Body}", response.StatusCode, body);
                throw new HttpRequestException($"Jira API {response.StatusCode}: {body}");
            }

            var result = await response.Content.ReadFromJsonAsync<JiraSearchResponse>(_jsonOptions, ct);
            if (result?.Issues != null)
                allIssues.AddRange(result.Issues.Select(MapIssue));

            nextPageToken = result?.NextPageToken;
        } while (!string.IsNullOrEmpty(nextPageToken));

        return allIssues;
    }

    private static string BuildSearchUrl(string jql, string fields, string? nextPageToken, string? expand)
    {
        var url = $"/rest/api/3/search/jql?jql={Uri.EscapeDataString(jql)}&fields={fields}&maxResults=100";
        if (!string.IsNullOrEmpty(expand)) url += $"&expand={expand}";
        if (!string.IsNullOrEmpty(nextPageToken)) url += $"&nextPageToken={nextPageToken}";
        return url;
    }

    private JiraIssue MapIssue(JiraIssueDto dto)
    {
        DateTime? created = TryParseDate(dto.Fields.Created);
        DateTime? resolutionDate = TryParseDate(dto.Fields.ResolutionDate);

        // Prefer the actual Done-transition date from changelog for accuracy
        if (dto.Changelog?.Histories != null)
        {
            var doneStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Done", "Released", "Closed", "Resolved", "Canceled", "Declined", "Will Not Do", "Awaiting release" };
            var lastDone = dto.Changelog.Histories
                .Where(h => h.Items.Any(i =>
                    i.Field.Equals("status", StringComparison.OrdinalIgnoreCase) &&
                    doneStatuses.Contains(i.ToValue ?? "")))
                .OrderByDescending(h => h.Created)
                .FirstOrDefault();

            if (lastDone != null && TryParseDate(lastDone.Created) is { } t)
                resolutionDate = t;
        }

        var components = new List<string>();
        if (dto.Fields.AdditionalFields != null &&
            dto.Fields.AdditionalFields.TryGetValue("components", out var compVal))
            components = ExtractComponentNames(compVal);

        // Extract clone link: APP ticket outward "Clones" → CSD ticket
        var linkedCsdKey = dto.Fields.IssueLinks
            ?.FirstOrDefault(l =>
                l.Type?.Name.Equals("Clones", StringComparison.OrdinalIgnoreCase) == true &&
                l.OutwardIssue?.Key.StartsWith("CSD-", StringComparison.OrdinalIgnoreCase) == true)
            ?.OutwardIssue?.Key;

        string? requestType = null;
        if (!string.IsNullOrEmpty(_config.RequestTypeFieldId) &&
            dto.Fields.AdditionalFields?.TryGetValue(_config.RequestTypeFieldId, out var rtVal) == true)
        {
            requestType = ExtractRequestTypeName(rtVal);
        }

        return new JiraIssue
        {
            Id = dto.Id,
            Key = dto.Key,
            Summary = dto.Fields.Summary,
            Created = created,
            ResolutionDate = resolutionDate,
            Status = dto.Fields.Status?.Name ?? string.Empty,
            IssueType = dto.Fields.IssueType?.Name ?? string.Empty,
            Priority = dto.Fields.Priority?.Name ?? "None",
            Components = components,
            Assignee = dto.Fields.Assignee?.DisplayName,
            AssigneeAccountId = dto.Fields.Assignee?.AccountId,
            LinkedCsdKey = linkedCsdKey,
            RequestType = requestType,
        };
    }

    private static DateTime? TryParseDate(string? value) =>
        !string.IsNullOrEmpty(value) && DateTime.TryParse(value, out var d) ? d : null;

    private static List<string> ExtractComponentNames(object? value)
    {
        var names = new List<string>();
        if (value is JsonElement el && el.ValueKind == JsonValueKind.Array)
            foreach (var item in el.EnumerateArray())
                if (item.TryGetProperty("name", out var n) && n.GetString() is { } name)
                    names.Add(name);
        return names;
    }

    private static string? ExtractRequestTypeName(object? value)
    {
        if (value is not JsonElement el) return null;
        if (el.ValueKind == JsonValueKind.String) return el.GetString();
        if (el.TryGetProperty("requestType", out var rt) && rt.TryGetProperty("name", out var rtn))
            return rtn.GetString();
        if (el.TryGetProperty("name", out var n))
            return n.GetString();
        if (el.TryGetProperty("value", out var v))
            return v.GetString();
        return null;
    }
}
