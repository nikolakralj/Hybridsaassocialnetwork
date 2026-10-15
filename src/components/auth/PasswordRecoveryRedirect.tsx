import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  isPasswordRecoverySuppressed,
  normalizePath,
  PASSWORD_RESET_PATH,
} from '../../utils/auth/password-recovery';

/** Sends a recovery landing (including Site URL `/`) to the set-password page. */
export function PasswordRecoveryRedirect() {
  const { passwordRecovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const active = passwordRecovery && !isPasswordRecoverySuppressed();

  useEffect(() => {
    if (!active) return;
    if (normalizePath(location.pathname) === PASSWORD_RESET_PATH) return;
    navigate(PASSWORD_RESET_PATH, { replace: true });
  }, [active, location.pathname, navigate]);

  return <Outlet />;
}
