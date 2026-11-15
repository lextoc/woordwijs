import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Toaster } from "./components/ui";
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
  const { corrupt } = useDeck();
  if (corrupt) return <CorruptPage />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="zoeken" element={<SearchPage />} />
        <Route path="woorden" element={<MyWords />} />
        <Route path="woord/:id" element={<WordDetail />} />
        <Route path="voortgang" element={<ProgressPage />} />
        <Route path="bronnen" element={<Bronnen />} />
        <Route path="oefenen/klaar" element={<Summary />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="oefenen" element={<Practice />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <DeckProvider>
        <Gate />
        <Toaster />
      </DeckProvider>
    </BrowserRouter>
  );
}
