/* ============================================================
   OVTT LILLEBONNE — firebase.js
   Initialisation Firebase (Auth, Realtime Database, Storage)
   Ce fichier doit être chargé APRÈS les scripts CDN Firebase :

   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>
   <script src="js/firebase.js"></script>

   Structure de la base Realtime Database (voir /README.md) :
   /users/{uid}                 -> { email, role }
   /adherents/{id}              -> bulletins d'adhésion
   /articles/{id}               -> articles de blog
   /evenements/{id}             -> calendrier
   /organisations/{id}          -> "Nos organisations"
   /settings/site               -> { visible: true/false }

   ⚠️ SYNCHRONISATION TEMPS RÉEL
   Toutes les lectures de listes (articles, événements, organisations,
   adhérents) utilisent désormais `.on("value", ...)` et non plus
   `.once("value")`. Un ajout, une modification ou une suppression
   effectué depuis admin.html est répercuté INSTANTANÉMENT, sans
   recharger la page, à la fois dans l'administration et sur le site
   public.

   Si malgré cela une donnée reste invisible alors qu'elle apparaît
   bien dans la console Firebase, la cause est presque toujours la
   même : les règles de sécurité de la Realtime Database bloquent la
   lecture côté client (un projet Firebase tout neuf refuse tout par
   défaut). Voir le README, section "Règles de sécurité". Chaque échec
   de lecture est désormais journalisé dans la console du navigateur
   (F12) ET affiché comme message d'erreur explicite sur la page,
   au lieu de rester bloqué sur "Chargement…".
   ============================================================ */

// Configuration du projet Firebase OVTT Lillebonne
const firebaseConfig = {
  apiKey: "AIzaSyBvyeXtLbuz0tEbg5dZfSBjkmFr-LYmjoQ",
  authDomain: "site-ovtt-lillebonne.firebaseapp.com",
  databaseURL: "https://site-ovtt-lillebonne-default-rtdb.firebaseio.com",
  projectId: "site-ovtt-lillebonne",
  storageBucket: "site-ovtt-lillebonne.firebasestorage.app",
  messagingSenderId: "124006378505",
  appId: "1:124006378505:web:9b7df8a2918aee1036dcd8"
};

// Initialisation (protégée contre une double initialisation)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

/* ------------------------------------------------------------
   Vérifie si le site est en mode "masqué" (maintenance).
------------------------------------------------------------ */
function checkSiteVisibility(onHidden) {
  db.ref("settings/site").once("value")
    .then((snap) => {
      const data = snap.val();
      if (data && data.visible === false) onHidden();
    })
    .catch((err) => console.error("Erreur lecture settings/site :", err));
}

/* ------------------------------------------------------------
   Utilitaires communs de lecture/écriture Firebase.
   Chaque fonction getXxx(callback, onError) s'abonne EN CONTINU
   aux changements ("on", pas "once") : callback est appelé une
   première fois avec les données actuelles, puis à nouveau à
   chaque ajout / modification / suppression — sans jamais avoir
   besoin de rappeler la fonction manuellement ni de recharger
   la page.
------------------------------------------------------------ */
const FirebaseAPI = {
  // -- ARTICLES (blog) --
  getArticles(callback, onError) {
    db.ref("articles").orderByChild("date").on("value", (snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list.reverse()); // plus récents en premier
    }, (err) => {
      console.error("Erreur lecture Firebase /articles :", err);
      if (onError) onError(err);
    });
  },
  getArticle(id, callback, onError) {
    db.ref("articles/" + id).once("value")
      .then((snap) => callback(snap.val()))
      .catch((err) => {
        console.error("Erreur lecture Firebase /articles/" + id + " :", err);
        if (onError) onError(err);
      });
  },
  saveArticle(id, data) {
    if (id) return db.ref("articles/" + id).update(data);
    return db.ref("articles").push(data);
  },
  deleteArticle(id) {
    return db.ref("articles/" + id).remove();
  },

  // -- EVENEMENTS (calendrier) --
  getEvenements(callback, onError) {
    db.ref("evenements").orderByChild("date").on("value", (snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list);
    }, (err) => {
      console.error("Erreur lecture Firebase /evenements :", err);
      if (onError) onError(err);
    });
  },
  saveEvenement(id, data) {
    if (id) return db.ref("evenements/" + id).update(data);
    return db.ref("evenements").push(data);
  },
  deleteEvenement(id) {
    return db.ref("evenements/" + id).remove();
  },

  // -- ORGANISATIONS --
  getOrganisations(callback, onError) {
    db.ref("organisations").orderByChild("date").on("value", (snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list.reverse());
    }, (err) => {
      console.error("Erreur lecture Firebase /organisations :", err);
      if (onError) onError(err);
    });
  },
  saveOrganisation(id, data) {
    if (id) return db.ref("organisations/" + id).update(data);
    return db.ref("organisations").push(data);
  },
  deleteOrganisation(id) {
    return db.ref("organisations/" + id).remove();
  },

  // -- ADHERENTS (bulletins) --
  saveAdherent(data) {
    return db.ref("adherents").push({
      ...data,
      statut_paiement: "En attente",
      dateInscription: new Date().toISOString()
    });
  },
  getAdherents(callback, onError) {
    db.ref("adherents").on("value", (snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list);
    }, (err) => {
      console.error("Erreur lecture Firebase /adherents :", err);
      if (onError) onError(err);
    });
  },
  updateAdherent(id, data) {
    return db.ref("adherents/" + id).update(data);
  },
  deleteAdherent(id) {
    return db.ref("adherents/" + id).remove();
  },

  // -- Upload d'image vers Firebase Storage --
  uploadImage(file, path, callback, onError) {
    const ref = storage.ref().child(path + "/" + Date.now() + "_" + file.name);
    ref.put(file).then((snapshot) => {
      snapshot.ref.getDownloadURL().then((url) => callback(url));
    }).catch((err) => {
      console.error("Erreur upload image :", err);
      if (onError) onError(err);
    });
  }
};
