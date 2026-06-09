import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface BarSpec { dataKey: string; fill?: string; name?: string }
interface Props {
  data: Array<Record<string, any>>;
  xKey?: string;
  bars: BarSpec[];
}

const MultiBarChartWrapper: React.FC<Props> = ({ data, xKey = 'date', bars }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} />
        <YAxis axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
        {bars.map((b) => (
          <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill ?? '#6366f1'} name={b.name} radius={[8, 8, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MultiBarChartWrapper;
