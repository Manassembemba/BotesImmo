import { Room } from '@/hooks/useRooms';
import { Booking } from '@/hooks/useBookings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExportOptions {
  format: 'csv' | 'pdf';
  includeBookings?: boolean;
  includePricing?: boolean;
  dateRange?: { start: Date; end: Date };
  roomType?: string;
}

// Fonction pour exporter les données de disponibilité
export const exportAvailabilityData = (
  rooms: Room[],
  bookings: Booking[],
  options: ExportOptions
): void => {
  if (options.format === 'csv') {
    exportToCSV(rooms, bookings, options);
  } else {
    exportToPDF(rooms, bookings, options);
  }
};

// Exporter vers CSV
const exportToCSV = (rooms: Room[], bookings: Booking[], options: ExportOptions): void => {
  // Filtrer les données selon les options
  let filteredRooms = [...rooms];
  if (options.roomType) {
    filteredRooms = filteredRooms.filter(r => r.type === options.roomType);
  }

  // Calculer les données à exporter pour chaque chambre
  const csvRows = [
    ['N° Chambre', 'Type', 'Étage', 'Capacité', 'Disponible', 'Prix/Nuit (USD)', 'Prochaine dispo', 'Statut']
  ];

  filteredRooms.forEach(room => {
    // Déterminer si la chambre est disponible
    const isAvailable = room.status === 'AVAILABLE';
    
    // Calculer la prochaine disponibilité
    const nextAvailableDate = getNextAvailableDate(room, bookings);
    
    // Déterminer le statut complet
    const roomStatus = getRoomStatus(room, bookings);
    
    csvRows.push([
      room.numero,
      room.type,
      room.etage.toString(),
      room.capacite_max.toString(),
      isAvailable ? 'Oui' : 'Non',
      room.prix_base_nuit.toString(),
      nextAvailableDate,
      roomStatus.label
    ]);
  });

  // Convertir en texte CSV
  const csvContent = csvRows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `disponibilite_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Exporter vers PDF
const exportToPDF = (rooms: Room[], bookings: Booking[], options: ExportOptions): void => {
  // Nous allons générer une page HTML temporaire qui sera imprimée comme PDF
  let filteredRooms = [...rooms];
  if (options.roomType) {
    filteredRooms = filteredRooms.filter(r => r.type === options.roomType);
  }

  // Créer le contenu HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Disponibilité des chambres</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #1e40af; margin-bottom: 5px; }
        .header p { color: #6b7280; margin: 0; }
        .info-bar { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .stats { display: flex; gap: 20px; }
        .stat-box { background: #f3f4f6; padding: 10px 15px; border-radius: 5px; }
        .table-container { margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: #1e40af; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .available { color: #16a34a; font-weight: bold; }
        .unavailable { color: #dc2626; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>DISPONIBILITÉ DES CHAMBRES</h1>
        <p>${options.dateRange ? `Période: ${format(options.dateRange.start, 'dd/MM/yyyy', { locale: fr })} - ${format(options.dateRange.end, 'dd/MM/yyyy', { locale: fr })}` : 'Toutes les dates'}</p>
      </div>
      
      <div class="info-bar">
        <div class="stats">
          <div class="stat-box">Chambres: ${filteredRooms.length}</div>
          <div class="stat-box">Disponibles: ${filteredRooms.filter(r => getRoomStatus(r, bookings).status === 'available').length}</div>
          <div class="stat-box">Occupées: ${bookings.filter(b => b.status === 'IN_PROGRESS' || b.status === 'CONFIRMED').length}</div>
        </div>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>N° Chambre</th>
              <th>Type</th>
              <th>Étage</th>
              <th>Capacité</th>
              <th>Disponibilité</th>
              <th>Prix/Nuit (USD)</th>
              <th>Prochaine dispo</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRooms.map(room => {
              const roomStatus = getRoomStatus(room, bookings);
              const nextAvailableDate = getNextAvailableDate(room, bookings);
              const isAvailable = roomStatus.status === 'available';

              return `
                <tr>
                  <td>${room.numero}</td>
                  <td>${room.type}</td>
                  <td>${room.etage}</td>
                  <td>${room.capacite_max}</td>
                  <td class="${roomStatus.status === 'available' ? 'available' : 'unavailable'}">${roomStatus.status === 'available' ? 'Oui' : 'Non'}</td>
                  <td>${room.prix_base_nuit}</td>
                  <td>${nextAvailableDate}</td>
                  <td>${roomStatus.label}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>Extrait le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} | Botes Immo</p>
      </div>
    </body>
    </html>
  `;

  // Ouvrir dans une nouvelle fenêtre pour impression
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    newWindow.focus();
    newWindow.onload = () => {
      newWindow.print();
    };
  }
};

// Fonction utilitaire pour déterminer le statut d'une chambre
const getRoomStatus = (room: Room, bookings: Booking[]) => {
  // Chercher les réservations actives pour cette chambre
  const activeBookings = bookings.filter(b => 
    b.room_id === room.id && 
    b.status === 'IN_PROGRESS' && 
    new Date(b.date_debut_prevue) <= new Date() && 
    new Date(b.date_fin_prevue) >= new Date()
  );

  if (activeBookings.length > 0) {
    return { status: 'occupied' as const, label: 'Occupée' };
  }

  // Chercher les réservations futures pour cette chambre
  const futureBookings = bookings.filter(b => 
    b.room_id === room.id && 
    b.status === 'CONFIRMED' && 
    new Date(b.date_debut_prevue) > new Date()
  );

  if (futureBookings.length > 0) {
    return { status: 'booked' as const, label: 'Réservée' };
  }

  // Statut de la chambre dans la base de données
  if (room.status === 'MAINTENANCE') {
    return { status: 'maintenance' as const, label: 'En maintenance' };
  }

  return { status: 'available' as const, label: 'Disponible' };
};

// Fonction utilitaire pour déterminer la prochaine disponibilité
const getNextAvailableDate = (room: Room, bookings: Booking[]): string => {
  // Trouver les réservations futures pour cette chambre
  const futureBookings = bookings
    .filter(b => 
      b.room_id === room.id && 
      b.status !== 'CANCELLED' && 
      new Date(b.date_debut_prevue) > new Date()
    )
    .sort((a, b) => new Date(a.date_debut_prevue).getTime() - new Date(b.date_fin_prevue).getTime());

  if (futureBookings.length === 0) {
    return 'Maintenant';
  }

  const firstBooking = futureBookings[0];
  return format(new Date(firstBooking.date_fin_prevue), 'dd/MM/yyyy', { locale: fr });
};