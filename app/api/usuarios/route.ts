import { apiError, DIONI_APP_ID, requireAdmin, supabaseRequest, type SupabaseUser } from '@/lib/supabase-server';

function belongsToDioni(user: SupabaseUser) {
  return user.app_metadata?.app_id === DIONI_APP_ID;
}

function serialize(user: SupabaseUser) {
  return { id: user.id, email: user.email || '', role: user.app_metadata?.role || 'user', createdAt: user.created_at || '' };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const response = await supabaseRequest('/auth/v1/admin/users?page=1&per_page=100');
    const data = await response.json() as { users?: SupabaseUser[] } | SupabaseUser[];
    const users = Array.isArray(data) ? data : data.users || [];
    return Response.json({ users: users.filter(belongsToDioni).map(serialize) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.');
    if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    const response = await supabaseRequest('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role: 'user', app_id: DIONI_APP_ID } }),
    });
    const user = await response.json() as SupabaseUser;
    return Response.json({ user: serialize(user) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const administrator = await requireAdmin(request);
    const input = await request.json() as { id?: unknown };
    const id = typeof input.id === 'string' ? input.id : '';
    if (!id) throw new Error('Usuário inválido.');
    if (id === administrator.id) throw new Error('Você não pode excluir o próprio acesso.');

    const response = await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(id)}`);
    const target = await response.json() as SupabaseUser;
    if (!belongsToDioni(target)) throw new Error('Este usuário não pertence ao sistema Dioni.');
    const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    if (target.email?.toLowerCase() === initialEmail) throw new Error('O administrador inicial não pode ser excluído.');

    await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
