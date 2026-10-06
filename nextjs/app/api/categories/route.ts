import { proxyToNexWall } from "@/lib/nexwall";

// GET /api/categories -> NexWall GET /categories.
// Categories rarely change, so cache them for an hour.

export async function GET() {
  return proxyToNexWall("/categories", new URLSearchParams(), 3600);
}
