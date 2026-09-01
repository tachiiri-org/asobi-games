// ともだちのペット。pet.html から中身をそのまま移した。

import type { Friend } from './types';

export const FRIENDS: readonly Friend[] = [
    { id: 'puni',  name: 'ぷにたん',  col: '#f9a8d4', dark: '#ec4899', belly: '#fce7f3', ear: 'round',
      mark: 'none',   seed: 0, likes: '🍰', spots: ['park', 'out', 'shop'] },
    { id: 'kuro',  name: 'くろまる',  col: '#64748b', dark: '#334155', belly: '#cbd5e1', ear: 'cat',
      mark: 'none',   seed: 1, likes: '🐟', spots: ['shrine', 'park', 'library'] },
    { id: 'piyo',  name: 'ぴよ',      col: '#fcd34d', dark: '#f59e0b', belly: '#fef3c7', ear: 'bird',
      mark: 'none',   seed: 2, likes: '🌽', spots: ['school', 'zoo', 'park'] },
    { id: 'moko',  name: 'もこすけ',  col: '#fde68a', dark: '#d97706', belly: '#fffbeb', ear: 'fluffy',
      mark: 'none',   seed: 3, likes: '🍯', spots: ['beach', 'onsen', 'out'] },
    { id: 'aoba',  name: 'あおば',    col: '#5eead4', dark: '#0d9488', belly: '#ccfbf1', ear: 'long',
      mark: 'none',   seed: 4, likes: '🍡', spots: ['mountain', 'aqua', 'park'] },
    { id: 'kira',  name: 'きらり',    col: '#c4b5fd', dark: '#7c3aed', belly: '#ede9fe', ear: 'horn',
      mark: 'star',   seed: 5, likes: '🍭', spots: ['fun', 'cinema', 'shop'] },
    { id: 'daifu', name: 'だいふく',  col: '#f8fafc', dark: '#94a3b8', belly: '#ffffff', ear: 'round',
      mark: 'none',   seed: 6, likes: '🍙', spots: ['living', 'school', 'bank'] },
    { id: 'koharu',name: 'こはる',    col: '#fdba74', dark: '#ea580c', belly: '#ffedd5', ear: 'long',
      mark: 'flower', seed: 7, likes: '🍓', spots: ['library', 'school', 'out'] }
];
