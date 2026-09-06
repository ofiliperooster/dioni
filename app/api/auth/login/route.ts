import { apiError, DIONI_APP_ID, getSupabaseConfig, supabaseRequest } from '@/lib/supabase-server';

type LoginResponse = {
  access_token: string;
  expires_in?: number;
  user: { id: string; email?: string; app_metadata?: { role?: string; app_id?: string } };
};

async function ensureInitialAdmin(email: string, password: string) {
  const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialEmail || !initialPassword || email !== initialEmail || password !== initialPassword) return;
  const listResponse = await supabaseRequest('/auth/v1/admin/users?page=1&per_page=1000');
  const list = await listResponse.json() as { users?: Array<{ id: string; email?: string }> } | Array<{ id: string; email?: string }>;
  const users = Array.isArray(list) ? list : list.users || [];
  const existing = users.find((user) => user.email?.toLowerCase() === email);
  const body = JSON.stringify({ email, password, email_confirm: true, app_metadata: { role: 'admin', app_id: DIONI_APP_ID } });

  if (existing) {
    await supabaseRequest(`/auth/v1/admin/users/${existing.id}`, { method: 'PUT', body });
  } else {
    await supabaseRequest('/auth/v1/admin/users', {
      method: 'POST',
      body,
    });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!email || !password) throw new Error('Informe o e-mail e a senha.');
    await ensureInitialAdmin(email, password);

    const { serviceKey } = getSupabaseConfig();
    const response = await supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, `Bearer ${serviceKey}`);
    const session = await response.json() as LoginResponse;
    if (session.user.app_metadata?.app_id !== DIONI_APP_ID) throw new Error('Este usuário não pertence ao sistema Dioni.');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const secure = forwardedProto === 'https' || new URL(request.url).protocol === 'https:';
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', `dioni_access_token=${session.access_token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session.expires_in || 3600}${secure ? '; Secure' : ''}`);
    return new Response(JSON.stringify({ user: { id: session.user.id, email: session.user.email || email, role: session.user.app_metadata?.role || 'user' } }), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('invalid login') || message.includes('invalid credentials')) return Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    return apiError(error);
  }
}
