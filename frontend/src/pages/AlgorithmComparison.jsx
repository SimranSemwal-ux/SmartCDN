import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  TrendingDown,
  Zap,
  Clock,
  DollarSign,
  Award,
  Play,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { comparisonApi } from '../services/api';

export default function AlgorithmComparison() {
  const [benchData, setBenchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [numRequests, setNumRequests] = useState(3000);
  const [zipfAlpha, setZipfAlpha] = useState(0.5);
  const [seed, setSeed] = useState(42);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await comparisonApi.getResults();
      setBenchData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleRunBenchmark = async () => {
    setRunning(true);
    try {
      const res = await comparisonApi.run({
        num_requests: numRequests,
        zipf_alpha: zipfAlpha,
        seed: seed
      });
      setBenchData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const results = benchData?.results || [];
  const summary = benchData?.summary || {};

  // Chart data formatting
  const chartData = results.map((r) => ({
    name: r.algorithm,
    total_cost: r.total_cost,
    storage_cost: r.storage_cost,
    miss_cost: r.miss_cost,
    hit_ratio: r.hit_ratio,
    avg_latency: r.avg_latency_ms,
    evictions: r.total_evictions,
  }));

  return (
    <div className="space-y-6">
      {/* Benchmark Execution Banner */}
      <div className="card-clean p-6 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Caching Policy Comparative Benchmark</h2>
            <span className="badge-status-active">
              <CheckCircle className="w-3 h-3" /> Empirical Workload Test
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controlled empirical execution of LRU, Dynamic Selective, and Adaptive Cost-aware caching on the exact same synthetic trace.
          </p>
        </div>

        {/* Workload Parameter Inputs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Requests:</span>
            <input
              type="number"
              value={numRequests}
              onChange={(e) => setNumRequests(Number(e.target.value))}
              className="w-16 px-1 rounded border border-slate-300 font-semibold text-center"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Zipf α:</span>
            <input
              type="number"
              step="0.1"
              value={zipfAlpha}
              onChange={(e) => setZipfAlpha(Number(e.target.value))}
              className="w-12 px-1 rounded border border-slate-300 font-semibold text-center"
            />
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs transition-all disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{running ? 'Running Benchmark...' : 'Run Benchmark'}</span>
          </button>
        </div>
      </div>

      {/* Algorithm Podium / Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {results.map((r) => {
          const isWinner = r.rank === 1;
          return (
            <div
              key={r.algorithm}
              className={`card-clean p-5 relative overflow-hidden transition-all ${
                isWinner ? 'border-2 border-emerald-500/80 bg-emerald-50/20 shadow-md ring-2 ring-emerald-100' : 'bg-white'
              }`}
            >
              {isWinner && (
                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl flex items-center gap-1">
                  <Award className="w-3 h-3" /> BEST OVERALL PERFORMER
                </div>
              )}

              <div className="mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rank #{r.rank}</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{r.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Active Nodes: {r.active_servers} Servers</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Operating Cost:</span>
                  <span className="text-base font-bold font-mono text-slate-900">${r.total_cost}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cost Savings vs LRU:</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    {r.cost_savings_dollars > 0 ? `-$${r.cost_savings_dollars} (${r.cost_savings_percent}%)` : 'Baseline (0%)'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cache Hit Ratio:</span>
                  <span className="font-bold text-blue-700">{r.hit_ratio}%</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Avg Response Time:</span>
                  <span className="font-mono text-slate-700">{r.avg_latency_ms} ms</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Evictions:</span>
                  <span className="font-mono text-slate-700">{r.total_evictions}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparative Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Comparison Bar Chart */}
        <div className="card-clean p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Total Cost Comparison ($)</h3>
              <p className="text-xs text-slate-400">Lower is better. Storage cost vs miss penalties.</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="$" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="storage_cost" fill="#059669" radius={[4, 4, 0, 0]} name="Storage Cost ($)" />
                <Bar dataKey="miss_cost" fill="#dc2626" radius={[4, 4, 0, 0]} name="Miss Cost ($)" />
                <Bar dataKey="total_cost" fill="#2563eb" radius={[4, 4, 0, 0]} name="Total Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hit Ratio & Latency Bar Chart */}
        <div className="card-clean p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Cache Hit Ratio (%) & Average Latency (ms)</h3>
              <p className="text-xs text-slate-400">Hit ratio (higher is better) and response time (lower is better)</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="hit_ratio" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Hit Ratio (%)" />
                <Bar dataKey="avg_latency" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Avg Latency (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comprehensive Side-by-Side Data Table */}
      <div className="card-clean p-6 bg-white">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Detailed Empirical Benchmark Results</h3>
        <p className="text-xs text-slate-400 mb-4">Exact metrics calculated from benchmark execution trace</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="pb-2.5">Algorithm</th>
                <th className="pb-2.5">Total Reqs</th>
                <th className="pb-2.5">Local Hits</th>
                <th className="pb-2.5">Peer Hits</th>
                <th className="pb-2.5">Origin Misses</th>
                <th className="pb-2.5">Hit Ratio</th>
                <th className="pb-2.5">Avg Latency</th>
                <th className="pb-2.5">Evictions</th>
                <th className="pb-2.5">Active Nodes</th>
                <th className="pb-2.5">Total Cost</th>
                <th className="pb-2.5 text-right">Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r) => (
                <tr key={r.algorithm} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 font-semibold text-slate-900 flex items-center gap-1.5">
                    {r.rank === 1 && <Award className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>{r.label}</span>
                  </td>
                  <td className="py-3 font-mono text-slate-600">{r.total_requests}</td>
                  <td className="py-3 font-mono text-emerald-600 font-semibold">{r.cache_hits}</td>
                  <td className="py-3 font-mono text-blue-600">{r.peer_hits}</td>
                  <td className="py-3 font-mono text-rose-600">{r.cache_misses}</td>
                  <td className="py-3 font-bold text-blue-700">{r.hit_ratio}%</td>
                  <td className="py-3 font-mono text-slate-700">{r.avg_latency_ms} ms</td>
                  <td className="py-3 font-mono text-slate-600">{r.total_evictions}</td>
                  <td className="py-3 text-slate-700">{r.active_servers}</td>
                  <td className="py-3 font-mono font-bold text-slate-900">${r.total_cost}</td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-600">
                    {r.cost_savings_dollars > 0 ? `-$${r.cost_savings_dollars}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>{summary.attribution_note}</span>
        </div>
      </div>
    </div>
  );
}
