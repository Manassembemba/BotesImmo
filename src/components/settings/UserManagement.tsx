import { useMemo } from 'react';
import { useUsers, User } from '@/hooks/useUsers';
import { useLocations } from '@/hooks/useLocations';
import { useManageUser } from '@/hooks/useManageUser';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function UserManagement() {
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useUsers();
  const { data: locations, isLoading: isLoadingLocations, error: locationsError } = useLocations();
  const { updateUser } = useManageUser();

  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [users]);

  const handleLocationChange = (user: User, newLocationId: string) => {
    const location = locations?.find(l => l.id === newLocationId);
    const locationName = location ? location.nom : 'Non assigné';

    toast.promise(
      updateUser.mutateAsync({
        userId: user.id,
        // We need to provide all fields for the update
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

  if (isLoadingUsers || isLoadingLocations) {
    return <div>Chargement des utilisateurs et des sites...</div>;
  }

  if (usersError || locationsError) {
    return <div className="text-red-500">Erreur: {usersError?.message || locationsError?.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestion des utilisateurs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Assignez des rôles et des sites aux utilisateurs de votre système
        </p>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Site</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length > 0 ? (
              sortedUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-accent/50 transition-colors">
                  <TableCell className="font-medium">{user.nom}</TableCell>
                  <TableCell>{user.prenom}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.location_id || 'null'}
                      onValueChange={(newLocationId) => handleLocationChange(user, newLocationId)}
                      disabled={updateUser.isPending}
                    >
                      <SelectTrigger className="w-[180px]">
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
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Aucun utilisateur enregistré.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}