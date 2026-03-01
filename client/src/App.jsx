import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import LoadingSkeleton from './components/ui/LoadingSkeleton';
import { fetchSeasons } from './services/api';

// Lazy-load all page components — only the visited page's JS loads
const Dashboard = lazy(() => import('./components/pages/Dashboard'));
const Teams = lazy(() => import('./components/pages/Teams'));
const Players = lazy(() => import('./components/pages/Players'));
const HeadToHead = lazy(() => import('./components/pages/HeadToHead'));
const Scorecard = lazy(() => import('./components/pages/Scorecard'));
const PlayerCompare = lazy(() => import('./components/pages/PlayerCompare'));
const SeasonStats = lazy(() => import('./components/pages/SeasonStats'));
const Analytics = lazy(() => import('./components/pages/Analytics'));
const Matchup = lazy(() => import('./components/pages/Matchup'));
const MatchFilter = lazy(() => import('./components/pages/MatchFilter'));
const PointsTable = lazy(() => import('./components/pages/PointsTable'));

function PageWrapper({ children }) {
  return <div className="page-fade-in">{children}</div>;
}

function AnimatedRoutes({ season }) {
  const location = useLocation();
  return (
    <Suspense fallback={<div className="page-container"><LoadingSkeleton /></div>}>
      <div key={location.pathname} className="page-fade-in">
        <Routes location={location}>
          <Route path="/" element={<Dashboard season={season} />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/players" element={<Players />} />
          <Route path="/head-to-head" element={<HeadToHead />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/compare" element={<PlayerCompare />} />
          <Route path="/stats" element={<SeasonStats />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/matchup" element={<Matchup />} />
          <Route path="/filter" element={<MatchFilter />} />
          <Route path="/points-table" element={<PointsTable />} />
        </Routes>
      </div>
    </Suspense>
  );
}

export default function App() {
  const [season, setSeason] = useState('');
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    fetchSeasons()
      .then((res) => setSeasons(res.data))
      .catch((err) => console.error('Failed to load seasons:', err));
  }, []);

  return (
    <Router>
      <Navbar season={season} onSeasonChange={setSeason} seasons={seasons} />
      <div className="page-container">
        <AnimatedRoutes season={season} />
      </div>
    </Router>
  );
}
