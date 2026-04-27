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

    /// <summary>All currently open bugs (not Done).</summary>
    public async Task<IEnumerable<JiraIssue>> GetOpenBugsDetailedAsync(CancellationToken ct = default)
    {
        var jql = $"project = {_config.BugProjectKey} AND issuetype = Bug AND statusCategory != Done ORDER BY priority ASC, created ASC";
        var fields = "summary,assignee,created,status,issuetype,priority,components";
        return await FetchAllAsync(jql, fields, expand: null, ct);
    }

    /// <summary>All bugs created within the date range.</summary>
    public async Task<IEnumerable<JiraIssue>> GetAllBugsInDateRangeAsync(
        DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        var jql = $"project = {_config.BugProjectKey} AND issuetype = Bug " +
                  $"AND created >= \"{startDate:yyyy-MM-dd}\" AND created < \"{endDate.AddDays(1):yyyy-MM-dd}\" " +
                  $"ORDER BY created ASC";
        var fields = "summary,assignee,created,resolutiondate,status,issuetype,priority,components";
        return await FetchAllAsync(jql, fields, expand: "changelog", ct);
    }

    /// <summary>All bugs resolved (transitioned to Done) within the date range.</summary>
    public async Task<IEnumerable<JiraIssue>> GetResolvedBugsInDateRangeAsync(
        DateTime startDate, DateTime endDate, CancellationToken ct = default)
    {
        var jql = $"project = {_config.BugProjectKey} AND issuetype = Bug AND statusCategory = Done " +
                  $"AND status changed TO \"Done\" AFTER \"{startDate:yyyy-MM-dd}\" BEFORE \"{endDate.AddDays(1):yyyy-MM-dd}\" " +
                  $"ORDER BY updated ASC";
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

    private static JiraIssue MapIssue(JiraIssueDto dto)
    {
        DateTime? created = TryParseDate(dto.Fields.Created);
        DateTime? resolutionDate = TryParseDate(dto.Fields.ResolutionDate);

        // Prefer the actual Done-transition date from changelog for accuracy
        if (dto.Changelog?.Histories != null)
        {
            var doneStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Done", "Released", "Closed" };
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
}
