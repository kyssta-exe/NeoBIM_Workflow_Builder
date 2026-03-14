import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/community-videos/[id]/like — toggle like count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const increment = body.action === "unlike" ? -1 : 1;

    const video = await prisma.communityVideo.update({
      where: { id },
      data: { likes: { increment } },
      select: { likes: true },
    });

    // Prevent negative likes
    if (video.likes < 0) {
      await prisma.communityVideo.update({
        where: { id },
        data: { likes: 0 },
      });
      return NextResponse.json({ likes: 0 });
    }

    return NextResponse.json({ likes: video.likes });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
