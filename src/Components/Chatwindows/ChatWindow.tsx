import React, { useState, useCallback } from 'react';
import { useCurrentAccount } from "@mysten/dapp-kit";
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

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 获取钱包连接状态
  const currentAccount = useCurrentAccount();
  const isWalletConnected = !!currentAccount;
  const walletAddress = currentAccount?.address;

  // 初始化欢迎消息
  React.useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome-1',
        content: `👋 欢迎使用 AI 区块链助手！

我可以帮助您：
• 💬 日常聊天和问答
• 🔗 区块链知识解答
• 💰 Sui 钱包操作指导（需要连接钱包）
• 🎯 DeFi 和 NFT 相关咨询

${isWalletConnected 
  ? `🎉 检测到您已连接钱包！我可以为您提供更专业的区块链服务。` 
  : `💡 提示：连接钱包后，我可以帮您进行更多区块链操作！`
}

有什么我可以帮助您的吗？`,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isWalletConnected]); // 当钱包连接状态改变时重新设置欢迎消息

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
    setError(null);

    try {
      // 准备对话历史（包含当前用户消息）
      const conversationHistory = [...messages, userMessage];
      
      // 使用 Agent 系统处理消息，传入钱包状态
      const response = await openAIService.processWithAgent(  //这里开始调用agent
        conversationHistory, 
        isWalletConnected, 
        walletAddress
      );
      
      // 添加 AI 回复
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
      
      setError(errorMessage);
      
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
