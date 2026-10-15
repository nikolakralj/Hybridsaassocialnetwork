import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  PASSWORD_RESET_SENT_MESSAGE,
  validateNewPassword,
} from '../../utils/auth/password-recovery';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    passwordRecovery,
    recoveryError,
    requestPasswordReset,
    updatePassword,
    dismissPasswordRecovery,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);

  const skip = () => {
    dismissPasswordRecovery();
    navigate(user ? '/app/project-workspace' : '/', { replace: true });
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const validationError = validateNewPassword(password, confirm);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      navigate('/app/project-workspace', { replace: true });
    } catch (err: any) {
      setFormError(err.message || 'Could not update password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    setSendError('');
    if (!resetEmail.trim()) {
      setSendError('Enter your email address.');
      return;
    }
    setSending(true);
    try {
      await requestPasswordReset(resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setSendError(err.message || 'Could not send a reset email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canSetPassword = passwordRecovery && Boolean(user) && !recoveryError;
  const recoveryAttemptFailed = passwordRecovery && !canSetPassword;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-[0_1px_3px_0_rgb(0_0_0/0.04)] p-6">
        <h1 className="text-xl text-center m-0">
          {canSetPassword ? 'Set new password' : recoveryAttemptFailed ? 'Reset link not valid' : 'Reset your password'}
        </h1>
        <p className="text-center text-sm text-muted-foreground mt-2 mb-0">
          {canSetPassword
            ? 'Choose a new password for your account.'
            : recoveryAttemptFailed
              ? (recoveryError || 'This reset link is invalid or has expired. Request a new email.')
              : 'Open the link in your reset email to choose a new password.'}
        </p>

        {canSetPassword ? (
          <form onSubmit={handleUpdate} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer p-0"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            {formError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive m-0">{formError}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </Button>
            <button
              type="button"
              onClick={skip}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer underline-offset-4 hover:underline"
            >
              Skip
            </button>
          </form>
        ) : recoveryAttemptFailed ? (
          <form onSubmit={handleResend} className="space-y-4 mt-6">
            {resetSent ? (
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="text-sm text-foreground m-0">{PASSWORD_RESET_SENT_MESSAGE}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@company.com"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
            )}
            {sendError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive m-0">{sendError}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={sending || resetSent}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                'Email me a new link'
              )}
            </Button>
            <button
              type="button"
              onClick={skip}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer underline-offset-4 hover:underline"
            >
              Skip
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            {requestOpen ? (
              <form onSubmit={handleResend} className="space-y-4">
                {resetSent ? (
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <p className="text-sm text-foreground m-0">{PASSWORD_RESET_SENT_MESSAGE}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@company.com"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      autoComplete="email"
                    />
                  </div>
                )}
                {sendError && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                    <p className="text-sm text-destructive m-0">{sendError}</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={sending || resetSent}>
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Email me a new link'
                  )}
                </Button>
              </form>
            ) : (
              <p className="text-center m-0">
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="text-sm text-foreground underline underline-offset-4 bg-transparent border-0 cursor-pointer p-0"
                >
                  Request a reset email
                </button>
              </p>
            )}
            <button
              type="button"
              onClick={skip}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer underline-offset-4 hover:underline"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
