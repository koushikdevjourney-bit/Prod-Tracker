import { DecimalPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { formatDuration, formatPercent } from '../../core/utils/stats.utils';

@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    if (minutes == null || Number.isNaN(minutes)) return '—';
    return formatDuration(minutes);
  }
}

@Pipe({ name: 'percentFmt', standalone: true })
export class PercentFmtPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '0%';
    return formatPercent(value);
  }
}

export { DecimalPipe };
