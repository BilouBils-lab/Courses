// Analyse d'une saisie (clavier, micro ou Siri) en un ou plusieurs articles.
// « du lait, des œufs et deux baguettes » →
//   [{name:'Lait'}, {name:'Œufs'}, {name:'Baguettes', qty:'2'}]

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

// Plusieurs articles séparés par des virgules, « et », « puis »…
export function parseMany(text) {
  return text
    .split(/\s*(?:,|;|\n|\bet puis\b|\bpuis\b|\bet\b|\bavec\b)\s*/i)
    .map(parseOne)
    .filter(Boolean);
}
