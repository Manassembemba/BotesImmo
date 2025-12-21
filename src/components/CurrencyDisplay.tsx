import { useExchangeRate } from '@/hooks/useExchangeRate';

interface CurrencyDisplayProps {
  amountUSD: number;
  showBoth?: boolean;
  className?: string;
}

export function CurrencyDisplay({ amountUSD, showBoth = true, className = '' }: CurrencyDisplayProps) {
  const { data: exchangeRate } = useExchangeRate();
  const rate = exchangeRate?.usd_to_cdf || 2800;
  
  const amountCDF = amountUSD * rate;

  const formatUSD = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  
  const formatCDF = (amount: number) => 
    new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF', maximumFractionDigits: 0 }).format(amount);

  if (!showBoth) {
    return <span className={className}>{formatUSD(amountUSD)}</span>;
  }

  return (
    <span className={className}>
      <span className="font-medium">{formatUSD(amountUSD)}</span>
      <span className="text-muted-foreground text-sm ml-1">
        ({formatCDF(amountCDF)})
      </span>
    </span>
  );
}

export function formatCurrency(amountUSD: number, rate: number = 2800) {
  const amountCDF = amountUSD * rate;
  
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountUSD);
  const cdf = new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF', maximumFractionDigits: 0 }).format(amountCDF);
  
  return { usd, cdf, combined: `${usd} (${cdf})` };
}
