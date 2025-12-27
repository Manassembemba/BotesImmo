import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Download, FileText, TrendingUp, DollarSign, BedDouble } from 'lucide-react';
import { Link } from 'react-router-dom';

const Reports = () => {
  const reports = [
    {
      title: 'Rapport de revenus',
      description: 'Analyse détaillée des revenus par chambre et par période',
      icon: DollarSign,
      color: 'text-status-available',
      path: '/reports/revenue',
    },
    {
      title: 'Taux d\'occupation',
      description: 'Statistiques d\'occupation mensuelle et annuelle',
      icon: TrendingUp,
      color: 'text-primary',
      path: null,
    },
    {
      title: 'Performance des chambres',
      description: 'Rentabilité et popularité par type de chambre',
      icon: BedDouble,
      color: 'text-status-pending-cleaning',
      path: null,
    },
    {
      title: 'Rapport financier complet',
      description: 'Export des données comptables au format PDF/CSV',
      icon: FileText,
      path: '/reports/financial-report',
    },
  ];

  return (
    <MainLayout title="Rapports" subtitle="Analyses et exports de données">
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report, index) => (
          <div 
            key={report.title}
            className="rounded-xl border bg-card p-6 shadow-soft hover:shadow-medium transition-all animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-secondary ${report.color}`}>
                  <report.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              {console.log(`Report: ${report.title}, Path: ${report.path}, Path truthy: ${!!report.path}`)}
              {report.path ? (
                <Button asChild variant="secondary" size="sm" className="ml-auto">
                  <Link to={report.path}>Générer</Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className="ml-auto" disabled>
                  Générer
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
};

export default Reports;
