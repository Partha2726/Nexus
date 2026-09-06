'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Project } from '../../lib/contracts';

export function Navbar({
  project,
  projects = [],
  onSelectProject,
}: {
  project?: Project | null;
  projects?: Project[];
  onSelectProject?: (id: string) => void;
}) {
  return (
    <header
      style={{
        height: 60,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link
          href="/projects"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: '1.125rem',
            letterSpacing: '-0.025em',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 0 12px rgba(2, 132, 199, 0.5)',
            }}
          >
            N
          </div>
          <span>NEXUS</span>
        </Link>

        {project && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border-color)', paddingLeft: 20 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {project.name}
            </span>
            <span
              className="badge badge-blue"
              title="Authoritative project version across all entities"
            >
              v{project.version}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/projects" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
          📁 Switch Project
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
          <span>System Active</span>
        </div>
      </div>
    </header>
  );
}

export function Sidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Overview', href: `/projects/${projectId}`, icon: '📊' },
    { label: 'AI Chat', href: `/projects/${projectId}/chat`, icon: '💬' },
    { label: 'Requirements', href: `/projects/${projectId}/requirements`, icon: '📋' },
    { label: 'Architecture & Graph', href: `/projects/${projectId}/architecture`, icon: '🕸️' },
    { label: 'Proposals', href: `/projects/${projectId}/proposals`, icon: '⚖️' },
    { label: 'Decisions (ADR)', href: `/projects/${projectId}/decisions`, icon: '📜' },
    { label: 'Tasks & Plan', href: `/projects/${projectId}/planning`, icon: '✅' },
    { label: 'Testing & QA', href: `/projects/${projectId}/testing`, icon: '🧪' },
    { label: 'Risk Analysis', href: `/projects/${projectId}/risks`, icon: '⚠️' },
    { label: 'Change Impact', href: `/projects/${projectId}/impact`, icon: '⚡' },
    { label: 'Audit Trail', href: `/projects/${projectId}/audit`, icon: '🛡️' },
  ];

  return (
    <aside
      style={{
        width: 240,
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px 8px 12px' }}>
        Project Workspace
      </div>
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== `/projects/${projectId}` && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#38bdf8' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.25)' : 'transparent'}`,
              transition: 'all 0.15s ease',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
