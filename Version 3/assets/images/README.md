IMAGES DU SITE — OVTT LILLEBONNE
================================
Toutes les images du site sont organisées dans "assets/images/", par
page/section. Aucune photo n'a été fournie automatiquement : il vous
suffit de déposer vos fichiers en respectant exactement les noms et
emplacements ci-dessous — le site les affichera immédiatement, sans
toucher au code.

assets/images/branding/
  logo.png              -> Logo du club (menu + pied de page + admin). Fond transparent, carré.

assets/images/home/
  hero.jpg              -> Grande photo de VTT, bannière de l'accueil (format large, 1920x1080 conseillé).
  equipe.jpg            -> Photo d'équipe (section "Présentation rapide").
  gallery1.jpg          -> Photo n°1 de la galerie "En images".
  gallery2.jpg          -> Photo n°2 de la galerie "En images".
  gallery3.jpg          -> Photo n°3 de la galerie "En images".

assets/images/about/
  ecole-vtt.jpg         -> Illustration principale de la page À propos.
  entrainement.jpg      -> Illustration de la section Entraînements.
  competition.jpg       -> Illustration de la section Compétition.

assets/images/team/
  hero.jpg              -> Bannière en haut de la page Le Team.
  pilote1.jpg           -> Photo d'exemple pour une carte "Pilote" (format 800x1000 px obligatoire).
  staff1.jpg            -> Photo d'exemple pour une carte "Staff" (format 800x1000 px obligatoire).

assets/images/calendar/
  hero.jpg              -> Bannière en haut de la page Calendrier.

assets/images/organisations/
  hero.jpg              -> Bannière en haut de la page Nos organisations.

assets/images/blog/
  hero.jpg              -> Bannière en haut de la page Blog.

assets/images/contact/
  hero.jpg              -> Illustration de la page Contact.

assets/images/partenaire/
  hero.jpg              -> Visuel de couverture du dossier de partenariat.

assets/images/adherent/
  hero.jpg              -> Illustration en tête de l'Espace adhérent.

FORMAT DES PHOTOS "LE TEAM" : 800 x 1000 px (portrait), pour que
toutes les cartes pilotes/staff soient parfaitement alignées.
Pour ajouter un pilote ou un membre du staff supplémentaire, dupliquez
le bloc de carte dans team.html et changez simplement l'image, le nom
et la catégorie (voir les commentaires dans le fichier).

IMAGES DU BLOG ET DES ORGANISATIONS (contenus ajoutés depuis admin.html)
-------------------------------------------------------------------------
Chaque article ou organisation créé depuis l'administration a son
propre champ "image" : vous pouvez y indiquer un chemin local
(ex. assets/images/blog/mon-article.jpg) ou une URL externe. Si ce
champ est laissé vide, une image par défaut est utilisée :

assets/images/blog/article1.jpg           -> image par défaut d'un article sans photo.
assets/images/organisations/randonnee.jpg -> image par défaut d'une organisation sans photo.

Ces deux chemins par défaut sont centralisés dans la constante
ASSETS_BASE en haut de js/main.js et js/admin.js — à adapter si vous
souhaitez utiliser d'autres noms de fichiers.
