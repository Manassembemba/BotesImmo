import React, { useState, useEffect, useMemo } from 'react';
import { Booking, useExtendStay, useConfirmDeparture } from '@/hooks/useBookings';
import { Room } from '@/hooks/useRooms';
import { useToast } from '@/hooks/use-toast';
import { differenceInCalendarDays, format, isValid } from 'date-fns';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarPlus, Loader2, LogOut, AlertTriangle } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { cn } from '@/lib/utils';

interface CheckoutDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  room: Room;
}

type DecisionMode = 'choice' | 'extend' | 'overdue_settle';

export function CheckoutDecisionDialog({ open, onOpenChange, booking, room }: CheckoutDecisionDialogProps) {
  const [mode, setMode] = useState<DecisionMode>('choice');
  const [newEndDate, setNewEndDate] = useState(format(new Date(booking.date_fin_prevue), 'yyyy-MM-dd'));
  const [discountPerNight, setDiscountPerNight] = useState(0); // Réduction par nuit

  const { data: exchangeRateData } = useExchangeRate(); // Récupérer le taux

  const { toast } = useToast();
  const confirmDeparture = useConfirmDeparture();
  const extendStay = useExtendStay();

  const isProcessing = confirmDeparture.isPending || extendStay.isPending;

  // Calcul du prix basé sur les dates avec réduction
  const calculatedPrice = useMemo(() => {
    const startDate = new Date(booking.date_debut_prevue);
    const endDate = new Date(newEndDate);

    if (!isValid(startDate) || !isValid(endDate) || endDate < startDate) {
      return booking.prix_total; // Retourner le prix original si dates invalides
    }

    const totalNights = differenceInCalendarDays(endDate, startDate);
    const baseTotal = totalNights * room.prix_base_nuit;
    const totalDiscount = totalNights * discountPerNight;
    const calculatedTotal = baseTotal - totalDiscount;

    // S'assurer que le prix ne descend pas en dessous de zéro
    return Math.max(calculatedTotal, 0);
  }, [newEndDate, booking, room, discountPerNight]);

  // Calcul des détails pour l'affichage
  const extensionDetails = useMemo(() => {
    const currentEndDate = new Date(booking.date_fin_prevue);
    const newEndDateObj = new Date(newEndDate);

    if (!isValid(currentEndDate) || !isValid(newEndDateObj) || newEndDateObj <= currentEndDate) {
      return { extraNights: 0, extraCost: 0, extraDiscount: 0 };
    }

    const extraNights = differenceInCalendarDays(newEndDateObj, currentEndDate);
    const extraCost = extraNights * room.prix_base_nuit;
    const extraDiscount = extraNights * discountPerNight;

    return { extraNights, extraCost, extraDiscount };
  }, [newEndDate, booking, room, discountPerNight]);

  // Suppression useEffect synchro prix manuel

  // Detect if overdue
  const overdueInfo = useMemo(() => {
    const today = new Date();
    const plannedEnd = new Date(booking.date_fin_prevue);
    if (plannedEnd < today) {
      const daysOrh = differenceInCalendarDays(today, plannedEnd);
      if (daysOrh > 0) {
        const debtAmount = daysOrh * (room.prix_base_nuit - discountPerNight);
        return { isOverdue: true, days: daysOrh, debtAmount };
      }
    }
    return { isOverdue: false, days: 0, debtAmount: 0 };
  }, [booking.date_fin_prevue, room.prix_base_nuit, discountPerNight]);

  // Réinitialiser les états lors de l'ouverture du dialogue
  useEffect(() => {
    if (open) {
      setNewEndDate(format(new Date(booking.date_fin_prevue), 'yyyy-MM-dd'));
      // Calculer la réduction par nuit existante
      const start = new Date(booking.date_debut_prevue);
      const end = new Date(booking.date_fin_prevue);
      const originalNights = differenceInCalendarDays(end, start);
      let originalDiscountPerNight = 0;
      if (originalNights > 0) {
        const originalTotalWithoutDiscount = originalNights * room.prix_base_nuit;
        const totalDiscount = originalTotalWithoutDiscount - booking.prix_total;
        originalDiscountPerNight = totalDiscount / originalNights;
      }
      setDiscountPerNight(originalDiscountPerNight);
    }
  }, [open, booking, room]);

  const handleConfirmDeparture = async () => {
    try {
      await confirmDeparture.mutateAsync({
        bookingId: booking.id,
        roomId: room.id,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur est survenue lors de la confirmation du départ.'
      });
    }
  };

  const handleExtendStay = async () => {
    const extendedEndDate = new Date(newEndDate);
    const originalEndDate = new Date(booking.date_fin_prevue);

    if (extendedEndDate <= originalEndDate) {
      toast({
        variant: 'destructive',
        title: 'Date invalide',
        description: 'La nouvelle date doit être après la date de fin actuelle.'
      });
      return;
    }

    if (extendedEndDate <= new Date()) {
      toast({
        variant: 'destructive',
        title: 'Date invalide',
        description: 'La nouvelle date de fin ne peut pas être dans le passé.'
      });
      return;
    }

    const finalPrice = calculatedPrice;

    // Validation supplémentaire pour s'assurer que le prix est raisonnable
    if (finalPrice <= 0) {
      toast({
        variant: 'destructive',
        title: 'Prix invalide',
        description: 'Le prix total doit être supérieur à zéro.'
      });
      return;
    }

    try {
      await extendStay.mutateAsync({
        bookingId: booking.id,
        newEndDate: newEndDate,
        newTotalBookingPrice: finalPrice, // Prix total de la réservation complète (du début à la nouvelle date de fin)
        extensionDiscountPerNight: discountPerNight, // Passer la réduction par nuit
      });

      // Réinitialiser l'état après succès
      setMode('choice');
      onOpenChange(false);

      toast({
        title: 'Séjour prolongé',
        description: `Le séjour a été prolongé avec succès jusqu'au ${format(extendedEndDate, 'dd/MM/yyyy')}.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur de prolongation',
        description: `Échec de la prolongation: ${(error as Error).message}`
      });
    }
  };

  const resetAndClose = (open: boolean) => {
    setMode('choice');
    setNewEndDate(format(new Date(booking.date_fin_prevue), 'yyyy-MM-dd'));
    // Réinitialiser la réduction avec la valeur d'origine
    const originalNights = differenceInCalendarDays(new Date(booking.date_fin_prevue), new Date(booking.date_debut_prevue));
    let originalDiscountPerNight = 0;
    if (originalNights > 0) {
      const originalTotalWithoutDiscount = originalNights * room.prix_base_nuit;
      const totalDiscount = originalTotalWithoutDiscount - booking.prix_total;
      originalDiscountPerNight = totalDiscount / originalNights;
    }
    setDiscountPerNight(originalDiscountPerNight);
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chambre {room.numero} - Check-out</DialogTitle>
          <DialogDescription>
            {booking.tenants?.prenom} {booking.tenants?.nom} •
            Fin prévue: {format(new Date(booking.date_fin_prevue), 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        {mode === 'choice' ? (
          <div className="space-y-6 py-4">
            {overdueInfo.isOverdue && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-pulse-soft">
                <AlertTriangle className="h-6 w-6 text-red-600 mt-1 shrink-0" />
                <div>
                  <p className="font-bold text-red-800 text-sm">Dépassement de séjour !</p>
                  <p className="text-red-700 text-xs">
                    Le client a {overdueInfo.days} jour(s) de retard.
                    Un surcoût de <span className="font-bold">{overdueInfo.debtAmount.toFixed(2)}$</span> est à régulariser.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              <Button
                variant="default"
                size="lg"
                className={cn(
                  "w-full justify-start gap-3 h-auto py-4 shadow-lg transition-all",
                  overdueInfo.isOverdue ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                )}
                onClick={handleConfirmDeparture}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                <div className="text-left">
                  <div className="font-bold text-base">Confirmer le départ</div>
                  <div className="text-xs opacity-90">
                    {overdueInfo.isOverdue ? "Clôturer avec les jours de retard." : "Clôturer le séjour normalement."}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 h-auto py-4 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                onClick={() => setMode('extend')}
                disabled={isProcessing}
              >
                <CalendarPlus className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-bold text-base">Prolonger pour régulariser</div>
                  <div className="text-xs text-muted-foreground">
                    Ajouter des jours officiels à la réservation.
                  </div>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newEndDate">Nouvelle date de fin</Label>
                <Input
                  id="newEndDate"
                  type="date"
                  value={newEndDate}
                  min={overdueInfo.isOverdue ? format(new Date(), 'yyyy-MM-dd') : format(new Date(booking.date_fin_prevue), 'yyyy-MM-dd')}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>

              {/* Réduction par nuit (Désactivée car récupérée de la réservation) */}
              <div className="space-y-2">
                <Label htmlFor="discountPerNight">Réduction / nuit ($)</Label>
                <div className="relative">
                  <Input
                    id="discountPerNight"
                    type="number"
                    value={discountPerNight}
                    disabled={true} // Désactivé comme demandé
                    className="pl-8 bg-muted"
                  />
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Affichage du Nouveau Prix Total */}
            <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nouveau Prix Total</p>
                <p className="text-2xl font-bold">
                  {calculatedPrice.toFixed(2)} $
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Équivalent CDF</p>
                <p className="text-xl font-bold text-blue-600">
                  {(calculatedPrice * (exchangeRateData?.usd_to_cdf || 2800)).toLocaleString()} FC
                </p>
              </div>
            </div>

            {/* Détails de l'extension */}
            {extensionDetails.extraNights > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-sm space-y-1 border border-blue-100 dark:border-blue-800">
                <div className="flex justify-between font-medium">
                  <span>Extension ({extensionDetails.extraNights} nuits) :</span>
                  <span>+ {(extensionDetails.extraCost - extensionDetails.extraDiscount).toFixed(2)} $</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMode('choice')}
                disabled={isProcessing}
              >
                Retour
              </Button>
              <Button
                className="flex-1"
                onClick={handleExtendStay}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmer la prolongation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
