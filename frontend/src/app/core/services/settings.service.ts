import { Injectable, computed } from '@angular/core';

export interface ChartColors {
  blocker:  string;
  critical: string;
  major:    string;
  minor:    string;
  lowest:   string;
  line1:    string;
  line2:    string;
  line3:    string;
  dsTeam:   string;
  engTeam:  string;
}

const CHART_COLORS: ChartColors = {
  blocker:  '#c8502a',
  critical: '#ef9644',
  major:    '#fbd34c',
  minor:    '#81bc01',
  lowest:   '#00acb9',
  line1:    '#00acb9',
  line2:    '#f07440',
  line3:    '#81bc01',
  dsTeam:   '#00205c',
  engTeam:  '#00acb9',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly chartColors = computed<ChartColors>(() => CHART_COLORS);

  constructor() {
    document.documentElement.setAttribute('data-theme', 'capture-presentation');
  }

  getPageDates(pageKey: string): { start: Date; end: Date } | null {
    try {
      const stored = localStorage.getItem(`page-dates-${pageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { start: new Date(parsed.start), end: new Date(parsed.end) };
      }
    } catch {
      // ignore
    }
    return null;
  }

  savePageDates(pageKey: string, start: Date, end: Date): void {
    try {
      localStorage.setItem(`page-dates-${pageKey}`, JSON.stringify({
        start: start.toISOString(),
        end: end.toISOString()
      }));
    } catch {
      // ignore
    }
  }
}
