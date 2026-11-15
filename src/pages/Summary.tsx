import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRightIcon, ChevronIcon, FlameIcon } from "../components/Icons";
import { Stats, StorageBanner, usePageTitle } from "../components/ui";
import { dagen } from "../lib/text";
import { wordById } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export type SummaryState = {
  answers: number;
  goed: number;
  moeilijk: number;
  niet: number;
  learnedIds: string[];
  missIds: string[];
  streak: number;
  streakIncreased: boolean;
};

function isSummary(value: unknown): value is SummaryState {
  if (!value || typeof value !== "object") return false;
  const item = value as SummaryState;
  return typeof item.answers === "number" && Array.isArray(item.missIds) && typeof item.streak === "number";
}

export function Summary() {
  usePageTitle("Klaar");
  const location = useLocation();
  const navigate = useNavigate();
  const deck = useDeck();
  const summary = isSummary(location.state) ? location.state : null;
  if (!summary) return <Navigate to="/" replace />;
  const learned = summary.learnedIds.length;
  const line =
    learned > 0
      ? learned === 1
        ? "1 woord is nu geleerd."
        : `${learned} woorden zijn nu geleerd.`
      : summary.niet + summary.moeilijk > 0
        ? "Moeilijke woorden komen vaker terug."
        : "Alles goed.";
  return (
    <div className="page">
      <StorageBanner />
      <p className="eyebrow">Klaar</p>
      <h1 className="welcome-title">{summary.answers === 1 ? "1 woord geoefend" : `${summary.answers} woorden geoefend`}</h1>
      <p className="lede">{line}</p>
      <Stats
        items={[
          { label: "Goed", value: String(summary.goed), icon: <span className="stat-gap" /> },
          { label: "Moeilijk", value: String(summary.moeilijk), icon: <span className="stat-gap" /> },
          { label: "Niet geweten", value: String(summary.niet), icon: <span className="stat-gap" /> },
        ]}
      />
      <p className="streak-line">
        <FlameIcon size={24} />
        <strong>Reeks: {dagen(summary.streak)}</strong>
        {summary.streakIncreased ? <span className="count-badge">+1</span> : null}
      </p>
      {summary.missIds.length > 0 ? (
        <>
          <h3>Komt snel terug</h3>
          <ul className="deck-list">
            {summary.missIds.map((id) => {
              const word = wordById.get(id);
              if (!word) return null;
              return (
                <li key={id}>
                  <Link to={`/woord/${encodeURIComponent(id)}`}>
                    <strong>{word.word}</strong>
                    <span>{word.posLabel}</span>
                    <ChevronIcon />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <button type="button" className="primary split" onClick={() => navigate("/")}>
        <span>Terug naar vandaag</span>
        <ArrowRightIcon />
      </button>
      {Object.keys(deck.store.cards).length > 0 ? (
        <button type="button" className="secondary split" onClick={() => navigate("/oefenen", { state: { mode: "extra", startedAt: Date.now() } })}>
          <span>Extra ronde</span>
          <ArrowRightIcon />
        </button>
      ) : null}
    </div>
  );
}
