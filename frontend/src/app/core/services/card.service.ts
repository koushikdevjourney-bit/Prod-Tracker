import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/categories';
import { CardCategory, CardItem, CardNetwork, CardTheme, CardType } from '../models/card.models';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';
import { createId } from '../utils/stats.utils';

export function detectCardNetwork(cardNumber: string): CardNetwork {
  const digits = cardNumber.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^(60|65|81|82)/.test(digits)) return 'rupay';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'discover';
  return 'other';
}

export function formatCardNumber(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function cleanCards(raw: unknown): CardItem[] {
  if (!Array.isArray(raw)) return [];
  const validCategories: CardCategory[] = ['personal', 'others'];
  const validTypes: CardType[] = ['credit', 'debit'];
  const validNetworks: CardNetwork[] = ['visa', 'mastercard', 'rupay', 'amex', 'discover', 'other'];
  const validThemes: CardTheme[] = ['midnight', 'sapphire', 'emerald', 'amethyst', 'crimson', 'gold', 'obsidian'];

  return raw.map((item) => {
    const cardCategory: CardCategory = validCategories.includes(item?.cardCategory) ? item.cardCategory : 'personal';
    const cardType: CardType = validTypes.includes(item?.cardType) ? item.cardType : 'credit';
    const network: CardNetwork = validNetworks.includes(item?.network) ? item.network : 'visa';
    const theme: CardTheme = validThemes.includes(item?.theme) ? item.theme : 'midnight';

    return {
      id: String(item?.id || createId()),
      cardCategory,
      cardType,
      belongsTo: String(item?.belongsTo || '').trim().slice(0, 100),
      cardholderName: String(item?.cardholderName || '').trim().slice(0, 100),
      bankName: String(item?.bankName || '').trim().slice(0, 100),
      nickname: String(item?.nickname || '').trim().slice(0, 100),
      cardNumber: String(item?.cardNumber || '').replace(/\D/g, '').slice(0, 19),
      expiryMonth: String(item?.expiryMonth || '').padStart(2, '0').slice(0, 2),
      expiryYear: String(item?.expiryYear || '').slice(0, 4),
      cvv: String(item?.cvv || '').slice(0, 4),
      network,
      theme,
      billingDate: String(item?.billingDate || '').trim().slice(0, 20),
      dueDate: String(item?.dueDate || '').trim().slice(0, 20),
      creditLimit: String(item?.creditLimit || '').trim().slice(0, 50),
      notes: String(item?.notes || '').trim().slice(0, 500),
      isFavorite: Boolean(item?.isFavorite),
      createdAt: item?.createdAt ? String(item.createdAt) : new Date().toISOString(),
    };
  });
}

export type CardFilterTab = 'all' | 'personal' | 'others' | 'credit' | 'debit' | 'favorites';

@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);

  private readonly _cards = signal<CardItem[]>(
    cleanCards(this.store.get<CardItem[]>(STORAGE_KEYS.cards, []))
  );

  readonly cards = this._cards.asReadonly();
  readonly filterTab = signal<CardFilterTab>('all');
  readonly searchQuery = signal<string>('');
  readonly maskSensitives = signal<boolean>(true);
  readonly isLoading = signal<boolean>(false);

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filteredCards = computed(() => {
    let list = this._cards();
    const tab = this.filterTab();
    const query = this.searchQuery().trim().toLowerCase();

    if (tab === 'personal') {
      list = list.filter((c) => c.cardCategory === 'personal');
    } else if (tab === 'others') {
      list = list.filter((c) => c.cardCategory === 'others');
    } else if (tab === 'credit') {
      list = list.filter((c) => c.cardType === 'credit');
    } else if (tab === 'debit') {
      list = list.filter((c) => c.cardType === 'debit');
    } else if (tab === 'favorites') {
      list = list.filter((c) => c.isFavorite);
    }

    if (query) {
      list = list.filter((c) => {
        const last4 = c.cardNumber.slice(-4);
        return (
          c.bankName.toLowerCase().includes(query) ||
          c.nickname.toLowerCase().includes(query) ||
          c.cardholderName.toLowerCase().includes(query) ||
          (c.belongsTo && c.belongsTo.toLowerCase().includes(query)) ||
          c.network.toLowerCase().includes(query) ||
          c.cardNumber.includes(query) ||
          last4.includes(query)
        );
      });
    }

    // Sort favorites first, then by createdAt desc
    return [...list].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  // Grouped cards for the 2 distinct sections (Personal & Others), each with separate Credit & Debit
  readonly personalCreditCards = computed(() =>
    this.filteredCards().filter((c) => c.cardCategory === 'personal' && c.cardType === 'credit')
  );

  readonly personalDebitCards = computed(() =>
    this.filteredCards().filter((c) => c.cardCategory === 'personal' && c.cardType === 'debit')
  );

  readonly othersCreditCards = computed(() =>
    this.filteredCards().filter((c) => c.cardCategory === 'others' && c.cardType === 'credit')
  );

  readonly othersDebitCards = computed(() =>
    this.filteredCards().filter((c) => c.cardCategory === 'others' && c.cardType === 'debit')
  );

  readonly stats = computed(() => {
    const all = this._cards();
    const personal = all.filter((c) => c.cardCategory === 'personal');
    const others = all.filter((c) => c.cardCategory === 'others');

    return {
      total: all.length,
      personalTotal: personal.length,
      personalCredit: personal.filter((c) => c.cardType === 'credit').length,
      personalDebit: personal.filter((c) => c.cardType === 'debit').length,
      othersTotal: others.length,
      othersCredit: others.filter((c) => c.cardType === 'credit').length,
      othersDebit: others.filter((c) => c.cardType === 'debit').length,
      creditCount: all.filter((c) => c.cardType === 'credit').length,
      debitCount: all.filter((c) => c.cardType === 'debit').length,
      favoritesCount: all.filter((c) => c.isFavorite).length,
    };
  });

  constructor() {
    this.fetchFromApi();
  }

  fetchFromApi(): void {
    this.isLoading.set(true);
    this.api.getCards().subscribe({
      next: (cards) => {
        if (Array.isArray(cards) && cards.length > 0) {
          this.hydrate(cards);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  hydrate(cards: CardItem[] | null | undefined): void {
    const cleaned = cleanCards(cards || []);
    this._cards.set(cleaned);
    this.store.set(STORAGE_KEYS.cards, cleaned);
  }

  resetLocal(): void {
    this._cards.set([]);
    this.store.remove(STORAGE_KEYS.cards);
  }

  toggleMask(): void {
    this.maskSensitives.update((val) => !val);
  }

  setFilterTab(tab: CardFilterTab): void {
    this.filterTab.set(tab);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  addCard(payload: Omit<CardItem, 'id' | 'createdAt'>): CardItem {
    const digits = payload.cardNumber.replace(/\D/g, '');
    const detectedNet = detectCardNetwork(digits);
    const newCard: CardItem = {
      ...payload,
      id: createId(),
      cardNumber: digits,
      network: payload.network && payload.network !== 'other' ? payload.network : detectedNet,
      createdAt: new Date().toISOString(),
    };

    const next = [newCard, ...this._cards()];
    this.commit(next);
    this.toast.success(`Card "${newCard.nickname || newCard.bankName || 'New Card'}" added`);
    return newCard;
  }

  updateCard(id: string, patch: Partial<CardItem>): void {
    const curr = this._cards();
    const idx = curr.findIndex((c) => c.id === id);
    if (idx === -1) return;

    const existing = curr[idx];
    const digits = patch.cardNumber !== undefined ? patch.cardNumber.replace(/\D/g, '') : existing.cardNumber;
    const network = patch.network !== undefined ? patch.network : (patch.cardNumber ? detectCardNetwork(digits) : existing.network);

    const updated: CardItem = {
      ...existing,
      ...patch,
      cardNumber: digits,
      network,
    };

    const next = [...curr];
    next[idx] = updated;
    this.commit(next);
    this.toast.success('Card details updated');
  }

  deleteCard(id: string): void {
    const curr = this._cards();
    const target = curr.find((c) => c.id === id);
    const next = curr.filter((c) => c.id !== id);
    this.commit(next);
    this.toast.success(`Card ${target?.nickname || target?.bankName || ''} deleted`);
  }

  toggleFavorite(id: string): void {
    const curr = this._cards();
    const next = curr.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c));
    this.commit(next);
  }

  private commit(cards: CardItem[]): void {
    this._cards.set(cards);
    this.store.set(STORAGE_KEYS.cards, cards);

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.api.saveCards(cards).subscribe({
        error: (err) => {
          this.toast.error(apiErrorMessage(err, 'Failed to sync cards to cloud'));
        },
      });
    }, 400);
  }
}
