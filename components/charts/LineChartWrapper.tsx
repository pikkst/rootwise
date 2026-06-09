import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface Props {
  data: Array<Record<string, any>>;
  dataKey?: string;
}

const LineChartWrapper: React.FC<Props> = ({ data, dataKey = 'xp' }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }} />
        <Line type="monotone" dataKey={dataKey} stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineChartWrapper;
