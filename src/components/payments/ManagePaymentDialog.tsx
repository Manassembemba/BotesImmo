import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Booking } from "@/hooks/useBookings";
import { usePaymentsByBooking, useCreatePayment, useUpdatePayment, useDeletePayment, type Payment } from "@/hooks/usePayments";
import { useInvoices } from "@/hooks/useInvoices";
import { type Invoice } from "@/interfaces/Invoice";
import { paymentSchema, type PaymentFormData } from "@/lib/validationSchemas";
import { format } from "date-fns";
import { Edit, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ManagePaymentDialogProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
}

function PaymentForm({
  booking,
  payment,
  invoices,
  onFinished,
}: {
  booking: Booking;
  payment?: Payment | null;
  invoices: Invoice[];
  onFinished: () => void;
}) {
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoice_id: payment?.invoice_id || invoices.find(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')?.id || undefined,
      montant: payment?.montant || undefined,
      date_paiement: payment ? format(new Date(payment.date_paiement), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      methode: payment?.methode || "CASH",
      notes: payment?.notes || "",
    },
  });

  useEffect(() => {
    form.reset({
      invoice_id: payment?.invoice_id || invoices.find(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')?.id || undefined,
      montant: payment?.montant || undefined,
      date_paiement: payment ? format(new Date(payment.date_paiement), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      methode: payment?.methode || "CASH",
      notes: payment?.notes || "",
    });
  }, [payment, invoices, form]);

  const handleSubmit = async (data: PaymentFormData) => {
    try {
      if (payment) {
        await updatePayment.mutateAsync({ ...data, id: payment.id, booking_id: booking.id });
      } else {
        await createPayment.mutateAsync({ ...data, booking_id: booking.id });
      }
      onFinished();
    } catch (error) {
      // Error is handled by the hook's onError callback
    }
  };

  const isSubmitting = createPayment.isPending || updatePayment.isPending;
  const payableInvoices = invoices.filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <h3 className="font-semibold text-lg">{payment ? "Modifier le paiement" : "Ajouter un paiement"}</h3>
        
        <FormField
          control={form.control}
          name="invoice_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Facture à payer</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting || !!payment || payableInvoices.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une facture..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {payableInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.total.toFixed(2)}$ (Solde: {inv.balance_due?.toFixed(2)}$)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="montant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || undefined)} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date_paiement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de paiement</FormLabel>
                <FormControl>
                  <Input type="date" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="methode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Méthode de paiement</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="CASH">Espèces</SelectItem>
                  <SelectItem value="CB">Carte Bancaire</SelectItem>
                  <SelectItem value="TRANSFERT">Virement</SelectItem>
                  <SelectItem value="CHEQUE">Chèque</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onFinished} disabled={isSubmitting}>Annuler</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {payment ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </form>
    </Form>
  );
}


export function ManagePaymentDialog({ booking, open, onClose }: ManagePaymentDialogProps) {
  const { role } = useAuth();
  const { data: payments = [], isLoading: isLoadingPayments } = usePaymentsByBooking(booking?.id || "");
  const { data: invoicesResult, isLoading: isLoadingInvoices } = useInvoices({ filters: { bookingId: booking?.id }, pagination: { pageIndex: 0, pageSize: 100 }});
  const invoices = invoicesResult?.data || [];
  const deletePayment = useDeletePayment();

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalPaid = useMemo(() => payments.reduce((acc, p) => acc + p.montant, 0), [payments]);
  const remaining = useMemo(() => (booking ? booking.prix_total - totalPaid : 0), [booking, totalPaid]);

  const handleFinishEditing = () => {
    setEditingPayment(null);
    setIsAdding(false);
  };

  const handleDelete = async () => {
    if (deleteId && booking) {
      await deletePayment.mutateAsync({ id: deleteId, booking_id: booking.id });
      setDeleteId(null);
    }
  }

  if (!booking) return null;
  const isLoading = isLoadingPayments || isLoadingInvoices;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gérer les paiements</DialogTitle>
          <DialogDescription>
            Pour la réservation de {booking.tenants?.prenom} {booking.tenants?.nom}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center p-4 rounded-lg bg-muted/50 border">
            <div>
              <Label className="text-xs text-muted-foreground">Total à payer</Label>
              <p className="text-lg font-bold">${booking.prix_total.toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Total versé</Label>
              <p className="text-lg font-bold text-green-600">${totalPaid.toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Solde restant</Label>
              <p className="text-lg font-bold text-red-600">${remaining.toLocaleString('fr-FR')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex justify-between items-center">
              Historique des paiements
              {(role === 'ADMIN' || role === 'AGENT_RES') && (
                <Button size="sm" variant="outline" onClick={() => { setIsAdding(true); setEditingPayment(null); }}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              )}
            </h3>
            {isLoading ? <p>Chargement...</p> : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré.</p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => {
                      const relatedInvoice = invoices.find(inv => inv.id === p.invoice_id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">${p.montant.toLocaleString('fr-FR')}</TableCell>
                          <TableCell>{format(new Date(p.date_paiement), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{p.methode}</TableCell>
                          <TableCell>{relatedInvoice?.invoice_number || '-'}</TableCell>
                          <TableCell className="space-x-2">
                            {(role === 'ADMIN' || role === 'AGENT_RES') && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingPayment(p); setIsAdding(false); }}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {(isAdding || editingPayment) && (
            <PaymentForm
              booking={booking}
              payment={editingPayment}
              invoices={invoices}
              onFinished={handleFinishEditing}
            />
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePayment.isPending}>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deletePayment.isPending} className="bg-destructive hover:bg-destructive/90">
                {deletePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
}