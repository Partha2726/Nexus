'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ChatView } from '../../../../components/chat/ChatView';

export default function ProjectChatPage() {
  const params = useParams();
  const projectId = params?.id as string;

  return <ChatView projectId={projectId} />;
}
