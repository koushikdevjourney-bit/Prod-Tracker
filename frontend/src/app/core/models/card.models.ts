export type CardCategory = 'personal' | 'others';

export type CardType = 'credit' | 'debit';

export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'discover' | 'other';

export type CardTheme =
  | 'midnight'
  | 'sapphire'
  | 'emerald'
  | 'amethyst'
  | 'crimson'
  | 'gold'
  | 'obsidian';

export interface CardItem {
  id: string;
  cardCategory: CardCategory; // 'personal' or 'others'
  cardType: CardType; // 'credit' or 'debit'
  belongsTo?: string; // If 'others', e.g. "Dad", "Mom", "Office / Company", "Friend"
  cardholderName: string;
  bankName: string;
  nickname: string;
  cardNumber: string; // 16 digits stored (or formatted)
  expiryMonth: string; // MM
  expiryYear: string; // YY
  cvv: string; // 3 or 4 digits
  network: CardNetwork;
  theme: CardTheme;
  billingDate?: string; // e.g. "15th"
  dueDate?: string; // e.g. "5th"
  creditLimit?: string; // e.g. "1,50,000"
  notes?: string;
  isFavorite: boolean;
  createdAt: string;
}

export interface CardThemeDef {
  id: CardTheme;
  name: string;
  gradient: string;
  textColor: string;
  accentColor: string;
}

export const CARD_THEMES: CardThemeDef[] = [
  {
    id: 'midnight',
    name: 'Midnight Black',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #090d16 100%)',
    textColor: '#f8fafc',
    accentColor: '#38bdf8',
  },
  {
    id: 'sapphire',
    name: 'Sapphire Blue',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0369a1 100%)',
    textColor: '#ffffff',
    accentColor: '#67e8f9',
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f766e 100%)',
    textColor: '#ffffff',
    accentColor: '#34d399',
  },
  {
    id: 'amethyst',
    name: 'Amethyst Violet',
    gradient: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #8b5cf6 100%)',
    textColor: '#ffffff',
    accentColor: '#c084fc',
  },
  {
    id: 'crimson',
    name: 'Crimson Ruby',
    gradient: 'linear-gradient(135deg, #881337 0%, #be123c 50%, #e11d48 100%)',
    textColor: '#ffffff',
    accentColor: '#fda4af',
  },
  {
    id: 'gold',
    name: 'Imperial Gold',
    gradient: 'linear-gradient(135deg, #78350f 0%, #b45309 45%, #d97706 75%, #f59e0b 100%)',
    textColor: '#ffffff',
    accentColor: '#fef08a',
  },
  {
    id: 'obsidian',
    name: 'Carbon Titanium',
    gradient: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)',
    textColor: '#f4f4f5',
    accentColor: '#a1a1aa',
  },
];
