import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Target } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../api/client';
import { Button, Field, Input } from '../components/ui/form';
import { Modal } from '../components/ui/Modal';

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mostrarAjudaPassword, setMostrarAjudaPassword] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tenta novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fiori-shell">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-md bg-fiori-surface p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-fiori-primary text-white">
            <Target size={20} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-fiori-text">Gap Analysis</h1>
            <p className="text-xs text-fiori-text-secondary">de Competências</p>
          </div>
        </div>

        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>

        {error && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-fiori-error">
            <AlertCircle size={14} /> {error}
          </p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'A entrar…' : 'Entrar'}
        </Button>

        <button
          type="button"
          onClick={() => setMostrarAjudaPassword(true)}
          className="mt-3 block w-full text-center text-xs text-fiori-text-secondary hover:text-fiori-primary hover:underline"
        >
          Esqueceu-se da password?
        </button>
      </form>

      {mostrarAjudaPassword && (
        <Modal title="Esqueceu-se da password?" onClose={() => setMostrarAjudaPassword(false)}>
          <p className="mb-4 text-sm text-fiori-text-secondary">
            Esta app não envia emails automáticos de reinicialização. Contacta o teu Administrador de RH — ele consegue
            reinicializar a tua password no ecrã de Administração e vai partilhar contigo uma nova password temporária.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setMostrarAjudaPassword(false)}>Percebi</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
