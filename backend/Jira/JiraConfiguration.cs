namespace ProductQualityReport.Jira;

public class JiraConfiguration
{
    public const string SectionName = "Jira";

    public string BaseUrl { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ApiToken { get; set; } = string.Empty;
    /// <summary>The Jira project key where bugs are tracked (e.g. "APP").</summary>
    public string BugProjectKey { get; set; } = "APP";
}
