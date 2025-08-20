import OpenAI from 'openai';
import { Message } from '../Components/Chatwindows/types';
import { agentSystem } from './AgentSystem';
import { AgentContext, AgentResponse } from '../Interface'

class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    // 从环境变量获取配置（Vite 使用 import.meta.env）
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    const baseURL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.deepseek.com';
    this.model = import.meta.env.VITE_OPENAI_MODEL || 'deepseek-chat';
    
    this.client = new OpenAI({
      baseURL,
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  // 设置 API Key（运行时配置）
  setApiKey(apiKey: string) {
    this.client = new OpenAI({
      baseURL: this.client.baseURL,
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  // 将消息格式转换为 OpenAI 格式
  private convertToOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));
  }

  // 发送消息到 OpenAI API
  async sendMessage(messages: Message[]): Promise<string> {
    if (!this.client.apiKey) {
      throw new Error('OpenAI API Key 未配置');
    }

    try {
      const openAIMessages = this.convertToOpenAIMessages(messages);
      
      // 添加系统提示词
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: '你是一个友好、有帮助的AI助手。请用中文回答用户的问题，回答要简洁明了。'
        },
        ...openAIMessages
      ];

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messagesWithSystem,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('API 返回数据格式错误');
      }

      return content;
      
    } catch (error) {
      console.error('OpenAI API 调用失败:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('网络连接失败，请检查网络设置');
    }
  }

  // 使用 Agent 系统处理消息，也是处理一切消息的入口
  async processWithAgent(
    messages: Message[], 
    isWalletConnected: boolean, // 强类型语言，都要指定类型
    walletAddress?: string
  ): Promise<string> { // Promise<string> 确保返回的是 string 类型，其中Promise是返回类型注释，变量接收这个函数返回的时候，会首先接受为promise
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error('没有消息需要处理');
    }

    // 构建 Agent 上下文
    const context: AgentContext = { //AgentContext其实就是“变量类型”
      userMessage: lastMessage.content,
      isWalletConnected,
      walletAddress,
      conversationHistory: messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }))
    };

    // 让 Agent 系统处理
    const agentResponse: AgentResponse = await agentSystem.processMessage(context); //await需要在异步函数（async）里使用

    // 如果 Agent 返回了具体消息（比如钱包连接提示），直接返回
    if (agentResponse.message && agentResponse.action !== 'NORMAL_CHAT') {
      return agentResponse.message;
    }

    // 如果是普通聊天，使用 OpenAI API，并根据钱包状态调整系统提示词
    return await this.sendMessageWithContext(messages, isWalletConnected, walletAddress);
  }

  // 带上下文的消息发送
  private async sendMessageWithContext(
    messages: Message[], 
    isWalletConnected: boolean, 
    walletAddress?: string
  ): Promise<string> {
    if (!this.client.apiKey) {
      throw new Error('OpenAI API Key 未配置');
    }

    try {
      const openAIMessages = this.convertToOpenAIMessages(messages);
      
      // 根据钱包连接状态构建系统提示词
      let systemPrompt = '你是一个友好、有帮助的AI助手。请用中文回答用户的问题，回答要简洁明了。';
      
      if (isWalletConnected && walletAddress) {
        systemPrompt += `

当前用户已连接 Sui 钱包，地址：${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}

你可以协助用户进行以下区块链相关操作：
- 解释区块链和 Sui 网络相关概念
- 指导如何进行代币转账
- 解答 DeFi、NFT 相关问题
- 提供区块链安全建议

注意：对于涉及实际资金操作的请求，请提醒用户仔细确认交易详情。`;
      } else {
        systemPrompt += `

如果用户询问需要钱包操作的区块链相关问题，请提醒他们先连接钱包。`;
      }
      
      // 添加系统提示词
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...openAIMessages
      ];

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messagesWithSystem,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('API 返回数据格式错误');
      }

      return content;
      
    } catch (error) {
      console.error('OpenAI API 调用失败:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('网络连接失败，请检查网络设置');
    }
  }

  // 检查 API Key 是否有效
  async validateApiKey(): Promise<boolean> {
    try {
      await this.sendMessage([{
        id: 'test',
        content: 'test',
        sender: 'user',
        timestamp: new Date()
      }]);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 导出单例实例
export const openAIService = new OpenAIService();
export default OpenAIService;
