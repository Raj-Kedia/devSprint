import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, error } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError(null);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
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

        {/* Form Tab */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 mb-3 text-xs">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 pb-2 font-medium cursor-pointer ${
              !isRegister
                ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white'
                : 'text-zinc-400 dark:text-zinc-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 pb-2 font-medium cursor-pointer ${
              isRegister
                ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white'
                : 'text-zinc-400 dark:text-zinc-500'
            }`}
          >
            Create Account
          </button>
        </div>

        {(localError || error) && (
          <div className="mb-3 p-2 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {localError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {isRegister && (
            <div>
              <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-zinc-950 font-medium text-xs transition-colors mt-2 cursor-pointer"
          >
            {isSubmitting ? '...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
