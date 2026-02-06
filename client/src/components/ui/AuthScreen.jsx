import React, { useState } from 'react';
import { Loader, Lock, Database, UserPlus, AlertCircle, LogOut, KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, appId } from '../../lib/firebase';

export default function AuthScreen({ onLogin, isLoading, authError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login', 'register', 'initialize', 'forgot'
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state listener in useAuth will handle the rest
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please register first.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Check if email is in allowed_users first
      const allowedRef = doc(db, 'artifacts', appId, 'public', 'data', 'allowed_users', email);
      const allowedSnap = await getDoc(allowedRef);

      if (!allowedSnap.exists()) {
        setError('This email is not authorized. Please contact your administrator to be added.');
        setSubmitting(false);
        return;
      }

      // Create the account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with name
      await updateProfile(user, { displayName: name });

      // Create system_users record
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system_users', user.uid), {
        email,
        name,
        role: allowedSnap.data().role || 'Sales',
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      // Update allowed_users with name if not set
      if (!allowedSnap.data().name) {
        await setDoc(allowedRef, { name }, { merge: true });
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitialize = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Check if already initialized
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config');
      const configSnap = await getDoc(configRef);

      if (configSnap.exists() && configSnap.data().initialized) {
        setError('System is already initialized. Please sign in.');
        setMode('login');
        setSubmitting(false);
        return;
      }

      // Create the master admin account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });

      // Create system_users record
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system_users', user.uid), {
        email,
        name,
        role: 'Owner',
        uid: user.uid,
        createdAt: serverTimestamp(),
        isMasterAdmin: true
      });

      // Add to allowed_users
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'allowed_users', email), {
        email,
        name,
        role: 'Owner',
        addedBy: 'System',
        addedAt: serverTimestamp()
      });

      // Mark system as initialized
      await setDoc(configRef, {
        initialized: true,
        initializedAt: serverTimestamp(),
        initializedBy: email
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setResetSent(false);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
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
          className={`p-8 text-center relative overflow-hidden ${
            mode === 'initialize'
              ? 'bg-gradient-to-br from-purple-600 to-indigo-700'
              : mode === 'register'
              ? 'bg-gradient-to-br from-green-600 to-teal-700'
              : mode === 'forgot'
              ? 'bg-gradient-to-br from-amber-500 to-orange-600'
              : 'bg-gradient-to-br from-blue-600 to-indigo-700'
          }`}
        >
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            {mode === 'initialize' ? (
              <Database className="w-10 h-10 text-white" />
            ) : mode === 'register' ? (
              <UserPlus className="w-10 h-10 text-white" />
            ) : mode === 'forgot' ? (
              <KeyRound className="w-10 h-10 text-white" />
            ) : (
              <Lock className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'initialize'
              ? 'System Setup'
              : mode === 'register'
              ? 'Create Account'
              : mode === 'forgot'
              ? 'Reset Password'
              : 'Area 51 CRM'}
          </h1>
          <p className="text-white/70 text-sm mt-1">
            {mode === 'initialize'
              ? 'Create the master admin account'
              : mode === 'register'
              ? 'Your email must be pre-authorized'
              : mode === 'forgot'
              ? "We'll send you a reset link"
              : 'Sign in to your account'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          {/* Forgot Password - Success State */}
          {mode === 'forgot' && resetSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Check Your Email</h3>
              <p className="text-gray-600 text-sm mb-6">
                We've sent a password reset link to <strong>{email}</strong>.
                Check your inbox and follow the instructions.
              </p>
              <button
                onClick={() => {
                  setMode('login');
                  setResetSent(false);
                  setError('');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>
            </div>
          ) : (
            <form
              onSubmit={
                mode === 'initialize'
                  ? handleInitialize
                  : mode === 'register'
                  ? handleRegister
                  : mode === 'forgot'
                  ? handleForgotPassword
                  : handleLogin
              }
              className="space-y-5"
            >
              {(mode === 'register' || mode === 'initialize') && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
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
              {mode !== 'forgot' && (
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
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg transition-all hover:shadow-xl ${
                  mode === 'initialize'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : mode === 'register'
                    ? 'bg-green-600 hover:bg-green-700'
                    : mode === 'forgot'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-70`}
              >
                {submitting ? (
                  <Loader className="w-5 h-5 animate-spin mx-auto" />
                ) : mode === 'initialize' ? (
                  'Initialize System'
                ) : mode === 'register' ? (
                  'Create Account'
                ) : mode === 'forgot' ? (
                  'Send Reset Link'
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          {/* Mode Switchers */}
          {!(mode === 'forgot' && resetSent) && (
            <div className="mt-6 space-y-2">
              {mode === 'login' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                    }}
                    className="block w-full text-sm text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Forgot your password?
                  </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      setMode('initialize');
                      setError('');
                    }}
                    className="block w-full text-xs text-gray-400 hover:text-gray-600"
                  >
                    First time setup? Initialize system
                  </button>
                </>
              )}

              {mode === 'register' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="block w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Already have an account? Sign in
                </button>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="block w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to login
                </button>
              )}

              {mode === 'initialize' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="block w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  Back to login
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
