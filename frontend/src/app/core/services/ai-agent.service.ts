import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivityService } from './activity.service';
import { GoalService } from './goal.service';
import { HabitService } from './habit.service';
import { FocusTodoService } from './focus-todo.service';
import { AcademicService } from './academic.service';
import { LocalStoreService } from './local-store.service';
import { ToastService } from './toast.service';
import { STORAGE_KEYS } from '../constants/categories';
import {
  AggregatedLogsContext,
  AiMessage,
  AiMetricHighlight,
  AiSettings,
  DateRangeContext,
} from '../models/ai-agent.models';
import { addDays, formatDuration, todayKey } from '../utils/stats.utils';

import { environment } from '../../../environments/environment';

const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  apiKey: '',
};

@Injectable({ providedIn: 'root' })
export class AiAgentService {
  private readonly store = inject(LocalStoreService);
  private readonly toast = inject(ToastService);
  private readonly activities = inject(ActivityService);
  private readonly goals = inject(GoalService);
  private readonly habits = inject(HabitService);
  private readonly focusTodos = inject(FocusTodoService);
  private readonly academics = inject(AcademicService);

  readonly settings = signal<AiSettings>(
    this.store.get<AiSettings>(STORAGE_KEYS.aiSettings, DEFAULT_SETTINGS),
  );

  readonly messages = signal<AiMessage[]>(
    this.store.get<AiMessage[]>(STORAGE_KEYS.aiChatHistory, this.getInitialMessages()),
  );

  readonly isAnalyzing = signal(false);
  readonly selectedRange = signal<DateRangeContext>('last7days');

  readonly hasApiKey = computed(() => Boolean(this.settings().apiKey?.trim()));

  saveSettings(newSettings: Partial<AiSettings>): void {
    this.settings.update((curr) => {
      const updated = { ...curr, ...newSettings };
      this.store.set(STORAGE_KEYS.aiSettings, updated);
      return updated;
    });
    this.toast.success('AI Agent settings updated');
  }

  setRange(range: DateRangeContext): void {
    this.selectedRange.set(range);
  }

  clearHistory(): void {
    const welcome = this.getInitialMessages();
    this.messages.set(welcome);
    this.store.set(STORAGE_KEYS.aiChatHistory, welcome);
    this.toast.success('Chat history cleared');
  }

  /**
   * Aggregate all real user data for the chosen date range.
   */
  aggregateContext(range: DateRangeContext = this.selectedRange()): AggregatedLogsContext {
    const allActivities = this.activities.sorted();
    const today = todayKey();

    let startDate: string;
    let rangeLabel: string;

    switch (range) {
      case 'today':
        startDate = today;
        rangeLabel = 'Today';
        break;
      case 'last7days':
        startDate = addDays(today, -6);
        rangeLabel = 'Last 7 Days';
        break;
      case 'last30days':
        startDate = addDays(today, -29);
        rangeLabel = 'Last 30 Days';
        break;
      case 'all':
      default:
        startDate = '1970-01-01';
        rangeLabel = 'All Time Logs';
        break;
    }

    const filteredActivities = allActivities.filter((a) => a.date >= startDate && a.date <= today);

    let totalDurationMinutes = 0;
    let productiveMinutes = 0;
    let neutralMinutes = 0;
    let unproductiveMinutes = 0;
    let sleepMinutes = 0;
    const catMap = new Map<string, number>();
    const unproductiveItems: Array<{ name: string; category: string; minutes: number }> = [];
    const notes: string[] = [];

    for (const a of filteredActivities) {
      const dur = a.durationMinutes || 0;
      totalDurationMinutes += dur;

      if (a.type === 'productive') productiveMinutes += dur;
      else if (a.type === 'neutral') neutralMinutes += dur;
      else if (a.type === 'unproductive') {
        unproductiveMinutes += dur;
        unproductiveItems.push({ name: a.name, category: a.category, minutes: dur });
      } else if (a.type === 'sleep') sleepMinutes += dur;

      catMap.set(a.category, (catMap.get(a.category) || 0) + dur);

      if (a.notes?.trim()) {
        notes.push(`[${a.date} · ${a.name}]: ${a.notes.trim()}`);
      }
    }

    const nonSleep = totalDurationMinutes - sleepMinutes;
    const productivityScore = nonSleep > 0 ? Math.round((productiveMinutes / nonSleep) * 100) : 0;

    const topCategories = Array.from(catMap.entries())
      .map(([name, minutes]) => ({
        name,
        minutes,
        percent: totalDurationMinutes > 0 ? Math.round((minutes / totalDurationMinutes) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const activeGoals = this.goals.goals().map((g) => ({
      name: g.name,
      targetMinutes: g.targetMinutes,
      period: g.period,
    }));

    const activeHabits = this.habits.withStreaks().map((item) => ({
      name: item.habit.name,
      streak: item.streak,
      targetDaysPerWeek: item.habit.targetDaysPerWeek,
    }));

    const academicSubjects: Array<{ name: string; semester: string; priority: number }> = [];
    for (const track of this.academics.tracks()) {
      for (const subj of track.subjects || []) {
        academicSubjects.push({
          name: subj.name,
          semester: track.name,
          priority: subj.stars,
        });
      }
    }

    const activeFocusTasks = this.focusTodos.todos().map((t) => ({
      title: t.title,
      completed: t.status === 'completed',
      priority: t.priority,
    }));

    return {
      range,
      rangeLabel,
      totalDurationMinutes,
      productiveMinutes,
      neutralMinutes,
      unproductiveMinutes,
      sleepMinutes,
      productivityScore,
      activitiesCount: filteredActivities.length,
      topCategories,
      unproductiveItems,
      recentNotes: notes.slice(-10),
      activeGoals,
      activeHabits,
      academicSubjects,
      activeFocusTasks,
    };
  }

  /**
   * Main entry point to send user prompt or trigger predefined reports.
   */
  async sendMessage(prompt: string, reportType?: AiMessage['reportType']): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const userMessage: AiMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateRangeContext: this.selectedRange(),
    };

    this.messages.update((list) => [...list, userMessage]);
    this.persistMessages();

    this.isAnalyzing.set(true);

    try {
      const context = this.aggregateContext(this.selectedRange());
      let responseText = '';
      let metrics: AiMetricHighlight[] = [];

      // 1. Check if user configured their own API key in browser
      if (this.hasApiKey()) {
        const result = await this.callExternalLlm(trimmed, context, reportType);
        responseText = result.text;
        metrics = result.metrics;
      } else {
        // 2. Try calling backend server API (which has GEMINI_API_KEY configured)
        let backendSucceeded = false;
        try {
          const serverRes = await fetch(`${environment.apiUrl}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: trimmed, context }),
          });
          if (serverRes.ok) {
            const data = await serverRes.json();
            if (data?.success && data?.text) {
              responseText = data.text;
              metrics = [
                { label: 'Total Time', value: formatDuration(context.totalDurationMinutes), icon: '⏱️', tone: 'neutral' },
                { label: 'Productivity', value: `${context.productivityScore}%`, icon: '⚡', tone: 'positive' },
                { label: 'Top Focus', value: context.topCategories[0]?.name || 'N/A', icon: '🎯', tone: 'accent' },
                { label: 'Provider', value: 'Gemini (Cloud)', icon: '🤖', tone: 'accent' },
              ];
              backendSucceeded = true;
            }
          }
        } catch {
          backendSucceeded = false;
        }

        // 3. If server endpoint is sleeping or not yet reachable, use high-precision local analyzer
        if (!backendSucceeded) {
          await this.simulateDeliberation();
          const localResult = this.generateLocalAnalysis(trimmed, context, reportType);
          responseText = localResult.text;
          metrics = localResult.metrics;
        }
      }

      const assistantMessage: AiMessage = {
        id: 'ai_' + Date.now(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reportType,
        metrics,
        dateRangeContext: this.selectedRange(),
      };

      this.messages.update((list) => [...list, assistantMessage]);
      this.persistMessages();
    } catch (err: any) {
      console.error('AI Agent Error:', err);
      this.toast.error(err?.message || 'Could not complete analysis');
      // Graceful fallback to local engine
      const context = this.aggregateContext(this.selectedRange());
      const localResult = this.generateLocalAnalysis(trimmed, context, reportType);
      const fallbackMsg: AiMessage = {
        id: 'ai_' + Date.now(),
        role: 'assistant',
        content: `⚠️ *External API connection failed, but your Built-in Smart Analyzer generated this report based on your local logs:*\n\n${localResult.text}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reportType,
        metrics: localResult.metrics,
      };
      this.messages.update((list) => [...list, fallbackMsg]);
      this.persistMessages();
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  /**
   * Predefined 1-click Quick Reports.
   */
  async generatePresetReport(type: 'weekly' | 'daily' | 'goals' | 'academics' | 'burnout'): Promise<void> {
    const prompts = {
      weekly: '📊 Please generate a Comprehensive Weekly Productivity Audit for my recent activity logs.',
      daily: '⚡ Please generate a Detailed Daily Execution & Focus Breakdown for today.',
      goals: '🎯 Please analyze my Goals, Habit Streaks, and Execution Consistency.',
      academics: '📚 Please review my Academic Syllabus & Technical Study (DSA, Coding, AI/ML) progress.',
      burnout: '🧠 Please conduct a Focus vs Fatigue Audit (check rest, marathon blocks, and burnout risk).',
    };
    await this.sendMessage(prompts[type], type);
  }

  exportConversationMarkdown(): string {
    const lines: string[] = [
      `# Pulse AI Productivity Reports`,
      `*Generated on ${new Date().toLocaleString()}*`,
      `---`,
      ``,
    ];

    for (const msg of this.messages()) {
      if (msg.role === 'system') continue;
      const author = msg.role === 'user' ? '👤 User' : '✨ Pulse AI Coach';
      lines.push(`### ${author} (${msg.timestamp})`);
      if (msg.dateRangeContext) {
        lines.push(`*Context: ${msg.dateRangeContext}*`);
      }
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------
  // Built-in Intelligent Local Analyzer Engine
  // -------------------------------------------------------------
  private generateLocalAnalysis(
    prompt: string,
    ctx: AggregatedLogsContext,
    reportType?: AiMessage['reportType'],
  ): { text: string; metrics: AiMetricHighlight[] } {
    const p = prompt.toLowerCase();
    const isWeekly = reportType === 'weekly' || p.includes('weekly') || p.includes('audit');
    const isDaily = reportType === 'daily' || p.includes('today') || p.includes('daily');
    const isGoals = reportType === 'goals' || p.includes('goal') || p.includes('habit');
    const isAcademics = reportType === 'academics' || p.includes('academic') || p.includes('dsa') || p.includes('syllabus');
    const isBurnout = reportType === 'burnout' || p.includes('burnout') || p.includes('rest') || p.includes('energy');

    // Default highlights
    const highlights: AiMetricHighlight[] = [
      {
        label: 'Total Time',
        value: formatDuration(ctx.totalDurationMinutes),
        icon: '⏱️',
        tone: 'neutral',
      },
      {
        label: 'Productivity Score',
        value: `${ctx.productivityScore}%`,
        icon: '⚡',
        tone: ctx.productivityScore >= 70 ? 'positive' : ctx.productivityScore >= 50 ? 'warning' : 'accent',
      },
      {
        label: 'Primary Focus',
        value: ctx.topCategories[0]?.name || 'None',
        icon: '🎯',
        tone: 'accent',
      },
      {
        label: 'Active Logs',
        value: `${ctx.activitiesCount} blocks`,
        icon: '📋',
        tone: 'neutral',
      },
    ];

    if (isWeekly) {
      return {
        metrics: highlights,
        text: this.buildWeeklyReport(ctx),
      };
    }

    if (isDaily) {
      return {
        metrics: highlights,
        text: this.buildDailyReport(ctx),
      };
    }

    if (isGoals) {
      return {
        metrics: highlights,
        text: this.buildGoalsReport(ctx),
      };
    }

    if (isAcademics) {
      return {
        metrics: highlights,
        text: this.buildAcademicsReport(ctx),
      };
    }

    if (isBurnout) {
      return {
        metrics: highlights,
        text: this.buildBurnoutReport(ctx),
      };
    }

    // Custom query engine
    return {
      metrics: highlights,
      text: this.buildCustomAnswer(prompt, ctx),
    };
  }

  private buildWeeklyReport(ctx: AggregatedLogsContext): string {
    const topCats = ctx.topCategories.slice(0, 4);
    const catBreakdown = topCats.length > 0
      ? topCats.map((c) => `- **${c.name}**: ${formatDuration(c.minutes)} (${c.percent}% of logged time)`).join('\n')
      : '- *No categorical logs recorded for this period.*';

    const leakage = ctx.unproductiveMinutes > 0
      ? `You logged **${formatDuration(ctx.unproductiveMinutes)}** in unproductive blocks. Common leakage areas: ${ctx.unproductiveItems.map((i) => i.name).slice(0, 3).join(', ')}.`
      : `Zero unproductive leakage logged! Your time management has been strictly disciplined.`;

    const notesSummary = ctx.recentNotes.length > 0
      ? `\n\n### 📝 Key Notes & Observations\n` + ctx.recentNotes.map((n) => `> ${n}`).join('\n')
      : '';

    return `## 📊 Executive Productivity Audit (${ctx.rangeLabel})

### 📈 High-Level Summary
- **Total Duration Tracked**: **${formatDuration(ctx.totalDurationMinutes)}** across **${ctx.activitiesCount} activities**.
- **Productive Deep Work**: **${formatDuration(ctx.productiveMinutes)}** (**${ctx.productivityScore}%** productivity efficiency).
- **Neutral & Routine Time**: **${formatDuration(ctx.neutralMinutes)}** (Meals, Breaks, Maintenance).
- **Distraction / Unproductive**: **${formatDuration(ctx.unproductiveMinutes)}**.

---

### 🏆 Top Category Allocation
${catBreakdown}

---

### 🔍 Focus & Distraction Analysis
${leakage}

---

### 💡 Strategic Recommendations for Next Week
1. **Double down on your highest ROI category**: Keep the momentum high on **${ctx.topCategories[0]?.name || 'Core Skills'}**.
2. **Buffer against mid-day fatigue**: Schedule 10-15 minute active breaks between intensive 90-minute blocks.
3. **Protect your streak**: Continue logging entries immediately using the hourly reminders or 1-click Quick Add presets.

> ℹ️ *Generated by Pulse Built-in Smart Analyzer. Connect your Gemini or OpenAI API Key anytime for freeform conversational AI!*`;
  }

  private buildDailyReport(ctx: AggregatedLogsContext): string {
    return `## ⚡ Today's Daily Standup & Execution Report

### ⏱️ Day Snapshot
- **Logged Duration**: **${formatDuration(ctx.totalDurationMinutes)}**
- **Productive Focus**: **${formatDuration(ctx.productiveMinutes)}** (${ctx.productivityScore}% efficiency score)
- **Completed Focus Blocks**: **${ctx.activitiesCount} blocks**

---

### 🎯 Key Focus Distribution
${ctx.topCategories.slice(0, 3).map((c) => `- **${c.name}**: ${formatDuration(c.minutes)} (${c.percent}%)`).join('\n') || '- *No logs logged for today yet.*'}

---

### 🚀 Momentum Assessment
${ctx.productivityScore >= 70
  ? `🔥 **Outstanding Execution!** You are well ahead of the average benchmark with **${ctx.productivityScore}%** productive focus.`
  : `⚡ **Good Foundation!** You've established initial traction. Plan your next 45-minute focus session to drive up the productive ratio.`
}

---

### 📋 Recommended Next Steps
- Open **Focused To-Do** to lock in your top pinned priority.
- If you have upcoming syllabus units in **Academics**, use the **⚡ Study Now** button to launch a 25m Pomodoro.`;
  }

  private buildGoalsReport(ctx: AggregatedLogsContext): string {
    const goalsList = ctx.activeGoals.length > 0
      ? ctx.activeGoals.map((g) => `- **${g.name}**: Target of ${formatDuration(g.targetMinutes)} (${g.period})`).join('\n')
      : '- *No active goals configured. Head over to Goals to set your targets!*';

    const habitsList = ctx.activeHabits.length > 0
      ? ctx.activeHabits.map((h) => `- **${h.name}**: Current streak **${h.streak} days** 🔥 (Target: ${h.targetDaysPerWeek} days/wk)`).join('\n')
      : '- *No habits tracked yet. Set your daily habits to build compound consistency!*';

    return `## 🎯 Goals & Habit Momentum Audit

### 🏆 Goals Overview
${goalsList}

---

### ↻ Habit Streaks & Discipline
${habitsList}

---

### 💡 Coaching Insight
- Consistency is formed in the smallest daily actions. Protecting your streaks across consecutive days generates compounding focus momentum.`;
  }

  private buildAcademicsReport(ctx: AggregatedLogsContext): string {
    const techStudy = ctx.topCategories
      .filter((c) => ['Coding', 'DSA', 'AI/ML', 'Development', 'College', 'Study'].includes(c.name))
      .reduce((sum, c) => sum + c.minutes, 0);

    return `## 📚 Academic & Technical Skill Audit

### 💻 Technical & Study Hours Logged
- **Total Technical Study Time**: **${formatDuration(techStudy)}** (${ctx.rangeLabel})
${ctx.topCategories
  .filter((c) => ['Coding', 'DSA', 'AI/ML', 'Development', 'College', 'Study'].includes(c.name))
  .map((c) => `- **${c.name}**: ${formatDuration(c.minutes)}`)
  .join('\n') || '- *No technical categories logged yet.*'
}

---

### 🎓 Track & Syllabus Status
- Academic subjects actively tracked: **${ctx.academicSubjects.length} subjects**.
- Priority focus subjects (★ 4-5): **${ctx.academicSubjects.filter((s) => s.priority >= 4).map((s) => s.name).join(', ') || 'Sem-5 Core'}**.

---

### 🎯 Recommendation
- Keep a 60/40 balance between **DSA / Coding Problem Solving** and **Semester Core Subjects** to maximize placement readiness.`;
  }

  private buildBurnoutReport(ctx: AggregatedLogsContext): string {
    return `## 🧠 Energy, Rest & Burnout Risk Audit

### 🔋 Work-Rest Balance
- **Waking Active Time**: **${formatDuration(ctx.totalDurationMinutes)}**
- **Productive Strain**: **${formatDuration(ctx.productiveMinutes)}**
- **Rest & Breaks Logged**: **${formatDuration(ctx.neutralMinutes)}**
- **Sleep Logged**: **${formatDuration(ctx.sleepMinutes)}**

---

### 🩺 Burnout Risk Assessment
${ctx.productiveMinutes > 360 && ctx.neutralMinutes < 45
  ? `⚠️ **Elevated Fatigue Risk**: You logged over 6 hours of productive focus with minimal dedicated breaks. Ensure you incorporate 10-15 minute physical recharge breaks.`
  : `✅ **Healthy Energy Balance**: Your focus-to-rest ratio is sustainable. Your mind has adequate intervals between cognitive sprints.`
}

---

### 🌿 Protocol to Maintain High Energy
1. **Hydration & Eye Relief**: Look 20 feet away for 20 seconds every 20 minutes (20-20-20 rule).
2. **Hard Cutoff**: Set a strict evening wind-down time to secure uninterrupted sleep.`;
  }

  private buildCustomAnswer(prompt: string, ctx: AggregatedLogsContext): string {
    const q = prompt.toLowerCase();

    // Specific category lookup: e.g. "DSA" or "Coding"
    const matchedCategory = ctx.topCategories.find((c) => q.includes(c.name.toLowerCase()));
    if (matchedCategory) {
      return `### 🎯 Analysis for "${matchedCategory.name}" (${ctx.rangeLabel})

- **Total Time Logged**: **${formatDuration(matchedCategory.minutes)}**
- **Share of Total Time**: **${matchedCategory.percent}%**
- **Related Activities**:
${this.activities
  .sorted()
  .filter((a) => a.category.toLowerCase() === matchedCategory.name.toLowerCase())
  .slice(0, 5)
  .map((a) => `- **${a.date}** (${a.startTime}–${a.endTime}): ${a.name} (${formatDuration(a.durationMinutes)})`)
  .join('\n')}

**Takeaway**: You have accumulated solid hours in **${matchedCategory.name}**. Maintain consistency by logging regular blocks!`;
    }

    return `### 💡 Analysis of Your Productivity Context

Here is what the data shows for **${ctx.rangeLabel}**:
- You have logged **${formatDuration(ctx.totalDurationMinutes)}** across **${ctx.activitiesCount} activity blocks**.
- **Productivity Efficiency**: **${ctx.productivityScore}%** (${formatDuration(ctx.productiveMinutes)} productive deep work).
- **Leading Priority**: **${ctx.topCategories[0]?.name || 'Unspecified'}** accounts for **${ctx.topCategories[0]?.percent || 0}%** of your active time.

If you are looking for specific guidance on your study schedule, goal pacing, or habit formation, feel free to ask a detailed question or pick one of the quick reports!`;
  }

  // -------------------------------------------------------------
  // External LLM API Call (Gemini / OpenAI / Groq)
  // -------------------------------------------------------------
  private async callExternalLlm(
    prompt: string,
    ctx: AggregatedLogsContext,
    reportType?: string,
  ): Promise<{ text: string; metrics: AiMetricHighlight[] }> {
    const cfg = this.settings();
    const apiKey = cfg.apiKey?.trim();

    if (!apiKey) {
      throw new Error('API Key is missing');
    }

    const systemPrompt = `You are Pulse AI, the elite productivity coach and data analyst built into Pulse Tracker.
Your job is to analyze the user's real productivity logs and generate structured, insightful, motivating, and actionable reports.
Always format your response using clean Markdown with clear headers (##, ###), bullet points, bold key numbers, and horizontal dividers.
Never hallucinate numbers; use the exact metrics provided in the JSON context below.

Current User Productivity Context:
${JSON.stringify(ctx, null, 2)}
`;

    // Google Gemini API
    if (cfg.provider === 'gemini') {
      const model = cfg.model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const body = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nUser Request: ${prompt}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

      const metrics: AiMetricHighlight[] = [
        { label: 'Total Time', value: formatDuration(ctx.totalDurationMinutes), icon: '⏱️', tone: 'neutral' },
        { label: 'Productivity', value: `${ctx.productivityScore}%`, icon: '⚡', tone: 'positive' },
        { label: 'Top Focus', value: ctx.topCategories[0]?.name || 'N/A', icon: '🎯', tone: 'accent' },
        { label: 'Provider', value: `Gemini (${model})`, icon: '🤖', tone: 'accent' },
      ];

      return { text, metrics };
    }

    // OpenAI or Groq (OpenAI-compatible)
    const baseUrl = cfg.provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : (cfg.customEndpoint || 'https://api.openai.com/v1/chat/completions');

    const modelName = cfg.model || (cfg.provider === 'groq' ? 'llama-3.1-70b-versatile' : 'gpt-4o-mini');

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `LLM API returned status ${res.status}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || 'No response generated.';

    const metrics: AiMetricHighlight[] = [
      { label: 'Total Time', value: formatDuration(ctx.totalDurationMinutes), icon: '⏱️', tone: 'neutral' },
      { label: 'Productivity', value: `${ctx.productivityScore}%`, icon: '⚡', tone: 'positive' },
      { label: 'Top Focus', value: ctx.topCategories[0]?.name || 'N/A', icon: '🎯', tone: 'accent' },
      { label: 'Provider', value: `${cfg.provider.toUpperCase()}`, icon: '🤖', tone: 'accent' },
    ];

    return { text, metrics };
  }

  private simulateDeliberation(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 600));
  }

  private persistMessages(): void {
    this.store.set(STORAGE_KEYS.aiChatHistory, this.messages());
  }

  private getInitialMessages(): AiMessage[] {
    return [
      {
        id: 'welcome_1',
        role: 'assistant',
        content: `👋 **Welcome to your Pulse AI Productivity Agent!**

I have direct access to your **Activities, Focus Tasks, Habits, Goals, and Academic Trackers**.

### What I can do for you:
- **Analyze your real time logs** and identify where your hours actually go.
- **Calculate deep work & productivity scores** across any date range.
- **Generate comprehensive executive audits** (Weekly, Daily, Academics, Goals, Burnout).
- **Answer questions** like *"How much time did I spend on DSA this week?"* or *"What was my most productive day?"*

Click one of the **Quick Reports** above, or ask me anything below! 🚀`,
        timestamp: 'Just now',
        metrics: [
          { label: 'Agent Status', value: 'Ready', icon: '✨', tone: 'positive' },
          { label: 'Logs Synchronized', value: 'Live', icon: '🔄', tone: 'accent' },
        ],
      },
    ];
  }
}
