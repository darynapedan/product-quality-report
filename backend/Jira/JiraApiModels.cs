using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProductQualityReport.Jira;

public class JiraSearchResponse
{
    [JsonPropertyName("issues")]
    public List<JiraIssueDto> Issues { get; set; } = new();

    [JsonPropertyName("nextPageToken")]
    public string? NextPageToken { get; set; }
}

public class JiraIssueDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    [JsonPropertyName("fields")]
    public JiraIssueFields Fields { get; set; } = new();

    [JsonPropertyName("changelog")]
    public JiraChangelogDto? Changelog { get; set; }
}

public class JiraIssueFields
{
    [JsonPropertyName("summary")]
    public string Summary { get; set; } = string.Empty;

    [JsonPropertyName("assignee")]
    public JiraUserDto? Assignee { get; set; }

    [JsonPropertyName("created")]
    public string? Created { get; set; }

    [JsonPropertyName("resolutiondate")]
    public string? ResolutionDate { get; set; }

    [JsonPropertyName("status")]
    public JiraStatusDto? Status { get; set; }

    [JsonPropertyName("issuetype")]
    public JiraIssueTypeDto? IssueType { get; set; }

    [JsonPropertyName("priority")]
    public JiraPriorityDto? Priority { get; set; }

    [JsonPropertyName("issuelinks")]
    public List<JiraIssueLinkDto>? IssueLinks { get; set; }

    [JsonExtensionData]
    public Dictionary<string, object>? AdditionalFields { get; set; }
}

public class JiraIssueLinkDto
{
    [JsonPropertyName("type")]
    public JiraLinkTypeDto? Type { get; set; }

    [JsonPropertyName("outwardIssue")]
    public JiraLinkedIssueDto? OutwardIssue { get; set; }

    [JsonPropertyName("inwardIssue")]
    public JiraLinkedIssueDto? InwardIssue { get; set; }
}

public class JiraLinkTypeDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("outward")]
    public string Outward { get; set; } = string.Empty;

    [JsonPropertyName("inward")]
    public string Inward { get; set; } = string.Empty;
}

public class JiraLinkedIssueDto
{
    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;
}

public class JiraUserDto
{
    [JsonPropertyName("accountId")]
    public string AccountId { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    [JsonPropertyName("emailAddress")]
    public string? EmailAddress { get; set; }

    [JsonPropertyName("avatarUrls")]
    public JiraAvatarUrls? AvatarUrls { get; set; }
}

public class JiraAvatarUrls
{
    [JsonPropertyName("24x24")]
    public string? Medium { get; set; }
}

public class JiraStatusDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class JiraIssueTypeDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class JiraPriorityDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class JiraChangelogDto
{
    [JsonPropertyName("histories")]
    public List<JiraHistoryDto> Histories { get; set; } = new();
}

public class JiraHistoryDto
{
    [JsonPropertyName("created")]
    public string Created { get; set; } = string.Empty;

    [JsonPropertyName("items")]
    public List<JiraHistoryItemDto> Items { get; set; } = new();
}

public class JiraHistoryItemDto
{
    [JsonPropertyName("field")]
    public string Field { get; set; } = string.Empty;

    [JsonPropertyName("fromString")]
    public string? FromString { get; set; }

    [JsonPropertyName("toString")]
    public string? ToValue { get; set; }
}
