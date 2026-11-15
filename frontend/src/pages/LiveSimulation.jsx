import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Activity,
  Server,
  Database,
  Globe,
  Sliders,
  Zap,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import { simulationApi, dashboardApi } from '../services/api';

const SPEEDS = [1, 2, 5, 10];

export default function LiveSimulation() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [intensity, setIntensity] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);
  const [selectedAlgo, setSelectedAlgo] = useState('Adaptive Cost-aware');
  const [autoScale, setAutoScale] = useState(true);

  const fetchMetrics = async () => {
    try {
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
      if (data.traffic_intensity) setIntensity(data.traffic_intensity);
      if (data.speed_multiplier) setSpeed(data.speed_multiplier);
      if (data.algorithm) setSelectedAlgo(data.algorithm);
      if (data.auto_scaling_enabled !== undefined) setAutoScale(data.auto_scaling_enabled);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    await simulationApi.start();
    await fetchMetrics();
    setLoading(false);
  };

  const handlePause = async () => {
    setLoading(true);
    await simulationApi.pause();
    await fetchMetrics();
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    await simulationApi.reset();
    await fetchMetrics();
    setLoading(false);
  };

  const handleStep = async () => {
    setLoading(true);
    await simulationApi.step(15);
    await fetchMetrics();
    setLoading(false);
  };

  const updateConfig = async (newConfig) => {
    await simulationApi.configure(newConfig);
    await fetchMetrics();
  };

  const handleSpeedChange = (s) => {
    setSpeed(s);
    updateConfig({ speed: s });
  };

  const handleIntensityChange = (delta) => {
    const newIntensity = Math.max(0.2, Math.min(5.0, Number((intensity + delta).toFixed(1))));
    setIntensity(newIntensity);
    updateConfig({ traffic_intensity: newIntensity });
  };

  const handleAlgoChange = (e) => {
    const algo = e.target.value;
    setSelectedAlgo(algo);
    updateConfig({ algorithm: algo });
  };

  const handleAutoScaleToggle = () => {
    const nextVal = !autoScale;
    setAutoScale(nextVal);
    updateConfig({ auto_scaling: nextVal });
  };

  const servers = metrics?.servers || [];
  const origin = metrics?.origin_server || {};
  const isRunning = metrics?.state === 'RUNNING';

  return (
    <div className="space-y-6">
      {/* Top Controls Console */}
      <div className="card-clean p-6 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Interactive CDN Simulation Center</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                isRunning ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {metrics?.state || 'IDLE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Control synthetic user request generation, dynamic speed acceleration, and replica server routing.
            </p>
          </div>

          {/* Primary Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 shadow-sm transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Simulation</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 shadow-sm transition-all"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={handleStep}
              disabled={loading || isRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 transition-all disabled:opacity-50"
              title="Execute a single step of requests"
            >
              <FastForward className="w-4 h-4" />
              <span>Step Batch</span>
            </button>

            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset State</span>
            </button>
          </div>
        </div>

        {/* Configuration Sliders & Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 text-xs">
          {/* Simulation Speed */}
          <div>
            <label className="block text-slate-500 font-medium mb-2">Execution Acceleration</label>
            <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`flex-1 py-1 rounded font-medium transition-all ${
                    speed === s ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Traffic Intensity */}
          <div>
            <label className="block text-slate-500 font-medium mb-2">
              Traffic Intensity Multiplier: <strong className="text-slate-800 font-semibold">{intensity}x</strong>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleIntensityChange(-0.2)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all"
                  style={{ width: `${Math.min(100, (intensity / 3.0) * 100)}%` }}
                />
              </div>
              <button
                onClick={() => handleIntensityChange(0.2)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Algorithm */}
          <div>
            <label className="block text-slate-500 font-medium mb-2">Caching Policy Algorithm</label>
            <select
              value={selectedAlgo}
              onChange={handleAlgoChange}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Adaptive Cost-aware">Adaptive Cost-aware (CARSCM 2025)</option>
              <option value="Dynamic Selective">Dynamic Selective Caching (K=2)</option>
              <option value="LRU">Least Recently Used (LRU)</option>
            </select>
          </div>

          {/* Auto Scaling Toggle */}
          <div>
            <label className="block text-slate-500 font-medium mb-2">Auto-Scaling Engine</label>
            <button
              onClick={handleAutoScaleToggle}
              className={`w-full py-1.5 px-3 rounded-lg border font-medium flex items-center justify-between transition-all ${
                autoScale
                  ? 'bg-blue-50/80 border-blue-200 text-blue-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <span>Replica Auto-Scaling</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                autoScale ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'
              }`}>
                {autoScale ? 'ENABLED' : 'DISABLED'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual CDN Topology Map */}
      <div className="card-clean p-6 bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cloud CDN Architecture & Routing Topology</h3>
            <p className="text-xs text-slate-400">Origin server repository, distributed replica caches, and user request streams</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Active Replica
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Inactive Node
            </span>
          </div>
        </div>

        {/* Topology Grid */}
        <div className="space-y-8">
          {/* Origin Server Central Tier */}
          <div className="flex justify-center">
            <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{origin.name || 'Origin Central Repository'}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                      Primary
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Holds all 100 Content Objects (Full Master Archive)</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Egress Served</p>
                <p className="text-sm font-mono font-bold text-blue-400">
                  {roundMb(origin.bandwidth_egress_mb || 0)} MB
                </p>
              </div>
            </div>
          </div>

          {/* Connection Arrows downward */}
          <div className="flex justify-center text-slate-300">
            <div className="w-1/2 border-t-2 border-dashed border-slate-200 relative flex justify-between">
              <span className="absolute -top-3 left-0 text-slate-400 text-xs">▼</span>
              <span className="absolute -top-3 left-1/4 text-slate-400 text-xs">▼</span>
              <span className="absolute -top-3 left-1/2 text-slate-400 text-xs">▼</span>
              <span className="absolute -top-3 left-3/4 text-slate-400 text-xs">▼</span>
              <span className="absolute -top-3 right-0 text-slate-400 text-xs">▼</span>
            </div>
          </div>

          {/* 5 Replica Servers Tier */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {servers.map((srv) => {
              const isActive = srv.status !== 'Inactive';
              return (
                <div
                  key={srv.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-white border-blue-200/80 shadow-xs ring-1 ring-blue-50'
                      : 'bg-slate-50/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-900">{srv.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        srv.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : srv.status === 'High Demand'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : srv.status === 'Overloaded'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {srv.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium truncate mb-3">{srv.region}</p>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between text-slate-500">
                      <span>CPU Load:</span>
                      <strong className="text-slate-800">{srv.cpu_percent}%</strong>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${srv.cpu_percent > 80 ? 'bg-rose-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min(100, srv.cpu_percent)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-slate-500">
                      <span>Cache Used:</span>
                      <strong className="text-slate-800">{srv.used_mb} MB</strong>
                    </div>

                    <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-100">
                      <span>Hits: <strong className="text-emerald-600">{srv.cache_hits}</strong></span>
                      <span>Miss: <strong className="text-rose-600">{srv.cache_misses}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Stream Ticker / Pipeline stats */}
      <div className="card-clean p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Operational Simulation Telemetry</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400">Simulation Steps</span>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{metrics?.simulation_step ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400">Active Servers</span>
            <p className="text-lg font-bold text-blue-600 mt-0.5">{metrics?.active_servers ?? 0} / 5</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400">Origin Miss Ratio</span>
            <p className="text-lg font-bold text-rose-600 mt-0.5">{metrics?.miss_ratio ?? 0}%</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400">Operational Cost</span>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">${metrics?.total_operating_cost ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function roundMb(val) {
  return Number(val).toFixed(1);
}
