import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import ImportPage from './pages/ImportPage';
import TripReplayPage from './pages/TripReplayPage';
import OnlineImageExtractPage from './pages/OnlineImageExtractPage';
import type { Trip } from './types';
import './App.css';

export default function App() {
  const [trip, setTrip] = useState<Trip | null>(null);

  return (
    <Routes>
      <Route path="/" element={<ImportPage onTripLoaded={setTrip} />} />
      <Route path="/replay" element={<TripReplayPage trip={trip} />} />
      <Route path="/extract" element={<OnlineImageExtractPage />} />
    </Routes>
  );
}
