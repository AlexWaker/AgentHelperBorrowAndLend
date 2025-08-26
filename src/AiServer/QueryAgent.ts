// import { useSuiClient, useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
// import { queryCoinPrompt, queryResultPrompt } from './QueryPrompt';
// import {useOpenAIMessages} from '../hooks/useOpenAIMessages';
// import OpenAI from 'openai';

// const currentAccount = useCurrentAccount();
// const isWalletConnected = !!currentAccount;
// const walletAddress = currentAccount?.address;
// const { openAIMessages, setOpenAIMessages } = useOpenAIMessages();
// const suiClient = useSuiClient();

// class QueryAgent {

//     private secondIntentAnalysis: () => Promise<string>{
//         const messagesWithSystem: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
//                 { role: 'system', content: queryCoinPrompt() },
//                 ...openAIMessages
//               ];
//               const completion = await this.client.chat.completions.create({
//                 model: this.model,
//                 messages: messagesWithSystem,
//                 max_tokens: 1000,
//                 temperature: 0.7,
//                 stream: false,
//               });
        
//               const content = completion.choices[0]?.message?.content;
//               return content;
//     }

//     async callQueryAgent(): Promise<string> {
//         // 既然已经确定是查询余额，那进行第二次分析，即用户的指令是否明确
//         return `初次意图分析结果：${input}`;
//     }

//     async secondIntentAnalysis(input: string): Promise<string> {
//         // 这里是二次意图分析的逻辑
//         return `二次意图分析结果：${input}`;
//     }
// }

// const queryAgent = new QueryAgent();
// export default queryAgent;