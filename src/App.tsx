import { CatalogBoundary } from "./components/CatalogBoundary";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { readState, Toaster, useViewportVars } from "./components/ui";
import { Bronnen } from "./pages/Bronnen";
import { Home } from "./pages/Home";
import { Practice } from "./pages/Practice";
import { ProgressPage } from "./pages/Progress";
import { SearchPage } from "./pages/Search";
import { CorruptPage, NotFound } from "./pages/States";
import { Summary } from "./pages/Summary";
import { WordDetail } from "./pages/WordDetail";
import { MyWords } from "./pages/Words";
import { DeckProvider, useDeck } from "./state/DeckContext";

function Gate() {
  const location = useLocation();
  const background = readState(location.state)?.backgroundLocation;
  const { corrupt } = useDeck();
  useViewportVars();
  if (corrupt) {
    return (
      <>
        <CorruptPage />
        <Toaster />
      </>
    );
  }
  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="zoeken" element={<SearchPage />} />
          <Route path="woorden" element={<MyWords />} />
          <Route path="woord/:id" element={<WordDetail mode="page" />} />
          <Route path="voortgang" element={<ProgressPage />} />
          <Route path="bronnen" element={<Bronnen />} />
          <Route path="oefenen/klaar" element={<Summary />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="oefenen" element={<Practice />} />
      </Routes>
      {background ? (
        <Routes>
          <Route path="woord/:id" element={<WordDetail mode="overlay" />} />
        </Routes>
      ) : null}
      <Toaster />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <DeckProvider>
        <CatalogBoundary><Gate /></CatalogBoundary>
      </DeckProvider>
    </BrowserRouter>
  );
}
