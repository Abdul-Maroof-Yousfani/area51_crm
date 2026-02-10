import React, { useState } from 'react';
import { Loader, Lock, UserPlus, AlertCircle, LogOut, ArrowLeft } from 'lucide-react';

export default function AuthScreen({ onLogin, isLoading, authError, login, signup, logout }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Sales');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      // Auth state in useAuth will handle the rest
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signup(username, email, password, role);
      // Auth state in useAuth will handle the rest
    } catch (err) {
      if (err.message.includes('already exists')) {
        setError('An account with this email already exists. Please sign in.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized screen if user is logged in but not authorized
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="p-8 text-center bg-gradient-to-br from-red-500 to-orange-600">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-6">{authError}</p>
            <button
              onClick={handleSignOut}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out & Try Different Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-scale-in">
        {/* Header */}
        <div
          className={`p-8 text-center relative overflow-hidden ${mode === 'register'
              ? 'bg-gradient-to-br from-green-600 to-teal-700'
              : 'bg-gradient-to-br from-blue-600 to-indigo-700'
            }`}
        >
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            {mode === 'register' ? (
              <UserPlus className="w-10 h-10 text-white" />
            ) : (
              <Lock className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'register' ? 'Create Account' : 'Area 51 CRM'}
          </h1>
          <p className="text-white/70 text-sm mt-1">
            {mode === 'register' ? 'Join our platform' : 'Sign in to your account'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form
            onSubmit={mode === 'register' ? handleRegister : handleLogin}
            className="space-y-5"
          >
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    required
                    minLength={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Role
                  </label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  >
                    <option value="Admin">Admin</option>
                    <option value="Owner">Owner</option>
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg transition-all hover:shadow-xl ${mode === 'register'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-70`}
            >
              {submitting ? (
                <Loader className="w-5 h-5 animate-spin mx-auto" />
              ) : mode === 'register' ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Mode Switchers */}
          <div className="mt-6 space-y-2">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="block w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                New user? Create an account
              </button>
            )}

            {mode === 'register' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="block w-full text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
