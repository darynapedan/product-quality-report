namespace ProductQualityReport.Models;

public class EngineeringBacklogReport
{
    public string GeneratedAt { get; set; } = string.Empty;
    public string JiraBaseUrl { get; set; } = string.Empty;

    // KPIs
    public int DsTicketCount { get; set; }
    public int EngTicketCount { get; set; }
    public int DsAllTicketCount { get; set; }
    public int EngAllTicketCount { get; set; }
    public int UnassignedCount { get; set; }
    public int TotalCount { get; set; }
    public int DsEngineerCount { get; set; }
    public int EngEngineerCount { get; set; }
    public double DsTixPerEngineer { get; set; }
    public double EngTixPerEngineer { get; set; }
    public double DsAvgDaysOpen { get; set; }
    public double EngAvgDaysOpen { get; set; }
    public int DsMedianDaysOpen { get; set; }
    public int EngMedianDaysOpen { get; set; }
    public double DsPctOver30Days { get; set; }
    public double EngPctOver30Days { get; set; }
    public int DsTicketsOver30 { get; set; }
    public int EngTicketsOver30 { get; set; }

    // Charts
    public List<EngineerWorkloadItem> EngineerWorkload { get; set; } = new();
    public TeamPriorityMix DsPriorityMix { get; set; } = new();
    public TeamPriorityMix EngPriorityMix { get; set; } = new();
    public AgingBuckets DsAgingBuckets { get; set; } = new();
    public AgingBuckets EngAgingBuckets { get; set; } = new();
    public PipelineState DsPipelineState { get; set; } = new();
    public PipelineState EngPipelineState { get; set; } = new();

    // Diagnostic raw numbers
    public int DsBlockedCount { get; set; }
    public int EngInProgressCount { get; set; }
    public int EngNewUntouched { get; set; }

}

public class DiagnosisCard
{
    public string Team { get; set; } = string.Empty; // "DS", "ENG", or "CROSS"
    public string Heading { get; set; } = string.Empty;
    public string Finding { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
}

public class EngineerWorkloadItem
{
    public string DisplayName { get; set; } = string.Empty;
    public string Team { get; set; } = string.Empty; // "DS" or "ENG"
    public int TicketCount { get; set; }
}

public class TeamPriorityMix
{
    public int Highest { get; set; }
    public int High { get; set; }
    public int Medium { get; set; }
    public int Low { get; set; }
    public int Lowest { get; set; }
}

public class AgingBuckets
{
    public int ZeroToSeven { get; set; }
    public int EightToThirty { get; set; }
    public int ThirtyOneToSixty { get; set; }
    public int SixtyPlus { get; set; }
}

public class PipelineState
{
    public int Active { get; set; }
    public int Queued { get; set; }
    public int Blocked { get; set; }
}
