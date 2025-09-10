import styled from 'styled-components';

export const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: radial-gradient(circle at 25% 15%, rgba(0,255,170,0.08), transparent 60%),
              radial-gradient(circle at 80% 70%, rgba(0,180,120,0.06), transparent 65%),
              linear-gradient(140deg, #061d13, #0a2b1c 55%, #0f3a27);
  color: #ecfff7;
  overflow: hidden;
`;

export const Header = styled.div`
  padding: 14px 22px;
  background: linear-gradient(135deg, rgba(10,48,28,0.85), rgba(12,58,34,0.8));
  backdrop-filter: blur(10px) saturate(1.4);
  -webkit-backdrop-filter: blur(10px) saturate(1.4);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 2px 10px -4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg,#0affb6,#00e676,#00b86b,#0affb6);
    background-size: 260% 260%;
    opacity: 0.12;
    mix-blend-mode: screen;
    animation: headerFlow 10s linear infinite;
    pointer-events: none;
  }
  @keyframes headerFlow { 0%{background-position:0% 50%;} 50%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
`;

export const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  background: linear-gradient(110deg,#e8fff2 0%,#b6ffe0 30%,#74ffc7 55%,#34f5a2 75%,#e8fff2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  letter-spacing: .5px;
  text-shadow: 0 2px 10px rgba(0,255,170,0.25), 0 0 4px rgba(0,255,170,0.35);
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  &:after {
    content: '';
    width: 7px; height: 7px; border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #fff, #4dffca 60%, transparent 70%);
    box-shadow: 0 0 6px 2px rgba(0,255,170,0.6), 0 0 12px 5px rgba(0,150,110,0.35);
    animation: pulseTitle 3s ease-in-out infinite;
  }
  @keyframes pulseTitle { 0%,100%{transform:scale(1);opacity:.9;} 50%{transform:scale(1.35);opacity:.5;} }
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(4px);
`;

export const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px 26px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
  scrollbar-gutter: stable;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: linear-gradient(#093423,#0e3d2c); border-radius: 4px; }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(160deg,#15c98e,#00a86d);
    border-radius: 4px;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.4) inset;
  }
  &::-webkit-scrollbar-thumb:hover { background: linear-gradient(160deg,#19e6a2,#00c27d); }
  @keyframes loadingPulse { 0%,80%,100% { opacity:.25; transform:scale(.78);} 40% { opacity:1; transform:scale(1);} }
`;

export const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #90b2a3;
  text-align: center;
  padding: 42px 20px;
  opacity: .85;
`;

export const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

export const EmptyTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 550;
  background: linear-gradient(120deg,#ccffe9,#8bffd2,#45f5ab,#ccffe9);
  background-clip: text; -webkit-background-clip: text; color: transparent;
`;

export const EmptyDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: #6aa88f;
`;

export const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const MessageMeta = styled.div<{ $isUser: boolean }>`
  font-size: 11px;
  color: ${props => props.$isUser ? '#73eab9' : '#6aa88f'};
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  padding: 0 4px;
  letter-spacing: .3px;
`;

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const LoadingDots = styled.div`
  display: flex;
  gap: 4px;
`;

export const LoadingDot = styled.div<{ $delay: number }>`
  width: 7px; height: 7px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff, #43e6b0 60%, #00a86d 90%);
  box-shadow: 0 0 6px 2px rgba(0,255,170,0.45), 0 0 14px 5px rgba(0,150,110,0.3);
  animation: loadingPulse 1.4s ease-in-out infinite;
  animation-delay: ${props => props.$delay}s;
`;

export const InputContainer = styled.div`
  padding: 18px 22px 20px;
  background: linear-gradient(135deg, rgba(10,48,28,0.9), rgba(14,62,36,0.85));
  border-top: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(10px) saturate(1.4);
  -webkit-backdrop-filter: blur(10px) saturate(1.4);
  box-shadow: 0 -2px 10px -4px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
`;

export const InputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
  max-width: 800px;
  margin: 0 auto;
`;

export const TextArea = styled.textarea`
  flex: 1;
  min-height: 48px;
  max-height: 140px;
  padding: 14px 18px 14px 18px;
  border: 1px solid rgba(0,255,170,0.15);
  border-radius: 20px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  background: linear-gradient(145deg, rgba(8,32,20,0.72), rgba(10,48,28,0.72));
  color: #dfffee;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 2px 6px -2px rgba(0,0,0,0.5);
  transition: border-color .25s ease, box-shadow .25s ease, background .3s ease;
  &:focus {
    border-color: rgba(0,255,170,0.55);
    box-shadow: 0 0 0 1px rgba(0,255,170,0.35), 0 0 14px -2px rgba(0,255,170,0.55);
    background: linear-gradient(145deg, rgba(10,48,28,0.82), rgba(12,58,34,0.82));
  }
  &:disabled {
    background: rgba(12,40,28,0.4);
    color: #6aa88f;
    cursor: not-allowed;
    border-color: rgba(255,255,255,0.05);
  }
  &::placeholder { color: #5f8d79; }
  &::-webkit-scrollbar { width: 0px; background: transparent; }
`;

export const SendButton = styled.button<{ $canSend: boolean }>`
  width: 46px; height: 46px; border: none; border-radius: 50%;
  background: ${props => props.$canSend 
    ? 'linear-gradient(145deg,#12e3a1,#00b875 70%)'
    : 'linear-gradient(145deg,#1f3c2d,#173025)'};
  color: ${props => props.$canSend ? '#ffffff' : '#4d7a67'};
  cursor: ${props => props.$canSend ? 'pointer' : 'not-allowed'};
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; position: relative; isolation: isolate;
  box-shadow: ${props => props.$canSend 
    ? '0 0 0 1px rgba(255,255,255,0.06) inset, 0 4px 14px -4px rgba(0,255,170,0.55), 0 0 18px -2px rgba(0,255,170,0.55)'
    : '0 0 0 1px rgba(255,255,255,0.04) inset, 0 2px 6px -2px rgba(0,0,0,0.5)'};
  transition: transform .25s ease, box-shadow .3s ease, background .3s ease, filter .3s ease;
  &:before { content:''; position:absolute; inset:0; border-radius:inherit; opacity:${props => props.$canSend ? .35 : 0}; background:radial-gradient(circle at 35% 30%,rgba(255,255,255,0.9),rgba(255,255,255,0.05) 55%,transparent 70%); mix-blend-mode:overlay; transition:opacity .3s ease; }
  &:hover { ${props => props.$canSend ? 'transform: translateY(-3px) scale(1.05); box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset,0 6px 20px -6px rgba(0,255,170,0.65),0 0 26px -2px rgba(0,255,170,0.7);' : ''} }
  &:hover:before { opacity:${props => props.$canSend ? .55 : 0}; }
  &:active { ${props => props.$canSend ? 'transform:translateY(0) scale(.94); filter:brightness(.95);' : ''} }
`;

export const MessageBubble = styled.div<{ $isUser: boolean; $isError?: boolean }>`
  max-width: 70%;
  padding: 13px 18px 14px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word; white-space: pre-wrap;
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  position: relative;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: box-shadow .35s ease, transform .25s ease, background .4s ease;
  ${props => props.$isUser ? `
    background: linear-gradient(140deg,#12e3a1,#00b875 70%);
    color: #ffffff;
    border: 1px solid rgba(255,255,255,0.16);
    box-shadow: 0 4px 14px -4px rgba(0,255,170,0.55), 0 0 14px -2px rgba(0,200,140,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset;
    border-bottom-right-radius: 6px;
  ` : props.$isError ? `
    background: linear-gradient(140deg,#3d1212,#451818);
    color: #ffb3b3;
    border: 1px solid rgba(255,120,120,0.35);
    box-shadow: 0 4px 12px -6px rgba(255,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset;
    border-bottom-left-radius: 6px;
  ` : `
    background: linear-gradient(140deg,rgba(8,40,28,0.78),rgba(12,56,36,0.78));
    color: #dfffee;
    border: 1px solid rgba(0,255,170,0.15);
    box-shadow: 0 3px 10px -4px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 10px -2px rgba(0,200,140,0.25);
    border-bottom-left-radius: 6px;
  `}
  &:hover { ${props => props.$isUser ? 'transform:translateY(-2px); box-shadow:0 6px 18px -6px rgba(0,255,170,0.65),0 0 22px -2px rgba(0,255,170,0.65);' : props.$isError ? '' : 'transform:translateY(-2px); box-shadow:0 6px 16px -6px rgba(0,0,0,0.6),0 0 16px -2px rgba(0,255,170,0.35);'} }
`;

// 清空按钮样式
export const ClearButton = styled.button<{ disabled?: boolean }>`
  padding: 8px 14px 9px;
  border: 1px solid rgba(0,255,170,0.25);
  background: linear-gradient(140deg,rgba(8,40,28,0.65),rgba(12,56,36,0.65));
  color: #98ffe0;
  border-radius: 10px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.55 : 1};
  font-size: 13px;
  line-height: 18px;
  display: inline-flex;
  align-items: center; gap: 6px;
  letter-spacing: .4px;
  transition: background .3s ease, box-shadow .35s ease, transform .2s ease, color .3s ease;
  box-shadow: 0 2px 8px -4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
  &:hover { ${props => props.disabled ? '' : 'background:linear-gradient(140deg,rgba(10,54,36,0.8),rgba(14,70,46,0.8)); box-shadow:0 4px 14px -6px rgba(0,255,170,0.45),0 0 14px -2px rgba(0,255,170,0.4);'} }
  &:active { ${props => props.disabled ? '' : 'transform:scale(.94);'} }
`;

// Markdown 样式组件
export const MarkdownParagraph = styled.div`
  margin: 0;
  line-height: 1.4;
`;

export const MarkdownList = styled.ul`
  margin: 8px 0;
  padding-left: 20px;
`;

export const MarkdownOrderedList = styled.ol`
  margin: 8px 0;
  padding-left: 20px;
`;

export const MarkdownListItem = styled.li`
  margin-bottom: 4px;
`;

export const MarkdownInlineCode = styled.code`
  background: rgba(0,255,170,0.12);
  padding: 2px 6px 3px;
  border-radius: 5px;
  font-size: 0.88em;
  border: 1px solid rgba(0,255,170,0.25);
`;

export const MarkdownCodeBlock = styled.pre`
  background: linear-gradient(145deg, rgba(8,40,28,0.8), rgba(14,62,36,0.82));
  padding: 12px 14px;
  border-radius: 10px;
  overflow: auto;
  font-size: 0.84em;
  line-height: 1.5;
  border: 1px solid rgba(0,255,170,0.18);
  box-shadow: 0 2px 10px -4px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset;
  &::-webkit-scrollbar { height: 8px; }
  &::-webkit-scrollbar-track { background: rgba(12,50,36,0.4); }
  &::-webkit-scrollbar-thumb { background: linear-gradient(160deg,#15c98e,#00a86d); border-radius: 4px; }
`;

export const MarkdownBlockquote = styled.blockquote`
  border-left: 3px solid rgba(0,255,170,0.5);
  padding-left: 14px;
  margin: 10px 0;
  font-style: italic;
  color: #a9ffe8;
  background: linear-gradient(130deg,rgba(8,40,28,0.5),rgba(12,56,36,0.48));
  border-radius: 6px;
  padding-top: 8px; padding-bottom: 8px;
`;

export const MarkdownH1 = styled.h1`
  font-size: 1.2em;
  margin: 8px 0 4px 0;
  font-weight: bold;
`;

export const MarkdownH2 = styled.h2`
  font-size: 1.1em;
  margin: 8px 0 4px 0;
  font-weight: bold;
`;

export const MarkdownH3 = styled.h3`
  font-size: 1.05em;
  margin: 6px 0 4px 0;
  font-weight: bold;
`;