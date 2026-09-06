import { apiError, requireUser, supabaseRequest } from '@/lib/supabase-server';

type ClientStatus = 'Pagando' | 'Quitado' | 'Cancelado';

type ClientRow = {
  id: string;
  nome: string;
  documento: string;
  data_nascimento: string;
  endereco: string;
  dia_vencimento: number;
  status: ClientStatus;
};

const statuses = new Set<ClientStatus>(['Pagando', 'Quitado', 'Cancelado']);

function serialize(row: ClientRow) {
  return { id: row.id, name: row.nome, document: row.documento, birthDate: row.data_nascimento, address: row.endereco, dueDay: String(row.dia_vencimento), status: row.status };
}

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const response = await supabaseRequest('/rest/v1/dioni_clientes?select=id,nome,documento,data_nascimento,endereco,dia_vencimento,status&order=created_at.desc');
    const rows = await response.json() as ClientRow[];
    return Response.json({ clients: rows.map(serialize) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const input = await request.json() as Record<string, unknown>;
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    const name = text(input.name).trim();
    const address = text(input.address).trim();
    const birthDate = text(input.birthDate);
    const document = text(input.document).replace(/\D/g, '');
    const dueDay = Number(input.dueDay);
    const status = text(input.status) as ClientStatus;
    if (!name || !address || !birthDate) throw new Error('Preencha todos os campos obrigatórios.');
    if (document.length !== 11 && document.length !== 14) throw new Error('Informe um CPF ou CNPJ válido.');
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error('Informe um dia de vencimento entre 1 e 31.');
    if (!statuses.has(status)) throw new Error('Selecione um status válido.');

    const response = await supabaseRequest('/rest/v1/dioni_clientes', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ nome: name, documento: document, data_nascimento: birthDate, endereco: address, dia_vencimento: dueDay, status }),
    });
    const rows = await response.json() as ClientRow[];
    return Response.json({ client: serialize(rows[0]) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUser(request);
    const input = await request.json() as { id?: string };
    if (!input.id || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error('Cadastro inválido.');
    await supabaseRequest(`/rest/v1/dioni_clientes?id=eq.${encodeURIComponent(input.id)}`, { method: 'DELETE' });
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
