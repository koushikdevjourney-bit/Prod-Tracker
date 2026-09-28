import { Component, ElementRef, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AiAgentService } from '../../core/services/ai-agent.service';
import { ToastService } from '../../core/services/toast.service';
import { AiMessage, AiProvider, DateRangeContext } from '../../core/models/ai-agent.models';

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

  readonly inputText = signal('');
  readonly showConfigModal = signal(false);

  // Configuration modal state
  readonly configProvider = signal<AiProvider>('gemini');
  readonly configApiKey = signal('');
  readonly configModel = signal('gemini-1.5-flash');
  readonly showApiKey = signal(false);

  constructor() {
    afterNextRender(() => {
      this.scrollToBottom();
    });
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.ai.isAnalyzing()) return;
    this.inputText.set('');
    this.ai.sendMessage(text).then(() => {
      this.scrollToBottom();
    });
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

  setRange(range: DateRangeContext): void {
    this.ai.setRange(range);
  }

  openConfig(): void {
    const current = this.ai.settings();
    this.configProvider.set(current.provider);
    this.configApiKey.set(current.apiKey || '');
    this.configModel.set(current.model || (current.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'));
    this.showApiKey.set(false);
    this.showConfigModal.set(true);
  }

  closeConfig(): void {
    this.showConfigModal.set(false);
  }

  onProviderChange(p: AiProvider): void {
    this.configProvider.set(p);
    if (p === 'gemini') {
      this.configModel.set('gemini-1.5-flash');
    } else if (p === 'openai') {
      this.configModel.set('gpt-4o-mini');
    } else if (p === 'groq') {
      this.configModel.set('llama-3.1-70b-versatile');
    }
  }

  saveConfig(): void {
    this.ai.saveSettings({
      provider: this.configProvider(),
      apiKey: this.configApiKey().trim(),
      model: this.configModel().trim(),
    });
    this.showConfigModal.set(false);
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
    link.download = `productivity-report-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('Report downloaded as Markdown');
  }

  exportAllMarkdown(): void {
    const md = this.ai.exportConversationMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pulse-ai-reports-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('All reports exported to Markdown');
  }

  clearHistory(): void {
    if (!confirm('Are you sure you want to clear your AI report chat history?')) return;
    this.ai.clearHistory();
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScroll?.nativeElement) {
        this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
      }
    }, 50);
  }

  formatMarkdown(content: string): SafeHtml {
    if (!content) return '';

    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>');

    // Bold & Italics
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Inline Code
    html = html.replace(/`([^`]+)`/gim, '<code class="inline-code">$1</code>');

    // Blockquote
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

    // Bullet Lists
    html = html.replace(/^[-*] (.*$)/gim, '<li class="md-li">$1</li>');

    // Horizontal Rule
    html = html.replace(/^---$/gim, '<hr class="md-hr" />');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p class="md-p">');
    html = html.replace(/\n/g, '<br />');

    return this.sanitizer.bypassSecurityTrustHtml(`<div class="markdown-body"><p class="md-p">${html}</p></div>`);
  }
}
