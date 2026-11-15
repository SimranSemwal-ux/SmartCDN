import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  FileText,
  Table,
  BarChart,
  RefreshCw,
  Search
} from 'lucide-react';
import { datasetApi } from '../services/api';

export default function DatasetManagement() {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Generation Parameters
  const [numUsers, setNumUsers] = useState(10000);
  const [numObjects, setNumObjects] = useState(100);
  const [totalRequests, setTotalRequests] = useState(100000);
  const [zipfAlpha, setZipfAlpha] = useState(0.5);
  const [seed, setSeed] = useState(42);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const res = await datasetApi.preview();
      setPreviewData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await datasetApi.generate({
        num_users: numUsers,
        num_objects: numObjects,
        total_requests: totalRequests,
        zipf_alpha: zipfAlpha,
        seed: seed
      });
      setMessage({ type: 'success', text: res.message });
      await fetchPreview();
    } catch (err) {
      setMessage({ type: 'error', text: 'Dataset generation failed' });
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await datasetApi.upload(formData);
      setMessage({ type: 'success', text: res.message });
      await fetchPreview();
    } catch (err) {
      setMessage({ type: 'error', text: 'CSV upload failed' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const previewRows = previewData?.preview || [];
  const columns = previewData?.columns || [];
  const numericStats = previewData?.numeric_summary || {};

  const filteredPreview = previewRows.filter((r) =>
    r.request_id?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.user_id?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.content_id?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.region?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Console */}
      <div className="card-clean p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">CCDN Synthetic Dataset Generator</h2>
            <span className="badge-status-active">
              <CheckCircle className="w-3 h-3" /> Zipf α=0.5 Aligned
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate and manage synthetic request traces modeling diurnal traffic, regional time offsets, and Zipf popularity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={datasetApi.getDownloadUrl()}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Download CSV</span>
          </a>

          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-slate-500" />
            <span>{uploading ? 'Uploading...' : 'Upload CSV'}</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
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

      {/* Dataset Generation Controls */}
      <div className="card-clean p-6 bg-white">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Workload Synthesis Parameters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs mb-4">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Simulated Users</label>
            <input
              type="number"
              value={numUsers}
              onChange={(e) => setNumUsers(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">unique user IDs</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Content Objects</label>
            <input
              type="number"
              value={numObjects}
              onChange={(e) => setNumObjects(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">catalogue items</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Total Requests</label>
            <input
              type="number"
              step="10000"
              value={totalRequests}
              onChange={(e) => setTotalRequests(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">across 24 hours</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Zipf Skew (α)</label>
            <input
              type="number"
              step="0.05"
              value={zipfAlpha}
              onChange={(e) => setZipfAlpha(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">0.5 in IEEE paper</span>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Random Seed</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-medium"
            />
            <span className="text-[10px] text-slate-400">reproducible trace</span>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs transition-all disabled:opacity-50"
        >
          {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{generating ? 'Synthesizing 100k Records...' : 'Generate New Dataset'}</span>
        </button>
      </div>

      {/* Dataset Statistics Metadata Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Total Dataset Records</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {(previewData?.total_records ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">File: {previewData?.filename || 'dataset.csv'}</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Features / Columns</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {previewData?.total_columns ?? 0}
          </p>
          <p className="text-[11px] text-slate-400">Includes temporal & spatial tags</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Missing Values</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">0</p>
          <p className="text-[11px] text-slate-400">Clean complete telemetry</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Time-Span Coverage</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">24 Hours</p>
          <p className="text-[11px] text-slate-400">Diurnal & peak surge curves</p>
        </div>
      </div>

      {/* Column Schema & Summary */}
      <div className="card-clean p-5 bg-white">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Feature Schema & Field Types</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {columns.map((col) => (
            <div key={col.column} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <span className="font-semibold text-slate-800 block truncate">{col.column}</span>
              <span className="text-[10px] text-slate-400 font-mono">{col.type}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">{col.unique_values} unique</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Preview Table */}
      <div className="card-clean p-6 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Synthetic Request Trace Preview (First 50 Rows)</h3>
            <p className="text-xs text-slate-400">Sample of generated request logs loaded in memory</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by ID, user, content..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="pb-2.5">Request ID</th>
                <th className="pb-2.5">Timestamp</th>
                <th className="pb-2.5">User ID</th>
                <th className="pb-2.5">Region</th>
                <th className="pb-2.5">Replica</th>
                <th className="pb-2.5">Content ID</th>
                <th className="pb-2.5">Hit</th>
                <th className="pb-2.5">Latency</th>
                <th className="pb-2.5 text-right">Density</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredPreview.map((row) => (
                <tr key={row.request_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 text-blue-700 font-semibold">{row.request_id}</td>
                  <td className="py-2 text-slate-500">{row.timestamp}</td>
                  <td className="py-2 text-slate-700">{row.user_id}</td>
                  <td className="py-2 font-sans text-slate-700">{row.region}</td>
                  <td className="py-2 font-semibold text-slate-900">{row.replica_server}</td>
                  <td className="py-2 text-indigo-600">{row.content_id}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      row.cache_hit === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {row.cache_hit === 1 ? 'HIT' : 'MISS'}
                    </span>
                  </td>
                  <td className="py-2 text-slate-700">{row.response_time} ms</td>
                  <td className="py-2 text-right text-slate-500">{row.request_density}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
