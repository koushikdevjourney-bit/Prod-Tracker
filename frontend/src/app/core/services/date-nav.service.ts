import { Injectable, computed, signal } from '@angular/core';
import { DateRangePreset, DateSelection } from '../models';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  todayKey,
} from '../utils/stats.utils';

@Injectable({ providedIn: 'root' })
export class DateNavService {
  private readonly state = signal<DateSelection>(this.build('today', todayKey()));

  readonly selection = this.state.asReadonly();
  readonly selectedDate = computed(() => this.state().selectedDate);
  readonly rangeStart = computed(() => this.state().rangeStart);
  readonly rangeEnd = computed(() => this.state().rangeEnd);
  readonly isSingleDay = computed(() => this.state().rangeStart === this.state().rangeEnd);

  setPreset(preset: DateRangePreset, customStart?: string, customEnd?: string): void {
    const today = todayKey();
    if (preset === 'custom' && customStart && customEnd) {
      this.state.set({
        preset,
        selectedDate: customEnd,
        rangeStart: customStart <= customEnd ? customStart : customEnd,
        rangeEnd: customStart <= customEnd ? customEnd : customStart,
      });
      return;
    }
    this.state.set(this.build(preset, today));
  }

  setDate(date: string): void {
    this.state.set({
      preset: 'custom',
      selectedDate: date,
      rangeStart: date,
      rangeEnd: date,
    });
  }

  goPrev(): void {
    const s = this.state();
    if (s.rangeStart === s.rangeEnd) {
      const d = addDays(s.selectedDate, -1);
      this.setDate(d);
      return;
    }
    const span = Math.max(0, this.daySpan(s.rangeStart, s.rangeEnd));
    const end = addDays(s.rangeStart, -1);
    const start = addDays(end, -span);
    this.state.set({ preset: 'custom', selectedDate: end, rangeStart: start, rangeEnd: end });
  }

  goNext(): void {
    const s = this.state();
    if (s.rangeStart === s.rangeEnd) {
      this.setDate(addDays(s.selectedDate, 1));
      return;
    }
    const span = Math.max(0, this.daySpan(s.rangeStart, s.rangeEnd));
    const start = addDays(s.rangeEnd, 1);
    const end = addDays(start, span);
    this.state.set({ preset: 'custom', selectedDate: end, rangeStart: start, rangeEnd: end });
  }

  goToday(): void {
    this.setPreset('today');
  }

  private daySpan(start: string, end: string): number {
    let n = 0;
    let cur = start;
    while (cur < end) {
      cur = addDays(cur, 1);
      n++;
    }
    return n;
  }

  private build(preset: DateRangePreset, today: string): DateSelection {
    switch (preset) {
      case 'yesterday': {
        const y = addDays(today, -1);
        return { preset, selectedDate: y, rangeStart: y, rangeEnd: y };
      }
      case 'thisWeek':
        return {
          preset,
          selectedDate: today,
          rangeStart: startOfWeek(today),
          rangeEnd: endOfWeek(today),
        };
      case 'lastWeek': {
        const anchor = addDays(startOfWeek(today), -1);
        return {
          preset,
          selectedDate: endOfWeek(anchor),
          rangeStart: startOfWeek(anchor),
          rangeEnd: endOfWeek(anchor),
        };
      }
      case 'thisMonth':
        return {
          preset,
          selectedDate: today,
          rangeStart: startOfMonth(today),
          rangeEnd: endOfMonth(today),
        };
      case 'lastMonth': {
        const prev = addDays(startOfMonth(today), -1);
        return {
          preset,
          selectedDate: endOfMonth(prev),
          rangeStart: startOfMonth(prev),
          rangeEnd: endOfMonth(prev),
        };
      }
      case 'custom':
      case 'today':
      default:
        return { preset: 'today', selectedDate: today, rangeStart: today, rangeEnd: today };
    }
  }
}
