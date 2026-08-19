import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { User, Shield, Calendar, Bell, Key, Eye, EyeOff } from 'lucide-react';

export function ProfileSecuritySettings() {
  const { user, profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.prenom || '');
  const [lastName, setLastName] = useState(profile?.nom || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(profile?.telephone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdateProfile = () => {
    toast.success('Profil mis à jour avec succès');
    // Ici, vous implémenteriez la logique pour mettre à jour le profil
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    toast.success('Mot de passe changé avec succès');
    // Ici, vous implémenteriez la logique pour changer le mot de passe
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Section Profil utilisateur */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Profil utilisateur</CardTitle>
              <CardDescription>Gérez vos informations personnelles</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input 
                id="firstName" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input 
                id="lastName" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input 
                id="phone" 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="+243 999 999 999"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleUpdateProfile}>Enregistrer les modifications</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Section Sécurité */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Sécurité du compte</CardTitle>
              <CardDescription>Gérez les paramètres de sécurité de votre compte</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-lg mb-4">Changer le mot de passe</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Entrez votre mot de passe actuel"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Entrez un nouveau mot de passe"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmez le nouveau mot de passe"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleChangePassword}>Changer le mot de passe</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Section Préférences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Préférences personnelles</CardTitle>
              <CardDescription>Gérez vos préférences d'utilisation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Notifications</h4>
                <p className="text-sm text-muted-foreground">Recevoir des notifications par email</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Langue</h4>
                <p className="text-sm text-muted-foreground">Préférence linguistique</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 bg-background">
                  <option>Français</option>
                  <option>English</option>
                  <option>Swahili</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Format de devise</h4>
                <p className="text-sm text-muted-foreground">Afficher les montants en USD</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Mode sombre</h4>
                <p className="text-sm text-muted-foreground">Utiliser le thème sombre</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}