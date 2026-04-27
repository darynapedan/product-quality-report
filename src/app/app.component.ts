import { Component } from '@angular/core';
import { ProductQualityReportComponent } from './features/product-quality-report/product-quality-report.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProductQualityReportComponent],
  template: `<app-product-quality-report />`
})
export class AppComponent {}
