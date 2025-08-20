import { openAIService } from './OpenAIService';
import { IntentAnalysisPromptBuilder } from './Prompt';
import { UserIntent } from '../Config';
import { IntentAnalysis } from '../Interface';

// 意图分析服务
export class IntentAnalysisService {
  /**
   * 分析用户消息的意图
   */
  async analyzeIntent(userMessage: string, conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []): Promise<IntentAnalysis> {
    try {
      const systemPrompt = this.buildAnalysisPrompt(); //意图分析提示词
      const userPrompt = this.buildUserPrompt(userMessage, conversationHistory); //用户信息+历史信息
      
      const response = await openAIService.sendMessage([
        { id: 'system', content: systemPrompt, sender: 'assistant', timestamp: new Date() },
        { id: 'user', content: userPrompt, sender: 'user', timestamp: new Date() }
      ]);
      
      // 解析AI响应
      const analysis = this.parseAnalysisResponse(response);
      
      // 验证和修正分析结果
      return this.validateAndCorrectAnalysis(analysis, userMessage);
      
    } catch (error) {
      console.error('意图分析失败:', error);
      // 返回默认分析结果
      return {
        intent: UserIntent.NORMAL_CHAT,
        confidence: 0.1,
        entities: {},
        requiresWallet: false,
        reasoning: '分析服务暂时不可用，默认为普通聊天'
      };
    }
  }
  
  /**
   * 构建系统提示词
   */
  private buildAnalysisPrompt(): string {
    return IntentAnalysisPromptBuilder.buildSystemPrompt();
  }
  
  /**
   * 构建用户提示词
   */
  private buildUserPrompt(userMessage: string, conversationHistory: Array<{role: 'user' | 'assistant', content: string}>): string {
    return IntentAnalysisPromptBuilder.buildUserPrompt(userMessage, conversationHistory);
  }
  
  /**
   * 解析AI响应
   */
  private parseAnalysisResponse(response: string): IntentAnalysis {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('未找到JSON响应');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        intent: this.mapStringToIntent(parsed.intent),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        entities: parsed.entities || {},
        requiresWallet: Boolean(parsed.requiresWallet),
        reasoning: parsed.reasoning || '无推理信息'
      };
      
    } catch (error) {
      console.error('解析意图分析响应失败:', error);
      throw error;
    }
  }
  
  /**
   * 字符串到意图枚举的映射
   */
  private mapStringToIntent(intentString: string): UserIntent {
    const mapping: Record<string, UserIntent> = {
      'wallet_connection': UserIntent.WALLET_CONNECTION,
      'balance_check': UserIntent.BALANCE_CHECK,
      'transfer_tokens': UserIntent.TRANSFER_TOKENS,
      'nft_operations': UserIntent.NFT_OPERATIONS,
      'defi_operations': UserIntent.DEFI_OPERATIONS,
      'transaction_history': UserIntent.TRANSACTION_HISTORY,
      'general_blockchain_info': UserIntent.GENERAL_BLOCKCHAIN_INFO,
      'normal_chat': UserIntent.NORMAL_CHAT,
      'unknown': UserIntent.UNKNOWN
    };
    
    return mapping[intentString] || UserIntent.UNKNOWN;
  }
  
  /**
   * 验证和修正分析结果
   */
  private validateAndCorrectAnalysis(analysis: IntentAnalysis, userMessage: string): IntentAnalysis {
    // 如果置信度太低，改为normal_chat
    if (analysis.confidence < 0.3) {
      analysis.intent = UserIntent.NORMAL_CHAT;
      analysis.requiresWallet = false;
      analysis.reasoning += ` (置信度过低，降级为普通聊天)`;
    }
    
    // 使用结构化方法获取需要钱包的意图类型
    const walletRequiredIntents = IntentAnalysisPromptBuilder.getWalletRequiredIntents();
    
    if (walletRequiredIntents.includes(analysis.intent)) {
      analysis.requiresWallet = true;
    }
    
    // 额外的安全检查
    if (analysis.intent === UserIntent.NORMAL_CHAT) {
      analysis.requiresWallet = false;
    }

    // 添加消息长度检查
    if (userMessage.length < 2) {
      analysis.intent = UserIntent.NORMAL_CHAT;
      analysis.confidence = Math.min(analysis.confidence, 0.5);
    }
    
    return analysis;
  }
}

// 导出单例实例
export const intentAnalysisService = new IntentAnalysisService();
