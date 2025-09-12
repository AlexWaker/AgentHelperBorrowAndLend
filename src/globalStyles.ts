import { createGlobalStyle } from 'styled-components';

// 全局像素字体：使用免费像素字体 CDN（若需本地托管可后续下载）
// 可替换为自定义：Press Start 2P / VT323 / Pixelify Sans 等
export const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @font-face {
    font-family: 'PixelMplus';
    src: url('https://unpkg.com/pixelmplus@1.0.0/PixelMplus10-Regular.ttf') format('truetype');
    font-display: swap;
  }

  :root {
    --pixel-font-primary: 'Press Start 2P', 'PixelMplus', monospace;
  }

  html, body {
    font-family: var(--pixel-font-primary);
    letter-spacing: 0.5px;
    text-rendering: optimizeLegibility;
  }

  * {
    font-family: inherit;
  }

  button, input, textarea, select {
    font-family: inherit;
  }
`;
