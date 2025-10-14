/**
 * OpenAIService
 * --------------------------------------------------------
 * 负责：
 * 1. 统一封装与 LLM(DeepSeek / OpenAI 兼容接口) 的调用
 * 2. 聊天消息格式转换（前端 Message -> OpenAI Chat 格式）
 * 3. 多轮意图识别 -> 按意图触发业务（查询池子 / 余额 / 质押 / 转账 / 闲聊）
 * 4. 解析模型返回中嵌入的 JSON（宽容：支持 ```json fenced、普通 fenced、或裸 JSON 片段）
 * 5. 与链上服务 `suiService` 交互（获取池子、余额、发起交易）
 *
 * 设计要点：
 * - 第一轮统一添加 system 提示：normalPrompt + firstIntentAnalysis，引导模型输出结构化意图 JSON
 * - 使用 extractAndParseJSON 宽容地从文本中提取 JSON，避免模型多余自然语言导致解析失败
 * - Intent 分支中再按需要二次调用模型补全“最终回复”模板
 * - 实际链上操作（转账/存款）前检查 signer / wallet 是否存在，降低误触风险
 * - 模型温度较低（0.2）保证结构化输出稳定
 */
import OpenAI from 'openai';
import { Message } from '../Components/Chatwindows/types';
import { intentType } from './IntentType';
import { normalPrompt, firstIntentAnalysis } from './GlobalPrompt';
import { queryCoinPrompt, queryCoinResultPrompt } from './QueryCoinPrompt';
import { suiService } from '../SuiServer/SuiService';
import { transferCoinPrompt, transferResultPrompt } from './TransferPrompt'
import { queryPoolResultPrompt } from './QueryPoolsPrompt';
import { depositPrompt, depositNotClear } from './DepositPrompt';
import { borrowPrompt, borrowNotClear } from './BorrowPrompt';
import { queryPortfolioPrompt, queryNotClear, queryPortfolioResultPrompt } from './QueryPortfolioPrompt';
import { withdrawPortfolioPrompt } from './WithdrawPortfolioPrompt';

class OpenAIService {
  private client: OpenAI;
  private model: string;
  /**
   * 构造函数：读取环境变量初始化模型与 API Key
   * VITE_OPENAI_API_URL: 可指向 deepseek 兼容端点
   * VITE_OPENAI_MODEL: 模型名称（默认 deepseek-chat）
   */
  constructor() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    const baseURL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.deepseek.com';
    this.model = import.meta.env.VITE_OPENAI_MODEL || 'deepseek-chat';
    this.client = new OpenAI({
      baseURL,
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
  /** 动态替换 API Key（例如用户输入自己的 Key） */
  setApiKey(apiKey: string) {
    this.client = new OpenAI({
      baseURL: this.client.baseURL,
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * 将前端维护的消息结构转换为 OpenAI Chat API 所需格式
   * - sender:user => role:user
   * - sender:system => role:system （保留）
   * - 其它 => assistant
   */
  private convertToOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role:
        msg.sender === 'user' ? 'user' as const :
        msg.sender === 'system' ? 'system' as const :
        'assistant' as const,
      content: msg.content
    }));
  }

  /**
   * 尝试从模型返回文本中解析 JSON：
   * 解析策略（按优先级）：
   * 1. ```json fenced code block
   * 2. 任意 ``` fenced code block
   * 3. 回退：扫描第一个 '{' 起始，通过括号深度匹配找到完整 JSON
   *
   * 好处：模型即便在 JSON 前后加了解释性文字也能提取。
   * 风险：若文本中出现多个 JSON，只解析第一个；若模型输出格式混乱仍可能抛错。
   */
  private extractAndParseJSON<T = any>(text: string): T {
    const fenced = text.match(/```\s*json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      const candidate = fenced[1].trim();
      return JSON.parse(candidate);
    }

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

  private async callOpenAIAPI(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    logPrefix: string = 'OpenAI',
  ): Promise<string> {
    // 统一的底层调用：可在这里加重试/日志/限流
    try {
      console.debug(`[${logPrefix}] 请求开始，消息数: ${messages.length}`);
    } catch {}
    // const completion = await this.client.chat.completions.create({
    //   model: this.model,
    //   messages: messages,
    //   max_tokens: 5000,
    //   temperature: 0.2,
    //   stream: false,
    // }); deepseek写法
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages,
      max_completion_tokens: 5000,
      stream: false,
    });
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error(`[${logPrefix}] API 返回数据格式错误`);
    }

    return content;
  }
  

  async processWithAgent(
    messages: Message[],
    isWalletConnected: boolean,
    walletAddress: string | undefined,
    signer?: (args: { transaction: any; chain?: string }) => Promise<any>
  ): Promise<string> {
    // 入口：对话 + 上下文 -> 识别意图 -> 执行业务 -> 再组织自然语言反馈
    // 只有连接钱包后才允许执行链上操作（查询、转账、存款等）
    if(!isWalletConnected){
      return '请先连接钱包以使用 AI 助手功能';
    }
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error('没有消息需要处理');
    }
    try {
      // 1) 转换历史消息
      const openAIMessages = this.convertToOpenAIMessages(messages);
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        // 2) 注入系统提示，指导模型执行：
        { role: 'system', content: normalPrompt() },
        { role: 'system', content: firstIntentAnalysis() },
        ...openAIMessages
      ];
      console.log('发送给 OpenAI 的消息:', messagesWithSystem);
      // 3) 第一轮调用：意图分析（期望模型返回 JSON）
      const content = await this.callOpenAIAPI(messagesWithSystem, '最初始意图分析');
      console.log('最初始意图分析回复:', content);
      const parsed = this.extractAndParseJSON<{ intent: string, confidence: number, requiresWallet: boolean, reasoning: string }>(content);
      // 4) 根据意图分支处理
      switch (parsed.intent) {
        case intentType.QUERY_POOLS: {
          try{
            const pools = await suiService.getNaviPools();
            const poolQueryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: queryPoolResultPrompt(pools) },
              ...openAIMessages
            ];
            // 二次调用：让模型基于池子数据组织用户可读输出
            const poolContent = await this.callOpenAIAPI(poolQueryMessages, '池子查询');
            console.log('池子查询回复:', poolContent);
            return poolContent;
          }
          catch(e){
            console.error('池子查询失败:', e);
            return '查询池子信息失败，请稍后重试。';
          }
        }
        case intentType.DEPOSIT: {
          // 模型第一次只给出结构化解析；此处用 depositPrompt 引导它补全更详细的质押参数解释
          const depositCoinMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: depositPrompt(walletAddress) },
            ...openAIMessages
          ];
          const depositContent = await this.callOpenAIAPI(depositCoinMessages, '存款分析');
          console.log('存款分析回复:', depositContent);
          const depositParsed = this.extractAndParseJSON<{ address: string, id: number, symbol: string, amount: number, unit: string, isValid: boolean, errorMessage: string, reasoning: string }>(depositContent);
          const depositAddress = depositParsed.address;
          const depositId = depositParsed.id;
          const depositSymbol = (depositParsed.symbol || 'UNKNOWN').toUpperCase();
          const depositAmount = depositParsed.amount;
          const depositUnit = depositParsed.unit ? depositParsed.unit.toString().toUpperCase() : depositSymbol;
          const depositIsValid = depositParsed.isValid;
          const depositReasoning = depositParsed.errorMessage || depositParsed.reasoning;
          if(!depositIsValid){
            // 分析不完整 / 缺字段 -> 走一个“澄清”提示
            const notClearMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: depositNotClear() },
              ...openAIMessages,
              { role: 'user', content: depositReasoning || '请根据用户最后的输入进行回复。' }
            ];
            const notClearContent = await this.callOpenAIAPI(notClearMessages, '存款指令不清晰');
            return notClearContent || '（空回复）';
          } else {
            try {
              if (!signer) {
                return '无法发起质押：未提供钱包签名器，请先连接钱包或传入 signer。';
              }
              // 构建 + 签名发送交易
              const depositResult = await suiService.depositCoin({
                depositAddress,
                depositId,
                depositSymbol,
                depositAmount,
                depositUnit,
                signer
              });
              if (depositResult?.digest) {
                return `质押提交成功，交易哈希: ${depositResult.digest}`;
              }
              return '质押已提交。';
            } catch (e) {
              console.error('质押失败:', e);
              return '质押失败，请稍后重试。';
            }
          }
          return '未能完成质押操作';
        }
        case intentType.BORROW: {
          const borrowMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: borrowPrompt(walletAddress) },
            ...openAIMessages
          ];
          const borrowContent = await this.callOpenAIAPI(borrowMessages, '借款分析');
          console.log('借款分析回复:', borrowContent);
          const borrowParsed = this.extractAndParseJSON<{ address: string; id: number; symbol: string; amount: number; unit: string; accountCapId?: string; isValid: boolean; errorMessage?: string; reasoning?: string }>(borrowContent);
          const borrowSymbol = (borrowParsed.symbol || 'UNKNOWN').toUpperCase();
          const borrowUnit = (borrowParsed.unit || '').toUpperCase();
          const borrowAccountCapId = borrowParsed.accountCapId && borrowParsed.accountCapId !== 'NONE' ? borrowParsed.accountCapId : undefined;
          if (!borrowParsed.isValid) {
            const borrowClarifyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: borrowNotClear() },
              ...openAIMessages,
              { role: 'user', content: borrowParsed.errorMessage || borrowParsed.reasoning || '请根据用户最后的输入进行回复。' }
            ];
            const borrowClarifyContent = await this.callOpenAIAPI(borrowClarifyMessages, '借款指令不清晰');
            return borrowClarifyContent || '（空回复）';
          }
          if (borrowParsed.id === -1 && borrowSymbol === 'UNKNOWN') {
            return '无法发起借款：缺少目标池子信息，请提供池子 id 或代币符号。';
          }
          if (!Number.isFinite(borrowParsed.amount) || borrowParsed.amount <= 0) {
            return '无法发起借款：借款金额无效，请检查后重新输入。';
          }
          if (!borrowUnit) {
            return '无法发起借款：缺少借款金额单位，请补充是 USD 还是具体币种。';
          }
          try {
            if (!signer) {
              return '无法发起借款：未提供钱包签名器，请先连接钱包或传入 signer。';
            }
            if (!walletAddress) {
              return '无法发起借款：钱包地址未定义，请先连接钱包。';
            }
            const borrowResult = await suiService.borrowCoin({
              borrowAddress: walletAddress,
              borrowId: borrowParsed.id,
              borrowSymbol,
              borrowAmount: borrowParsed.amount,
              borrowUnit: borrowUnit,
              accountCapId: borrowAccountCapId,
              signer
            });
            if (borrowResult?.digest) {
              return `借款提交成功，交易哈希: ${borrowResult.digest}`;
            }
            console.log('借款结果:', borrowResult);
            return '借款已提交，请在钱包内查看进度。';
          } catch (e) {
            console.error('借款失败:', e);
            return '借款失败，请稍后重试。';
          }
        }
        case intentType.QUERY_BALANCE:
          // 余额查询：第二次调用用于生成用户友好的结果表达
          const balanceQueryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: queryCoinPrompt(walletAddress) },
            ...openAIMessages
          ];
          const balanceContent = await this.callOpenAIAPI(balanceQueryMessages, '余额查询');
          const balanceParsed = this.extractAndParseJSON<{ address: string, coin: string, isValid: boolean, errorMessage: string }>(balanceContent);
          if (balanceParsed.isValid) {
            const address = balanceParsed.address;
            try {
              const balanceMist = await suiService.getCoinBalance(address, balanceParsed.coin.toUpperCase());
              const balanceSui = await suiService.toCoin(balanceParsed.coin.toUpperCase(), balanceMist);
              const short = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
              const queryResult =  `地址 ${short} 的 ${balanceParsed.coin} 余额：${balanceSui} ${balanceParsed.coin}（${balanceMist} MIST）`;
              console.log('查询结果:', queryResult);
              const queryResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: 'system', content: queryCoinResultPrompt(queryResult) },
              ];
              const queryResultContent = await this.callOpenAIAPI(queryResultMessages, '查询成功结果');
              return queryResultContent;

            } catch (e) {
              console.error('查询余额失败:', e);
              return '查询余额失败，请稍后重试。';
            }
          } else {
            return balanceParsed.errorMessage || '（空回复）';
          }

        case intentType.TRANSFER:
          // 转账与质押类似：先由模型抽取结构化参数，再执行链上操作
          const transferMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: transferCoinPrompt(walletAddress) },
            ...openAIMessages
          ];
          const transferContent = await this.callOpenAIAPI(transferMessages, '转账分析');
          console.log('转账分析回复:', transferContent);

          const transferParsed = this.extractAndParseJSON<{ fromAddress: string, toAddress: string, coin: string, amount: number, unit?: string, isValid: boolean, errorMessage: string }>(transferContent);
          console.log('转账解析结果:', transferParsed);
          if (transferParsed.isValid) {
            const { fromAddress, toAddress, coin, amount } = transferParsed;
            const unit = (transferParsed.unit || '').toUpperCase();
            try {
              if (!signer) {
                return '无法发起转账：未提供钱包签名器，请先连接钱包或传入 signer。';
              }
              if (!walletAddress) {
                return '无法发起转账：钱包地址未定义，请先连接钱包。';
              }
              const senderAddress = fromAddress || walletAddress;
              if (!senderAddress) {
                return '无法发起转账：缺少发送方地址信息。';
              }
              if (senderAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                return '无法发起转账：发送方地址与当前钱包不一致。';
              }
              const amountMist = await suiService.calculateTransferAmount({
                fromAddress: senderAddress,
                coin: coin.toUpperCase(),
                amount,
                unit: unit || coin.toUpperCase(),
              });
              // 构建 & 发送交易（calculateTransferAmount 已完成单位换算）
              const transferResult = await suiService.transferCoin({
                from: senderAddress,
                to: toAddress,
                coin: coin.toUpperCase(),
                amountMist,
                signer
              });

              if (transferResult?.digest) {
                try {
                  return `转账成功，交易哈希: ${transferResult.digest}。您可以前往 https://suiscan.xyz/ 查询转账细则`;
                } catch (detailError) {
                  console.error('获取转账详情失败:', detailError);
                  const transferResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                    { role: 'system', content: transferResultPrompt(transferResult.digest) },
                  ];
                  const transferResultContent = await this.callOpenAIAPI(transferResultMessages, '转账成功结果');
                  return transferResultContent;
                }
              } else {
                console.log('转账结果:', transferResult);
                return '转账已提交，但未获取到交易哈希，请稍后查看钱包确认结果。';
              }

            } catch (e) {
              console.error('转账失败:', e);
              if (e instanceof Error && e.message) {
                return `转账失败：${e.message}`;
              }
              return '转账失败，请稍后重试。';
            }
          } else {
            return transferParsed.errorMessage || '（空回复）';
          }
        case intentType.QUERY_PORTFOLIO:
          const queryPortfolioMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: queryPortfolioPrompt(walletAddress) },
            ...openAIMessages
          ];
          const queryPortfolioContent = await this.callOpenAIAPI(queryPortfolioMessages, '投资组合查询');
          console.log('投资组合查询回复:', queryPortfolioContent);
          const queryPortfolioParsed = this.extractAndParseJSON<{ address: string, errorMessage: string, reasoning: string }>(queryPortfolioContent);
          if (queryPortfolioParsed.address !== '未连接') {
            const address = queryPortfolioParsed.address;
            try {
              const portfolio = await suiService.getNaviLendingState(address);
              console.log('投资组合查询结果:', portfolio);
              // 之前使用 portfolio.toString() 会变成 [object Object] 丢失结构；
              // 直接传原始对象，由 queryPortfolioResultPrompt 内部负责 JSON.stringify 与截断。
              const portfolioMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: 'system', content: queryPortfolioResultPrompt(portfolio) },
                ...openAIMessages
              ];
              const portfolioContent = await this.callOpenAIAPI(portfolioMessages, '投资组合查询结果');
              return portfolioContent;
            } catch (e) {
              console.error('查询投资组合失败:', e);
              return '查询投资组合信息失败，请稍后重试。';
            }
          } else {
            // 分析不完整 / 缺字段 -> 走一个“澄清”提示
            const queryNotClearMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: queryNotClear() },
              ...openAIMessages,
              { role: 'user', content: queryPortfolioParsed.reasoning || '请根据用户最后的输入进行回复。' }
            ];
            const queryNotClearContent = await this.callOpenAIAPI(queryNotClearMessages, '投资组合查询指令不清晰');
            return queryNotClearContent || '（空回复）';
          }
        case intentType.WITHDRAW:
          // 这里必须先查当前地址的投资组合
          const portfolioInfo = await suiService.getNaviLendingState(walletAddress); //强类型检查真烦人
          const withdrawMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: withdrawPortfolioPrompt(portfolioInfo) },
            ...openAIMessages
          ];
          const withdrawContent = await this.callOpenAIAPI(withdrawMessages, '投资组合提现');
          const withdrawParsed = this.extractAndParseJSON<{ coinType: string, amount: string, errorMessage: string, reasoning: string }>(withdrawContent);
          console.log("withdrawParsed", withdrawParsed)
          if (withdrawParsed.errorMessage) {
            return withdrawParsed.errorMessage;
          }
          try {
            if (!signer) {
              return '无法发起提现：未提供钱包签名器，请先连接钱包或传入 signer。';
            }
            if (!walletAddress) {
              return '无法发起提现：钱包地址未定义，请先连接钱包。';
            }
            // 构建 + 发送交易
            const withdrawResult = await suiService.withdrawCoin({
              coinType: withdrawParsed.coinType,
              amount: withdrawParsed.amount,
              withdrawAddress: walletAddress,
              signer
            });
            if (withdrawResult?.digest) {
              return `提现提交成功，交易哈希: ${withdrawResult.digest}`;
            }
            console.log('提现结果:', withdrawResult);
            return '提现已提交，请在钱包内查看进度。';
            // return '提现功能开发中，敬请期待';
          } catch (e) {
            console.error('提现失败:', e);
            return '提现失败，请稍后重试。';
          }
        default:
          // 兜底：无匹配意图 -> 普通对话 / 闲聊
          const casualMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: normalPrompt() },
            ...openAIMessages,
            { role: 'user', content: parsed.reasoning || '请根据用户最后的输入进行回复。' }
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

export const openAIService = new OpenAIService();
export default OpenAIService;
