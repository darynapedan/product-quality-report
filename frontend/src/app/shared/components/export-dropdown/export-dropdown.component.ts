import { Component, input, output, signal, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SnapshotFormat = 'png' | 'html' | 'pdf';

@Component({
  selector: 'app-export-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="export-wrapper" #wrapper>
      <button
        class="btn-export"
        [disabled]="disabled()"
        (click)="toggle()">
        Export Snapshot &#9660;
      </button>
      @if (open()) {
        <div class="export-menu">
          <button class="export-option" (click)="onSelect('png')">Export as PNG</button>
          <button class="export-option" (click)="onSelect('html')">Export as HTML</button>
          <button class="export-option" (click)="onSelect('pdf')">Export as PDF</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .export-wrapper { position: relative; display: inline-block; }
    .btn-export {
      padding: 0.5rem 1rem;
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .btn-export:hover:not(:disabled) { opacity: 0.85; }
    .btn-export:disabled { opacity: 0.4; cursor: not-allowed; }
    .export-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      background: var(--bg-card);
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      min-width: 170px;
      z-index: 100;
      overflow: hidden;
    }
    .export-option {
      display: block;
      width: 100%;
      padding: 0.7rem 1rem;
      border: none;
      background: var(--bg-card);
      color: var(--text-label);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
    }
    .export-option:hover { background: var(--bg-hover); }
  `],
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class ExportDropdownComponent {
  disabled = input<boolean>(false);
  exportSelected = output<SnapshotFormat>();

  open = signal(false);
  wrapper = viewChild<ElementRef>('wrapper');

  toggle(): void {
    this.open.update(v => !v);
  }

  onSelect(format: SnapshotFormat): void {
    this.open.set(false);
    this.exportSelected.emit(format);
  }

  onDocumentClick(event: MouseEvent): void {
    const el = this.wrapper()?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
