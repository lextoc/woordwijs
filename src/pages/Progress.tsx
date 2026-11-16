import { Link, useNavigate, useLocation } from "react-router-dom";
import { CheckIcon, FlameIcon } from "../components/Icons";
import { Dialog, readState, Stats, StorageBanner, StorageNote, usePageTitle } from "../components/ui";
import { lastSevenDays } from "../lib/dates";
import { cardStatus } from "../lib/model";
import { dagen } from "../lib/text";
import { useDeck } from "../state/DeckContext";

export function ProgressPage() {
  usePageTitle("Voortgang");
  const deck = useDeck();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = readState(location.state)?.dialog === "reset";
  const cards = Object.values(deck.store.cards);
  const learned = cards.filter((card) => cardStatus(card) === "geleerd").length;
  const busy = cards.filter((card) => cardStatus(card) === "bezig").length;
  const fresh = cards.filter((card) => cardStatus(card) === "nieuw").length;
  const total = learned + busy + fresh;
  const hasPractice = cards.some((card) => card.ratings.length > 0) || deck.store.countedDays.length > 0;
  const days = lastSevenDays(deck.today);

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
    <div className="page progress-page">
      <StorageBanner />
      <p className="eyebrow">Voortgang</p>
      <h1 className="page-title">Je voortgang</h1>
      {!hasPractice ? (
        <div className="progress-empty">
          <p className="lede">Oefen je eerste woorden en je ziet hier je reeks en je geleerde woorden.</p>
          <Link className="primary" to={total ? "/" : "/zoeken"}>{total ? "Begin met oefenen" : "Voeg je eerste woord toe"}</Link>
        </div>
      ) : (
        <>
          <Stats
            items={[
              { label: "Reeks", value: dagen(deck.streak), icon: <FlameIcon size={20} /> },
              { label: "Beste reeks", value: dagen(deck.best) },
              { label: "Geleerd", value: String(learned), icon: <CheckIcon size={20} /> },
            ]}
          />
          <h2>Laatste 7 dagen</h2>
          <ol className="week">
            {days.map((day) => {
              const done = deck.store.countedDays.includes(day.iso);
              const isToday = day.iso === deck.today;
              const text = done ? `${day.label}: geoefend` : isToday ? `${day.label}: vandaag nog niet geoefend` : `${day.label}: niet geoefend`;
              return (
                <li key={day.iso}>
                  <span aria-hidden="true">{day.label}</span>
                  <span className={done ? "day is-done" : isToday ? "day is-today" : "day"}>{done ? <CheckIcon size={18} /> : null}</span>
                  <span className="sr-only">{text}</span>
                </li>
              );
            })}
          </ol>
          {total > 0 ? (
            <>
              <h2>Je woorden</h2>
              <div className="status-bar" aria-hidden="true">
                <span style={{ width: `${(learned / total) * 100}%` }} />
                <span style={{ width: `${(busy / total) * 100}%` }} />
                <span style={{ width: `${(fresh / total) * 100}%` }} />
              </div>
              <ul className="legend">
                <li>
                  <Link to="/woorden?status=geleerd"><i className="swatch learned" /> Geleerd <strong>{learned}</strong></Link>
                </li>
                <li>
                  <Link to="/woorden?status=bezig"><i className="swatch busy" /> Bezig <strong>{busy}</strong></Link>
                </li>
                <li>
                  <Link to="/woorden?status=nieuw"><i className="swatch fresh" /> Nieuw <strong>{fresh}</strong></Link>
                </li>
              </ul>
            </>
          ) : null}
          <details className="explain">
            <summary>Wat betekent ‘geleerd’?</summary>
            <p className="lede">
              Een woord is geleerd als je het drie keer na elkaar goed had, op drie verschillende dagen. Vergeet je het later weer, dan telt het niet meer mee.
            </p>
          </details>
          <details className="explain">
            <summary>Wat telt als een dag voor je reeks?</summary>
            <p className="lede">
              Een dag telt mee voor je reeks als je minstens 5 woorden hebt geoefend, of alle woorden die vandaag aan de beurt waren. De dag loopt van
              middernacht tot middernacht op je eigen toestel.
            </p>
          </details>
        </>
      )}
      <StorageNote>Je voortgang staat alleen in deze browser. Wis je browsergegevens, dan verdwijnt ze. Op je andere toestellen staat niets.</StorageNote>
      <div className="reset-row">
        <button type="button" className="text-button danger-text" onClick={openConfirm}>
          Wis mijn voortgang
        </button>
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
