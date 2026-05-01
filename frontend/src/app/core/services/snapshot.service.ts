import { Injectable } from '@angular/core';
import { Chart } from 'chart.js';
import html2canvas from 'html2canvas';

export type SnapshotFormat = 'html' | 'png' | 'pdf';

export interface SnapshotOptions {
  pageName: string;
  datePeriod: string | null;
  format: SnapshotFormat;
  containerElement?: HTMLElement;
  title?: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
  chartCanvasIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class SnapshotService {

  buildDatePeriod(start: Date, end: Date): string {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return `${fmt(start)}_to_${fmt(end)}`;
  }

  private buildFileName(pageName: string, datePeriod: string | null): string {
    if (datePeriod) {
      return `${pageName}_${datePeriod}`;
    }
    return `${pageName}_${new Date().toISOString().split('T')[0]}`;
  }

  async exportSnapshot(options: SnapshotOptions): Promise<void> {
    const fileName = this.buildFileName(options.pageName, options.datePeriod);

    if (options.format === 'png') {
      await this.exportAsPng(options.containerElement!, fileName, options.datePeriod);
    } else if (options.format === 'pdf') {
      await this.exportAsPdf(options, fileName);
    } else {
      await this.exportAsHtml(options, fileName);
    }
  }

  private async exportAsPng(container: HTMLElement, fileName: string, datePeriod: string | null): Promise<void> {
    const hidden = this.hideExportElements(container);
    const dateLabel = this.injectDateRangeLabel(container, datePeriod);

    const chartCanvases = container.querySelectorAll('canvas');
    const chartInstances: { chart: any; origRatio: number }[] = [];
    const exportScale = 3;
    chartCanvases.forEach(cvs => {
      const chart = (Chart as any).getChart?.(cvs);
      if (chart) {
        chartInstances.push({ chart, origRatio: chart.options.devicePixelRatio ?? window.devicePixelRatio });
        chart.options.devicePixelRatio = exportScale;
        chart.resize();
      }
    });

    const scale = Math.max(3, (window.devicePixelRatio ?? 1) * 2);
    const canvas = await html2canvas(container, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim() || '#f1f5f9',
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 0,
    });

    chartInstances.forEach(({ chart, origRatio }) => {
      chart.options.devicePixelRatio = origRatio;
      chart.resize();
    });

    if (dateLabel) dateLabel.remove();
    hidden.forEach(({ el, prev }) => el.style.display = prev);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const pngWithDpi = await this.setPngDpi(blob, 300);
      const url = URL.createObjectURL(pngWithDpi);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  private async setPngDpi(blob: Blob, dpi: number): Promise<Blob> {
    const buf = await blob.arrayBuffer();
    const data = new Uint8Array(buf);
    const insertAt = 33;
    const ppm = Math.round(dpi * 39.3701);
    const phys = new Uint8Array(21);
    const view = new DataView(phys.buffer);
    view.setUint32(0, 9);
    phys[4] = 0x70; phys[5] = 0x48; phys[6] = 0x59; phys[7] = 0x73;
    view.setUint32(8, ppm);
    view.setUint32(12, ppm);
    phys[16] = 1;
    view.setUint32(17, this.crc32(phys.subarray(4, 17)));
    const result = new Uint8Array(data.length + 21);
    result.set(data.subarray(0, insertAt), 0);
    result.set(phys, insertAt);
    result.set(data.subarray(insertAt), insertAt + 21);
    return new Blob([result], { type: 'image/png' });
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  private injectDateRangeLabel(container: HTMLElement, datePeriod: string | null): HTMLElement | null {
    if (!datePeriod) return null;
    const parts = datePeriod.split('_to_');
    if (parts.length !== 2) return null;
    const fmt = (s: string) => {
      const d = new Date(s + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const text = `${fmt(parts[0])} – ${fmt(parts[1])}`;
    const label = document.createElement('div');
    label.textContent = text;
    label.style.cssText = [
      'text-align:left',
      'font-size:0.85rem',
      'font-weight:500',
      'padding:0.35rem 0 0.75rem',
      `color:${getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#2d4a7a'}`,
      'font-family:inherit',
      'letter-spacing:0.01em',
    ].join(';');
    const header = container.querySelector<HTMLElement>('.page-header');
    if (header) {
      header.after(label);
    } else {
      container.prepend(label);
    }
    return label;
  }

  private hideExportElements(container: HTMLElement): { el: HTMLElement; prev: string }[] {
    const selectors = '.back-link, app-export-dropdown, .btn-export, .header-actions, .date-config, .section-png-btn';
    const elements = container.querySelectorAll<HTMLElement>(selectors);
    const hidden: { el: HTMLElement; prev: string }[] = [];
    elements.forEach(el => {
      hidden.push({ el, prev: el.style.display });
      el.style.display = 'none';
    });
    return hidden;
  }

  private async exportAsPdf(options: SnapshotOptions, fileName: string): Promise<void> {
    const container = options.containerElement;
    if (!container) return;

    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.back-link, app-export-dropdown, .btn-export, .header-actions, .date-config .btn-primary').forEach(el => el.remove());

    const originalInputs = container.querySelectorAll('input');
    const clonedInputs = clone.querySelectorAll('input');
    clonedInputs.forEach((clonedInput, i) => {
      const original = originalInputs[i];
      if (original) clonedInput.setAttribute('value', original.value);
    });

    const originalCanvases = container.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    clonedCanvases.forEach((clonedCanvas, i) => {
      const original = originalCanvases[i] as HTMLCanvasElement | undefined;
      if (!original) return;
      const img = document.createElement('img');
      img.src = original.toDataURL('image/png');
      img.style.width = '100%';
      img.style.height = 'auto';
      clonedCanvas.parentNode?.replaceChild(img, clonedCanvas);
    });

    const styles: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        styles.push(rules.map(r => r.cssText).join('\n'));
      } catch { /* cross-origin */ }
    }

    const title = options.title || options.pageName.replace(/_/g, ' ');
    const currentTheme = 'capture-presentation';
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim() || '#f1f5f9';

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    ${styles.join('\n')}
    .back-link, app-export-dropdown, .btn-export, .header-actions { display: none !important; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body style="background:${bgColor};">
  ${clone.outerHTML}
  <script>window.addEventListener('load', () => { window.print(); });<\/script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  private async exportAsHtml(options: SnapshotOptions, fileName: string): Promise<void> {
    const container = options.containerElement;
    if (!container) return;

    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.back-link, app-export-dropdown, .btn-export, .header-actions, .date-config .btn-primary').forEach(el => el.remove());

    const originalInputs = container.querySelectorAll('input');
    const clonedInputs = clone.querySelectorAll('input');
    clonedInputs.forEach((clonedInput, i) => {
      const original = originalInputs[i];
      if (original) clonedInput.setAttribute('value', original.value);
    });

    const originalCanvases = container.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    clonedCanvases.forEach((clonedCanvas, i) => {
      const original = originalCanvases[i] as HTMLCanvasElement | undefined;
      if (!original) return;
      const img = document.createElement('img');
      img.src = original.toDataURL('image/png');
      img.style.width = '100%';
      img.style.height = 'auto';
      clonedCanvas.parentNode?.replaceChild(img, clonedCanvas);
    });

    const styles: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        styles.push(rules.map(r => r.cssText).join('\n'));
      } catch {
        // Skip cross-origin stylesheets
      }
    }

    const title = options.title || options.pageName.replace(/_/g, ' ');
    const now = new Date().toLocaleString();
    const currentTheme = 'capture-presentation';

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Snapshot</title>
  <style>
    ${styles.join('\n')}
    .back-link, app-export-dropdown, .btn-export, .header-actions { display: none !important; }
  </style>
</head>
<body style="background: ${getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim() || '#f1f5f9'};">
  <p style="text-align:center;color:${getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#94a3b8'};font-size:0.85rem;padding:1rem 0 0;">Exported on ${now}</p>
  ${clone.outerHTML}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
