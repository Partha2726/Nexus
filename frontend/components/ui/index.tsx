import React from 'react';

export function LoadingSpinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 36,
  };
  const px = sizeMap[size];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <svg
        style={{
          width: px,
          height: px,
          animation: 'spin 1s linear infinite',
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="3"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px dashed var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        gap: 16,
      }}
    >
      {icon && <div style={{ fontSize: 32, color: 'var(--text-muted)' }}>{icon}</div>}
      <div style={{ maxWidth: 400 }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function ErrorAlert({
  title = 'Operation Failed',
  message,
  errorCode,
  requestId,
  onRetry,
  onDismiss,
}: {
  title?: string;
  message: string;
  errorCode?: string;
  requestId?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const isStale = errorCode === 'STALE_VERSION';

  return (
    <div
      style={{
        padding: '16px 20px',
        background: isStale ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 63, 94, 0.1)',
        border: `1px solid ${isStale ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        margin: '12px 0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.125rem' }}>{isStale ? '⚠️' : '🚨'}</span>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: isStale ? '#fbbf24' : '#fb7185' }}>
            {isStale ? 'Concurrency Conflict (Stale Version)' : title}
          </span>
          {errorCode && (
            <span style={{ fontSize: '0.75rem', padding: '1px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontFamily: 'monospace' }}>
              {errorCode}
            </span>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        )}
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>
        {message}
      </p>

      {requestId && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          Request ID: {requestId}
        </span>
      )}

      {onRetry && (
        <div style={{ marginTop: 4 }}>
          <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={onRetry}>
            🔄 Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 650,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.25rem',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
