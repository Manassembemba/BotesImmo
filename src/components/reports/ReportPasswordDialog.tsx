import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ReportPasswordDialogProps {
    open: boolean;
    onSuccess: () => void;
    onCancel?: () => void;
}

export const ReportPasswordDialog = ({ open, onSuccess, onCancel }: ReportPasswordDialogProps) => {
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password.trim()) {
            toast.error('Veuillez entrer le mot de passe');
            return;
        }

        setIsVerifying(true);

        try {
            const { data, error } = await supabase.rpc('check_report_password', {
                input_password: password
            });

            if (error) throw error;

            if (data === true) {
                toast.success('Accès autorisé');
                onSuccess();
            } else {
                toast.error('Mot de passe incorrect');
                setPassword('');
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            toast.error('Erreur lors de la vérification');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleClose = () => {
        if (onCancel) {
            onCancel();
        } else {
            navigate(-1); // Go back to previous page
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center">Accès aux Rapports</DialogTitle>
                    <DialogDescription className="text-center">
                        Cette page est protégée. Veuillez entrer le mot de passe pour continuer.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isVerifying}
                            autoFocus
                            className="text-center"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isVerifying}>
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Vérification...
                            </>
                        ) : (
                            'Déverrouiller'
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};
