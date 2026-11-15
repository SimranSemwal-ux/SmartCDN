import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import LiveSimulation from './pages/LiveSimulation';
import ServerManagement from './pages/ServerManagement';
import CacheManagement from './pages/CacheManagement';
import DemandPrediction from './pages/DemandPrediction';
import CostOptimization from './pages/CostOptimization';
import AlgorithmComparison from './pages/AlgorithmComparison';
import DatasetManagement from './pages/DatasetManagement';
import SimulationHistory from './pages/SimulationHistory';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="simulation" element={<LiveSimulation />} />
          <Route path="servers" element={<ServerManagement />} />
          <Route path="cache" element={<CacheManagement />} />
          <Route path="prediction" element={<DemandPrediction />} />
          <Route path="optimization" element={<CostOptimization />} />
          <Route path="comparison" element={<AlgorithmComparison />} />
          <Route path="dataset" element={<DatasetManagement />} />
          <Route path="history" element={<SimulationHistory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
