import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, type Location } from "react-router-dom";
import { useDeck } from "../state/DeckContext";
import { ArrowUpRightIcon, CloseIcon, InfoIcon } from "./Icons";

export type AppState = {
  backgroundLocation?: Location;
  dialog?: "remove" | "reset" | "stop";
  drawer?: boolean;
  mode?: "due" | "extra";
  startedAt?: number;
};

export function readState(state: unknown): AppState | null {
  if (!state || typeof state !== "object") return null;
  return state as AppState;
}

export function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1 && !element.hasAttribute("aria-hidden") && !element.closest("[inert]"),
  );
}

export function trapTab(event: KeyboardEvent, root: HTMLElement) {
  if (event.key !== "Tab") return;
  const items = focusable(root);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && root.contains(active) && items.includes(active);
  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function overlayNode(): HTMLElement | null {
  return document.getElementById("overlay-root");
}

let modalDepth = 0;
let dialogDepth = 0;

function applyOverlayLock() {
  const root = document.getElementById("root");
  if (modalDepth > 0) {
    document.documentElement.dataset.overlay = "open";
    root?.setAttribute("inert", "");
    root?.setAttribute("aria-hidden", "true");
  } else {
    delete document.documentElement.dataset.overlay;
    root?.removeAttribute("inert");
    root?.removeAttribute("aria-hidden");
  }
  document.querySelectorAll<HTMLElement>("[data-overlay-layer]").forEach((layer) => {
    if (dialogDepth > 0 && layer.dataset.overlayLayer !== "dialog") layer.setAttribute("inert", "");
    else layer.removeAttribute("inert");
  });
}

export function pushOverlay(kind: "dialog" | "sheet" | "drawer") {
  modalDepth += 1;
  if (kind === "dialog") dialogDepth += 1;
  applyOverlayLock();
}

export function popOverlay(kind: "dialog" | "sheet" | "drawer") {
  modalDepth = Math.max(0, modalDepth - 1);
  if (kind === "dialog") dialogDepth = Math.max(0, dialogDepth - 1);
  applyOverlayLock();
}

const escStack: Array<(event: KeyboardEvent) => void> = [];
let escListening = false;

function ensureEscListener() {
  if (escListening) return;
  escListening = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const top = escStack[escStack.length - 1];
    if (!top) return;
    event.preventDefault();
    event.stopPropagation();
    top(event);
  });
}

export function useEsc(enabled: boolean, handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    ensureEscListener();
    const wrapped = () => ref.current();
    escStack.push(wrapped);
    return () => {
      const index = escStack.indexOf(wrapped);
      if (index >= 0) escStack.splice(index, 1);
    };
  }, [enabled]);
}

export function useViewportVars() {
  useEffect(() => {
    const apply = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--vvh", `${Math.round(height)}px`);
    };
    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);
}

const bars = new Set<HTMLElement>();
let barFrame = 0;

function publishBars() {
  cancelAnimationFrame(barFrame);
  barFrame = requestAnimationFrame(() => {
    let height = 0;
    bars.forEach((bar) => {
      if (bar.isConnected) height = Math.max(height, bar.getBoundingClientRect().height);
    });
    document.documentElement.style.setProperty("--bar-h", `${Math.round(height)}px`);
    document.documentElement.classList.toggle("has-bar", height > 0);
  });
}

export function useBarHeight(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !active) return;
    bars.add(element);
    const observer = new ResizeObserver(publishBars);
    observer.observe(element);
    publishBars();
    return () => {
      bars.delete(element);
      observer.disconnect();
      publishBars();
    };
  }, [active, ref]);
}

function restoreFocus(opener: HTMLElement | null) {
  if (opener && document.contains(opener)) {
    opener.focus();
    return;
  }
  const marked = document.querySelector<HTMLElement>("[data-word-opener]");
  if (marked && document.contains(marked)) {
    marked.focus();
    return;
  }
  document.querySelector<HTMLElement>("main h1, h1")?.focus();
}

export function Dialog({
  title,
  children,
  onClose,
  role = "alertdialog",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descId = useId();
  useEsc(true, () => onCloseRef.current());

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pushOverlay("dialog");
    const root = ref.current;
    const paragraph = root?.querySelector("p");
    if (paragraph) paragraph.id = descId;
    root?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Tab" && root) trapTab(event, root);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      popOverlay("dialog");
      restoreFocus(opener);
    };
  }, [descId]);

  const node = overlayNode();
  if (!node) return null;
  return createPortal(
    <div className="modal-backdrop">
      <div
        className="modal"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-overlay-layer="dialog"
        ref={ref}
      >
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    node,
  );
}

export function Sheet({
  labelledBy,
  onClose,
  header,
  children,
  footer,
}: {
  labelledBy: string;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [entered, setEntered] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  useBarHeight(footerRef, Boolean(footer));
  useEsc(true, () => onCloseRef.current());

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    pushOverlay("sheet");
    const root = ref.current;
    const openerId = document.querySelector("[data-word-opener]")?.getAttribute("data-word-id") ?? null;
    root?.querySelector<HTMLElement>("h2[tabindex='-1'], h1[tabindex='-1']")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Tab" && root) trapTab(event, root);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      popOverlay("sheet");
      window.setTimeout(() => {
        const live = openerId ? document.querySelector<HTMLElement>(`[data-word-id="${CSS.escape(openerId)}"]`) : null;
        if (live) live.focus();
        else document.querySelector<HTMLElement>("main h1, h1")?.focus();
      }, 0);
    };
  }, []);

  function dragStart(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a")) return;
    const sheet = ref.current;
    if (!sheet) return;
    const startY = event.clientY;
    const startT = performance.now();
    const height = sheet.getBoundingClientRect().height;
    sheet.style.transition = "none";
    function move(ev: PointerEvent) {
      const dy = Math.max(0, ev.clientY - startY);
      sheet!.style.transform = `translateY(${dy}px)`;
    }
    function up(ev: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const dy = ev.clientY - startY;
      const dt = Math.max(1, performance.now() - startT);
      const velocity = dy / dt;
      if (dy > height * 0.3 || (dy > 24 && velocity > 0.5)) {
        onCloseRef.current();
        return;
      }
      sheet!.style.transition = "transform 160ms ease-out";
      sheet!.style.transform = "";
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const node = overlayNode();
  if (!node) return null;
  return createPortal(
    <>
      <div className="overlay-catch" onClick={() => onCloseRef.current()} />
      <div className="sheet-wrap">
        <div
          className={entered ? "sheet is-in" : "sheet"}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          data-overlay-layer="sheet"
          ref={ref}
        >
          <div className="sheet-handle" aria-hidden="true" onPointerDown={dragStart}>
            <i />
          </div>
          <div className="sheet-head" onPointerDown={dragStart}>
            {header}
          </div>
          <div className="sheet-body">{children}</div>
          {footer ? (
            <div className="sheet-foot action-bar" ref={footerRef}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </>,
    node,
  );
}

export function SidePanel({
  onClose,
  header,
  children,
  footer,
}: {
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEsc(true, () => {
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
    onCloseRef.current();
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--panel-offset", "420px");
    document.querySelector(".app")?.classList.add("has-panel");
    const openerId = document.querySelector("[data-word-opener]")?.getAttribute("data-word-id") ?? null;
    return () => {
      document.documentElement.style.setProperty("--panel-offset", "0px");
      document.querySelector(".app")?.classList.remove("has-panel");
      window.setTimeout(() => {
        const live = openerId ? document.querySelector<HTMLElement>(`[data-word-id="${CSS.escape(openerId)}"]`) : null;
        live?.focus();
      }, 0);
    };
  }, []);

  const node = overlayNode();
  if (!node) return null;
  return createPortal(
    <aside className="side-panel" role="complementary" aria-label="Woordblad" data-side-panel="">
      <div className="side-panel-head">{header}</div>
      <div className="side-panel-body">{children}</div>
      {footer ? <div className="side-panel-foot">{footer}</div> : null}
    </aside>,
    node,
  );
}

export function markWordOpener(element: HTMLElement) {
  document.querySelectorAll("[data-word-opener]").forEach((node) => node.removeAttribute("data-word-opener"));
  element.setAttribute("data-word-opener", "true");
}

export function useWordLinkState() {
  const location = useLocation();
  const state = readState(location.state);
  if (state?.backgroundLocation) return { backgroundLocation: state.backgroundLocation };
  return { backgroundLocation: location };
}

export function WordLink({
  id,
  className,
  children,
  current,
}: {
  id: string;
  className?: string;
  children: ReactNode;
  current?: boolean;
}) {
  const state = useWordLinkState();
  return (
    <Link
      to={`/woord/${encodeURIComponent(id)}`}
      state={state}
      data-word-id={id}
      data-word-opener={current ? "true" : undefined}
      className={className}
      aria-current={current ? "true" : undefined}
      onClick={(event) => markWordOpener(event.currentTarget)}
    >
      {children}
    </Link>
  );
}

export function useBrowserPath() {
  useLocation();
  return window.location.pathname;
}

export function useRowArrows(ids: string[]) {
  const path = useBrowserPath();
  const navigate = useNavigate();
  const idsRef = useRef(ids);
  idsRef.current = ids;
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const desktop = window.matchMedia("(min-width: 801px)");
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!fine.matches || !desktop.matches) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith("/woord/")) return;
      const list = idsRef.current;
      if (list.length === 0) return;
      const current = decodeURIComponent(currentPath.slice("/woord/".length));
      const index = list.indexOf(current);
      const nextIndex = event.key === "ArrowDown" ? Math.min(list.length - 1, index < 0 ? 0 : index + 1) : Math.max(0, index < 0 ? 0 : index - 1);
      const next = list[nextIndex];
      if (!next || next === current) return;
      event.preventDefault();
      const row = document.querySelector<HTMLElement>(`[data-word-id="${CSS.escape(next)}"]`);
      if (row) markWordOpener(row);
      row?.scrollIntoView({ block: "nearest" });
      const state = readState(window.history.state?.usr);
      navigate(`/woord/${encodeURIComponent(next)}`, {
        replace: true,
        state: { backgroundLocation: state?.backgroundLocation },
      });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [path, navigate]);
}

export function useSearchKeys(inputRef: RefObject<HTMLInputElement | null>, clear: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "/" && !typing && window.matchMedia("(pointer: fine)").matches) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && event.target === inputRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clear();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [clear, inputRef]);
}

export function useWidePanel() {
  const [panel, setPanel] = useState(() => window.matchMedia("(min-width: 1100px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1100px)");
    const onChange = () => setPanel(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return panel;
}

export function Stats({ items }: { items: { label: string; value: string; icon?: ReactNode }[] }) {
  return (
    <div className="stats-row">
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <div className="stat-icon">{item.icon}</div>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StorageBanner() {
  const { storageOk } = useDeck();
  if (storageOk) return null;
  return (
    <p className="preview-notice">
      <span>
        <strong>Opslaan lukt niet.</strong> Je kunt oefenen, maar je voortgang verdwijnt zodra je de pagina sluit.
      </span>
    </p>
  );
}

export function Attribution() {
  return (
    <footer className="site-footer">
      <p>
        Woorden:{" "}
        <a href="https://nl.wiktionary.org/" target="_blank" rel="noopener noreferrer">
          WikiWoordenboek
          <span className="sr-only"> (opent in een nieuw tabblad)</span>
        </a>
        ,{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" target="_blank" rel="noopener noreferrer">
          CC BY-SA 4.0
          <span className="sr-only"> (opent in een nieuw tabblad)</span>
        </a>
      </p>
      <Link to="/bronnen">Bronnen</Link>
    </footer>
  );
}

export function SourceLink({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <a className="source-link" href={href} target="_blank" rel="noopener noreferrer">
      <span>
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
      <ArrowUpRightIcon size={20} />
      <span className="sr-only"> (opent in een nieuw tabblad)</span>
    </a>
  );
}

export function StorageNote({ children }: { children: ReactNode }) {
  return (
    <p className="storage-note">
      <InfoIcon size={20} />
      <span>{children}</span>
    </p>
  );
}

export function WordDecor() {
  const letters = [
    { letter: "W", x: 12, y: 29, angle: -5 },
    { letter: "O", x: 70, y: 15, angle: 3 },
    { letter: "O", x: 128, y: 32, angle: -3 },
    { letter: "R", x: 186, y: 19, angle: 4 },
    { letter: "D", x: 244, y: 30, angle: -4 },
  ];
  return (
    <svg className="decor-words" viewBox="0 0 310 106" fill="none" aria-hidden="true" focusable="false">
      {letters.map(({ letter, x, y, angle }) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${angle} 24 26)`}>
          <rect width="48" height="52" rx="4" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
          <text x="24" y="36" textAnchor="middle" fill="currentColor" fontFamily="Georgia, serif" fontSize="32">{letter}</text>
        </g>
      ))}
      <circle cx="300" cy="86" r="4" fill="var(--accent)" />
    </svg>
  );
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Woordwijs`;
  }, [title]);
}

const WRITE_MESSAGE = "Niet bewaard. Je voortgang blijft beschikbaar tot je de pagina sluit.";

export function Toaster() {
  const { toast, dismissToast, writeError } = useDeck();
  const [overlay, setOverlay] = useState(false);
  const [writeOn, setWriteOn] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setOverlay(document.documentElement.dataset.overlay === "open");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-overlay"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (writeError) setWriteOn(true);
    else setWriteOn(false);
  }, [writeError]);

  const message = !overlay ? (toast?.message ?? (writeOn ? WRITE_MESSAGE : null)) : null;
  const token = toast ? `toast-${toast.id}` : writeOn ? "write" : "";

  useEffect(() => {
    if (!message) return;
    let remain = 4200;
    let started = Date.now();
    let timer = window.setTimeout(finish, remain);
    function finish() {
      if (toast) dismissToast();
      setWriteOn(false);
    }
    const node = toastRef.current;
    function pause() {
      window.clearTimeout(timer);
      remain -= Date.now() - started;
    }
    function resume() {
      started = Date.now();
      timer = window.setTimeout(finish, Math.max(0, remain));
    }
    node?.addEventListener("mouseenter", pause);
    node?.addEventListener("mouseleave", resume);
    node?.addEventListener("focusin", pause);
    node?.addEventListener("focusout", resume);
    return () => {
      window.clearTimeout(timer);
      node?.removeEventListener("mouseenter", pause);
      node?.removeEventListener("mouseleave", resume);
      node?.removeEventListener("focusin", pause);
      node?.removeEventListener("focusout", resume);
    };
  }, [dismissToast, message, toast, token]);

  const node = overlayNode();
  if (!node) return null;
  return createPortal(
    <div className="notification-region" role="status" aria-atomic="true">
      {message ? (
        <div className="toast" ref={toastRef} key={token}>
          <span>{message}</span>
          <button
            type="button"
            className="icon-button toast-close"
            aria-label="Melding sluiten"
            onClick={() => {
              if (toast) dismissToast();
              setWriteOn(false);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              if (toast) dismissToast();
              setWriteOn(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </div>,
    node,
  );
}
