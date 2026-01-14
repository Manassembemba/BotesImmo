import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Database } from "@/integrations/supabase/types";

type SeasonalPrice = Database["public"]["Tables"]["seasonal_prices"]["Row"];

export function SeasonalPricesSettings() {
    const [prices, setPrices] = useState<SeasonalPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [adjustment, setAdjustment] = useState("");

    useEffect(() => {
        fetchPrices();
    }, []);

    const fetchPrices = async () => {
        try {
            const { data, error } = await supabase
                .from("seasonal_prices")
                .select("*")
                .order("start_date", { ascending: true });

            if (error) throw error;
            setPrices(data || []);
        } catch (error) {
            console.error("Error fetching prices:", error);
            toast.error("Impossible de charger les prix saisonniers");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { error } = await supabase.from("seasonal_prices").insert({
                name,
                start_date: startDate,
                end_date: endDate,
                percentage_adjustment: parseInt(adjustment),
            });

            if (error) throw error;

            toast.success("Règle de prix ajoutée");
            setIsDialogOpen(false);
            resetForm();
            fetchPrices();
        } catch (error) {
            console.error("Error adding price:", error);
            toast.error("Erreur lors de l'ajout");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cette règle ?")) return;

        try {
            const { error } = await supabase
                .from("seasonal_prices")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success("Règle supprimée");
            fetchPrices();
        } catch (error) {
            console.error("Error deleting price:", error);
            toast.error("Erreur lors de la suppression");
        }
    };

    const resetForm = () => {
        setName("");
        setStartDate("");
        setEndDate("");
        setAdjustment("");
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Tarification Dynamique</h3>
                    <p className="text-sm text-muted-foreground">
                        Gérez les variations de prix selon les saisons (Haute saison, basse saison, événements...)
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Ajouter une règle
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nouvelle règle de prix</DialogTitle>
                            <DialogDescription>
                                Définissez une période et un ajustement de prix (en pourcentage).
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nom de la période</Label>
                                <Input
                                    id="name"
                                    placeholder="Ex: Haute Saison Été"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate">Date de début</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">Date de fin</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adjustment">Ajustement (%)</Label>
                                <div className="relative">
                                    <Input
                                        id="adjustment"
                                        type="number"
                                        placeholder="Ex: 20 pour +20%, -10 pour -10%"
                                        value={adjustment}
                                        onChange={(e) => setAdjustment(e.target.value)}
                                        required
                                    />
                                    <span className="absolute right-3 top-2.5 text-muted-foreground">
                                        %
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Utilisez des valeurs positives pour une augmentation (ex: 20) et négatives pour une réduction (ex: -10).
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Période</TableHead>
                            <TableHead>Ajustement</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : prices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Aucune règle de prix définie.
                                </TableCell>
                            </TableRow>
                        ) : (
                            prices.map((price) => (
                                <TableRow key={price.id}>
                                    <TableCell className="font-medium">{price.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <CalendarIcon className="h-4 w-4" />
                                            <span>
                                                {format(new Date(price.start_date), "dd/MM/yyyy")} -{" "}
                                                {format(new Date(price.end_date), "dd/MM/yyyy")}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${(price.percentage_adjustment || 0) > 0
                                                    ? "bg-red-100 text-red-800"
                                                    : "bg-green-100 text-green-800"
                                                }`}
                                        >
                                            {(price.percentage_adjustment || 0) > 0 ? "+" : ""}
                                            {price.percentage_adjustment}%
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => handleDelete(price.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
