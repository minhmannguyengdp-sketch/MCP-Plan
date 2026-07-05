export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ data: { templates: [] }, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
