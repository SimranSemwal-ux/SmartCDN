import React, { useState, useEffect } from 'react';
import {
  History,
  Download,
  Trash2,
  GitCompare,
  Eye,
  CheckCircle,
  Calendar,
  Layers,
  Activity,
  DollarSign,
  Clock,
  RefreshCw,
  X
} from 'lucide-react';
import { simulationApi } from '../services/api';

export default function SimulationHistory() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [compareRunA, setCompareRunA] = useState(null);
  const [compareRunB, setCompareRunB] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await simulationApi.getHistory();
      setRuns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete simulation run ${id}?`)) return;
    try {
      await simulationApi.deleteRun(id);
      setMessage({ type: 'success', text: `Deleted run ${id}` });
      await fetchHistory();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete simulation run' });
    }
  };

  const handleSaveCurrentSnapshot = async () => {
    const runName = prompt('Enter a name for this simulation snapshot:', `Snapshot-${new Date().toISOString().slice(0, 19)}`);
    if (!runName) return;
    try {
      await simulationApi.saveSnapshot(runName);
      setMessage({ type: 'success', text: 'Current simulation state saved to history' });
      await fetchHistory();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save snapshot' });
    }
  };

  const startComparison = (run) => {
    if (!compareRunA) {
      setCompareRunA(run);
      setMessage({ type: 'info', text: `Selected Run A (${run.id}). Now click "Compare" on a second run.` });
    } else if (!compareRunB && compareRunA.id !== run.id) {
      setCompareRunB(run);
      setComparing(true);
    }
  };

  const clearComparison = () => {
    setCompareRunA(null);
    setCompareRunB(null);
    setComparing(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Console */}
      <div className="card-clean p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">CCDN Simulation Run History</h2>
            <span className="badge-status-active">
              <CheckCircle className="w-3 h-3" /> SQLite Persisted
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse archived simulation snapshots, evaluate comparative performance differences, or export history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCurrentSnapshot}
            className="px-3.5 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs transition-all"
          >
            Save Current Snapshot
          </button>

          <a
            href={simulationApi.getExportUrl()}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </a>
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

      {/* Side-by-side comparison modal/banner if comparing */}
      {comparing && compareRunA && compareRunB && (
        <div className="card-clean p-6 bg-white border-2 border-blue-500/80 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Side-by-Side Simulation Comparison</h3>
            </div>
            <button onClick={clearComparison} className="p-1 rounded text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            {/* Run A */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-blue-700 font-mono">{compareRunA.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-medium">Run A</span>
              </div>
              <p className="font-semibold text-slate-900 text-sm">{compareRunA.name}</p>
              <p className="text-slate-500">Algorithm: <strong className="text-slate-800">{compareRunA.algorithm}</strong></p>
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <p>Total Requests: <strong>{compareRunA.total_requests}</strong></p>
                <p>Hit Ratio: <strong className="text-emerald-600">{compareRunA.hit_ratio}%</strong></p>
                <p>Avg Latency: <strong>{compareRunA.avg_latency_ms} ms</strong></p>
                <p>Operating Cost: <strong className="text-slate-900 font-mono">${compareRunA.total_cost}</strong></p>
                <p>Active Servers: <strong>{compareRunA.active_servers}</strong></p>
              </div>
            </div>

            {/* Run B */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-indigo-700 font-mono">{compareRunB.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-800 font-medium">Run B</span>
              </div>
              <p className="font-semibold text-slate-900 text-sm">{compareRunB.name}</p>
              <p className="text-slate-500">Algorithm: <strong className="text-slate-800">{compareRunB.algorithm}</strong></p>
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <p>Total Requests: <strong>{compareRunB.total_requests}</strong></p>
                <p>Hit Ratio: <strong className="text-emerald-600">{compareRunB.hit_ratio}%</strong></p>
                <p>Avg Latency: <strong>{compareRunB.avg_latency_ms} ms</strong></p>
                <p>Operating Cost: <strong className="text-slate-900 font-mono">${compareRunB.total_cost}</strong></p>
                <p>Active Servers: <strong>{compareRunB.active_servers}</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="card-clean p-6 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Archived Simulation Runs</h3>
            <p className="text-xs text-slate-400">Total of {runs.length} saved records in database</p>
          </div>
          {compareRunA && !compareRunB && (
            <span className="text-xs text-blue-600 font-medium animate-pulse">
              Select second run to compare with {compareRunA.id}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="pb-2.5">ID</th>
                <th className="pb-2.5">Run Name</th>
                <th className="pb-2.5">Timestamp</th>
                <th className="pb-2.5">Algorithm</th>
                <th className="pb-2.5">Requests</th>
                <th className="pb-2.5">Hit Ratio</th>
                <th className="pb-2.5">Avg Latency</th>
                <th className="pb-2.5">Total Cost</th>
                <th className="pb-2.5">Nodes</th>
                <th className="pb-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No simulation runs saved yet. Click "Save Current Snapshot" to archive a run.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 font-mono font-bold text-blue-700">{r.id}</td>
                    <td className="py-3 font-medium text-slate-800">{r.name}</td>
                    <td className="py-3 text-slate-400 font-mono text-[11px]">
                      {r.created_at ? r.created_at.split('T')[0] : '-'}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {r.algorithm}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-600">{r.total_requests}</td>
                    <td className="py-3 font-bold text-emerald-600">{r.hit_ratio}%</td>
                    <td className="py-3 font-mono text-slate-600">{r.avg_latency_ms} ms</td>
                    <td className="py-3 font-mono font-bold text-slate-900">${r.total_cost}</td>
                    <td className="py-3 text-slate-600">{r.active_servers}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startComparison(r)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Compare with another run"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete simulation record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
