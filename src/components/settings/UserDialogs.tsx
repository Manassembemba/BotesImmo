import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useManageUser, type UserCreationPayload, type UserUpdatePayload } from "@/hooks/useManageUser";
import { useLocations } from "@/hooks/useLocations";
import { Loader2, KeyRound, UserPlus, UserCog } from "lucide-react";
import { toast } from "sonner";

// --- Create User Dialog ---
interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const initialCreateState: UserCreationPayload = {
    email: "",
    password: "",
    role: "AGENT_RES",
    nom: "",
    prenom: "",
    username: "",
    location_id: ""
};

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
    const { createUser } = useManageUser();
    const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
    const [formData, setFormData] = useState<UserCreationPayload>(initialCreateState);

    useEffect(() => {
        if (formData.role === 'ADMIN') {
            setFormData(f => ({ ...f, location_id: "" }));
        }
    }, [formData.role]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.role !== 'ADMIN' && !formData.location_id) {
            toast.error("Veuillez assigner une localité / site à cet utilisateur.");
            return;
        }
        if (!formData.username.trim()) {
            toast.error("Le nom d'utilisateur est requis.");
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }
        try {
            await createUser.mutateAsync(formData);
            onOpenChange(false);
            setFormData(initialCreateState);
        } catch (error: any) {
            console.error("Erreur création utilisateur:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <UserPlus className="h-5 w-5 text-indigo-600" />
                        Créer un utilisateur
                    </DialogTitle>
                    <DialogDescription>
                        Remplissez les informations pour ajouter un nouvel utilisateur au système.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="prenom" className="text-xs font-bold text-slate-700">Prénom</Label>
                            <Input
                                id="prenom"
                                required
                                placeholder="Ex: Jean"
                                value={formData.prenom}
                                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="nom" className="text-xs font-bold text-slate-700">Nom</Label>
                            <Input
                                id="nom"
                                required
                                placeholder="Ex: Dupont"
                                value={formData.nom}
                                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="username" className="text-xs font-bold text-slate-700">Nom d'utilisateur (Identifiant)</Label>
                        <Input
                            id="username"
                            required
                            placeholder="Ex: jdupont"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs font-bold text-slate-700">Adresse Email</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            placeholder="exemple@botesgroup.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-xs font-bold text-slate-700">Mot de passe temporaire</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            placeholder="Min. 6 caractères"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="role" className="text-xs font-bold text-slate-700">Rôle</Label>
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrateur (Accès global)</SelectItem>
                                <SelectItem value="AGENT_RES">Agent Réservations</SelectItem>
                                <SelectItem value="AGENT_OP">Agent Opérations / Terrain</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.role !== 'ADMIN' && (
                        <div className="space-y-1.5">
                            <Label htmlFor="location" className="text-xs font-bold text-slate-700">Site / Localité assigné(e)</Label>
                            <Select value={formData.location_id || ""} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                                <SelectTrigger disabled={isLoadingLocations}>
                                    <SelectValue placeholder={isLoadingLocations ? "Chargement..." : "Sélectionner un site"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.nom}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <DialogFooter className="pt-4 border-t gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={createUser.isPending} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                            {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Créer l'utilisateur
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// --- Edit User Dialog ---
interface EditUserDialogProps {
    user: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
    const { updateUser } = useManageUser();
    const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
    const [formData, setFormData] = useState<Omit<UserUpdatePayload, 'userId'>>({
        nom: '', prenom: '', role: '', location_id: '', username: '', password: ''
    });
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (user && open) {
            setFormData({
                nom: user.nom || '',
                prenom: user.prenom || '',
                username: user.username || '',
                role: user.role || 'AGENT_RES',
                location_id: user.location_id || "",
            });
            setNewPassword('');
        }
    }, [user, open]);
    
    useEffect(() => {
        if (formData.role === 'ADMIN') {
            setFormData(f => ({ ...f, location_id: "" }));
        }
    }, [formData.role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.role !== 'ADMIN' && !formData.location_id) {
            toast.error("Veuillez assigner une localité / site à cet utilisateur.");
            return;
        }
        if (!formData.username.trim()) {
            toast.error("Le nom d'utilisateur est requis.");
            return;
        }
        if (newPassword && newPassword.length < 6) {
            toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        try {
            await updateUser.mutateAsync({
                userId: user.id,
                ...formData,
                password: newPassword ? newPassword.trim() : undefined,
            });
            onOpenChange(false);
        } catch (error: any) {
            console.error("Erreur mise à jour utilisateur:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <UserCog className="h-5 w-5 text-indigo-600" />
                        Modifier l'utilisateur
                    </DialogTitle>
                    <DialogDescription>
                        Mettez à jour le profil, le rôle, le site ou le mot de passe de {user?.prenom} {user?.nom}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-prenom" className="text-xs font-bold text-slate-700">Prénom</Label>
                            <Input
                                id="edit-prenom"
                                required
                                value={formData.prenom}
                                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-nom" className="text-xs font-bold text-slate-700">Nom</Label>
                            <Input
                                id="edit-nom"
                                required
                                value={formData.nom}
                                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="edit-username" className="text-xs font-bold text-slate-700">Nom d'utilisateur (Identifiant)</Label>
                        <Input
                            id="edit-username"
                            required
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Email (Lecture seule)</Label>
                        <div className="p-2.5 border rounded-lg bg-slate-50 text-sm font-medium text-slate-600">
                            {user?.email || 'Non renseigné'}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="edit-role" className="text-xs font-bold text-slate-700">Rôle</Label>
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                            <SelectTrigger id="edit-role"><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrateur (Accès global)</SelectItem>
                                <SelectItem value="AGENT_RES">Agent Réservations</SelectItem>
                                <SelectItem value="AGENT_OP">Agent Opérations / Terrain</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.role !== 'ADMIN' && (
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-location" className="text-xs font-bold text-slate-700">Site / Localité assigné(e)</Label>
                            <Select value={formData.location_id || ""} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                                <SelectTrigger disabled={isLoadingLocations} id="edit-location">
                                    <SelectValue placeholder={isLoadingLocations ? "Chargement..." : "Sélectionner un site"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.nom}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Nouveau mot de passe optionnel */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <Label htmlFor="edit-password" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                            Réinitialiser le mot de passe (Optionnel)
                        </Label>
                        <Input
                            id="edit-password"
                            type="password"
                            placeholder="Laisser vide pour ne pas modifier"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="bg-white"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Saisissez au moins 6 caractères uniquement si vous souhaitez changer le mot de passe de l'utilisateur.
                        </p>
                    </div>

                    <DialogFooter className="pt-4 border-t gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={updateUser.isPending} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                            {updateUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer les modifications
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
