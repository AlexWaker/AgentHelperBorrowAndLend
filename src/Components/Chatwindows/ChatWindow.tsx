import React, { useState, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import { Message } from './types';
import { openAIService } from '../../AiServer/OpenAIService';
import {
  ChatContainer, 
  Header, 
  Title,
  MainContent
} from './styled';
import ClearHistoryButton from './ClearHistoryButton';

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 移除未使用的 error 状态，错误信息通过消息气泡展示
  
  // 获取钱包连接状态
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const isWalletConnected = !!currentAccount;
  const walletAddress = currentAccount?.address;
  const welcomeString = (isWalletConnected: boolean) => (
`👋 欢迎使用 AI 区块链助手！\n我可以帮助您：\n• 💬 日常聊天和问答\n• 🔗 区块链知识解答\n• 💰 Sui 钱包操作指导（需要连接钱包）\n• 🎯 DeFi 和 NFT 相关咨询\n${isWalletConnected 
  ? '🎉 检测到您已连接钱包！我可以为您提供更专业的区块链服务。' 
  : '💡 提示：连接钱包后，我可以帮您进行更多区块链操作！'}\n有什么我可以帮助您的吗？`
  );
  // 初始化欢迎消息（延迟加载，避免首屏闪烁；当钱包连接状态变化时若还未有用户消息则替换）
  React.useEffect(() => {
    if (messages.length > 0) return; // 已有消息则不重复生成
    const timer = setTimeout(() => {
      setMessages(prev => {
        if (prev.length > 0) return prev; // 二次保护
        return [{
          id: 'welcome-1',
          content: welcomeString(isWalletConnected),
          sender: 'assistant',
          timestamp: new Date(),
        }];
      });
    }, 100); // 延迟 100ms 后显示
    return () => clearTimeout(timer);
  }, [isWalletConnected, messages.length]);

  const handleClear = useCallback(() => {
    const welcomeMessage: Message = {
      id: 'welcome-1',
      content: welcomeString(isWalletConnected),
      sender: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [isWalletConnected]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]); 
    setIsLoading(true);
  try {
      const allMessages = [...messages, userMessage];
      const conversationHistory = allMessages.slice(-4); 
      const response = await openAIService.processWithAgent(
        conversationHistory,
        isWalletConnected,
        walletAddress,
        async ({ transaction }) => {
          return await signAndExecute({ transaction });
        }
      );
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (err) {
      console.error('发送消息失败:', err);
      
      let errorMessage = '发送消息失败，请重试';
      
      if (err instanceof Error) {
        if (err.message.includes('API Key')) {
          errorMessage = 'OpenAI API Key 未配置或无效';
        } else if (err.message.includes('401')) {
          errorMessage = 'API 密钥无效，请检查配置';
        } else if (err.message.includes('429')) {
          errorMessage = '请求过于频繁，请稍后重试';
        } else if (err.message.includes('quota')) {
          errorMessage = 'API 配额已用尽，请检查账户余额';
        } else if (err.message.includes('network')) {
          errorMessage = '网络连接失败，请检查网络设置';
        } else {
          errorMessage = err.message;
        }
      }
      
      // 添加错误消息到聊天记录
      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `抱歉，${errorMessage}`,
        sender: 'assistant',
        timestamp: new Date(),
        isError: true,
      };
      
      setMessages(prev => [...prev, errorAiMessage]);
      
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, isWalletConnected, walletAddress]);

  return (
    <ChatContainer>
      <Header>
        <Title>
          AI 聊天助手
          {isWalletConnected && (
            <span style={{ 
              fontSize: '0.8em', 
              color: '#4ade80', 
              marginLeft: '10px',
              fontWeight: 'normal'
            }}>
              🔗 钱包已连接
            </span>
          )}
        </Title>
        <ClearHistoryButton onClear={handleClear} disabled={isLoading} />
      </Header>
      
      <MainContent>
        <MessageList 
          messages={messages} 
          isLoading={isLoading}
        />
        
        <ChatInput 
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          placeholder="输入消息..."
        />
      </MainContent>
    </ChatContainer>
  );
};

export default ChatWindow;