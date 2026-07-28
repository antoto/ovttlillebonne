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
calendrier.html      Calendrier des événements (dynamique)
organisations.html   Nos organisations (dynamique)
blog.html            Liste des articles (dynamique)
article.html         Détail d'un article (dynamique, via ?id=...)
adherent.html        Formulaire d'adhésion multi-pages (5 pages), avec bascule Majeur/Mineur
partenaire.html      Dossier de partenariat + bouton de contact
admin.html           Espace administrateur (protégé par mot de passe)

css/style.css        Design du site public
css/admin.css         Design de l'espace administrateur

js/firebase.js        Configuration Firebase + fonctions de lecture/écriture
js/components.js      Menu et pied de page (un seul endroit à modifier)
js/main.js             Comportements du site public (animations, données)
js/admin.js            Authentification + gestion des données (CRUD)

images/               Vos photos (voir images/README_IMAGES.txt)
```

## 2. Modifier le menu ou le pied de page

Tout le menu et le footer sont générés depuis **un seul fichier** :
`js/components.js`. Pour ajouter/renommer un lien du menu, modifiez le
tableau `NAV_LINKS` en haut du fichier — le changement s'applique
automatiquement à toutes les pages.

## 3. Base de données Firebase (Realtime Database)

```
/users/{uid}            { email, role }
/adherents/{id}          bulletins d'adhésion (toutes les données du formulaire)
/articles/{id}           { titre, image, date, auteur, texte }
/evenements/{id}          { nom, date, lieu, type }
/organisations/{id}       { nom, date, image, description, infos }
/settings/site            { visible: true|false }
```

Toutes ces données sont créées et modifiées automatiquement par
l'espace administrateur — aucune manipulation manuelle n'est requise.

## 4. Créer le premier compte administrateur

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

Vous pouvez créer un compte par personne du bureau ayant besoin
d'accéder à l'administration.

## 5. Règles de sécurité recommandées (Realtime Database)

Par défaut, une base Firebase toute neuve est **fermée**. Dans
**Realtime Database → Règles**, voici une configuration recommandée :
lecture publique des contenus du site, écriture réservée aux
utilisateurs connectés (le bureau du club), et écriture publique
uniquement sur `/adherents` (pour permettre l'envoi du formulaire
d'adhésion sans compte) :

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

## 6. Règles de sécurité recommandées (Storage)

Pour permettre l'upload d'images depuis l'administration :

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

## 7. Page "Le Team" (pilotes & staff)

La page `team.html` est désormais entièrement intégrée au site (elle
ne redirige plus vers un site externe). Elle contient deux sections,
**Pilotes** et **Staff**, chacune affichant des cartes au format photo
obligatoire **800 x 1000 px**.

Pour ajouter un pilote ou un membre du staff : dupliquez le bloc
`<div class="team-card">...</div>` fourni en exemple dans le code
(commenté clairement), puis changez simplement :
- le chemin de la photo (`images/...`, format 800x1000 px),
- le nom (`.team-name`),
- la catégorie ou fonction (`.team-category`).

Le petit texte d'introduction en haut de page est temporaire — vous
pouvez le remplacer directement dans `team.html`.

## 8. Adhésion : bascule Majeur / Mineur

Sur `adherent.html`, l'adhérent choisit d'abord son statut (Majeur ou
Mineur) en page 1. Selon ce choix, les blocs réservés aux mineurs
(informations des parents, autorisations parentales) apparaissent ou
disparaissent automatiquement — géré par `js/main.js`
(`applyStatutCivil`). Aucun paiement n'est demandé en ligne : le
formulaire calcule un récapitulatif indicatif ("reste à verser") qui
est transmis à l'administration ; le règlement se fait ensuite en
présentiel au local avec le bureau.

## 9. Suivi des règlements (admin.html)

Chaque dossier adhérent reçoit automatiquement le statut **"En
attente de règlement"** à sa création. Depuis l'onglet **Adhérents**
de l'administration, un menu déroulant sur chaque ligne (et dans la
fiche détaillée) permet de faire passer le dossier à **"Réglé"** une
fois le paiement reçu au local. Le tableau de bord affiche également
le nombre de dossiers encore en attente.

## 10. Page "Devenir partenaire"

La page `partenaire.html` reprend le dossier de partenariat du club
(histoire, bureau, sections, besoins, avantages partenaires,
contacts). Le bouton **"Prendre contact avec le responsable
partenariat"** utilise une adresse email temporaire
(`partenariat@ovtt-lillebonne.fr`) : remplacez le lien `mailto:` de
l'élément `#partenariat-contact-link` par l'adresse réelle du
responsable partenariat.

## 11. Images du blog et des organisations : hébergement GitHub

Les images des articles de blog et des organisations ne sont plus
placées dans le dossier `images/` du site : depuis l'administration,
renseignez directement une URL d'image hébergée sur GitHub (ou tout
autre hébergeur). Si aucune URL n'est indiquée, une image par défaut
est utilisée — son adresse est centralisée dans la constante
`GITHUB_ASSETS_BASE` en haut de `js/main.js` (et `js/admin.js`), à
adapter à votre propre dépôt d'images. Les photos "en dur" du site
(bannière d'accueil, équipe, Le Team…) restent quant à elles dans le
dossier `images/` local, comme expliqué dans
`images/README_IMAGES.txt`.

## 12. Mode maintenance

Dans l'administration, l'onglet **Visibilité du site** permet de
masquer entièrement le site public (un message "Le site est
actuellement en maintenance." s'affiche à la place) sans jamais
bloquer l'accès à `admin.html`.

## 13. Déploiement

Le site est 100% statique (HTML/CSS/JS) : il peut être déployé sur
**Firebase Hosting**, ou tout autre hébergeur web classique. Avec
Firebase Hosting :

```
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 14. Couleurs officielles du club

| Couleur         | Code      |
|-----------------|-----------|
| Bleu            | `#00acda` |
| Rouge           | `#ff0000` |
| Vert            | `#8ab432` |
| Vert turquoise  | `#3cb094` |

Ces couleurs sont centralisées en variables CSS en haut de
`css/style.css` (`:root`) — les modifier là suffit à les changer sur
tout le site.
