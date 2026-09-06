'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConversationMessage, Proposal } from '../../lib/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { ErrorAlert, LoadingSpinner } from '../ui';
import { ProposalCard } from '../proposals/ProposalCard';

export function ChatView({
  projectId,
  initialConversationId,
}: {
  projectId: string;
  initialConversationId?: string;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);
  const [unresolvedQuestions, setUnresolvedQuestions] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingProposals, unresolvedQuestions, isLoading]);

  // Load existing conversation history if conversationId is provided
  useEffect(() => {
    if (conversationId) {
      apiClient
        .getConversationHistory(projectId, conversationId)
        .then((history) => {
          setMessages(history.messages || []);
        })
        .catch((err) => {
          console.error('Failed to load conversation history:', err);
        });
    }
  }, [projectId, conversationId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isLoading) return;

    setError(null);
    setInputMessage('');
    setIsLoading(true);

    // Optimistically append user message to UI
    const tempUserMsg: ConversationMessage = {
      messageId: `temp-${Date.now()}`,
      conversationId: conversationId || '',
      projectId,
      role: 'user',
      content: text,
      proposalIds: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await apiClient.sendChatMessage(projectId, {
        conversationId,
        message: text,
      });

      if (!conversationId && response.conversationId) {
        setConversationId(response.conversationId);
      }

      // Append assistant response
      const assistantMsg: ConversationMessage = {
        messageId: response.messageId,
        conversationId: response.conversationId,
        projectId,
        role: 'assistant',
        content: response.response,
        proposalIds: (response.proposals || []).map((p) => p.proposalId),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setPendingProposals(response.proposals || []);
      setUnresolvedQuestions(response.unresolvedQuestions || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'CHAT_ERROR', err?.message || 'Failed to send chat message'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* Chat Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.25rem' }}>🤖</span>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              NEXUS Multi-Agent Engineering Assistant
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Intent-routed specialist agents with deterministic proposal generation.
            </p>
          </div>
        </div>
        {conversationId && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            ID: {conversationId.slice(0, 8)}...
          </span>
        )}
      </div>

      {/* Message Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {messages.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', margin: 'auto', maxWidth: 460 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💡</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8 }}>
              Start Engineering Specification
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Ask the assistant to define functional requirements, architect system components,
              break down tasks, generate test cases, or conduct risk analysis.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.messageId || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{isUser ? '👤 You' : '🤖 Assistant'}</span>
              </div>
              <div
                style={{
                  maxWidth: '75%',
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-lg)',
                  background: isUser ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' : 'var(--bg-tertiary)',
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  border: isUser ? 'none' : '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Unresolved Questions Callout */}
        {unresolvedQuestions.length > 0 && (
          <div
            style={{
              padding: 16,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fbbf24', fontWeight: 600, fontSize: '0.875rem' }}>
              <span>❓ Open Questions & Ambiguities Identified:</span>
            </div>
            <ul style={{ paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>
              {unresolvedQuestions.map((q, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inline Proposals Generated */}
        {pendingProposals.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Generated Proposals (Requires Human Confirmation):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingProposals.map((prop) => (
                <ProposalCard
                  key={prop.proposalId}
                  proposal={prop}
                  onStatusChange={(updatedProp) => {
                    setPendingProposals((prev) =>
                      prev.map((p) => (p.proposalId === updatedProp.proposalId ? updatedProp : p))
                    );
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {isLoading && <LoadingSpinner size="md" label="Agent is analyzing and formulating response..." />}

        {error && (
          <ErrorAlert
            message={error.message}
            errorCode={error.errorCode}
            requestId={error.requestId}
            onDismiss={() => setError(null)}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: 16,
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          gap: 12,
        }}
      >
        <input
          type="text"
          className="input-field"
          placeholder="Type an engineering requirement, question, or design request..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!inputMessage.trim() || isLoading}
          style={{ minWidth: 100 }}
        >
          {isLoading ? 'Sending...' : 'Send ➔'}
        </button>
      </form>
    </div>
  );
}
