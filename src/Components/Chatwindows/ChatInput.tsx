import React, { useState, useRef, KeyboardEvent } from 'react';
import { InputContainer, InputWrapper, TextArea, SendButton } from './styled';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  placeholder = "输入消息..." 
}) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整文本域高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmedMessage = inputValue.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setInputValue('');
      // 重置文本域高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const canSend = inputValue.trim().length > 0 && !disabled;

  return (
    <InputContainer>
      <InputWrapper>
        <TextArea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={disabled ? "AI 正在回复中..." : placeholder}
          disabled={disabled}
          rows={1}
        />
        <SendButton
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          $canSend={canSend}
          title={canSend ? "发送消息 (Enter)" : "请输入消息"}
        >
          ↑
        </SendButton>
      </InputWrapper>
    </InputContainer>
  );
};

export default ChatInput;