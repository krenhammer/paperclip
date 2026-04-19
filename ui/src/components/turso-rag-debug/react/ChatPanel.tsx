/**
 * @module turso-rag-debug/react/ChatPanel
 * @packageDocumentation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage, SearchResult } from '../types';
import { ICONS } from '../icons';
import { formatTime } from '../utils';

export interface ChatPanelProps {
  /** Chat message history */
  messages: ChatMessage[];
  /** Callback for sending messages */
  onSendMessage: (message: string) => void;
}

interface SearchResultItemProps {
  title: string;
  path: string;
  score: number;
  chunks: SearchResult[];
  resultId: string;
}

function SearchResultItem({
  title,
  path,
  score,
  chunks,
  resultId,
}: SearchResultItemProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={`rag-debug-result-file${isExpanded ? ' expanded' : ''}`}
      data-file-id={resultId}
      id={resultId}
    >
      <div
        className="rag-debug-result-file-header"
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        aria-expanded={isExpanded}
      >
        <span
          className="rag-debug-result-toggle"
          dangerouslySetInnerHTML={{
            __html: ICONS['chevron-right'],
          }}
        />
        <div className="rag-debug-result-file-info">
          <div className="rag-debug-result-file-name">{title}</div>
          <div className="rag-debug-result-file-path">{path}</div>
        </div>
        <span className="rag-debug-result-file-score">{Math.round(score * 100)}%</span>
      </div>
      <div className="rag-debug-result-file-content">
        {chunks.map((chunk, chunkIdx) => (
          <div key={chunkIdx} className="rag-debug-result-chunk">
            <div className="rag-debug-result-chunk-header">
              Chunk {chunkIdx + 1} ({Math.round(chunk.score * 100)}%)
            </div>
            <div className="rag-debug-result-chunk-text">{chunk.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchResults({ results }: { results: SearchResult[] }): React.ReactElement {
  const groupedResults = React.useMemo(() => {
    const grouped = new Map<string, SearchResult[]>();

    for (const result of results) {
      const path = result.metadata.path;
      if (!grouped.has(path)) {
        grouped.set(path, []);
      }
      grouped.get(path)!.push(result);
    }

    for (const [, chunks] of grouped) {
      chunks.sort((a, b) => b.score - a.score);
    }

    return grouped;
  }, [results]);

  const uniqueFiles = Array.from(groupedResults.entries());

  return (
    <div className="rag-debug-results">
      <div className="rag-debug-results-title">
        Retrieved {uniqueFiles.length} unique document{uniqueFiles.length > 1 ? 's' : ''}
      </div>
      {uniqueFiles.map(([path, chunks], fileIdx) => {
        const topResult = chunks[0]!;
        return (
          <SearchResultItem
            key={path}
            title={topResult.metadata.title}
            path={path}
            score={topResult.score}
            chunks={chunks}
            resultId={`${path}-${fileIdx}`}
          />
        );
      })}
    </div>
  );
}

function ChatMessageItem({ message }: { message: ChatMessage }): React.ReactElement {
  const { role, content, timestamp, results } = message;

  return (
    <div className={`rag-debug-message ${role}`}>
      <div className="rag-debug-message-content">{content}</div>
      {role !== 'system' && <div className="rag-debug-message-time">{formatTime(timestamp)}</div>}
      {results && results.length > 0 && <SearchResults results={results} />}
    </div>
  );
}

export function ChatPanel({ messages, onSendMessage }: ChatPanelProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleSend = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || isSending) return;

    setIsSending(true);
    setInputValue('');

    Promise.resolve(onSendMessage(trimmedValue))
      .then(() => {
        setIsSending(false);
        inputRef.current?.focus();
      })
      .catch(() => {
        setIsSending(false);
      });
  }, [inputValue, isSending, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = inputValue.trim().length > 0 && !isSending;

  return (
    <div className="rag-debug-chat">
      <div className="rag-debug-chat-messages" id="rag-debug-chat-messages">
        {messages.map((message, index) => (
          <ChatMessageItem key={`${message.timestamp}-${index}`} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="rag-debug-chat-input">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          aria-label="Message input"
        />
        <button onClick={handleSend} disabled={!canSend} aria-label="Send message">
          <span dangerouslySetInnerHTML={{ __html: ICONS.send }} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
