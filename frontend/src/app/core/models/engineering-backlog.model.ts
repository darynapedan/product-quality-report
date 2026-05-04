export interface EngineeringBacklogReport {
  generatedAt: string;
  jiraBaseUrl: string;

  // KPIs
  dsTicketCount: number;
  engTicketCount: number;
  dsAllTicketCount: number;
  engAllTicketCount: number;
  unassignedCount: number;
  totalCount: number;
  dsEngineerCount: number;
  engEngineerCount: number;
  dsTixPerEngineer: number;
  engTixPerEngineer: number;
  dsAvgDaysOpen: number;
  engAvgDaysOpen: number;
  dsMedianDaysOpen: number;
  engMedianDaysOpen: number;
  dsPctOver30Days: number;
  engPctOver30Days: number;
  dsTicketsOver30: number;
  engTicketsOver30: number;

  // Charts
  engineerWorkload: EngineerWorkloadItem[];
  dsPriorityMix: TeamPriorityMix;
  engPriorityMix: TeamPriorityMix;
  dsAgingBuckets: AgingBuckets;
  engAgingBuckets: AgingBuckets;
  dsPipelineState: PipelineState;
  engPipelineState: PipelineState;

  // Diagnostics
  dsBlockedCount: number;
  engInProgressCount: number;
  engNewUntouched: number;

}

export interface DiagnosisCard {
  team: 'DS' | 'ENG' | 'CROSS';
  heading: string;
  finding: string;
  action: string;
}

export interface EngineerWorkloadItem {
  displayName: string;
  team: 'DS' | 'ENG';
  ticketCount: number;
}

export interface TeamPriorityMix {
  highest: number;
  high: number;
  medium: number;
  low: number;
  lowest: number;
}

export interface AgingBuckets {
  zeroToSeven: number;
  eightToThirty: number;
  thirtyOneToSixty: number;
  sixtyPlus: number;
}

export interface PipelineState {
  active: number;
  queued: number;
  blocked: number;
}
