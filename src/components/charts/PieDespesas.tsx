import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatBRL } from '@/lib/money'

export interface PieSlice {
  name: string
  value: number // centavos
  color: string
}

/** Pizza de despesas por categoria. Some quando não há dados (empty state fora). */
export function PieDespesas({ data }: { data: PieSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => formatBRL(Number(v) || 0)}
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e2e7f1',
                borderRadius: 12,
                color: '#201f2b',
                boxShadow: '0 4px 12px rgba(0,0,0,.06)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: d.color }}
            />
            <span className="flex-1 truncate text-app-fg2">{d.name}</span>
            <span className="tnum text-app-fg">{formatBRL(d.value)}</span>
            <span className="tnum w-10 text-right text-xs text-app-muted">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
