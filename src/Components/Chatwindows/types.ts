// 聊天消息类型定义
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean;
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
