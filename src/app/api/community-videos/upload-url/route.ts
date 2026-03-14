import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPresignedUploadUrl } from "@/lib/r2";
import { formatErrorResponse, UserErrors } from "@/lib/user-errors";

// POST /api/community-videos/upload-url
// Returns a presigned R2 URL for direct browser upload (bypasses Vercel body limit)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const body = await request.json();
    const filename: string = body.filename || "video.mp4";
    const contentType: string = body.contentType || "video/mp4";
    const fileSize: number = body.fileSize || 0;

    // Validate
    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.INVALID_INPUT, "Video must be under 50MB"),
        { status: 400 },
      );
    }

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const result = await createPresignedUploadUrl(
      `community-${sanitized}`,
      contentType,
    );

    if (!result) {
      return NextResponse.json(
        formatErrorResponse(UserErrors.INTERNAL_ERROR, "Could not generate upload URL"),
        { status: 500 },
      );
    }

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      key: result.key,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error("[upload-url]", error);
    return NextResponse.json(
      formatErrorResponse(UserErrors.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
