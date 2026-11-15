import React, { useState, useEffect } from 'react';
import {
  Sliders,
  DollarSign,
  TrendingDown,
  Server,
  Zap,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { optimizationApi } from '../services/api';

export default function CostOptimization() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState(null);

  // Tunable Cost Parameters
  const [storageCost, setStorageCost] = useState(15.0);
  const [missCost, setMissCost] = useState(0.05);
  const [capacity, setCapacity] = useState(2500);
  const [demandOverride, setDemandOverride] = useState('');

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await optimizationApi.getResults();
      setData(res);
      if (res.current_optimization?.cost_parameters) {
        const cp = res.current_optimization.cost_parameters;
        setStorageCost(cp.storage_cost_per_server);
        setMissCost(cp.miss_cost_coefficient);
        setCapacity(cp.server_capacity_reqs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleRunOptimization = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const payload = {
        storage_cost_per_server: storageCost,
        miss_cost_per_request: missCost,
        server_capacity_reqs: capacity,
      };
      if (demandOverride && !isNaN(Number(demandOverride))) {
        payload.demand_override = Number(demandOverride);
      }
      const res = await optimizationApi.run(payload);
      setMessage({
        type: 'success',
        text: `Optimization executed! Recommended configuration: ${res.data.optimal_active_servers} server(s). Estimated savings: $${res.data.estimated_hourly_savings}/h`
      });
      await fetchResults();
    } catch (err) {
      setMessage({ type: 'error', text: 'Optimization execution failed' });
    } finally {
      setRunning(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!currentPlan) return;
    setApplying(true);
    try {
      const res = await optimizationApi.applyPlan(currentPlan.server_plan);
      setMessage({ type: 'success', text: res.message });
      await fetchResults();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to apply optimization plan' });
    } finally {
      setApplying(false);
    }
  };

  const currentPlan = data?.current_optimization;
  const allConfigs = currentPlan?.all_configurations || [];
  const pastDecisions = data?.past_decisions || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card-clean p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Adaptive Replica Cost Optimizer</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              CARSCM IEEE 2025 Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Minimizes total CCDN operating cost by balancing active replica storage cost with cache miss penalties.
          </p>
        </div>

        <button
          onClick={handleRunOptimization}
          disabled={running}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs transition-all"
        >
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>Run Optimization Engine</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400">×</button>
        </div>
      )}

      {/* Theoretical Model Reference Card */}
      <div className="card-clean p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Research Paper Formula</span>
              <span className="text-[10px] text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded font-mono">IEEE 2025</span>
            </div>
            <p className="text-sm font-serif font-bold text-slate-900 mt-1">
              C_total = C_s × N_r + C_m × (DRR / N_r)
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Where <strong>C_s</strong> is active replica storage cost, <strong>C_m</strong> is cache miss penalty coefficient, <strong>N_r</strong> is active server count, and <strong>DRR</strong> is predicted request density.
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-white/80 p-3 rounded-lg border border-blue-100">
            <span>Operational Reality:</span>
            <p className="font-mono text-[11px] text-slate-800 mt-0.5">
              C_actual = Σ C_storage(r) + Σ C_miss + C_egress
            </p>
          </div>
        </div>
      </div>

      {/* Tunable Cost Model Parameters */}
      <div className="card-clean p-5 bg-white">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cost Parameters Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Storage Cost per Server (C_s)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="1"
                value={storageCost}
                onChange={(e) => setStorageCost(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
              />
            </div>
            <span className="text-[10px] text-slate-400">per server / hour</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Miss Penalty Coefficient (C_m)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={missCost}
                onChange={(e) => setMissCost(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
              />
            </div>
            <span className="text-[10px] text-slate-400">per missed request</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Server Capacity Limit
            </label>
            <input
              type="number"
              step="500"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">max requests / hr / node</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Demand Override (Optional DRR)
            </label>
            <input
              type="number"
              placeholder="e.g. 3500 (auto if blank)"
              value={demandOverride}
              onChange={(e) => setDemandOverride(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">test custom burst workloads</span>
          </div>
        </div>
      </div>

      {/* Optimization Recommendation Banner */}
      {currentPlan && (
        <div className="card-clean p-6 bg-white border-l-4 border-l-blue-600">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recommended Decision:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  currentPlan.action === 'MAINTAIN'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : currentPlan.action === 'SCALE_UP'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {currentPlan.action} ({currentPlan.current_active_servers} → {currentPlan.optimal_active_servers} SERVERS)
                </span>
              </div>
              <p className="text-sm text-slate-700 font-medium">{currentPlan.reason}</p>
              <p className="text-xs text-slate-400">
                Workload Demand Rate: <strong className="text-slate-700">{currentPlan.predicted_demand} req/h</strong>
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-400">Estimated Hourly Savings</p>
                <p className="text-2xl font-bold text-emerald-600 font-mono">
                  ${currentPlan.estimated_hourly_savings}/h
                </p>
                <p className="text-[11px] text-slate-400">
                  ${currentPlan.current_cost_per_hour} → ${currentPlan.optimized_cost_per_hour}/h
                </p>
              </div>

              <button
                onClick={handleApplyPlan}
                disabled={applying || currentPlan.action === 'MAINTAIN'}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 shadow-xs transition-all disabled:opacity-50"
              >
                {applying ? 'Applying...' : 'Apply Recommended Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Configuration Cost Trade-off Chart & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart: Cost curves across Nr = 1..5 */}
        <div className="card-clean p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Cost Trade-off Curve by Server Count (N_r)</h3>
              <p className="text-xs text-slate-400">Storage cost increases linearly while miss cost decreases inversely</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={allConfigs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="active_servers" tick={{ fontSize: 11, fill: '#64748b' }} unit=" Srv" />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="$" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="total_cost" stroke="#2563eb" strokeWidth={2.5} name="Total Cost ($)" />
                <Line type="monotone" dataKey="storage_cost" stroke="#059669" strokeWidth={1.5} strokeDasharray="3 3" name="Storage Cost ($)" />
                <Line type="monotone" dataKey="miss_cost" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 3" name="Miss Penalty ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Configuration Evaluation Table */}
        <div className="card-clean p-5 bg-white">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Evaluated Server Configurations</h3>
          <p className="text-xs text-slate-400 mb-3">Comparing theoretical cost and utilization across all active node counts</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium">
                  <th className="pb-2.5">Servers (N_r)</th>
                  <th className="pb-2.5">Storage</th>
                  <th className="pb-2.5">Miss Cost</th>
                  <th className="pb-2.5">Total Cost</th>
                  <th className="pb-2.5">Util. %</th>
                  <th className="pb-2.5 text-right">Feasibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allConfigs.map((cfg) => {
                  const isOptimal = cfg.active_servers === currentPlan?.optimal_active_servers;
                  return (
                    <tr key={cfg.active_servers} className={`transition-colors ${isOptimal ? 'bg-blue-50/60 font-semibold' : 'hover:bg-slate-50'}`}>
                      <td className="py-2.5 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cfg.active_servers} Active</span>
                        {isOptimal && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                            OPT
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-slate-600">${cfg.storage_cost}</td>
                      <td className="py-2.5 font-mono text-slate-600">${cfg.miss_cost}</td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">${cfg.total_cost}</td>
                      <td className="py-2.5 font-mono text-slate-600">{cfg.predicted_utilization}%</td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          cfg.feasible ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {cfg.feasible ? 'Capacity OK' : 'Exceeded'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
