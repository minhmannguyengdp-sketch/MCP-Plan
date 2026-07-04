const URL0 = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const H = (x = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  Accept: 'application/json',
  ...x
});

const J = (s, p) => new Response(JSON.stringify(p), {
  status: s,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
  }
});

const id = (p) => `${p}_${crypto.randomUUID().replaceAll('-', '')}`;

function u(t, q = {}) {
  const x = new URL(`/rest/v1/${t}`, URL0);
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') x.searchParams.set(k, String(v));
  });
  return x;
}

async function get(t, q) {
  const r = await fetch(u(t, q), { headers: H() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function ins(t, row) {
  const r = await fetch(u(t), {
    method: 'POST',
    headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify([row])
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function patch(t, row, q) {
  const r = await fetch(u(t, q), {
    method: 'PATCH',
    headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function count(t, q) {
  const r = await fetch(u(t, { select: 'id', limit: 1, ...q }), {
    headers: H({ Prefer: 'count=exact' })
  });
  if (!r.ok) throw new Error(await r.text());
  return Number(r.headers.get('content-range')?.split('/')[1] || 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return J(204, {});
  if (req.method !== 'POST') return J(405, { ok: false, error: 'method_not_allowed' });

  try {
    const b = await req.json().catch(() => ({}));
    const scid = String(b.sessionCustomerId || b.session_customer_id || b.id || '').trim();
    const title = String(b.title || b.followupTitle || b.followup_title || '').trim();

    if (!scid) return J(400, { ok: false, error: 'session_customer_id_required' });
    if (!title) return J(400, { ok: false, error: 'followup_title_required' });

    const sc = (await get('mcp_session_customers', {
      select: 'id,session_id,route_id,route_customer_id,customer_id,customer_name,visit_id',
      id: `eq.${scid}`,
      limit: 1
    }))[0];

    if (!sc) return J(400, { ok: false, error: 'session_customer_not_found' });

    const type = String(b.followupType || b.followup_type || b.type || 'general').trim().toLowerCase();
    const priority = String(b.priority || 'medium').trim().toLowerCase();

    const f = (await ins('mcp_followups', {
      id: id('mcf'),
      session_id: sc.session_id,
      session_customer_id: sc.id,
      visit_id: sc.visit_id || null,
      route_id: sc.route_id || null,
      route_customer_id: sc.route_customer_id || null,
      customer_id: sc.customer_id || null,
      customer_name: sc.customer_name || 'Khách chưa tên',
      followup_type: type,
      title,
      due_date: String(b.dueDate || b.due_date || '').trim() || null,
      status: 'open',
      priority,
      owner: String(b.owner || '').trim() || null,
      note: String(b.note || '').trim() || null,
      raw_payload: { source: 'edge_mcp_day_followup' }
    }))[0];

    const c = await count('mcp_followups', {
      session_customer_id: `eq.${sc.id}`,
      status: 'eq.open'
    });

    const updated = (await patch('mcp_session_customers', {
      followup_count: c,
      updated_at: new Date().toISOString()
    }, {
      id: `eq.${sc.id}`
    }))[0];

    return J(200, {
      data: { followup: f, sessionCustomer: updated, followupCount: c },
      receivedAt: new Date().toISOString()
    });
  } catch (e) {
    return J(500, { ok: false, error: String(e?.message || e) });
  }
});
