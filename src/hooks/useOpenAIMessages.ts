import { useState } from 'react';
import OpenAI from 'openai';

/**
 * OpenAI 消息状态管理钩子
 * @returns { openAIMessages, setOpenAIMessages }
 */
export const useOpenAIMessages = () => {
  const [openAIMessages, setOpenAIMessages] = useState<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>([]);

  return {
    openAIMessages,
    setOpenAIMessages
  };
};

export default useOpenAIMessages;
