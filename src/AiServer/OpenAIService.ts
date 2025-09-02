import OpenAI from 'openai'; // 引入 OpenAI SDK 客户端
import { Message } from '../Components/Chatwindows/types'; // 引入聊天消息类型定义
import { intentTypeTs } from './IntentTypeTs'; // 引入意图类型常量（TS 版本）
import { normalPrompt, firstIntentAnalysis } from './GlobalPrompt'; // 引入通用系统提示与首轮意图分析提示
import { queryCoinPrompt, queryResultPrompt } from './QueryPrompt'; // 引入查询余额相关提示
import { suiService } from '../SuiServer/SuiService'; // 引入与 Sui 链交互的服务
import {transferCoinPrompt, transferResultPrompt} from './TransferPrompt' // 引入转账相关提示

class OpenAIService { // 封装与大模型交互的服务类
  private client: OpenAI; // OpenAI 客户端实例
  private model: string; // 使用的模型名称

  constructor() { // 构造函数，初始化客户端与模型
    // 从环境变量获取配置（Vite 使用 import.meta.env）
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || ''; // API Key，默认空字符串
    const baseURL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.deepseek.com'; // 可自定义基础 URL
    this.model = import.meta.env.VITE_OPENAI_MODEL || 'deepseek-chat'; // 模型名，默认 deepseek-chat
    this.client = new OpenAI({ // 创建 OpenAI 客户端实例
      baseURL, // 设置基础 URL
      apiKey, // 设置 API Key
      dangerouslyAllowBrowser: true, // 允许在浏览器环境使用
    });
  } // 构造函数结束

  // 设置 API Key（运行时配置）
  setApiKey(apiKey: string) { // 允许在运行时替换新的 API Key
    this.client = new OpenAI({ // 重新实例化客户端
      baseURL: this.client.baseURL, // 复用现有的 baseURL
      apiKey, // 新的 Key
      dangerouslyAllowBrowser: true, // 允许浏览器环境
    });
  } // 方法结束：setApiKey

  // 将消息格式转换为 OpenAI 格式（使用外部工具函数）
  private convertToOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] { // 转换消息角色与内容
    return messages.map(msg => ({ // 映射每条消息
      role: // 映射 role 字段
        msg.sender === 'user' ? 'user' as const : // 用户消息
        msg.sender === 'system' ? 'system' as const : // 系统消息
        'assistant' as const, // 其他视为助手消息
      content: msg.content // 原样传递消息内容
    })); // 返回转换后的消息数组
  } // 方法结束：convertToOpenAIMessages

  // 提取并解析模型返回中的首个 JSON 块（支持 ```json 代码块与普通文本）
  private extractAndParseJSON<T = any>(text: string): T { // 从回复文本中提取 JSON
    // 1) 优先匹配 ```json ... ``` 或通用 ``` ... ```
    const fenced = text.match(/```\s*json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i); // 尝试匹配代码块
    if (fenced?.[1]) { // 命中代码块
      const candidate = fenced[1].trim(); // 取出并去除首尾空白
      return JSON.parse(candidate); // 解析为 JSON
    }

    // 2) 解析首个平衡的大括号 JSON 片段
    const start = text.indexOf('{'); // 查找第一个大括号位置
    if (start === -1) throw new Error('未找到 JSON 起始大括号'); // 未找到则报错
    let depth = 0; // 括号深度计数
    let inStr: false | '"' | "'" = false; // 是否在字符串内
    let escape = false; // 是否处于转义状态
    let end = -1; // 结束位置
    for (let i = start; i < text.length; i++) { // 从起始位置遍历
      const ch = text[i]; // 当前字符
      if (inStr) { // 在字符串内时处理转义与结束
        if (escape) { // 上一字符是反斜杠
          escape = false; // 清除转义标记
        } else if (ch === '\\') { // 检测转义开始
          escape = true; // 标记进入转义
        } else if (ch === inStr) { // 字符串结束引号
          inStr = false; // 退出字符串
        }
        continue; // 继续下一字符
      }
      if (ch === '"' || ch === "'") { // 非字符串时，如遇引号则进入字符串
        inStr = ch as '"' | "'"; // 标记当前字符串引号类型
        continue; // 继续下一字符
      }
      if (ch === '{') depth++; // 左大括号深度+1
      if (ch === '}') depth--; // 右大括号深度-1
      if (depth === 0) { end = i; break; } // 深度回到 0，记录结束位置并终止
    }
    if (end === -1) throw new Error('未找到完整 JSON 片段'); // 未找到成对括号则报错
    const jsonSlice = text.slice(start, end + 1).trim(); // 切出 JSON 片段
    return JSON.parse(jsonSlice) as T; // 解析并返回
  } // 方法结束：extractAndParseJSON

  // 封装 OpenAI API 调用的通用方法
  private async callOpenAIAPI( // 通用的聊天补全调用封装
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], // 输入消息数组
    logPrefix: string = 'OpenAI', // 日志前缀，便于调试
  ): Promise<string> { // 返回模型的文本回复
    // 调试输出，标记调用来源
    try { // 尝试输出日志（防止某些环境 console 受限）
      console.debug(`[${logPrefix}] 请求开始，消息数: ${messages.length}`); // 输出消息数量
    } catch {} // 忽略日志异常
    const completion = await this.client.chat.completions.create({ // 发起聊天补全请求
      model: this.model, // 使用的模型
      messages: messages, // 消息列表
      max_tokens: 1000, // 最大返回长度
      temperature: 0.2, // 采样温度
      stream: false, // 非流式
    }); // 请求结束，得到补全结果

    const content = completion.choices[0]?.message?.content; // 取首个候选的内容

    if (!content) { // 如果没有返回内容
      throw new Error(`[${logPrefix}] API 返回数据格式错误`); // 抛出错误
    }

    return content; // 返回模型文本
  } // 方法结束：callOpenAIAPI
  

  // 使用 Agent 系统处理消息，也是处理一切消息的入口
  async processWithAgent( // Agent 主流程：意图识别、执行与回复
    messages: Message[], // 历史消息列表
    isWalletConnected: boolean, // 钱包是否已连接
    walletAddress?: string, // 当前钱包地址（可选）
    signer?: (args: { transaction: any; chain?: string }) => Promise<any> // 钱包签名执行器（可选）
  ): Promise<string> { // 返回最终给用户的自然语言回复

    if(!isWalletConnected){ // 若未连接钱包
      return '请先连接钱包以使用 AI 助手功能'; // 返回提示信息
    }
    
    const lastMessage = messages[messages.length - 1]; // 取最后一条消息
    if (!lastMessage) { // 无消息可处理
      throw new Error('没有消息需要处理'); // 抛出错误
    }

    try { // 主流程 try 包裹
      // 使用 convertToOpenAIMessages 转换消息格式
      const openAIMessages = this.convertToOpenAIMessages(messages); // 转为 OpenAI 消息格式

      // 在这里将firstIntentAnalysis的返回值作为系统提示词与openAIMessages一同发送给AI
      const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 组装带系统提示的消息
        { role: 'system', content: normalPrompt() }, // 通用系统指令
        { role: 'system', content: firstIntentAnalysis() }, // 首轮意图分析指令
        ...openAIMessages // 加上用户与助手对话历史
      ]; // 数组结束
      
      const content = await this.callOpenAIAPI(messagesWithSystem, '最初始意图分析'); // 调用模型进行意图识别
      console.log('最初始意图分析回复:', content); // 打印调试信息

      // 把AI回复解析为json
      const parsed = this.extractAndParseJSON<{ intent: string, confidence: number, requiresWallet: boolean, reasoning: string }>(content); // 解析为意图对象

      switch (parsed.intent) { // 根据意图分流
        case intentTypeTs.QUERY_BALANCE: // 查询余额分支
          // 二次分析用户查询余额意图
          const balanceQueryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 组装余额查询提示
            { role: 'system', content: queryCoinPrompt(walletAddress) }, // 填入钱包上下文
            ...openAIMessages // 附带对话历史
          ]; // 数组结束
          const balanceContent = await this.callOpenAIAPI(balanceQueryMessages, '余额查询'); // 请求二次分析
          
          // 把AI回复解析为json
          const balanceParsed = this.extractAndParseJSON<{ address: string, coin: string, isValid: boolean, errorMessage: string }>(balanceContent); // 解析地址与币种

          if (balanceParsed.isValid) { // 若参数有效
            const address = balanceParsed.address; // 提取地址
            try { // 调用链上查询
              const balanceMist = await suiService.getCoinBalance(address, balanceParsed.coin.toLowerCase()); // 获取最小单位余额
              const balanceSui = suiService.toCoin(balanceParsed.coin.toLowerCase(), balanceMist); // 转成人类可读单位
              const short = address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address; // 地址缩略显示
              const queryResult =  `地址 ${short} 的 ${balanceParsed.coin} 余额：${balanceSui} ${balanceParsed.coin}（${balanceMist} MIST）`; // 组装结果文本
              console.log('查询结果:', queryResult); // 打印结果
              const queryResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 组装结果生成提示
                { role: 'system', content: queryResultPrompt(queryResult) }, // 将结果作为系统提示
              ]; // 数组结束
              const queryResultContent = await this.callOpenAIAPI(queryResultMessages, '查询成功结果'); // 让模型生成友好话术
              return queryResultContent; // 返回给前端

            } catch (e) { // 查询失败
              console.error('查询余额失败:', e); // 打印错误
              return '查询余额失败，请稍后重试。'; // 返回错误提示
            }
          } else { // 参数不充分/不合法
            // const suggestionContent = await this.callOpenAIAPI(queryErrorMessages, '建议回复'); // 可选：生成建议
            return balanceParsed.errorMessage || '（空回复）'; // 返回错误信息或空
          }

        case intentTypeTs.TRANSFER: // 转账分支
          // 二次分析用户转账意图
          const transferMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 组装转账提取提示
            { role: 'system', content: transferCoinPrompt(walletAddress) }, // 将钱包上下文传入
            ...openAIMessages // 添加对话历史
          ]; // 数组结束
          const transferContent = await this.callOpenAIAPI(transferMessages, '转账分析'); // 请求解析转账参数
          console.log('转账分析回复:', transferContent); // 打印调试

          // 把AI回复解析为json
          const transferParsed = this.extractAndParseJSON<{ fromAddress: string, toAddress: string, coin: string, amount: number, isValid: boolean, errorMessage: string }>(transferContent); // 解析转账参数

          if (transferParsed.isValid) { // 参数有效
            const { fromAddress, toAddress, coin, amount } = transferParsed; // 解构参数
            try { // 发起链上转账
              if (!signer) { // 未提供签名器
                return '无法发起转账：未提供钱包签名器，请先连接钱包或传入 signer。'; // 返回提示
              }
              if (!walletAddress) { // 未提供钱包地址
                return '无法发起转账：钱包地址未定义，请先连接钱包。'; // 返回提示
              }
              const transferResult = await suiService.transferSui({ // 调用服务层执行
                from: fromAddress, // 发送方
                to: toAddress, // 接收方
                coin: coin.toLowerCase(), // 币种小写标准化
                amountMist: suiService.toMist(coin.toLowerCase(), amount), // 转为最小单位
                signer // 钱包签名执行器
              }); // 等待返回结果

              // 在这里，我需要对转账结果进行处理，我需要提取：发送方、接收方、转账金额、转账币种，转账哈希这几个关键信息
              if (transferResult?.digest) { // 若返回了交易哈希
                try { // 尝试查询详情
                  // 使用极简方法获取关键信息
                  const info = await suiService.getTransactionDetails(transferResult.digest); // 查询交易详情

                  const transferInfo = { // 组装关键信息对象
                    digest: info.digest, // 交易哈希
                    sender: info.sender, // 发送方
                    recipient: info.recipient, // 接收方
                    amount: info.amount, // 金额（最小单位）
                    amountSui: info.amountSui, // 金额（人类单位）
                    coinType: 'SUI', // 币种类型（当前默认 SUI）
                    status: info.status, // 状态
                  } as const; // 只读常量对象

                  console.log('转账详情:', transferInfo); // 打印详情

                  const transferResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 结果生成提示
                    { role: 'system', content: transferResultPrompt(transferInfo) }, // 注入详情
                  ]; // 数组结束
                  const transferResultContent = await this.callOpenAIAPI(transferResultMessages, '转账成功结果'); // 生成用户可读话术
                  return transferResultContent; // 返回给前端
                } catch (detailError) { // 查询详情失败
                  console.error('获取转账详情失败:', detailError); // 打印错误
                  // 如果获取详情失败，仍使用基本的转账结果
                  const transferResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 仅用 digest 生成话术
                    { role: 'system', content: transferResultPrompt(transferResult.digest) }, // 注入哈希
                  ]; // 数组结束
                  const transferResultContent = await this.callOpenAIAPI(transferResultMessages, '转账成功结果'); // 生成话术
                  return transferResultContent; // 返回
                }
              } else { // 未返回 digest
                console.log('转账结果:', transferResult); // 打印原始结果
                return '转账已提交，但未获取到交易哈希，请稍后查看钱包确认结果。'; // 返回提示
              }

            } catch (e) { // 执行转账失败
              console.error('转账失败:', e); // 打印错误
              return '转账失败，请稍后重试。'; // 返回提示
            }
          } else { // 解析无效
            return transferParsed.errorMessage || '（空回复）'; // 返回错误信息
          }

        default: // 其他/闲聊分支
          // 闲聊：不加 firstIntentAnalysis，只用对话上下文
          const casualMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [ // 组装闲聊消息
            { role: 'system', content: normalPrompt() }, // 基础系统提示
            ...openAIMessages, // 对话历史
            { role: 'user', content: parsed.reasoning || '请根据用户最后的输入进行回复。' } // 用意图解析的 reasoning 作为用户输入引导
          ]; // 数组结束

          const casualContent = await this.callOpenAIAPI(casualMessages, '闲聊回复'); // 请求闲聊回复
          return casualContent || '（空回复）'; // 返回结果或空
      } // switch 结束
      
    } catch (error) { // 捕获主流程异常
      console.error('OpenAI API 调用失败:', error); // 打印错误
      
      if (error instanceof Error) { // 若为标准错误
        throw error; // 原样抛出
      }
      
      throw new Error('网络连接失败，请检查网络设置'); // 否则抛出通用网络错误
    }
  } // 方法结束：processWithAgent
} // 类定义结束

// 导出单例实例
export const openAIService = new OpenAIService(); // 默认导出的服务实例（单例）
export default OpenAIService; // 同时导出类定义供按需实例化