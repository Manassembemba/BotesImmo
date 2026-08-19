import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, ChevronDown, Plus, Filter, Edit, Trash2, Save, X, PlusCircle, MinusCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry, JournalEntryLine, Account } from '@/interfaces/Accounting';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const JournalEntries = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [entryLines, setEntryLines] = useState<JournalEntryLine[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: exchangeRateData } = useExchangeRate();
  const rate = exchangeRateData?.usd_to_cdf || 2800;
  const queryClient = useQueryClient();

  // Fetch journal entries
  const { data: journalEntries = [], isLoading } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines (*)
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        entry_number: row.entry_number,
        date: row.date,
        description: row.description,
        reference: row.reference,
        status: row.status,
        total_debit: row.total_debit || 0,
        total_credit: row.total_credit || 0,
        currency: row.currency || 'USD',
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        lines: row.lines.map((line: any) => ({
          id: line.id,
          journal_entry_id: line.journal_entry_id,
          account_id: line.account_id,
          account_code: line.account_code,
          account_name: line.account_name,
          debit: line.debit || 0,
          credit: line.credit || 0,
          description: line.description,
          reference: line.reference
        }))
      }));
    },
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
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

  // Filter entries based on search and filters
  const filteredEntries = useMemo(() => {
    return journalEntries.filter(entry => {
      const matchesSearch = !search || 
        entry.entry_number.toLowerCase().includes(search.toLowerCase()) || 
        entry.description.toLowerCase().includes(search.toLowerCase()) ||
        (entry.reference && entry.reference.toLowerCase().includes(search.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
      const entryDate = new Date(entry.date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      const matchesDate = entryDate >= startDate && entryDate <= endDate;
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [journalEntries, search, statusFilter, dateRange]);

  // Create journal entry mutation
  const createEntry = useMutation({
    mutationFn: async ({ entry, lines }: { entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at' | 'total_debit' | 'total_credit'>; lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id'>[] }) => {
      // Calculate totals
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

      // Insert journal entry
      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .insert([{
          entry_number: entry.entry_number,
          date: entry.date,
          description: entry.description,
          reference: entry.reference,
          status: entry.status,
          total_debit: totalDebit,
          total_credit: totalCredit,
          currency: entry.currency
        }])
        .select()
        .single();

      if (entryError) throw entryError;

      // Insert journal entry lines
      const linesToInsert = lines.map(line => ({
        ...line,
        journal_entry_id: entryData.id,
        account_code: accounts.find(acc => acc.id === line.account_id)?.code || '',
        account_name: accounts.find(acc => acc.id === line.account_id)?.name || ''
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      return { ...entryData, lines: linesToInsert };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      setEntryLines([]);
    },
  });

  // Update journal entry mutation
  const updateEntry = useMutation({
    mutationFn: async ({ entry, lines }: { entry: JournalEntry; lines: JournalEntryLine[] }) => {
      // Calculate totals
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

      // Update journal entry
      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .update({
          entry_number: entry.entry_number,
          date: entry.date,
          description: entry.description,
          reference: entry.reference,
          status: entry.status,
          total_debit: totalDebit,
          total_credit: totalCredit,
          currency: entry.currency
        })
        .eq('id', entry.id)
        .select()
        .single();

      if (entryError) throw entryError;

      // Delete existing lines
      await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', entry.id);

      // Insert updated lines
      const linesToInsert = lines.map(line => ({
        ...line,
        journal_entry_id: entry.id,
        account_code: accounts.find(acc => acc.id === line.account_id)?.code || '',
        account_name: accounts.find(acc => acc.id === line.account_id)?.name || ''
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      return { ...entryData, lines: linesToInsert };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      setEntryLines([]);
    },
  });

  // Delete journal entry mutation
  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
  });

  const handleNewEntry = () => {
    setEditingEntry(null);
    setEntryLines([]);
    setIsDialogOpen(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEntryLines(entry.lines);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette écriture ?')) {
      deleteEntry.mutate(id);
    }
  };

  const handleAddLine = () => {
    setEntryLines([
      ...entryLines,
      {
        id: crypto.randomUUID(),
        journal_entry_id: editingEntry?.id || '',
        account_id: '',
        account_code: '',
        account_name: '',
        debit: 0,
        credit: 0,
        description: '',
        reference: ''
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setEntryLines(entryLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalEntryLine, value: any) => {
    const newLines = [...entryLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setEntryLines(newLines);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const entryData = {
      entry_number: formData.get('entry_number') as string,
      date: formData.get('date') as string,
      description: formData.get('description') as string,
      reference: formData.get('reference') as string,
      status: formData.get('status') as JournalEntry['status'],
      currency: formData.get('currency') as string,
    };

    if (editingEntry) {
      updateEntry.mutate({ entry: { ...editingEntry, ...entryData }, lines: entryLines });
    } else {
      createEntry.mutate({ entry: entryData, lines: entryLines });
    }
  };

  // Calculate totals for the form
  const totalDebit = entryLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = entryLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <MainLayout title="Écritures Comptables" subtitle="Créer, modifier et gérer les écritures comptables">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                placeholder="Rechercher des écritures..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="DRAFT">Brouillon</SelectItem>
                <SelectItem value="POSTED">Posté</SelectItem>
                <SelectItem value="REVERSED">Annulé</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-36"
              />
              <span className="self-center">à</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-36"
              />
            </div>
          </div>
          
          <Button onClick={handleNewEntry}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Écriture
          </Button>
        </div>

        <div className="bg-card rounded-lg border shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">N° ÉCRITURE</TableHead>
                <TableHead className="w-[120px]">DATE</TableHead>
                <TableHead>DESCRIPTION</TableHead>
                <TableHead className="w-[120px]">RÉFÉRENCE</TableHead>
                <TableHead className="w-[120px]">STATUT</TableHead>
                <TableHead className="w-[120px]">TOTAL DÉBIT</TableHead>
                <TableHead className="w-[120px]">TOTAL CRÉDIT</TableHead>
                <TableHead className="text-right w-[120px]">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">Chargement...</TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">Aucune écriture trouvée.</TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>{entry.reference || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'POSTED' ? 'default' : entry.status === 'DRAFT' ? 'secondary' : 'destructive'}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      <CurrencyDisplay amountUSD={entry.total_debit} />
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      <CurrencyDisplay amountUSD={entry.total_credit} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entry.id)}
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

        {/* Journal Entry Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? 'Modifier l\'Écriture' : 'Nouvelle Écriture'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_number">Numéro d'Écriture *</Label>
                  <Input
                    id="entry_number"
                    name="entry_number"
                    defaultValue={editingEntry?.entry_number || `JNL-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={editingEntry?.date || format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Statut *</Label>
                  <Select name="status" defaultValue={editingEntry?.status || 'DRAFT'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Brouillon</SelectItem>
                      <SelectItem value="POSTED">Posté</SelectItem>
                      <SelectItem value="REVERSED">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Devise *</Label>
                  <Select name="currency" defaultValue={editingEntry?.currency || 'USD'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CDF">CDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingEntry?.description || ''}
                    required
                    rows={2}
                  />
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="reference">Référence</Label>
                  <Input
                    id="reference"
                    name="reference"
                    defaultValue={editingEntry?.reference || ''}
                  />
                </div>
              </div>
              
              {/* Journal Entry Lines */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Lignes d'Écriture</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Ajouter une ligne
                  </Button>
                </div>
                
                {entryLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune ligne d'écriture. Ajoutez une ligne pour commencer.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {entryLines.map((line, index) => (
                      <Card key={index}>
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-sm font-medium">Ligne {index + 1}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-5 space-y-2">
                              <Label htmlFor={`account_id_${index}`}>Compte *</Label>
                              <Select 
                                value={line.account_id} 
                                onValueChange={(value) => handleLineChange(index, 'account_id', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un compte" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.code} - {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor={`debit_${index}`}>Débit</Label>
                              <Input
                                id={`debit_${index}`}
                                type="number"
                                step="0.01"
                                value={line.debit || 0}
                                onChange={(e) => handleLineChange(index, 'debit', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor={`credit_${index}`}>Crédit</Label>
                              <Input
                                id={`credit_${index}`}
                                type="number"
                                step="0.01"
                                value={line.credit || 0}
                                onChange={(e) => handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            
                            <div className="md:col-span-2 space-y-2">
                              <Label htmlFor={`description_${index}`}>Description</Label>
                              <Input
                                id={`description_${index}`}
                                value={line.description || ''}
                                onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                              />
                            </div>
                            
                            <div className="md:col-span-1 flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveLine(index)}
                                className="h-9 w-9 p-0"
                              >
                                <MinusCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Totals Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Débit</p>
                  <h3 className={`text-lg font-bold ${totalDebit > 0 ? 'text-red-600' : 'text-foreground'}`}>
                    <CurrencyDisplay amountUSD={totalDebit} />
                  </h3>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Crédit</p>
                  <h3 className={`text-lg font-bold ${totalCredit > 0 ? 'text-green-600' : 'text-foreground'}`}>
                    <CurrencyDisplay amountUSD={totalCredit} />
                  </h3>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Équilibre</p>
                  <h3 className={`text-lg font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {isBalanced ? 'Équilibré' : 'Non équilibré'}
                  </h3>
                </div>
              </div>
              
              {/* Validation Message */}
              {!isBalanced && (
                <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full mr-2 bg-red-500"></div>
                    <span>
                      L'écriture n'est pas équilibrée. Le total des débits ({totalDebit.toFixed(2)}) 
                      ne correspond pas au total des crédits ({totalCredit.toFixed(2)}).
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingEntry(null);
                    setEntryLines([]);
                  }}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntry.isPending || updateEntry.isPending || !isBalanced}
                >
                  {createEntry.isPending || updateEntry.isPending ? (
                    <>
                      <span className="mr-2">Enregistrement...</span>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingEntry ? 'Mettre à jour' : 'Créer'}
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

export default JournalEntries;