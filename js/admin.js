/* ============================================================
   OVTT LILLEBONNE — admin.js
   Authentification + CRUD complet de l'espace administrateur
   ============================================================ */

const loginScreen = document.getElementById("login-screen");
const adminShell = document.getElementById("admin-shell");

/* Image par défaut (hébergée sur GitHub) si aucune URL n'est renseignée */
const GITHUB_ASSETS_BASE = "https://raw.githubusercontent.com/ovtt-lillebonne/site-assets/main/";

/* Libellés des statuts de règlement d'un dossier adhérent */
const STATUTS_PAIEMENT = ["En attente de règlement", "Réglé"];

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

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    loginScreen.style.display = "none";
    adminShell.classList.add("is-active");
    document.getElementById("admin-user-email").textContent = user.email;
    loadDashboard();
    loadAdherents();
    loadArticles();
    loadEvents();
    loadOrgs();
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

/* ---------- Fermeture des modales ---------- */
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".admin-modal-overlay").classList.remove("is-open"));
});
document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("is-open"); });
});

function openModal(id) { document.getElementById(id).classList.add("is-open"); }
function closeModal(id) { document.getElementById(id).classList.remove("is-open"); }

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("fr-FR");
}

/* ============================================================
   TABLEAU DE BORD
   ============================================================ */
function loadDashboard() {
  db.ref("adherents").once("value").then((snap) => {
    document.getElementById("stat-adherents").textContent = snap.numChildren();
    const rows = [];
    const list = [];
    snap.forEach((child) => list.push({ id: child.key, ...child.val() }));
    const enAttente = list.filter((a) => (a.statut_paiement || "En attente de règlement") !== "Réglé").length;
    document.getElementById("stat-en-attente").textContent = enAttente;
    list.sort((a, b) => (b.dateInscription || "").localeCompare(a.dateInscription || ""));
    list.slice(0, 6).forEach((a) => {
      rows.push(`<tr>
        <td>${escapeHtml(a.adherent_nom)}</td>
        <td>${escapeHtml(a.adherent_prenom)}</td>
        <td>${escapeHtml(a.adherent_email)}</td>
        <td>${fmtDate(a.dateInscription)}</td>
      </tr>`);
    });
    document.getElementById("dashboard-recent-adherents").innerHTML =
      rows.length ? rows.join("") : `<tr class="empty-row"><td colspan="4">Aucun adhérent inscrit pour le moment.</td></tr>`;
  });
  db.ref("articles").once("value").then((s) => document.getElementById("stat-articles").textContent = s.numChildren());
  db.ref("evenements").once("value").then((s) => document.getElementById("stat-evenements").textContent = s.numChildren());
  db.ref("organisations").once("value").then((s) => document.getElementById("stat-organisations").textContent = s.numChildren());
}

/* ============================================================
   ADHÉRENTS
   ============================================================ */
let adherentsCache = [];

function statutSelectHTML(a) {
  const statut = a.statut_paiement || "En attente de règlement";
  return `<select class="btn-admin btn-admin-ghost" style="cursor:pointer;" data-statut-adherent="${a.id}">
    ${STATUTS_PAIEMENT.map((s) => `<option value="${s}" ${s === statut ? "selected" : ""}>${s}</option>`).join("")}
  </select>`;
}

function loadAdherents() {
  FirebaseAPI.getAdherents((list) => {
    adherentsCache = list;
    const tbody = document.getElementById("adherents-table-body");
    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Aucun adhérent inscrit pour le moment.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((a) => `
      <tr>
        <td>${escapeHtml(a.adherent_nom)}</td>
        <td>${escapeHtml(a.adherent_prenom)}</td>
        <td>${escapeHtml(a.adherent_email)}</td>
        <td>${escapeHtml(a.adherent_telephone)}</td>
        <td>${fmtDate(a.dateInscription)}</td>
        <td>${statutSelectHTML(a)}</td>
        <td class="table-actions">
          <button class="btn-admin btn-admin-ghost" data-view-adherent="${a.id}">Voir</button>
          <button class="btn-admin btn-admin-red" data-delete-adherent="${a.id}">Supprimer</button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-view-adherent]").forEach((btn) => {
      btn.addEventListener("click", () => viewAdherent(btn.dataset.viewAdherent));
    });
    tbody.querySelectorAll("[data-delete-adherent]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Supprimer définitivement cette fiche adhérent ?")) {
          FirebaseAPI.deleteAdherent(btn.dataset.deleteAdherent).then(() => { loadAdherents(); loadDashboard(); });
        }
      });
    });
    tbody.querySelectorAll("[data-statut-adherent]").forEach((sel) => {
      sel.addEventListener("change", () => {
        FirebaseAPI.updateAdherent(sel.dataset.statutAdherent, { statut_paiement: sel.value }).then(() => {
          showToastAdmin("Statut de règlement mis à jour.");
          loadDashboard();
        });
      });
    });
  });
}

function viewAdherent(id) {
  const a = adherentsCache.find((x) => x.id === id);
  if (!a) return;

  const header = `
    <div class="visibility-card" style="margin-bottom:18px; padding:16px 20px;">
      <div>
        <strong>Reste à verser : ${escapeHtml(a.reste_a_verser || "0.00")} €</strong><br>
        <span style="color:#5c7079; font-size:0.85rem;">Statut civil : ${escapeHtml(a.statut_civil || "—")}</span>
      </div>
      ${statutSelectHTML(a)}
    </div>`;

  const rows = Object.entries(a)
    .filter(([k]) => !["id", "statut_paiement", "reste_a_verser"].includes(k))
    .map(([k, v]) => `<div style="display:flex; justify-content:space-between; gap:14px; padding:6px 0; border-bottom:1px solid #eef1f2;">
        <span style="color:#5c7079;">${escapeHtml(k)}</span><strong style="text-align:right;">${escapeHtml(Array.isArray(v) ? v.join(", ") : v)}</strong>
      </div>`).join("");

  document.getElementById("adherent-detail-content").innerHTML = header + rows;
  document.querySelectorAll("#adherent-detail-content [data-statut-adherent]").forEach((sel) => {
    sel.addEventListener("change", () => {
      FirebaseAPI.updateAdherent(sel.dataset.statutAdherent, { statut_paiement: sel.value }).then(() => {
        showToastAdmin("Statut de règlement mis à jour.");
        loadAdherents();
        loadDashboard();
      });
    });
  });
  openModal("modal-adherent");
}

document.getElementById("export-adherents-btn").addEventListener("click", () => {
  if (!adherentsCache.length) { showToastAdmin("Aucun adhérent à exporter."); return; }
  const keys = Array.from(new Set(adherentsCache.flatMap((a) => Object.keys(a))));
  const csvRows = [keys.join(";")];
  adherentsCache.forEach((a) => {
    csvRows.push(keys.map((k) => `"${(Array.isArray(a[k]) ? a[k].join(", ") : (a[k] ?? "")).toString().replace(/"/g, '""')}"`).join(";"));
  });
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adherents_ovtt_lillebonne.csv";
  a.click();
  URL.revokeObjectURL(url);
});

/* ============================================================
   BLOG
   ============================================================ */
function loadArticles() {
  FirebaseAPI.getArticles((list) => {
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
          FirebaseAPI.deleteArticle(btn.dataset.deleteArticle).then(() => { loadArticles(); loadDashboard(); });
        }
      });
    });
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
    image: document.getElementById("article-image").value || GITHUB_ASSETS_BASE + "blog_article.jpg",
    date: document.getElementById("article-date").value,
    auteur: document.getElementById("article-auteur").value || "OVTT Lillebonne",
    texte: document.getElementById("article-texte").value
  };
  FirebaseAPI.saveArticle(id, data).then(() => {
    closeModal("modal-article");
    loadArticles();
    loadDashboard();
    showToastAdmin("Article publié avec succès.");
  });
});

/* ============================================================
   CALENDRIER
   ============================================================ */
function loadEvents() {
  FirebaseAPI.getEvenements((list) => {
    const tbody = document.getElementById("events-table-body");
    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Aucun événement au calendrier.</td></tr>`;
      return;
    }
    list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    tbody.innerHTML = list.map((ev) => `
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
          FirebaseAPI.deleteEvenement(btn.dataset.deleteEvent).then(() => { loadEvents(); loadDashboard(); });
        }
      });
    });
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
    loadEvents();
    loadDashboard();
    showToastAdmin("Événement enregistré avec succès.");
  });
});

/* ============================================================
   ORGANISATIONS
   ============================================================ */
function loadOrgs() {
  FirebaseAPI.getOrganisations((list) => {
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
          FirebaseAPI.deleteOrganisation(btn.dataset.deleteOrg).then(() => { loadOrgs(); loadDashboard(); });
        }
      });
    });
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
    image: document.getElementById("org-image").value || GITHUB_ASSETS_BASE + "organisation.jpg",
    description: document.getElementById("org-description").value,
    infos: document.getElementById("org-infos").value
  };
  FirebaseAPI.saveOrganisation(id, data).then(() => {
    closeModal("modal-org");
    loadOrgs();
    loadDashboard();
    showToastAdmin("Organisation enregistrée avec succès.");
  });
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
  });
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

/* ---------- Petit toast interne à l'admin ---------- */
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
