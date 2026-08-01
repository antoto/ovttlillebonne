/* ============================================================
   OVTT LILLEBONNE — main.js
   Comportements du site public + lecture temps réel des données Firebase
   ============================================================ */

/* Image par défaut (locale, dossier assets/images/) si l'admin n'a
   renseigné aucune image personnalisée pour un article ou une
   organisation. Le champ image accepte aussi une URL externe. */
const ASSETS_BASE = "assets/images/";

/* ---------- Utilitaires ---------- */
function formatDateFr(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function shortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return { day: "--", month: "" };
  return {
    day: d.toLocaleDateString("fr-FR", { day: "2-digit" }),
    month: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")
  };
}
function slug(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function showToast(message, type = "success") {
  let toast = document.getElementById("global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "global-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = "toast " + type;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 4000);
}
function emptyState(msg) {
  return `<div class="empty-state">${msg}</div>`;
}
/* Message affiché si la lecture Firebase échoue (ex. règles de sécurité
   non configurées) — remplace un "Chargement…" qui resterait bloqué. */
function errorState(msg) {
  return `<div class="empty-state" style="border-color:var(--c-red); color:var(--c-red-dark);">⚠️ ${msg}</div>`;
}

/* ---------- Animation au scroll ---------- */
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
}

/* ---------- Vérification maintenance ---------- */
function initMaintenanceGuard() {
  if (document.body.dataset.skipMaintenanceCheck) return;
  checkSiteVisibility(() => {
    document.body.innerHTML = `
      <div class="maintenance-screen">
        <div>
          <h1>Le site est actuellement en maintenance.</h1>
          <p>L'OVTT Lillebonne revient très vite. Merci de votre patience !</p>
        </div>
      </div>`;
  });
}

/* ---------- ACCUEIL : dernières actus / événements / organisations ---------- */
function initHomeDynamicSections() {
  const newsMount = document.getElementById("home-news");
  if (newsMount) {
    FirebaseAPI.getArticles((articles) => {
      const items = articles.slice(0, 3);
      newsMount.innerHTML = items.length
        ? items.map((a) => articleCardHTML(a)).join("")
        : emptyState("Aucun article publié pour le moment.");
    }, () => { newsMount.innerHTML = errorState("Impossible de charger les actualités pour le moment."); });
  }

  const eventsMount = document.getElementById("home-events");
  if (eventsMount) {
    FirebaseAPI.getEvenements((events) => {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
      eventsMount.innerHTML = upcoming.length
        ? upcoming.map((e) => eventCardHTML(e)).join("")
        : emptyState("Aucun événement à venir pour le moment.");
    }, () => { eventsMount.innerHTML = errorState("Impossible de charger les événements pour le moment."); });
  }

  const orgMount = document.getElementById("home-orgs");
  if (orgMount) {
    FirebaseAPI.getOrganisations((orgs) => {
      const items = orgs.slice(0, 3);
      orgMount.innerHTML = items.length
        ? items.map((o) => orgCardHTML(o)).join("")
        : emptyState("Aucune organisation publiée pour le moment.");
    }, () => { orgMount.innerHTML = errorState("Impossible de charger les organisations pour le moment."); });
  }
}

function articleCardHTML(a) {
  return `
    <a href="article.html?id=${a.id}" class="card reveal is-visible">
      <div class="card-media"><img src="${a.image || ASSETS_BASE + 'blog/article1.jpg'}" alt="${a.titre || ''}" loading="lazy"></div>
      <div class="card-body">
        <span class="card-tag">Actualité</span>
        <h3>${a.titre || "Sans titre"}</h3>
        <div class="card-meta"><span>${formatDateFr(a.date)}</span><span>·</span><span>${a.auteur || "OVTT Lillebonne"}</span></div>
        <span class="card-link">Lire l'article →</span>
      </div>
    </a>`;
}

function eventCardHTML(e) {
  const d = shortDate(e.date);
  return `
    <div class="event-card reveal is-visible">
      <div class="event-date"><span class="day">${d.day}</span><span class="month">${d.month}</span></div>
      <div class="event-body">
        <span class="event-type type-${slug(e.type)}">${e.type || "Autre"}</span>
        <h3>${e.nom || "Événement"}</h3>
        <span class="loc">📍 ${e.lieu || "Lieu à confirmer"}</span>
      </div>
    </div>`;
}

function orgCardHTML(o) {
  return `
    <div class="card c-green reveal is-visible">
      <div class="card-media"><img src="${o.image || ASSETS_BASE + 'organisations/randonnee.jpg'}" alt="${o.nom || ''}" loading="lazy"></div>
      <div class="card-body">
        <span class="card-tag">Organisation</span>
        <h3>${o.nom || "Organisation"}</h3>
        <div class="card-meta"><span>${formatDateFr(o.date)}</span></div>
        <p class="desc">${(o.description || "").slice(0, 110)}${(o.description || "").length > 110 ? "…" : ""}</p>
      </div>
    </div>`;
}

/* ---------- PAGE CALENDRIER ---------- */
function initCalendarPage() {
  const mount = document.getElementById("calendar-list");
  if (!mount) return;
  let allEvents = [];
  let currentFilter = "Tous";

  function render() {
    const filtered = currentFilter === "Tous" ? allEvents : allEvents.filter((e) => e.type === currentFilter);
    mount.innerHTML = filtered.length
      ? filtered.sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((e) => eventCardHTML(e)).join("")
      : emptyState("Aucun événement dans cette catégorie pour le moment.");
  }

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.type;
      render();
    });
  });

  FirebaseAPI.getEvenements((events) => {
    allEvents = events;
    render();
  }, () => { mount.innerHTML = errorState("Impossible de charger le calendrier pour le moment."); });
}

/* ---------- PAGE NOS ORGANISATIONS ---------- */
function initOrganisationsPage() {
  const mount = document.getElementById("orgs-list");
  if (!mount) return;
  FirebaseAPI.getOrganisations((orgs) => {
    mount.innerHTML = orgs.length
      ? orgs.map((o) => orgCardHTML(o)).join("")
      : emptyState("Aucune organisation publiée pour le moment. Revenez bientôt !");
  }, () => { mount.innerHTML = errorState("Impossible de charger les organisations pour le moment."); });
}

/* ---------- PAGE BLOG (liste) ---------- */
function initBlogListPage() {
  const mount = document.getElementById("blog-list");
  if (!mount) return;
  FirebaseAPI.getArticles((articles) => {
    mount.innerHTML = articles.length
      ? articles.map((a) => articleCardHTML(a)).join("")
      : emptyState("Aucun article pour le moment. Revenez bientôt !");
  }, () => { mount.innerHTML = errorState("Impossible de charger les articles pour le moment."); });
}

/* ---------- PAGE ARTICLE (détail) ---------- */
function initArticleDetailPage() {
  const mount = document.getElementById("article-content");
  if (!mount) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    mount.innerHTML = emptyState("Article introuvable.");
    return;
  }
  FirebaseAPI.getArticle(id, (a) => {
    if (!a) {
      mount.innerHTML = emptyState("Cet article n'existe plus.");
      return;
    }
    document.title = a.titre + " — OVTT Lillebonne";
    mount.innerHTML = `
      <div class="page-banner" style="padding-top:140px;">
        <div class="container">
          <div class="breadcrumb"><a href="blog.html" style="color:inherit;">← Retour au blog</a></div>
          <h1>${a.titre}</h1>
          <div class="article-meta" style="margin-top:16px;">
            <span>${formatDateFr(a.date)}</span><span>·</span><span>${a.auteur || "OVTT Lillebonne"}</span>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="container article-body">
          <img class="article-hero-img" src="${a.image || ASSETS_BASE + 'blog/article1.jpg'}" alt="${a.titre}">
          ${(a.texte || "").split("\n").filter(Boolean).map((p) => `<p>${p}</p>`).join("")}
        </div>
      </div>`;
  }, () => { mount.innerHTML = errorState("Impossible de charger cet article pour le moment."); });
}

/* ---------- FORMULAIRE ADHÉRENT (multi-pages, sans paiement) ----------
   Le dossier envoyé par l'adhérent ne contient AUCUNE information
   financière : la gestion du paiement (type de licence, montants,
   aides, reste à payer, mode de règlement, statut) se fait
   exclusivement depuis admin.html une fois le dossier reçu. */
function initAdherentForm() {
  const form = document.getElementById("adherent-form");
  if (!form) return;

  const steps = Array.from(document.querySelectorAll(".form-panel"));
  const dots = Array.from(document.querySelectorAll(".form-step-dot"));
  let current = 0;

  function goTo(i) {
    steps[current].classList.remove("active");
    dots[current].classList.remove("active");
    dots[current].classList.add("done");
    current = i;
    steps[current].classList.add("active");
    dots.forEach((d, idx) => {
      d.classList.toggle("active", idx === current);
      if (idx > current) d.classList.remove("done");
    });
    window.scrollTo({ top: document.getElementById("adherent-form").offsetTop - 110, behavior: "smooth" });
  }

  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => { if (current < steps.length - 1) goTo(current + 1); });
  });
  document.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => { if (current > 0) goTo(current - 1); });
  });
  dots.forEach((dot, idx) => dot.addEventListener("click", () => goTo(idx)));

  /* ---- Bascule dynamique Majeur / Mineur ---- */
  const statutRadios = form.querySelectorAll('input[name="statut_civil"]');
  function applyStatutCivil() {
    const checked = form.querySelector('input[name="statut_civil"]:checked');
    const isMinor = !!checked && checked.value === "Mineur";
    document.querySelectorAll(".minor-only").forEach((block) => {
      block.classList.toggle("is-visible", isMinor);
      block.querySelectorAll("[data-required-if-minor]").forEach((field) => {
        field.required = isMinor;
      });
    });
  }
  statutRadios.forEach((r) => r.addEventListener("change", applyStatutCivil));
  applyStatutCivil();

  /* Envoi final du dossier vers Firebase (aucune donnée de paiement) */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (data[key] !== undefined) {
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else {
        data[key] = value;
      }
    });
    FirebaseAPI.saveAdherent(data)
      .then(() => {
        showToast("Bulletin d'adhésion envoyé avec succès !", "success");
        form.reset();
        applyStatutCivil();
        goTo(0);
      })
      .catch((err) => {
        console.error(err);
        showToast("Erreur lors de l'envoi. Merci de réessayer.", "error");
      });
  });
}

/* ---------- Init global ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initMaintenanceGuard();
  initReveal();
  initHomeDynamicSections();
  initCalendarPage();
  initOrganisationsPage();
  initBlogListPage();
  initArticleDetailPage();
  initAdherentForm();
});
