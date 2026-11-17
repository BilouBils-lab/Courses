// Analyse d'une saisie (clavier, micro ou Siri) en un ou plusieurs articles.
// « du lait, des œufs et deux baguettes » →
//   [{name:'Lait'}, {name:'Œufs'}, {name:'Baguettes', qty:'2'}]
// La dictée de l'iPhone ne met souvent aucune ponctuation : « du lait des œufs du beurre »
// ou même « lait œufs beurre ». On découpe donc aussi sur les articles, les nombres
// et, pour la voix, sur les noms de produits connus.

import { CATEGORIES, normalize } from './categories.js';

const NUMBERS = {
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100,
};

const UNIT = '(?:kg|kilos?|kilogrammes?|g|gr|grammes?|l|litres?|cl|ml|x|pcs?|paquets?|boites?|boîtes?|bouteilles?|packs?|pots?|sachets?|tranches?|barquettes?|douzaines?)';

// Articles et formules de politesse en tête d'article.
const LEADING = /^(?:(?:et|puis|aussi|ajoute|ajouter|rajoute|il faut|il me faut|il nous faut|acheter|prendre)\s+)*(?:(?:du|de la|des|le|la|les|un|une|un peu de|quelques)\s+|(?:de l|d|l)['’]\s*)/i;

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function wordsToDigits(text) {
  return text.replace(/\b([a-zé]+)\b/gi, (w) => (NUMBERS[w.toLowerCase()] ? String(NUMBERS[w.toLowerCase()]) : w));
}

// Un seul article : extrait la quantité. « 2 lait », « lait x2 », « farine 500g », « 1,5 kg de pommes »
export function parseOne(text) {
  let raw = wordsToDigits(text.trim().replace(/\s+/g, ' ')).replace(/[.!?]+$/, '')
    // « une douzaine d'œufs », « un litre de lait » → quantité 1
    .replace(new RegExp(`^(?:un|une)\\s+(?=${UNIT}\\s)`, 'i'), '1 ');
  let qty = '';
  let m = raw.match(new RegExp(`^(\\d+(?:[.,]\\d+)?\\s?${UNIT}?)\\s+(?:de |d'|d’)?(.+)$`, 'i'));
  if (m) { qty = m[1].trim(); raw = m[2]; } else {
    m = raw.match(new RegExp(`^(.+?)\\s+(x\\s?\\d+|\\d+(?:[.,]\\d+)?\\s?${UNIT}?)$`, 'i'));
    if (m) { qty = m[2].replace(/^x\s?/i, '').trim(); raw = m[1]; }
  }
  let name = raw;
  // Retire les articles (« des œufs » → « œufs »), plusieurs fois si besoin (« et des »).
  for (let i = 0; i < 3; i++) name = name.replace(LEADING, '');
  name = name.trim();
  if (!name) return null;
  return { name: capitalize(name), qty };
}

// ---------------------------------------------------------------- Découpage

const singular = (w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
const norm = (text) => normalize(text).split(' ').map(singular).join(' ');

// Mots qui précisent l'article précédent (« steak haché », « crème fraîche »).
const ADJECTIVES = new Set([
  'hache', 'hachee', 'frai', 'fraiche', 'bio', 'nature', 'complet', 'complete', 'entier', 'entiere',
  'ecreme', 'demi', 'rape', 'rapee', 'blanc', 'blanche', 'rouge', 'vert', 'verte', 'noir', 'noire',
  'surgele', 'surgelee', 'gazeuse', 'plate', 'allege', 'allegee', 'light', 'zero', 'fume', 'fumee',
  'cuit', 'cuite', 'cru', 'crue', 'grec', 'grecque', 'roux', 'glace', 'moulu', 'basmati', 'thai',
  'liquide', 'epaisse', 'petit', 'petite', 'grand', 'grande', 'gros', 'grosse', 'mini', 'maxi',
].map(singular));

// Produits composés de plusieurs mots connus, à ne pas couper.
const COMPOUNDS = [
  'sauce tomate', 'coulis de tomate', 'concentre de tomate', 'jus d orange', 'jus de pomme', 'jus de fruit',
  'compote de pomme', 'lait de coco', 'creme de coco', 'poulet roti', 'pate brisee', 'pate feuilletee',
  'pate a pizza', 'pate sablee', 'sauce soja', 'vinaigre balsamique', 'haricot rouge', 'sucre glace',
  'sucre roux', 'chocolat noir', 'chocolat au lait', 'the vert', 'fromage rape', 'fromage blanc',
  'eau gazeuse', 'eau plate', 'tomate cerise', 'pain complet', 'pain de mie', 'yaourt nature', 'oeuf frai',
];

const KEYWORDS = new Set([
  ...CATEGORIES.flatMap((c) => c.words),
  ...COMPOUNDS,
].map(norm));
const MAX_KEYWORD_WORDS = Math.max(...[...KEYWORDS].map((k) => k.split(' ').length));

const ARTICLES = new Set(['du', 'des', 'le', 'la', 'les', 'un', 'une']);
// Après ces mots, un article fait partie du nom (« sauce à la tomate », « pommes de terre »).
const LINKS = new Set(['de', 'à', 'a', 'au', 'aux', 'en', 'pour', 'sans', 'avec', 'sur']);
const isNumber = (w) => /^\d+([.,]\d+)?$/.test(w) || NUMBERS[w.toLowerCase()] !== undefined;
const isUnit = (w) => new RegExp(`^${UNIT}$`, 'i').test(w);

// Coupe avant chaque article ou nombre qui commence visiblement un nouvel article.
function splitOnMarkers(chunk) {
  const words = chunk.split(' ').filter(Boolean);
  const parts = [];
  let current = [];
  words.forEach((word, i) => {
    const lower = word.toLowerCase();
    const prev = (words[i - 1] || '').toLowerCase();
    const next = words[i + 1];
    const startsArticle = ARTICLES.has(lower) || (lower === 'de' && ['la', "l'", 'l’'].includes((next || '').toLowerCase()))
      || /^l['’]./.test(lower);
    // Un nombre en fin de phrase est une quantité (« lait 2 »), pas un nouvel article.
    const startsNumber = isNumber(word) && next !== undefined && !(isUnit(next) && i + 2 === words.length);
    const newItem = current.length > 0 && !LINKS.has(prev) && prev !== 'de' && !ARTICLES.has(prev)
      && !isNumber(prev) && (startsArticle || startsNumber);
    if (newItem) { parts.push(current.join(' ')); current = []; }
    current.push(word);
  });
  if (current.length) parts.push(current.join(' '));
  return parts;
}

// Voix uniquement : « lait œufs beurre » → 3 articles, si chaque mot est un produit connu.
function splitOnKnownProducts(chunk) {
  const words = chunk.split(' ').filter(Boolean);
  if (words.length < 2 || words.some((w) => isNumber(w) || ARTICLES.has(w.toLowerCase()))) return [chunk];
  const items = [];
  let i = 0;
  while (i < words.length) {
    let matched = 0;
    for (let n = Math.min(MAX_KEYWORD_WORDS, words.length - i); n >= 1; n--) {
      if (KEYWORDS.has(norm(words.slice(i, i + n).join(' ')))) { matched = n; break; }
    }
    const word = norm(words[i]);
    if (matched > 1 || (matched === 1 && !(ADJECTIVES.has(word) && items.length))) {
      items.push(words.slice(i, i + matched).join(' '));
      i += matched;
    } else if (ADJECTIVES.has(word) && items.length) {
      items[items.length - 1] += ` ${words[i]}`;
      i += 1;
    } else {
      return [chunk]; // mot inconnu : on ne prend pas le risque de couper
    }
  }
  return items;
}

// Formules à ignorer en début de phrase (« il faut du pain », « je voudrais du lait »).
const FILLER = /^(?:(?:alors|bon|euh|aussi|et|puis|ok|stp|s'il te plaît|s’il te plaît)\s+)*(?:(?:il (?:me |nous )?faut|je (?:veux|voudrais)|on (?:veut|voudrait)|(?:j'ai|j’ai|on a) besoin(?: de| d['’])?|ajoute|ajouter|rajoute|rajouter|achète|acheter|prends|prendre|penser? à|n['’]oublie pas)\s*)+/i;
const stripFiller = (chunk) => chunk.trim().replace(FILLER, '').trim();

// Plusieurs articles séparés par des virgules, « et », « puis », des articles, des nombres…
// Restes de la commande vocale dictés avec les articles :
// « Dis Siri, ajoute du lait aux courses » → « du lait ».
const VOICE_COMMAND = [
  /\b(?:dis|hey|eh|ok|okay)\s+siri\b[\s,]*/gi,
  /\bsiri\b[\s,]*/gi,
  // (\b ne fonctionne pas devant « à » : on utilise un espace ou le début du texte)
  /(?:^|\s)(?:aux|à mes|à nos|à ma|à la|dans la|dans ma|sur la|sur ma|pour les)\s+(?:courses|liste(?:\s+(?:de|des)\s+courses)?)(?=$|[\s,.!?])/gi,
];
const stripVoiceCommand = (text) => VOICE_COMMAND.reduce((t, re) => t.replace(re, ' '), text).trim();

export function parseMany(text, { voice = false } = {}) {
  return stripVoiceCommand(text)
    .replace(/[.!?]+/g, ',')
    .split(/\s*(?:,|;|\n|\bet puis\b|\bpuis\b|\bet\b|\bavec\b)\s*/i)
    .map(stripFiller)
    .filter(Boolean)
    .flatMap(splitOnMarkers)
    .flatMap((chunk) => (voice ? splitOnKnownProducts(chunk) : [chunk]))
    .map(parseOne)
    .filter(Boolean);
}
