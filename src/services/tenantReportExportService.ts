import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tenant } from '@/hooks/useTenants';

export interface TenantExportFilters {
  search?: string;
  blacklistFilter?: string;
  loyaltyFilter?: string;
  sortBy?: string;
  locationName?: string;
}

export interface TenantExportStats {
  total: number;
  active: number;
  loyal: number;
  blacklisted: number;
  totalRevenue: number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getLoyaltyLabel(bookingCount: number): string {
  if (bookingCount === 0) return 'Nouveau';
  if (bookingCount >= 3) return 'VIP';
  return 'Régulier';
}

function getStatusLabel(listeNoire: boolean): string {
  return listeNoire ? 'Liste Noire' : 'Actif';
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export const exportTenantsToCsv = (
  tenants: Tenant[],
  filters: TenantExportFilters
): void => {
  const headers = [
    'Prénom',
    'Nom',
    'Téléphone',
    'Email',
    "Pièce d'identité",
    'Nb. Séjours',
    'Fidélité',
    'Volume ($)',
    'Statut',
    'Inscrit le',
  ];

  const rows = tenants.map((tenant) => {
    const bookingCount = tenant.booking_count || 0;
    const totalSpent = Number(tenant.total_spent || 0);
    return [
      tenant.prenom,
      tenant.nom?.toUpperCase(),
      tenant.telephone || '',
      tenant.email || '',
      tenant.id_document || '',
      bookingCount,
      getLoyaltyLabel(bookingCount),
      totalSpent.toFixed(2),
      getStatusLabel(tenant.liste_noire),
      format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: fr }),
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.join(';')),
  ].join('\n');

  // BOM pour Excel (encodage UTF-8 avec accents)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute(
    'download',
    `rapport_locataires_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

export const exportTenantsToPdf = (
  tenants: Tenant[],
  filters: TenantExportFilters,
  stats: TenantExportStats
): void => {
  const title = 'Rapport des Locataires';
  const dateGenerated = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });

  const filterLines = [
    filters.locationName ? `Site : ${filters.locationName}` : 'Site : Tous les sites',
    filters.search ? `Recherche : ${filters.search}` : null,
    filters.blacklistFilter && filters.blacklistFilter !== 'all'
      ? `Statut : ${filters.blacklistFilter === 'true' ? 'Liste Noire' : 'Actifs'}`
      : null,
    filters.loyaltyFilter && filters.loyaltyFilter !== 'all'
      ? `Fidélité : ${
          filters.loyaltyFilter === 'new'
            ? 'Nouveaux'
            : filters.loyaltyFilter === 'active'
            ? 'Réguliers'
            : 'VIP'
        }`
      : null,
  ]
    .filter(Boolean)
    .map((line) => `<p style="margin:2px 0">${line}</p>`)
    .join('');

  const tableRows = tenants
    .map((tenant) => {
      const bookingCount = tenant.booking_count || 0;
      const totalSpent = Number(tenant.total_spent || 0);
      const isVip = bookingCount >= 3;
      const isBlacklisted = tenant.liste_noire;

      return `
        <tr style="${isBlacklisted ? 'background:#fff5f5;' : isVip ? 'background:#fffbeb;' : ''}">
          <td><strong>${tenant.prenom} ${tenant.nom?.toUpperCase()}</strong></td>
          <td>${tenant.telephone || '—'}</td>
          <td style="color:#555">${tenant.email || '—'}</td>
          <td>${tenant.id_document || '—'}</td>
          <td style="text-align:center;font-weight:bold;${isVip ? 'color:#b45309' : ''}">${bookingCount}</td>
          <td style="text-align:center;font-size:9px;padding:4px 6px;">
            <span style="
              padding:2px 6px;border-radius:9999px;font-weight:bold;
              ${
                isVip
                  ? 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d'
                  : 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0'
              }
            ">${getLoyaltyLabel(bookingCount)}</span>
          </td>
          <td style="text-align:right;font-weight:bold;color:${totalSpent > 0 ? '#16a34a' : '#94a3b8'}">
            $${totalSpent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="text-align:center;font-size:9px;padding:4px 6px;">
            <span style="
              padding:2px 6px;border-radius:9999px;font-weight:bold;
              ${
                isBlacklisted
                  ? 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5'
                  : 'background:#dcfce7;color:#166534;border:1px solid #86efac'
              }
            ">${getStatusLabel(isBlacklisted)}</span>
          </td>
          <td style="color:#64748b;font-size:9px">${format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: fr })}</td>
        </tr>
      `;
    })
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 10px;
          margin: 24px;
          color: #1e293b;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #4f46e5;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 20px;
          margin: 0 0 4px 0;
          color: #4f46e5;
        }
        h2 {
          font-size: 13px;
          margin: 16px 0 8px 0;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 4px;
        }
        .meta { font-size: 9px; color: #64748b; }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .kpi-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          background: #f8fafc;
        }
        .kpi-card .label { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
        .kpi-card .value { font-size: 18px; font-weight: 900; margin-top: 2px; }
        .kpi-card.indigo .value { color: #4f46e5; }
        .kpi-card.emerald .value { color: #059669; }
        .kpi-card.amber .value { color: #d97706; }
        .kpi-card.red .value { color: #dc2626; }
        .kpi-card.green .value { color: #16a34a; }
        .filters-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 16px;
          font-size: 9px;
          color: #475569;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5px;
        }
        th {
          background: #f1f5f9;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 8px;
          letter-spacing: 0.05em;
          color: #64748b;
          padding: 7px 8px;
          border: 1px solid #e2e8f0;
          text-align: left;
        }
        td {
          padding: 6px 8px;
          border: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        tr:hover td { background: #f8fafc; }
        .footer {
          margin-top: 20px;
          font-size: 8px;
          color: #94a3b8;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          padding-top: 8px;
        }
        @media print {
          body { margin: 10px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>🏨 ${title}</h1>
          <div class="meta">Généré le ${dateGenerated} · ${tenants.length} locataire${tenants.length > 1 ? 's' : ''} exporté${tenants.length > 1 ? 's' : ''}</div>
        </div>
        <div class="meta" style="text-align:right">
          BotesImmo<br/>
          ${filters.locationName || 'Tous les sites'}
        </div>
      </div>

      <h2>Résumé</h2>
      <div class="kpi-grid">
        <div class="kpi-card indigo">
          <div class="label">Total</div>
          <div class="value">${stats.total}</div>
        </div>
        <div class="kpi-card emerald">
          <div class="label">Avec Séjours</div>
          <div class="value">${stats.active}</div>
        </div>
        <div class="kpi-card amber">
          <div class="label">Fidèles (2+)</div>
          <div class="value">${stats.loyal}</div>
        </div>
        <div class="kpi-card red">
          <div class="label">Liste Noire</div>
          <div class="value">${stats.blacklisted}</div>
        </div>
        <div class="kpi-card green">
          <div class="label">Volume Total</div>
          <div class="value" style="font-size:13px">$${stats.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      ${filterLines ? `<div class="filters-box"><strong>Filtres appliqués :</strong> ${filterLines}</div>` : ''}

      <h2>Liste des Locataires (${tenants.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Locataire</th>
            <th>Téléphone</th>
            <th>Email</th>
            <th>Pièce d'identité</th>
            <th style="text-align:center">Séjours</th>
            <th style="text-align:center">Fidélité</th>
            <th style="text-align:right">Volume ($)</th>
            <th style="text-align:center">Statut</th>
            <th>Inscrit le</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">Aucun locataire à afficher</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        BotesImmo · Rapport généré automatiquement le ${dateGenerated} · ${tenants.length} enregistrement${tenants.length > 1 ? 's' : ''}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
};
