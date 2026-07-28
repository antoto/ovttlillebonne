/* ============================================================
   OVTT LILLEBONNE — main.js
   Comportements du site public + lecture des données Firebase
   ============================================================ */

/* Images par défaut (blog / organisations) hébergées sur GitHub.
   À adapter à votre propre dépôt d'images si besoin. */
const GITHUB_ASSETS_BASE = "https://raw.githubusercontent.com/ovtt-lillebonne/site-assets/main/";

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
      if (!items.length) {
        newsMount.innerHTML = emptyState("Aucun article publié pour le moment.");
        return;
      }
      newsMount.innerHTML = items.map((a) => articleCardHTML(a)).join("");
    });
  }

  const eventsMount = document.getElementById("home-events");
  if (eventsMount) {
    FirebaseAPI.getEvenements((events) => {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
      if (!upcoming.length) {
        eventsMount.innerHTML = emptyState("Aucun événement à venir pour le moment.");
        return;
      }
      eventsMount.innerHTML = upcoming.map((e) => eventCardHTML(e)).join("");
    });
  }

  const orgMount = document.getElementById("home-orgs");
  if (orgMount) {
    FirebaseAPI.getOrganisations((orgs) => {
      const items = orgs.slice(0, 3);
      if (!items.length) {
        orgMount.innerHTML = emptyState("Aucune organisation publiée pour le moment.");
        return;
      }
      orgMount.innerHTML = items.map((o) => orgCardHTML(o)).join("");
    });
  }
}

function emptyState(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

function articleCardHTML(a) {
  return `
    <a href="article.html?id=${a.id}" class="card reveal is-visible">
      <div class="card-media"><img src="${a.image || GITHUB_ASSETS_BASE + 'blog_article.jpg'}" alt="${a.titre || ''}" loading="lazy"></div>
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
      <div class="card-media"><img src="${o.image || GITHUB_ASSETS_BASE + 'organisation.jpg'}" alt="${o.nom || ''}" loading="lazy"></div>
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
    if (!filtered.length) {
      mount.innerHTML = emptyState("Aucun événement dans cette catégorie pour le moment.");
      return;
    }
    mount.innerHTML = filtered
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((e) => eventCardHTML(e)).join("");
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
  });
}

/* ---------- PAGE NOS ORGANISATIONS ---------- */
function initOrganisationsPage() {
  const mount = document.getElementById("orgs-list");
  if (!mount) return;
  FirebaseAPI.getOrganisations((orgs) => {
    if (!orgs.length) {
      mount.innerHTML = emptyState("Aucune organisation publiée pour le moment. Revenez bientôt !");
      return;
    }
    mount.innerHTML = orgs.map((o) => orgCardHTML(o)).join("");
  });
}

/* ---------- PAGE BLOG (liste) ---------- */
function initBlogListPage() {
  const mount = document.getElementById("blog-list");
  if (!mount) return;
  FirebaseAPI.getArticles((articles) => {
    if (!articles.length) {
      mount.innerHTML = emptyState("Aucun article pour le moment. Revenez bientôt !");
      return;
    }
    mount.innerHTML = articles.map((a) => articleCardHTML(a)).join("");
  });
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
          <img class="article-hero-img" src="${a.image || GITHUB_ASSETS_BASE + 'blog_article.jpg'}" alt="${a.titre}">
          ${(a.texte || "").split("\n").filter(Boolean).map((p) => `<p>${p}</p>`).join("")}
        </div>
      </div>`;
  });
}

/* ---------- FORMULAIRE ADHÉRENT (multi-pages) ---------- */
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

  /* ---- Calcul automatique des tarifs (page 5) ---- */
  const totalOut = document.getElementById("reste-a-payer");
  const totalFfcOut = document.getElementById("total-ffc");
  const totalFsgtOut = document.getElementById("total-fsgt");
  const fsgtExclude = document.getElementById("fsgt-exclude");
  const resteHidden = document.getElementById("reste_a_verser_hidden");
  const participationInputs = document.querySelectorAll("[data-participation]");
  const tarifInputs = document.querySelectorAll("[data-tarif]");
  const montantInputs = document.querySelectorAll("[data-montant-for]");

  function sumTarifGroup(group) {
    let total = 0;
    document.querySelectorAll(`[data-tarif][data-group="${group}"]`).forEach((inp) => {
      if (inp.type === "radio" || inp.type === "checkbox") {
        if (inp.checked) total += parseFloat(inp.value) || 0;
      } else {
        total += parseFloat(inp.value) || 0;
      }
    });
    return total;
  }

  function recalcTarifs() {
    if (!totalOut) return;
    const ffcTotal = sumTarifGroup("ffc");
    const fsgtTotal = (fsgtExclude && fsgtExclude.checked) ? 0 : sumTarifGroup("fsgt");

    let participations = 0;
    participationInputs.forEach((cb) => {
      if (cb.checked) {
        const montantInput = document.querySelector(`[data-montant-for="${cb.dataset.participationId}"]`);
        participations += montantInput ? (parseFloat(montantInput.value) || 0) : 0;
      }
    });

    const reste = Math.max(0, ffcTotal + fsgtTotal - participations);
    if (totalFfcOut) totalFfcOut.textContent = ffcTotal.toFixed(2) + " €";
    if (totalFsgtOut) totalFsgtOut.textContent = fsgtTotal.toFixed(2) + " €";
    totalOut.textContent = reste.toFixed(2) + " €";
    if (resteHidden) resteHidden.value = reste.toFixed(2);
  }

  tarifInputs.forEach((i) => i.addEventListener("input", recalcTarifs));
  tarifInputs.forEach((i) => i.addEventListener("change", recalcTarifs));
  participationInputs.forEach((i) => i.addEventListener("change", recalcTarifs));
  montantInputs.forEach((i) => i.addEventListener("input", recalcTarifs));
  if (fsgtExclude) fsgtExclude.addEventListener("change", recalcTarifs);
  recalcTarifs();

  /* Envoi final du bulletin vers Firebase */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    recalcTarifs();
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
        recalcTarifs();
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
