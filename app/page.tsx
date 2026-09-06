'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BadgeCheck, CalendarDays, KeyRound, LayoutDashboard, LoaderCircle, LogOut, Menu, ReceiptText, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster, toast } from '@/components/ui/toast';

type View = 'cadastro' | 'clientes' | 'dashboard' | 'usuarios';
type ClientStatus = 'Pagando' | 'Quitado' | 'Cancelado';
type Client = { id: string; name: string; document: string; birthDate: string; address: string; dueDay: string; status: ClientStatus };
type ClientInput = Omit<Client, 'id'>;
type SessionUser = { id: string; email: string; role: string };
type AppUser = SessionUser & { createdAt: string };

const initialForm: ClientInput = { name: '', document: '', birthDate: '', address: '', dueDay: '', status: 'Pagando' };

function formatDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

const navItems: Array<{ id: View; label: string; icon: typeof UserPlus; adminOnly?: boolean }> = [
  { id: 'cadastro', label: 'Cadastro de clientes', icon: UserPlus },
  { id: 'clientes', label: 'Clientes e parcelas', icon: ReceiptText },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'usuarios', label: 'Usuários', icon: KeyRound, adminOnly: true },
];

export default function Home() {
  const [view, setView] = useState<View>('cadastro');
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [form, setForm] = useState<ClientInput>(initialForm);
  const [clients, setClients] = useState<Client[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState({ email: '', password: '' });
  const [usersLoading, setUsersLoading] = useState(false);
  const title = useMemo(() => navItems.find((item) => item.id === view)?.label || 'Dioni', [view]);

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<{ clients: Client[] }>('/api/clientes');
      setClients(data.clients.map((client) => ({ ...client, document: formatDocument(client.document) })));
      setConnectionError('');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Não foi possível carregar os cadastros.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void api<{ user: SessionUser }>('/api/auth/session')
      .then(async ({ user }) => { setSession(user); await loadClients(); })
      .catch(() => setSession(null))
      .finally(() => setSessionLoading(false));
  }, [loadClients]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setLoginError('');
    try {
      const data = await api<{ user: SessionUser }>('/api/auth/login', 'POST', login);
      setSession(data.user);
      setLogin({ email: '', password: '' });
      await loadClients();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setIsSaving(false);
    }
  };

  const logout = async () => {
    await api('/api/auth/logout', 'POST').catch(() => undefined);
    setSession(null);
    setClients([]);
    setView('cadastro');
  };

  const addClient = useCallback(async (data: ClientInput) => {
    const result = await api<{ client: Client }>('/api/clientes', 'POST', data);
    const client = { ...result.client, document: formatDocument(result.client.document) };
    setClients((current) => [client, ...current.filter((item) => item.id !== client.id)]);
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
    } finally { setIsSaving(false); }
  };

  const removeClient = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsSaving(true);
    try {
      await api('/api/clientes', 'DELETE', { id: target.id });
      setClients((current) => current.filter((client) => client.id !== target.id));
      setDeleteTarget(null);
      toast.add({ title: 'Cliente excluído', description: `${target.name} foi removido dos cadastros.`, type: 'success' });
    } catch (error) {
      toast.add({ title: 'Não foi possível excluir', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' });
    } finally { setIsSaving(false); }
  };

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers((await api<{ users: AppUser[] }>('/api/usuarios')).users); }
    catch (error) { toast.add({ title: 'Usuários indisponíveis', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' }); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => { if (view === 'usuarios' && session?.role === 'admin') void loadUsers(); }, [view, session, loadUsers]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const { user } = await api<{ user: AppUser }>('/api/usuarios', 'POST', userForm);
      setUsers((current) => [user, ...current]);
      setUserForm({ email: '', password: '' });
      toast.add({ title: 'Acesso criado', description: `${user.email} já pode entrar no sistema.`, type: 'success' });
    } catch (error) {
      toast.add({ title: 'Acesso não criado', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' });
    } finally { setIsSaving(false); }
  };

  const removeUser = async () => {
    if (!deleteUserTarget) return;
    const target = deleteUserTarget;
    setIsSaving(true);
    try {
      await api('/api/usuarios', 'DELETE', { id: target.id });
      setUsers((current) => current.filter((user) => user.id !== target.id));
      setDeleteUserTarget(null);
      toast.add({ title: 'Usuário excluído', description: `O acesso de ${target.email} foi removido.`, type: 'success' });
    } catch (error) {
      toast.add({ title: 'Não foi possível excluir', description: error instanceof Error ? error.message : 'Tente novamente.', type: 'error' });
    } finally { setIsSaving(false); }
  };

  useEffect(() => {
    type ModelContext = { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as unknown as { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'create_client_registration', title: 'Cadastrar cliente', description: 'Cadastra um cliente na base Dioni.',
      inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', minLength: 2 }, document: { type: 'string', minLength: 11 }, birthDate: { type: 'string' }, address: { type: 'string', minLength: 3 }, dueDay: { type: 'string', pattern: '^(?:[1-9]|[12][0-9]|3[01])$' }, status: { type: 'string', enum: ['Pagando', 'Quitado', 'Cancelado'] } }, required: ['name', 'document', 'birthDate', 'address', 'dueDay', 'status'] },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        if (!input || typeof input !== 'object') throw new Error('Dados do cliente inválidos.');
        const value = input as ClientInput;
        const client = await addClient({ ...value, name: value.name.trim(), address: value.address.trim(), document: formatDocument(value.document) });
        setView('cadastro');
        return { id: client.id, name: client.name, status: client.status };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [addClient]);

  if (sessionLoading) return <div className="auth-loading"><LoaderCircle className="spin" /><span>Carregando acesso</span></div>;

  if (!session) return <Toaster><main className="login-page"><form className="login-card" onSubmit={submitLogin}><img src="/dioni-logo.png" alt="Dioni Chácaras" /><div className="login-copy"><span>Acesso restrito</span><h1>Entre no sistema</h1><p>Use seu e-mail e sua senha para continuar.</p></div><label className="field"><span>E-mail</span><Input required type="email" autoComplete="username" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} placeholder="voce@empresa.com.br" /></label><label className="field"><span>Senha</span><Input required type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder="Sua senha" /></label>{loginError && <p className="login-error">{loginError}</p>}<Button type="submit" className="primary-action login-button" disabled={isSaving}><KeyRound /> {isSaving ? 'Entrando...' : 'Entrar'}</Button></form></main></Toaster>;

  const visibleNav = navItems.filter((item) => !item.adminOnly || session.role === 'admin');

  return <Toaster><SidebarProvider defaultOpen><Sidebar collapsible="offcanvas" className="border-r-0"><SidebarHeader className="brand-area"><img src="/dioni-logo.png" alt="Dioni Chácaras" /></SidebarHeader><SidebarContent className="px-3"><SidebarGroup><SidebarGroupContent><SidebarMenu>{visibleNav.map((item) => { const Icon = item.icon; return <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view === item.id} onClick={() => setView(item.id)}><Icon /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="sidebar-foot"><div className="account-pill"><div><small>Conectado como</small><strong>{session.email}</strong></div><Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Sair"><LogOut /></Button></div><div className="connection-pill"><span className="connection-offline" /><div><strong>Status da API do Bradesco</strong><small>Aguardando integração</small></div></div></SidebarFooter></Sidebar>

    <SidebarInset className="app-surface"><header className="topbar"><div className="topbar-title"><SidebarTrigger className="mobile-trigger" aria-label="Abrir menu"><Menu /></SidebarTrigger><div><span>Gestão de recebíveis</span><h1>{title}</h1></div></div><div className="today-chip"><CalendarDays /><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}</span></div></header>

      {view === 'cadastro' && <main className="page-content"><section className="intro-row"><div><p className="eyebrow">Novo cadastro</p><h2>Informações do cliente</h2><p>Preencha os dados para incluir um cliente na carteira.</p></div><span className="required-note">* Campos obrigatórios</span></section><form className="registration-card" onSubmit={submit}><div className="form-grid"><label className="field field-wide"><span>Nome completo *</span><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Digite o nome do cliente" /></label><label className="field"><span>CPF ou CNPJ *</span><Input required minLength={14} value={form.document} onChange={(event) => setForm({ ...form, document: formatDocument(event.target.value) })} placeholder="000.000.000-00" inputMode="numeric" /></label><label className="field"><span>Data de nascimento *</span><Input required type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label><label className="field field-wide"><span>Endereço completo *</span><Input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, bairro, cidade e estado" /></label><label className="field"><span>Dia do vencimento *</span><Select required value={form.dueDay} onValueChange={(value) => setForm({ ...form, dueDay: value || '' })}><SelectTrigger className="select-field"><SelectValue placeholder="Selecione o dia" /></SelectTrigger><SelectContent>{Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <SelectItem key={day} value={day}>Dia {day}</SelectItem>)}</SelectContent></Select></label><label className="field"><span>Status do cliente *</span><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: (value || 'Pagando') as ClientStatus })}><SelectTrigger className="select-field"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pagando">Pagando</SelectItem><SelectItem value="Quitado">Quitado</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></label></div><div className="form-actions"><Button type="button" variant="outline" onClick={() => setForm(initialForm)} disabled={isSaving}>Limpar campos</Button><Button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? <LoaderCircle className="spin" /> : <UserPlus />} {isSaving ? 'Salvando...' : 'Cadastrar cliente'}</Button></div></form>
        <section className="session-list"><div className="section-heading"><div><h2>Clientes cadastrados</h2><p>Registros armazenados na base exclusiva da Dioni.</p></div><span>{clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}</span></div>{isLoading ? <div className="empty-list"><LoaderCircle className="spin" /><strong>Carregando cadastros</strong></div> : clients.length === 0 ? <div className="empty-list"><UsersRound /><strong>Nenhum cliente cadastrado</strong><p>{connectionError || 'Os clientes adicionados aparecerão aqui.'}</p></div> : <div className="client-list">{clients.map((client) => <article className="client-row" key={client.id}><div className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</div><div className="client-main"><strong>{client.name}</strong><span>{client.document} · vencimento dia {client.dueDay}</span></div><span className={`status-badge status-${client.status.toLowerCase()}`}><BadgeCheck /> {client.status}</span><Button type="button" variant="ghost" size="icon-sm" className="delete-button" onClick={() => setDeleteTarget(client)} aria-label={`Excluir ${client.name}`}><Trash2 /></Button></article>)}</div>}</section></main>}

      {(view === 'clientes' || view === 'dashboard') && <main className="placeholder-page"><div className="placeholder-icon">{view === 'clientes' ? <ReceiptText /> : <LayoutDashboard />}</div><h2>{view === 'clientes' ? 'Clientes e parcelas' : 'Dashboard financeiro'}</h2></main>}

      {view === 'usuarios' && session.role === 'admin' && <main className="page-content users-page"><section className="intro-row"><div><p className="eyebrow">Controle de acesso</p><h2>Criar novo usuário</h2><p>O acesso será liberado imediatamente, sem confirmação por e-mail.</p></div></section><form className="registration-card user-form" onSubmit={createUser}><div className="form-grid"><label className="field"><span>E-mail *</span><Input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} placeholder="usuario@empresa.com.br" /></label><label className="field"><span>Senha *</span><Input required minLength={6} type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} placeholder="Mínimo de 6 caracteres" /></label></div><div className="form-actions"><Button type="submit" className="primary-action" disabled={isSaving}><UserPlus /> {isSaving ? 'Criando...' : 'Criar acesso'}</Button></div></form><section className="session-list"><div className="section-heading"><div><h2>Usuários cadastrados</h2><p>Acessos ativos no sistema Dioni.</p></div><span>{users.length} usuários</span></div>{usersLoading ? <div className="empty-list"><LoaderCircle className="spin" /><strong>Carregando usuários</strong></div> : <div className="user-list">{users.map((user) => <article className="user-row" key={user.id}><div className="user-icon"><ShieldCheck /></div><div className="user-main"><strong>{user.email}</strong><span>{user.role === 'admin' ? 'Administrador' : 'Usuário'}</span></div>{user.id !== session.id && <Button type="button" variant="ghost" size="icon-sm" className="delete-button user-delete-button" onClick={() => setDeleteUserTarget(user)} aria-label={`Excluir ${user.email}`}><Trash2 /></Button>}</article>)}</div>}</section></main>}
    </SidebarInset>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir cliente?</AlertDialogTitle><AlertDialogDescription>O cadastro de {deleteTarget?.name} será removido permanentemente. Esta ação não poderá ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeClient} disabled={isSaving}><Trash2 /> {isSaving ? 'Excluindo...' : 'Excluir cliente'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(deleteUserTarget)} onOpenChange={(open) => !open && setDeleteUserTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir usuário?</AlertDialogTitle><AlertDialogDescription>O acesso de {deleteUserTarget?.email} será removido permanentemente do sistema Dioni.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeUser} disabled={isSaving}><Trash2 /> {isSaving ? 'Excluindo...' : 'Excluir usuário'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </SidebarProvider></Toaster>;
}
