import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

export type AuthModalMode =
  | 'signin'
  | 'register'
  | 'verify-pending'
  | 'forgot-password'
  | 'reset-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthModalMode;
  initialEmail?: string;
  initialResetToken?: string;
  externalNotice?: string | null;
  externalError?: string | null;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  initialEmail = '',
  initialResetToken = '',
  externalNotice = null,
  externalError = null,
}) => {
  const {
    authConfig,
    login,
    loginWithGoogle,
    register,
    resendVerification,
    forgotPassword,
    resetPassword,
  } = useAuthStore();
  const { theme } = useThemeStore();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(externalError);
  const [notice, setNotice] = useState<string | null>(externalNotice);
  const [needsVerificationResend, setNeedsVerificationResend] = useState(false);
  const [googleRendered, setGoogleRendered] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (initialResetToken) setResetToken(initialResetToken);
  }, [initialResetToken]);

  useEffect(() => {
    if (externalNotice) setNotice(externalNotice);
  }, [externalNotice]);

  useEffect(() => {
    if (externalError) setLocalError(externalError);
  }, [externalError]);

  const showGoogleSection = mode === 'signin' || mode === 'register';

  useEffect(() => {
    if (!isOpen || !showGoogleSection) {
      setGoogleRendered(false);
      return;
    }

    const clientId = authConfig?.google_client_id;
    if (!authConfig?.google_enabled || !clientId) {
      setGoogleRendered(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tryInitGoogle = () => {
      if (cancelled) return;
      const gis = window.google?.accounts?.id;
      const container = googleBtnRef.current;
      if (!gis || !container) {
        if (attempts < 25) {
          attempts += 1;
          setTimeout(tryInitGoogle, 200);
        }
        return;
      }

      container.innerHTML = '';
      gis.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;
          setIsSubmitting(true);
          setLocalError(null);
          setNotice(null);
          try {
            await loginWithGoogle(response.credential);
            onClose();
          } catch (err: any) {
            setLocalError(err.message || 'Google Sign-In failed');
          } finally {
            setIsSubmitting(false);
          }
        },
      });
      gis.renderButton(container, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        width: container.offsetWidth || 336,
        text: 'continue_with',
        shape: 'rectangular',
      });
      setGoogleRendered(true);
    };

    tryInitGoogle();
    return () => {
      cancelled = true;
    };
  }, [isOpen, showGoogleSection, authConfig, theme, loginWithGoogle, onClose]);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setLocalError(null);
    setNotice(null);
    setNeedsVerificationResend(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError(null);
    setNotice(null);
    setNeedsVerificationResend(false);

    try {
      if (mode === 'register') {
        const res = await register(name, email, password);
        setNotice(res.message);
        setPassword('');
        setMode('verify-pending');
      } else if (mode === 'signin') {
        await login(email, password);
        onClose();
      } else if (mode === 'forgot-password') {
        const res = await forgotPassword(email);
        setNotice(res.message);
      } else if (mode === 'reset-password') {
        if (password !== confirmPassword) {
          setLocalError('Passwords do not match');
          return;
        }
        const res = await resetPassword(resetToken, password);
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
        setNotice(res.message);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
      if (err.status === 403) {
        setNeedsVerificationResend(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setLocalError('Please enter your email address first.');
      return;
    }
    setIsSubmitting(true);
    setLocalError(null);
    try {
      const res = await resendVerification(email.trim());
      setNotice(res.message);
      setNeedsVerificationResend(false);
    } catch (err: any) {
      setLocalError(err.message || 'Could not resend verification email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-sm p-6 shadow-2xl transition-colors">
        {/* Brand */}
        <div className="mb-5 text-center">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold flex items-center justify-center text-sm mx-auto mb-2">
            D
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">DevSprint</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Team task & sprint tracker</p>
        </div>

        {/* Sign In / Create Account Tabs */}
        {showGoogleSection && (
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 mb-3 text-xs">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 pb-2 font-medium cursor-pointer ${
                mode === 'signin'
                  ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 pb-2 font-medium cursor-pointer ${
                mode === 'register'
                  ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Sub-view Header for Verify / Forgot / Reset */}
        {!showGoogleSection && (
          <div className="mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="p-1 -ml-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              title="Back to Sign In"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {mode === 'verify-pending' && 'Verify Your Email'}
              {mode === 'forgot-password' && 'Forgot Password'}
              {mode === 'reset-password' && 'Set New Password'}
            </span>
          </div>
        )}

        {notice && (
          <div className="mb-3 p-2.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {localError && (
          <div className="mb-3 p-2.5 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1.5">
            <div>{localError}</div>
            {needsVerificationResend && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSubmitting}
                className="underline font-medium text-rose-700 dark:text-rose-300 hover:opacity-80 cursor-pointer"
              >
                Resend verification email
              </button>
            )}
          </div>
        )}

        {/* Verify Pending View */}
        {mode === 'verify-pending' && (
          <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                We sent a verification link to <strong className="text-zinc-900 dark:text-white">{email}</strong>.
                Click the link in your inbox, then sign in.
              </div>
            </div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isSubmitting}
              className="w-full py-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 font-medium text-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Sending...' : 'Resend Verification Email'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="w-full py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-zinc-950 font-medium text-xs transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Main Auth Forms */}
        {mode !== 'verify-pending' && (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {mode === 'register' && (
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Alex Rivera"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            )}

            {(mode === 'signin' || mode === 'register' || mode === 'forgot-password') && (
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            )}

            {(mode === 'signin' || mode === 'register' || mode === 'reset-password') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-600 dark:text-zinc-400">
                    {mode === 'reset-password' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot-password')}
                      className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            )}

            {mode === 'reset-password' && (
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white disabled:opacity-50 text-white dark:text-zinc-950 font-medium text-xs transition-colors mt-2 cursor-pointer"
            >
              {isSubmitting
                ? 'Please wait...'
                : mode === 'register'
                ? 'Create Account'
                : mode === 'forgot-password'
                ? 'Send Reset Link'
                : mode === 'reset-password'
                ? 'Update Password'
                : 'Sign In'}
            </button>
          </form>
        )}

        {/* Continue with Google */}
        {showGoogleSection && (
          <div className="mt-4">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
              <span className="flex-shrink mx-3 text-[11px] text-zinc-400 dark:text-zinc-500 uppercase">
                or
              </span>
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
            </div>

            <div
              ref={googleBtnRef}
              className={googleRendered ? 'mt-1 flex justify-center min-h-[40px]' : 'hidden'}
            />

            {!googleRendered && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() =>
                  setLocalError(
                    authConfig?.google_enabled
                      ? 'Google Sign-In is still loading. Please wait a moment and try again.'
                      : 'Google Sign-In requires GOOGLE_CLIENT_ID to be set in server environment variables.'
                  )
                }
                className="mt-1 w-full py-2 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-100 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
