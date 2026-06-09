import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface Props {
  data: Array<Record<string, any>>;
  colors?: string[];
}

const PieChartWrapper: React.FC<Props> = ({ data, colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'] }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label />
        {data.map((_, i) => (
          <Cell key={i} fill={colors[i % colors.length]} />
        ))}
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default PieChartWrapper;
