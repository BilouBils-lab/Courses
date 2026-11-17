// Catalogue d'articles courants, par rayon, avec leur icône.
// Sert à l'écran « Catalogue » (ajout sans clavier) et aux icônes de la vue en tuiles.

import { CATEGORY_BY_ID, normalize } from './categories.js';

export const CATALOG = {
  fruits: [
    ['Pommes', '🍎'], ['Bananes', '🍌'], ['Oranges', '🍊'], ['Citrons', '🍋'], ['Poires', '🍐'],
    ['Raisin', '🍇'], ['Fraises', '🍓'], ['Kiwis', '🥝'], ['Avocats', '🥑'], ['Tomates', '🍅'],
    ['Salade', '🥬'], ['Carottes', '🥕'], ['Pommes de terre', '🥔'], ['Oignons', '🧅'], ['Ail', '🧄'],
    ['Courgettes', '🥒'], ['Concombre', '🥒'], ['Poivrons', '🫑'], ['Champignons', '🍄'], ['Brocoli', '🥦'],
    ['Herbes fraîches', '🌿'],
  ],
  boulangerie: [
    ['Pain', '🍞'], ['Baguette', '🥖'], ['Croissants', '🥐'], ['Pains au chocolat', '🥐'], ['Pain de mie', '🍞'],
    ['Brioche', '🍞'], ['Tortillas', '🌮'],
  ],
  cremerie: [
    ['Lait', '🥛'], ['Beurre', '🧈'], ['Œufs', '🥚'], ['Yaourts', '🥣'], ['Fromage', '🧀'],
    ['Fromage râpé', '🧀'], ['Mozzarella', '🧀'], ['Crème fraîche', '🥛'], ['Fromage blanc', '🥣'],
  ],
  boucherie: [
    ['Poulet', '🍗'], ['Steak haché', '🥩'], ['Viande', '🥩'], ['Jambon', '🍖'], ['Lardons', '🥓'],
    ['Saucisses', '🌭'], ['Poisson', '🐟'], ['Saumon', '🍣'], ['Crevettes', '🍤'],
  ],
  epicerie: [
    ['Pâtes', '🍝'], ['Riz', '🍚'], ['Farine', '🌾'], ['Huile', '🫒'], ['Sel', '🧂'],
    ['Conserves', '🥫'], ['Sauce tomate', '🥫'], ['Thon', '🐟'], ['Lentilles', '🫘'], ['Chips', '🍟'],
    ['Ketchup', '🍅'],
  ],
  sucre: [
    ['Café', '☕'], ['Thé', '🍵'], ['Sucre', '🍬'], ['Chocolat', '🍫'], ['Biscuits', '🍪'],
    ['Céréales', '🥣'], ['Confiture', '🫙'], ['Miel', '🍯'], ['Gâteaux', '🍰'], ['Bonbons', '🍬'],
  ],
  surgeles: [
    ['Glace', '🍦'], ['Pizza', '🍕'], ['Frites', '🍟'], ['Légumes surgelés', '🥦'], ['Poisson pané', '🐟'],
    ['Glaçons', '🧊'],
  ],
  boissons: [
    ['Eau', '💧'], ['Eau gazeuse', '🫧'], ['Jus d\'orange', '🧃'], ['Soda', '🥤'], ['Bière', '🍺'],
    ['Vin', '🍷'], ['Lait d\'avoine', '🥛'],
  ],
  hygiene: [
    ['Papier toilette', '🧻'], ['Dentifrice', '🪥'], ['Gel douche', '🧴'], ['Shampoing', '🧴'], ['Savon', '🧼'],
    ['Déodorant', '🧴'], ['Mouchoirs', '🤧'], ['Rasoirs', '🪒'],
  ],
  maison: [
    ['Lessive', '🧺'], ['Liquide vaisselle', '🧽'], ['Éponges', '🧽'], ['Sacs poubelle', '🗑️'], ['Essuie-tout', '🧻'],
    ['Piles', '🔋'], ['Ampoules', '💡'],
  ],
  bebe: [
    ['Couches', '🧷'], ['Lingettes', '🧻'], ['Croquettes', '🦴'], ['Litière', '🐱'],
  ],
  autre: [],
};

// Clé de comparaison : minuscules, sans accents, au singulier (« Pommes » = « pomme »).
const singular = (w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
export const nameKey = (name) => normalize(name).split(' ').map(singular).join(' ');

const BY_KEY = new Map();   // nom complet → icône
const BY_WORD = new Map();  // premier mot → icône (« Lait demi-écrémé » → 🥛)
for (const items of Object.values(CATALOG)) {
  for (const [name, emoji] of items) {
    const key = nameKey(name);
    BY_KEY.set(key, emoji);
    const first = key.split(' ')[0];
    if (!BY_WORD.has(first)) BY_WORD.set(first, emoji);
  }
}

// Icône d'un article : nom connu, sinon un de ses mots, sinon celle du rayon.
export function iconFor(name, category) {
  const key = nameKey(name);
  if (BY_KEY.has(key)) return BY_KEY.get(key);
  for (const word of key.split(' ')) if (BY_WORD.has(word)) return BY_WORD.get(word);
  return (CATEGORY_BY_ID[category] || CATEGORY_BY_ID.autre).emoji;
}
