import { NextResponse } from "next/server";
import { getAllFeaturesStatus } from "@/lib/env";

export async function GET() {
  const status = getAllFeaturesStatus();
  return NextResponse.json({
    status: "ok",
    features: status,
    allConfigured: status.every((f) => f.isConfigured),
  });
}
