import OpenAI from 'openai';
import { Message } from '../Components/Chatwindows/types';
import { intentTypeTs } from './IntentTypeTs';
import { normalPrompt, firstIntentAnalysis } from './GlobalPrompt';
import { queryCoinPrompt } from './QueryPrompt';
import { suiService } from '../SuiServer/SuiService';

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

  // 将消息格式转换为 OpenAI 格式（使用外部工具函数）
  private convertToOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role:
        msg.sender === 'user' ? 'user' as const :
        msg.sender === 'system' ? 'system' as const :
        'assistant' as const,
      content: msg.content
    }));
  }

  // 提取并解析模型返回中的首个 JSON 块（支持 ```json 代码块与普通文本）
  private extractAndParseJSON<T = any>(text: string): T {
    // 1) 优先匹配 ```json ... ``` 或通用 ``` ... ```
    const fenced = text.match(/```\s*json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      const candidate = fenced[1].trim();
      return JSON.parse(candidate);
    }

    // 2) 解析首个平衡的大括号 JSON 片段
    const start = text.indexOf('{');
    if (start === -1) throw new Error('未找到 JSON 起始大括号');
    let depth = 0;
    let inStr: false | '"' | "'" = false;
    let escape = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === inStr) {
          inStr = false;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = ch as '"' | "'";
        continue;
      }
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) { end = i; break; }
    }
    if (end === -1) throw new Error('未找到完整 JSON 片段');
    const jsonSlice = text.slice(start, end + 1).trim();
    return JSON.parse(jsonSlice) as T;
  }

  // 封装 OpenAI API 调用的通用方法
  private async callOpenAIAPI(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    logPrefix: string = 'OpenAI'
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content;
    console.log(`${logPrefix} 原始回复:`, content);

    if (!content) {
      throw new Error('API 返回数据格式错误');
    }

    return content;
  }
  

  // 使用 Agent 系统处理消息，也是处理一切消息的入口
  async processWithAgent(
    messages: Message[], 
    isWalletConnected: boolean,
    walletAddress?: string
  ): Promise<string> { // Promise<string> 确保返回的是 string 类型，其中Promise是返回类型注释，变量接收这个函数返回的时候，会首先接受为promise

    if(!isWalletConnected){
      return '请先连接钱包以使用 AI 助手功能'; // 返回提示信息
    }
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error('没有消息需要处理');
    }

    try {
      // 使用 convertToOpenAIMessages 转换消息格式
      const openAIMessages = this.convertToOpenAIMessages(messages);

      // 在这里将firstIntentAnalysis的返回值作为系统提示词与openAIMessages一同发送给AI
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: normalPrompt() },
        { role: 'system', content: firstIntentAnalysis() },
        ...openAIMessages
      ];
      
      const content = await this.callOpenAIAPI(messagesWithSystem, '最初始意图分析');
      
      // 把AI回复解析为json
      const parsed = this.extractAndParseJSON<{ intent: string }>(content);
      
      switch (parsed.intent) {
        case intentTypeTs.QUERY_BALANCE:
          // 二次分析用户查询余额意图
          const balanceQueryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: queryCoinPrompt(walletAddress) },
            ...openAIMessages
          ];
          const balanceContent = await this.callOpenAIAPI(balanceQueryMessages, '余额查询');
          
          // 把AI回复解析为json
          const balanceParsed = this.extractAndParseJSON<{ address: string, isValid: boolean, errorMessage: string }>(balanceContent);

          if (balanceParsed.isValid) {
            const address = balanceParsed.address;
            try {
              const balanceMist = await suiService.getSuiBalance(address);
              const balanceSui = suiService.toSUI(balanceMist);
              const short = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
              return `地址 ${short} 的 SUI 余额：${balanceSui} SUI（${balanceMist} MIST）`;
            } catch (e) {
              console.error('查询 SUI 余额失败:', e);
              return '查询 SUI 余额失败，请稍后重试。';
            }
          } else {
            const casualMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: normalPrompt() },
            ...openAIMessages
            ];

            const suggestionContent = await this.callOpenAIAPI(casualMessages, '建议回复');
            return suggestionContent || '（空回复）';
          }

        default:
          // 闲聊：不加 firstIntentAnalysis，只用对话上下文
          const casualMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: normalPrompt() },
            ...openAIMessages
          ];

          const casualContent = await this.callOpenAIAPI(casualMessages, '闲聊回复');
          return casualContent || '（空回复）';
      }
      
    } catch (error) {
      console.error('OpenAI API 调用失败:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('网络连接失败，请检查网络设置');
    }
  }
}

// 导出单例实例
export const openAIService = new OpenAIService();
export default OpenAIService;