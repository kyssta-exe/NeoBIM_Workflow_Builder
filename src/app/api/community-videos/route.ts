import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadVideoToR2 } from "@/lib/r2";
import {
  formatErrorResponse,
  UserErrors,
} from "@/lib/user-errors";

// Allow up to 2 minutes for video uploads
export const maxDuration = 120;

// ─── GET — List community videos (public) ───────────────────────────────────

export async function GET() {
  try {
    const videos = await prisma.communityVideo.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    const response = NextResponse.json({ videos });
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    console.error("[community-videos GET]", error);
    return NextResponse.json(
      formatErrorResponse(UserErrors.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

// ─── POST — Upload community video (auth required) ──────────────────────────

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/3gpp", "video/3gpp2"];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("video") as File | null;
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const category = (formData.get("category") as string) || "General";
    const duration = (formData.get("duration") as string) || null;

    // ── Validate ─────────────────────────────────────────────────────────────

    if (!file) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.MISSING_REQUIRED_FIELD("video")),
        { status: 400 },
      );
    }
    if (!title || title.length < 3) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.MISSING_REQUIRED_FIELD("title")),
        { status: 400 },
      );
    }

    console.log("[community-videos POST] File type:", file.type, "name:", file.name, "size:", file.size);

    // Accept known video types, or allow by extension if MIME is empty (iOS Safari)
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isVideoByExt = ["mp4", "webm", "mov", "m4v", "3gp"].includes(ext);
    if (!ALLOWED_TYPES.includes(file.type) && !(file.type === "" && isVideoByExt) && !file.type.startsWith("video/")) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.INVALID_INPUT, `File type "${file.type || "unknown"}" not accepted. Use MP4, WebM, or MOV.`),
        { status: 400 },
      );
    }
    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.INVALID_INPUT, "Video must be under 50MB"),
        { status: 400 },
      );
    }

    // ── Upload to R2 ─────────────────────────────────────────────────────────

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    console.log("[community-videos POST] Uploading to R2:", sanitized, "size:", buffer.length);
    const result = await uploadVideoToR2(buffer, `community-${sanitized}`);
    console.log("[community-videos POST] R2 result:", JSON.stringify(result));

    if (!result.success) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.INTERNAL_ERROR, result.error),
        { status: 500 },
      );
    }

    // ── Create DB record ─────────────────────────────────────────────────────

    const video = await prisma.communityVideo.create({
      data: {
        authorId: session.user.id,
        title: title.slice(0, 120),
        description: description?.slice(0, 500) || null,
        category,
        videoUrl: result.url,
        duration,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error("[community-videos POST]", error);
    return NextResponse.json(
      formatErrorResponse(UserErrors.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
