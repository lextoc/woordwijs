import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BookIcon, FlameIcon, InfoIcon, MenuIcon, PlusIcon } from "./Icons";
import { focusable, trapTab, WriteError } from "./ui";
import { useDeck } from "../state/DeckContext";

function BarsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  );
}

const links = [
  { to: "/", label: "Vandaag", end: true, icon: <BookIcon size={20} /> },
  { to: "/woorden", label: "Mijn woorden", end: false, icon: <BarsIcon /> },
  { to: "/voortgang", label: "Voortgang", end: false, icon: <FlameIcon size={20} /> },
  { to: "/bronnen", label: "Bronnen", end: false, icon: <InfoIcon size={20} /> },
];

export function Shell() {
  const { store } = useDeck();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const count = Object.keys(store.cards).length;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const onChange = () => setMobile(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const main = document.getElementById("main");
    const heading = main?.querySelector("h1");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    } else {
      main?.focus();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const root = drawerRef.current;
    const mobile = window.matchMedia("(max-width: 800px)").matches;
    if (!mobile || !root) return;
    const items = focusable(root);
    (root.querySelector(".nav-link") as HTMLElement | null)?.focus() ?? items[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        menuRef.current?.focus();
        return;
      }
      if (root) trapTab(event, root);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Ga naar de inhoud
      </a>
      <header className="topbar">
        <button
          ref={menuRef}
          type="button"
          className="icon-button"
          aria-expanded={open}
          aria-label={open ? "Menu sluiten" : "Menu openen"}
          onClick={() => setOpen((value) => !value)}
        >
          <MenuIcon />
        </button>
        <Link className="wordmark" to="/" aria-label="Woordwijs, naar vandaag">
          Woordwijs<span className="brand-dot">.</span>
        </Link>
        <Link className="icon-button add-button" to="/zoeken" aria-label="Woord toevoegen">
          <PlusIcon />
        </Link>
      </header>
      {open ? (
        <button type="button" className="nav-backdrop" aria-label="Menu sluiten" onClick={() => setOpen(false)} />
      ) : null}
      <nav className={open ? "sidebar is-open" : "sidebar"} aria-label="Hoofdmenu" ref={drawerRef} inert={mobile && !open ? true : undefined}>
        <Link className="lockup" to="/" aria-label="Woordwijs, naar vandaag">
          <BookIcon />
          <span>
            Woord
            <br />
            wijs<span className="brand-dot">.</span>
          </span>
        </Link>
        <p className="sidebar-label">Menu</p>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            {link.icon}
            <span>{link.label}</span>
            {link.to === "/woorden" ? (
              <span className="count-badge" aria-label={`${count} woorden`}>
                {count}
              </span>
            ) : null}
          </NavLink>
        ))}
        <NavLink to="/zoeken" className="sidebar-add">
          <PlusIcon size={18} />
          Woord toevoegen
        </NavLink>
        <p className="drawer-note">Je voortgang staat alleen in deze browser.</p>
      </nav>
      <main id="main" tabIndex={-1}>
        <WriteError />
        <Outlet />
      </main>
    </div>
  );
}
