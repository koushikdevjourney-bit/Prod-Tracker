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

export interface PersonGroup {
  name: string;
  creditCards: CardItem[];
  debitCards: CardItem[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);

  private readonly _cards = signal<CardItem[]>(
    cleanCards(this.store.get<CardItem[]>(STORAGE_KEYS.cards, []))
  );

  private readonly _persons = signal<string[]>(
    this.store.get<string[]>(STORAGE_KEYS.cardPersons, [])
  );

  readonly cards = this._cards.asReadonly();
  readonly mainView = signal<'personal' | 'others'>('personal');
  readonly personalSubTab = signal<'all' | 'credit' | 'debit'>('all');
  readonly othersSubTab = signal<'all' | 'credit' | 'debit'>('all');
  readonly selectedPerson = signal<string>('all');
  readonly searchQuery = signal<string>('');
  readonly maskSensitives = signal<boolean>(true);
  readonly isLoading = signal<boolean>(false);

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  // All unique persons (combines stored persons with any cards belonging to someone)
  readonly allPersons = computed(() => {
    const list = [...this._persons()];
    for (const card of this._cards()) {
      if (card.cardCategory === 'others' && card.belongsTo?.trim()) {
        const name = card.belongsTo.trim();
        if (!list.some((p) => p.toLowerCase() === name.toLowerCase())) {
          list.push(name);
        }
      }
    }
    return list;
  });

  // Filter helper by search query
  private cardMatchesQuery(card: CardItem, query: string): boolean {
    if (!query) return true;
    const last4 = card.cardNumber.slice(-4);
    return (
      card.bankName.toLowerCase().includes(query) ||
      card.nickname.toLowerCase().includes(query) ||
      card.cardholderName.toLowerCase().includes(query) ||
      (card.belongsTo && card.belongsTo.toLowerCase().includes(query)) ||
      card.network.toLowerCase().includes(query) ||
      card.cardNumber.includes(query) ||
      last4.includes(query)
    );
  }

  // Personal filtered cards
  readonly personalCards = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const subTab = this.personalSubTab();
    return this._cards()
      .filter((c) => c.cardCategory === 'personal')
      .filter((c) => {
        if (subTab === 'credit') return c.cardType === 'credit';
        if (subTab === 'debit') return c.cardType === 'debit';
        return true;
      })
      .filter((c) => this.cardMatchesQuery(c, query))
      .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  });

  readonly personalCreditCards = computed(() =>
    this.personalCards().filter((c) => c.cardType === 'credit')
  );

  readonly personalDebitCards = computed(() =>
    this.personalCards().filter((c) => c.cardType === 'debit')
  );

  // Persons grouped for Others section
  readonly personsWithCards = computed<PersonGroup[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const subTab = this.othersSubTab();
    const activePerson = this.selectedPerson();
    const personsList = this.allPersons();
    const othersCards = this._cards().filter((c) => c.cardCategory === 'others');

    // Build groups for registered persons
    const groups: PersonGroup[] = [];

    for (const person of personsList) {
      if (activePerson !== 'all' && activePerson.toLowerCase() !== person.toLowerCase()) {
        continue;
      }

      const pCards = othersCards.filter(
        (c) => (c.belongsTo || '').toLowerCase() === person.toLowerCase()
      );

      const matchingCards = pCards.filter((c) => this.cardMatchesQuery(c, query));

      const creditCards = matchingCards.filter((c) => {
        if (subTab === 'debit') return false;
        return c.cardType === 'credit';
      });

      const debitCards = matchingCards.filter((c) => {
        if (subTab === 'credit') return false;
        return c.cardType === 'debit';
      });

      // If search query is active and this person has 0 matching cards, skip
      if (query && creditCards.length === 0 && debitCards.length === 0) {
        continue;
      }

      groups.push({
        name: person,
        creditCards,
        debitCards,
        totalCount: creditCards.length + debitCards.length,
      });
    }

    // Also check for unassigned cards (e.g. belongsTo was empty)
    const unassignedCards = othersCards
      .filter((c) => !c.belongsTo || !c.belongsTo.trim())
      .filter((c) => this.cardMatchesQuery(c, query));

    if (unassignedCards.length > 0 && (activePerson === 'all' || activePerson === 'General')) {
      const creditCards = unassignedCards.filter((c) => {
        if (subTab === 'debit') return false;
        return c.cardType === 'credit';
      });
      const debitCards = unassignedCards.filter((c) => {
        if (subTab === 'credit') return false;
        return c.cardType === 'debit';
      });
      if (creditCards.length > 0 || debitCards.length > 0) {
        groups.push({
          name: 'General / Unassigned',
          creditCards,
          debitCards,
          totalCount: creditCards.length + debitCards.length,
        });
      }
    }

    return groups;
  });

  // Overall statistics
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
      personsCount: this.allPersons().length,
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
        if (Array.isArray(cards)) {
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

    // Ensure any belongsTo are in persons list
    const currentPersons = [...this._persons()];
    let updated = false;
    for (const c of cleaned) {
      if (c.cardCategory === 'others' && c.belongsTo?.trim()) {
        const name = c.belongsTo.trim();
        if (!currentPersons.some((p) => p.toLowerCase() === name.toLowerCase())) {
          currentPersons.push(name);
          updated = true;
        }
      }
    }
    if (updated) {
      this._persons.set(currentPersons);
      this.store.set(STORAGE_KEYS.cardPersons, currentPersons);
    }
  }

  resetLocal(): void {
    this._cards.set([]);
    this._persons.set([]);
    this.store.remove(STORAGE_KEYS.cards);
    this.store.remove(STORAGE_KEYS.cardPersons);
  }

  toggleMask(): void {
    this.maskSensitives.update((val) => !val);
  }

  setMainView(view: 'personal' | 'others'): void {
    this.mainView.set(view);
  }

  setPersonalSubTab(tab: 'all' | 'credit' | 'debit'): void {
    this.personalSubTab.set(tab);
  }

  setOthersSubTab(tab: 'all' | 'credit' | 'debit'): void {
    this.othersSubTab.set(tab);
  }

  setSelectedPerson(person: string): void {
    this.selectedPerson.set(person);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  // --- PERSON MANAGEMENT ---
  addPerson(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) {
      this.toast.error('Please enter a valid person name');
      return false;
    }
    const current = this.allPersons();
    if (current.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      this.toast.error(`"${trimmed}" already exists`);
      return false;
    }

    const next = [...this._persons(), trimmed];
    this._persons.set(next);
    this.store.set(STORAGE_KEYS.cardPersons, next);
    this.toast.success(`Person "${trimmed}" added! Now add their cards below.`);
    return true;
  }

  renamePerson(oldName: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    if (oldName.toLowerCase() === trimmed.toLowerCase()) return true;

    // Update in persons list
    const updatedPersons = this._persons().map((p) =>
      p.toLowerCase() === oldName.toLowerCase() ? trimmed : p
    );
    this._persons.set(updatedPersons);
    this.store.set(STORAGE_KEYS.cardPersons, updatedPersons);

    // Update all cards belonging to this person
    const updatedCards = this._cards().map((c) => {
      if (c.cardCategory === 'others' && (c.belongsTo || '').toLowerCase() === oldName.toLowerCase()) {
        return { ...c, belongsTo: trimmed };
      }
      return c;
    });

    this.commit(updatedCards);
    if (this.selectedPerson().toLowerCase() === oldName.toLowerCase()) {
      this.selectedPerson.set(trimmed);
    }
    this.toast.success(`Renamed "${oldName}" to "${trimmed}"`);
    return true;
  }

  deletePerson(name: string): void {
    const trimmed = name.trim();
    // Remove from persons list
    const nextPersons = this._persons().filter((p) => p.toLowerCase() !== trimmed.toLowerCase());
    this._persons.set(nextPersons);
    this.store.set(STORAGE_KEYS.cardPersons, nextPersons);

    // Remove or reassign cards
    const cardsBelonging = this._cards().filter(
      (c) => c.cardCategory === 'others' && (c.belongsTo || '').toLowerCase() === trimmed.toLowerCase()
    );

    if (cardsBelonging.length > 0) {
      const nextCards = this._cards().filter(
        (c) => !(c.cardCategory === 'others' && (c.belongsTo || '').toLowerCase() === trimmed.toLowerCase())
      );
      this.commit(nextCards);
    }

    if (this.selectedPerson().toLowerCase() === trimmed.toLowerCase()) {
      this.selectedPerson.set('all');
    }
    this.toast.success(`Removed "${trimmed}" and their cards`);
  }

  // --- CARD MANAGEMENT ---
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

    // If it's an others card with belongsTo, ensure person is registered
    if (newCard.cardCategory === 'others' && newCard.belongsTo?.trim()) {
      const pName = newCard.belongsTo.trim();
      if (!this._persons().some((p) => p.toLowerCase() === pName.toLowerCase())) {
        const nextP = [...this._persons(), pName];
        this._persons.set(nextP);
        this.store.set(STORAGE_KEYS.cardPersons, nextP);
      }
    }

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

    // If updated belongsTo, ensure person is registered
    if (updated.cardCategory === 'others' && updated.belongsTo?.trim()) {
      const pName = updated.belongsTo.trim();
      if (!this._persons().some((p) => p.toLowerCase() === pName.toLowerCase())) {
        const nextP = [...this._persons(), pName];
        this._persons.set(nextP);
        this.store.set(STORAGE_KEYS.cardPersons, nextP);
      }
    }

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
