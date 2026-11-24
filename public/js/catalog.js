// Catalogue d'articles courants, par rayon, avec leur icône.
// Sert à l'écran « Catalogue » (ajout sans clavier) et aux icônes de la vue en tuiles.

import { normalize } from './categories.js';

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

// Dictionnaire d'icônes : emoji → mots séparés par des espaces ; les expressions de
// plusieurs mots sont reliées par « _ » (« lait_de_coco »). L'expression la plus longue
// présente dans le nom l'emporte (« lait de coco » → 🥥, et non 🥛).
const ICON_WORDS = {
  // Fruits
  '🍎': 'pomme compote', '🍌': 'banane', '🍊': 'orange clementine mandarine pamplemousse', '🍋': 'citron limonade',
  '🍐': 'poire', '🍇': 'raisin', '🍓': 'fraise framboise', '🫐': 'myrtille cassis mure', '🍒': 'cerise griotte',
  '🍑': 'peche abricot nectarine brugnon', '🍈': 'melon', '🍉': 'pasteque', '🍍': 'ananas', '🥭': 'mangue', '🥝': 'kiwi',
  '🥥': 'coco noix_de_coco lait_de_coco creme_de_coco', '🫒': 'olive huile huile_d_olive', '🥑': 'avocat',
  '🍅': 'tomate tomate_cerise ketchup concentre_de_tomate coulis_de_tomate',
  // Légumes
  '🥬': 'salade laitue mache roquette epinard chou poireau celeri fenouil blette endive cresson batavia',
  '🥦': 'brocoli chou_fleur chou_de_bruxelles', '🥕': 'carotte radis navet panais', '🥒': 'courgette concombre cornichon',
  '🍆': 'aubergine', '🫑': 'poivron', '🌶️': 'piment harissa tabasco', '🧅': 'oignon echalote', '🧄': 'ail',
  '🥔': 'patate puree pomme_de_terre', '🍠': 'betterave patate_douce', '🍄': 'champignon girolle cepe',
  '🌽': 'mais epi_de_mais', '🫛': 'edamame haricot_vert petit_pois pois_gourmand',
  '🫘': 'lentille haricot flageolet pois_chiche haricot_rouge haricot_blanc', '🎃': 'potiron courge butternut citrouille potimarron',
  '🫚': 'gingembre', '🌱': 'germe pousse soja_frais',
  '🌿': 'basilic persil coriandre menthe ciboulette thym romarin aneth estragon laurier sauge herbe pesto herbe_fraiche herbe_de_provence',
  // Boulangerie, pâtisserie
  '🍞': 'pain brioche biscotte chapelure pain_de_mie pain_complet pain_d_epice', '🥖': 'baguette ficelle',
  '🥐': 'croissant chocolatine viennoiserie pain_au_chocolat', '🫓': 'tortilla wrap pita galette naan', '🥯': 'bagel',
  '🥞': 'crepe pancake blini', '🧇': 'gaufre', '🧁': 'muffin cupcake madeleine', '🍩': 'donut beignet',
  '🥧': 'tarte quiche pate_brisee pate_feuilletee pate_sablee', '🍰': 'gateau cake patisserie',
  '🍪': 'biscuit cookie sable speculoos petit_beurre', '🎂': 'anniversaire gateau_d_anniversaire',
  // Crèmerie
  '🥛': 'lait creme kefir creme_fraiche creme_liquide lait_d_avoine lait_d_amande lait_de_soja boisson_vegetale',
  '🧈': 'beurre margarine', '🥚': 'oeuf',
  '🧀': 'fromage emmental comte mozzarella parmesan feta chevre camembert brie raclette gruyere cheddar roquefort reblochon ricotta mascarpone burrata halloumi fromage_rape',
  '🥣': 'yaourt yogourt skyr cereale muesli granola porridge fromage_blanc petit_suisse flocon_d_avoine',
  // Viandes, poissons
  '🍗': 'poulet dinde canard cuisse pilon aiguillette nugget escalope cordon_bleu blanc_de_poulet',
  '🥩': 'steak boeuf viande veau agneau porc roti hache cotelette entrecote bavette carpaccio filet_mignon steak_hache viande_hachee',
  '🍖': 'jambon travers jambon_blanc jambon_cru cote_de_porc', '🥓': 'lardon bacon pancetta',
  '🌭': 'saucisse merguez chipolata knacki saucisson chorizo hot_dog', '🍔': 'burger hamburger steak_vegetal',
  '🐟': 'poisson cabillaud thon sardine maquereau truite colin merlu dorade anchois poisson_pane',
  '🍣': 'saumon sushi saumon_fume', '🍤': 'crevette gambas scampi', '🦪': 'moule huitre coquillage', '🦀': 'crabe tourteau',
  '🦞': 'homard langouste', '🦑': 'calamar seiche poulpe encornet', '🍥': 'surimi',
  // Épicerie salée
  '🍝': 'pate spaghetti penne tagliatelle fusilli lasagne macaroni coquillette ravioli gnocchi', '🍜': 'nouille ramen vermicelle',
  '🍚': 'riz semoule couscous quinoa boulgour risotto riz_basmati', '🌾': 'farine avoine maizena',
  '🧂': 'sel poivre epice curry paprika cumin cannelle muscade curcuma',
  '🫙': 'moutarde mayonnaise confiture nutella bocal vinaigrette tahini houmous tapenade pate_a_tartiner',
  '🍶': 'vinaigre sauce_soja vinaigre_balsamique nuoc_mam', '🥫': 'conserve sauce sauce_tomate',
  '🍲': 'soupe bouillon veloute pot_au_feu', '🥜': 'cacahuete noix amande pistache noix_de_cajou beurre_de_cacahuete fruit_sec',
  '🌰': 'noisette chataigne marron', '🍟': 'chips frite pringles', '🍿': 'popcorn pop_corn',
  '🥨': 'bretzel cracker gressin aperitif biscuit_aperitif',
  // Épicerie sucrée, boissons chaudes
  '☕': 'cafe capsule dosette expresso cafe_moulu', '🍵': 'the tisane infusion matcha the_vert',
  '🍫': 'chocolat cacao chocolat_noir chocolat_au_lait', '🍬': 'sucre bonbon caramel sucette sucre_roux sucre_glace',
  '🍯': 'miel sirop_d_erable', '🍮': 'flan liegeois creme_dessert creme_brulee',
  // Surgelés
  '🍦': 'glace cornet creme_glacee', '🍧': 'sorbet granite', '🍕': 'pizza pate_a_pizza', '🧊': 'glacon surgele',
  '🥘': 'poelee paella plat_cuisine plat_prepare',
  // Boissons
  '💧': 'eau eau_plate eau_minerale eau_de_source', '🫧': 'perrier badoit eau_gazeuse eau_petillante',
  '🧃': 'jus nectar brique jus_d_orange jus_de_pomme jus_de_fruit',
  '🥤': 'soda coca cola fanta sprite orangina smoothie ice_tea the_glace energy_drink', '🍺': 'biere cidre panache',
  '🍷': 'vin rose vin_rouge', '🥂': 'prosecco cremant vin_blanc', '🍾': 'champagne mousseux',
  '🥃': 'rhum whisky cognac armagnac calvados digestif', '🍸': 'vodka gin martini apero cocktail pastis ricard',
  '🧋': 'bubble_tea the_au_lait', '🍹': 'sirop',
  // Hygiène, santé
  '🧻': 'pq sopalin lingette papier_toilette essuie_tout', '🤧': 'mouchoir',
  '🪥': 'dentifrice brosse_a_dent fil_dentaire bain_de_bouche',
  '🧴': 'shampoing shampooing deodorant lotion demaquillant javel nettoyant gel_douche apres_shampoing creme_hydratante creme_solaire lait_corps produit_menager vinaigre_blanc',
  '🧼': 'savon savon_liquide lave_main', '🪒': 'rasoir lame mousse_a_raser', '💄': 'maquillage mascara vernis rouge_a_levre',
  '🩹': 'pansement compresse', '💊': 'medicament doliprane paracetamol vitamine ibuprofene pharmacie',
  '🧽': 'eponge liquide_vaisselle pastille_lave_vaisselle tablette_lave_vaisselle produit_vaisselle',
  // Maison
  '🧺': 'lessive adoucissant linge detachant', '🗑️': 'poubelle sac_poubelle', '💡': 'ampoule', '🔋': 'pile batterie',
  '🕯️': 'bougie', '🔥': 'allumette briquet charbon', '🧹': 'balai serpillere balayette', '🧤': 'gant', '🧷': 'couche',
  '📦': 'aluminium papier_aluminium film_alimentaire papier_cuisson sac_congelation',
  // Bébé, animaux
  '🍼': 'biberon lait_infantile lait_bebe petit_pot', '🦴': 'croquette friandise', '🐱': 'litiere chat patee', '🐶': 'chien',
  // Divers
  '💐': 'fleur bouquet', '🪴': 'plante terreau', '📰': 'journal magazine', '🎁': 'cadeau',
  '🥗': 'taboule crudite salade_composee', '🥪': 'sandwich croque_monsieur', '🌮': 'taco', '🌯': 'burrito kebab',
  '🍱': 'bento traiteur', '🫕': 'fondue',
};

const ICONS = new Map();
for (const [emoji, words] of Object.entries(ICON_WORDS)) {
  for (const token of words.split(' ')) {
    const key = nameKey(token.replace(/_/g, ' '));
    if (key && !ICONS.has(key)) ICONS.set(key, emoji);
  }
}
// Les icônes du catalogue complètent le dictionnaire.
for (const items of Object.values(CATALOG)) {
  for (const [name, emoji] of items) {
    const key = nameKey(name);
    if (!ICONS.has(key)) ICONS.set(key, emoji);
  }
}
const MAX_WORDS = Math.max(...[...ICONS.keys()].map((k) => k.split(' ').length));

// Icône neutre quand rien ne correspond : mieux qu'une image trompeuse.
const NEUTRAL = '🛒';

// Icône d'un article : l'expression connue la plus longue contenue dans son nom.
export function iconFor(name) {
  const words = nameKey(name).split(' ').filter(Boolean);
  for (let n = Math.min(MAX_WORDS, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const icon = ICONS.get(words.slice(i, i + n).join(' '));
      if (icon) return icon;
    }
  }
  return NEUTRAL;
}
