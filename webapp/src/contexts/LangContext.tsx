import { createContext, useContext, useState, ReactNode } from 'react';

export type Lang = 'ru' | 'en';

const T = {
  ru: {
    // Statuses
    status_P: 'Ожидание',
    status_O: 'Обработка',
    status_C: 'Выполнено',
    status_F: 'Ошибка',
    status_U: 'Неизвестно',
    // Operation kinds
    kind_DE: 'Пополнение',
    kind_WI: 'Вывод',
    kind_CO: 'Выпуск карты',
    kind_CT: 'Пополнение карты',
    kind_CB: 'Заморозка карты',
    kind_CR: 'Разморозка карты',
    kind_CC: 'Закрытие карты',
    // History page
    filter_type: 'Тип операции',
    filter_status: 'Статус',
    no_ops: 'Операций пока нет',
    total: 'всего',
    prev: 'Назад',
    next: 'Далее',
    history_title: 'История',
    // Dashboard
    available: 'Доступно',
    total_balance: 'Общий баланс',
    greeting: 'Привет',
    recent_ops: 'Последние операции',
    all: 'Все',
    active_cards: 'Ваши карты',
    all_cards: 'Все карты',
    action_deposit: 'Пополнить',
    action_withdraw: 'Вывести',
    action_new_card: 'Новая карта',
    action_my_cards: 'Мои карты',
    action_history: 'История',
  },
  en: {
    status_P: 'Pending',
    status_O: 'Processing',
    status_C: 'Complete',
    status_F: 'Failed',
    status_U: 'Unknown',
    kind_DE: 'Deposit',
    kind_WI: 'Withdrawal',
    kind_CO: 'Card Issue',
    kind_CT: 'Card Topup',
    kind_CB: 'Card Block',
    kind_CR: 'Card Restore',
    kind_CC: 'Card Close',
    filter_type: 'Type',
    filter_status: 'Status',
    no_ops: 'No operations yet',
    total: 'total',
    prev: 'Prev',
    next: 'Next',
    history_title: 'History',
    available: 'Available',
    total_balance: 'Total balance',
    greeting: 'Hello',
    recent_ops: 'Recent activity',
    all: 'All',
    active_cards: 'Your cards',
    all_cards: 'All cards',
    action_deposit: 'Deposit',
    action_withdraw: 'Withdraw',
    action_new_card: 'New card',
    action_my_cards: 'My cards',
    action_history: 'History',
  },
} as const;

type TKey = keyof typeof T.ru;

interface LangContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TKey) => string;
}

const LangContext = createContext<LangContextType>({
  lang: 'ru',
  toggleLang: () => {},
  t: (key) => T.ru[key],
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ru');
  const toggleLang = () => setLang((l) => (l === 'ru' ? 'en' : 'ru'));
  const t = (key: TKey): string => T[lang][key];
  return <LangContext.Provider value={{ lang, toggleLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
