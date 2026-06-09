import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface Props {
  data: Array<Record<string, any>>;
  dataKey?: string;
  layout?: 'horizontal' | 'vertical';
}

const BarChartWrapper: React.FC<Props> = ({ data, dataKey = 'quests', layout = 'horizontal' }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : undefined}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type={layout === 'vertical' ? 'number' : undefined} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis type={layout === 'vertical' ? 'category' : undefined} dataKey={layout === 'vertical' ? 'skill' : undefined} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12 }} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
        <Bar dataKey={dataKey} fill="#8b5cf6" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BarChartWrapper;
