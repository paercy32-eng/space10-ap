import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function SupabaseSetupScreen({ onSetupComplete }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Basic validation
      if (!url.trim() || !anonKey.trim()) {
        throw new Error('Please enter both your Supabase Project URL and Anon Key.');
      }

      // Save to localStorage so the app remembers it
      localStorage.setItem('VITE_SUPABASE_URL', url.trim());
      localStorage.setItem('VITE_SUPABASE_ANON_KEY', anonKey.trim());

      if (onSetupComplete) {
        onSetupComplete();
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            S10
          </div>
          <h1 className="text-xl font-bold text-white">Connect Supabase</h1>
          <p className="text-slate-400 text-sm mt-1">
            Enter your Supabase project credentials to initialize Space 10.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              placeholder="https://xyzproject.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supabase Anon / Public Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Save & Initialize'}
          </button>
        </form>
      </div>
    </div>
  );
}
