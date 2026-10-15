import React, { useState, useEffect, useCallback } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Activity, ShieldCheck, Server, Clock } from 'lucide-react';

interface DatabaseStatusWidgetProps {
  compact?: boolean;
  onStatusChange?: (connected: boolean) => void;
}

export const DatabaseStatusWidget: React.FC<DatabaseStatusWidgetProps> = ({ compact = false, onStatusChange }) => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<{ swineCount?: number; templateCount?: number; dbVersion?: string } | null>(null);

  const testConnection = useCallback(async () => {
    setStatus('checking');
    setErrorMessage(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/admin/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const end = performance.now();
      const elapsed = Math.round(end - start);
      setLatencyMs(elapsed);
      setLastChecked(new Date().toLocaleTimeString());

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // non-json response
      }

      if (res.ok && data?.success) {
        setStatus('connected');
        setDetails({
          swineCount: data.swineCount,
          templateCount: data.templateCount,
          dbVersion: data.dbVersion || 'PostgreSQL / Supabase',
        });
        onStatusChange?.(true);
      } else {
        // Fallback check certificate templates API
        const tplRes = await fetch('/api/module-data/certificate_templates');
        if (tplRes.ok) {
          const tplData = await tplRes.json();
          setStatus('connected');
          setDetails({
            templateCount: Array.isArray(tplData.data) ? tplData.data.length : undefined,
            dbVersion: 'PostgreSQL (via API)',
          });
          onStatusChange?.(true);
        } else {
          setStatus('error');
          setErrorMessage(data?.message || data?.error || `Server status ${res.status}`);
          onStatusChange?.(false);
        }
      }
    } catch (err: any) {
      // Fallback check module-data
      try {
        const tplRes = await fetch('/api/module-data/certificate_templates');
        const end = performance.now();
        setLatencyMs(Math.round(end - start));
        setLastChecked(new Date().toLocaleTimeString());

        if (tplRes.ok) {
          setStatus('connected');
          setDetails({ dbVersion: 'PostgreSQL (API Fallback)' });
          onStatusChange?.(true);
          return;
        }
      } catch {
        // ignore
      }

      setStatus('error');
      setErrorMessage(err?.message || 'Network error connecting to backend');
      setLastChecked(new Date().toLocaleTimeString());
      onStatusChange?.(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    testConnection();
    const interval = setInterval(testConnection, 60000); // check every 60s
    return () => clearInterval(interval);
  }, [testConnection]);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-stone-200 shadow-2xs text-xs">
        <span className="relative flex h-2.5 w-2.5">
          {status === 'checking' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
          {status === 'connected' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
          {status === 'error' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-amber-500'
          }`} />
        </span>
        <span className="font-bold text-stone-700">
          {status === 'connected' ? 'Supabase Connected' : status === 'error' ? 'DB Error' : 'Checking DB...'}
        </span>
        {latencyMs !== null && status === 'connected' && (
          <span className="text-[10px] text-stone-400 font-mono">({latencyMs}ms)</span>
        )}
        <button
          onClick={testConnection}
          disabled={status === 'checking'}
          className="p-1 text-stone-400 hover:text-stone-700 transition rounded-lg hover:bg-stone-100 cursor-pointer disabled:opacity-50"
          title="Refresh database connection status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 rounded-xl ${
            status === 'connected' ? 'bg-emerald-50 text-emerald-700' : status === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {status === 'connected' ? <CheckCircle2 className="w-5 h-5" /> : status === 'error' ? <AlertTriangle className="w-5 h-5" /> : <RefreshCw className="w-5 h-5 animate-spin" />}
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900">Supabase Database Connection Diagnostic</h3>
            <p className="text-xs text-stone-500">Live communication status with the backend PostgreSQL database.</p>
          </div>
        </div>
        <button
          onClick={testConnection}
          disabled={status === 'checking'}
          className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
          <span>Test Now</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-stone-400" /> Status
          </p>
          <p className={`text-sm font-black mt-1 ${
            status === 'connected' ? 'text-emerald-700' : status === 'error' ? 'text-rose-700' : 'text-amber-700'
          }`}>
            {status === 'connected' ? 'Connected & Operational' : status === 'error' ? 'Connection Error' : 'Checking Connection...'}
          </p>
        </div>

        <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-stone-400" /> Latency
          </p>
          <p className="text-sm font-black text-stone-900 mt-1 font-mono">
            {latencyMs !== null ? `${latencyMs} ms` : '—'}
          </p>
        </div>

        <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-100">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-stone-400" /> Last Checked
          </p>
          <p className="text-sm font-black text-stone-900 mt-1">
            {lastChecked || 'Just now'}
          </p>
        </div>
      </div>

      {status === 'connected' && details && (
        <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-emerald-950">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Backend Database Operational Summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            {details.swineCount !== undefined && (
              <div>Swine Records: <span className="font-bold">{details.swineCount}</span></div>
            )}
            {details.templateCount !== undefined && (
              <div>Certificate Templates: <span className="font-bold">{details.templateCount}</span></div>
            )}
            <div>Database Engine: <span className="font-bold">{details.dbVersion}</span></div>
          </div>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-rose-950">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Connection Diagnostic Failed
          </p>
          <p className="font-mono text-[11px] text-rose-800 break-all bg-white/60 p-2 rounded-lg border border-rose-100">
            {errorMessage}
          </p>
          <p className="text-[11px] text-rose-700 pt-0.5">
            Please verify your Supabase database credentials or DATABASE_URL environment configuration.
          </p>
        </div>
      )}
    </div>
  );
};
