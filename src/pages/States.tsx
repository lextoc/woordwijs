import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, usePageTitle } from "../components/ui";
import { useDeck } from "../state/DeckContext";

export function NotFound() {
  usePageTitle("Pagina");
  return (
    <div className="page">
      <div className="empty-state">
        <h1>Deze pagina bestaat niet.</h1>
        <Link className="primary split" to="/">
          <span>Naar vandaag</span>
        </Link>
      </div>
    </div>
  );
}

export function CorruptPage() {
  usePageTitle("Voortgang");
  const deck = useDeck();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);

  function erase() {
    const saved = deck.reset();
    if (!saved) return;
    deck.showToast("Je voortgang is gewist.");
    setConfirm(false);
    navigate("/");
  }

  return (
    <div className="page alone">
      <div className="empty-state">
        <h1>Je opgeslagen voortgang kon niet worden gelezen.</h1>
        <p>Er is niets gewist. Probeer de pagina opnieuw te laden.</p>
        <button type="button" className="primary" onClick={deck.reloadPage}>
          Opnieuw laden
        </button>
        <button type="button" className="text-button" onClick={() => setConfirm(true)}>
          Begin opnieuw
        </button>
      </div>
      {confirm ? (
        <Dialog title="Alle voortgang wissen?" onClose={() => setConfirm(false)}>
          <p>Dit wist je woorden, je reeks en je voortgang in deze browser. Dit kan niet ongedaan worden gemaakt.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setConfirm(false)}>
              Annuleren
            </button>
            <button type="button" className="danger-button" onClick={erase}>
              Wis alles
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
