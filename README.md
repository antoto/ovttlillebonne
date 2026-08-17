# Site OVTT Lillebonne — Documentation technique

Site complet du club **OVTT Lillebonne (Objectif VTT 1988)**, en HTML/CSS/JS
pur, connecté à Firebase (Authentication, Realtime Database, Storage).
Aucun framework ni build : chaque page se modifie directement.

## 1. Structure des fichiers

```
index.html          Page d'accueil
apropos.html         Page À propos
team.html            Page Le Team (pilotes & staff, intégrée au site)
contact.html         Page Contact
calendrier.html      Calendrier des événements (dynamique, temps réel)
organisations.html   Nos organisations (dynamique, temps réel)
blog.html            Liste des articles (dynamique, temps réel)
article.html         Détail d'un article (dynamique, via ?id=...)
adherent.html        Formulaire d'adhésion multi-pages (4 pages), SANS paiement
partenaire.html      Dossier de partenariat + bouton de contact
admin.html           Espace administrateur (protégé par mot de passe)

css/style.css        Design du site public (dont navigation desktop)
css/admin.css         Design de l'espace administrateur (dont fiche adhérent)

js/firebase.js         Configuration Firebase + lecture/écriture temps réel
js/components.js       Menu et pied de page (un seul endroit à modifier)
js/main.js              Comportements du site public (animations, données)
js/admin.js              Authentification + gestion des données (CRUD, paiement, export)

assets/images/          Toutes les images du site (voir assets/images/README.md)
```

## 2. Modifier le menu ou le pied de page

Tout le menu et le footer sont générés depuis **un seul fichier** :
`js/components.js`. Pour ajouter/renommer un lien du menu, modifiez le
tableau `NAV_LINKS` en haut du fichier — le changement s'applique
automatiquement à toutes les pages, sur desktop comme sur mobile.

## 3. Navigation desktop

La barre de navigation a deux comportements distincts, gérés uniquement
en CSS dans `css/style.css` :
- en dessous de 961px de large : menu hamburger mobile (inchangé, ne pas
  toucher à cette partie) ;
- à partir de 961px : version desktop dédiée (bloc `@media (min-width:
  961px)`), avec fond translucide + flou (`backdrop-filter`), header qui
  se compacte au défilement, soulignement animé au survol et sur la
  page active, séparateur avant le bouton "Espace adhérent".

## 4. Base de données Firebase (Realtime Database)

```
/users/{uid}            { email, role }
/adherents/{id}          bulletins d'adhésion + suivi du paiement (voir section 8)
/articles/{id}           { titre, image, date, auteur, texte }
/evenements/{id}          { nom, date, lieu, type }
/organisations/{id}       { nom, date, image, description, infos }
/settings/site            { visible: true|false }
```

## 5. Synchronisation temps réel (⚠️ lire si une donnée n'apparaît pas)

Toutes les lectures de listes (`articles`, `evenements`, `organisations`,
`adherents`) utilisent des écouteurs Firebase `.on("value", ...)` et non
plus `.once("value")` : un ajout, une modification ou une suppression
fait depuis `admin.html` se répercute **instantanément**, sans recharger
la page, aussi bien dans l'administration que sur le site public.

Si malgré tout une donnée reste invisible côté admin ou côté public
alors qu'elle est bien visible dans la console Firebase, la cause est
presque toujours la même : **les règles de sécurité de la Realtime
Database bloquent la lecture côté client** (un projet Firebase tout
neuf refuse toute lecture/écriture par défaut). Vérifiez dans l'ordre :

1. Que les règles publiées dans la console correspondent bien à celles
   de la section 7 ci-dessous (et qu'elles ont été **publiées**, pas
   seulement enregistrées en brouillon).
2. Que `databaseURL` dans `js/firebase.js` correspond bien à la région
   de votre base (visible dans Firebase Console → Realtime Database →
   en haut de la page).
3. La console du navigateur (touche F12 → onglet "Console") : chaque
   échec de lecture y est maintenant journalisé explicitement, et un
   message d'erreur visible remplace le "Chargement…" qui resterait
   bloqué sinon.

## 6. Créer le premier compte administrateur

Le site utilise **Firebase Authentication** (email + mot de passe).
Pour créer le premier compte du bureau du club :

1. Ouvrez la [console Firebase](https://console.firebase.google.com/) du
   projet `site-ovtt-lillebonne`.
2. Menu **Authentication** → onglet **Sign-in method** → activez
   la méthode **Email/Password** si ce n'est pas déjà fait.
3. Onglet **Users** → **Add user** → renseignez l'email et le mot de
   passe du/de la responsable qui gérera le site.
4. Connectez-vous ensuite sur `admin.html` avec cet email et ce mot
   de passe.

## 7. Règles de sécurité recommandées

**Realtime Database → Règles :**

```json
{
  "rules": {
    "articles": { ".read": true, ".write": "auth != null" },
    "evenements": { ".read": true, ".write": "auth != null" },
    "organisations": { ".read": true, ".write": "auth != null" },
    "settings": { ".read": true, ".write": "auth != null" },
    "adherents": { ".read": "auth != null", ".write": true },
    "users": { ".read": "auth != null", ".write": "auth != null" }
  }
}
```

**Storage → Règles** (pour l'upload d'images depuis l'administration) :

```
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 8. Espace adhérent : dossier administratif, sans paiement

Le formulaire public (`adherent.html`, 4 étapes : Bulletin 2027 /
Urgence / Santé & autorisations / Licence & contacts) ne contient
**aucune information financière** — pas de montant, pas de calcul, pas
de choix de règlement. L'adhérent choisit uniquement son statut
(Majeur/Mineur) en page 1, ce qui affiche ou masque automatiquement les
blocs réservés aux mineurs (`js/main.js`, fonction `applyStatutCivil`).

Toute la gestion financière se fait **exclusivement** depuis
`admin.html`, sur chaque fiche adhérent (bouton "💳 Paiement") :
type de licence (FFC/FSGT), montant, réduction automatique par position
dans la famille (80 €/75 €/65 €), aides déduites (Pass'Sport, Atout
Normandie, comité d'entreprise, ANCV, autre), calcul automatique du
reste à payer, moyen de règlement, statut (En attente / Partiellement
réglé / Réglé), date du paiement et note interne — le tout enregistré
dans Firebase sur la fiche de l'adhérent concerné.

## 9. Fiche adhérent (administration)

Chaque fiche (`admin.html` → onglet Adhérents → "Voir") affiche un
véritable mini tableau de bord : avatar (initiales), badges colorés
(Majeur/Mineur, statut de paiement, dossier complet/incomplet), barre
de progression du dossier, puis des sections classées par carte :
Informations personnelles, Parents (si mineur), Santé, Contacts
d'urgence, Autorisations, Documents (case à cocher, modifiable
directement), et Paiement (avec accès direct à la modale de gestion).

## 10. Export Excel (.xlsx)

Le bouton "Exporter en Excel" (onglet Adhérents) génère un classeur
`.xlsx` professionnel via la librairie **ExcelJS** (chargée en CDN dans
`admin.html`), avec plusieurs feuilles :
- **Adhérents** : une ligne par adhérent (nom, prénom, date de
  naissance, âge, catégorie, téléphone, email, adresse, responsable
  légal, téléphone d'urgence, licence, paiement, statut du dossier,
  date d'inscription…), en-têtes colorés, filtres automatiques,
  largeur de colonnes adaptée, première ligne figée.
- **Paiements** : détail financier par adhérent.
- **Mineurs** : liste des mineurs avec contacts des parents.
- **Statistiques** : effectifs, répartition des paiements, total
  restant à percevoir.

La fonction `computeCategorieFFC(age)` (dans `js/admin.js`) donne une
catégorie d'âge indicative (U9, U11…, Senior) — à ajuster si besoin
selon les catégories officielles FFC en vigueur.

## 11. Page "Le Team" (pilotes & staff)

La page `team.html` est entièrement intégrée au site (aucune
redirection externe). Deux sections, **Pilotes** et **Staff**, avec des
cartes au format photo obligatoire **800 x 1000 px**. Pour ajouter un
pilote ou un membre du staff, dupliquez le bloc `<div
class="team-card">...</div>` fourni en exemple (commenté dans le
fichier), puis changez simplement l'image, le nom et la catégorie.

## 12. Page "Devenir partenaire"

La page `partenaire.html` reprend le dossier de partenariat du club
(histoire, bureau, sections, besoins, avantages, contacts). Le bouton
**"Prendre contact avec le responsable partenariat"** utilise une
adresse email temporaire : remplacez le lien `mailto:` de l'élément
`#partenariat-contact-link` par l'adresse réelle du responsable.

## 13. Images du site (`assets/images/`)

Toutes les images sont organisées par page/section dans
`assets/images/` — voir le détail complet (chemins exacts, formats
conseillés) dans `assets/images/README.md`. Il suffit de déposer vos
fichiers aux emplacements indiqués : rien à modifier dans le code.

Les images des articles de blog et des organisations créés depuis
l'administration peuvent utiliser un chemin local ou une URL externe ;
si le champ est laissé vide, une image par défaut locale est utilisée
(voir `ASSETS_BASE` en haut de `js/main.js` et `js/admin.js`).

## 14. Mode maintenance

Dans l'administration, l'onglet **Visibilité du site** permet de
masquer entièrement le site public (un message "Le site est
actuellement en maintenance." s'affiche à la place) sans jamais
bloquer l'accès à `admin.html`.

## 15. Déploiement

Le site est 100% statique (HTML/CSS/JS) : il peut être déployé sur
**Firebase Hosting**, ou tout autre hébergeur web classique. Avec
Firebase Hosting :

```
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 16. Couleurs officielles du club

| Couleur         | Code      |
|-----------------|-----------|
| Bleu            | `#00acda` |
| Rouge           | `#ff0000` |
| Vert            | `#8ab432` |
| Vert turquoise  | `#3cb094` |

Ces couleurs sont centralisées en variables CSS en haut de
`css/style.css` (`:root`) — les modifier là suffit à les changer sur
tout le site.
