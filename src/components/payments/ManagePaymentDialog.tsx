import { useState, useMemo, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { format, startOfToday, startOfDay, isAfter, differenceInCalendarDays, parseISO } from "date-fns";
import { Edit, Trash2, PlusCircle, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRate } from "@/hooks/useExchangeRate"; // Import exchange rate hook
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";

// Interface for the main component props for better readability
interface ManagePaymentDialogProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
}

// Sub-component for the payment form
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
  const { data: exchangeRateData } = useExchangeRate();
  const exchangeRate = exchangeRateData?.usd_to_cdf || 2800;

  // 🔥 NOUVEAU : États pour paiement mixte (USD + CDF séparés)
  const [amountUSD, setAmountUSD] = useState<number>(payment?.montant || 0);
  const [amountCDF, setAmountCDF] = useState<number>(0);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoice_id: payment?.invoice_id || invoices.find(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')?.id || undefined,
      montant: payment?.montant || 0,
      date_paiement: payment ? format(new Date(payment.date_paiement), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      methode: payment?.methode || "CASH",
    },
  });

  const selectedInvoiceId = useWatch({ control: form.control, name: 'invoice_id' });
  const selectedInvoice = useMemo(() => invoices.find(inv => inv.id === selectedInvoiceId), [invoices, selectedInvoiceId]);

  useEffect(() => {
    const initialUsd = payment?.montant_usd || payment?.montant || 0;
    const initialCdf = payment?.montant_cdf || 0;
    setAmountUSD(initialUsd);
    setAmountCDF(initialCdf);

    form.reset({
      ...form.getValues(),
      invoice_id: payment?.invoice_id || invoices.find(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')?.id || undefined,
      montant: payment?.montant || 0,
    });
  }, [payment, invoices, form]);

  const paymentStatusIndicator = useMemo(() => {
    const amount = amountUSD || 0;
    if (!selectedInvoice || !amount) return null;

    const balance = selectedInvoice.balance_due || 0;
    if (Math.abs(amount - balance) < 0.01) {
      return <Badge variant="success">Paiement complet</Badge>;
    } else if (amount > balance) {
      return <Badge variant="warning">Paiement avec surplus</Badge>;
    } else {
      return <Badge variant="secondary">Paiement partiel</Badge>;
    }
  }, [amountUSD, selectedInvoice]);

  const handleSubmit = async (data: PaymentFormData) => {
    try {
      // Préparer les données avec les montants physiques
      const commonData = {
        invoice_id: data.invoice_id ?? null,
        montant_usd: amountUSD,
        montant_cdf: amountCDF,
        taux_change: exchangeRate, // 🔥 Nouveau: on enregistre le taux utilisé
        montant: data.montant,
        date_paiement: data.date_paiement,
        methode: data.methode,
        notes: null,
      };

      if (payment) {
        await updatePayment.mutateAsync({
          ...commonData,
          id: payment.id,
          booking_id: booking.id
        });
      } else {
        await createPayment.mutateAsync({
          ...commonData,
          booking_id: booking.id
        });
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">

        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm space-y-3">
          {payableInvoices.length > 1 && !payment && (
            <FormField
              control={form.control}
              name="invoice_id"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Facture à imputer</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="Choisir une facture..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payableInvoices.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} (Reste: ${inv.balance_due?.toFixed(2)}$)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="montant"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={(val) => field.onChange(val)}
                    onChangeUsd={(usd) => setAmountUSD(usd)}
                    onChangeCdf={(cdf) => setAmountCDF(cdf)}
                    mode="independent"
                    labelUsd="Montant Reçu (USD)"
                    labelCdf="Montant Reçu (CDF)"
                    disabled={isSubmitting}
                    showStatusIndicator={false}
                    balanceDue={selectedInvoice?.balance_due || undefined}
                    initialUsd={payment?.montant_usd}
                    initialCdf={payment?.montant_cdf}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-between items-center pt-2 border-t border-slate-50">
            <span className="text-[10px] font-medium text-slate-400 italic">Statut paiement:</span>
            <div className="scale-90 origin-right">{paymentStatusIndicator}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="date_paiement"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Date</FormLabel>
                <FormControl>
                  <Input type="date" className="h-9 text-sm bg-white" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="methode"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Méthode</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CASH">Espèces</SelectItem>
                    <SelectItem value="CB">Banque</SelectItem>
                    <SelectItem value="TRANSFERT">Virement</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
  const { data: invoicesResult, isLoading: isLoadingInvoices } = useInvoices({ filters: { bookingId: booking?.id }, pagination: { pageIndex: 0, pageSize: 100 } });
  const { data: exchangeRateData } = useExchangeRate();
  const invoices = invoicesResult?.data || [];
  const deletePayment = useDeletePayment();

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Late Stay Debt Calculation (Nguma logic)
  const overdueInfo = useMemo(() => {
    if (!booking) return { isOverdue: false, lateNights: 0, lateStayDebt: 0 };
    const today = startOfToday();
    const endDate = startOfDay(parseISO(booking.date_fin_prevue));
    const isOverdue = isAfter(today, endDate) && booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && !booking.check_out_reel;

    if (isOverdue) {
      const lateNights = differenceInCalendarDays(today, endDate);
      const startDate = startOfDay(parseISO(booking.date_debut_prevue));
      const plannedNights = differenceInCalendarDays(endDate, startDate);
      const dailyRate = plannedNights > 0 ? booking.prix_total / plannedNights : 0;
      return { isOverdue, lateNights, lateStayDebt: lateNights * dailyRate };
    }
    return { isOverdue: false, lateNights: 0, lateStayDebt: 0 };
  }, [booking]);

  const totalWithDebt = useMemo(() => (booking?.prix_total || 0) + overdueInfo.lateStayDebt, [booking, overdueInfo]);
  const totalPaid = useMemo(() => payments.reduce((acc, p) => acc + p.montant, 0), [payments]);
  const remaining = useMemo(() => totalWithDebt - totalPaid, [totalWithDebt, totalPaid]);

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

        <div className="py-4 space-y-4">
          {overdueInfo.isOverdue && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-3 animate-pulse">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-red-800">Dépassement de séjour détecté ({overdueInfo.lateNights} nuits)</p>
                <p className="text-red-700 text-xs">Une dette supplémentaire de <span className="font-black">${overdueInfo.lateStayDebt.toFixed(2)}</span> a été ajoutée au total.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 text-center p-4 rounded-lg bg-muted/50 border">
            <div>
              <Label className="text-xs text-muted-foreground">{overdueInfo.isOverdue ? 'Nouveau Total' : 'Total à payer'}</Label>
              <p className="text-lg font-bold">${totalWithDebt.toLocaleString('fr-FR')}</p>
              {overdueInfo.isOverdue && <p className="text-[10px] text-muted-foreground line-through opacity-50">${booking.prix_total.toLocaleString('fr-FR')}</p>}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Total versé</Label>
              <p className="text-lg font-bold text-green-600">${totalPaid.toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Solde restant</Label>
              <p className="text-lg font-bold text-red-600">${Math.max(0, remaining).toLocaleString('fr-FR')}</p>
              {remaining > 0 && <p className="text-xs text-muted-foreground">~ {(remaining * (exchangeRateData?.usd_to_cdf || 2800)).toLocaleString()} FC</p>}
            </div>
          </div>

          {!(isAdding || editingPayment) ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex justify-between items-center">
                Historique des paiements
                {(role === 'ADMIN' || role === 'AGENT_RES') && remaining > 0.01 && (
                  <Button size="sm" variant="outline" onClick={() => { setIsAdding(true); setEditingPayment(null); }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Ajouter un paiement
                  </Button>
                )}
              </h3>
              {isLoading ? <p>Chargement...</p> : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré.</p>
              ) : (
                <div className="border rounded-md max-h-[300px] overflow-y-auto">
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
                            <TableCell className="font-medium p-2">
                              <div>${p.montant.toLocaleString('fr-FR')}</div>
                              <div className="text-[10px] text-muted-foreground font-normal">
                                ({(p.montant_usd || 0).toFixed(2)}$
                                {p.montant_cdf > 0 ? ` + ${(p.montant_cdf || 0).toLocaleString()} FC` : ''})
                              </div>
                            </TableCell>
                            <TableCell className="p-2">{format(new Date(p.date_paiement), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="p-2">{p.methode}</TableCell>
                            <TableCell className="p-2 truncate max-w-[100px] text-[10px]">{relatedInvoice?.invoice_number || '-'}</TableCell>
                            <TableCell className="space-x-1 p-2">
                              {(role === 'ADMIN' || role === 'AGENT_RES') && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPayment(p); setIsAdding(false); }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
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
          ) : (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="font-bold text-indigo-700 flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Saisie du paiement
              </h3>
              <PaymentForm
                booking={booking}
                payment={editingPayment}
                invoices={invoices}
                onFinished={handleFinishEditing}
              />
            </div>
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