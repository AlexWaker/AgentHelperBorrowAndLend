import { intentAnalysisService } from './IntentAnalysisService';
import { IntentAnalysis, AgentAction, AgentContext, AgentResponse } from '../Interface'
import { UserIntent } from '../Config';
import { 
  walletCheckAction, 
  balanceCheckAction, 
  walletOperationAction, 
  chatAction
} from './Actions';

// Agent 系统核心类
export class AgentSystem {
  private actions: AgentAction[] = [];
  
  constructor() {
    // 注册默认动作
    this.registerAction(walletCheckAction);
    this.registerAction(balanceCheckAction);
    this.registerAction(walletOperationAction);
    this.registerAction(chatAction);
  }
  
  registerAction(action: AgentAction) {
    this.actions.push(action);
  }
  
  async processMessage(context: AgentContext): Promise<AgentResponse> {
    try {
      // 使用AI进行意图分析
      const analysis = await intentAnalysisService.analyzeIntent(
        context.userMessage, 
        context.conversationHistory
      );

      console.log(`[Agent] AI分析结果:`, analysis);

      // 特殊处理：如果需要钱包但未连接，优先返回钱包连接提示
      if (analysis.requiresWallet && !context.isWalletConnected) {
        return await walletCheckAction.handler(context, analysis);
      }

      // 找到支持当前意图的动作
      for (const action of this.actions) {
        if (action.supportedIntents.includes(analysis.intent)) {
          console.log(`[Agent] 执行动作: ${action.name} (意图: ${analysis.intent})`);
          return await action.handler(context, analysis);
        }
      }

      // 如果没有找到匹配的动作，使用聊天动作作为默认
      console.log(`[Agent] 使用默认聊天动作处理: ${analysis.intent}`);
      return await chatAction.handler(context, analysis);
      
    } catch (error) {
      console.error('[Agent] 处理消息失败:', error);
      
      // 降级到简单的关键词匹配作为备选方案
      return this.fallbackProcess(context);
    }
  }

  /**
   * 备选处理方案：简单的关键词匹配
   */
  private async fallbackProcess(context: AgentContext): Promise<AgentResponse> {
    const message = context.userMessage.toLowerCase();
    const blockchainKeywords = ['钱包', '转账', '余额', 'sui', 'nft', '代币'];
    
    const isBlockchainRelated = blockchainKeywords.some(keyword => 
      message.includes(keyword)
    );

    if (isBlockchainRelated && !context.isWalletConnected) {
      return {
        success: true,
        message: '🔗 检测到区块链相关操作，请先连接钱包。',
        action: 'WALLET_CONNECTION_REQUIRED',
        requiresWallet: true
      };
    }

    return {
      success: true,
      message: '', // 将由 OpenAI 服务处理
      action: 'NORMAL_CHAT',
      metadata: {
        fallback: true
      }
    };
  }
}

// 导出单例实例
export const agentSystem = new AgentSystem();
