'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BadgeCheck, CalendarDays, LayoutDashboard, LoaderCircle, Menu, ReceiptText, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster, toast } from '@/components/ui/toast';

type View = 'cadastro' | 'clientes' | 'dashboard';
type ClientStatus = 'Pagando' | 'Quitado' | 'Cancelado';
type Client = { id: string; name: string; document: string; birthDate: string; address: string; dueDay: string; status: ClientStatus };
type ClientInput = Omit<Client, 'id'>;

const initialForm: ClientInput = { name: '', document: '', birthDate: '', address: '', dueDay: '', status: 'Pagando' };

function formatDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

async function api<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/clientes', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || 'Não foi possível acessar os cadastros.');
  return data;
}

const navItems: Array<{ id: View; label: string; icon: typeof UserPlus }> = [
  { id: 'cadastro', label: 'Cadastro de clientes', icon: UserPlus },
  { id: 'clientes', label: 'Clientes e parcelas', icon: ReceiptText },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export default function Home() {
  const [view, setView] = useState<View>('cadastro');
  const [form, setForm] = useState<ClientInput>(initialForm);
  const [clients, setClients] = useState<Client[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const title = useMemo(() => navItems.find((item) => item.id === view)?.label || 'Dioni', [view]);

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<{ clients: Client[] }>('GET');
      setClients(data.clients.map((client) => ({ ...client, document: formatDocument(client.document) })));
      setConnectionError('');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Não foi possível carregar os cadastros.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadClients(); }, [loadClients]);

  const addClient = useCallback(async (data: ClientInput) => {
    const result = await api<{ client: Client }>('POST', data);
    const client = { ...result.client, document: formatDocument(result.client.document) };
    setClients((current) => [client, ...current.filter((item) => item.id !== client.id)]);
    setConnectionError('');
    return client;
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const client = await addClient({ ...form, name: form.name.trim(), address: form.address.trim() });
      setForm(initialForm);
      toast.add({ title: 'Cliente cadastrado', description: `${client.name} foi salvo com sucesso.`, type: 'success' });
    } catch (error) {
      toast.add({ title: 'Cadastro não realizado', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const removeClient = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsSaving(true);
    try {
      await api<{ success: boolean }>('DELETE', { id: target.id });
      setClients((current) => current.filter((client) => client.id !== target.id));
      setDeleteTarget(null);
      toast.add({ title: 'Cliente excluído', description: `${target.name} foi removido dos cadastros.`, type: 'success' });
    } catch (error) {
      toast.add({ title: 'Não foi possível excluir', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    type ModelContext = { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as unknown as { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'create_client_registration', title: 'Cadastrar cliente', description: 'Cadastra um cliente na base Dioni.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 2 }, document: { type: 'string', minLength: 11 }, birthDate: { type: 'string' },
          address: { type: 'string', minLength: 3 }, dueDay: { type: 'string', pattern: '^(?:[1-9]|[12][0-9]|3[01])$' },
          status: { type: 'string', enum: ['Pagando', 'Quitado', 'Cancelado'] },
        },
        required: ['name', 'document', 'birthDate', 'address', 'dueDay', 'status'],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        if (!input || typeof input !== 'object') throw new Error('Dados do cliente inválidos.');
        const value = input as ClientInput;
        if (!value.name?.trim() || !value.address?.trim() || !value.document || !value.birthDate || !value.dueDay) throw new Error('Preencha todos os campos obrigatórios.');
        const client = await addClient({ ...value, name: value.name.trim(), address: value.address.trim(), document: formatDocument(value.document) });
        setView('cadastro');
        return { id: client.id, name: client.name, status: client.status };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [addClient]);

  return (
    <Toaster>
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="offcanvas" className="border-r-0">
          <SidebarHeader className="brand-area"><img src="/dioni-logo.png" alt="Dioni Chácaras" /></SidebarHeader>
          <SidebarContent className="px-3">
            <SidebarGroup><SidebarGroupContent><SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                return <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view === item.id} onClick={() => setView(item.id)}><Icon /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
              })}
            </SidebarMenu></SidebarGroupContent></SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="sidebar-foot">
            <div className="connection-pill"><span className={connectionError ? 'connection-offline' : ''} /><div><strong>{connectionError ? 'Supabase não configurado' : 'Supabase conectado'}</strong><small>{connectionError || 'Cadastros armazenados com segurança'}</small></div></div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="app-surface">
          <header className="topbar">
            <div className="topbar-title"><SidebarTrigger className="mobile-trigger" aria-label="Abrir menu"><Menu /></SidebarTrigger><div><span>Gestão de recebíveis</span><h1>{title}</h1></div></div>
            <div className="today-chip"><CalendarDays /><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}</span></div>
          </header>

          {view === 'cadastro' && <main className="page-content">
            <section className="intro-row"><div><p className="eyebrow">Novo cadastro</p><h2>Informações do cliente</h2><p>Preencha os dados para incluir um cliente na carteira.</p></div><span className="required-note">* Campos obrigatórios</span></section>
            <form className="registration-card" onSubmit={submit}>
              <div className="form-grid">
                <label className="field field-wide"><span>Nome completo *</span><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Digite o nome do cliente" autoComplete="name" /></label>
                <label className="field"><span>CPF ou CNPJ *</span><Input required minLength={14} value={form.document} onChange={(event) => setForm({ ...form, document: formatDocument(event.target.value) })} placeholder="000.000.000-00" inputMode="numeric" /></label>
                <label className="field"><span>Data de nascimento *</span><Input required type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
                <label className="field field-wide"><span>Endereço completo *</span><Input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, bairro, cidade e estado" autoComplete="street-address" /></label>
                <label className="field"><span>Dia do vencimento *</span><Select required value={form.dueDay} onValueChange={(value) => setForm({ ...form, dueDay: value || '' })}><SelectTrigger className="select-field"><SelectValue placeholder="Selecione o dia" /></SelectTrigger><SelectContent>{Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <SelectItem key={day} value={day}>Dia {day}</SelectItem>)}</SelectContent></Select></label>
                <label className="field"><span>Status do cliente *</span><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: (value || 'Pagando') as ClientStatus })}><SelectTrigger className="select-field"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pagando">Pagando</SelectItem><SelectItem value="Quitado">Quitado</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></label>
              </div>
              <div className="form-actions"><Button type="button" variant="outline" onClick={() => setForm(initialForm)} disabled={isSaving}>Limpar campos</Button><Button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? <LoaderCircle className="spin" /> : <UserPlus />} {isSaving ? 'Salvando...' : 'Cadastrar cliente'}</Button></div>
            </form>

            <section className="session-list">
              <div className="section-heading"><div><h2>Clientes cadastrados</h2><p>Registros armazenados na base exclusiva da Dioni.</p></div><span>{clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}</span></div>
              {isLoading ? <div className="empty-list"><LoaderCircle className="spin" /><strong>Carregando cadastros</strong></div> : clients.length === 0 ? <div className="empty-list"><UsersRound /><strong>Nenhum cliente cadastrado</strong><p>{connectionError ? 'Configure a conexão do Supabase para começar.' : 'Os clientes adicionados aparecerão aqui.'}</p></div> : <div className="client-list">{clients.map((client) => <article className="client-row" key={client.id}><div className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</div><div className="client-main"><strong>{client.name}</strong><span>{client.document} · vencimento dia {client.dueDay}</span></div><span className={`status-badge status-${client.status.toLowerCase()}`}><BadgeCheck /> {client.status}</span><Button type="button" variant="ghost" size="icon-sm" className="delete-button" onClick={() => setDeleteTarget(client)} aria-label={`Excluir ${client.name}`}><Trash2 /></Button></article>)}</div>}
            </section>
          </main>}

          {view !== 'cadastro' && <main className="placeholder-page"><div className="placeholder-icon">{view === 'clientes' ? <ReceiptText /> : <LayoutDashboard />}</div><h2>{view === 'clientes' ? 'Clientes e parcelas' : 'Dashboard financeiro'}</h2><p>Esta área está preparada e será preenchida quando as conexões e regras forem definidas.</p></main>}
        </SidebarInset>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir cliente?</AlertDialogTitle><AlertDialogDescription>O cadastro de {deleteTarget?.name} será removido permanentemente. Esta ação não poderá ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeClient} disabled={isSaving}><Trash2 /> {isSaving ? 'Excluindo...' : 'Excluir cliente'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </SidebarProvider>
    </Toaster>
  );
}
