import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductQualityMonthlyReport } from '../models/product-quality-report.model';
import { EngineeringBacklogReport, DiagnosisCard } from '../models/engineering-backlog.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VelocityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;

  getProductQualityMonthlyReport(startDate: Date, endDate: Date): Observable<ProductQualityMonthlyReport> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());
    return this.http.get<ProductQualityMonthlyReport>(
      `${this.baseUrl}/trend/product-quality-monthly`,
      { params }
    );
  }

  getEngineeringBacklogReport(): Observable<EngineeringBacklogReport> {
    return this.http.get<EngineeringBacklogReport>(
      `${this.baseUrl}/backlog/team-split`
    );
  }

  getBacklogDiagnosis(): Observable<DiagnosisCard[]> {
    return this.http.get<DiagnosisCard[]>(
      `${this.baseUrl}/backlog/team-split/diagnosis`
    );
  }
}
