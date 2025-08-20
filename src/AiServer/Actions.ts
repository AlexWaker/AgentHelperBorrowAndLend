import { AgentAction, AgentContext, IntentAnalysis } from '../Interface';
import { UserIntent } from '../Config';
import { BalanceQueryHandler } from '../Services/BalanceQueryHandler';

// 钱包连接检查动作
export const walletCheckAction: AgentAction = {
  name: 'WALLET_CHECK',
  description: '检查钱包连接状态并提示用户连接',
  supportedIntents: [UserIntent.WALLET_CONNECTION],
  
  handler: async (context: AgentContext, analysis: IntentAnalysis) => {
    if (context.isWalletConnected) {
      return {
        success: true,
        message: `✅ 钱包已连接！\n地址：${context.walletAddress?.slice(0, 6)}...${context.walletAddress?.slice(-4)}\n\n我可以为您提供区块链相关服务了。`,
        action: 'WALLET_ALREADY_CONNECTED',
        metadata: {
          walletAddress: context.walletAddress,
          analysis: analysis.reasoning
        }
      };
    }

    // 根据AI分析的实体信息生成更精准的提示
    let specificTip = '';
    if (analysis.entities.action) {
      const action = analysis.entities.action.toLowerCase();
      if (action.includes('transfer') || action.includes('send')) {
        specificTip = '\n🔄 想要转账？连接钱包后我可以：\n• 帮您构建转账交易\n• 计算手续费\n• 验证接收地址';
      } else if (action.includes('balance')) {
        specificTip = '\n💰 想查看余额？连接钱包后我可以：\n• 显示 SUI 主币余额\n• 查看所有代币持仓\n• 显示 NFT 收藏';
      }
    }

    return {
      success: true,
      message: `🔗 我分析您想要进行区块链相关操作，但您还没有连接钱包。

请先点击右上角的"连接钱包"按钮连接您的 Sui 钱包。${specificTip}

AI分析：${analysis.reasoning}

连接钱包是安全的，我们：
✅ 不会存储您的私钥
✅ 不会自动执行交易
✅ 所有操作都需要您的确认

连接后，我将能够为您提供专业的区块链服务！`,
      action: 'WALLET_CONNECTION_REQUIRED',
      requiresWallet: true,
      metadata: {
        analysis,
        suggestedAction: 'connect_wallet',
        confidence: analysis.confidence
      }
    };
  }
};

// 普通聊天动作
export const chatAction: AgentAction = {
  name: 'CHAT',
  description: '普通聊天对话',
  supportedIntents: [UserIntent.NORMAL_CHAT, UserIntent.GENERAL_BLOCKCHAIN_INFO, UserIntent.UNKNOWN],
  
  handler: async (_context: AgentContext, analysis: IntentAnalysis) => {
    return {
      success: true,
      message: '', // 将由 OpenAI 服务处理
      action: 'NORMAL_CHAT',
      metadata: {
        analysis,
        needsAIResponse: true
      }
    };
  }
};

// 余额查询动作
export const balanceCheckAction: AgentAction = {
  name: 'BALANCE_CHECK',
  description: '查询钱包余额',
  supportedIntents: [UserIntent.BALANCE_CHECK],
  
  handler: async (context: AgentContext, analysis: IntentAnalysis) => {
    if (!context.isWalletConnected || !context.walletAddress) {
      return {
        success: false,
        message: '请先连接钱包才能查看余额。',
        action: 'WALLET_REQUIRED',
        requiresWallet: true
      };
    }

    try {
      // 执行实际的余额查询
      const balanceResult = await BalanceQueryHandler.queryBalance(
        context.walletAddress,
        analysis
      );

      return {
        success: true,
        message: balanceResult,
        action: 'BALANCE_CHECKED',
        metadata: {
          walletAddress: context.walletAddress,
          analysis,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('余额查询失败:', error);
      
      return {
        success: false,
        message: `❌ 查询余额失败

🔗 钱包地址: ${context.walletAddress.slice(0, 6)}...${context.walletAddress.slice(-4)}
❗ 错误信息: ${error instanceof Error ? error.message : '未知错误'}

🔧 可能的解决方案：
• 检查网络连接
• 确认钱包地址正确
• 稍后重试
• 尝试查询其他代币

💡 提示：您可以输入 "查看 SUI 余额" 或 "查看所有余额" 重新尝试。`,
        action: 'BALANCE_CHECK_FAILED',
        metadata: {
          walletAddress: context.walletAddress,
          error: error instanceof Error ? error.message : '未知错误',
          analysis
        }
      };
    }
  }
};

// 钱包相关操作动作
export const walletOperationAction: AgentAction = {
  name: 'WALLET_OPERATION',
  description: '处理钱包相关操作',
  supportedIntents: [UserIntent.TRANSFER_TOKENS, UserIntent.NFT_OPERATIONS, UserIntent.DEFI_OPERATIONS, UserIntent.TRANSACTION_HISTORY],
  
  handler: async (context: AgentContext, analysis: IntentAnalysis) => {
    if (!context.isWalletConnected) {
      return {
        success: false,
        message: '请先连接钱包才能进行此操作。',
        action: 'WALLET_REQUIRED',
        requiresWallet: true
      };
    }

    // 根据意图类型返回不同的响应
    switch (analysis.intent) {
      case UserIntent.TRANSFER_TOKENS:
        return {
          success: true,
          message: `💸 我可以帮您进行转账操作！

请告诉我：
1. 要发送多少 ${analysis.entities.token || 'SUI'}
2. 接收方的钱包地址

AI分析：${analysis.reasoning}

例如："发送 1 SUI 到 0x1234..."

注意：转账前我会为您显示交易详情确认。`,
          action: 'PREPARE_TRANSFER',
          metadata: {
            walletAddress: context.walletAddress,
            analysis
          }
        };

      case UserIntent.NFT_OPERATIONS:
        return {
          success: true,
          message: `🖼️ NFT 操作服务

钱包地址：${context.walletAddress?.slice(0, 6)}...${context.walletAddress?.slice(-4)}

AI分析：${analysis.reasoning}

我可以帮您：
• 查看 NFT 收藏
• 分析 NFT 元数据
• 指导 NFT 交易流程

请告诉我您想要进行什么 NFT 操作。`,
          action: 'NFT_OPERATION',
          metadata: {
            walletAddress: context.walletAddress,
            analysis
          }
        };

      case UserIntent.DEFI_OPERATIONS:
        return {
          success: true,
          message: `⚡ DeFi 操作服务

钱包地址：${context.walletAddress?.slice(0, 6)}...${context.walletAddress?.slice(-4)}

AI分析：${analysis.reasoning}

我可以帮您：
• 推荐优质 DeFi 协议
• 计算收益率
• 指导质押和流动性操作
• 风险评估

请告诉我您想要进行什么 DeFi 操作。`,
          action: 'DEFI_OPERATION',
          metadata: {
            walletAddress: context.walletAddress,
            analysis
          }
        };

      case UserIntent.TRANSACTION_HISTORY:
        return {
          success: true,
          message: `📊 交易历史查询

钱包地址：${context.walletAddress?.slice(0, 6)}...${context.walletAddress?.slice(-4)}

AI分析：${analysis.reasoning}

我可以帮您查看：
• 最近的交易记录
• 转账历史
• NFT 交易记录
• DeFi 操作历史
• 收入支出统计

请告诉我您想查看哪种类型的交易历史。`,
          action: 'TRANSACTION_HISTORY',
          metadata: {
            walletAddress: context.walletAddress,
            analysis
          }
        };

      default:
        return {
          success: true,
          message: `🔗 钱包已连接！地址：${context.walletAddress?.slice(0, 6)}...${context.walletAddress?.slice(-4)}

AI分析：${analysis.reasoning}

我可以帮您进行以下操作：
• 查看钱包余额
• 发送代币转账
• NFT 管理
• DeFi 操作
• 查看交易历史

请告诉我您想要做什么！`,
          action: 'WALLET_READY',
          metadata: {
            walletAddress: context.walletAddress,
            analysis
          }
        };
    }
  }
};

// 导出所有动作的数组（方便批量注册）
export const defaultActions: AgentAction[] = [
  walletCheckAction,
  balanceCheckAction,
  walletOperationAction,
  chatAction
];
