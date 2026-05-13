import React, { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { IconEye, IconEyeOff } from '@/components/ui/icons';
import { useAuthStore, useNotificationStore } from '@/stores';
import { detectApiBaseFromLocation } from '@/utils/connection';
import type { ApiError } from '@/types';
import styles from './LoginPage.module.scss';

/**
 * 将 API 错误转换为本地化的用户友好消息
 */
type RedirectState = { from?: { pathname?: string } };

function getLocalizedErrorMessage(error: unknown, t: (key: string) => string): string {
  const apiError = error as Partial<ApiError>;
  const status = typeof apiError.status === 'number' ? apiError.status : undefined;
  const code = typeof apiError.code === 'string' ? apiError.code : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof apiError.message === 'string'
        ? apiError.message
        : typeof error === 'string'
          ? error
          : '';

  // 根据 HTTP 状态码判断
  if (status === 401) {
    return t('login.error_unauthorized');
  }
  if (status === 403) {
    return t('login.error_forbidden');
  }
  if (status === 404) {
    return t('login.error_not_found');
  }
  if (status && status >= 500) {
    return t('login.error_server');
  }

  // 根据 axios 错误码判断
  if (code === 'ECONNABORTED' || message.toLowerCase().includes('timeout')) {
    return t('login.error_timeout');
  }
  if (code === 'ERR_NETWORK' || message.toLowerCase().includes('network error')) {
    return t('login.error_network');
  }
  if (code === 'ERR_CERT_AUTHORITY_INVALID' || message.toLowerCase().includes('certificate')) {
    return t('login.error_ssl');
  }

  // 检查 CORS 错误
  if (message.toLowerCase().includes('cors') || message.toLowerCase().includes('cross-origin')) {
    return t('login.error_cors');
  }

  // 默认错误消息
  return t('login.error_invalid');
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotificationStore();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const login = useAuthStore(state => state.login);
  const restoreSession = useAuthStore(state => state.restoreSession);
  const storedBase = useAuthStore(state => state.apiBase);
  const storedKey = useAuthStore(state => state.managementKey);
  const storedRememberPassword = useAuthStore(state => state.rememberPassword);

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoLoginSuccess, setAutoLoginSuccess] = useState(false);
  const [error, setError] = useState('');

  const detectedBase = detectApiBaseFromLocation();

  useEffect(() => {
    const init = async () => {
      try {
        const autoLoggedIn = await restoreSession();
        if (autoLoggedIn) {
          setAutoLoginSuccess(true);
          // 延迟跳转，让用户看到成功动画
          setTimeout(() => {
            const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
            navigate(redirect, { replace: true });
          }, 1500);
        } else {
          setAccount(storedBase || 'admin');
          setPassword(storedKey || '');
          setRememberPassword(storedRememberPassword || Boolean(storedKey));
        }
      } finally {
        if (!autoLoginSuccess) {
          setAutoLoading(false);
        }
      }
    };

    init();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!account.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login({
        apiBase: storedBase || detectedBase,
        managementKey: password.trim(),
        rememberPassword
      });
      showNotification(t('common.connected_status'), 'success');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = getLocalizedErrorMessage(err, t);
      setError(message);
      showNotification(`${t('notification.login_failed')}: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [account, detectedBase, login, navigate, password, rememberPassword, showNotification, storedBase, t]);

  const handleSubmitKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !loading) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [loading, handleSubmit]
  );

  if (isAuthenticated && !autoLoading && !autoLoginSuccess) {
    const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
    return <Navigate to={redirect} replace />;
  }

  // 显示启动动画（自动登录中或自动登录成功）
  const showSplash = autoLoading || autoLoginSuccess;

  return (
    <div className={styles.container}>
      {/* 左侧品牌展示区 */}
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <span className={styles.brandWord}>CLI</span>
          <span className={styles.brandWord}>PROXY</span>
          <span className={styles.brandWord}>API</span>
        </div>
      </div>

      {/* 右侧功能交互区 */}
      <div className={styles.formPanel}>
        {showSplash ? (
          /* 启动动画 */
          <div className={styles.splashContent}>
            <AgentGatewayLoginLogo className={styles.splashLogo} />
            <h1 className={styles.splashTitle}>Agent Gateway</h1>
            <p className={styles.splashSubtitle}>正在恢复管理会话</p>
            <div className={styles.splashLoader}>
              <div className={styles.splashLoaderBar} />
            </div>
          </div>
        ) : (
          /* 登录表单 */
          <div className={styles.formContent}>
            <AgentGatewayLoginLogo className={styles.logo} />

            {/* 登录表单卡片 */}
            <div className={styles.loginCard}>
              <div className={styles.loginHeader}>
                <div className={styles.title}>Agent Gateway Management Center</div>
                <div className={styles.subtitle}>请输入账号和密码以访问管理界面</div>
              </div>

              <Input
                autoFocus
                label="账号:"
                placeholder="请输入账号"
                value={account}
                onChange={e => setAccount(e.target.value)}
                onKeyDown={handleSubmitKeyDown}
              />

              <Input
                label="密码:"
                placeholder="请输入密码"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleSubmitKeyDown}
                rightElement={
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={
                      showPassword
                        ? t('login.hide_key', { defaultValue: '隐藏密码' })
                        : t('login.show_key', { defaultValue: '显示密码' })
                    }
                    title={
                      showPassword
                        ? t('login.hide_key', { defaultValue: '隐藏密码' })
                        : t('login.show_key', { defaultValue: '显示密码' })
                    }
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                }
              />

              <div className={styles.toggleAdvanced}>
                <SelectionCheckbox
                  checked={rememberPassword}
                  onChange={setRememberPassword}
                  ariaLabel={t('login.remember_password_label')}
                  label={t('login.remember_password_label')}
                  labelClassName={styles.toggleLabel}
                />
              </div>

              <Button fullWidth onClick={handleSubmit} loading={loading}>
                {loading ? t('login.submitting') : t('login.submit_button')}
              </Button>

              {error && <div className={styles.errorBox}>{error}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentGatewayLoginLogo({ className }: { className?: string }) {
  return (
    <svg className={`${styles.logoMark} ${className ?? ''}`} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="agentGatewayLoginGradient" x1="8" x2="56" y1="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#19b9ca" />
          <stop offset="1" stopColor="#f1df32" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" />
      <path d="M32 10 51 21v22L32 54 13 43V21z" />
      <path d="M32 18v28" />
      <path d="M20 25 32 18l12 7" />
      <path d="M20 39 32 46l12-7" />
      <circle cx="32" cy="32" r="6" />
    </svg>
  );
}
