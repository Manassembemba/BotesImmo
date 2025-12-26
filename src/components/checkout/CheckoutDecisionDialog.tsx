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
import { CalendarPlus, Calculator, Loader2, LogOut } from 'lucide-react';

interface CheckoutDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  room: Room;
}

type DecisionMode = 'choice' | 'extend';

export function CheckoutDecisionDialog({ open, onOpenChange, booking, room }: CheckoutDecisionDialogProps) {
  const [mode, setMode] = useState<DecisionMode>('choice');
  const [newEndDate, setNewEndDate] = useState(format(new Date(booking.date_fin_prevue), 'yyyy-MM-dd'));
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [manualPrice, setManualPrice] = useState(booking.prix_total.toString());
  const [discountPerNight, setDiscountPerNight] = useState(0); // Réduction par nuit

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

  // Synchroniser le prix manuel avec le calcul automatique
  useEffect(() => {
    if (!manualPriceOverride) {
      setManualPrice(calculatedPrice.toFixed(2));
    }
  }, [calculatedPrice, manualPriceOverride]);

  // Réinitialiser les états lors de l'ouverture du dialogue
  useEffect(() => {
    if (open) {
      setNewEndDate(format(new Date(booking.date_fin_prevue), 'yyyy-MM-dd'));
      // Calculer la réduction par nuit existante à partir de la réservation originale
      const originalNights = differenceInCalendarDays(new Date(booking.date_fin_prevue), new Date(booking.date_debut_prevue));
      let originalDiscountPerNight = 0;
      if (originalNights > 0) {
        const originalTotalWithoutDiscount = originalNights * room.prix_base_nuit;
        const totalDiscount = originalTotalWithoutDiscount - booking.prix_total;
        originalDiscountPerNight = totalDiscount / originalNights;
      }
      setDiscountPerNight(originalDiscountPerNight);
      setManualPriceOverride(false);

      // Calculer le prix initial basé sur la date actuelle et la réduction
      const initialDate = new Date(booking.date_fin_prevue);
      const startDate = new Date(booking.date_debut_prevue);
      const totalNights = differenceInCalendarDays(initialDate, startDate);
      const baseTotal = totalNights * room.prix_base_nuit;
      const totalDiscount = totalNights * originalDiscountPerNight;
      const initialPrice = Math.max(baseTotal - totalDiscount, 0);

      setManualPrice(initialPrice.toFixed(2));
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

    const finalPrice = manualPriceOverride ? parseFloat(manualPrice) : calculatedPrice;

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
    if (!open) {
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
      setManualPriceOverride(false);
      setManualPrice(calculatedPrice.toFixed(2));
    }
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
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              Que souhaitez-vous faire ?
            </p>
            <div className="grid gap-3">
              <Button
                variant="default"
                size="lg"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={handleConfirmDeparture}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                <div className="text-left">
                  <div className="font-semibold">Confirmer le départ</div>
                  <div className="text-xs text-primary-foreground/70">
                    Clôturer le séjour et créer la tâche de nettoyage.
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => setMode('extend')}
                disabled={isProcessing}
              >
                <CalendarPlus className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Prolonger le séjour</div>
                  <div className="text-xs text-muted-foreground">
                    Choisir une nouvelle date de fin.
                  </div>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newEndDate">Nouvelle date de fin</Label>
              <Input
                id="newEndDate"
                type="date"
                value={newEndDate}
                min={booking.date_fin_prevue.split('T')[0]}
                onChange={(e) => {
                  setNewEndDate(e.target.value);
                  // Réinitialiser le mode de prix manuel quand la date change
                  setManualPriceOverride(false);
                }}
              />
            </div>

            <Separator />

            {/* Contrôle de la réduction par nuit */}
            <div className="space-y-2">
              <Label htmlFor="discountPerNight">Réduction par nuit ($)</Label>
              <Input
                id="discountPerNight"
                type="number"
                min="0"
                step="0.01"
                value={discountPerNight}
                onChange={(e) => setDiscountPerNight(parseFloat(e.target.value) || 0)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="newPrice">Prix total ($)</Label>
              <div className="flex gap-2">
                <Input
                  id="newPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPriceOverride ? manualPrice : calculatedPrice.toFixed(2)}
                  onChange={(e) => {
                    setManualPrice(e.target.value);
                    setManualPriceOverride(true);
                  }}
                  disabled={!manualPriceOverride}
                />
                <Button
                  type="button"
                  variant={manualPriceOverride ? "default" : "secondary"}
                  size="icon"
                  onClick={() => setManualPriceOverride(!manualPriceOverride)}
                  title={manualPriceOverride ? "Utiliser le prix calculé" : "Modifier manuellement le prix"}
                >
                  <Calculator className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Prix total calculé: <CurrencyDisplay amountUSD={calculatedPrice} /></p>
                <p>Tarif nuit: <CurrencyDisplay amountUSD={room.prix_base_nuit} /></p>
                <p>Réduction par nuit: <CurrencyDisplay amountUSD={discountPerNight} /></p>
                <p>Nuits totales (début à nouvelle fin): {differenceInCalendarDays(new Date(newEndDate), new Date(booking.date_debut_prevue))}</p>
                {extensionDetails.extraNights > 0 && (
                  <>
                    <p className="pt-1 font-medium">Période d'extension: {extensionDetails.extraNights} nuits</p>
                    <p>Coût extension (sans réduction): <CurrencyDisplay amountUSD={extensionDetails.extraCost} /></p>
                    <p>Réduction extension: <CurrencyDisplay amountUSD={extensionDetails.extraDiscount} /></p>
                    <p className="font-medium">Coût extension (avec réduction): <CurrencyDisplay amountUSD={extensionDetails.extraCost - extensionDetails.extraDiscount} /></p>
                  </>
                )}
              </div>
            </div>

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
                Confirmer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
