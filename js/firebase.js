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
   Utilisé par main.js sur les pages publiques.
------------------------------------------------------------ */
function checkSiteVisibility(onHidden) {
  db.ref("settings/site").once("value")
    .then((snap) => {
      const data = snap.val();
      if (data && data.visible === false) {
        onHidden();
      }
    })
    .catch((err) => console.error("Erreur lecture settings/site :", err));
}

/* ------------------------------------------------------------
   Utilitaires communs de lecture Firebase, réutilisés par
   main.js (site public) et admin.js (back-office).
------------------------------------------------------------ */
const FirebaseAPI = {
  // -- ARTICLES (blog) --
  getArticles(callback) {
    db.ref("articles").orderByChild("date").once("value").then((snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list.reverse()); // plus récents en premier
    });
  },
  getArticle(id, callback) {
    db.ref("articles/" + id).once("value").then((snap) => callback(snap.val()));
  },
  saveArticle(id, data) {
    if (id) return db.ref("articles/" + id).update(data);
    return db.ref("articles").push(data);
  },
  deleteArticle(id) {
    return db.ref("articles/" + id).remove();
  },

  // -- EVENEMENTS (calendrier) --
  getEvenements(callback) {
    db.ref("evenements").orderByChild("date").once("value").then((snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list);
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
  getOrganisations(callback) {
    db.ref("organisations").orderByChild("date").once("value").then((snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list.reverse());
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
      statut_paiement: "En attente de règlement",
      dateInscription: new Date().toISOString()
    });
  },
  getAdherents(callback) {
    db.ref("adherents").once("value").then((snap) => {
      const list = [];
      snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      callback(list);
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
