import { getPools } from '@naviprotocol/lending'
import { writeFile } from 'node:fs/promises'

const pools = await getPools({
  env: 'prod', // Optional: environment configuration
  cacheTime: 30000 // Optional: cache time
})
const normalizePool = (allInfoPool: any) => {
        // 不同 SDK 字段名可能不同，这里做多路兜底
        const id = allInfoPool.id || 0;
        const symbol = allInfoPool.token.symbol || 'UNKNOWN';
        const borrowAPY = Number(allInfoPool.borrowIncentiveApyInfo.apy) || 0;
        const supplyAPY = Number(allInfoPool.supplyIncentiveApyInfo.apy) || 0;
        const price = Number(allInfoPool.oracle.price) || 0;
        return {
            id,
            symbol,
            borrowAPY,
            supplyAPY,
            price
        };
    }

console.log(typeof pools)
// 将结果写入文本文件（JSON 格式化，便于阅读）
const outPath = 'pools.txt'
await writeFile(outPath, JSON.stringify(pools, null, 2), 'utf8')
const simplePoolsInfo = pools.map(pool => normalizePool(pool));
console.log(simplePoolsInfo)