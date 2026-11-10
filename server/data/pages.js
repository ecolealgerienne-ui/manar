// Pages institutionnelles. Les mentions entre crochets sont à compléter par l'éditeur avant toute mise en production.
export const PAGES = {
  'a-propos': {
    title: 'À propos de MANOU',
    desc: 'MANOU est un comparateur indépendant de produits de beauté : découverte, comparaison de prix et promotions vérifiées.',
    sections: [
      ['Notre mission', 'MANOU aide à découvrir les produits de beauté qui correspondent à vos goûts, vos besoins et votre budget, puis à comparer les offres de marchands sélectionnés. Discover your beauty. Find your value.'],
      ['Ce que MANOU n’est pas', 'MANOU ne vend aucun produit. Nous vous redirigeons vers les boutiques partenaires, où vous finalisez votre achat. Nous ne garantissons ni l’authenticité d’un produit ni la disponibilité d’une offre : chaque offre indique sa date de dernière vérification et le type de vendeur.'],
      ['Comment nous classons les résultats', 'Le classement par défaut dépend de la pertinence par rapport à votre recherche, puis du prix. Les commissions d’affiliation ne sont jamais un critère de classement. Les tris alternatifs (prix, réduction, popularité, rapport quantité/prix) sont toujours à votre disposition. Le score de similarité « Beauty Match » est un indicateur calculé à partir de critères affichés (notes, accords, familles, concentration, prix) ; ce n’est pas une mesure scientifique.'],
      ['Transparence sur les données', 'Cette version est une démonstration : le catalogue, les marchands, les prix, les historiques de prix et les avis sont fictifs et signalés comme tels. Aucune offre n’est réelle. Les intégrations aux réseaux d’affiliation (Awin, Effinity, CJ Affiliate, TradeTracker) et aux flux marchands sont prévues par l’architecture mais ne sont pas connectées.'],
      ['Affiliation', 'Lorsque MANOU sera relié à des programmes d’affiliation, les liens concernés seront identifiés (« lien affilié ») et pourront nous valoir une commission, sans surcoût pour vous. Les placements sponsorisés seront clairement étiquetés « Sponsorisé ».'],
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    desc: 'Informations légales de l’éditeur du site MANOU.',
    sections: [
      ['Éditeur', '[Raison sociale, forme juridique, capital, RCS, adresse du siège, numéro de TVA — à compléter par l’éditeur].'],
      ['Directeur de la publication', '[Nom du directeur de la publication — à compléter].'],
      ['Hébergeur', '[Nom, adresse et téléphone de l’hébergeur — à compléter selon le déploiement].'],
      ['Contact', 'Via le formulaire de la page Contact.'],
      ['Propriété intellectuelle', 'Les marques citées appartiennent à leurs propriétaires respectifs. Leur présence dans le catalogue de démonstration n’implique aucun partenariat, ni aucune relation commerciale. Les illustrations de produits sont générées automatiquement et ne représentent pas les produits réels.'],
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    desc: 'Comment MANOU traite vos données personnelles conformément au RGPD.',
    sections: [
      ['Responsable du traitement', '[Identité et coordonnées de l’éditeur — à compléter]. Contact : formulaire de la page Contact.'],
      ['Données collectées', 'Compte : adresse email, nom (facultatif), mot de passe (stocké sous forme hachée avec scrypt). Profil beauté : préférences que vous renseignez volontairement (facultatives). Usage : favoris, listes, alertes, paniers enregistrés et — uniquement si vous y consentez — historique de vos recherches pour personnaliser les recommandations.'],
      ['Finalités et bases légales', 'Fournir le service demandé (exécution du contrat) ; personnaliser les recommandations (consentement, retirable à tout moment) ; sécurité et prévention des abus (intérêt légitime) ; envoi des alertes de prix que vous avez créées (exécution du contrat).'],
      ['Données de santé', 'MANOU ne collecte pas de données de santé et ne fait aucun diagnostic. Les informations sur le type de peau ou de cheveux sont des préférences cosmétiques, facultatives.'],
      ['Durée de conservation', 'Les données du compte sont conservées tant que le compte existe ; supprimées à la clôture. Les historiques de recherche sont limités à 90 jours. Les journaux d’administration sont conservés 12 mois.'],
      ['Vos droits', 'Accès, rectification, effacement, limitation, opposition, portabilité. Vous pouvez exporter vos données et supprimer votre compte depuis « Mon compte », ou nous écrire via la page Contact. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).'],
      ['Destinataires et transferts', 'Aucune donnée personnelle n’est vendue. Dans cette version, aucun sous-traitant tiers n’est connecté (pas de mesure d’audience, pas de publicité). L’envoi d’emails nécessite la configuration d’un serveur SMTP : les emails d’alerte sont, par défaut, consignés dans une boîte d’envoi interne et non transmis.'],
      ['Cookies', 'Voir la page « Gestion des cookies ». Le seul cookie déposé par défaut est un cookie de session strictement nécessaire, après connexion.'],
    ],
  },
  conditions: {
    title: 'Conditions d’utilisation',
    desc: 'Conditions générales d’utilisation du service de comparaison MANOU.',
    sections: [
      ['Objet', 'MANOU est un service gratuit de découverte et de comparaison de produits de beauté. MANOU n’est pas partie aux ventes conclues avec les marchands.'],
      ['Exactitude des informations', 'Les prix, disponibilités, frais de livraison et codes promotionnels proviennent des marchands ou de leurs flux et peuvent changer à tout moment. Chaque offre affiche sa date de dernière vérification. Vérifiez toujours les conditions sur le site du marchand avant d’acheter. Les totaux de panier sont des estimations non garanties.'],
      ['Authenticité', 'MANOU classe les marchands par type (officiel, revendeur vérifié, marketplace, vendeur tiers, non vérifié) et indique la date du dernier contrôle, sans garantir l’authenticité d’un produit.'],
      ['Contenus', 'Les avis des utilisateurs doivent être honnêtes, sans propos illicites. MANOU peut retirer tout contenu contraire aux présentes conditions. Les avis marqués « démonstration » sont fictifs.'],
      ['Informations cosmétiques', 'Les informations sur les ingrédients et les produits ont une vocation documentaire. Elles ne constituent ni un avis médical ni une promesse thérapeutique. En cas de doute ou de peau réactive, demandez conseil à un professionnel de santé.'],
      ['Compte', 'Vous êtes responsable de la confidentialité de votre mot de passe. MANOU peut suspendre un compte en cas d’abus.'],
      ['Droit applicable', 'Droit français. [Médiateur de la consommation — à compléter].'],
    ],
  },
  cookies: {
    title: 'Gestion des cookies',
    desc: 'Choisissez les cookies et traceurs que MANOU peut utiliser.',
    sections: [
      ['Cookies strictement nécessaires', 'Cookie de session « vsid » (connexion). Il est indispensable au fonctionnement du compte et ne nécessite pas de consentement.'],
      ['Stockage local', 'Votre navigateur conserve localement vos favoris et votre panier lorsque vous n’êtes pas connecté, ainsi que vos choix de cookies. Ces données restent sur votre appareil.'],
      ['Personnalisation (facultatif)', 'Si vous l’acceptez, vos recherches récentes sont enregistrées sur votre compte pour affiner les recommandations. Refus par défaut pour les visiteurs non connectés.'],
      ['Mesure d’audience et publicité', 'Non utilisées dans cette version. Si elles sont ajoutées, elles ne seront activées qu’après votre consentement explicite.'],
    ],
  },
};
