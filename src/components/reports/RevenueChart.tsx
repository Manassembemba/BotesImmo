"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
}

export const RevenueChart = ({ data }: RevenueChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">Pas de données à afficher pour la période sélectionnée.</p>
      </div>
    );
  }

  const formatXAxis = (tickItem: string) => {
    return format(new Date(tickItem), 'dd/MM');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border shadow-sm rounded-lg p-3">
          <p className="font-semibold">{format(new Date(label), 'eeee, dd LLL yyyy')}</p>
          <p className="text-sm text-green-600">
            Revenu: <CurrencyDisplay amountUSD={payload[0].value} />
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatXAxis} />
          <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line type="monotone" dataKey="revenue" name="Revenu" stroke="#16a34a" strokeWidth={2} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
