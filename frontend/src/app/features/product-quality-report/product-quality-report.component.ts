import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { VelocityService } from '../../core/services/velocity.service';
import { SettingsService } from '../../core/services/settings.service';
import { SnapshotService, SnapshotFormat } from '../../core/services/snapshot.service';
import { ExportDropdownComponent } from '../../shared/components/export-dropdown/export-dropdown.component';
import { ProductQualityMonthlyReport } from '../../core/models/product-quality-report.model';

@Component({
  selector: 'app-product-quality-report',
  standalone: true,
  imports: [CommonModule, DecimalPipe, BaseChartDirective, ExportDropdownComponent],
  template: `
    <div class="pqr-container" #snapshotContainer>

      <!-- Header -->
      <header class="page-header">
        <div class="header-top">
          <h1>Product Quality Report: {{ pageTitle() }}</h1>
          <app-export-dropdown [disabled]="!data()" (exportSelected)="onExport($event)" />
        </div>
        <p class="subtitle">Bug trends, backlog health, and SLA compliance</p>
      </header>

      <!-- Date range filter -->
      <section class="date-config">
        <div class="config-row">
          <div class="date-inputs">
            <label>
              Start Date
              <input type="date" [value]="fmtDate(dateRange().start)" (change)="onStartChange($event)">
            </label>
            <label>
              End Date
              <input type="date" [value]="fmtDate(dateRange().end)" (change)="onEndChange($event)">
            </label>
          </div>
          <button class="btn-primary" (click)="loadData()">Update</button>
        </div>
      </section>

      @if (loading()) {
        <div class="loading">Loading report data&hellip;</div>
      }

      @if (error()) {
        <div class="error-msg">Failed to load report. Check backend connection.</div>
      }

      @if (data(); as d) {

        <!-- ── Row 1: KPI Cards ── -->
        <section class="kpi-row">
          <div class="kpi-card">
            <span class="kpi-label">Total Reported</span>
            <span class="kpi-value">{{ d.totalReportedMtd }}</span>
            <span class="kpi-change" [class.down]="d.totalReportedMtdChangePct < 0" [class.up]="d.totalReportedMtdChangePct > 0">
              {{ d.totalReportedMtdChangePct > 0 ? '▲' : '▼' }}{{ d.totalReportedMtdChangePct | number:'1.1-1' }}%
              vs {{ d.threeMonthAvgTotal | number:'1.1-1' }} (3-Mth Avg)
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Blockers Reported</span>
            <span class="kpi-value">{{ d.blockersReportedMtd }}</span>
            <span class="kpi-change" [class.down]="d.blockersReportedMtdChangePct < 0" [class.up]="d.blockersReportedMtdChangePct > 0">
              {{ d.blockersReportedMtdChangePct > 0 ? '▲' : '▼' }}{{ d.blockersReportedMtdChangePct | number:'1.1-1' }}%
              vs {{ d.threeMonthAvgBlockers | number:'1.1-1' }} (3-Mth Avg)
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Criticals Reported</span>
            <span class="kpi-value">{{ d.criticalsReportedMtd }}</span>
            <span class="kpi-change" [class.down]="d.criticalsReportedMtdChangePct < 0" [class.up]="d.criticalsReportedMtdChangePct > 0">
              {{ d.criticalsReportedMtdChangePct > 0 ? '▲' : '▼' }}{{ d.criticalsReportedMtdChangePct | number:'1.1-1' }}%
              vs {{ d.threeMonthAvgCriticals | number:'1.1-1' }} (3-Mth Avg)
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total Resolved (vs Reported)</span>
            <span class="kpi-value pct">{{ d.totalResolvedPct | number:'1.1-1' }}%</span>
            <span class="kpi-change" [class.down]="d.totalResolvedChangePct > 0" [class.up]="d.totalResolvedChangePct < 0">
              {{ d.totalResolvedChangePct > 0 ? '▲' : '▼' }}{{ d.totalResolvedChangePct | number:'1.1-1' }}%
              vs {{ d.prevPeriodTotalResolvedPct | number:'1.1-1' }}% (Prev 30 Days)
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Blockers Resolved (vs Reported)</span>
            <span class="kpi-value pct">{{ d.blockersResolvedPct | number:'1.1-1' }}%</span>
            <span class="kpi-change" [class.down]="d.blockersResolvedChangePct > 0" [class.up]="d.blockersResolvedChangePct < 0">
              {{ d.blockersResolvedChangePct !== 0 ? (d.blockersResolvedChangePct > 0 ? '▲' : '▼') : '' }}{{ d.blockersResolvedChangePct | number:'1.1-1' }}%
              vs {{ d.prevPeriodBlockersResolvedPct | number:'1.1-1' }}% (Prev 30 Days)
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Criticals Resolved (vs Reported)</span>
            <span class="kpi-value pct">{{ d.criticalsResolvedPct | number:'1.1-1' }}%</span>
            <span class="kpi-change" [class.down]="d.criticalsResolvedChangePct > 0" [class.up]="d.criticalsResolvedChangePct < 0">
              {{ d.criticalsResolvedChangePct !== 0 ? (d.criticalsResolvedChangePct > 0 ? '▲' : '▼') : '' }}{{ d.criticalsResolvedChangePct | number:'1.1-1' }}%
              vs {{ d.prevPeriodCriticalsResolvedPct | number:'1.1-1' }}% (Prev 30 Days)
            </span>
          </div>
        </section>

        <!-- ── Row 2: Charts ── -->
        <section class="charts-row">
          <div class="chart-panel">
            <h2 class="chart-title">Production Reported Bugs by Month</h2>
            <p class="chart-desc">Client and Internal &middot; Blocker / Critical / Major / Minor</p>
            @if (monthlyChartData(); as chart) {
              <div class="chart-container">
                <canvas id="monthly-bugs-chart" baseChart [data]="chart" [options]="monthlyChartOptions()" type="bar"></canvas>
              </div>
            }
          </div>

          <div class="chart-panel">
            <h2 class="chart-title">Week-to-Week Comparison</h2>
            <p class="chart-desc">Running total of open bugs per week within the selected period</p>
            @if (weekToWeekChartData(); as chart) {
              <div class="chart-container">
                <canvas id="week-to-week-chart" baseChart [data]="chart" [options]="weekToWeekChartOptions()" type="line"></canvas>
              </div>
            }
          </div>

          <div class="chart-panel">
            <h2 class="chart-title">Bug Backlog Growth</h2>
            <p class="chart-desc">Open Critical &amp; Major bugs over the last 8 months</p>
            @if (backlogChartData(); as chart) {
              <div class="chart-container">
                <canvas id="backlog-growth-chart" baseChart [data]="chart" [options]="backlogChartOptions" type="line"></canvas>
              </div>
            }
          </div>
        </section>

        <!-- ── Row 3: Tables ── -->
        <section class="tables-row">
          <div class="tables-left-group">

          <!-- Current Month single bar -->
          <div class="chart-panel current-month-panel">
            <h2 class="chart-title">Current Month</h2>
            @if (currentMonthChartData(); as chart) {
              <div class="chart-container current-month-chart">
                <canvas id="current-month-chart" baseChart [data]="chart" [options]="currentMonthChartOptions()" type="bar"></canvas>
              </div>
            }
          </div>

          <!-- SLA table -->
          <div class="table-panel sla-panel">
            <h2 class="table-title">Bugs Out of SLA</h2>
            <table class="sla-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>&lt; 30 days</th>
                  <th>30–60 days</th>
                  <th>60–90 days</th>
                  <th>&gt; 90 days</th>
                  <th>Avg Days</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="severity-cell critical">Critical</td>
                  <td>{{ d.criticalSla.lt30 }}</td>
                  <td [class.sla-warn]="d.criticalSla.bt3060 > 0">{{ d.criticalSla.bt3060 }}</td>
                  <td [class.sla-warn]="d.criticalSla.bt6090 > 0">{{ d.criticalSla.bt6090 }}</td>
                  <td [class.sla-crit]="d.criticalSla.gt90 > 0">{{ d.criticalSla.gt90 }}</td>
                  <td class="avg-days">{{ d.criticalSla.avgDaysOutstanding | number:'1.1-1' }}</td>
                </tr>
                <tr>
                  <td class="severity-cell major">Major</td>
                  <td>{{ d.majorSla.lt30 }}</td>
                  <td [class.sla-warn]="d.majorSla.bt3060 > 0">{{ d.majorSla.bt3060 }}</td>
                  <td [class.sla-warn]="d.majorSla.bt6090 > 0">{{ d.majorSla.bt6090 }}</td>
                  <td [class.sla-crit]="d.majorSla.gt90 > 0">{{ d.majorSla.gt90 }}</td>
                  <td class="avg-days">{{ d.majorSla.avgDaysOutstanding | number:'1.1-1' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Critical / Blocker list -->
          <div class="table-panel critblocker-panel">
            <h2 class="table-title">Open Jira tickets &mdash; Critical or Blockers</h2>
            @if (sortedCriticalBlockerTickets().length === 0) {
              <p class="empty-list">No open critical or blocker tickets.</p>
            } @else {
              <div class="ticket-table-wrap">
                <table class="ticket-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Summary</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Days Open</th>
                      <th>Component</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of sortedCriticalBlockerTickets(); track t.key) {
                      <tr [class.blocker-row]="t.priority === 'Blocker' || t.priority === 'Highest'"
                          [class.critical-row]="t.priority === 'Critical' || t.priority === 'High'">
                        <td><a [href]="t.jiraUrl" target="_blank" rel="noopener" class="ticket-key">{{ t.key }}</a></td>
                        <td class="summary-cell" [title]="t.summary">{{ t.summary }}</td>
                        <td><span class="priority-badge" [attr.data-p]="t.priority.toLowerCase()">{{ t.priority }}</span></td>
                        <td>{{ t.status }}</td>
                        <td [class.age-warn]="t.daysOpen >= 30" [class.age-crit]="t.daysOpen >= 90">{{ t.daysOpen }}d</td>
                        <td>{{ t.component || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          </div>

          <!-- Major list -->
          <div class="table-panel">
            <h2 class="table-title">Open Jira tickets &mdash; Majors</h2>
            @if (d.majorTickets.length === 0) {
              <p class="empty-list">No open major tickets.</p>
            } @else {
              <div class="ticket-table-wrap">
                <table class="ticket-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Summary</th>
                      <th>Status</th>
                      <th>Days Open</th>
                      <th>Component</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of d.majorTickets; track t.key) {
                      <tr>
                        <td><a [href]="t.jiraUrl" target="_blank" rel="noopener" class="ticket-key">{{ t.key }}</a></td>
                        <td class="summary-cell" [title]="t.summary">{{ t.summary }}</td>
                        <td>{{ t.status }}</td>
                        <td [class.age-warn]="t.daysOpen >= 30" [class.age-crit]="t.daysOpen >= 90">{{ t.daysOpen }}d</td>
                        <td>{{ t.component || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </section>

      }
    </div>
  `,
  styles: [`
    /* Full-width, edge-to-edge layout */
    .pqr-container { width: 100%; padding: 2rem; box-sizing: border-box; }

    /* Header */
    .page-header { margin-bottom: 1.5rem; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    h1 { font-size: 1.75rem; color: var(--text-primary); margin: 0 0 0.35rem; }
    .subtitle { color: var(--text-secondary); font-size: 1rem; margin: 0; }

    /* Date filter bar */
    .date-config { background: var(--bg-card); padding: 1rem 1.5rem; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 1.5rem; }
    .config-row { display: flex; gap: 2rem; align-items: flex-end; flex-wrap: wrap; }
    .date-inputs { display: flex; gap: 1rem; }
    .date-inputs label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--text-secondary); }
    .date-inputs input { padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-input); color: var(--text-primary); font-size: 0.9rem; }
    .btn-primary { padding: 0.6rem 1.4rem; background: var(--accent-gradient); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.9rem; }
    .btn-primary:hover { opacity: 0.9; }

    .loading, .error-msg { text-align: center; padding: 3rem; color: var(--text-secondary); font-size: 1rem; }
    .error-msg { color: #ef4444; }

    /* ── KPI Row ── */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    @media (max-width: 1400px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px)  { .kpi-row { grid-template-columns: repeat(2, 1fr); } }

    .kpi-card {
      background: var(--bg-card);
      border-radius: 10px;
      box-shadow: var(--shadow);
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .kpi-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; line-height: 1.3; }
    .kpi-value { font-size: 2.2rem; font-weight: 900; color: var(--text-primary); line-height: 1.1; }
    .kpi-value.pct { font-size: 1.8rem; color: var(--text-primary); }
    .kpi-change { font-size: 0.73rem; font-weight: 600; color: var(--text-tertiary); line-height: 1.4; }
    .kpi-change.down { color: #22c55e; }
    .kpi-change.up   { color: #ef4444; }

    /* ── Charts Row ── */
    .charts-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .charts-row .chart-panel { grid-column: span 2; }
    @media (max-width: 1200px) { .charts-row { grid-template-columns: 1fr; }  .charts-row .chart-panel { grid-column: span 1; } }

    .chart-panel {
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .chart-title { font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.25rem; }
    .chart-desc  { font-size: 0.73rem; color: var(--text-secondary); margin: 0 0 0.75rem; }
    .chart-container { position: relative; height: 350px; flex: 1; overflow: hidden; }

    /* ── Tables Row ── */
    .tables-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 1200px) { .tables-row { grid-template-columns: 1fr; } }

    .tables-left-group { display: grid; grid-template-columns: 400px 1fr; grid-template-rows: auto auto; gap: 1rem; align-items: start; }
    .current-month-panel { grid-column: 1; grid-row: 1 / -1; align-self: stretch; }
    .current-month-chart { height: auto; }
    .sla-panel { grid-column: 2; grid-row: 1; min-height: auto; padding: 0.6rem 1rem; }
    .sla-panel .table-title { margin-bottom: 0.4rem; }
    .critblocker-panel { grid-column: 2; grid-row: 2; }

    .table-col-stack { display: flex; flex-direction: column; gap: 1rem; }

    .table-panel {
      background: var(--bg-card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
    }
    .table-title { font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.85rem; }
    .empty-list  { color: var(--text-tertiary); font-size: 0.88rem; }

    /* Ticket tables */
    .ticket-table-wrap { overflow-x: auto; flex: 1; }
    .ticket-table { width: 100%; border-collapse: collapse; font-size: 0.77rem; }
    .ticket-table th {
      background: var(--bg-hover);
      color: var(--text-secondary);
      font-weight: 600;
      padding: 0.4rem 0.5rem;
      text-align: left;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
    }
    .ticket-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .ticket-table tr:last-child td { border-bottom: none; }
    .ticket-table tr:hover td { background: var(--bg-hover); }

    .summary-cell { max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ticket-key { color: var(--accent-blue); text-decoration: none; font-weight: 600; font-family: monospace; white-space: nowrap; }
    .ticket-key:hover { text-decoration: underline; }

    .priority-badge {
      display: inline-block;
      padding: 0.12rem 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      background: var(--bg-hover);
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .priority-badge[data-p="blocker"],
    .priority-badge[data-p="highest"] { background: #dc2626; color: #fff; }
    .priority-badge[data-p="critical"],
    .priority-badge[data-p="high"]    { background: #ea580c; color: #fff; }
    .priority-badge[data-p="medium"]  { background: #ca8a04; color: #fff; }

    .age-warn { color: #eab308; font-weight: 700; }
    .age-crit { color: #ef4444; font-weight: 700; }

    .blocker-row td:first-child  { border-left: 3px solid #dc2626; }
    .critical-row td:first-child { border-left: 3px solid #ea580c; }

    /* SLA table */
    .sla-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .sla-table th {
      background: var(--bg-hover);
      color: var(--text-secondary);
      font-weight: 600;
      padding: 0.45rem 0.6rem;
      text-align: center;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .sla-table th:first-child { text-align: left; }
    .sla-table td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--border); text-align: center; }
    .sla-table td:first-child { text-align: left; }
    .sla-table tr:last-child td { border-bottom: none; }

    .severity-cell { font-weight: 700; }
    .severity-cell.critical { color: #ea580c; }
    .severity-cell.major    { color: #ca8a04; }

    .sla-warn { color: #eab308; font-weight: 700; }
    .sla-crit { color: #ef4444; font-weight: 700; }
    .avg-days { font-weight: 700; color: var(--text-primary); }

  `]
})
export class ProductQualityReportComponent implements OnInit {
  private readonly velocityService = inject(VelocityService);
  private readonly settingsService = inject(SettingsService);
  private readonly snapshotService = inject(SnapshotService);

  @ViewChild('snapshotContainer', { static: false }) snapshotContainer!: ElementRef<HTMLElement>;

  dateRange = signal(this.initDateRange());
  data = signal<ProductQualityMonthlyReport | null>(null);
  loading = signal(false);
  error = signal(false);

  private initDateRange(): { start: Date; end: Date } {
    const stored = this.settingsService.getPageDates('product-quality-report');
    if (stored) return stored;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  }

  pageTitle = computed(() => {
    const { start, end } = this.dateRange();
    const fmt = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };
    return `${fmt(start)} - ${fmt(end)}`;
  });

  // ── Sorted ticket lists ──

  sortedCriticalBlockerTickets = computed(() => {
    const d = this.data();
    if (!d) return [];
    const priorityRank = (p: string) => (p === 'Blocker' || p === 'Highest') ? 0 : 1;
    return [...d.criticalAndBlockerTickets].sort((a, b) => {
      const pDiff = priorityRank(a.priority) - priorityRank(b.priority);
      if (pDiff !== 0) return pDiff;
      return b.daysOpen - a.daysOpen;
    });
  });

  // ── Chart computed signals ──

  currentMonthChartData = computed<ChartData<'bar'> | null>(() => {
    const d = this.data();
    if (!d || d.monthlyBugsByMonth.length === 0) return null;
    const current = d.monthlyBugsByMonth[d.monthlyBugsByMonth.length - 1];
    return {
      labels: [current.monthLabel],
      datasets: [
        { label: 'Minor',    data: [current.minor],    backgroundColor: '#81bc01', stack: 'bugs' },
        { label: 'Major',    data: [current.major],    backgroundColor: '#fbd34c', stack: 'bugs' },
        { label: 'Critical', data: [current.critical], backgroundColor: '#ef9644', stack: 'bugs' },
        { label: 'Blocker',  data: [current.blocker],  backgroundColor: '#c8502a', stack: 'bugs' },
      ]
    };
  });

  monthlyChartData = computed<ChartData<'bar'> | null>(() => {
    const d = this.data();
    if (!d || d.monthlyBugsByMonth.length === 0) return null;
    return {
      labels: d.monthlyBugsByMonth.map(m => m.monthLabel),
      datasets: [
        { label: 'Minor',    data: d.monthlyBugsByMonth.map(m => m.minor),    backgroundColor: '#81bc01', stack: 'bugs' },
        { label: 'Major',    data: d.monthlyBugsByMonth.map(m => m.major),    backgroundColor: '#fbd34c', stack: 'bugs' },
        { label: 'Critical', data: d.monthlyBugsByMonth.map(m => m.critical), backgroundColor: '#ef9644', stack: 'bugs' },
        { label: 'Blocker',  data: d.monthlyBugsByMonth.map(m => m.blocker),  backgroundColor: '#c8502a', stack: 'bugs',
          datalabels: {
            display: true,
            color: '#00205c', font: { size: 11, weight: 'bold' as const },
            anchor: 'end', align: 'end', offset: 2,
            formatter: (_v: number, ctx: any) => {
              let sum = 0;
              ctx.chart.data.datasets.forEach((ds: any) => { sum += ds.data[ctx.dataIndex] || 0; });
              return sum;
            }
          }
        },
      ]
    };
  });

  weekToWeekChartData = computed<ChartData<'line'> | null>(() => {
    const d = this.data();
    if (!d || d.weekToWeekTrend.length === 0) return null;
    return {
      labels: d.weekToWeekTrend.map(w => w.weekLabel),
      datasets: [
        { label: 'Total Open', data: d.weekToWeekTrend.map(w => w.totalOpen),
          borderColor: '#00acb9', backgroundColor: 'rgba(0,172,185,0.06)',
          borderWidth: 1.5, tension: 0.3, pointRadius: 2.5, pointHoverRadius: 5, fill: false },
        { label: 'Created', data: d.weekToWeekTrend.map(w => w.created),
          borderColor: '#f07440', backgroundColor: 'rgba(240,116,64,0.06)',
          borderWidth: 1.5, tension: 0.3, pointRadius: 2.5, pointHoverRadius: 5, fill: false },
        { label: 'Resolved', data: d.weekToWeekTrend.map(w => w.resolved),
          borderColor: '#81bc01', backgroundColor: 'rgba(129,188,1,0.06)',
          borderWidth: 1.5, tension: 0.3, pointRadius: 2.5, pointHoverRadius: 5, fill: false },
      ]
    };
  });

  backlogChartData = computed<ChartData<'line'> | null>(() => {
    const d = this.data();
    if (!d || d.backlogGrowth.length === 0) return null;
    return {
      labels: d.backlogGrowth.map(p => p.label),
      datasets: [
        { label: 'Critical', data: d.backlogGrowth.map(p => p.critical),
          borderColor: '#ef9644', backgroundColor: 'rgba(239,150,68,0.25)',
          borderWidth: 1.5, tension: 0.4, pointRadius: 2.5, fill: true },
        { label: 'Major', data: d.backlogGrowth.map(p => p.major),
          borderColor: '#fbd34c', backgroundColor: 'rgba(251,211,76,0.20)',
          borderWidth: 1.5, tension: 0.4, pointRadius: 2.5, fill: true },
      ]
    };
  });

  // ── Chart options (dynamic Y-axis: base 100, +25 per layer if data exceeds) ──

  private yMax(dataMax: number): number {
    return Math.max(100, Math.ceil(dataMax / 25) * 25);
  }

  currentMonthChartOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const d = this.data();
    let dataMax = 0;
    if (d && d.monthlyBugsByMonth.length > 0) {
      const c = d.monthlyBugsByMonth[d.monthlyBugsByMonth.length - 1];
      dataMax = c.minor + c.major + c.critical + c.blocker;
    }
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 14, padding: 12 } },
        tooltip: { mode: 'index', intersect: false },
        datalabels: {
          display: true,
          color: '#000',
          font: { size: 11, weight: 'bold' },
          textStrokeColor: '#fff',
          textStrokeWidth: 3,
          formatter: (value: number) => value > 0 ? value : null,
          anchor: 'center',
          align: 'center',
          clamp: true,
        }
      },
      scales: {
        x: { stacked: true, display: false },
        y: { stacked: true, min: 0, max: this.yMax(dataMax), ticks: { stepSize: 25 } }
      }
    };
  });

  monthlyChartOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const d = this.data();
    let dataMax = 0;
    if (d) {
      d.monthlyBugsByMonth.forEach(m => {
        const sum = m.minor + m.major + m.critical + m.blocker;
        if (sum > dataMax) dataMax = sum;
      });
    }
    return {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 } } },
        tooltip: { mode: 'index', intersect: false },
        datalabels: { display: false }
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 12 }, maxRotation: 45, minRotation: 25 } },
        y: { stacked: true, min: 0, max: this.yMax(dataMax), ticks: { stepSize: 25 } }
      }
    };
  });

  weekToWeekChartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    const d = this.data();
    let dataMax = 0;
    if (d) {
      d.weekToWeekTrend.forEach(w => {
        const m = Math.max(w.totalOpen, w.created, w.resolved);
        if (m > dataMax) dataMax = m;
      });
    }
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12 } } },
        tooltip: { mode: 'index', intersect: false },
        datalabels: { display: false }
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { font: { size: 12 }, maxRotation: 45, minRotation: 25 } },
        y: { min: 0, max: this.yMax(dataMax), ticks: { stepSize: 25 } }
      }
    };
  });

  backlogChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 12 } } },
      tooltip: { mode: 'index', intersect: false },
      datalabels: { display: false }
    },
    scales: {
      x: { ticks: { font: { size: 12 } } },
      y: { beginAtZero: true, grace: 0, ticks: { count: 5 } }
    }
  };

  // ── Lifecycle ──

  ngOnInit(): void {
    this.loadData();
  }

  fmtDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  onStartChange(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.dateRange.update(r => ({ ...r, start: new Date(v) }));
    const { start, end } = this.dateRange();
    this.settingsService.savePageDates('product-quality-report', start, end);
  }

  onEndChange(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.dateRange.update(r => ({ ...r, end: new Date(v) }));
    const { start, end } = this.dateRange();
    this.settingsService.savePageDates('product-quality-report', start, end);
  }

  loadData(): void {
    const { start, end } = this.dateRange();
    this.loading.set(true);
    this.error.set(false);
    this.velocityService.getProductQualityMonthlyReport(start, end).subscribe({
      next: result => { this.data.set(result); this.loading.set(false); },
      error: err => {
        console.error('Failed to load product quality report', err);
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  async onExport(format: SnapshotFormat): Promise<void> {
    const d = this.data();
    if (!d) return;
    await this.snapshotService.exportSnapshot({
      pageName: 'Product_Quality_Report',
      datePeriod: this.snapshotService.buildDatePeriod(this.dateRange().start, this.dateRange().end),
      format,
      containerElement: this.snapshotContainer.nativeElement,
      title: `Product Quality Report — ${this.pageTitle()}`,
      subtitle: 'Bug trends, backlog health, and SLA compliance',
      chartCanvasIds: ['current-month-chart', 'monthly-bugs-chart', 'week-to-week-chart', 'backlog-growth-chart'],
    });
  }
}
