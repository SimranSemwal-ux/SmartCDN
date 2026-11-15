import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Zap,
  Clock,
  DollarSign,
  TrendingDown,
  HardDrive,
  Layers,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Database
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { dashboardApi, simulationApi } from '../services/api';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load real-time metrics from backend. Ensure Flask is running on port 5000.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Connecting to SmartCDN simulation engine...</p>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Active Replica Servers',
      value: `${metrics?.active_servers ?? 5} / ${metrics?.total_servers ?? 5}`,
      sub: 'Dynamic auto-allocation',
      icon: Server,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Total Requests Served',
      value: (metrics?.total_requests ?? 0).toLocaleString(),
      sub: `Intensity: ${metrics?.traffic_intensity ?? 1}x`,
      icon: Activity,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: 'Cache Hit Ratio',
      value: `${metrics?.hit_ratio ?? 0}%`,
      sub: `Miss Ratio: ${metrics?.miss_ratio ?? 0}%`,
      icon: Zap,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Avg Latency',
      value: `${metrics?.avg_response_time_ms ?? 0} ms`,
      sub: 'End-to-end response',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Total Operating Cost',
      value: `$${metrics?.total_operating_cost ?? 0}`,
      sub: `Storage: $${metrics?.total_storage_cost ?? 0}`,
      icon: DollarSign,
      color: 'text-slate-800',
      bg: 'bg-slate-100',
    },
    {
      title: 'Total Miss Cost',
      value: `$${metrics?.total_miss_cost ?? 0}`,
      sub: 'Origin penalty cost',
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      title: 'Average Server Utilization',
      value: `${metrics?.server_utilization ?? 0}%`,
      sub: 'CPU & memory load',
      icon: HardDrive,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      title: 'Estimated Cost Savings',
      value: `$${metrics?.cost_savings ?? 0}`,
      sub: 'vs static 5-server baseline',
      icon: TrendingDown,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const densityData = metrics?.density_history || [];
  const utilizationData = metrics?.utilization_history || [];
  const costData = metrics?.cost_history || [];
  const recentEvents = metrics?.recent_events || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / System Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">CCDN Operational Infrastructure</h2>
            <span className="badge-status-active">
              <CheckCircle className="w-3 h-3" /> Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time metric monitoring for 1 Origin Server and 5 Multi-Region Replica Servers under time-varying user request density.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="card-clean p-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{kpi.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{kpi.value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{kpi.sub}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid - Section A & B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Request Density Over Time (RS1-RS5) */}
        <div className="card-clean p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Request Density Over Time (DRR)</h3>
              <p className="text-xs text-slate-400">Incoming request rate distributed across RS1–RS5</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">req / step</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={densityData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="RS1" stroke="#2563eb" strokeWidth={2} dot={false} name="RS1 (US-East)" />
                <Line type="monotone" dataKey="RS2" stroke="#06b6d4" strokeWidth={2} dot={false} name="RS2 (US-West)" />
                <Line type="monotone" dataKey="RS3" stroke="#8b5cf6" strokeWidth={2} dot={false} name="RS3 (EU-Central)" />
                <Line type="monotone" dataKey="RS4" stroke="#f59e0b" strokeWidth={2} dot={false} name="RS4 (AP-East)" />
                <Line type="monotone" dataKey="RS5" stroke="#10b981" strokeWidth={2} dot={false} name="RS5 (AP-South)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Server Utilization (%) */}
        <div className="card-clean p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Replica Server Utilization (%)</h3>
              <p className="text-xs text-slate-400">Simulated CPU & Memory load across replica nodes</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">% load</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="average" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Average Load %" />
                <Bar dataKey="RS1" fill="#93c5fd" radius={[4, 4, 0, 0]} name="RS1" />
                <Bar dataKey="RS3" fill="#c4b5fd" radius={[4, 4, 0, 0]} name="RS3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Grid - Section C & D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart C: Cache Performance Hits vs Misses */}
        <div className="card-clean p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Cache Performance & Hierarchy Hits</h3>
              <p className="text-xs text-slate-400">Local replica hits vs peer cooperative hits vs origin fetches</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-100">
              <span className="text-[11px] text-emerald-600 font-medium">Local Hits</span>
              <p className="text-xl font-bold text-emerald-700">{metrics?.cache_hits ?? 0}</p>
            </div>
            <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-100">
              <span className="text-[11px] text-blue-600 font-medium">Peer Hits</span>
              <p className="text-xl font-bold text-blue-700">{metrics?.peer_hits ?? 0}</p>
            </div>
            <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-100">
              <span className="text-[11px] text-rose-600 font-medium">Origin Misses</span>
              <p className="text-xl font-bold text-rose-700">{metrics?.origin_misses ?? 0}</p>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${metrics?.hit_ratio ?? 0}%` }}
              title={`Local Hits: ${metrics?.hit_ratio ?? 0}%`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${metrics?.miss_ratio ?? 0}%` }}
              title={`Origin Misses: ${metrics?.miss_ratio ?? 0}%`}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
            <span>Hit Ratio: <strong>{metrics?.hit_ratio ?? 0}%</strong></span>
            <span>Origin Miss Ratio: <strong>{metrics?.miss_ratio ?? 0}%</strong></span>
          </div>
        </div>

        {/* Chart D: Cost Accumulation Over Time */}
        <div className="card-clean p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Total Operating Cost Breakdown</h3>
              <p className="text-xs text-slate-400">Active server storage/idle cost + cache miss egress penalties</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">USD ($)</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMiss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="total_cost" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" name="Total Cost ($)" />
                <Area type="monotone" dataKey="miss_cost" stroke="#ef4444" fillOpacity={1} fill="url(#colorMiss)" name="Miss Penalty ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Real-Time Request Stream Ticker */}
      <div className="card-clean p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Real-Time Request Routing Stream</h3>
            <p className="text-xs text-slate-400">Live CDN request pipeline routing to nearest active replica server</p>
          </div>
          <span className="badge-status-active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-400 font-medium">
                <th className="pb-2.5">Request ID</th>
                <th className="pb-2.5">Timestamp</th>
                <th className="pb-2.5">Region</th>
                <th className="pb-2.5">Target Server</th>
                <th className="pb-2.5">Content ID</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5">Served By</th>
                <th className="pb-2.5 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-slate-400">
                    No requests processed yet. Start or step the simulation above.
                  </td>
                </tr>
              ) : (
                recentEvents.slice().reverse().map((ev, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 font-mono font-medium text-slate-700">{ev.id}</td>
                    <td className="py-2.5 text-slate-400 font-mono">{ev.timestamp}</td>
                    <td className="py-2.5 text-slate-600">{ev.region}</td>
                    <td className="py-2.5">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                        {ev.target_server}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-slate-600">{ev.content_id}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                        ev.status === 'LOCAL_HIT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ev.status === 'PEER_HIT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {ev.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500">{ev.source}</td>
                    <td className="py-2.5 text-right font-mono font-medium text-slate-700">
                      {ev.latency_ms} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
