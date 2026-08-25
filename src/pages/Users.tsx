import { MainLayout } from '@/components/layout/MainLayout';
import { UserManagement } from '@/components/settings/UserManagement';

const Users = () => {
  return (
    <MainLayout
      title="GESTION DES UTILISATEURS"
      subtitle="Administration des comptes utilisateurs, attributions des rôles et gestion des accès aux sites."
    >
      <div className="space-y-6">
        <UserManagement />
      </div>
    </MainLayout>
  );
};

export default Users;
