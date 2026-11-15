import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  BarChart2,
  Layers,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { predictionApi } from '../services/api';

export default function DemandPrediction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [trees, setTrees] = useState(100);
  const [message, setMessage] = useState(null);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await predictionApi.getResults();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    setMessage(null);
    try {
      const res = await predictionApi.train(trees);
      setMessage({
        type: 'success',
        text: `Model successfully trained! MAE: ${res.metrics.mae} reqs, RMSE: ${res.metrics.rmse} reqs, R²: ${res.metrics.r2_score}`
      });
      await fetchResults();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to train machine learning model';
      setMessage({ type: 'error', text: msg });
    } finally {
      setTraining(false);
    }
  };

  const isTrained = data?.is_trained ?? false;
  const metrics = data?.metrics || {};
  const comparison = data?.comparison || [];
  const predictions = data?.predictions || {};

  // Format feature importances for chart
  const featImportances = metrics?.feature_importances || {};
  const featData = Object.entries(featImportances).map(([k, v]) => ({
    feature: k.replace('_requests', '').replace('_', ' '),
    importance: Math.round(v * 1000) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Overview & Training Control Header */}
      <div className="card-clean p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Machine Learning Demand Prediction</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isTrained ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isTrained ? 'Model Active: RandomForestRegressor' : 'Untrained'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supervised time-series forecasting of future request density ($DRR$) per replica server using historical lag and rolling statistics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Estimators:</span>
            <input
              type="number"
              value={trees}
              onChange={(e) => setTrees(Math.max(10, Math.min(300, Number(e.target.value))))}
              className="w-14 px-1.5 py-0.5 rounded border border-slate-300 font-semibold text-center text-slate-800"
            />
          </div>

          <button
            onClick={handleTrain}
            disabled={training}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs transition-all disabled:opacity-50"
          >
            {training ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{training ? 'Fitting Trees...' : isTrained ? 'Retrain Model' : 'Train Model'}</span>
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

      {/* Model Performance Accuracy Cards (Empirical Held-Out Test Set Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">R² Coefficient of Determination</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {isTrained ? metrics.r2_score : '—'}
          </p>
          <p className="text-[11px] text-slate-400">Tested on 20% held-out test intervals</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Mean Absolute Error (MAE)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {isTrained ? `${metrics.mae} req` : '—'}
          </p>
          <p className="text-[11px] text-slate-400">Average absolute demand deviation</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Root Mean Squared Error (RMSE)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {isTrained ? `${metrics.rmse} req` : '—'}
          </p>
          <p className="text-[11px] text-slate-400">Penalizes large outlier bursts</p>
        </div>

        <div className="card-clean p-4">
          <p className="text-xs text-slate-500">Training Samples</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {isTrained ? metrics.train_samples : '—'}
          </p>
          <p className="text-[11px] text-slate-400">Time intervals ({metrics.total_samples || 0} total)</p>
        </div>
      </div>

      {/* Actual vs Predicted Demand Comparison Chart */}
      <div className="card-clean p-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Current Interval: Actual Demand vs ML Predicted Demand</h3>
            <p className="text-xs text-slate-400">Comparison across all 5 replica server regions for Hour {(data?.current_hour ?? 0)}:00 UTC</p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Requests / Interval</span>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="server_id" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="actual_demand" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Observed Actual (reqs)" />
              <Bar dataKey="predicted_demand" fill="#2563eb" radius={[4, 4, 0, 0]} name="ML Predicted Demand (DRR)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Future Demand Table & Feature Importance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Future Demand Forecast Table */}
        <div className="card-clean p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Server Next-Interval Forecast Table</h3>
              <p className="text-xs text-slate-400">Demand density predictions with confidence bounds</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium">
                  <th className="pb-2.5">Server</th>
                  <th className="pb-2.5">Region</th>
                  <th className="pb-2.5">Forecast (DRR)</th>
                  <th className="pb-2.5">Confidence Bounds</th>
                  <th className="pb-2.5 text-right">Model Deviation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparison.map((item) => (
                  <tr key={item.server_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 font-bold text-slate-900">{item.server_id}</td>
                    <td className="py-2.5 text-slate-600">{item.region}</td>
                    <td className="py-2.5 font-mono font-bold text-blue-700">
                      {item.predicted_demand} req/h
                    </td>
                    <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                      [{item.lower_bound} - {item.upper_bound}]
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.error_percent < 15
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        ±{item.error_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feature Importance Bar Chart */}
        <div className="card-clean p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Feature Importance Distribution</h3>
              <p className="text-xs text-slate-400">Relative contribution to demand prediction decisions</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">% weight</span>
          </div>

          <div className="h-60">
            {featData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="importance" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Importance %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Train model above to compute feature importances.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
