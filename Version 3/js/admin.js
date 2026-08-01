/* ============================================================
   OVTT LILLEBONNE — admin.js
   Authentification + CRUD complet de l'espace administrateur
   Synchronisation temps réel (voir js/firebase.js : FirebaseAPI
   utilise désormais des écouteurs "on" et non plus "once" : toute
   création/modification/suppression se répercute automatiquement
   ici ET sur le site public, sans recharger la page).
   ============================================================ */

const loginScreen = document.getElementById("login-screen");
const adminShell = document.getElementById("admin-shell");

/* Image par défaut (locale, dossier assets/images/) si aucune image
   personnalisée n'est renseignée pour un article ou une organisation. */
const ASSETS_BASE = "assets/images/";

/* Statuts de règlement possibles pour un dossier adhérent */
const STATUTS_PAIEMENT = ["En attente", "Partiellement réglé", "Réglé"];

let adherentsCache = [];

/* ---------- AUTHENTIFICATION ---------- */
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorBox = document.getElementById("login-error");
  errorBox.textContent = "";

  auth.signInWithEmailAndPassword(email, password)
    .catch((err) => {
      console.error(err);
      errorBox.textContent = "Email ou mot de passe incorrect.";
    });
});

document.getElementById("logout-btn").addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged((user) => {
  if (user) {
    loginScreen.style.display = "none";
    adminShell.classList.add("is-active");
    document.getElementById("admin-user-email").textContent = user.email;
    // Chaque fonction s'abonne EN CONTINU (voir firebase.js) : un seul
    // appel suffit, la liste et les compteurs se rafraîchissent seuls.
    loadArticles();
    loadEvents();
    loadOrgs();
    loadAdherents();
    loadVisibility();
  } else {
    loginScreen.style.display = "flex";
    adminShell.classList.remove("is-active");
  }
});

/* ---------- NAVIGATION ENTRE PANNEAUX ---------- */
const panelTitles = {
  "panel-dashboard": "Tableau de bord",
  "panel-adherents": "Gestion des adhérents",
  "panel-blog": "Gestion du blog",
  "panel-calendrier": "Gestion du calendrier",
  "panel-organisations": "Gestion des organisations",
  "panel-visibilite": "Visibilité du site"
};
document.querySelectorAll(".admin-nav-btn[data-panel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-btn[data-panel]").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const panelId = btn.dataset.panel;
    document.getElementById(panelId).classList.add("active");
    document.getElementById("admin-panel-title").textContent = panelTitles[panelId];
  });
});

/* ---------- Modales ---------- */
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".admin-modal-overlay").classList.remove("is-open"));
});
document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("is-open"); });
});
function openModal(id) { document.getElementById(id).classList.add("is-open"); }
function closeModal(id) { document.getElementById(id).classList.remove("is-open"); }

/* ---------- Utilitaires ---------- */
function escapeHtml(str) {
  return (str ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("fr-FR");
}
function showToastAdmin(msg) {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;background:#0e1f2b;color:#fff;padding:14px 20px;border-radius:10px;font-size:0.88rem;font-weight:600;z-index:2000;box-shadow:0 10px 30px rgba(0,0,0,0.3);transition:all .3s;";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateY(10px)"; }, 3500);
}

/* Âge à partir d'une date de naissance (YYYY-MM-DD) */
function computeAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/* Catégorie FFC indicative à partir de l'âge — à ajuster si besoin,
   fournie à titre de repère pour le bureau. */
function computeCategorieFFC(age) {
  if (age === null || age === undefined || isNaN(age)) return "";
  if (age <= 8) return "U9";
  if (age <= 10) return "U11";
  if (age <= 12) return "U13";
  if (age <= 14) return "U15";
  if (age <= 16) return "U17";
  if (age <= 18) return "U19";
  if (age <= 22) return "Espoir";
  return "Senior";
}

/* Progression du dossier (%) selon les champs essentiels renseignés */
function ficheProgress(a) {
  const isMinor = a.statut_civil === "Mineur";
  const required = [
    "adherent_nom", "adherent_prenom", "adherent_date_naissance",
    "adherent_adresse", "adherent_telephone", "adherent_email",
    "urgence1_nom", "urgence1_telephone", "droit_image"
  ];
  if (isMinor) required.push("parent1_nom", "parent1_telephone", "autorisation_rentrer_seul", "signature_decharge");
  const filled = required.filter((k) => a[k] && String(a[k]).trim() !== "").length;
  return Math.round((filled / required.length) * 100);
}

function paiementBadgeClass(statut) {
  if (statut === "Réglé") return "badge-green";
  if (statut === "Partiellement réglé") return "badge-blue";
  return "badge-orange";
}

/* ============================================================
   BLOG
   ============================================================ */
function loadArticles() {
  FirebaseAPI.getArticles((list) => {
    document.getElementById("stat-articles").textContent = list.length;
    const tbody = document.getElementById("articles-table-body");
    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Aucun article publié.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((a) => `
      <tr>
        <td>${escapeHtml(a.titre)}</td>
        <td>${fmtDate(a.date)}</td>
        <td>${escapeHtml(a.auteur)}</td>
        <td class="table-actions">
          <button class="btn-admin btn-admin-ghost" data-edit-article="${a.id}">Modifier</button>
          <button class="btn-admin btn-admin-red" data-delete-article="${a.id}">Supprimer</button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-edit-article]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = list.find((x) => x.id === btn.dataset.editArticle);
        document.getElementById("modal-article-title").textContent = "Modifier l'article";
        document.getElementById("article-id").value = a.id;
        document.getElementById("article-titre").value = a.titre || "";
        document.getElementById("article-image").value = a.image || "";
        document.getElementById("article-date").value = a.date || "";
        document.getElementById("article-auteur").value = a.auteur || "";
        document.getElementById("article-texte").value = a.texte || "";
        openModal("modal-article");
      });
    });
    tbody.querySelectorAll("[data-delete-article]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Supprimer cet article ?")) {
          FirebaseAPI.deleteArticle(btn.dataset.deleteArticle).then(() => showToastAdmin("Article supprimé."));
        }
      });
    });
  }, () => {
    document.getElementById("articles-table-body").innerHTML = `<tr class="empty-row"><td colspan="4">⚠️ Erreur de lecture Firebase (voir README, section « Règles de sécurité »).</td></tr>`;
  });
}

document.getElementById("add-article-btn").addEventListener("click", () => {
  document.getElementById("form-article").reset();
  document.getElementById("article-id").value = "";
  document.getElementById("modal-article-title").textContent = "Ajouter un article";
  openModal("modal-article");
});

document.getElementById("form-article").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("article-id").value;
  const data = {
    titre: document.getElementById("article-titre").value,
    image: document.getElementById("article-image").value || ASSETS_BASE + "blog/article1.jpg",
    date: document.getElementById("article-date").value,
    auteur: document.getElementById("article-auteur").value || "OVTT Lillebonne",
    texte: document.getElementById("article-texte").value
  };
  FirebaseAPI.saveArticle(id, data).then(() => {
    closeModal("modal-article");
    showToastAdmin("Article publié avec succès.");
  }).catch((err) => { console.error(err); showToastAdmin("Erreur : l'article n'a pas pu être enregistré."); });
});

/* ============================================================
   CALENDRIER
   ============================================================ */
function loadEvents() {
  FirebaseAPI.getEvenements((list) => {
    document.getElementById("stat-evenements").textContent = list.length;
    const tbody = document.getElementById("events-table-body");
    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Aucun événement au calendrier.</td></tr>`;
      return;
    }
    const sorted = [...list].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    tbody.innerHTML = sorted.map((ev) => `
      <tr>
        <td>${escapeHtml(ev.nom)}</td>
        <td>${fmtDate(ev.date)}</td>
        <td>${escapeHtml(ev.lieu)}</td>
        <td><span class="badge badge-blue">${escapeHtml(ev.type)}</span></td>
        <td class="table-actions">
          <button class="btn-admin btn-admin-ghost" data-edit-event="${ev.id}">Modifier</button>
          <button class="btn-admin btn-admin-red" data-delete-event="${ev.id}">Supprimer</button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-edit-event]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ev = list.find((x) => x.id === btn.dataset.editEvent);
        document.getElementById("modal-event-title").textContent = "Modifier l'événement";
        document.getElementById("event-id").value = ev.id;
        document.getElementById("event-nom").value = ev.nom || "";
        document.getElementById("event-date").value = ev.date || "";
        document.getElementById("event-lieu").value = ev.lieu || "";
        document.getElementById("event-type").value = ev.type || "Autre";
        openModal("modal-event");
      });
    });
    tbody.querySelectorAll("[data-delete-event]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Supprimer cet événement ?")) {
          FirebaseAPI.deleteEvenement(btn.dataset.deleteEvent).then(() => showToastAdmin("Événement supprimé."));
        }
      });
    });
  }, () => {
    document.getElementById("events-table-body").innerHTML = `<tr class="empty-row"><td colspan="5">⚠️ Erreur de lecture Firebase (voir README, section « Règles de sécurité »).</td></tr>`;
  });
}

document.getElementById("add-event-btn").addEventListener("click", () => {
  document.getElementById("form-event").reset();
  document.getElementById("event-id").value = "";
  document.getElementById("modal-event-title").textContent = "Ajouter un événement";
  openModal("modal-event");
});

document.getElementById("form-event").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("event-id").value;
  const data = {
    nom: document.getElementById("event-nom").value,
    date: document.getElementById("event-date").value,
    lieu: document.getElementById("event-lieu").value,
    type: document.getElementById("event-type").value
  };
  FirebaseAPI.saveEvenement(id, data).then(() => {
    closeModal("modal-event");
    showToastAdmin("Événement enregistré avec succès.");
  }).catch((err) => { console.error(err); showToastAdmin("Erreur : l'événement n'a pas pu être enregistré."); });
});

/* ============================================================
   ORGANISATIONS
   ============================================================ */
function loadOrgs() {
  FirebaseAPI.getOrganisations((list) => {
    document.getElementById("stat-organisations").textContent = list.length;
    const tbody = document.getElementById("orgs-table-body");
    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Aucune organisation publiée.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((o) => `
      <tr>
        <td>${escapeHtml(o.nom)}</td>
        <td>${fmtDate(o.date)}</td>
        <td>${escapeHtml((o.description || "").slice(0, 60))}${(o.description || "").length > 60 ? "…" : ""}</td>
        <td class="table-actions">
          <button class="btn-admin btn-admin-ghost" data-edit-org="${o.id}">Modifier</button>
          <button class="btn-admin btn-admin-red" data-delete-org="${o.id}">Supprimer</button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-edit-org]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const o = list.find((x) => x.id === btn.dataset.editOrg);
        document.getElementById("modal-org-title").textContent = "Modifier l'organisation";
        document.getElementById("org-id").value = o.id;
        document.getElementById("org-nom").value = o.nom || "";
        document.getElementById("org-date").value = o.date || "";
        document.getElementById("org-image").value = o.image || "";
        document.getElementById("org-description").value = o.description || "";
        document.getElementById("org-infos").value = o.infos || "";
        openModal("modal-org");
      });
    });
    tbody.querySelectorAll("[data-delete-org]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Supprimer cette organisation ?")) {
          FirebaseAPI.deleteOrganisation(btn.dataset.deleteOrg).then(() => showToastAdmin("Organisation supprimée."));
        }
      });
    });
  }, () => {
    document.getElementById("orgs-table-body").innerHTML = `<tr class="empty-row"><td colspan="4">⚠️ Erreur de lecture Firebase (voir README, section « Règles de sécurité »).</td></tr>`;
  });
}

document.getElementById("add-org-btn").addEventListener("click", () => {
  document.getElementById("form-org").reset();
  document.getElementById("org-id").value = "";
  document.getElementById("modal-org-title").textContent = "Ajouter une organisation";
  openModal("modal-org");
});

document.getElementById("form-org").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("org-id").value;
  const data = {
    nom: document.getElementById("org-nom").value,
    date: document.getElementById("org-date").value,
    image: document.getElementById("org-image").value || ASSETS_BASE + "organisations/randonnee.jpg",
    description: document.getElementById("org-description").value,
    infos: document.getElementById("org-infos").value
  };
  FirebaseAPI.saveOrganisation(id, data).then(() => {
    closeModal("modal-org");
    showToastAdmin("Organisation enregistrée avec succès.");
  }).catch((err) => { console.error(err); showToastAdmin("Erreur : l'organisation n'a pas pu être enregistrée."); });
});

/* ============================================================
   ADHÉRENTS
   ============================================================ */
function statutPaiementBadgeHTML(a) {
  const s = a.statut_paiement || "En attente";
  return `<span class="badge ${paiementBadgeClass(s)}">${escapeHtml(s)}</span>`;
}
function dossierBadgeHTML(a) {
  const p = ficheProgress(a);
  return `<span class="badge ${p === 100 ? "badge-green" : "badge-red"}">${p}%</span>`;
}

function loadAdherents() {
  FirebaseAPI.getAdherents((list) => {
    adherentsCache = list;

    // Statistiques du tableau de bord (mises à jour en continu)
    document.getElementById("stat-adherents").textContent = list.length;
    const enAttente = list.filter((a) => (a.statut_paiement || "En attente") !== "Réglé").length;
    document.getElementById("stat-en-attente").textContent = enAttente;
    const recent = [...list].sort((a, b) => (b.dateInscription || "").localeCompare(a.dateInscription || "")).slice(0, 6);
    document.getElementById("dashboard-recent-adherents").innerHTML = recent.length
      ? recent.map((a) => `<tr><td>${escapeHtml(a.adherent_nom)}</td><td>${escapeHtml(a.adherent_prenom)}</td><td>${escapeHtml(a.adherent_email)}</td><td>${fmtDate(a.dateInscription)}</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="4">Aucun adhérent inscrit pour le moment.</td></tr>`;

    const tbody = document.getElementById("adherents-table-body");
    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Aucun adhérent inscrit pour le moment.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((a) => `
      <tr>
        <td><strong>${escapeHtml(a.adherent_prenom)} ${escapeHtml(a.adherent_nom)}</strong></td>
        <td>${escapeHtml(a.statut_civil || "—")}</td>
        <td>${escapeHtml(a.adherent_email)}<br><span style="color:#7c8b91; font-size:0.82rem;">${escapeHtml(a.adherent_telephone)}</span></td>
        <td>${fmtDate(a.dateInscription)}</td>
        <td>${dossierBadgeHTML(a)}</td>
        <td>${statutPaiementBadgeHTML(a)}</td>
        <td class="table-actions">
          <button class="btn-admin btn-admin-ghost" data-view-adherent="${a.id}">Voir</button>
          <button class="btn-admin btn-admin-turquoise" data-paiement-adherent="${a.id}">💳 Paiement</button>
          <button class="btn-admin btn-admin-red" data-delete-adherent="${a.id}">Supprimer</button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-view-adherent]").forEach((btn) => {
      btn.addEventListener("click", () => viewAdherent(btn.dataset.viewAdherent));
    });
    tbody.querySelectorAll("[data-paiement-adherent]").forEach((btn) => {
      btn.addEventListener("click", () => openPaiementModal(btn.dataset.paiementAdherent));
    });
    tbody.querySelectorAll("[data-delete-adherent]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Supprimer définitivement cette fiche adhérent ?")) {
          FirebaseAPI.deleteAdherent(btn.dataset.deleteAdherent).then(() => showToastAdmin("Fiche adhérent supprimée."));
        }
      });
    });
  }, () => {
    document.getElementById("adherents-table-body").innerHTML = `<tr class="empty-row"><td colspan="7">⚠️ Erreur de lecture Firebase (voir README, section « Règles de sécurité »).</td></tr>`;
  });
}

/* ---------- Fiche adhérent (tableau de bord moderne) ---------- */
function badgeHTML(text, cls) { return `<span class="badge ${cls}">${escapeHtml(text)}</span>`; }

function rowsFrom(map) {
  return Object.entries(map).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
}
function sectionHTML(title, rows, extra) {
  const content = rows.length
    ? rows.map(([label, val]) => `<div class="fiche-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(val)}</strong></div>`).join("")
    : `<div class="fiche-empty">Aucune information renseignée.</div>`;
  return `<div class="fiche-section${extra && extra.full ? " full" : ""}"><h3>${title}</h3>${content}</div>`;
}

function viewAdherent(id) {
  const a = adherentsCache.find((x) => x.id === id);
  if (!a) return;

  const isMinor = a.statut_civil === "Mineur";
  const age = computeAge(a.adherent_date_naissance);
  const categorie = computeCategorieFFC(age);
  const progress = ficheProgress(a);
  const statutPaiement = a.statut_paiement || "En attente";
  const initials = (((a.adherent_prenom || "")[0] || "") + ((a.adherent_nom || "")[0] || "")).toUpperCase() || "?";

  const header = `
    <div class="fiche-profile">
      <div class="fiche-avatar">${initials}</div>
      <div class="fiche-identity">
        <h2>${escapeHtml(a.adherent_prenom)} ${escapeHtml(a.adherent_nom)}</h2>
        <div class="sub">${age !== null ? age + " ans" : "Âge inconnu"}${categorie ? " · " + categorie : ""} · Inscrit le ${fmtDate(a.dateInscription)}</div>
        <div class="fiche-badges">
          ${badgeHTML(isMinor ? "Mineur" : "Majeur", isMinor ? "badge-orange" : "badge-blue")}
          ${badgeHTML(statutPaiement, paiementBadgeClass(statutPaiement))}
          ${badgeHTML(progress === 100 ? "Dossier complet" : "Dossier incomplet", progress === 100 ? "badge-green" : "badge-red")}
        </div>
      </div>
      <div class="fiche-progress-wrap">
        <div class="fiche-progress-label"><span>Progression du dossier</span><span>${progress}%</span></div>
        <div class="fiche-progress-bar"><span style="width:${progress}%;"></span></div>
      </div>
    </div>`;

  const perso = rowsFrom({
    "Statut civil": a.statut_civil,
    "Date de naissance": a.adherent_date_naissance ? fmtDate(a.adherent_date_naissance) : "",
    "Adhérent en 2026": a.adherent_2026,
    "Adresse": a.adherent_adresse,
    "Téléphone": a.adherent_telephone,
    "Email": a.adherent_email
  });

  const parents = isMinor ? rowsFrom({
    "Parent 1": [a.parent1_prenom, a.parent1_nom].filter(Boolean).join(" "),
    "Tél. Parent 1": a.parent1_telephone,
    "Email Parent 1": a.parent1_email,
    "Parent 2": [a.parent2_prenom, a.parent2_nom].filter(Boolean).join(" "),
    "Tél. Parent 2": a.parent2_telephone,
    "Infos transmises à": a.destinataire_infos
  }) : [];

  const sante = rowsFrom({
    "Vaccinations à jour": a.vaccinations_a_jour,
    "Traitement médical": a.traitement_medical,
    "Détail traitement": a.traitement_medical_details,
    "Allergies": a.allergies,
    "Détail allergies": a.allergies_details,
    "Personne à prévenir": a.personne_a_prevenir
  });

  const urgence = rowsFrom({
    "Contact 1": [a.urgence1_prenom, a.urgence1_nom, a.urgence1_lien ? "(" + a.urgence1_lien + ")" : ""].filter(Boolean).join(" "),
    "Tél. Contact 1": a.urgence1_telephone,
    "Contact 2": [a.urgence2_prenom, a.urgence2_nom].filter(Boolean).join(" "),
    "Tél. Contact 2": a.urgence2_telephone,
    "Contact 3": [a.urgence3_prenom, a.urgence3_nom].filter(Boolean).join(" "),
    "Tél. Contact 3": a.urgence3_telephone,
    "Observations": a.urgence_observations
  });

  const autorisations = rowsFrom({
    "Droit à l'image": a.droit_image,
    "Rentrer seul (mineur)": a.autorisation_rentrer_seul,
    "Décharge signée": a.signature_decharge
  });

  const paiement = rowsFrom({
    "Type de licence": a.paiement_type_licence,
    "Montant licence": a.paiement_montant_licence ? a.paiement_montant_licence + " €" : "",
    "Reste à payer": a.paiement_reste !== undefined ? a.paiement_reste + " €" : "",
    "Moyen de paiement": a.paiement_mode,
    "Date du paiement": a.paiement_date ? fmtDate(a.paiement_date) : "",
    "Note interne": a.paiement_note
  });

  const docItems = [
    ["secretariat_dossier_adherent", "Dossier adhérent complet"],
    ["secretariat_certificat_medical", "Certificat médical reçu"],
    ["secretariat_justificatifs", "Justificatifs reçus"],
    ["secretariat_sporteasy", "Inscrit sur SportEasy"]
  ];
  const documentsHtml = `<div class="fiche-doc-list">${docItems.map(([key, label]) =>
    `<label><input type="checkbox" data-doc-key="${key}" ${a[key] ? "checked" : ""}> ${label}</label>`
  ).join("")}</div>`;

  const body = `
    ${header}
    <div class="fiche-grid">
      ${sectionHTML("👤 Informations personnelles", perso)}
      ${sectionHTML("👨‍👩‍👧 Parents", parents)}
      ${sectionHTML("🩺 Santé", sante)}
      ${sectionHTML("🚨 Contacts d'urgence", urgence)}
      ${sectionHTML("📄 Autorisations", autorisations)}
      <div class="fiche-section"><h3>📁 Documents</h3>${documentsHtml}</div>
      <div class="fiche-section full">
        <h3>💳 Paiement <button type="button" class="btn-admin btn-admin-primary" style="margin-left:auto; padding:6px 14px; font-size:0.75rem;" data-open-paiement="${a.id}">Gérer le paiement</button></h3>
        ${paiement.length ? paiement.map(([l, v]) => `<div class="fiche-row"><span>${escapeHtml(l)}</span><strong>${escapeHtml(v)}</strong></div>`).join("") : `<div class="fiche-empty">Aucun règlement enregistré pour le moment.</div>`}
      </div>
    </div>`;

  document.getElementById("adherent-detail-content").innerHTML = body;

  document.querySelectorAll("#adherent-detail-content [data-doc-key]").forEach((cb) => {
    cb.addEventListener("change", () => {
      FirebaseAPI.updateAdherent(a.id, { [cb.dataset.docKey]: cb.checked });
    });
  });
  document.querySelectorAll("#adherent-detail-content [data-open-paiement]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal("modal-adherent");
      openPaiementModal(btn.dataset.openPaiement);
    });
  });

  openModal("modal-adherent");
}

/* ---------- Modale Paiement ---------- */
const AIDE_KEYS = ["aide-passsport", "aide-atout-normandie", "aide-ce", "aide-ancv", "aide-autre"];

function recalcPaiement() {
  const montantLicence = parseFloat(document.getElementById("paiement-montant-licence").value) || 0;
  const positionRadio = document.querySelector('input[name="paiement_position_famille"]:checked');
  const adhesion = positionRadio ? parseFloat(positionRadio.value) || 0 : 0;
  let aides = 0;
  AIDE_KEYS.forEach((key) => {
    const cb = document.getElementById(key);
    if (cb && cb.checked) {
      const montantInput = document.querySelector(`[data-paiement-aide-montant="${key}"]`);
      aides += montantInput ? (parseFloat(montantInput.value) || 0) : 0;
    }
  });
  const reste = Math.max(0, montantLicence + adhesion - aides);
  document.getElementById("paiement-reste").textContent = reste.toFixed(2) + " €";
  return reste;
}

// Écouteurs de recalcul (attachés une seule fois, les champs sont statiques dans le HTML)
document.querySelectorAll('#form-paiement [data-paiement-tarif], #form-paiement [data-paiement-aide]').forEach((el) => {
  el.addEventListener("change", recalcPaiement);
});
document.querySelectorAll('#form-paiement [data-paiement-aide-montant]').forEach((el) => {
  el.addEventListener("input", recalcPaiement);
});

function openPaiementModal(id) {
  const a = adherentsCache.find((x) => x.id === id);
  if (!a) return;
  const form = document.getElementById("form-paiement");
  form.reset();

  document.getElementById("paiement-adherent-id").value = id;
  document.getElementById("paiement-adherent-name").textContent = `${a.adherent_prenom || ""} ${a.adherent_nom || ""}`.trim();

  if (a.paiement_type_licence) {
    const r = form.querySelector(`input[name="paiement_type_licence"][value="${a.paiement_type_licence}"]`);
    if (r) r.checked = true;
  }
  document.getElementById("paiement-montant-licence").value = a.paiement_montant_licence || "";
  if (a.paiement_position_famille) {
    const r2 = form.querySelector(`input[name="paiement_position_famille"][value="${a.paiement_position_famille}"]`);
    if (r2) r2.checked = true;
  }
  AIDE_KEYS.forEach((key) => {
    const cb = document.getElementById(key);
    const montantInput = document.querySelector(`[data-paiement-aide-montant="${key}"]`);
    if (a.paiement_aides && a.paiement_aides[key] !== undefined) {
      cb.checked = true;
      if (montantInput) montantInput.value = a.paiement_aides[key];
    }
  });
  document.getElementById("aide-autre-libelle").value = a.paiement_aide_autre_libelle || "";
  document.getElementById("paiement-mode").value = a.paiement_mode || "";
  document.getElementById("paiement-statut").value = a.statut_paiement || "En attente";
  document.getElementById("paiement-date").value = a.paiement_date || "";
  document.getElementById("paiement-note").value = a.paiement_note || "";

  recalcPaiement();
  openModal("modal-paiement");
}

document.getElementById("form-paiement").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("paiement-adherent-id").value;
  const typeLicenceRadio = document.querySelector('input[name="paiement_type_licence"]:checked');
  const positionRadio = document.querySelector('input[name="paiement_position_famille"]:checked');

  const aides = {};
  AIDE_KEYS.forEach((key) => {
    const cb = document.getElementById(key);
    if (cb && cb.checked) {
      const montantInput = document.querySelector(`[data-paiement-aide-montant="${key}"]`);
      aides[key] = montantInput ? (parseFloat(montantInput.value) || 0) : 0;
    }
  });

  const reste = recalcPaiement();
  const data = {
    paiement_type_licence: typeLicenceRadio ? typeLicenceRadio.value : "",
    paiement_montant_licence: parseFloat(document.getElementById("paiement-montant-licence").value) || 0,
    paiement_position_famille: positionRadio ? positionRadio.value : "",
    paiement_aides: aides,
    paiement_aide_autre_libelle: document.getElementById("aide-autre-libelle").value,
    paiement_reste: reste,
    paiement_mode: document.getElementById("paiement-mode").value,
    statut_paiement: document.getElementById("paiement-statut").value,
    paiement_date: document.getElementById("paiement-date").value,
    paiement_note: document.getElementById("paiement-note").value
  };

  FirebaseAPI.updateAdherent(id, data).then(() => {
    showToastAdmin("Paiement enregistré.");
    closeModal("modal-paiement");
  }).catch((err) => { console.error(err); showToastAdmin("Erreur lors de l'enregistrement du paiement."); });
});

/* ---------- Export Excel professionnel (multi-feuilles) ---------- */
async function exportAdherentsExcel() {
  if (!adherentsCache.length) { showToastAdmin("Aucun adhérent à exporter."); return; }
  if (typeof ExcelJS === "undefined") { showToastAdmin("Erreur : la librairie Excel n'a pas pu se charger."); return; }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OVTT Lillebonne";
  workbook.created = new Date();

  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00ACDA" } };
  const headerFont = { color: { argb: "FFFFFFFF" }, bold: true };
  function styleHeader(row, lastCol) {
    row.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle" };
    });
    row.height = 22;
  }

  // ---------- Feuille "Adhérents" ----------
  const sheet1 = workbook.addWorksheet("Adhérents");
  sheet1.columns = [
    { header: "Nom", key: "nom", width: 18 },
    { header: "Prénom", key: "prenom", width: 18 },
    { header: "Date de naissance", key: "naissance", width: 16 },
    { header: "Âge", key: "age", width: 8 },
    { header: "Catégorie", key: "categorie", width: 12 },
    { header: "Statut civil", key: "statutCivil", width: 12 },
    { header: "Téléphone", key: "telephone", width: 15 },
    { header: "Email", key: "email", width: 26 },
    { header: "Adresse", key: "adresse", width: 30 },
    { header: "Responsable légal", key: "responsable", width: 22 },
    { header: "Téléphone urgence", key: "telUrgence", width: 16 },
    { header: "Type de licence", key: "licence", width: 13 },
    { header: "Montant total (€)", key: "montantTotal", width: 15 },
    { header: "Reste à payer (€)", key: "reste", width: 15 },
    { header: "Moyen de paiement", key: "modePaiement", width: 16 },
    { header: "Statut paiement", key: "statutPaiement", width: 16 },
    { header: "Statut dossier", key: "statutDossier", width: 18 },
    { header: "Date d'inscription", key: "inscription", width: 16 }
  ];
  styleHeader(sheet1.getRow(1));
  sheet1.autoFilter = { from: "A1", to: "R1" };
  sheet1.views = [{ state: "frozen", ySplit: 1 }];

  adherentsCache.forEach((a) => {
    const age = computeAge(a.adherent_date_naissance);
    const adhesion = a.paiement_position_famille ? parseFloat(a.paiement_position_famille) : 0;
    const montantLicence = parseFloat(a.paiement_montant_licence) || 0;
    const progress = ficheProgress(a);
    sheet1.addRow({
      nom: a.adherent_nom || "",
      prenom: a.adherent_prenom || "",
      naissance: a.adherent_date_naissance ? fmtDate(a.adherent_date_naissance) : "",
      age: age !== null ? age : "",
      categorie: computeCategorieFFC(age),
      statutCivil: a.statut_civil || "",
      telephone: a.adherent_telephone || "",
      email: a.adherent_email || "",
      adresse: a.adherent_adresse || "",
      responsable: a.statut_civil === "Mineur" ? [a.parent1_prenom, a.parent1_nom].filter(Boolean).join(" ") : "",
      telUrgence: a.urgence1_telephone || a.parent1_telephone || "",
      licence: a.paiement_type_licence || "",
      montantTotal: montantLicence + adhesion,
      reste: a.paiement_reste !== undefined ? parseFloat(a.paiement_reste) : "",
      modePaiement: a.paiement_mode || "",
      statutPaiement: a.statut_paiement || "En attente",
      statutDossier: progress === 100 ? "Complet" : `Incomplet (${progress}%)`,
      inscription: a.dateInscription ? fmtDate(a.dateInscription) : ""
    });
  });

  // ---------- Feuille "Paiements" ----------
  const sheet2 = workbook.addWorksheet("Paiements");
  sheet2.columns = [
    { header: "Nom", key: "nom", width: 18 },
    { header: "Prénom", key: "prenom", width: 18 },
    { header: "Type de licence", key: "licence", width: 13 },
    { header: "Montant licence (€)", key: "montantLicence", width: 16 },
    { header: "Adhésion (€)", key: "adhesion", width: 12 },
    { header: "Aides (€)", key: "aides", width: 10 },
    { header: "Reste à payer (€)", key: "reste", width: 15 },
    { header: "Moyen de paiement", key: "mode", width: 16 },
    { header: "Statut", key: "statut", width: 16 },
    { header: "Date paiement", key: "date", width: 14 },
    { header: "Note interne", key: "note", width: 30 }
  ];
  styleHeader(sheet2.getRow(1));
  sheet2.autoFilter = { from: "A1", to: "K1" };
  sheet2.views = [{ state: "frozen", ySplit: 1 }];
  adherentsCache.forEach((a) => {
    const adhesion = a.paiement_position_famille ? parseFloat(a.paiement_position_famille) : 0;
    const aidesTotal = a.paiement_aides ? Object.values(a.paiement_aides).reduce((s, v) => s + (parseFloat(v) || 0), 0) : 0;
    sheet2.addRow({
      nom: a.adherent_nom || "", prenom: a.adherent_prenom || "",
      licence: a.paiement_type_licence || "",
      montantLicence: parseFloat(a.paiement_montant_licence) || 0,
      adhesion, aides: aidesTotal,
      reste: a.paiement_reste !== undefined ? parseFloat(a.paiement_reste) : "",
      mode: a.paiement_mode || "", statut: a.statut_paiement || "En attente",
      date: a.paiement_date ? fmtDate(a.paiement_date) : "",
      note: a.paiement_note || ""
    });
  });

  // ---------- Feuille "Mineurs" ----------
  const sheet3 = workbook.addWorksheet("Mineurs");
  sheet3.columns = [
    { header: "Nom", key: "nom", width: 18 }, { header: "Prénom", key: "prenom", width: 18 },
    { header: "Âge", key: "age", width: 8 }, { header: "Catégorie", key: "categorie", width: 12 },
    { header: "Parent 1", key: "parent1", width: 22 }, { header: "Tél. Parent 1", key: "telParent1", width: 15 },
    { header: "Parent 2", key: "parent2", width: 22 }, { header: "Tél. Parent 2", key: "telParent2", width: 15 },
    { header: "Autorisé à rentrer seul", key: "rentrerSeul", width: 18 }
  ];
  styleHeader(sheet3.getRow(1));
  sheet3.autoFilter = { from: "A1", to: "I1" };
  sheet3.views = [{ state: "frozen", ySplit: 1 }];
  adherentsCache.filter((a) => a.statut_civil === "Mineur").forEach((a) => {
    const age = computeAge(a.adherent_date_naissance);
    sheet3.addRow({
      nom: a.adherent_nom || "", prenom: a.adherent_prenom || "",
      age: age !== null ? age : "", categorie: computeCategorieFFC(age),
      parent1: [a.parent1_prenom, a.parent1_nom].filter(Boolean).join(" "), telParent1: a.parent1_telephone || "",
      parent2: [a.parent2_prenom, a.parent2_nom].filter(Boolean).join(" "), telParent2: a.parent2_telephone || "",
      rentrerSeul: a.autorisation_rentrer_seul || ""
    });
  });

  // ---------- Feuille "Statistiques" ----------
  const sheet4 = workbook.addWorksheet("Statistiques");
  sheet4.columns = [{ header: "Indicateur", key: "label", width: 36 }, { header: "Valeur", key: "value", width: 16 }];
  styleHeader(sheet4.getRow(1));
  const total = adherentsCache.length;
  const mineurs = adherentsCache.filter((a) => a.statut_civil === "Mineur").length;
  const regles = adherentsCache.filter((a) => a.statut_paiement === "Réglé").length;
  const partiels = adherentsCache.filter((a) => a.statut_paiement === "Partiellement réglé").length;
  const attente = total - regles - partiels;
  const totalReste = adherentsCache.reduce((s, a) => s + (parseFloat(a.paiement_reste) || 0), 0);
  [
    ["Nombre total d'adhérents", total],
    ["Dont mineurs", mineurs],
    ["Dont majeurs", total - mineurs],
    ["Paiements réglés", regles],
    ["Paiements partiels", partiels],
    ["Paiements en attente", attente],
    ["Total restant à percevoir (€)", Number(totalReste.toFixed(2))]
  ].forEach(([label, value]) => sheet4.addRow({ label, value }));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "adherents_ovtt_lillebonne.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

document.getElementById("export-adherents-btn").addEventListener("click", () => {
  exportAdherentsExcel().catch((err) => { console.error(err); showToastAdmin("Erreur lors de la génération du fichier Excel."); });
});

/* ============================================================
   VISIBILITÉ DU SITE
   ============================================================ */
function loadVisibility() {
  db.ref("settings/site").once("value").then((snap) => {
    const data = snap.val() || { visible: true };
    const toggle = document.getElementById("visibility-toggle");
    toggle.checked = data.visible !== false;
    updateVisibilityText(data.visible !== false);
  }).catch((err) => console.error("Erreur lecture settings/site :", err));
}
function updateVisibilityText(visible) {
  document.getElementById("visibility-status-text").textContent = visible
    ? "Le site public est actuellement visible par tous les visiteurs."
    : "Le site public est actuellement masqué (page de maintenance affichée).";
}
document.getElementById("visibility-toggle").addEventListener("change", (e) => {
  const visible = e.target.checked;
  db.ref("settings/site").update({ visible }).then(() => {
    updateVisibilityText(visible);
    showToastAdmin(visible ? "Site remis en ligne." : "Site masqué (mode maintenance).");
  });
});
