import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { VelocityService } from '../../core/services/velocity.service';
import { SettingsService } from '../../core/services/settings.service';
import { SnapshotService, SnapshotFormat } from '../../core/services/snapshot.service';
import { ExportDropdownComponent } from '../../shared/components/export-dropdown/export-dropdown.component';
import { EngineeringBacklogReport, DiagnosisCard } from '../../core/models/engineering-backlog.model';

@Component({
  selector: 'app-engineering-backlog',
  standalone: true,
  imports: [CommonModule, DecimalPipe, BaseChartDirective, ExportDropdownComponent],
  template: `
    <div class="eb-container" #snapshotContainer>

      <!-- Header -->
      <header class="page-header">
        <div class="header-top">
          <div class="header-title">
            <h1>Backlog Health & Capacity Report - Data Services & Engineering</h1>
            @if (data(); as d) {
              <p class="subtitle">As of {{ d.generatedAt | date:'MMM d, yyyy' }} &bull; <strong>{{ d.totalCount }} open tickets</strong> &bull; Data Services ({{ d.dsEngineerCount }} engineers, {{ d.dsTicketCount }} tix) vs Engineering ({{ d.engEngineerCount }} engineers, {{ d.engTicketCount }} tix) &bull; {{ d.unassignedCount }} unassigned</p>
            } @else {
              <p class="subtitle">Backlog health by team, priority, and pipeline state</p>
            }
          </div>
          <div class="header-actions">
            <div class="legend">
              <span class="legend-dot ds"></span><span class="legend-label">DATA SERVICES</span>
              <span class="legend-dot eng"></span><span class="legend-label">ENGINEERING</span>
            </div>
            <app-export-dropdown [disabled]="!data()" (exportSelected)="onExport($event)" />
          </div>
        </div>
      </header>

      @if (loading()) {
        <div class="loading">Loading backlog data&hellip;</div>
      }

      @if (error()) {
        <div class="error-msg">Failed to load report. Check backend connection.</div>
      }

      @if (data(); as d) {

        <!-- ── Row 1: KPI Cards ── -->
        <section class="kpi-row">

          <div class="kpi-card">
            <span class="kpi-title">BACKLOG SIZE</span>
            <div class="kpi-pair">
              <div class="kpi-half ds">
                <span class="kpi-big">{{ d.dsAllTicketCount }}</span>
                <span class="kpi-team">DATA SVC</span>
                <span class="kpi-sub">vs ~{{ d.dsEngineerCount * 5 }} expected</span>
              </div>
              <div class="kpi-divider"></div>
              <div class="kpi-half eng">
                <span class="kpi-big">{{ d.engAllTicketCount }}</span>
                <span class="kpi-team">ENGINEERING</span>
                <span class="kpi-sub">vs ~{{ d.engEngineerCount * 5 }} expected</span>
              </div>
            </div>
            <span class="kpi-badge over">OVER</span>
            <span class="kpi-bench">Benchmark: ~5 tix/eng (healthy) &bull; *including unassigned ({{ d.unassignedCount }} total, split by request type)</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-title">TIX / ENGINEER</span>
            <div class="kpi-pair">
              <div class="kpi-half ds">
                <span class="kpi-big">{{ d.dsTixPerEngineer | number:'1.1-1' }}</span>
                <span class="kpi-team">DATA SVC</span>
                <span class="kpi-sub">{{ topDsEngineer(d) }}</span>
              </div>
              <div class="kpi-divider"></div>
              <div class="kpi-half eng">
                <span class="kpi-big">{{ d.engTixPerEngineer | number:'1.1-1' }}</span>
                <span class="kpi-team">ENGINEERING</span>
                <span class="kpi-sub">{{ topEngEngineer(d) }}</span>
              </div>
            </div>
            <span class="kpi-badge underload">UNDERLOAD</span>
            <span class="kpi-bench">Healthy band: 10–20</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-title">AVG DAYS OPEN</span>
            <div class="kpi-pair">
              <div class="kpi-half ds">
                <span class="kpi-big">{{ d.dsAvgDaysOpen | number:'1.0-0' }}</span>
                <span class="kpi-team">DATA SVC</span>
                <span class="kpi-sub">median {{ d.dsMedianDaysOpen }}</span>
              </div>
              <div class="kpi-divider"></div>
              <div class="kpi-half eng">
                <span class="kpi-big">{{ d.engAvgDaysOpen | number:'1.0-0' }}</span>
                <span class="kpi-team">ENGINEERING</span>
                <span class="kpi-sub">median {{ d.engMedianDaysOpen }}</span>
              </div>
            </div>
            <span class="kpi-badge aging">AGING</span>
            <span class="kpi-bench">Both teams: oldest &gt;100d &bull; *including unassigned</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-title">% OVER 30 DAYS</span>
            <div class="kpi-pair">
              <div class="kpi-half ds">
                <span class="kpi-big">{{ d.dsPctOver30Days | number:'1.0-0' }}%</span>
                <span class="kpi-team">DATA SVC</span>
                <span class="kpi-sub">{{ d.dsTicketsOver30 }} tix</span>
              </div>
              <div class="kpi-divider"></div>
              <div class="kpi-half eng">
                <span class="kpi-big">{{ d.engPctOver30Days | number:'1.0-0' }}%</span>
                <span class="kpi-team">ENGINEERING</span>
                <span class="kpi-sub">{{ d.engTicketsOver30 }} tix</span>
              </div>
            </div>
            <span class="kpi-badge risk">RISK</span>
            <span class="kpi-bench">Risk threshold: 20% &bull; *including unassigned</span>
          </div>

        </section>

        <!-- ── Row 2: Charts ── -->
        <section class="charts-row">

          <!-- Engineer Workload -->
          <div class="chart-panel">
            <p class="chart-title">Engineer Workload &nbsp;
              <span class="chart-subtitle ds-label">DS {{ d.dsTicketCount }} ({{ d.dsEngineerCount }} eng)</span>
              <span class="chart-subtitle eng-label" style="margin-left: 1.5rem;">ENG {{ d.engTicketCount }} ({{ d.engEngineerCount }} eng)</span>
            </p>
            @if (workloadChartData()) {
              <div class="chart-container" [style.height.px]="workloadChartHeight()">
                <canvas baseChart
                  [data]="workloadChartData()!"
                  [options]="workloadChartOptions"
                  type="bar"
                  id="chart-workload">
                </canvas>
              </div>
            }
          </div>

          <!-- Priority Mix -->
          <div class="chart-panel">
            <p class="chart-title">Priority Mix <span class="chart-subtitle">(per team)</span></p>
            @if (priorityChartData()) {
              <div class="chart-container">
                <canvas baseChart
                  [data]="priorityChartData()!"
                  [options]="priorityChartOptions"
                  type="bar"
                  id="chart-priority">
                </canvas>
              </div>
            }
            <p class="chart-note">*including unassigned</p>
          </div>

          <!-- Aging Distribution -->
          <div class="chart-panel">
            <p class="chart-title">Aging Distribution <span class="chart-subtitle">(days open)</span></p>
            @if (agingChartData()) {
              <div class="chart-container">
                <canvas baseChart
                  [data]="agingChartData()!"
                  [options]="agingChartOptions"
                  type="bar"
                  id="chart-aging">
                </canvas>
              </div>
            }
            <p class="chart-note">*including unassigned</p>
          </div>

          <!-- Pipeline State -->
          <div class="chart-panel">
            <p class="chart-title">Pipeline State <span class="chart-subtitle">(where tickets sit)</span></p>
            @if (pipelineChartData()) {
              <div class="chart-container">
                <canvas baseChart
                  [data]="pipelineChartData()!"
                  [options]="pipelineChartOptions"
                  type="bar"
                  id="chart-pipeline">
                </canvas>
              </div>
            }
            <p class="chart-note">Active = In Progress / Code Review / QA / Ready for QA / Moved to Sprint &bull; Queued = To Do / New Request / Pending &bull; Blocked = Waiting on customer or support</p>
            <p class="chart-note">*including unassigned</p>
          </div>

        </section>

        <!-- ── Row 3: Diagnosis ── -->
        <h2 class="section-heading">Diagnosis &amp; Recommended Actions</h2>
        @if (diagnosisLoading()) {
          <div class="diag-loading">
            <span class="diag-spinner"></span>
            Generating AI recommendations&hellip;
          </div>
        } @else if (diagnosisCards().length > 0) {
          <section class="diag-row">
            @for (card of diagnosisCards(); track card.team) {
              <div class="diag-card" [class.diag-ds]="card.team === 'DS'" [class.diag-eng]="card.team === 'ENG'" [class.diag-cross]="card.team === 'CROSS'">
                <span class="diag-tag" [class.ds-tag]="card.team === 'DS'" [class.eng-tag]="card.team === 'ENG'" [class.cross-tag]="card.team === 'CROSS'">
                  {{ card.team === 'DS' ? 'DATA SERVICES' : card.team === 'ENG' ? 'ENGINEERING' : 'CROSS-CUT' }}
                </span>
                <h3 class="diag-heading">{{ card.heading }}</h3>
                <p class="diag-body"><strong class="label-finding">Finding:</strong> {{ card.finding }}</p>
                <p class="diag-body"><strong class="label-action">Action:</strong> {{ card.action }}</p>
              </div>
            }
          </section>
        }

      }
    </div>
  `,
  styles: [`
    /* ── Container — matches PQR full-width approach ── */
    .eb-container { width: 100%; padding: 2rem; box-sizing: border-box; }

    /* ── Header ── */
    .page-header { margin-bottom: 1.5rem; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.75rem; }
    h1 { font-size: 1.75rem; color: var(--text-primary); margin: 0 0 0.35rem; }
    .subtitle { color: var(--text-secondary); font-size: 1rem; margin: 0; }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    @media (max-width: 600px) {
      .eb-container { padding: 1rem; }
      h1 { font-size: 1.3rem; }
      .subtitle { font-size: 0.85rem; }
    }

    .legend { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .legend-dot.ds  { background: var(--ds-color, #1e3a5f); }
    .legend-dot.eng { background: var(--eng-color, #0284c7); }
    .legend-label { color: var(--text-secondary); margin-right: 0.5rem; }

    /* ── Loading / error ── */
    .loading, .error-msg { text-align: center; padding: 3rem; color: var(--text-secondary); font-size: 1rem; }
    .error-msg { color: #f07440; }

    /* ── KPI row ── */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    @media (max-width: 1100px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px)  { .kpi-row { grid-template-columns: 1fr; } }

    .kpi-card {
      background: var(--bg-card);
      border-radius: 10px;
      box-shadow: var(--shadow);
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .kpi-title { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.06em; color: var(--text-tertiary); text-transform: uppercase; }
    .kpi-pair { display: flex; align-items: stretch; gap: 0; flex: 1; }
    .kpi-half { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 0.25rem 0; }
    .kpi-divider { width: 1px; background: var(--border); margin: 0 0.5rem; }
    .kpi-big { font-size: 2rem; font-weight: 900; line-height: 1; }
    .kpi-half.ds  .kpi-big { color: var(--ds-color, #1e3a5f); }
    .kpi-half.eng .kpi-big { color: var(--eng-color, #0284c7); }
    .kpi-team { font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; color: var(--text-tertiary); margin-top: 0.1rem; }
    .kpi-sub { font-size: 0.73rem; color: var(--text-secondary); text-align: center; }
    .kpi-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; align-self: flex-start; }
    .kpi-badge.over      { background: var(--status-amber-bg); color: var(--status-amber); }
    .kpi-badge.underload { background: var(--info-bg); color: var(--info-text); }
    .kpi-badge.aging     { background: var(--status-red-bg); color: var(--status-red); }
    .kpi-badge.risk      { background: var(--status-red-bg); color: var(--status-red); }
    .kpi-bench { font-size: 0.73rem; color: var(--text-tertiary); }

    /* ── Charts row ── */
    .charts-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    @media (max-width: 1300px) { .charts-row { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 700px)  { .charts-row { grid-template-columns: 1fr; } }

    .chart-panel {
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
    }
    .chart-title { font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.25rem; }
    .chart-desc     { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 0.75rem; }
    .chart-subtitle { font-size: 0.85rem; font-weight: 400; color: var(--text-secondary); }
    .ds-label  { color: var(--ds-color, #1e3a5f); font-weight: 700; }
    .eng-label { color: var(--eng-color, #0284c7); font-weight: 700; }
    .chart-container { position: relative; height: 280px; flex: 1; }
    .chart-note { font-size: 0.73rem; color: var(--text-tertiary); margin-top: 0.5rem; }

    /* ── Diagnosis section ── */
    .section-heading { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 1.5rem 0 1rem; }

    .diag-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.25rem;
    }
    @media (max-width: 1000px) { .diag-row { grid-template-columns: 1fr; } }

    .diag-card {
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border-top: 4px solid transparent;
    }
    .diag-ds    { border-top-color: var(--ds-color, #1e3a5f); }
    .diag-eng   { border-top-color: var(--eng-color, #0284c7); }
    .diag-cross { border-top-color: var(--status-amber, #d97706); }

    .diag-tag { display: inline-block; padding: 0.3rem 0.75rem; border-radius: 4px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; align-self: flex-start; text-transform: uppercase; }
    .ds-tag    { background: var(--ds-color, #1e3a5f);  color: #fff; }
    .eng-tag   { background: var(--eng-color, #0284c7); color: #fff; }
    .cross-tag { background: var(--status-amber, #d97706); color: #fff; }

    .diag-heading { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0; }
    .diag-body { font-size: 0.88rem; color: var(--text-secondary); margin: 0; line-height: 1.6; }
    .label-finding { color: var(--text-primary); }
    .label-action  { color: var(--status-amber, #d97706); }

    /* ── Diagnosis loading ── */
    .diag-loading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
    .diag-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid var(--border, #e5e7eb);
      border-top-color: var(--eng-color, #0284c7);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class EngineeringBacklogComponent implements OnInit {
  private readonly velocityService = inject(VelocityService);
  readonly settingsService = inject(SettingsService);
  private readonly snapshotService = inject(SnapshotService);

  @ViewChild('snapshotContainer') snapshotContainer!: ElementRef;

  data    = signal<EngineeringBacklogReport | null>(null);
  loading = signal(false);
  error   = signal(false);
  diagnosisCards = signal<DiagnosisCard[]>([]);
  diagnosisLoading = signal(false);

  // ── Chart data (computed) ─────────────────────────────────────────────────

  workloadChartData = computed<ChartData<'bar'> | null>(() => {
    const d = this.data();
    if (!d || d.engineerWorkload.length === 0) return null;
    const c = this.settingsService.chartColors();
    const ds = d.engineerWorkload.filter(e => e.team === 'DS').sort((a, b) => a.ticketCount - b.ticketCount);
    const eng = d.engineerWorkload.filter(e => e.team === 'ENG').sort((a, b) => a.ticketCount - b.ticketCount);
    const labels = [...eng.map(e => e.displayName), '', ...ds.map(e => e.displayName)];
    const data = [...eng.map(e => e.ticketCount), null as any, ...ds.map(e => e.ticketCount)];
    const colors = [...eng.map(() => c.engTeam), 'transparent', ...ds.map(() => c.dsTeam)];
    return {
      labels,
      datasets: [{
        label: 'Tickets',
        data,
        backgroundColor: colors,
        borderRadius: 3,
        datalabels: {
          display: true,
          anchor: 'end' as const,
          align: 'end' as const,
          offset: 4,
          font: { size: 11, weight: 'bold' as const },
          color: '#00205c',
          formatter: (value: any) => value ?? '',
        },
      }]
    };
  });

  workloadChartHeight = computed(() => {
    const d = this.data();
    if (!d) return 340;
    const rowCount = d.engineerWorkload.length + 1;
    return Math.max(340, rowCount * 32);
  });

  priorityChartData = computed<ChartData<'bar'> | null>(() => {
    const d = this.data();
    if (!d) return null;
    const c = this.settingsService.chartColors();
    const dl = { display: true, color: '#00205c', font: { size: 10, weight: 'bold' as const }, anchor: 'center' as const, align: 'center' as const, formatter: (v: number) => v > 0 ? v : '', textStrokeColor: '#fff', textStrokeWidth: 3 };
    return {
      labels: ['Data Services', 'Engineering'],
      datasets: [
        { label: 'Highest', data: [d.dsPriorityMix.highest, d.engPriorityMix.highest], backgroundColor: c.blocker,  stack: 'p', datalabels: dl },
        { label: 'High',    data: [d.dsPriorityMix.high,    d.engPriorityMix.high],    backgroundColor: c.critical, stack: 'p', datalabels: dl },
        { label: 'Medium',  data: [d.dsPriorityMix.medium,  d.engPriorityMix.medium],  backgroundColor: c.major,    stack: 'p', datalabels: dl },
        { label: 'Low',     data: [d.dsPriorityMix.low,     d.engPriorityMix.low],     backgroundColor: c.minor,    stack: 'p', datalabels: dl },
        { label: 'Lowest',  data: [d.dsPriorityMix.lowest,  d.engPriorityMix.lowest],  backgroundColor: c.lowest,   stack: 'p', datalabels: dl },
      ]
    };
  });

  agingChartData = computed<ChartData<'bar'> | null>(() => {
    const d = this.data();
    if (!d) return null;
    const c = this.settingsService.chartColors();
    const topDl = { display: true, color: '#00205c', font: { size: 10, weight: 'bold' as const }, anchor: 'end' as const, align: 'top' as const, formatter: (v: number) => v > 0 ? v : '' };
    return {
      labels: ['0–7', '8–30', '31–60', '60+'],
      datasets: [
        { label: 'Data Services', data: [d.dsAgingBuckets.zeroToSeven, d.dsAgingBuckets.eightToThirty, d.dsAgingBuckets.thirtyOneToSixty, d.dsAgingBuckets.sixtyPlus], backgroundColor: c.dsTeam, borderRadius: 3, datalabels: topDl },
        { label: 'Engineering',   data: [d.engAgingBuckets.zeroToSeven, d.engAgingBuckets.eightToThirty, d.engAgingBuckets.thirtyOneToSixty, d.engAgingBuckets.sixtyPlus], backgroundColor: c.engTeam, borderRadius: 3, datalabels: topDl },
      ]
    };
  });

  pipelineChartData = computed<ChartData<'bar'> | null>(() => {
    const d = this.data();
    if (!d) return null;
    const c = this.settingsService.chartColors();
    const topDl2 = { display: true, color: '#00205c', font: { size: 10, weight: 'bold' as const }, anchor: 'end' as const, align: 'top' as const, formatter: (v: number) => v > 0 ? v : '' };
    return {
      labels: ['Active', 'Queued', 'Blocked'],
      datasets: [
        { label: 'Data Services', data: [d.dsPipelineState.active, d.dsPipelineState.queued, d.dsPipelineState.blocked], backgroundColor: c.dsTeam, borderRadius: 3, datalabels: topDl2 },
        { label: 'Engineering',   data: [d.engPipelineState.active, d.engPipelineState.queued, d.engPipelineState.blocked], backgroundColor: c.engTeam, borderRadius: 3, datalabels: topDl2 },
      ]
    };
  });

  // ── Chart options ─────────────────────────────────────────────────────────

  readonly workloadChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    layout: { padding: { right: 40 } },
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { beginAtZero: true, ticks: { font: { size: 12 } } },
      y: { ticks: { font: { size: 12 }, autoSkip: false } }
    }
  };

  readonly priorityChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { stacked: true, beginAtZero: true, ticks: { font: { size: 12 } } },
      y: { stacked: true, ticks: { font: { size: 12 } } }
    }
  };

  readonly agingChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { ticks: { font: { size: 12 } } },
      y: { beginAtZero: true, ticks: { font: { size: 12 } } }
    }
  };

  readonly pipelineChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { ticks: { font: { size: 12 } } },
      y: { beginAtZero: true, ticks: { font: { size: 12 } } }
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.error.set(false);
    this.velocityService.getEngineeringBacklogReport().subscribe({
      next: d => {
        this.data.set(d);
        this.loading.set(false);
        this.loadDiagnosis();
      },
      error: () => { this.error.set(true); this.loading.set(false); }
    });
  }

  private loadDiagnosis(): void {
    this.diagnosisLoading.set(true);
    this.velocityService.getBacklogDiagnosis().subscribe({
      next: cards => { this.diagnosisCards.set(cards); this.diagnosisLoading.set(false); },
      error: () => { this.diagnosisLoading.set(false); }
    });
  }

  // ── Diagnostic helpers ────────────────────────────────────────────────────

  topDsEngineer(d: EngineeringBacklogReport): string {
    const top = d.engineerWorkload.filter(e => e.team === 'DS').sort((a, b) => b.ticketCount - a.ticketCount)[0];
    return top ? `Max: ${top.ticketCount}` : '';
  }

  topEngEngineer(d: EngineeringBacklogReport): string {
    const top = d.engineerWorkload.filter(e => e.team === 'ENG').sort((a, b) => b.ticketCount - a.ticketCount)[0];
    return top ? `Max: ${top.ticketCount}` : '';
  }

  // ── Export ────────────────────────────────────────────────────────────────

  onExport(format: SnapshotFormat): void {
    this.snapshotService.exportSnapshot({
      pageName: 'Engineering_Backlog',
      datePeriod: new Date().toISOString().split('T')[0],
      containerElement: this.snapshotContainer.nativeElement,
      chartCanvasIds: ['chart-workload', 'chart-priority', 'chart-aging', 'chart-pipeline'],
      format,
    });
  }
}
