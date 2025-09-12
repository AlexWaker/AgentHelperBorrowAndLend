import OpenAI from 'openai';
import { Message } from '../Components/Chatwindows/types';
import { intentType } from './IntentType';
import { normalPrompt, firstIntentAnalysis } from './GlobalPrompt';
import { queryCoinPrompt, queryCoinResultPrompt } from './QueryCoinPrompt';
import { suiService } from '../SuiServer/SuiService';
import { transferCoinPrompt, transferResultPrompt } from './TransferPrompt'
import { naviService } from '../NaviServer/NaviService';
import { queryPoolResultPrompt } from './QueryPoolsPrompt';
import { depositPrompt, depositNotClear } from './DepositPrompt';
class OpenAIService {
  private client: OpenAI;
  private model: string;
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
  setApiKey(apiKey: string) {
    this.client = new OpenAI({
      baseURL: this.client.baseURL,
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private convertToOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role:
        msg.sender === 'user' ? 'user' as const :
        msg.sender === 'system' ? 'system' as const :
        'assistant' as const,
      content: msg.content
    }));
  }

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
    try {
      console.debug(`[${logPrefix}] 请求开始，消息数: ${messages.length}`);
    } catch {}
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.2,
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
    walletAddress?: string,
    signer?: (args: { transaction: any; chain?: string }) => Promise<any>
  ): Promise<string> {

    if(!isWalletConnected){
      return '请先连接钱包以使用 AI 助手功能';
    }
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error('没有消息需要处理');
    }
    try {
      const openAIMessages = this.convertToOpenAIMessages(messages);
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: normalPrompt() },
        { role: 'system', content: firstIntentAnalysis() },
        ...openAIMessages
      ];
      const content = await this.callOpenAIAPI(messagesWithSystem, '最初始意图分析');
      console.log('最初始意图分析回复:', content);
      const parsed = this.extractAndParseJSON<{ intent: string, confidence: number, requiresWallet: boolean, reasoning: string }>(content);
      switch (parsed.intent) {
        case intentType.QUERY_POOLS: {
          try{
            const pools = await naviService.getNaviPoolsSimple();
            const poolQueryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: queryPoolResultPrompt(pools) },
              ...openAIMessages
            ];
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
          const depositCoinMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: depositPrompt() },
            ...openAIMessages
          ];
          const depositContent = await this.callOpenAIAPI(depositCoinMessages, '存款分析');
          const depositParsed = this.extractAndParseJSON<{ id: string, symbol: string, amount: number, isValid: Boolean, errorMessage: string, reasoning: string }>(depositContent);
          if(!depositParsed.isValid){
            const notClearMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: depositNotClear() },
              ...openAIMessages,
              { role: 'user', content: depositParsed.reasoning || '请根据用户最后的输入进行回复。' }
            ];
            const notClearContent = await this.callOpenAIAPI(notClearMessages, '存款指令不清晰');
            return notClearContent || '（空回复）';
          } else {
            const poolInfo = await naviService.getNaviPool(depositParsed.id !== 'unknown' ? depositParsed.id : depositParsed.symbol);
            if(depositParsed.id !== 'unknown' && depositParsed.symbol !== 'unknown'){
              if(poolInfo.id !== depositParsed.id || poolInfo.symbol !== depositParsed.symbol){
                return `未找到与 ID "${depositParsed.id}" 和 币种 "${depositParsed.symbol}" 匹配的池子，请确认后重试。`;
              }
            } else {
              console.warn('存款时未提供池子 ID 或 Symbol，可能导致匹配错误');
            }
          }
        }
        case intentType.QUERY_BALANCE:
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
              const balanceSui = suiService.toCoin(balanceParsed.coin.toUpperCase(), balanceMist);
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
          const transferMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: transferCoinPrompt(walletAddress) },
            ...openAIMessages
          ];
          const transferContent = await this.callOpenAIAPI(transferMessages, '转账分析');
          console.log('转账分析回复:', transferContent);

          const transferParsed = this.extractAndParseJSON<{ fromAddress: string, toAddress: string, coin: string, amount: number, isValid: boolean, errorMessage: string }>(transferContent);

          if (transferParsed.isValid) {
            const { fromAddress, toAddress, coin, amount } = transferParsed;
            try {
              if (!signer) {
                return '无法发起转账：未提供钱包签名器，请先连接钱包或传入 signer。';
              }
              if (!walletAddress) {
                return '无法发起转账：钱包地址未定义，请先连接钱包。';
              }
              const transferResult = await suiService.transferSui({
                from: fromAddress,
                to: toAddress,
                coin: coin.toUpperCase(),
                amountMist: suiService.toMist(coin.toUpperCase(), amount),
                signer
              });

              if (transferResult?.digest) {
                try {
                  const info = await suiService.getTransactionDetails(transferResult.digest, coin.toUpperCase());

                  const transferInfo = {
                    digest: info.digest,
                    sender: info.sender,
                    recipient: info.recipient,
                    amount: info.amount,
                    amountSui: info.amountSui,
                    coinType: 'SUI',
                    status: info.status,
                  } as const;

                  console.log('转账详情:', transferInfo);

                  const transferResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                    { role: 'system', content: transferResultPrompt(transferInfo) },
                  ];
                  const transferResultContent = await this.callOpenAIAPI(transferResultMessages, '转账成功结果');
                  return transferResultContent;
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
              return '转账失败，请稍后重试。';
            }
          } else {
            return transferParsed.errorMessage || '（空回复）';
          }

        default:
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