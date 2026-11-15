import React, { useState, useEffect } from 'react';
import {
  Layers,
  HardDrive,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Activity,
  History,
  TrendingUp,
  Filter
} from 'lucide-react';
import { cacheApi } from '../services/api';

const SERVERS = ['RS1', 'RS2', 'RS3', 'RS4', 'RS5'];

export default function CacheManagement() {
  const [selectedServer, setSelectedServer] = useState('RS1');
  const [cacheData, setCacheData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchCache = async (sid) => {
    try {
      setLoading(true);
      const res = await cacheApi.getCache(sid);
      setCacheData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCache(selectedServer);
  }, [selectedServer]);

  const handleAlgorithmChange = async (newAlgo) => {
    setActionLoading(true);
    try {
      const res = await cacheApi.setAlgorithm(newAlgo);
      setMessage({ type: 'success', text: res.message });
      await fetchCache(selectedServer);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update algorithm' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm(`Clear cache contents for ${selectedServer}?`)) return;
    setActionLoading(true);
    try {
      const res = await cacheApi.clearCache(selectedServer);
      setMessage({ type: 'success', text: res.message });
      await fetchCache(selectedServer);
    } finally {
      setActionLoading(false);
    }
  };

  const stats = cacheData?.stats || {};
  const entries = cacheData?.entries || [];
  const evictionHistory = stats?.eviction_history || [];

  const filteredEntries = entries.filter((e) =>
    e.content_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Controller Header */}
      <div className="card-clean p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Replica Cache Inspection & Management</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {cacheData?.active_algorithm || 'Adaptive Cost-aware'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inspect in-memory cached objects, admission/eviction utility scores, and eviction history per replica node.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={cacheData?.active_algorithm || 'Adaptive Cost-aware'}
            onChange={(e) => handleAlgorithmChange(e.target.value)}
            disabled={actionLoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="Adaptive Cost-aware">Adaptive Cost-aware (CARSCM 2025)</option>
            <option value="Dynamic Selective">Dynamic Selective Caching (K=2)</option>
            <option value="LRU">Least Recently Used (LRU)</option>
          </select>

          <button
            onClick={handleClearCache}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Flush Cache</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400">×</button>
        </div>
      )}

      {/* Replica Server Selection Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl">
        {SERVERS.map((sid) => (
          <button
            key={sid}
            onClick={() => setSelectedServer(sid)}
            className={`py-3 px-5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              selectedServer === sid
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{sid} Cache</span>
          </button>
        ))}
      </div>

      {/* Cache Statistics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Cache Usage</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.used_mb ?? 0} MB</p>
          <p className="text-[11px] text-slate-400">Capacity: {stats.capacity_mb ?? 500} MB ({stats.usage_percent ?? 0}%)</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Cached Items</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{stats.total_items ?? 0}</p>
          <p className="text-[11px] text-slate-400">Distinct content objects</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Local Hit Ratio</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.hit_ratio ?? 0}%</p>
          <p className="text-[11px] text-slate-400">Hits: {stats.total_hits ?? 0} | Misses: {stats.total_misses ?? 0}</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Total Evictions</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{stats.total_evictions ?? 0}</p>
          <p className="text-[11px] text-slate-400">Freed by capacity rules</p>
        </div>
      </div>

      {/* Search and Table */}
      <div className="card-clean p-6 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cached Objects in {selectedServer}</h3>
            <p className="text-xs text-slate-400">Detailed inspection of currently retained content entries</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search content or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Cached Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="pb-2.5">Content ID</th>
                <th className="pb-2.5">Asset Name</th>
                <th className="pb-2.5">Category</th>
                <th className="pb-2.5">Size</th>
                <th className="pb-2.5">Popularity p(c)</th>
                <th className="pb-2.5">Access Count</th>
                <th className="pb-2.5">Adaptive Utility</th>
                <th className="pb-2.5 text-right">Last Accessed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    {loading ? 'Loading cache...' : 'No content items currently cached on this replica node.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => (
                  <tr key={item.content_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 font-mono font-semibold text-blue-700">{item.content_id}</td>
                    <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-slate-600">{item.size_mb} MB</td>
                    <td className="py-2.5 font-mono text-slate-600">{Number(item.popularity_score).toFixed(4)}</td>
                    <td className="py-2.5 font-bold text-slate-800">{item.access_count}</td>
                    <td className="py-2.5">
                      {item.utility_score !== null && item.utility_score !== undefined ? (
                        <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {Number(item.utility_score).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A (LRU)</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-400">
                      {item.last_accessed ? item.last_accessed.split('T')[1]?.split('.')[0] : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eviction History Log */}
      <div className="card-clean p-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Cache Evictions Log ({selectedServer})</h3>
            <p className="text-xs text-slate-400">Eviction decisions triggered when capacity threshold was reached</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Last 10 events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="pb-2.5">Evicted Object</th>
                <th className="pb-2.5">Size Freed</th>
                <th className="pb-2.5">Eviction Reason</th>
                <th className="pb-2.5">Accesses Prior</th>
                <th className="pb-2.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evictionHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-400">
                    No evictions recorded yet for this replica cache.
                  </td>
                </tr>
              ) : (
                evictionHistory.slice().reverse().map((ev, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 font-mono font-medium text-rose-600">{ev.content_id}</td>
                    <td className="py-2.5 font-mono text-slate-600">{ev.size_mb} MB</td>
                    <td className="py-2.5 text-slate-600">{ev.reason}</td>
                    <td className="py-2.5 text-slate-500 font-medium">{ev.access_count ?? 1}</td>
                    <td className="py-2.5 text-right font-mono text-slate-400">
                      {ev.evicted_at ? ev.evicted_at.split('T')[1]?.split('.')[0] : '-'}
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
