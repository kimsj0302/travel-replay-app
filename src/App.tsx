import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import TripReplayPage from './pages/TripReplayPage';
import OnlineImageExtractPage from './pages/OnlineImageExtractPage';
import type { Trip } from './types';
import './App.css';

export default function App() {
  const [trip, setTrip] = useState<Trip | null>(null);

  return (
    <Routes>
      <Route path="/" element={<TripReplayPage trip={trip} onTripLoaded={setTrip} />} />
      <Route path="/extract" element={<OnlineImageExtractPage />} />
    </Routes>
  );
}
