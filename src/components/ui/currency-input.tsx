import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { DollarSign, Banknote } from 'lucide-react';

interface CurrencyInputProps {
    // Valeur en USD (devise de référence)
    value: number;
    onChange: (usdValue: number) => void;

    // Labels personnalisables
    labelUsd?: string;
    labelCdf?: string;

    // Configuration
    disabled?: boolean;
    min?: number;
    step?: number;
    placeholder?: string;

    // Mode de fonctionnement
    mode?: 'synchronized' | 'independent';  // 🔥 NOUVEAU pour paiements mixtes
    onChangeUsd?: (usd: number) => void;    // 🔥 Callback USD séparé
    onChangeCdf?: (cdf: number) => void;    // 🔥 Callback CDF séparé

    // Indicateur de statut automatique (pour paiements)
    showStatusIndicator?: boolean;
    balanceDue?: number;  // Solde dû pour calculer le statut

    // Style
    className?: string;

    // Prinitiaux (pour édition)
    initialUsd?: number;
    initialCdf?: number;
}

export function CurrencyInput({
    value,
    onChange,
    labelUsd = "Montant (USD)",
    labelCdf = "Montant (CDF)",
    disabled = false,
    min = 0,
    step = 0.01,
    placeholder = "0.00",
    mode = 'synchronized',  // 🔥 NOUVEAU - Par défaut synchronisé
    onChangeUsd,            // 🔥 NOUVEAU
    onChangeCdf,            // 🔥 NOUVEAU
    showStatusIndicator = false,
    balanceDue,
    initialUsd,
    initialCdf,
    className = ""
}: CurrencyInputProps) {
    const { data: exchangeRateData } = useExchangeRate();
    const exchangeRate = exchangeRateData?.usd_to_cdf || 2800;

    const [usd, setUsd] = useState<string>('');
    const [cdf, setCdf] = useState<string>('');

    // Synchronisation initiale et lors du changement des valeurs externes
    useEffect(() => {
        if (mode === 'independent' && (initialUsd !== undefined || initialCdf !== undefined)) {
            setUsd(initialUsd !== undefined ? initialUsd.toString() : (value > 0 ? value.toString() : ''));
            setCdf(initialCdf !== undefined ? initialCdf.toString() : (value > 0 ? (value * exchangeRate).toFixed(0) : ''));
        } else if (mode === 'synchronized') {
            setUsd(value > 0 ? value.toString() : '');
            setCdf(value > 0 ? (value * exchangeRate).toFixed(0) : '');
        }
    }, [value, exchangeRate, mode, initialUsd, initialCdf]);

    // 🎯 Indicateur de statut de paiement AUTOMATIQUE (et Reste à payer)
    const paymentStatusIndicator = useMemo(() => {
        if (!showStatusIndicator || balanceDue === undefined || balanceDue === null) return null;

        const valUsd = parseFloat(usd) || 0;
        const valCdf = parseFloat(cdf) || 0;

        // Calcul du total payé en équivalent USD
        // Si mode indépendant, on somme les deux. Si mode synchro, ils sont liés donc on prend juste USD (ou l'un des deux)
        // Mais dans ce context (mixte), 'usd' et 'cdf' sont les inputs physiques.
        // ATTENTION : En mode synchro, usd et cdf représentent la MÊME valeur convertie. Donc on prend juste usd.
        // En mode indépendant, on suppose que l'utilisateur remplit les deux pour former le total.

        let totalPaidInUsd = 0;
        if (mode === 'independent') {
            totalPaidInUsd = valUsd + (exchangeRate > 0 ? valCdf / exchangeRate : 0);
        } else {
            totalPaidInUsd = valUsd;
        }

        // Pas de montant saisi (ou très faible)
        if (totalPaidInUsd < 0.01) return null;

        const remainingUsd = balanceDue - totalPaidInUsd;
        const remainingCdf = remainingUsd * exchangeRate;

        // Paiement complet (avec tolérance)
        if (Math.abs(remainingUsd) < 0.01) {
            return (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 w-full justify-center py-1">
                    ✓ Paiement complet
                </Badge>
            );
        }

        // Paiement avec surplus
        if (totalPaidInUsd > balanceDue) {
            return (
                <div className="flex flex-col gap-1 w-full">
                    <Badge variant="default" className="bg-orange-600 hover:bg-orange-700 w-full justify-center">
                        ⚠ Surplus de {Math.abs(remainingUsd).toFixed(2)} $
                    </Badge>
                    <span className="text-xs text-muted-foreground text-center">
                        (À rendre : {(Math.abs(remainingCdf)).toLocaleString()} FC)
                    </span>
                </div>
            );
        }

        // Paiement partiel
        return (
            <div className="flex flex-col gap-1 w-full">
                <Badge variant="secondary" className="w-full justify-center bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">
                    Reste : {remainingUsd.toFixed(2)} $
                </Badge>
                <div className="text-xs font-medium text-center text-muted-foreground">
                    Soit : {remainingCdf.toLocaleString(undefined, { maximumFractionDigits: 0 })} FC
                </div>
            </div>
        );
    }, [usd, cdf, balanceDue, showStatusIndicator, exchangeRate, mode]);


    // 🔥 Mode synchronisé (défaut) - Les deux champs se synchronisent
    const handleUsdChangeSynchronized = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUsd = e.target.value;
        setUsd(newUsd);
        const usdNumber = parseFloat(newUsd) || 0;
        setCdf((usdNumber * exchangeRate).toFixed(2));
        onChange(usdNumber);
    };

    const handleCdfChangeSynchronized = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCdf = e.target.value;
        setCdf(newCdf);
        const cdfNumber = parseFloat(newCdf) || 0;
        const usdNumber = cdfNumber / exchangeRate;
        setUsd(usdNumber.toFixed(2));
        onChange(usdNumber);
    };

    // 🔥 Mode indépendant (paiements mixtes) - Saisie séparée USD + CDF
    const handleUsdChangeIndependent = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUsd = e.target.value;
        setUsd(newUsd);
        const usdNumber = parseFloat(newUsd) || 0;

        // Notifier le changement USD séparé
        if (onChangeUsd) {
            onChangeUsd(usdNumber);
        }

        // Recalculer le total équivalent USD
        const cdfNumber = parseFloat(cdf) || 0;
        const totalUsd = usdNumber + (cdfNumber / exchangeRate);
        onChange(totalUsd);
    };

    const handleCdfChangeIndependent = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCdf = e.target.value;
        setCdf(newCdf);
        const cdfNumber = parseFloat(newCdf) || 0;

        // Notifier le changement CDF séparé
        if (onChangeCdf) {
            onChangeCdf(cdfNumber);
        }

        // Recalculer le total équivalent USD
        const usdNumber = parseFloat(usd) || 0;
        const totalUsd = usdNumber + (cdfNumber / exchangeRate);
        onChange(totalUsd);
    };

    // Déterminer les handlers selon le mode
    const handleUsdChange = mode === 'independent'
        ? handleUsdChangeIndependent
        : handleUsdChangeSynchronized;

    const handleCdfChange = mode === 'independent'
        ? handleCdfChangeIndependent
        : handleCdfChangeSynchronized;

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Info mode paiement mixte */}
            {mode === 'independent' && (
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                    <span className="text-blue-600 font-semibold">💡</span>
                    <span>Mode paiement mixte : Saisissez le montant réel reçu dans chaque devise</span>
                </div>
            )}

            {/* Layout horizontal : Inputs à gauche, Total à droite */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4 items-start">
                {/* Partie gauche : Champs USD et CDF */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Champ USD */}
                    <div className="space-y-1.5">
                        <Label htmlFor="amount-usd" className="flex items-center gap-1.5 text-xs">
                            <DollarSign className="h-3.5 w-3.5 text-green-600" />
                            {labelUsd}
                        </Label>
                        <Input
                            id="amount-usd"
                            type="number"
                            min={min}
                            step={step}
                            value={usd}
                            onChange={handleUsdChange}
                            disabled={disabled}
                            placeholder={placeholder}
                            className="font-medium h-10"
                        />
                    </div>

                    {/* Champ CDF */}
                    <div className="space-y-1.5">
                        <Label htmlFor="amount-cdf" className="flex items-center gap-1.5 text-xs">
                            <Banknote className="h-3.5 w-3.5 text-blue-600" />
                            {labelCdf}
                        </Label>
                        <Input
                            id="amount-cdf"
                            type="number"
                            min={min}
                            step="1"
                            value={cdf}
                            onChange={handleCdfChange}
                            disabled={disabled}
                            placeholder={placeholder}
                            className="font-medium h-10"
                        />
                    </div>
                </div>

                {/* Partie droite : Total et Statut */}
                <div className="space-y-2">
                    {/* Total équivalent en mode paiement mixte */}
                    {mode === 'independent' && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total équivalent</span>
                                <span className="text-2xl font-black text-indigo-900 dark:text-indigo-100">
                                    {(parseFloat(usd || '0') + (parseFloat(cdf || '0') / exchangeRate)).toFixed(2)} <span className="text-sm">$</span>
                                </span>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {parseFloat(usd || '0').toFixed(2)}$ + {parseFloat(cdf || '0').toLocaleString()}FC
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Indicateur de statut automatique */}
                    {paymentStatusIndicator && (
                        <div className="w-full">
                            {paymentStatusIndicator}
                        </div>
                    )}
                </div>
            </div>

            {/* Info taux de change */}
            <p className="text-[10px] text-muted-foreground text-right">
                Taux: <span className="font-medium">1$ = {exchangeRate.toLocaleString('fr-FR')} FC</span>
            </p>
        </div>
    );
}
