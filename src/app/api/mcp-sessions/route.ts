export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ data: { sessions: [] }, receivedAt: new Date().toISOString() });
}
