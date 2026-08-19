import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter, Edit, Trash2, Save, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Account } from '@/interfaces/Accounting';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { formatCurrency } from '@/components/CurrencyDisplay';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const AccountManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;
  const queryClient = useQueryClient();

  // Fetch accounts
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('code', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        category: row.category,
        description: row.description,
        parent_id: row.parent_id,
        balance: row.balance || 0,
        currency: row.currency || 'USD',
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    },
  });

  // Filter accounts based on search and filters
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const matchesSearch = !search || 
        account.code.toLowerCase().includes(search.toLowerCase()) || 
        account.name.toLowerCase().includes(search.toLowerCase()) ||
        (account.description && account.description.toLowerCase().includes(search.toLowerCase()));
      
      const matchesType = typeFilter === 'all' || account.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || account.category === categoryFilter;
      
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [accounts, search, typeFilter, categoryFilter]);

  // Create account mutation
  const createAccount = useMutation({
    mutationFn: async (account: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'balance'>) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert([{
          code: account.code,
          name: account.name,
          type: account.type,
          category: account.category,
          description: account.description,
          parent_id: account.parent_id,
          currency: account.currency
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsDialogOpen(false);
      setEditingAccount(null);
    },
  });

  // Update account mutation
  const updateAccount = useMutation({
    mutationFn: async (account: Account) => {
      const { data, error } = await supabase
        .from('accounts')
        .update({
          code: account.code,
          name: account.name,
          type: account.type,
          category: account.category,
          description: account.description,
          parent_id: account.parent_id,
          currency: account.currency
        })
        .eq('id', account.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsDialogOpen(false);
      setEditingAccount(null);
    },
  });

  // Delete account mutation
  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const accountData = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      type: formData.get('type') as Account['type'],
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      parent_id: formData.get('parent_id') as string,
      currency: formData.get('currency') as string,
    };

    if (editingAccount) {
      updateAccount.mutate({ ...editingAccount, ...accountData });
    } else {
      createAccount.mutate(accountData);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce compte ?')) {
      deleteAccount.mutate(id);
    }
  };

  const handleNewAccount = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const accountTypes = [
    { value: 'ASSET', label: 'Actif' },
    { value: 'LIABILITY', label: 'Passif' },
    { value: 'EQUITY', label: 'Capitaux Propres' },
    { value: 'REVENUE', label: 'Revenu' },
    { value: 'EXPENSE', label: 'Dépense' },
  ];

  const accountCategories = [
    { value: 'Courant', label: 'Courant' },
    { value: 'Non Courant', label: 'Non Courant' },
    { value: 'Financier', label: 'Financier' },
    { value: 'Opérationnel', label: 'Opérationnel' },
  ];

  return (
    <MainLayout title="Gestion des Comptes" subtitle="Créer, modifier et gérer les comptes comptables">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                placeholder="Rechercher des comptes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {accountTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {accountCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleNewAccount}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Compte
          </Button>
        </div>

        <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">CODE</TableHead>
                <TableHead>NOM</TableHead>
                <TableHead className="w-[120px]">TYPE</TableHead>
                <TableHead className="w-[120px]">CATÉGORIE</TableHead>
                <TableHead className="w-[120px]">SOLDE</TableHead>
                <TableHead className="w-[120px]">DEVISE</TableHead>
                <TableHead className="text-right w-[120px]">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">Chargement...</TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">Aucun compte trouvé.</TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{account.name}</div>
                      {account.description && (
                        <div className="text-xs text-muted-foreground">{account.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {account.type.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{account.category}</TableCell>
                    <TableCell className="font-medium">
                      <CurrencyDisplay amountUSD={account.balance} />
                    </TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(account)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(account.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Account Management Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Modifier le Compte' : 'Nouveau Compte'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code du Compte *</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingAccount?.code || ''}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Nom du Compte *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingAccount?.name || ''}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type de Compte *</Label>
                  <Select name="type" defaultValue={editingAccount?.type || 'ASSET'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie *</Label>
                  <Select name="category" defaultValue={editingAccount?.category || 'Courant'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currency">Devise *</Label>
                <Select name="currency" defaultValue={editingAccount?.currency || 'USD'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CDF">CDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="parent_id">Compte Parent</Label>
                <Select name="parent_id" defaultValue={editingAccount?.parent_id || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun parent</SelectItem>
                    {accounts
                      .filter(acc => acc.id !== editingAccount?.id) // Exclude current account
                      .map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingAccount?.description || ''}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingAccount(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>
                  {createAccount.isPending || updateAccount.isPending ? (
                    <>
                      <span className="mr-2">Enregistrement...</span>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingAccount ? 'Mettre à jour' : 'Créer'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default AccountManagement;