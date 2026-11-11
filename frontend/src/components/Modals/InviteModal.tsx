import React, { useState } from 'react';
import { X, Copy, Check, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { inviteMember, activeTeam } = useAuthStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setStatusBanner(null);
    try {
      const res = await inviteMember(trimmedEmail, role);
      setEmail('');
      if (res?.email_sent) {
        setStatusBanner({
          type: 'success',
          text: `Invitation email with login details sent to ${trimmedEmail}.`,
        });
        setTimeout(() => {
          setStatusBanner(null);
          onClose();
        }, 1800);
      } else {
        setStatusBanner({
          type: 'warning',
          text: `${trimmedEmail} was added to ${activeTeam?.name || 'the workspace'}, but SMTP email is not configured on the server so no email was sent.`,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to invite teammate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inviteLink = `${window.location.origin}/?team=${activeTeam?.id || 1}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-zinc-500" />
            Invite Teammate
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusBanner && (
          <div
            className={`mb-4 p-2.5 rounded-md border text-xs font-medium ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}
          >
            {statusBanner.text}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="developer@company.com"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="w-full py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
            Or share link:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-400 font-mono select-all"
            />
            <button
              onClick={copyLink}
              className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
