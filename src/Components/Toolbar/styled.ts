import styled from 'styled-components';

export const ToolBarContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--pixel-font-primary);
  gap: 32px;
  padding: 14px 28px;
  position: relative;
  border-radius: 0px;
  background: linear-gradient(145deg, rgba(8,32,20,0.9), rgba(10,48,28,0.88) 55%, rgba(14,62,36,0.82));
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.07);
  box-shadow:
    0 4px 24px -6px rgba(0,0,0,0.55),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 0 20px -6px rgba(0,180,120,0.35),
    0 0 42px -10px rgba(0,255,170,0.15);
  overflow: hidden;
  transition: box-shadow .45s cubic-bezier(.25,.6,.3,1), transform .45s cubic-bezier(.25,.6,.3,1);

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 1.2px; /* 外层发光描边厚度 */
    border-radius: inherit;
  background: linear-gradient(120deg,#0affb6,#00e676,#00b86b,#0affb6);
    background-size: 300% 300%;
    animation: toolbarGradient 8s linear infinite;
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    pointer-events: none;
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
  background: radial-gradient(circle at 22% 18%, rgba(0,255,170,0.22), transparent 60%),
        radial-gradient(circle at 78% 70%, rgba(0,200,120,0.18), transparent 65%);
    mix-blend-mode: plus-lighter;
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow:
      0 8px 34px -6px rgba(0,0,0,0.65),
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 0 30px -6px rgba(0,230,150,0.55),
      0 0 10px -2px rgba(0,255,170,0.6),
      0 0 32px -4px rgba(0,150,100,0.35);
  }

  @keyframes toolbarGradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

export const WelcomeText = styled.div`
  font-size: 28px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 1px;
  font-family: var(--pixel-font-primary);
  background: linear-gradient(110deg,#e8fff2 0%,#b6ffe0 30%,#74ffc7 55%,#34f5a2 75%,#e8fff2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  position: relative;
  text-shadow: 0 2px 10px rgba(0,255,170,0.35), 0 0 4px rgba(0,255,170,0.45), 0 0 2px rgba(255,255,255,0.5);
  display: flex;
  align-items: center;
  gap: 10px;

  &:after {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff, #4dffca 60%, transparent 70%);
  box-shadow: 0 0 8px 2px rgba(0,255,170,0.65), 0 0 18px 6px rgba(0,150,110,0.4);
    animation: pulseDot 2.8s ease-in-out infinite;
  }

  @keyframes pulseDot {
    0%, 100% { transform: scale(1); opacity: 0.85; }
    50% { transform: scale(1.4); opacity: 0.4; }
  }
`;

export const TypingCursor = styled.span`
  display: inline-block;
  width: 14px;
  height: 26px;
  margin-left: 4px;
  background: linear-gradient(120deg,#0affb6,#34f5a2);
  box-shadow: 0 0 6px rgba(0,255,170,0.65), 0 0 14px -2px rgba(0,200,140,0.55);
  animation: blinkCursor 0.9s steps(1,end) infinite;
  border-radius: 2px;

  @keyframes blinkCursor {
    0%, 55% { opacity: 1; }
    56%, 100% { opacity: 0; }
  }
`;
