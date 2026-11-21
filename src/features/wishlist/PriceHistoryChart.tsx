import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import type { WishlistPricePoint } from '@/domain/types'
import { formatBRL } from '@/lib/money'
export default function PriceHistoryChart({ points }: {points:WishlistPricePoint[]}) { const data=[...points].sort((a,b)=>a.verificado_em.localeCompare(b.verificado_em)).map(p=>({date:p.verificado_em.slice(0,10),valor:p.preco_centavos})); return <div className="h-52 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tickFormatter={v=>formatBRL(Number(v))} width={80} tick={{fontSize:10}}/><Tooltip formatter={v=>formatBRL(Number(v))}/><Line dataKey="valor" stroke="#629b52" dot={false}/></LineChart></ResponsiveContainer></div> }
