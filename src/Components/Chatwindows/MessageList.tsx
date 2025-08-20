import React, { useEffect, useRef } from 'react';
import { 
  MessagesContainer, 
  EmptyState, 
  EmptyIcon,
  EmptyTitle,
  EmptyDescription,
  MessageBubble,
  MessageContainer,
  MessageMeta,
  LoadingContainer,
  LoadingDots,
  LoadingDot
} from './styled';
import { Message } from './types';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading = false }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 格式化时间显示
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <MessagesContainer>
      {messages.length === 0 ? (
        <EmptyState>
          <EmptyIcon>🤖</EmptyIcon>
          <EmptyTitle>
            欢迎使用 AI 助手
          </EmptyTitle>
          <EmptyDescription>
            开始对话，我来帮助你解决问题
          </EmptyDescription>
        </EmptyState>
      ) : (
        <>
          {messages.map((message) => (
            <MessageContainer key={message.id}>
              <MessageBubble $isUser={message.sender === 'user'} $isError={message.isError}>
                {message.content}
              </MessageBubble>
              <MessageMeta $isUser={message.sender === 'user'}>
                {message.sender === 'user' ? '我' : 'AI'} • {formatTime(message.timestamp)}
              </MessageMeta>
            </MessageContainer>
          ))}
          {isLoading && (
            <MessageContainer>
              <MessageBubble $isUser={false}>
                <LoadingContainer>
                  <span>AI 正在思考中</span>
                  <LoadingDots>
                    {[0, 1, 2].map((i) => (
                      <LoadingDot
                        key={i}
                        $delay={-0.32 + i * 0.16}
                      />
                    ))}
                  </LoadingDots>
                </LoadingContainer>
              </MessageBubble>
            </MessageContainer>
          )}
          <div ref={messagesEndRef} />
        </>
      )}
    </MessagesContainer>
  );
};

export default MessageList;
