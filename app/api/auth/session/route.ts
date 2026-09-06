import { apiError, requireUser } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ user: { id: user.id, email: user.email || '', role: user.app_metadata?.role || 'user' } });
  } catch (error) {
    return apiError(error);
  }
}
