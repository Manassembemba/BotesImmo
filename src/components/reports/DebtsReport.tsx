import { useOverdueDebts } from "@/hooks/useOverdueDebts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertTriangle, TrendingUp } from "lucide-react";

export function DebtsReport() {
    const { data: debts, isLoading } = useOverdueDebts();

    const totalDebt = debts?.reduce((acc, debt) => acc + debt.debt_amount, 0) || 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-red-50 border-red-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Total Dettes de Dépassement
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">${totalDebt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-red-500 mt-1">Non encore facturées</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                        Détails des dépassements en cours
                    </CardTitle>
                    <CardDescription>
                        Liste des réservations dont la date de fin est dépassée mais sans départ confirmé.
                        Ces montants sont calculés dynamiquement et s'ajoutent aux factures officielles.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Locataire</TableHead>
                                <TableHead>Chambre</TableHead>
                                <TableHead>Date Fin Prévue</TableHead>
                                <TableHead>Jours de Retard</TableHead>
                                <TableHead>Tarif Journalier</TableHead>
                                <TableHead className="text-right">Dette Calculée</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Chargement des dettes...</TableCell>
                                </TableRow>
                            ) : debts?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune dette de dépassement active.</TableCell>
                                </TableRow>
                            ) : (
                                debts?.map((debt) => (
                                    <TableRow key={debt.booking_id}>
                                        <TableCell className="font-medium">{debt.tenant_name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{debt.room_number}</Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(debt.date_fin_prevue), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            <span className="font-bold text-red-600">+{debt.overdue_days} jours</span>
                                        </TableCell>
                                        <TableCell>${debt.daily_rate.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} / jour</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">
                                            ${debt.debt_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
