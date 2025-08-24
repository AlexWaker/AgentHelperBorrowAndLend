import OpenAI from 'openai';
import { Message, AgentContext } from '../Components/Chatwindows/types';
import intentType from './IntentType.json';
import { intentTypeTs } from './IntentTypeTs';

export const normalPrompt = (): string => {
  return `你是一个专业的区块链 AI Agent 助手，专注于 Web3 和区块链领域。

    【重要规则】
    - 对于非区块链/Web3 相关问题，请礼貌地引导用户回到区块链话题
    - 对于区块链/Web3 相关问题，请积极详细地回答`
}

export const firstIntentAnalysis = (): string => {
    return `
    【意图分析任务】
    用户的问题可能包含以下意图类型：
    ${JSON.stringify(intentType, null, 2)}
    用户指令或许并不清晰，但只要意图足够明显，就请大胆作出判断

    【返回格式】
    请严格（务必严格！）按照以下 JSON 格式回复：
    {
    "intent": "具体的意图类型",
    "confidence": 0.85,
    "requiresWallet": true/false,
    "reasoning": "详细的分析推理过程"
    }

    【分析要求】
    - confidence: 0-1 之间的数值，表示判断的确信度
    - requiresWallet: 该操作是否需要连接钱包
    - reasoning: 说明为什么选择这个意图，包含关键词识别

    请分析以下用户输入：`;
}

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
  

  // 使用 Agent 系统处理消息，也是处理一切消息的入口
  async processWithAgent(
    messages: Message[], 
    isWalletConnected: boolean, // 强类型语言，都要指定类型
    walletAddress?: string
  ): Promise<string> { // Promise<string> 确保返回的是 string 类型，其中Promise是返回类型注释，变量接收这个函数返回的时候，会首先接受为promise

    if(!isWalletConnected){
      return '请先连接钱包以使用 AI 助手功能'; // 返回提示信息
    }
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error('没有消息需要处理');
    }

    // 构建 Agent 上下文
    const context: AgentContext = { //AgentContext其实就是"变量类型"
      conversationHistory: messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 
              msg.sender === 'system' ? 'system' as const : 'assistant' as const,
        content: msg.content
      })),
      isWalletConnected,
      walletAddress
    };

    try {
      // 使用 context.conversationHistory 直接生成 OpenAI 所需消息格式
      const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        context.conversationHistory.map(h => ({ role: h.role, content: h.content }))

      // 在这里将firstIntentAnalysis的返回值作为系统提示词与openAIMessages一同发送给AI
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: normalPrompt() },
        { role: 'system', content: firstIntentAnalysis() },
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
      // 打一下log
      console.log('OpenAI 原始回复:', content);

      if (!content) {
        throw new Error('API 返回数据格式错误');
      }
      // 把AI回复解析为json
      const parsed = this.extractAndParseJSON<{ intent: string }>(content);

      if (parsed.intent === intentTypeTs.OTHER) {
        // 闲聊：不加 firstIntentAnalysis，只用对话上下文
        const casualMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: normalPrompt() },
          ...openAIMessages
        ];

        const casual = await this.client.chat.completions.create({
          model: this.model,
          messages: casualMessages,
          max_tokens: 1000,
          temperature: 0.7,
          stream: false,
        });

        const casualContent = casual.choices[0]?.message?.content ?? '';
        
        return casualContent || '（空回复）';
      } else {
        if(parsed.intent === intentTypeTs.QUERY_BALANCE){
          
        }
        return '请进一步详细描述你的需求';
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
