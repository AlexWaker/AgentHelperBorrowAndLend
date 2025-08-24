import styled from 'styled-components';

export const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #F8F9FA;
`;

export const Header = styled.div`
  padding: 16px 20px;
  background-color: white;
  border-bottom: 1px solid #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1A1A1A;
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: #D0D0D0;
    border-radius: 3px;
    
    &:hover {
      background-color: #B0B0B0;
    }
  }

  /* 添加加载动画 */
  @keyframes loadingPulse {
    0%, 80%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    40% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

export const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  text-align: center;
  padding: 40px 20px;
`;

export const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

export const EmptyTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 500;
  color: #666;
`;

export const EmptyDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: #999;
`;

export const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const MessageMeta = styled.div<{ $isUser: boolean }>`
  font-size: 11px;
  color: #999;
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  padding: 0 4px;
`;

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const LoadingDots = styled.div`
  display: flex;
  gap: 4px;
`;

export const LoadingDot = styled.div<{ $delay: number }>`
  width: 6px;
  height: 6px;
  background-color: #999;
  border-radius: 50%;
  animation: loadingPulse 1.4s ease-in-out infinite;
  animation-delay: ${props => props.$delay}s;
`;

export const InputContainer = styled.div`
  padding: 20px;
  background-color: white;
  border-top: 1px solid #E0E0E0;
`;

export const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
  max-width: 800px;
  margin: 0 auto;
`;

export const TextArea = styled.textarea`
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 12px 16px;
  border: 1px solid #D0D0D0;
  border-radius: 22px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  background-color: #F8F8F8;
  color: #000000;
  
  &:focus {
    border-color: #007AFF;
    background-color: white;
  }
  
  &:disabled {
    background-color: #F0F0F0;
    color: #999;
    cursor: not-allowed;
  }

  &::placeholder {
    color: #999;
  }

  /* 隐藏滚动条但保持滚动功能 */
  &::-webkit-scrollbar {
    width: 0px;
    background: transparent;
  }
`;

export const SendButton = styled.button<{ $canSend: boolean }>`
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background-color: ${props => props.$canSend ? '#007AFF' : '#D0D0D0'};
  color: white;
  cursor: ${props => props.$canSend ? 'pointer' : 'not-allowed'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${props => props.$canSend ? '#0056CC' : '#D0D0D0'};
    transform: ${props => props.$canSend ? 'scale(1.05)' : 'none'};
  }
  
  &:active {
    transform: ${props => props.$canSend ? 'scale(0.95)' : 'none'};
  }
`;

export const MessageBubble = styled.div<{ $isUser: boolean; $isError?: boolean }>`
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: pre-wrap;
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  
  ${props => props.$isUser ? `
    background: linear-gradient(135deg, #007AFF, #0056CC);
    color: white;
    border-bottom-right-radius: 6px;
  ` : `
    background-color: ${props.$isError ? '#FFE5E5' : 'white'};
    color: ${props.$isError ? '#D70015' : '#1A1A1A'};
    border: 1px solid ${props.$isError ? '#FFD0D0' : '#E0E0E0'};
    border-bottom-left-radius: 6px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `}
`;

// 清空按钮样式
export const ClearButton = styled.button<{ disabled?: boolean }>`
  padding: 8px 12px;
  border: 1px solid #E0E0E0;
  background-color: #ffffff;
  color: #1A1A1A;
  border-radius: 8px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  font-size: 13px;
  line-height: 18px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease, transform 0.1s ease;

  &:hover {
    background-color: ${props => props.disabled ? '#ffffff' : '#f7f7f7'};
  }

  &:active {
    transform: ${props => props.disabled ? 'none' : 'scale(0.98)'};
  }
`;