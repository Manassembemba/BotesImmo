import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeasonalPricesSettings } from '@/components/settings/SeasonalPricesSettings';
import { UserManagement } from '@/components/settings/UserManagement';
import { useAuth } from '@/hooks/useAuth';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { ProfileSecuritySettings } from '@/components/settings/ProfileSecuritySettings';

const Settings = () => {
  const { role } = useAuth();

  return (
    <MainLayout title="Paramètres" subtitle="Configuration et gestion de l'application">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          {role === 'ADMIN' && <TabsTrigger value="pricing">Tarifs</TabsTrigger>}
          {role === 'ADMIN' && <TabsTrigger value="users">Utilisateurs & Rôles</TabsTrigger>}
          <TabsTrigger value="profile">Profil & Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        {role === 'ADMIN' && (
          <>
            <TabsContent value="pricing">
              <div className="max-w-2xl space-y-6">
                <SeasonalPricesSettings />
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          </>
        )}

        <TabsContent value="profile">
          <ProfileSecuritySettings />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Settings;
