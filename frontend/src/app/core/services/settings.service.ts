import { Injectable, signal, computed, effect } from '@angular/core';
import { Chart } from 'chart.js';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly themeMode_ = signal<'light' | 'dark'>('light');
  readonly themeMode = this.themeMode_.asReadonly();
  readonly isDark = computed(() => this.themeMode_() === 'dark');

  constructor() {
    const stored = localStorage.getItem('theme-mode') as 'light' | 'dark' | null;
    if (stored === 'light' || stored === 'dark') {
      this.themeMode_.set(stored);
    }
    effect(() => this.applyTheme(this.themeMode_()));
    this.applyTheme(this.themeMode_());
  }

  private applyTheme(mode: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', mode);
    const isDark = mode === 'dark';
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  }

  toggleTheme(): void {
    const next = this.themeMode_() === 'light' ? 'dark' : 'light';
    this.themeMode_.set(next);
    localStorage.setItem('theme-mode', next);
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
