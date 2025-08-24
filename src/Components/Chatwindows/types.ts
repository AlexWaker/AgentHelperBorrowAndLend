// 聊天消息类型定义，消息类型是用户或AI发送的单条消息的格式，主要用于前端显示聊天
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isError?: boolean;
  isLoading?: boolean; // 用于显示消息加载状态
}

// 传递给AI的上下文，包含历史消息、当前消息和钱包状态
export interface AgentContext {
  conversationHistory: Array<{role: 'user' | 'assistant' | 'system', content: string}>; // 对话历史
  isWalletConnected: boolean; // 钱包连接状态
  walletAddress?: string;    // 钱包地址
}

// API 响应类型
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

// 聊天配置
export interface ChatConfig {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}