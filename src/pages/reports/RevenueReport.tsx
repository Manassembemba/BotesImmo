import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAllPayments } from '@/hooks/usePayments';
import { format, parseISO, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/components/CurrencyDisplay';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const RevenueReport = () => {
  const { data: payments = [], isLoading } = useAllPayments();
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());

  const { monthlyData, totalRevenue, availableYears } = useMemo(() => {
    if (!payments || payments.length === 0) {
      return { monthlyData: [], totalRevenue: 0, availableYears: [] };
    }

    const revenueByMonth: { [key: string]: number } = {};
    const years = new Set<string>();

    payments.forEach(payment => {
      const date = parseISO(payment.date_paiement);
      const year = getYear(date).toString();
      years.add(year);

      if (year === selectedYear) {
        const month = format(date, 'yyyy-MM');
        revenueByMonth[month] = (revenueByMonth[month] || 0) + payment.montant;
      }
    });

    const sortedData = Object.entries(revenueByMonth)
      .map(([month, revenue]) => ({
        month,
        name: format(parseISO(month), 'MMM', { locale: fr }),
        revenue,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const total = sortedData.reduce((acc, item) => acc + item.revenue, 0);
    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));

    return { monthlyData: sortedData, totalRevenue: total, availableYears: sortedYears };
  }, [payments, selectedYear]);

  const handleExportCsv = () => {
    if (monthlyData.length === 0) return;
    const headers = ['Mois', 'Revenu (USD)'];
    const rows = monthlyData.map(row => [
      format(parseISO(row.month), 'MMMM yyyy', { locale: fr }),
      row.revenue.toFixed(2)
    ]);
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport-revenus-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (monthlyData.length === 0) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Rapport de Revenus - Année ${selectedYear}`, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Revenu total pour l'année: ${formatCurrency(totalRevenue).usd}`, 14, 32);
    
    autoTable(doc, {
      startY: 40,
      head: [['Mois', 'Revenu (USD)']],
      body: monthlyData.map(row => [
        format(parseISO(row.month), 'MMMM yyyy', { locale: fr }),
        formatCurrency(row.revenue).usd
      ]),
      foot: [['Total', formatCurrency(totalRevenue).usd]],
      showFoot: 'lastPage',
      headStyles: { fillColor: [22, 163, 74] },
    });

    doc.save(`rapport-revenus-${selectedYear}.pdf`);
  };

  if (isLoading) {
    return (
      <MainLayout title="Rapport de Revenus" subtitle="Analyse mensuelle des revenus">
        <p>Chargement des données...</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Rapport de Revenus" subtitle={`Analyse des revenus pour l'année ${selectedYear}`}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Options</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Select onValueChange={setSelectedYear} defaultValue={selectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sélectionner une année" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenu Total ({selectedYear})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue).usd}</div>
              <p className="text-xs text-muted-foreground">Total des paiements enregistrés pour l'année</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenus Mensuels ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value).usd, 'Revenu']} />
                <Legend />
                <Bar dataKey="revenue" name="Revenu Mensuel" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Détail des Revenus Mensuels ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Revenu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">Aucune donnée pour cette année.</TableCell>
                  </TableRow>
                )}
                {monthlyData.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{format(parseISO(row.month), 'MMMM yyyy', { locale: fr })}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue).usd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </MainLayout>
  );
};

export default RevenueReport;