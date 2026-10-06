import type { NextRequest } from "next/server";
import { pickParams, proxyToNexWall } from "@/lib/nexwall";

// GET /api/wallpapers?page=&per_page=&category_id=&type=&search=&sort=
// Proxies to NexWall GET /wallpapers. The API key never leaves the server.

const ALLOWED = ["page", "per_page", "category_id", "type", "search", "sort"] as const;

export async function GET(request: NextRequest) {
  const query = pickParams(request.nextUrl.searchParams, ALLOWED);
  // Cache each unique page/filter combination for 5 minutes to save quota.
  return proxyToNexWall("/wallpapers", query, 300);
}
