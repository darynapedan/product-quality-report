import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { Chart } from 'chart.js';
import DataLabelsPlugin from 'chartjs-plugin-datalabels';

Chart.register(DataLabelsPlugin);

Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
Chart.defaults.font.size = 12;
Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";
Chart.defaults.color = '#00205c';
Chart.defaults.borderColor = 'rgba(0,32,92,0.1)';
Chart.defaults.backgroundColor = 'rgba(0,172,185,0.08)';

Chart.defaults.plugins.datalabels!.display = false;

const tt = (Chart.defaults.plugins as any)?.tooltip;
if (tt) {
  Object.assign(tt, {
    backgroundColor: '#00205c',
    titleColor: '#ffffff',
    bodyColor: '#8cd2d6',
    borderColor: '#00acb9',
    borderWidth: 1,
    padding: 10,
    boxPadding: 4,
  });
}

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
