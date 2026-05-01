import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideRouter } from '@angular/router';
import { ProductQualityReportComponent } from './features/product-quality-report/product-quality-report.component';
import { EngineeringBacklogComponent } from './features/engineering-backlog/engineering-backlog.component';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideCharts(withDefaultRegisterables()),
    provideRouter([
      { path: 'quality-report', component: ProductQualityReportComponent, title: 'Product Quality Report' },
      { path: 'backlog', component: EngineeringBacklogComponent, title: 'Engineering Backlog' },
      { path: '**', redirectTo: 'quality-report' },
    ]),
  ]
};
