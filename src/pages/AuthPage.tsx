import React, { useState } from 'react';
import {
  Loader2,
  Sun,
  Moon,
  Video,
  MessageSquare,
  Flame,
  ArrowLeft,
} from 'lucide-react';
import {
  getFriendlyAuthError,
  loginWithEmail,
  loginWithGithub,
  loginWithGoogle,
  loginWithTwitter,
  registerWithEmail,
  sendPasswordReset,
} from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { PWAInstallButton } from '@/components/ui/PWAInstallModal';

export const AuthPage: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [busy, setBusy] = useState(false);

  // Sign-In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regHandle, setRegHandle] = useState('');
  const [regAge, setRegAge] = useState('21');
  const [regGender, setRegGender] = useState('Prefer not to say');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleOAuth = async (providerFn: () => Promise<any>) => {
    if (busy) return;
    setBusy(true);
    try {
      await providerFn();
    } catch (err: any) {
      showToast(getFriendlyAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast('Please enter both your email and password.', 'error');
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      showToast(getFriendlyAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regHandle.trim() || !regEmail.trim() || !regPassword) {
      showToast('Please complete all required registration fields.', 'error');
      return;
    }
    setBusy(true);
    try {
      await registerWithEmail({
        fullName: regName,
        handle: regHandle,
        age: Number(regAge) || 18,
        gender: regGender,
        email: regEmail,
        password: regPassword,
      });
      showToast('Welcome to Trendit!', 'success');
    } catch (err: any) {
      showToast(getFriendlyAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Enter your account email address first.', 'error');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      showToast('Password reset link sent! Check your inbox.', 'success');
      setMode('signin');
    } catch (err: any) {
      showToast(getFriendlyAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090B10] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <img
            src="/icon-192.png"
            alt="Trendit"
            className="w-9 h-9 rounded-xl object-cover shadow-sm"
          />
          <span className="font-display text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-coral-500 bg-clip-text text-transparent">
            Trendit
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <span className="whitespace-nowrap shrink-0">Live Feed</span>
          <span className="whitespace-nowrap shrink-0">Stories & Reels</span>
          <span className="whitespace-nowrap shrink-0">Direct Messages</span>
          <span className="whitespace-nowrap shrink-0">HD Voice & Video</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141824] text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Split Editorial Hero + Auth Card */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Vibrant Brand Showcase */}
        <div className="lg:col-span-7 space-y-6">
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
            Social · Stories · Live Audio & Video
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white max-w-2xl [text-wrap:balance]">
            Where conversations spark and moments{' '}
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-coral-500 bg-clip-text text-transparent">
              trend live.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
            Share rich photos, reels, audio clips, and interactive polls. Connect face-to-face with
            crystal-clear Agora HD video and voice calls right inside your direct messages.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 max-w-2xl">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80">
              <Flame className="w-5 h-5 text-coral-500 mb-2" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Real-Time Feed
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Instant posts, stories, polls, and trending community tags.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80">
              <MessageSquare className="w-5 h-5 text-violet-500 mb-2" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Private DMs
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Follow-protected messaging with media sharing & call logs.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80">
              <Video className="w-5 h-5 text-blue-500 mb-2" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                HD Calling
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                One-tap Agora RTC voice and video calls across networks.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white dark:bg-[#11141D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40">
            {mode === 'reset' ? (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Reset Password
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Enter your Trendit email address and we will send you a password reset link.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Send Reset Link</span>
                </button>
              </form>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    Happening now
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Join Trendit or sign in to your account
                  </p>
                </div>

                {/* OAuth Providers (Google, GitHub, X/Twitter preserved) */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleOAuth(loginWithGoogle)}
                    className="w-full min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171B26] hover:bg-slate-50 dark:hover:bg-[#1E2332] text-slate-900 dark:text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.86 2.07-1.83 2.71v2.26h2.97c1.74-1.6 2.66-3.95 2.66-6.62z"
                      />
                      <path
                        fill="#34A853"
                        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.97-2.26c-.81.54-1.85.86-2.99.86-2.31 0-4.27-1.56-4.97-3.65H1.01v2.33C2.53 16.02 5.53 18 9 18z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M4.03 10.77c-.18-.54-.28-1.12-.28-1.77s.1-1.23.28-1.77V4.9H1.01C.37 6.18 0 7.63 0 9.2s.37 3.02 1.01 4.3l3.02-2.33z"
                      />
                      <path
                        fill="#EA4335"
                        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.43 0 9 0 5.53 0 2.53 1.98 1.01 4.9l3.02 2.33c.7-2.09 2.66-3.65 4.97-3.65z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleOAuth(loginWithGithub)}
                      className="min-h-[44px] px-3 rounded-xl bg-[#24292e] hover:bg-[#1b1f23] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                      <span>GitHub</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleOAuth(loginWithTwitter)}
                      className="min-h-[44px] px-3 rounded-xl bg-black hover:bg-neutral-900 text-white border border-slate-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X / Twitter</span>
                    </button>
                  </div>
                </div>

                <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  <span>or with email</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>

                {/* Segmented Sign In / Register Switch */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0E15] mb-4">
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                      mode === 'signin'
                        ? 'bg-white dark:bg-[#1A2030] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                      mode === 'register'
                        ? 'bg-white dark:bg-[#1A2030] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {mode === 'signin' ? (
                  <form onSubmit={handleSignInSubmit} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      autoComplete="email"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setMode('reset')}
                        className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold shadow-md shadow-violet-600/20 flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                    >
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Sign In</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Full Name"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                      <input
                        type="text"
                        value={regHandle}
                        onChange={(e) => setRegHandle(e.target.value)}
                        placeholder="Handle (e.g. coolcoder)"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="number"
                        min={13}
                        max={120}
                        value={regAge}
                        onChange={(e) => setRegAge(e.target.value)}
                        placeholder="Age"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                      <select
                        value={regGender}
                        onChange={(e) => setRegGender(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Email address"
                      autoComplete="email"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create Password (6+ characters)"
                      autoComplete="new-password"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold shadow-md shadow-violet-600/20 flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                    >
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Create Account</span>
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quiet Footer */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-4 text-xs text-slate-500 dark:text-slate-500 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 dark:border-slate-800/60">
        <span>© {new Date().getFullYear()} Trendit Social</span>
        <span>Web · Android · PWA</span>
      </footer>
    </div>
  );
};
