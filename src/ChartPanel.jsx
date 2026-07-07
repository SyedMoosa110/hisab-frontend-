import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

export default function ChartPanel({ data, currency }) {
  return <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip formatter={(value) => currency(value)} />
      <Area dataKey="income" stroke="#0f766e" fill="#99f6e4" />
      <Area dataKey="expense" stroke="#dc2626" fill="#fecaca" />
    </AreaChart>
  </ResponsiveContainer>
}
