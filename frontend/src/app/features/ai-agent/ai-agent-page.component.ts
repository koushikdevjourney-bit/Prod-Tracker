import { Component, ElementRef, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AiAgentService } from '../../core/services/ai-agent.service';
import { ToastService } from '../../core/services/toast.service';
import { AiMessage, DateRangeContext } from '../../core/models/ai-agent.models';

@Component({
  selector: 'app-ai-agent-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ai-agent-page.component.html',
  styleUrl: './ai-agent-page.component.css',
})
export class AiAgentPageComponent {
  readonly ai = inject(AiAgentService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('chatScroll') private readonly chatScroll?: ElementRef<HTMLDivElement>;
  @ViewChild('promptInput') private readonly promptInput?: ElementRef<HTMLTextAreaElement>;

  readonly inputText = signal('');
  readonly inputFocused = signal(false);

  constructor() {
    afterNextRender(() => {
      this.scrollToBottom();
      this.focusInput();
    });
  }

  onInputChange(val: string): void {
    this.inputText.set(val);
    this.adjustTextareaHeight();
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.ai.isAnalyzing()) return;
    this.inputText.set('');
    this.resetTextareaHeight();

    this.ai.sendMessage(text).then(() => {
      this.scrollToBottom();
    });
    this.scrollToBottom();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  sendPreset(type: 'weekly' | 'daily' | 'goals' | 'academics' | 'burnout'): void {
    if (this.ai.isAnalyzing()) return;
    this.ai.generatePresetReport(type).then(() => {
      this.scrollToBottom();
    });
    this.scrollToBottom();
  }

  reAnalyze(msg: AiMessage): void {
    if (this.ai.isAnalyzing()) return;
    if (
      msg.reportType === 'weekly' ||
      msg.reportType === 'daily' ||
      msg.reportType === 'goals' ||
      msg.reportType === 'academics' ||
      msg.reportType === 'burnout'
    ) {
      this.sendPreset(msg.reportType);
    } else {
      this.ai.sendMessage(`Please re-analyze my latest logs for ${this.ai.selectedRange()}`);
    }
  }

  clearChat(): void {
    if (confirm('Start a new chat session and clear previous messages?')) {
      this.ai.clearHistory();
      this.focusInput();
    }
  }

  setRange(range: DateRangeContext): void {
    this.ai.setRange(range);
  }

  copyMessage(content: string): void {
    navigator.clipboard.writeText(content).then(() => {
      this.toast.success('Report copied to clipboard!');
    }).catch(() => {
      this.toast.error('Could not copy to clipboard');
    });
  }

  downloadReport(msg: AiMessage): void {
    const blob = new Blob([msg.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pulse-ai-report-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('Report downloaded as Markdown');
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScroll?.nativeElement) {
        this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
      }
    }, 60);
  }

  private focusInput(): void {
    setTimeout(() => {
      this.promptInput?.nativeElement?.focus();
    }, 100);
  }

  private adjustTextareaHeight(): void {
    if (!this.promptInput?.nativeElement) return;
    const el = this.promptInput.nativeElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  private resetTextareaHeight(): void {
    if (!this.promptInput?.nativeElement) return;
    const el = this.promptInput.nativeElement;
    el.style.height = 'auto';
  }

  formatMarkdown(content: string): SafeHtml {
    if (!content) return '';

    const lines = content.split('\n');
    const out: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Escape raw HTML tags
      line = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Horizontal Divider
      if (/^---+$/.test(line.trim())) {
        if (inList) {
          out.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        out.push('<hr class="md-hr" />');
        continue;
      }

      // Headers
      if (/^### (.*$)/.test(line)) {
        if (inList) {
          out.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        const text = line.replace(/^### /, '');
        out.push(`<h4 class="md-h4">${this.inlineFormat(text)}</h4>`);
        continue;
      }
      if (/^## (.*$)/.test(line)) {
        if (inList) {
          out.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        const text = line.replace(/^## /, '');
        out.push(`<h3 class="md-h3">${this.inlineFormat(text)}</h3>`);
        continue;
      }
      if (/^# (.*$)/.test(line)) {
        if (inList) {
          out.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        const text = line.replace(/^# /, '');
        out.push(`<h2 class="md-h2">${this.inlineFormat(text)}</h2>`);
        continue;
      }

      // Blockquotes
      if (/^&gt; (.*$)/.test(line)) {
        if (inList) {
          out.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        const text = line.replace(/^&gt; /, '');
        out.push(`<blockquote class="md-quote">${this.inlineFormat(text)}</blockquote>`);
        continue;
      }

      // Unordered lists (- or *)
      if (/^[-*]\s+(.*$)/.test(line)) {
        const text = line.replace(/^[-*]\s+/, '');
        if (!inList || listType !== 'ul') {
          if (inList) out.push(listType === 'ul' ? '</ul>' : '</ol>');
          out.push('<ul class="md-ul">');
          inList = true;
          listType = 'ul';
        }
        out.push(`<li class="md-li">${this.inlineFormat(text)}</li>`);
        continue;
      }

      // Ordered lists (1. , 2. )
      if (/^\d+\.\s+(.*$)/.test(line)) {
        const text = line.replace(/^\d+\.\s+/, '');
        if (!inList || listType !== 'ol') {
          if (inList) out.push(listType === 'ul' ? '</ul>' : '</ol>');
          out.push('<ol class="md-ol">');
          inList = true;
          listType = 'ol';
        }
        out.push(`<li class="md-li">${this.inlineFormat(text)}</li>`);
        continue;
      }

      // Empty line closes active list
      if (!line.trim()) {
        if (inList) {
          out.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        continue;
      }

      // Paragraph line
      if (inList) {
        out.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
      }
      out.push(`<p class="md-p">${this.inlineFormat(line)}</p>`);
    }

    if (inList) {
      out.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    return this.sanitizer.bypassSecurityTrustHtml(`<div class="markdown-body">${out.join('')}</div>`);
  }

  private inlineFormat(str: string): string {
    return str
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  }
}
