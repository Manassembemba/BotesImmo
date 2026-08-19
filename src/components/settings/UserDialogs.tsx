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
import { Loader2 } from "lucide-react";
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
            toast.error("Veuillez assigner une localité à cet utilisateur.");
            return;
        }
        if (!formData.username) {
            toast.error("Le nom d'utilisateur est requis.");
            return;
        }
        await createUser.mutateAsync(formData);
        onOpenChange(false);
        setFormData(initialCreateState);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Créer un utilisateur</DialogTitle>
                    <DialogDescription>
                        Remplissez les informations pour créer un nouveau membre de l'équipe.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="prenom">Prénom</Label>
                            <Input id="prenom" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nom">Nom</Label>
                            <Input id="nom" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="username">Nom d'utilisateur</Label>
                        <Input id="username" required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe temporaire</Label>
                        <Input id="password" type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Rôle</Label>
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrateur</SelectItem>
                                <SelectItem value="AGENT_RES">Agent Réservations</SelectItem>
                                <SelectItem value="AGENT_OP">Agent Opérations</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {formData.role !== 'ADMIN' && (
                        <div className="space-y-2">
                            <Label htmlFor="location">Localité</Label>
                            <Select value={formData.location_id || ""} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                                <SelectTrigger disabled={isLoadingLocations}>
                                    <SelectValue placeholder={isLoadingLocations ? "Chargement..." : "Sélectionner une localité"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.nom}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="submit" disabled={createUser.isPending}>
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
        nom: '', prenom: '', role: '', location_id: '', username: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                nom: user.nom,
                prenom: user.prenom,
                username: user.username || '',
                role: user.role,
                location_id: user.location_id || "",
            });
        }
    }, [user]);
    
    useEffect(() => {
        if (formData.role === 'ADMIN') {
            setFormData(f => ({ ...f, location_id: "" }));
        }
    }, [formData.role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.role !== 'ADMIN' && !formData.location_id) {
            toast.error("Veuillez assigner une localité à cet utilisateur.");
            return;
        }
        if (!formData.username) {
            toast.error("Le nom d'utilisateur est requis.");
            return;
        }
        await updateUser.mutateAsync({ userId: user.id, ...formData });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Modifier l'utilisateur</DialogTitle>
                    <DialogDescription>Mettez à jour les informations de l'utilisateur.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-prenom">Prénom</Label>
                            <Input id="edit-prenom" required value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-nom">Nom</Label>
                            <Input id="edit-nom" required value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-username">Nom d'utilisateur</Label>
                        <Input id="edit-username" required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Email (non modifiable)</Label>
                        <div className="p-2 border rounded bg-muted text-sm">{user?.email}</div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-role">Rôle</Label>
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                            <SelectTrigger id="edit-role"><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrateur</SelectItem>
                                <SelectItem value="AGENT_RES">Agent Réservations</SelectItem>
                                <SelectItem value="AGENT_OP">Agent Opérations</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     {formData.role !== 'ADMIN' && (
                        <div className="space-y-2">
                            <Label htmlFor="edit-location">Localité</Label>
                            <Select value={formData.location_id || ""} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                                <SelectTrigger disabled={isLoadingLocations} id="edit-location">
                                    <SelectValue placeholder={isLoadingLocations ? "Chargement..." : "Sélectionner une localité"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.nom}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="submit" disabled={updateUser.isPending}>
                            {updateUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
