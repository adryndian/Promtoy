import React, { useState } from 'react';
import { Loader2, ArrowRight, Zap } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json() as { success?: boolean, user?: any, error?: string };

      if (!res.ok) throw new Error(data.error || 'Auth failed');

      if (data.success && data.user) {
        onLogin(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 p-4 font-sans dark:bg-slate-950 dark:text-white">
      {/* Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"
           style={{
             backgroundImage: `radial-gradient(at 0% 0%, rgba(249, 115, 22, 0.15) 0px, transparent 50%),
                               radial-gradient(at 100% 100%, rgba(249, 115, 22, 0.1) 0px, transparent 50%)`
           }}
      />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-8 z-10 relative overflow-hidden dark:bg-slate-900/80 dark:border-slate-800">
        {/* Top Accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600"></div>

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-50 text-orange-600 mb-4 shadow-sm border border-orange-100 dark:bg-orange-900/20 dark:border-orange-900/30 dark:text-orange-400">
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-slate-500 text-sm mt-2 dark:text-slate-400">
            {isLogin ? 'Enter your credentials to access UGC Director' : 'Start generating viral content today'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-orange-500/10"
              placeholder="name@company.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-orange-500/10"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-lg font-medium text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                {isLogin ? 'Sign In' : 'Sign Up'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-500 hover:text-orange-600 transition-colors font-medium dark:text-slate-400 dark:hover:text-orange-400"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
