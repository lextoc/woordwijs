import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookIcon, CloseIcon, FlameIcon, InfoIcon, MenuIcon, PlusIcon } from "./Icons";
import { focusable, pushOverlay, popOverlay, readState, trapTab, useEsc, type AppState } from "./ui";
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
  const navigate = useNavigate();
  const state = readState(location.state);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const count = Object.keys(store.cards).length;
  const drawerOpen = Boolean(state?.drawer) && mobile;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const wide = window.matchMedia("(min-width: 801px)");
    const onChange = () => {
      setMobile(query.matches);
      document.documentElement.style.setProperty("--sidebar-offset", wide.matches ? "235px" : "0px");
      if (!query.matches && readState(window.history.state?.usr)?.drawer) navigate(-1);
    };
    onChange();
    query.addEventListener("change", onChange);
    wide.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
      wide.removeEventListener("change", onChange);
      document.documentElement.style.setProperty("--sidebar-offset", "0px");
    };
  }, [navigate]);

  useEffect(() => {
    const appState = readState(location.state);
    if (appState?.backgroundLocation || appState?.dialog || appState?.drawer) return;
    const main = document.getElementById("main");
    const heading = main?.querySelector("h1");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [location.pathname]);

  function openDrawer() {
    if (state?.drawer) return;
    const next: AppState = { ...(state ?? {}), drawer: true };
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { state: next });
  }

  function closeDrawer() {
    if (readState(window.history.state?.usr)?.drawer) navigate(-1);
  }

  useEsc(drawerOpen, closeDrawer);

  useEffect(() => {
    if (!drawerOpen) return;
    const frame = requestAnimationFrame(() => setShown(true));
    pushOverlay("drawer");
    const root = drawerRef.current;
    const current = root?.querySelector<HTMLElement>(".nav-link.active");
    (current ?? focusable(root ?? document.body)[0])?.focus();
    let startX = 0;
    let startY = 0;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Tab" && root) trapTab(event, root);
    }
    function onStart(event: TouchEvent) {
      startX = event.touches[0]?.clientX ?? 0;
      startY = event.touches[0]?.clientY ?? 0;
    }
    function onEnd(event: TouchEvent) {
      const x = event.changedTouches[0]?.clientX ?? 0;
      const y = event.changedTouches[0]?.clientY ?? 0;
      if (startX - x > 48 && Math.abs(startY - y) < 40) closeDrawer();
    }
    document.addEventListener("keydown", onKey);
    root?.addEventListener("touchstart", onStart, { passive: true });
    root?.addEventListener("touchend", onEnd);
    return () => {
      cancelAnimationFrame(frame);
      setShown(false);
      document.removeEventListener("keydown", onKey);
      root?.removeEventListener("touchstart", onStart);
      root?.removeEventListener("touchend", onEnd);
      popOverlay("drawer");
      menuRef.current?.focus();
    };
  }, [drawerOpen]);

  const nav = (
    <>
      <div className="drawer-head">
        <Link className="lockup" to="/" aria-label="Woordwijs, naar vandaag">
          <BookIcon />
          <span>
            Woord
            <br />
            wijs<span className="brand-dot">.</span>
          </span>
        </Link>
        {mobile ? (
          <button type="button" className="icon-button" aria-label="Menu sluiten" onClick={closeDrawer}>
            <CloseIcon />
          </button>
        ) : null}
      </div>
      <div className="nav-list">
        {links.map((link) => {
          const path = state?.backgroundLocation?.pathname ?? location.pathname;
          const on = link.end ? path === link.to : path === link.to || path.startsWith(`${link.to}/`);
          return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={on ? "nav-link active" : "nav-link"}
            aria-current={on ? "page" : undefined}
            onClick={(event) => {
              if (!drawerOpen) return;
              if (link.to === location.pathname || link.to === path) {
                event.preventDefault();
                closeDrawer();
              }
            }}
          >
            {link.icon}
            <span>{link.label}</span>
            {link.to === "/woorden" ? (
              <span className="count-badge" aria-label={`${count} woorden`}>
                {count}
              </span>
            ) : null}
          </NavLink>
          );
        })}
      </div>
      <NavLink to="/zoeken" className="sidebar-add">
        <PlusIcon size={18} />
        Woord toevoegen
      </NavLink>
      <p className="drawer-note">Je voortgang staat alleen in deze browser.</p>
    </>
  );

  const portal = overlayRoot();
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Ga naar de inhoud
      </a>
      <header className="topbar">
        <button ref={menuRef} type="button" className="icon-button menu-button" aria-expanded={drawerOpen} aria-label="Menu openen" onClick={openDrawer}>
          <MenuIcon />
        </button>
        <Link className="wordmark" to="/" aria-label="Woordwijs, naar vandaag">
          Woordwijs<span className="brand-dot">.</span>
        </Link>
        <Link className="icon-button add-button" to="/zoeken" aria-label="Woord toevoegen">
          <PlusIcon />
        </Link>
      </header>
      {mobile && drawerOpen && portal
        ? createPortal(
            <>
              <div className="overlay-catch drawer-catch" onClick={closeDrawer} />
              <div
                className={shown ? "drawer is-shown" : "drawer"}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                data-overlay-layer="drawer"
                ref={drawerRef}
              >
                <nav aria-label="Hoofdmenu">{nav}</nav>
              </div>
            </>,
            portal,
          )
        : null}
      {mobile ? null : (
        <nav className="sidebar" aria-label="Hoofdmenu">
          {nav}
        </nav>
      )}
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

function overlayRoot(): HTMLElement | null {
  return document.getElementById("overlay-root");
}
