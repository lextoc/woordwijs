import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDeck } from "../state/DeckContext";
import { ArrowUpRightIcon, InfoIcon } from "./Icons";

export function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")].filter(
    (element) => element.tabIndex !== -1 && !element.hasAttribute("aria-hidden"),
  );
}

export function trapTab(event: KeyboardEvent, root: HTMLElement) {
  if (event.key !== "Tab") return;
  const items = focusable(root);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = root.querySelector<HTMLElement>("h2");
    heading?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (root) trapTab(event, root);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <h2 id="dialog-title" tabIndex={-1}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: string; icon: ReactNode }[] }) {
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

export function WriteError() {
  const { storageOk, writeError } = useDeck();
  if (!writeError || !storageOk) return null;
  return (
    <p className="error" role="alert">
      Niet bewaard. Je voortgang blijft beschikbaar tot je de pagina sluit.
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
      <ArrowUpRightIcon />
      <span className="sr-only"> (opent in een nieuw tabblad)</span>
    </a>
  );
}

export function StorageNote({ children }: { children: ReactNode }) {
  return (
    <p className="storage-note">
      <InfoIcon size={18} />
      <span>{children}</span>
    </p>
  );
}

export function Decor() {
  return (
    <div className="decor-books" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Woordwijs`;
  }, [title]);
}

export function Toaster() {
  const { toast, dismissToast } = useDeck();
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, 4200);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast]);
  return (
    <div className="notification-region" role="status" aria-atomic="true">
      {toast ? (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          <button type="button" className="icon-button toast-close" onClick={dismissToast} aria-label="Melding sluiten">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
