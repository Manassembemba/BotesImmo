import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useBookings } from "@/hooks/useBookings";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Home, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceListForBooking } from "@/components/invoices/InvoiceListForBooking";

interface TenantBookingsDialogProps {
    tenantId: string;
    tenantName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    CONFIRMED: { label: 'Confirmé', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    IN_PROGRESS: { label: 'En cours', color: 'bg-green-100 text-green-800 border-green-200' },
    COMPLETED: { label: 'Terminée', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-800 border-red-200' },
    PENDING_CHECKOUT: { label: 'Départ attendu', color: 'bg-orange-100 text-orange-800 border-orange-200' },
};

export const TenantBookingsDialog = ({
    tenantId,
    tenantName,
    open,
    onOpenChange
}: TenantBookingsDialogProps) => {
    const { data: bookingsResult, isLoading } = useBookings({
        tenantId: tenantId,
    }, { pageIndex: 0, pageSize: 50 });

    const bookings = bookingsResult?.data || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Historique des réservations : {tenantName}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Chargement des réservations...</p>
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <p className="font-medium text-foreground">Aucune réservation recordée</p>
                        <p className="text-sm text-muted-foreground">Ce locataire n'a pas encore effectué de séjour.</p>
                    </div>
                ) : (
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Dates du séjour</TableHead>
                                    <TableHead>Appartement</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead>Factures</TableHead>
                                    <TableHead>Finances (USD)</TableHead>
                                    <TableHead>Paiement</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bookings.map((booking) => {
                                    const status = STATUS_CONFIG[booking.status] || { label: booking.status, color: 'bg-gray-100' };
                                    const financial = booking.booking_financial_summary?.[0];
                                    const totalPaid = financial?.total_paid || 0;
                                    const totalInvoiced = financial?.total_invoiced || 0;
                                    const balance = financial?.balance_due || 0;

                                    return (
                                        <TableRow key={booking.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="text-sm">
                                                    {format(new Date(booking.date_debut_prevue), 'dd MMM yyyy', { locale: fr })}
                                                    <span className="mx-1">→</span>
                                                    {format(new Date(booking.date_fin_prevue), 'dd MMM yyyy', { locale: fr })}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    Créée le {format(new Date(booking.created_at), 'dd/MM/yyyy')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Home className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="font-semibold">App. {booking.rooms?.numero}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground ml-5">
                                                    {booking.rooms?.type}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("font-medium", status.color)}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="text-xs flex justify-between w-24">
                                                        <span className="text-muted-foreground">Total:</span>
                                                        <span className="font-bold">${totalInvoiced.toLocaleString('fr-FR')}</span>
                                                    </div>
                                                    <div className="text-xs flex justify-between w-24">
                                                        <span className="text-muted-foreground">Payé:</span>
                                                        <span className="font-semibold text-green-600">${totalPaid.toLocaleString('fr-FR')}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <InvoiceListForBooking bookingId={booking.id} />
                                            </TableCell>
                                            <TableCell>
                                                {balance > 0.01 ? (
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="destructive" className="text-[10px] h-5 mb-1">
                                                            Reste: ${balance.toLocaleString('fr-FR')}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground italic">
                                                            Statut: {financial?.payment_summary_status === 'PARTIAL' ? 'Partiel' : 'Impayé'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                                        Totalement payé
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
