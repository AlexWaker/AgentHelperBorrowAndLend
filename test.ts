import { getPools } from '@naviprotocol/lending'
import { writeFile } from 'node:fs/promises'

const pools = await getPools({
  env: 'prod', // Optional: environment configuration
  cacheTime: 30000 // Optional: cache time
})
// 组装 symbol 为 key 的大字典
const simplePoolsInfo: Record<string, { coinType: string; decimals: number }> = {};
for (const pool of pools) {
  simplePoolsInfo[pool.token.symbol.toUpperCase()] = {
    coinType: pool.coinType,
    decimals: pool.token.decimals
  };
}
console.log(Object.keys(simplePoolsInfo));
// 将结果写入文本文件（JSON 格式化，便于阅读）
const outPath = 'pools1.txt'
await writeFile(outPath, JSON.stringify(simplePoolsInfo, null, 2), 'utf8')
console.log(simplePoolsInfo);