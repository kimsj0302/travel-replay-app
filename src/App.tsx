import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import TripReplayPage from './pages/TripReplayPage';
import OnlineImageExtractPage from './pages/OnlineImageExtractPage';
import GpxEditorPage from './pages/GpxEditorPage';
import type { Trip } from './types';
import './App.css';

export default function App() {
  const [trip, setTrip] = useState<Trip | null>(null);

  return (
    <Routes>
      <Route path="/" element={<TripReplayPage trip={trip} onTripLoaded={setTrip} />} />
      <Route path="/extract" element={<OnlineImageExtractPage />} />
      <Route path="/gpx-editor" element={<GpxEditorPage />} />
    </Routes>
  );
}
