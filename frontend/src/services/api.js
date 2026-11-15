import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard/metrics').then(res => res.data.data),
};

export const simulationApi = {
  start: () => api.post('/simulation/start').then(res => res.data),
  pause: () => api.post('/simulation/pause').then(res => res.data),
  resume: () => api.post('/simulation/resume').then(res => res.data),
  stop: () => api.post('/simulation/stop').then(res => res.data),
  reset: () => api.post('/simulation/reset').then(res => res.data),
  step: (batchSize = 10) => api.post('/simulation/step', { batch_size: batchSize }).then(res => res.data),
  configure: (config) => api.post('/simulation/config', config).then(res => res.data),
  getStatus: () => api.get('/simulation/status').then(res => res.data.data),
  saveSnapshot: (name) => api.post('/simulation/save', { name }).then(res => res.data),
  getHistory: () => api.get('/simulation/history').then(res => res.data.data),
  deleteRun: (id) => api.delete(`/simulation/history/${id}`).then(res => res.data),
  getExportUrl: () => '/api/simulation/history/export',
};

export const serverApi = {
  getServers: () => api.get('/servers').then(res => res.data.data),
  toggleServer: (serverId) => api.post('/servers/toggle', { server_id: serverId }).then(res => res.data),
  toggleAutoScale: (enabled) => api.post('/servers/auto-scale', { enabled }).then(res => res.data),
  resetOverrides: () => api.post('/servers/reset-overrides').then(res => res.data),
};

export const cacheApi = {
  getCache: (serverId = 'RS1') => api.get(`/cache?server_id=${serverId}`).then(res => res.data.data),
  getStatistics: () => api.get('/cache/statistics').then(res => res.data.data),
  setAlgorithm: (algorithm) => api.post('/cache/algorithm', { algorithm }).then(res => res.data),
  clearCache: (serverId = null) => api.post('/cache/clear', { server_id: serverId }).then(res => res.data),
};

export const predictionApi = {
  train: (nEstimators = 100) => api.post('/prediction/train', { n_estimators: nEstimators }).then(res => res.data),
  getResults: () => api.get('/prediction/results').then(res => res.data.data),
  getStatus: () => api.get('/prediction/status').then(res => res.data.data),
};

export const optimizationApi = {
  run: (params) => api.post('/optimization/run', params).then(res => res.data),
  getResults: () => api.get('/optimization/results').then(res => res.data.data),
  applyPlan: (serverPlan) => api.post('/optimization/apply', { server_plan: serverPlan }).then(res => res.data),
};

export const datasetApi = {
  generate: (params) => api.post('/dataset/generate', params).then(res => res.data),
  preview: (path = null) => api.get(`/dataset/preview${path ? `?path=${encodeURIComponent(path)}` : ''}`).then(res => res.data.data),
  upload: (formData) => api.post('/dataset/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data),
  getDownloadUrl: (path = null) => `/api/dataset/download${path ? `?path=${encodeURIComponent(path)}` : ''}`,
};

export const comparisonApi = {
  run: (params) => api.post('/comparison/run', params).then(res => res.data.data),
  getResults: () => api.get('/comparison/results').then(res => res.data.data),
};

export default api;
