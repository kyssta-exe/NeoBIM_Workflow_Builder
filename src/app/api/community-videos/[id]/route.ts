import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatErrorResponse,
  UserErrors,
} from "@/lib/user-errors";

// DELETE /api/community-videos/[id] — delete own video
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { id } = await params;

    // Verify ownership
    const video = await prisma.communityVideo.findFirst({
      where: { id, authorId: session.user.id },
    });

    if (!video) {
      return NextResponse.json(
        { error: { message: "Video not found or not yours", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    await prisma.communityVideo.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[community-videos DELETE]", error);
    return NextResponse.json(
      formatErrorResponse(UserErrors.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
