/* ============================================================
   OVTT LILLEBONNE — components.js
   Injecte le menu et le pied de page sur toutes les pages.
   -> Pour modifier le menu ou le footer de TOUT le site,
      il suffit de modifier ce fichier une seule fois.
   ============================================================ */

const NAV_LINKS = [
  { href: "index.html", label: "Accueil" },
  { href: "apropos.html", label: "À propos" },
  { href: "team.html", label: "Le Team" },
  { href: "calendrier.html", label: "Calendrier" },
  { href: "organisations.html", label: "Nos organisations" },
  { href: "blog.html", label: "Blog" },
  { href: "partenaire.html", label: "Devenir partenaire" },
  { href: "contact.html", label: "Contact" },
  { href: "adherent.html", label: "Espace adhérent", pill: "red" }
];

function currentPage() {
  const path = window.location.pathname.split("/").pop();
  return path === "" ? "index.html" : path;
}

function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;
  const page = currentPage();

  const links = NAV_LINKS.map((l) => {
    const isArticlePage = page === "article.html" && l.href === "blog.html";
    const active = page === l.href || isArticlePage ? " active" : "";
    const pillClass = l.pill ? " pill-" + l.pill : "";
    return `<a href="${l.href}" class="${active.trim()}${pillClass}">${l.label}</a>`;
  }).join("");

  mount.innerHTML = `
    <div class="container nav-inner">
      <a href="index.html" class="brand">
        <img src="assets/images/branding/logo.png" alt="Logo OVTT Lillebonne">
        <span>OVTT Lillebonne <span class="sub">Objectif VTT 1988</span></span>
      </a>
      <nav class="nav-links" id="nav-links">${links}</nav>
      <button class="burger" id="burger" aria-label="Ouvrir le menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;

  const burger = document.getElementById("burger");
  const navLinksEl = document.getElementById("nav-links");
  burger.addEventListener("click", () => {
    burger.classList.toggle("is-open");
    navLinksEl.classList.toggle("is-open");
  });
  navLinksEl.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      burger.classList.remove("is-open");
      navLinksEl.classList.remove("is-open");
    });
  });

  const header = document.querySelector(".site-header");
  const onScroll = () => {
    if (window.scrollY > 40) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  };
  window.addEventListener("scroll", onScroll);
  onScroll();
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;

  mount.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">
            <img src="assets/images/branding/logo.png" alt="Logo OVTT Lillebonne">
            <strong>OVTT Lillebonne</strong>
          </div>
          <p>Club de VTT labellisé École de Cyclisme et Compétition FFC, ouvert à tous du loisir à la compétition.</p>
          <div class="socials" style="margin-top:18px;">
            <a href="https://www.instagram.com/ovttlillebonne" target="_blank" rel="noopener" aria-label="Instagram">${iconInstagram()}</a>
            <a href="https://www.facebook.com/profile.php?id=100057587674176" target="_blank" rel="noopener" aria-label="Facebook">${iconFacebook()}</a>
          </div>
        </div>
        <div>
          <h4>Navigation</h4>
          <ul>
            <li><a href="index.html">Accueil</a></li>
            <li><a href="apropos.html">À propos</a></li>
            <li><a href="calendrier.html">Calendrier</a></li>
            <li><a href="organisations.html">Nos organisations</a></li>
            <li><a href="blog.html">Blog</a></li>
            <li><a href="partenaire.html">Devenir partenaire</a></li>
          </ul>
        </div>
        <div>
          <h4>Le club</h4>
          <ul>
            <li><a href="team.html">Le Team</a></li>
            <li><a href="adherent.html">Espace adhérent</a></li>
            <li><a href="contact.html">Contact</a></li>
            <li><a href="admin.html">Espace administrateur</a></li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            <li>330 rue du Becquet, 76170 Lillebonne</li>
            <li><a href="tel:0749100294">07 49 10 02 94</a></li>
            <li><a href="mailto:contactovtt76@gmail.com">contactovtt76@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} OVTT Lillebonne — Objectif VTT 1988. Tous droits réservés.</span>
        <span>Site conçu pour le club — administration via Firebase</span>
      </div>
    </div>
  `;
}

function iconInstagram() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>`;
}
function iconFacebook() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8.2h2.7l.4-3.2h-3.1V7.5c0-.9.3-1.5 1.6-1.5h1.6V3.1C16.4 3 15.4 3 14.3 3c-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.4Z"/></svg>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});
