namespace ProductQualityReport.Models;

public class JiraIssue
{
    public string Id { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public DateTime? Created { get; set; }
    public DateTime? ResolutionDate { get; set; }
    public string? Status { get; set; }
    public string? IssueType { get; set; }
    public string? Priority { get; set; }
    public List<string> Components { get; set; } = new();
    public string? Assignee { get; set; }
    public string? AssigneeAccountId { get; set; }
    public string? LinkedCsdKey { get; set; }
    public string? RequestType { get; set; }
}
