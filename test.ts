// import { getPools } from '@naviprotocol/lending'
// // import { writeFile } from 'node:fs/promises'

// const pools = await getPools({
//   env: 'prod', // Optional: environment configuration
//   cacheTime: 30000 // Optional: cache time
// })
// // 组装 symbol 为 key 的大字典
// const simplePoolsInfo: Record<string, { coinType: string; decimals: number }> = {};
// for (const pool of pools) {
//   simplePoolsInfo[pool.token.symbol.toUpperCase()] = {
//     coinType: pool.coinType,
//     decimals: pool.token.decimals
//   };
// }
// console.log(Object.keys(simplePoolsInfo));
// // 将结果写入文本文件（JSON 格式化，便于阅读）        
// const outPath = 'pools1.txt'
// console.log(simplePoolsInfo);
// import fetch from 'node-fetch'; // 在 Node.js 环境中需要安装这个库

// async function checkYouTube() {
//   const url = 'https://www.youtube.com/';

//   try {
//     const response = await fetch(url, {
//       method: 'GET',
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
//       }
//     });

//     if (response.ok) {
//       console.log(`成功连接到 ${url}！状态码: ${response.status}`);
//       console.log('---');
//       console.log('网络连接正常。');
//     } else {
//       console.log(`连接失败，状态码: ${response.status} ${response.statusText}`);
//       console.log('---');
//       console.log(`服务器返回了错误。这可能意味着URL无法访问或被阻止。`);
//     }
//   } catch (error) {
//     console.error(`发生错误:`);
//     console.log('---');
//     console.log('很可能由于网络问题导致连接失败，例如DNS解析失败、网络不通或防火墙阻止。');
//   }
// }

// checkYouTube();

import { getLendingState } from '@naviprotocol/lending'

const lendingStates = await getLendingState("0x7a706ef9264044bb7f995451a6232f8ce81d1cec3aee48dd87451fe22816b8fb")
console.log(lendingStates)