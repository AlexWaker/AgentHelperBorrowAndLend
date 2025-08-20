import { IntentType, EntityType, ResponseFormat } from '../Interface.ts'

// 意图分析配置
export class IntentAnalysisPromptBuilder {
  private static readonly INTENT_TYPES: IntentType[] = [
    {
      id: 'wallet_connection',
      name: '钱包连接',
      description: '用户想要连接钱包或询问钱包相关',
      requiresWallet: false,
      examples: ['连接钱包', '我要绑定钱包', '钱包怎么连接', '钱包地址是什么']
    },
    {
      id: 'balance_check',
      name: '余额查询',
      description: '用户想要查看余额',
      requiresWallet: true,
      examples: ['查看余额', '我有多少钱', '账户余额', 'SUI余额多少']
    },
    {
      id: 'transfer_tokens',
      name: '代币转账',
      description: '用户想要转账或发送代币',
      requiresWallet: true,
      examples: ['转账给朋友', '发送100 SUI', '给0x123...转币', '转账操作']
    },
    {
      id: 'nft_operations',
      name: 'NFT操作',
      description: '用户想要进行NFT相关操作',
      requiresWallet: true,
      examples: ['查看我的NFT', '铸造NFT', 'NFT交易', '收藏品管理']
    },
    {
      id: 'defi_operations',
      name: 'DeFi操作',
      description: '用户想要进行DeFi操作（质押、流动性、借贷等）',
      requiresWallet: true,
      examples: ['质押代币', '提供流动性', 'DeFi收益', '借贷协议']
    },
    {
      id: 'transaction_history',
      name: '交易历史',
      description: '用户想要查看交易历史',
      requiresWallet: true,
      examples: ['交易记录', '历史转账', '查看交易', '交易详情']
    },
    {
      id: 'general_blockchain_info',
      name: '区块链知识',
      description: '用户询问区块链相关知识',
      requiresWallet: false,
      examples: ['什么是区块链', 'Sui网络介绍', 'DeFi是什么', '智能合约原理']
    },
    {
      id: 'normal_chat',
      name: '普通聊天',
      description: '普通聊天，非区块链相关',
      requiresWallet: false,
      examples: ['你好', '天气怎么样', '聊天', '今天心情不错']
    },
    {
      id: 'unknown',
      name: '未知意图',
      description: '无法确定意图',
      requiresWallet: false,
      examples: ['模糊不清的消息', '无法理解的内容']
    }
  ];

  private static readonly ENTITY_TYPES: EntityType[] = [
    {
      name: 'amount',
      description: '涉及的金额数量',
      required: false,
      examples: ['100', '1.5', '0.01']
    },
    {
      name: 'address',
      description: '钱包地址或合约地址',
      required: false,
      examples: ['0x1234...', '0xabcd...', 'sui地址']
    },
    {
      name: 'token',
      description: '特定的代币类型',
      required: false,
      examples: ['SUI', 'USDC', 'ETH', 'BTC']
    },
    {
      name: 'action',
      description: '具体的操作动作',
      required: false,
      examples: ['send', 'transfer', 'stake', 'mint', 'buy', 'sell']
    }
  ];

  private static readonly ANALYSIS_RULES = [
    '仔细分析语义，不要只看关键词',
    '考虑上下文和对话历史',
    '置信度要客观评估',
    'entities中只包含实际提取到的信息',
    '如果用户消息模糊，置信度应该较低',
    '优先考虑用户的真实意图，而非表面词汇'
  ];

  /**
   * 构建完整的系统提示词
   */
  static buildSystemPrompt(): string {
    const roleDescription = '你是一个专业的区块链意图分析助手。你需要分析用户的消息，准确识别用户的意图。';
    
    const intentTypesSection = this.buildIntentTypesSection();
    const responseFormatSection = this.buildResponseFormatSection();
    const rulesSection = this.buildRulesSection();
    
    return `${roleDescription}\n\n${intentTypesSection}\n\n${responseFormatSection}\n\n${rulesSection}`;
  }

  /**
   * 构建意图类型说明
   */
  private static buildIntentTypesSection(): string {
    let section = '可能的意图类型：\n';
    
    this.INTENT_TYPES.forEach((intent, index) => {
      section += `${index + 1}. ${intent.id} - ${intent.description}\n`;
      if (intent.examples.length > 0) {
        section += `   示例：${intent.examples.join('、')}\n`;
      }
    });
    
    return section;
  }

  /**
   * 构建响应格式说明
   */
  private static buildResponseFormatSection(): string {
    const entityDescriptions = this.ENTITY_TYPES.map(entity => 
      `    "${entity.name}": "${entity.description}"`
    ).join(',\n');

    return `请按以下JSON格式回复：
    {
      "intent": "意图类型",
      "confidence": 置信度(0-1),
      "entities": {
    ${entityDescriptions}
      },
      "requiresWallet": 是否需要钱包连接(true/false),
      "reasoning": "分析推理过程"
    }`;
  }

  /**
   * 构建分析规则说明
   */
  private static buildRulesSection(): string {
    let section = '注意：\n';
    this.ANALYSIS_RULES.forEach(rule => {
      section += `- ${rule}\n`;
    });
    return section;
  }

  /**
   * 获取特定意图的详细信息
   */
  static getIntentInfo(intentId: string): IntentType | undefined {
    return this.INTENT_TYPES.find(intent => intent.id === intentId);
  }

  /**
   * 获取所有意图类型
   */
  static getAllIntents(): IntentType[] {
    return [...this.INTENT_TYPES];
  }

  /**
   * 获取需要钱包的意图类型
   */
  static getWalletRequiredIntents(): string[] {
    return this.INTENT_TYPES
      .filter(intent => intent.requiresWallet)
      .map(intent => intent.id);
  }

  /**
   * 验证意图ID是否有效
   */
  static isValidIntent(intentId: string): boolean {
    return this.INTENT_TYPES.some(intent => intent.id === intentId);
  }

  /**
   * 构建带上下文的用户提示词
   */
  static buildUserPrompt(
    userMessage: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
  ): string {
    let prompt = '';
    
    // 添加对话历史（最近3轮）
    if (conversationHistory.length > 0) {
      prompt += '最近的对话历史：\n';
      const recentHistory = conversationHistory.slice(-6); // 最近3轮对话
      recentHistory.forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `请分析以下用户消息的意图：\n"${userMessage}"`;
    
    return prompt;
  }
}

// 导出默认的系统提示词（向后兼容）
export const INTENT_ANALYSIS_SYSTEM_PROMPT = IntentAnalysisPromptBuilder.buildSystemPrompt();