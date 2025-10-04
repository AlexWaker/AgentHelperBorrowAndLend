import React from "react";
import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import App from "./App.tsx";
import { GlobalStyle } from './globalStyles';
import { networkConfig } from "./networkConfig.ts";
import { suiService } from './SuiServer/SuiService';

const queryClient = new QueryClient();
const env = import.meta.env.VITE_SUI_ENV

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <GlobalStyle />
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork={env}>
          <WalletProvider autoConnect>
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </Theme>
  </React.StrictMode>,
);

// 后台预热：不阻塞 UI，尽快获取最新池子并填充 coinInfo（含动态币种 & 缓存更新）
// 允许静默失败
Promise.resolve().then(() => {
  try { suiService.warmPools(); } catch {}
});
