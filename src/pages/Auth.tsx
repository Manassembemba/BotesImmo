import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client'; // Import supabase client

const loginSchema = z.object({
  credential: z.string().min(1, "L'identifiant est requis"),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    credential: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const validated = loginSchema.parse(formData);
      let emailToLogin = validated.credential;

      // If credential is not an email, assume it's a username and get the email
      if (!validated.credential.includes('@')) {
        const { data, error } = await supabase.rpc('get_email_for_username', {
          p_username: validated.credential
        });

        if (error || !data) {
          throw new Error('Nom d\'utilisateur ou mot de passe incorrect');
        }
        emailToLogin = data;
      }

      const { error } = await signIn(emailToLogin, validated.password);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erreur de connexion',
          description: error.message === 'Invalid login credentials' 
            ? 'Identifiant ou mot de passe incorrect'
            : error.message,
        });
      } else {
        toast({
          title: 'Connexion réussie',
          description: 'Bienvenue sur Botes Immo',
        });
      }
    } catch (err: any) {
       if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(fieldErrors);
      } else {
         toast({
          variant: 'destructive',
          title: 'Erreur de connexion',
          description: err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/LOGO.jpg"
            alt="Botes Immo Logo"
            className="h-16 w-16 object-contain mx-auto rounded-lg mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground">Botes Immo</h1>
          <p className="text-muted-foreground mt-1">Gestion des réservations</p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-medium animate-fade-in">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Connexion</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connectez-vous avec vos identifiants d'entreprise
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credential">Email ou Nom d'utilisateur</Label>
              <Input
                id="credential"
                name="credential"
                type="text"
                value={formData.credential}
                onChange={handleChange}
                placeholder="nom.utilisateur ou email@botesimmo.com"
                className={errors.credential ? 'border-destructive' : ''}
                autoComplete="username"
              />
              {errors.credential && (
                <p className="text-xs text-destructive">{errors.credential}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Application interne réservée aux employés de Botes Immo
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Contactez votre administrateur pour obtenir vos accès
        </p>
      </div>
    </div>
  );
};

export default Auth;
