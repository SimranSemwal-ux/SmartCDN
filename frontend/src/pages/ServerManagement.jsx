import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle,
  AlertTriangle,
  Power,
  RotateCcw,
  Zap,
  Globe,
  RefreshCw,
  Database,
  ArrowUpRight
} from 'lucide-react';
import { serverApi } from '../services/api';

export default function ServerManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    try {
      const res = await serverApi.getServers();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (serverId) => {
    setActionLoading(serverId);
    setMessage(null);
    try {
      const res = await serverApi.toggleServer(serverId);
      setMessage({ type: 'success', text: res.message });
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to toggle server status';
      setMessage({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetOverrides = async () => {
    setActionLoading('overrides');
    try {
      const res = await serverApi.resetOverrides();
      setMessage({ type: 'success', text: res.message });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAutoScale = async () => {
    try {
      const nextVal = !data?.auto_scaling_enabled;
      await serverApi.toggleAutoScale(nextVal);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Loading replica server cluster...</p>
      </div>
    );
  }

  const servers = data?.servers || [];
  const origin = data?.origin || {};
  const autoScaling = data?.auto_scaling_enabled ?? true;

  return (
    <div className="space-y-6">
      {/* Header card with cluster status & controls */}
      <div className="card-clean p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Replica Server Fleet Management</h2>
            <span className="badge-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {servers.filter(s => s.status !== 'Inactive').length} / {servers.length} Operational
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitor compute load, localized cache utilization, and toggle manual operator overrides across regions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleAutoScale}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoScaling
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            Auto-Scale: {autoScaling ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleResetOverrides}
            disabled={actionLoading === 'overrides'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Clear all manual overrides and return control to the auto-scaling engine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Overrides</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Origin Server Master Card */}
      <div className="card-clean p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">{origin.name || 'Origin Server (Central Repository)'}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Global Origin
                </span>
              </div>
              <p className="text-xs text-slate-400">{origin.region || 'US-Central Primary Data Center'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs text-right">
            <div>
              <span className="text-slate-400">Status</span>
              <p className="font-semibold text-emerald-400 mt-0.5">Online (Authoritative)</p>
            </div>
            <div>
              <span className="text-slate-400">Total Origin Misses Served</span>
              <p className="font-mono font-bold text-slate-100 text-sm mt-0.5">{origin.total_served ?? 0}</p>
            </div>
            <div>
              <span className="text-slate-400">Egress Bandwidth</span>
              <p className="font-mono font-bold text-blue-400 text-sm mt-0.5">
                {(origin.bandwidth_egress_mb ?? 0).toFixed(1)} MB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Replica Server Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {servers.map((srv) => {
          const isActive = srv.status !== 'Inactive';
          const isLoadingThis = actionLoading === srv.id;

          return (
            <div
              key={srv.id}
              className={`card-clean p-5 relative overflow-hidden transition-all ${
                !isActive ? 'opacity-70 bg-slate-50' : 'bg-white'
              }`}
            >
              {srv.manual_override && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">
                  MANUAL OVERRIDE
                </div>
              )}

              {/* Server Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{srv.id}</span>
                    <span className="text-xs text-slate-400 font-medium">{srv.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{srv.region}</span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    srv.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : srv.status === 'High Demand'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : srv.status === 'Overloaded'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {srv.status}
                </span>
              </div>

              {/* Resource Utilization Gauges */}
              <div className="space-y-3 mb-5 text-xs">
                {/* CPU */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" /> CPU Load
                    </span>
                    <span className="font-semibold">{srv.cpu_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        srv.cpu_percent > 85 ? 'bg-rose-500' : srv.cpu_percent > 65 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, srv.cpu_percent)}%` }}
                    />
                  </div>
                </div>

                {/* Memory */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Memory Load
                    </span>
                    <span className="font-semibold">{srv.memory_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, srv.memory_percent)}%` }}
                    />
                  </div>
                </div>

                {/* Local Cache Usage */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-slate-400" /> Cache Capacity
                    </span>
                    <span className="font-semibold">{srv.used_mb} / {srv.capacity_mb} MB ({srv.cache_usage_percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, srv.cache_usage_percent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/80 rounded-lg border border-slate-100 text-center text-xs mb-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Hits</span>
                  <p className="font-bold text-emerald-600 mt-0.5">{srv.cache_hits}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Misses</span>
                  <p className="font-bold text-rose-600 mt-0.5">{srv.cache_misses}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Hit Ratio</span>
                  <p className="font-bold text-blue-600 mt-0.5">{srv.hit_ratio}%</p>
                </div>
              </div>

              {/* Action Toggle Button */}
              <button
                onClick={() => handleToggle(srv.id)}
                disabled={isLoadingThis}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isActive ? 'Deactivate Server' : 'Activate Server'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
