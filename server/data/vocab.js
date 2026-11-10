// Vocabulaire de référence : familles olfactives, notes, ingrédients, besoins.
// `syn` = synonymes/adjectifs reconnus par le moteur de recherche (forme normalisée sans accents).

export const FAMILIES = [
  { id: 'florale', name: 'Florale', syn: ['floral', 'florale', 'fleuri', 'fleurie', 'floraux', 'fleurs'], desc: 'Dominée par les fleurs : rose, jasmin, iris, tubéreuse…' },
  { id: 'orientale', name: 'Orientale / ambrée', syn: ['oriental', 'orientale', 'ambre', 'ambree', 'ambre', 'orientaux'], desc: 'Chaude et enveloppante : ambre, vanille, résines, épices douces.' },
  { id: 'boisee', name: 'Boisée', syn: ['boise', 'boisee', 'bois', 'boises'], desc: 'Santal, cèdre, vétiver, patchouli : sèche, chaleureuse ou terreuse.' },
  { id: 'hesperidee', name: 'Hespéridée', syn: ['hesperide', 'hesperidee', 'agrume', 'agrumes', 'citronne', 'citronnee'], desc: 'Agrumes vifs : bergamote, citron, mandarine, pamplemousse.' },
  { id: 'gourmande', name: 'Gourmande', syn: ['gourmand', 'gourmande', 'sucre', 'sucree', 'croquant'], desc: 'Notes comestibles : vanille, caramel, praline, chocolat, amande.' },
  { id: 'chypree', name: 'Chyprée', syn: ['chypre', 'chypree'], desc: 'Contraste agrumes / mousse de chêne / patchouli.' },
  { id: 'fougere', name: 'Fougère', syn: ['fougere', 'fougeres'], desc: 'Lavande, mousse de chêne, coumarine : structure classique masculine.' },
  { id: 'aromatique', name: 'Aromatique', syn: ['aromatique', 'aromatiques', 'herbace', 'herbacee'], desc: 'Herbes et plantes : lavande, sauge, romarin, menthe.' },
  { id: 'aquatique', name: 'Aquatique', syn: ['aquatique', 'marin', 'marine', 'oceanique', 'aquatiques'], desc: 'Évoque l’eau, l’air marin, la fraîcheur saline.' },
  { id: 'cuiree', name: 'Cuirée', syn: ['cuir', 'cuiree', 'cuire'], desc: 'Cuir, tabac, bouleau : sensuelle et sombre.' },
  { id: 'epicee', name: 'Épicée', syn: ['epice', 'epicee', 'epices', 'epicees'], desc: 'Poivre, cannelle, safran, cardamome.' },
];

// groupe : fleurs / gourmandes / boisees / fraiches / autres
export const NOTES = [
  // Florales
  ['Rose', 'florales', ['roses']], ['Jasmin', 'florales', []], ['Iris', 'florales', []],
  ['Fleur d’oranger', 'florales', ['fleur oranger', 'oranger']], ['Tubéreuse', 'florales', ['tubereuse']],
  ['Ylang-ylang', 'florales', ['ylang']], ['Pivoine', 'florales', []], ['Violette', 'florales', []],
  ['Muguet', 'florales', []], ['Magnolia', 'florales', []], ['Géranium', 'florales', ['geranium']],
  ['Fleur de tiaré', 'florales', ['tiare']], ['Freesia', 'florales', []], ['Lavande', 'florales', []],
  // Gourmandes
  ['Vanille', 'gourmandes', ['vanille', 'vanille', 'vanillee', 'vanille']], ['Caramel', 'gourmandes', []],
  ['Praliné', 'gourmandes', ['praline']], ['Chocolat', 'gourmandes', ['cacao']], ['Amande', 'gourmandes', []],
  ['Cerise', 'gourmandes', []], ['Café', 'gourmandes', ['cafe']], ['Miel', 'gourmandes', []],
  ['Noix de coco', 'gourmandes', ['coco']], ['Pomme', 'gourmandes', []], ['Poire', 'gourmandes', []],
  ['Pêche', 'gourmandes', ['peche']], ['Framboise', 'gourmandes', []], ['Cassis', 'gourmandes', []],
  ['Figue', 'gourmandes', []], ['Ananas', 'gourmandes', []],
  // Boisées
  ['Santal', 'boisees', ['bois de santal']], ['Cèdre', 'boisees', ['cedre']], ['Oud', 'boisees', ['agar', 'bois d oud']],
  ['Vétiver', 'boisees', ['vetiver']], ['Patchouli', 'boisees', []], ['Bois de gaïac', 'boisees', ['gaiac']],
  ['Mousse de chêne', 'boisees', ['mousse de chene', 'chene']],
  // Fraîches
  ['Bergamote', 'fraiches', []], ['Citron', 'fraiches', []], ['Mandarine', 'fraiches', []],
  ['Menthe', 'fraiches', []], ['Notes marines', 'fraiches', ['note marine', 'marines', 'marin', 'embruns', 'sel marin']],
  ['Pamplemousse', 'fraiches', []], ['Orange', 'fraiches', []], ['Citron vert', 'fraiches', ['lime']],
  ['Néroli', 'fraiches', ['neroli']], ['Thé', 'fraiches', ['the vert']],
  // Autres
  ['Musc blanc', 'autres', ['musc', 'musque', 'musquee', 'musk', 'muscs']], ['Ambre', 'autres', ['ambree', 'ambre']],
  ['Encens', 'autres', []], ['Safran', 'autres', []], ['Poivre', 'autres', []],
  ['Fève tonka', 'autres', ['tonka', 'feve tonka']], ['Cannelle', 'autres', []], ['Cardamome', 'autres', []],
  ['Cuir', 'autres', []], ['Tabac', 'autres', []], ['Benjoin', 'autres', []], ['Gingembre', 'autres', []],
  ['Sauge', 'autres', []], ['Ambroxan', 'autres', ['ambroxane']], ['Aldéhydes', 'autres', ['aldehydes']],
  ['Cumin', 'autres', []],
  ['Coing', 'gourmandes', []], ['Abricot', 'gourmandes', []], ['Litchi', 'gourmandes', []], ['Rhubarbe', 'gourmandes', []], ['Datte', 'gourmandes', []],
  ['Grenade', 'gourmandes', []], ['Orchidée', 'florales', ['orchidee']], ['Lotus', 'florales', []], ['Lys', 'florales', []],
  ['Bouleau', 'boisees', []], ['Pin', 'boisees', []], ['Papyrus', 'boisees', []], ['Cyprès', 'boisees', ['cypres']],
  ['Yuzu', 'fraiches', []], ['Algues', 'fraiches', ['algue']], ['Basilic', 'fraiches', []], ['Truffe', 'autres', []],
].map(([name, group, syn]) => ({ id: name, name, group, syn }));

export const NOTE_GROUPS = {
  florales: 'Florales', gourmandes: 'Gourmandes', boisees: 'Boisées', fraiches: 'Fraîches', autres: 'Autres',
};

export const SEASONS = ['printemps', 'été', 'automne', 'hiver'];
export const OCCASIONS = ['quotidien', 'bureau', 'soirée', 'rendez-vous', 'sport', 'cérémonie'];
export const CONCENTRATIONS = [
  { id: 'extrait', name: 'Extrait de parfum', syn: ['extrait'] },
  { id: 'edp', name: 'Eau de parfum', syn: ['eau de parfum', 'edp'] },
  { id: 'edt', name: 'Eau de toilette', syn: ['eau de toilette', 'edt'] },
  { id: 'cologne', name: 'Eau de Cologne', syn: ['eau de cologne', 'cologne', 'edc'] },
];

export const CATEGORIES = [
  { id: 'parfum', name: 'Parfums', slug: 'parfums', syn: ['parfum', 'parfums', 'fragrance', 'fragrances'] },
  { id: 'skincare', name: 'Skincare', slug: 'skincare', syn: ['skincare', 'soin visage', 'soins visage', 'visage', 'soin du visage'] },
  { id: 'maquillage', name: 'Maquillage', slug: 'maquillage', syn: ['maquillage', 'makeup', 'make up'] },
  { id: 'cheveux', name: 'Cheveux', slug: 'cheveux-corps', syn: ['cheveux', 'capillaire', 'capillaires', 'soin capillaire'] },
  { id: 'corps', name: 'Corps', slug: 'cheveux-corps', syn: ['corps', 'soin corps', 'soin du corps'] },
];

export const SUBCATEGORIES = {
  skincare: ['nettoyant', 'sérum', 'crème hydratante', 'crème de jour', 'crème de nuit', 'contour des yeux', 'protection solaire', 'masque', 'exfoliant', 'soin ciblé', 'toner', 'huile visage'],
  maquillage: ['fond de teint', 'correcteur', 'poudre', 'blush', 'bronzer', 'highlighter', 'mascara', 'eyeliner', 'rouge à lèvres', 'palette', 'pinceaux'],
  cheveux: ['shampooing', 'après-shampooing', 'masque', 'huile', 'sérum', 'soin sans rinçage', 'appareil coiffant'],
  corps: ['crème', 'huile', 'gommage', 'gel douche', 'déodorant', 'soin spécifique'],
};

export const SKIN_TYPES = ['sèche', 'grasse', 'mixte', 'normale', 'sensible', 'mature'];
export const HAIR_TYPES = ['secs', 'gras', 'normaux', 'bouclés', 'frisés', 'colorés', 'fins', 'épais', 'abîmés'];

// Besoins beauté → critères exploitables par la recherche (non médical : orientation produit uniquement).
export const NEEDS = [
  { id: 'hydratation', syn: ['hydratant', 'hydratante', 'hydratation', 'hydrater', 'secheresse'], skin: ['sèche'], actives: ['Acide hyaluronique', 'Céramides', 'Glycérine'] },
  { id: 'eclat', syn: ['eclat', 'bonne mine', 'lumineux', 'luminosite'], actives: ['Vitamine C', 'Niacinamide'] },
  { id: 'imperfections', syn: ['imperfections', 'boutons', 'acne', 'pores', 'sebum'], skin: ['grasse', 'mixte'], actives: ['Acide salicylique', 'Niacinamide'] },
  { id: 'anti-age', syn: ['anti-age', 'anti age', 'rides', 'ridules', 'antiage'], skin: ['mature'], actives: ['Rétinol', 'Vitamine C', 'Acide hyaluronique'] },
  { id: 'apaisement', syn: ['apaisant', 'apaisante', 'rougeurs', 'reactive', 'apaiser'], skin: ['sensible'], actives: ['Céramides', 'Panthénol'] },
  { id: 'solaire', syn: ['solaire', 'spf', 'creme solaire', 'ecran'], sub: ['protection solaire'] },
];

export const INGREDIENTS = [
  { name: 'Niacinamide', syn: ['niacinamide', 'vitamine b3'], fn: 'Actif polyvalent utilisé dans les soins visage pour son action sur l’aspect du grain de peau et du sébum.', desc: 'Dérivé de la vitamine B3, très répandu dans les sérums et crèmes. Concentrations usuelles en cosmétique : 2 à 10 %.', cats: ['sérum', 'crème hydratante', 'soin ciblé'], src: 'CosIng (Commission européenne) — fonction : skin conditioning' },
  { name: 'Acide hyaluronique', syn: ['acide hyaluronique', 'hyaluronique', 'hyaluronate'], fn: 'Humectant : attire et retient l’eau en surface de la peau.', desc: 'Présent sous différentes masses moléculaires. Utilisé dans les sérums, crèmes et contours des yeux pour le confort et l’hydratation de surface.', cats: ['sérum', 'crème hydratante', 'contour des yeux'], src: 'CosIng — fonction : humectant, skin conditioning' },
  { name: 'Rétinol', syn: ['retinol', 'retinal', 'vitamine a'], fn: 'Dérivé de vitamine A utilisé dans les soins de nuit ciblant l’aspect de la peau mature.', desc: 'Peut provoquer des irritations ; usage non recommandé pendant la grossesse. Demandez conseil à un professionnel de santé.', cats: ['sérum', 'crème de nuit', 'soin ciblé'], src: 'CosIng — fonction : skin conditioning ; avis SCCS sur les rétinoïdes' },
  { name: 'Vitamine C', syn: ['vitamine c', 'acide ascorbique', 'ascorbyl'], fn: 'Antioxydant utilisé pour l’éclat du teint.', desc: 'Instable à l’air et à la lumière ; la formulation et l’emballage influent sur sa conservation.', cats: ['sérum', 'crème de jour'], src: 'CosIng — fonction : antioxydant' },
  { name: 'Acide salicylique', syn: ['acide salicylique', 'bha', 'salicylique'], fn: 'Exfoliant chimique (BHA) liposoluble utilisé sur les peaux à imperfections.', desc: 'Concentration encadrée par la réglementation cosmétique européenne. Éviter l’usage excessif.', cats: ['nettoyant', 'soin ciblé', 'exfoliant'], src: 'Règlement (CE) n°1223/2009, annexe III' },
  { name: 'Céramides', syn: ['ceramides', 'ceramide'], fn: 'Lipides de la barrière cutanée utilisés pour le confort des peaux sèches.', desc: 'Souvent associés au cholestérol et aux acides gras dans les formules « barrière ».', cats: ['crème hydratante', 'nettoyant', 'crème'], src: 'CosIng — fonction : skin conditioning' },
  { name: 'Acide glycolique', syn: ['acide glycolique', 'aha', 'glycolique'], fn: 'Exfoliant chimique (AHA) hydrosoluble favorisant le renouvellement de surface.', desc: 'Augmente la sensibilité au soleil : protection solaire recommandée.', cats: ['exfoliant', 'toner', 'soin ciblé'], src: 'Règlement (CE) n°1223/2009 ; avis SCCS' },
  { name: 'Glycérine', syn: ['glycerine', 'glycerol'], fn: 'Humectant de base des formules hydratantes.', desc: 'Ingrédient très courant, bien toléré en général.', cats: ['crème hydratante', 'crème', 'nettoyant'], src: 'CosIng — fonction : humectant' },
  { name: 'Panthénol', syn: ['panthenol', 'vitamine b5'], fn: 'Utilisé pour le confort et l’aspect apaisé de la peau et des cheveux.', desc: 'Présent dans les soins réparateurs et apaisants.', cats: ['crème hydratante', 'masque', 'après-shampooing'], src: 'CosIng — fonction : skin/hair conditioning' },
  { name: 'Filtres UV', syn: ['filtres uv', 'spf', 'filtre solaire'], fn: 'Protègent des UVA/UVB selon l’indice (SPF) et la mention UVA.', desc: 'Appliquer en quantité suffisante et renouveler régulièrement.', cats: ['protection solaire'], src: 'Règlement (CE) n°1223/2009, annexe VI' },
  { name: 'Kératine', syn: ['keratine'], fn: 'Protéine utilisée dans les soins capillaires pour le gainage de la fibre.', desc: 'Effet de surface, temporaire.', cats: ['shampooing', 'masque', 'après-shampooing'], src: 'CosIng — fonction : hair conditioning' },
  { name: 'Beurre de karité', syn: ['karite', 'beurre de karite'], fn: 'Corps gras nourrissant pour le corps et les cheveux secs.', desc: 'Texture riche, confort prolongé.', cats: ['crème', 'masque', 'huile'], src: 'CosIng — fonction : skin conditioning, emollient' },
];

export const GUIDES = [
  {
    slug: 'comprendre-les-familles-olfactives', title: 'Comprendre les familles olfactives',
    desc: 'Florale, boisée, orientale, hespéridée : un guide simple pour reconnaître les grandes familles de parfums.',
    body: [
      ['Pourquoi des familles ?', 'Les familles olfactives regroupent les parfums selon leur caractère dominant. Elles servent de repère, pas de règle : un même parfum peut relever de plusieurs familles.'],
      ['Les grandes familles', 'Florale (rose, jasmin, iris), orientale/ambrée (ambre, vanille, résines), boisée (santal, cèdre, vétiver), hespéridée (agrumes), gourmande (vanille, caramel, praline), chyprée (agrumes, mousse de chêne, patchouli), fougère (lavande, coumarine), aromatique, aquatique, cuirée et épicée.'],
      ['Comment s’en servir sur VELUNE', 'Sélectionnez une ou plusieurs familles dans « Trouver mon parfum », ajoutez les notes que vous aimez ou voulez éviter : VELUNE classe les résultats par score de correspondance indicatif et explique chaque recommandation.'],
    ],
  },
  {
    slug: 'edt-edp-extrait-quelle-difference', title: 'Différence entre EDT, EDP et extrait',
    desc: 'Concentration en huiles parfumantes, tenue et prix : ce qui distingue eau de toilette, eau de parfum et extrait.',
    body: [
      ['La concentration', 'Les appellations indiquent en général une concentration croissante en composition parfumante : eau de Cologne, eau de toilette (EDT), eau de parfum (EDP), extrait de parfum. Les pourcentages exacts ne sont pas normalisés et varient selon les maisons.'],
      ['Tenue et sillage', 'Une concentration plus élevée donne souvent plus de tenue, mais la structure de la formule compte autant. Une EDT bien construite peut surpasser une EDP légère.'],
      ['Prix', 'L’extrait coûte généralement plus cher au millilitre. Utilisez le comparateur de valeur de VELUNE pour comparer le prix au ml entre formats et concentrations.'],
    ],
  },
  {
    slug: 'comment-choisir-son-parfum', title: 'Comment choisir son parfum',
    desc: 'Quelques repères pour trouver un parfum qui vous ressemble, sans se tromper de budget.',
    body: [
      ['Partir de ce que vous aimez', 'Repérez les notes de vos parfums préférés : vanille, bois, agrumes… Elles guident la recherche mieux qu’une marque.'],
      ['Tester sur la peau', 'Un parfum évolue pendant plusieurs heures (notes de tête, de cœur, de fond). Testez sur la peau avant d’acheter un grand format. Les petits formats sont une bonne option.'],
      ['Comparer les offres', 'Comparez des références réellement équivalentes (même format, même concentration) et tenez compte des frais de livraison.'],
    ],
  },
  {
    slug: 'comprendre-les-actifs-skincare', title: 'Comprendre les actifs skincare',
    desc: 'Niacinamide, acide hyaluronique, rétinol, vitamine C : à quoi servent les principaux actifs, sans promesse médicale.',
    body: [
      ['Un actif, une fonction', 'Chaque ingrédient a une fonction cosmétique documentée (hydratation, exfoliation, protection…). Ces informations sont documentaires et ne remplacent pas l’avis d’un professionnel de santé.'],
      ['Lire une liste INCI', 'Les ingrédients sont listés par ordre décroissant de concentration (au-delà de 1 %). La présence d’un actif ne garantit ni sa concentration ni son efficacité.'],
      ['Précautions', 'Certains actifs (rétinol, acides) peuvent irriter ou sensibiliser. Introduisez-les progressivement et protégez-vous du soleil.'],
    ],
  },
  {
    slug: 'comment-comparer-les-prix-cosmetiques', title: 'Comment comparer les prix des cosmétiques',
    desc: 'Prix au ml, livraison, historique : les bons réflexes pour mesurer une vraie économie.',
    body: [
      ['Prix le plus bas ≠ meilleure réduction', 'Une réduction affichée de 30 % peut partir d’un prix de départ gonflé. Regardez le prix final et le prix au ml.'],
      ['Ne pas oublier la livraison', 'Une offre à 2 € de moins peut coûter plus cher après frais de port. Le comparateur de panier de VELUNE calcule le total par boutique.'],
      ['L’historique des prix', 'Un prix proche du minimum observé est un meilleur signal qu’un pourcentage de remise. VELUNE ne qualifie une offre d’exceptionnelle que s’il dispose d’un historique suffisant.'],
    ],
  },
];

export const FAQ = [
  ['VELUNE vend-il des produits ?', 'Non. VELUNE est un comparateur : nous vous redirigeons vers les boutiques partenaires, où vous finalisez votre achat.'],
  ['Les prix affichés sont-ils garantis ?', 'Non. Chaque offre affiche sa date de dernière vérification. Le prix et la disponibilité peuvent changer sur le site marchand : vérifiez-les avant d’acheter.'],
  ['Les données du site sont-elles réelles ?', 'Dans cette version de démonstration, tout le catalogue, les marchands, les prix, les historiques et les avis sont fictifs et signalés comme tels. Aucun prix n’est une offre réelle.'],
  ['Comment fonctionne le score de similarité ?', 'C’est un indicateur calculé à partir de critères visibles (notes, accords, famille, concentration, prix). Ce n’est pas une mesure scientifique et un parfum « proche » n’est jamais une copie.'],
  ['VELUNE est-il rémunéré ?', 'VELUNE peut percevoir une commission d’affiliation lorsque vous achetez via un lien partenaire. Elle n’influence pas le classement par défaut. Les liens et placements sponsorisés sont signalés.'],
  ['Comment fonctionnent les alertes de prix ?', 'Vous définissez un prix cible. Dès qu’une offre vérifiée, disponible et non expirée passe sous ce seuil, vous recevez une notification dans votre centre de notifications (et un email lorsque l’envoi d’emails est configuré).'],
  ['Comment supprimer mon compte ?', 'Dans « Mon compte », section « Données personnelles » : vous pouvez exporter vos données et supprimer votre compte à tout moment.'],
];
