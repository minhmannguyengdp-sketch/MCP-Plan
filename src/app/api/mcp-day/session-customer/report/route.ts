export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ ok: false, error: "not_implemented" }, { status: 501 });
}
