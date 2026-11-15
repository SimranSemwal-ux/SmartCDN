import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  DollarSign,
  Save,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  HardDrive,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { simulationApi } from '../services/api';

export default function Settings() {
  const [storageCost, setStorageCost] = useState('15.0');
  const [missCost, setMissCost] = useState('0.05');
  const [capacity, setCapacity] = useState('500');
  const [zipfAlpha, setZipfAlpha] = useState('0.5');
  const [defaultSpeed, setDefaultSpeed] = useState('1');
  const [defaultAlgo, setDefaultAlgo] = useState('Adaptive Cost-aware');
  const [dampingThreshold, setDampingThreshold] = useState('0.05');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Load from localStorage if present
    const saved = localStorage.getItem('smartcdn_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.storageCost) setStorageCost(parsed.storageCost);
        if (parsed.missCost) setMissCost(parsed.missCost);
        if (parsed.capacity) setCapacity(parsed.capacity);
        if (parsed.zipfAlpha) setZipfAlpha(parsed.zipfAlpha);
        if (parsed.defaultSpeed) setDefaultSpeed(parsed.defaultSpeed);
        if (parsed.defaultAlgo) setDefaultAlgo(parsed.defaultAlgo);
        if (parsed.dampingThreshold) setDampingThreshold(parsed.dampingThreshold);
      } catch (e) {}
    }
  }, []);

  const handleSave = async () => {
    const settings = {
      storageCost,
      missCost,
      capacity,
      zipfAlpha,
      defaultSpeed,
      defaultAlgo,
      dampingThreshold
    };
    localStorage.setItem('smartcdn_settings', JSON.stringify(settings));

    // Send update to simulation backend
    try {
      await simulationApi.configure({
        algorithm: defaultAlgo,
        speed: Number(defaultSpeed)
      });
      setMessage({ type: 'success', text: 'System settings saved and applied to active simulation engine' });
    } catch (e) {
      setMessage({ type: 'success', text: 'Preferences saved locally' });
    }
  };

  const handleResetDefaults = () => {
    setStorageCost('15.0');
    setMissCost('0.05');
    setCapacity('500');
    setZipfAlpha('0.5');
    setDefaultSpeed('1');
    setDefaultAlgo('Adaptive Cost-aware');
    setDampingThreshold('0.05');
    localStorage.removeItem('smartcdn_settings');
    setMessage({ type: 'info', text: 'Settings reset to research paper default parameters' });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="card-clean p-6 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System & Algorithm Parameters</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure global default cost coefficients, cache memory limits, and optimization damping thresholds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400">×</button>
        </div>
      )}

      {/* Settings Grid */}
      <div className="card-clean p-6 bg-white space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 mb-4">
            Cost Optimization Model (CARSCM IEEE 2025)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Storage Cost per Active Replica (C_s)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.5"
                  value={storageCost}
                  onChange={(e) => setStorageCost(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cost incurred per active replica server per hour.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Miss Penalty Cost Coefficient (C_m)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={missCost}
                  onChange={(e) => setMissCost(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Penalty cost per cache miss requiring Origin transit.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Hysteresis Damping Threshold (ε)
              </label>
              <input
                type="number"
                step="0.01"
                value={dampingThreshold}
                onChange={(e) => setDampingThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Minimum 5% cost difference to prevent flapping.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Zipf Content Popularity Skew (α)
              </label>
              <input
                type="number"
                step="0.1"
                value={zipfAlpha}
                onChange={(e) => setZipfAlpha(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 0.5 to align with research benchmark.</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 mb-4">
            Replica Hardware & Engine Limits
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Replica Server Cache Capacity
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="50"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">MB</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Maximum RAM storage allocated for cache per node.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Default Active Caching Algorithm
              </label>
              <select
                value={defaultAlgo}
                onChange={(e) => setDefaultAlgo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium"
              >
                <option value="Adaptive Cost-aware">Adaptive Cost-aware (CARSCM 2025)</option>
                <option value="Dynamic Selective">Dynamic Selective Caching (K=2)</option>
                <option value="LRU">Least Recently Used (LRU)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Algorithm utilized during live continuous simulation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
