import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CardFilterTab,
  CardService,
  detectCardNetwork,
  formatCardNumber,
} from '../../core/services/card.service';
import {
  CARD_THEMES,
  CardCategory,
  CardItem,
  CardNetwork,
  CardTheme,
  CardThemeDef,
  CardType,
} from '../../core/models/card.models';

interface DraftForm {
  cardCategory: CardCategory;
  cardType: CardType;
  belongsTo: string;
  bankName: string;
  nickname: string;
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  network: CardNetwork;
  theme: CardTheme;
  billingDate: string;
  dueDate: string;
  creditLimit: string;
  notes: string;
  isFavorite: boolean;
}

const DEFAULT_DRAFT: DraftForm = {
  cardCategory: 'personal',
  cardType: 'credit',
  belongsTo: '',
  bankName: '',
  nickname: '',
  cardholderName: '',
  cardNumber: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
  network: 'visa',
  theme: 'midnight',
  billingDate: '',
  dueDate: '',
  creditLimit: '',
  notes: '',
  isFavorite: false,
};

export const POPULAR_BANKS = [
  'HDFC Bank',
  'State Bank of India (SBI)',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'IndusInd Bank',
  'American Express',
  'Standard Chartered',
  'IDFC FIRST Bank',
  'Federal Bank',
  'RBL Bank',
  'OneCard (BOB / Federal)',
  'HSBC Bank',
  'Citibank',
];

export const BELONGS_TO_SUGGESTIONS = [
  'Dad',
  'Mom',
  'Spouse / Partner',
  'Brother',
  'Sister',
  'Family Shared',
  'Company / Office',
  'Friend',
];

@Component({
  selector: 'app-cards-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cards-page.component.html',
  styleUrl: './cards-page.component.css',
})
export class CardsPageComponent {
  readonly theme = inject(ThemeService);
  readonly cardService = inject(CardService);
  private readonly toast = inject(ToastService);

  readonly themes: CardThemeDef[] = CARD_THEMES;
  readonly popularBanks = POPULAR_BANKS;
  readonly belongsToSuggestions = BELONGS_TO_SUGGESTIONS;

  readonly isModalOpen = signal(false);
  readonly editingCardId = signal<string | null>(null);
  readonly draft = signal<DraftForm>({ ...DEFAULT_DRAFT });

  // Privacy toggles per card
  readonly revealedNumbers = signal<Record<string, boolean>>({});
  readonly revealedCvvs = signal<Record<string, boolean>>({});
  readonly copiedKey = signal<string | null>(null);

  readonly formattedDraftNumber = computed(() => {
    return formatCardNumber(this.draft().cardNumber);
  });

  readonly selectedThemeDef = computed(() => {
    const themeId = this.draft().theme;
    return this.themes.find((t) => t.id === themeId) || this.themes[0];
  });

  toggleGlobalPrivacy(): void {
    this.cardService.toggleMask();
    const isMasked = this.cardService.maskSensitives();
    if (isMasked) {
      this.revealedNumbers.set({});
      this.revealedCvvs.set({});
    }
  }

  isNumberRevealed(id: string): boolean {
    if (!this.cardService.maskSensitives()) return true;
    return Boolean(this.revealedNumbers()[id]);
  }

  isCvvRevealed(id: string): boolean {
    if (!this.cardService.maskSensitives()) return true;
    return Boolean(this.revealedCvvs()[id]);
  }

  toggleCardNumberReveal(id: string): void {
    this.revealedNumbers.update((curr) => ({
      ...curr,
      [id]: !curr[id],
    }));
  }

  toggleCvvReveal(id: string): void {
    this.revealedCvvs.update((curr) => ({
      ...curr,
      [id]: !curr[id],
    }));
  }

  getThemeDef(themeId: CardTheme): CardThemeDef {
    return this.themes.find((t) => t.id === themeId) || this.themes[0];
  }

  formatDisplayNumber(cardNumber: string, revealed: boolean): string {
    const raw = (cardNumber || '').replace(/\D/g, '');
    if (!raw) return '•••• •••• •••• ••••';

    if (revealed) {
      return formatCardNumber(raw);
    }

    if (raw.length <= 4) {
      return raw;
    }
    const last4 = raw.slice(-4);
    const hiddenLength = raw.length - 4;
    const bullets = '•'.repeat(hiddenLength);
    const maskedRaw = bullets + last4;
    return maskedRaw.replace(/(.{4})/g, '$1 ').trim();
  }

  formatExpiry(month: string, year: string): string {
    const m = (month || '••').padStart(2, '0');
    let y = year || '••';
    if (y.length === 4) y = y.slice(2);
    return `${m}/${y}`;
  }

  openAddModal(presetCategory: CardCategory = 'personal', presetType: CardType = 'credit'): void {
    this.editingCardId.set(null);
    this.draft.set({
      ...DEFAULT_DRAFT,
      cardCategory: presetCategory,
      cardType: presetType,
      theme: 'midnight',
    });
    this.isModalOpen.set(true);
  }

  openEditModal(card: CardItem): void {
    this.editingCardId.set(card.id);
    this.draft.set({
      cardCategory: card.cardCategory || 'personal',
      cardType: card.cardType,
      belongsTo: card.belongsTo || '',
      bankName: card.bankName,
      nickname: card.nickname,
      cardholderName: card.cardholderName,
      cardNumber: card.cardNumber,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cvv: card.cvv,
      network: card.network,
      theme: card.theme,
      billingDate: card.billingDate || '',
      dueDate: card.dueDate || '',
      creditLimit: card.creditLimit || '',
      notes: card.notes || '',
      isFavorite: card.isFavorite,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingCardId.set(null);
  }

  onDraftNumberChange(value: string): void {
    const cleaned = value.replace(/\D/g, '').slice(0, 19);
    const detected = detectCardNetwork(cleaned);
    this.draft.update((d) => ({
      ...d,
      cardNumber: cleaned,
      network: detected !== 'other' ? detected : d.network,
    }));
  }

  onDraftExpiryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '').slice(0, 4);
    if (val.length > 2) {
      input.value = `${val.slice(0, 2)}/${val.slice(2)}`;
    } else {
      input.value = val;
    }

    const month = val.slice(0, 2);
    const year = val.length > 2 ? val.slice(2) : '';
    this.draft.update((d) => ({
      ...d,
      expiryMonth: month,
      expiryYear: year,
    }));
  }

  setDraftCategory(category: CardCategory): void {
    this.draft.update((d) => ({ ...d, cardCategory: category }));
  }

  setDraftType(type: CardType): void {
    this.draft.update((d) => ({ ...d, cardType: type }));
  }

  setDraftTheme(themeId: CardTheme): void {
    this.draft.update((d) => ({ ...d, theme: themeId }));
  }

  saveCard(): void {
    const d = this.draft();
    const digits = d.cardNumber.replace(/\D/g, '');

    if (!digits || digits.length < 12) {
      this.toast.error('Please enter a valid card number (at least 12 digits)');
      return;
    }
    if (!d.bankName.trim()) {
      this.toast.error('Please enter the Bank or Issuer name');
      return;
    }

    const editId = this.editingCardId();
    if (editId) {
      this.cardService.updateCard(editId, {
        cardCategory: d.cardCategory,
        cardType: d.cardType,
        belongsTo: d.cardCategory === 'others' ? d.belongsTo.trim() : '',
        bankName: d.bankName.trim(),
        nickname: d.nickname.trim(),
        cardholderName: d.cardholderName.trim().toUpperCase(),
        cardNumber: digits,
        expiryMonth: d.expiryMonth.padStart(2, '0').slice(0, 2),
        expiryYear: d.expiryYear.slice(-2),
        cvv: d.cvv.trim(),
        network: d.network,
        theme: d.theme,
        billingDate: d.billingDate.trim(),
        dueDate: d.dueDate.trim(),
        creditLimit: d.creditLimit.trim(),
        notes: d.notes.trim(),
        isFavorite: d.isFavorite,
      });
    } else {
      this.cardService.addCard({
        cardCategory: d.cardCategory,
        cardType: d.cardType,
        belongsTo: d.cardCategory === 'others' ? d.belongsTo.trim() : '',
        bankName: d.bankName.trim(),
        nickname: d.nickname.trim(),
        cardholderName: d.cardholderName.trim().toUpperCase(),
        cardNumber: digits,
        expiryMonth: d.expiryMonth.padStart(2, '0').slice(0, 2),
        expiryYear: d.expiryYear.slice(-2),
        cvv: d.cvv.trim(),
        network: d.network,
        theme: d.theme,
        billingDate: d.billingDate.trim(),
        dueDate: d.dueDate.trim(),
        creditLimit: d.creditLimit.trim(),
        notes: d.notes.trim(),
        isFavorite: d.isFavorite,
      });
    }

    this.closeModal();
  }

  deleteCard(card: CardItem): void {
    const name = card.nickname || `${card.bankName} card`;
    if (confirm(`Are you sure you want to delete "${name}" from your vault?`)) {
      this.cardService.deleteCard(card.id);
    }
  }

  copyToClipboard(text: string, label: string, key: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        this.copiedKey.set(key);
        this.toast.success(`${label} copied to clipboard`);
        setTimeout(() => {
          if (this.copiedKey() === key) {
            this.copiedKey.set(null);
          }
        }, 1500);
      },
      () => {
        this.toast.error('Failed to copy to clipboard');
      }
    );
  }
}
