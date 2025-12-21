import { useState } from "react";
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
import { useManageUser } from "@/hooks/useManageUser";
import { Loader2 } from "lucide-react";

interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
    const { createUser } = useManageUser();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        role: "AGENT_RES",
        nom: "",
        prenom: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createUser.mutateAsync(formData);
        onOpenChange(false);
        setFormData({ email: "", password: "", role: "AGENT_RES", nom: "", prenom: "" });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
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
                            <Input
                                id="prenom"
                                required
                                value={formData.prenom}
                                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nom">Nom</Label>
                            <Input
                                id="nom"
                                required
                                value={formData.nom}
                                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe temporaire</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Rôle</Label>
                        <Select
                            value={formData.role}
                            onValueChange={(value) => setFormData({ ...formData, role: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrateur</SelectItem>
                                <SelectItem value="AGENT_RES">Agent Réservations</SelectItem>
                                <SelectItem value="AGENT_OP">Agent Opérations</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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

interface EditRoleDialogProps {
    user: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditRoleDialog({ user, open, onOpenChange }: EditRoleDialogProps) {
    const { updateRole } = useManageUser();
    const [role, setRole] = useState(user?.role || "AGENT_RES");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateRole.mutateAsync({ userId: user.id, role });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Modifier le rôle</DialogTitle>
                    <DialogDescription>
                        Changez les permissions d'accès de l'utilisateur.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Utilisateur</Label>
                        <div className="p-2 border rounded bg-muted text-sm">{user?.email}</div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-role">Nouveau rôle</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger id="edit-role">
                                <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrateur</SelectItem>
                                <SelectItem value="AGENT_RES">Agent Réservations</SelectItem>
                                <SelectItem value="AGENT_OP">Agent Opérations</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={updateRole.isPending}>
                            {updateRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
