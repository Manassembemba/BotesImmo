import { useState, useMemo } from 'react';
import { useUsers, User } from '@/hooks/useUsers';
import { useLocations } from '@/hooks/useLocations';
import { useManageUser } from '@/hooks/useManageUser';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreateUserDialog, EditUserDialog } from './UserDialogs';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Shield, User as UserIcon, Building2, UserCheck, Users, MapPin, RefreshCw, KeyRound, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function UserManagement() {
  const { data: users, isLoading: isLoadingUsers, error: usersError, refetch: refetchUsers } = useUsers();
  const { data: locations, isLoading: isLoadingLocations, error: locationsError } = useLocations();
  const { updateUser, deleteUser } = useManageUser();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Statistiques calculées
  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0, resAgents: 0, opAgents: 0, locationsCount: 0 };
    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'ADMIN').length,
      resAgents: users.filter((u) => u.role === 'AGENT_RES').length,
      opAgents: users.filter((u) => u.role === 'AGENT_OP').length,
      locationsCount: locations ? locations.length : 0,
    };
  }, [users, locations]);

  // Filtrage et tri des utilisateurs
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((u) => {
      // Recherche textuelle
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        u.nom?.toLowerCase().includes(term) ||
        u.prenom?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term);

      // Filtre rôle
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;

      // Filtre localité
      const matchLocation =
        locationFilter === 'ALL' ||
        (locationFilter === 'NULL' && !u.location_id) ||
        u.location_id === locationFilter;

      return matchSearch && matchRole && matchLocation;
    }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [users, searchTerm, roleFilter, locationFilter]);

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser.mutateAsync(userToDelete.id);
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Erreur lors de la suppression de l'utilisateur:", error);
    }
  };

  const handleLocationChange = (user: User, newLocationId: string) => {
    const location = locations?.find((l) => l.id === newLocationId);
    const locationName = location ? location.nom : 'Non assigné';

    toast.promise(
      updateUser.mutateAsync({
        userId: user.id,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom,
        username: user.username,
        location_id: newLocationId === 'null' ? null : newLocationId,
      }),
      {
        loading: `Modification du site pour ${user.prenom} ${user.nom}...`,
        success: `${user.prenom} ${user.nom} a été assigné(e) à ${locationName}.`,
        error: (err) => `Erreur lors de la mise à jour : ${err.message}`,
      }
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-2.5 py-0.5 shadow-2xs font-semibold">
            <Shield className="h-3 w-3" /> Administrateur
          </Badge>
        );
      case 'AGENT_RES':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 px-2.5 py-0.5 font-medium">
            <UserCheck className="h-3 w-3" /> Agent Réservations
          </Badge>
        );
      case 'AGENT_OP':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1 px-2.5 py-0.5 font-medium">
            <Building2 className="h-3 w-3" /> Agent Opérations
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="px-2.5 py-0.5">
            {role || 'Non défini'}
          </Badge>
        );
    }
  };

  if (isLoadingUsers || isLoadingLocations) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Chargement des utilisateurs et des sites...
      </div>
    );
  }

  if (usersError || locationsError) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
        Erreur : {usersError?.message || locationsError?.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-none bg-slate-50 shadow-none hover:bg-slate-100/80 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Utilisateurs</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
            </div>
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-indigo-50/50 shadow-none hover:bg-indigo-50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Administrateurs</p>
              <p className="text-2xl font-bold text-indigo-950 mt-0.5">{stats.admins}</p>
            </div>
            <div className="p-2.5 bg-indigo-200/60 text-indigo-800 rounded-xl">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-emerald-50/50 shadow-none hover:bg-emerald-50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Réservations</p>
              <p className="text-2xl font-bold text-emerald-950 mt-0.5">{stats.resAgents}</p>
            </div>
            <div className="p-2.5 bg-emerald-200/60 text-emerald-800 rounded-xl">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-amber-50/50 shadow-none hover:bg-amber-50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Opérations</p>
              <p className="text-2xl font-bold text-amber-950 mt-0.5">{stats.opAgents}</p>
            </div>
            <div className="p-2.5 bg-amber-200/60 text-amber-800 rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* En-tête avec bouton de création */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="h-5 w-5 text-indigo-600" /> Liste des comptes utilisateurs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ajoutez de nouveaux agents, réinitialisez les mots de passe et gérez les attributions de sites.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md shadow-indigo-100 gap-2 shrink-0 h-11 px-5"
        >
          <Plus className="h-4 w-4" /> Nouvel Utilisateur
        </Button>
      </div>

      {/* Barre d'outils et filtres */}
      <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, identifiant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Filtre Rôle */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue placeholder="Filtrer par rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les rôles</SelectItem>
              <SelectItem value="ADMIN">Administrateurs</SelectItem>
              <SelectItem value="AGENT_RES">Agents Réservations</SelectItem>
              <SelectItem value="AGENT_OP">Agents Opérations</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtre Site */}
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue placeholder="Filtrer par site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les sites</SelectItem>
              <SelectItem value="NULL">Non assigné</SelectItem>
              {locations?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchTerm || roleFilter !== 'ALL' || locationFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
                setLocationFilter('ALL');
              }}
              className="text-xs text-muted-foreground hover:text-slate-900"
            >
              Réinitialiser
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchUsers()}
            className="ml-auto bg-white text-xs gap-1.5"
            title="Rafraîchir la liste"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
          </Button>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-bold text-slate-700">UTILISATEUR</TableHead>
              <TableHead className="font-bold text-slate-700">EMAIL</TableHead>
              <TableHead className="font-bold text-slate-700">RÔLE</TableHead>
              <TableHead className="font-bold text-slate-700">SITE ASSIGNÉ</TableHead>
              <TableHead className="font-bold text-slate-700">CRÉÉ LE</TableHead>
              <TableHead className="font-bold text-slate-700 text-right">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const initials = `${(user.prenom?.[0] || '').toUpperCase()}${(user.nom?.[0] || '').toUpperCase()}` || 'U';
                return (
                  <TableRow key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 leading-tight">
                            {user.prenom} {user.nom}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            @{user.username || 'sans_identifiant'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-600">
                      {user.email || 'Non renseigné'}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.role === 'ADMIN' ? (
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Tous les sites (Global)
                        </span>
                      ) : (
                        <Select
                          value={user.location_id || 'null'}
                          onValueChange={(newLocationId) => handleLocationChange(user, newLocationId)}
                          disabled={updateUser.isPending}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                            <SelectValue placeholder="Choisir un site" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">Non assigné</SelectItem>
                            {locations?.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUserForEdit(user)}
                          className="h-8 px-2.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                          title="Modifier l'utilisateur"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => setSelectedUserForEdit(user)}>
                              <Edit className="h-4 w-4 mr-2 text-slate-500" /> Modifier le profil & rôle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedUserForEdit(user)}>
                              <KeyRound className="h-4 w-4 mr-2 text-indigo-600" /> Changer le mot de passe
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setUserToDelete(user)}
                              className="text-destructive focus:text-destructive font-medium"
                            >
                              <Trash2 className="h-4 w-4 mr-2 text-destructive" /> Supprimer le compte
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <UserIcon className="h-6 w-6 text-slate-300 mb-1" />
                    <p className="font-medium">Aucun utilisateur trouvé.</p>
                    <p className="text-xs">Modifiez vos critères de recherche ou ajoutez un nouvel utilisateur.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modale de création */}
      <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Modale de modification */}
      {selectedUserForEdit && (
        <EditUserDialog
          user={selectedUserForEdit}
          open={!!selectedUserForEdit}
          onOpenChange={(open) => !open && setSelectedUserForEdit(null)}
        />
      )}

      {/* Confirmation de suppression */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Supprimer l'utilisateur ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement le compte de{' '}
              <strong className="text-slate-900 font-semibold">
                {userToDelete?.prenom} {userToDelete?.nom}
              </strong>{' '}
              ({userToDelete?.email}) ?
              <br />
              <br />
              Cette action est irréversible et révoquera immédiatement tous ses accès à l'application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Confirmer la suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}