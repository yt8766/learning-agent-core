import { Button } from 'antd';
import { useEffect, useState } from 'react';

import { scrollToConversationAnchor, type ConversationAnchor } from './chat-home-anchor-rail-helpers';

interface ConversationAnchorRailProps {
  anchors: ConversationAnchor[];
}

export function ConversationAnchorRail({ anchors }: ConversationAnchorRailProps) {
  const [activeAnchorId, setActiveAnchorId] = useState(anchors[0]?.id ?? '');

  useEffect(() => {
    if (!anchors.some(anchor => anchor.id === activeAnchorId)) {
      setActiveAnchorId(anchors[0]?.id ?? '');
    }
  }, [activeAnchorId, anchors]);

  if (anchors.length < 2) {
    return null;
  }

  return (
    <nav className="chatx-anchor-rail" aria-label="当前对话定位">
      <div className="chatx-anchor-rail__marks" aria-hidden="true">
        {anchors.map(anchor => (
          <span
            key={anchor.id}
            className={`chatx-anchor-rail__mark ${activeAnchorId === anchor.id ? 'is-active' : ''}`}
            data-tone={anchor.tone}
          />
        ))}
      </div>
      <div className="chatx-anchor-rail__panel">
        {anchors.map(anchor => (
          <Button
            key={anchor.id}
            type="text"
            size="small"
            className={`chatx-anchor-rail__item ${activeAnchorId === anchor.id ? 'is-active' : ''}`}
            data-tone={anchor.tone}
            onClick={() => scrollToConversationAnchor(anchor, setActiveAnchorId)}
          >
            {anchor.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
