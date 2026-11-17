// Rayons, dans l'ordre approximatif d'un parcours en magasin, avec leur couleur.
export const CATEGORIES = [
  { id: 'fruits', color: '#4ade80', label: 'Fruits & légumes', emoji: '🥦', words: [
    'pomme', 'poire', 'banane', 'orange', 'citron', 'clementine', 'mandarine', 'kiwi', 'fraise', 'framboise',
    'myrtille', 'raisin', 'peche', 'abricot', 'prune', 'cerise', 'melon', 'pasteque', 'ananas', 'mangue',
    'avocat', 'tomate', 'salade', 'laitue', 'roquette', 'mache', 'epinard', 'carotte', 'courgette', 'aubergine',
    'poivron', 'concombre', 'oignon', 'echalote', 'ail', 'pomme de terre', 'patate', 'champignon', 'brocoli',
    'chou', 'poireau', 'haricot vert', 'petits pois', 'radis', 'betterave', 'celeri', 'fenouil', 'navet',
    'potiron', 'courge', 'butternut', 'persil', 'coriandre', 'basilic', 'menthe', 'ciboulette', 'gingembre',
    'fruit', 'legume', 'herbes'] },
  { id: 'boulangerie', color: '#f5a524', label: 'Boulangerie', emoji: '🥖', words: [
    'pain', 'baguette', 'croissant', 'brioche', 'viennoiserie', 'pain de mie', 'biscotte', 'tortilla', 'wrap',
    'pain au chocolat', 'chocolatine'] },
  { id: 'cremerie', color: '#facc15', label: 'Crèmerie & œufs', emoji: '🧀', words: [
    'lait', 'beurre', 'creme', 'yaourt', 'yogourt', 'fromage', 'emmental', 'comte', 'mozzarella', 'parmesan',
    'feta', 'chevre', 'camembert', 'brie', 'raclette', 'ricotta', 'mascarpone', 'skyr', 'oeuf', 'oeufs',
    'fromage blanc', 'petit suisse', 'kefir', 'gruyere', 'cheddar', 'roquefort', 'reblochon'] },
  { id: 'boucherie', color: '#f87171', label: 'Viande & poisson', emoji: '🥩', words: [
    'poulet', 'boeuf', 'steak', 'viande', 'porc', 'veau', 'agneau', 'dinde', 'canard', 'saucisse', 'merguez',
    'jambon', 'lardon', 'bacon', 'chorizo', 'saucisson', 'poisson', 'saumon', 'thon frais', 'cabillaud',
    'crevette', 'moule', 'escalope', 'cordon bleu', 'hache', 'charcuterie', 'filet', 'cuisse', 'roti', 'surimi'] },
  { id: 'epicerie', color: '#fb923c', label: 'Épicerie salée', emoji: '🥫', words: [
    'pates', 'spaghetti', 'penne', 'riz', 'semoule', 'quinoa', 'lentille', 'pois chiche', 'farine', 'huile',
    'vinaigre', 'sel', 'poivre', 'epice', 'moutarde', 'mayonnaise', 'ketchup', 'sauce', 'conserve', 'thon',
    'sardine', 'mais', 'olive', 'cornichon', 'bouillon', 'soupe', 'chips', 'cacahuete', 'aperitif', 'levure',
    'chapelure', 'coulis', 'pesto', 'curry', 'paprika', 'cumin', 'herbes de provence', 'nouilles', 'gnocchi'] },
  { id: 'sucre', color: '#e879f9', label: 'Épicerie sucrée', emoji: '🍫', words: [
    'sucre', 'chocolat', 'cafe', 'the', 'tisane', 'cereale', 'muesli', 'granola', 'flocons', 'avoine',
    'confiture', 'miel', 'nutella', 'pate a tartiner', 'biscuit', 'gateau', 'compote', 'bonbon', 'madeleine',
    'cacao', 'sirop', 'vanille', 'gaufre', 'crepe'] },
  { id: 'surgeles', color: '#38bdf8', label: 'Surgelés', emoji: '🧊', words: [
    'surgele', 'glace', 'pizza', 'frites', 'poelee', 'nuggets', 'sorbet', 'glacon', 'congele', 'batonnets'] },
  { id: 'boissons', color: '#2dd4bf', label: 'Boissons', emoji: '🧃', words: [
    'eau', 'jus', 'soda', 'coca', 'limonade', 'biere', 'vin', 'champagne', 'cidre', 'sirop', 'perrier',
    'boisson', 'lait d avoine', 'lait d amande', 'kombucha', 'ice tea'] },
  { id: 'hygiene', color: '#a78bfa', label: 'Hygiène & beauté', emoji: '🧴', words: [
    'shampoing', 'shampooing', 'apres shampoing', 'gel douche', 'savon', 'dentifrice', 'brosse a dents',
    'deodorant', 'coton', 'rasoir', 'mousse a raser', 'creme hydratante', 'serviette hygienique', 'tampon',
    'mouchoir', 'papier toilette', 'pq', 'demaquillant', 'fil dentaire', 'bain de bouche', 'protection'] },
  { id: 'maison', color: '#60a5fa', label: 'Maison & entretien', emoji: '🧽', words: [
    'lessive', 'adoucissant', 'liquide vaisselle', 'pastille lave vaisselle', 'tablette', 'eponge',
    'essuie tout', 'sac poubelle', 'javel', 'nettoyant', 'film alimentaire', 'papier aluminium', 'alu',
    'papier cuisson', 'ampoule', 'pile', 'vinaigre blanc', 'sopalin', 'allumette', 'bougie'] },
  { id: 'bebe', color: '#f9a8d4', label: 'Bébé & animaux', emoji: '🐾', words: [
    'couche', 'lingette', 'petit pot', 'lait infantile', 'croquette', 'litiere', 'patee', 'chien', 'chat'] },
  { id: 'autre', color: '#94a3b8', label: 'Autre', emoji: '🛒', words: [] },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/['’\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Retire un éventuel pluriel simple pour améliorer la correspondance.
function singular(word) {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

// Devine le rayon d'un article : correspondance de mot-clé la plus longue.
export function guessCategory(name) {
  const text = ` ${normalize(name).split(' ').map(singular).join(' ')} `;
  let best = null;
  let bestLen = 0;
  for (const cat of CATEGORIES) {
    for (const word of cat.words) {
      const w = ` ${word.split(' ').map(singular).join(' ')} `;
      if (text.includes(w) && w.length > bestLen) {
        best = cat.id;
        bestLen = w.length;
      }
    }
  }
  return best || 'autre';
}
