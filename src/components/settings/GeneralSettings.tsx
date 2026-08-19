import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useExchangeRate, useUpdateExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import { DollarSign, Building, Clock, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export function GeneralSettings() {
  const { data: exchangeRate, isLoading } = useExchangeRate();
  const updateRate = useUpdateExchangeRate();
  const [newRate, setNewRate] = useState('');
  const [companyName, setCompanyName] = useState('Botes Immo');
  const [companyAddress, setCompanyAddress] = useState('Adresse de l\'établissement');
  const [companyEmail, setCompanyEmail] = useState('contact@botesimmo.com');
  const [companyPhone, setCompanyPhone] = useState('+243 999 999 999');

  const handleUpdateRate = () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Veuillez entrer un taux valide');
      return;
    }
    updateRate.mutate(rate);
    setNewRate('');
    toast.success('Taux de change mis à jour avec succès');
  };

  const handleSaveCompanyInfo = () => {
    toast.success('Informations de l\'établissement mises à jour');
    // Ici, vous implémenteriez la logique pour sauvegarder les informations de l'entreprise
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Section Taux de change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Taux de change</CardTitle>
              <CardDescription>Conversion USD vers Franc Congolais (CDF)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Taux actuel</p>
              <p className="text-2xl font-semibold text-foreground">
                1 USD = {isLoading ? 'Chargement...' : exchangeRate?.usd_to_cdf?.toLocaleString('fr-FR')} CDF
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[250px] space-y-2">
                <Label htmlFor="newRate">Nouveau taux (CDF pour 1 USD)</Label>
                <div className="flex gap-2">
                  <Input
                    id="newRate"
                    type="number"
                    min={1}
                    placeholder="Ex: 2800"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleUpdateRate} disabled={updateRate.isPending || !newRate}>
                    {updateRate.isPending ? 'Mise à jour...' : 'Mettre à jour'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Section Informations de l'établissement */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Informations de l'établissement</CardTitle>
              <CardDescription>Paramètres de base de votre établissement</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de l'établissement</Label>
              <Input 
                id="companyName" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nom de votre établissement" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Email de contact</Label>
              <Input 
                id="companyEmail" 
                type="email" 
                value={companyEmail} 
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="email@votreentreprise.com" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Téléphone de contact</Label>
              <Input 
                id="companyPhone" 
                value={companyPhone} 
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="+243 999 999 999" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Adresse</Label>
              <Input 
                id="companyAddress" 
                value={companyAddress} 
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Adresse de votre établissement" 
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveCompanyInfo}>Enregistrer les modifications</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Section Heures d'ouverture */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Heures d'ouverture</CardTitle>
              <CardDescription>Définissez les heures d'ouverture de votre établissement</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{day}</span>
                  <div className="flex items-center gap-2">
                    <Switch className="data-[state=checked]:bg-primary" defaultChecked={index < 6} />
                    <span className="text-sm capitalize">
                      {index < 6 ? 'Ouvert' : 'Fermé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label>Heures d'ouverture</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="openTime">Heure d'ouverture</Label>
                  <Input id="openTime" type="time" defaultValue="08:00" />
                </div>
                <div>
                  <Label htmlFor="closeTime">Heure de fermeture</Label>
                  <Input id="closeTime" type="time" defaultValue="22:00" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Section Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Gérez les préférences de notification</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Rappels de réservation</h4>
                <p className="text-sm text-muted-foreground">Recevoir des rappels avant les arrivées</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Notifications de paiement</h4>
                <p className="text-sm text-muted-foreground">Recevoir des alertes pour les nouveaux paiements</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Alertes de maintenance</h4>
                <p className="text-sm text-muted-foreground">Recevoir des alertes pour les chambres en maintenance</p>
              </div>
              <Switch className="data-[state=checked]:bg-primary" defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}