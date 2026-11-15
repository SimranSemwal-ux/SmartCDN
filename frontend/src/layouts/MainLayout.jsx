import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Server,
  Layers,
  TrendingUp,
  Sliders,
  GitCompare,
  Database,
  History,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Bell,
  Cpu,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';
import { simulationApi } from '../services/api';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/simulation', label: 'Live Simulation', icon: Activity },
  { path: '/servers', label: 'Server Management', icon: Server },
  { path: '/cache', label: 'Cache Management', icon: Layers },
  { path: '/prediction', label: 'Demand Prediction', icon: TrendingUp },
  { path: '/optimization', label: 'Cost Optimization', icon: Sliders },
  { path: '/comparison', label: 'Algorithm Comparison', icon: GitCompare },
  { path: '/dataset', label: 'Dataset Management', icon: Database },
  { path: '/history', label: 'Simulation History', icon: History },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [simState, setSimState] = useState({ state: 'IDLE', speed_multiplier: 1.0, algorithm: 'Adaptive Cost-aware' });
  const [loadingAction, setLoadingAction] = useState(false);
  const location = useLocation();

  const fetchStatus = async () => {
    try {
      const data = await simulationApi.getStatus();
      setSimState(data);
    } catch (err) {
      // Backend not yet reachable or offline
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoadingAction(true);
    try {
      await simulationApi.start();
      await fetchStatus();
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePause = async () => {
    setLoadingAction(true);
    try {
      await simulationApi.pause();
      await fetchStatus();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReset = async () => {
    setLoadingAction(true);
    try {
      await simulationApi.reset();
      await fetchStatus();
    } finally {
      setLoadingAction(false);
    }
  };

  const currentRouteName = NAV_ITEMS.find(item => item.path === location.pathname)?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-800">
      {/* Sidebar for Desktop */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-200/90 bg-white transition-all duration-300 z-30 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 tracking-tight text-lg leading-tight">SmartCDN</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">IEEE 2025 Platform</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/80 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  } ${collapsed ? 'justify-center px-0' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${location.pathname === item.path ? 'text-blue-600' : 'text-slate-500'}`} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Engine status indicator & user footer */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/50">
          {!collapsed && (
            <div className="mb-2 p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium">CDN Simulator</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${
                  simState.state === 'RUNNING' ? 'text-emerald-600' : simState.state === 'PAUSED' ? 'text-amber-600' : 'text-slate-500'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    simState.state === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : simState.state === 'PAUSED' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                  {simState.state}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Algorithm: <span className="font-medium text-slate-700">{simState.algorithm}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3 p-1">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
              SS
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-800 truncate">Simran Semwal</span>
                <span className="text-[10px] text-slate-400 truncate">simransemwal@ux</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {currentRouteName}
            </h1>
          </div>

          {/* Quick Simulation Bar in Top Header */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Simulation Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700">
              <span className={`w-2 h-2 rounded-full ${
                simState.state === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : simState.state === 'PAUSED' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              <span>Status: <strong className="font-semibold">{simState.state}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Speed: <strong>{simState.speed_multiplier}x</strong></span>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {simState.state !== 'RUNNING' ? (
                <button
                  onClick={handleStart}
                  disabled={loadingAction}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                  title="Start live simulation"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Start</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  disabled={loadingAction}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-xs transition-colors"
                  title="Pause simulation"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Pause</span>
                </button>
              )}

              <button
                onClick={handleReset}
                disabled={loadingAction}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                title="Reset simulation state"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>

            {/* Notification bell */}
            <div className="relative">
              <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
            <div className="relative flex flex-col w-72 bg-white h-full shadow-2xl z-10">
              <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900">SmartCDN</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                          isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Routed Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
