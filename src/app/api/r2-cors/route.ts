import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureBucketCors, getBucketCors } from "@/lib/r2";

/**
 * POST /api/r2-cors — Set CORS rules on the R2 bucket (admin only).
 * GET  /api/r2-cors — Read current CORS rules (admin only).
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email.toLowerCase());
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensureBucketCors();

  if (result.success) {
    return NextResponse.json({ message: "CORS configured successfully" });
  }

  return NextResponse.json({ error: result.error }, { status: 500 });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cors = await getBucketCors();
  return NextResponse.json({ cors });
}
