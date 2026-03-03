import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/user/api-keys
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { apiKeys: true },
  });

  return NextResponse.json({ apiKeys: user?.apiKeys ?? {} });
}

// PATCH /api/user/api-keys
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKeys } = await req.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { apiKeys },
  });

  return NextResponse.json({ success: true });
}
