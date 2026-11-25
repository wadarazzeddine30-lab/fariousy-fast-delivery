import { ClientPayment, PackageItem } from '../types';

/**
 * Exports data to CSV with UTF-8 BOM so Microsoft Excel opens it seamlessly with accented French characters.
 */
export function exportPackagesToCSV(packages: PackageItem[], filename = 'fariousy_colis.csv') {
  const headers = [
    'N° Suivi',
    'Date Création',
    'Expéditeur (Client)',
    'Téléphone Expéditeur',
    'Destinataire',
    'Téléphone Destinataire',
    'Ville Destinataire',
    'Adresse',
    'Prix Produit (MAD)',
    'Frais Livraison (MAD)',
    'Montant Encaisser COD (MAD)',
    'Statut',
    'Livreur Assigné',
    'Agence Actuelle',
    'Statut Paiement Client'
  ];

  const rows = packages.map(p => [
    p.trackingNumber,
    p.createdAt.substring(0, 10),
    `"${(p.clientCompany || p.clientName).replace(/"/g, '""')}"`,
    p.clientPhone,
    `"${p.recipientName.replace(/"/g, '""')}"`,
    p.recipientPhone,
    `"${p.city.replace(/"/g, '""')}"`,
    `"${p.address.replace(/"/g, '""')}"`,
    p.productPrice,
    p.deliveryFee,
    p.codAmount,
    `"${p.status}"`,
    `"${(p.driverName || 'Non assigné').replace(/"/g, '""')}"`,
    `"${p.currentAgency.replace(/"/g, '""')}"`,
    p.isPaidToClient ? 'Versé au client' : 'En attente de versement'
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportFinancialStatementToCSV(payments: ClientPayment[], filename = 'fariousy_releves_financiers.csv') {
  const headers = [
    'Réf. Relevé',
    'Date Règlement',
    'Client / Entreprise',
    'Nombre de Colis',
    'Total Encaissé COD (MAD)',
    'Total Frais Livraison (MAD)',
    'Net Versé (MAD)',
    'Mode de Paiement',
    'Statut',
    'Remarques'
  ];

  const rows = payments.map(p => [
    p.reference,
    p.date,
    `"${p.clientCompany.replace(/"/g, '""')}"`,
    p.packageCount,
    p.totalCollected,
    p.totalDeliveryFees,
    p.netAmount,
    `"${p.paymentMethod}"`,
    p.status === 'paye' ? 'Réglé' : 'En attente',
    `"${(p.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generic CSV exporter supporting array of objects with UTF-8 BOM
 */
export function exportCSV(data: Record<string, any>[], filename = 'export.csv') {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'number') return val;
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(';')
  );

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
