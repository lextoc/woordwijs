import { Link, useLocation, useNavigate } from "react-router-dom";
import { Dialog, readState, usePageTitle } from "../components/ui";
import { useDeck } from "../state/DeckContext";

export function NotFound() {
  usePageTitle("Pagina");
  return (
    <div className="page">
      <div className="empty-state">
        <h1>Deze pagina bestaat niet.</h1>
        <Link className="primary" to="/">
          Naar vandaag
        </Link>
      </div>
    </div>
  );
}

export function CorruptPage() {
  usePageTitle("Voortgang");
  const deck = useDeck();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = readState(location.state)?.dialog === "reset";

  function openConfirm() {
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { state: { ...(readState(location.state) ?? {}), dialog: "reset" } },
    );
  }

  function closeConfirm() {
    if (readState(window.history.state?.usr)?.dialog) navigate(-1);
  }

  function erase() {
    const saved = deck.reset();
    if (!saved) return;
    deck.showToast("Je voortgang is gewist.");
    navigate("/", { replace: true });
  }

  return (
    <div className="page alone">
      <div className="empty-state">
        <h1>Je opgeslagen voortgang kon niet worden gelezen.</h1>
        <p>Er is niets gewist. Probeer de pagina opnieuw te laden.</p>
        <div className="button-stack">
          <button type="button" className="primary" onClick={deck.reloadPage}>
            Opnieuw laden
          </button>
          <button type="button" className="text-button" onClick={openConfirm}>
            Begin opnieuw
          </button>
        </div>
      </div>
      {confirm ? (
        <Dialog title="Alle voortgang wissen?" onClose={closeConfirm}>
          <p>Dit wist je woorden, je reeks en je voortgang in deze browser. Dit kan niet ongedaan worden gemaakt.</p>
          <div className="modal-actions">
            <button type="button" className="danger-button" onClick={erase}>
              Wis alles
            </button>
            <button type="button" className="secondary" data-initial-focus onClick={closeConfirm}>
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
