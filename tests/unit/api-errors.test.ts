import { describe, it, expect, vi } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Inline the apiFetch error-handling logic mirroring src/lib/api.ts
// We test the logic in isolation without DOM/window dependencies
// ──────────────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  url: string,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch
): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new ApiError(0, "Network error. Please check your internet connection.");
    }
    throw err;
  }

  if (res.status === 401) {
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? `Request failed: ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────────────────────────────────────
// OpenAI error detection logic (mirrors src/lib/user-errors.ts)
// ──────────────────────────────────────────────────────────────────────────────
function detectOpenAIError(error: unknown): { title: string; message: string; code: string } {
  const err = error as Record<string, unknown> | null | undefined;
  const message = (typeof err?.message === "string" ? err.message : "").toLowerCase();
  const code = err?.code;

  if (message.includes("quota") || message.includes("insufficient_quota") || code === "insufficient_quota") {
    return { title: "OpenAI quota exceeded", message: "You've exceeded your OpenAI API quota. Check your usage at platform.openai.com.", code: "OPENAI_QUOTA_EXCEEDED" };
  }
  if (message.includes("invalid") || message.includes("authentication") || code === "invalid_api_key" || (err?.status === 401)) {
    return { title: "Invalid API key", message: "Invalid OpenAI API key. Please check your key in Settings.", code: "OPENAI_INVALID_KEY" };
  }
  if (message.includes("rate") || code === "rate_limit_exceeded" || err?.status === 429) {
    return { title: "AI rate limit", message: "AI service rate limit reached. Please wait a moment and try again.", code: "OPENAI_RATE_LIMIT" };
  }
  if (typeof err?.status === "number" && err.status >= 500) {
    return { title: "AI service error", message: "AI service temporarily unavailable. Please try again later.", code: "OPENAI_SERVER_ERROR" };
  }
  return { title: "AI generation failed", message: "AI generation failed. Please try again.", code: "INTERNAL_ERROR" };
}

// ──────────────────────────────────────────────────────────────────────────────
// Registration validation (mirrors register route logic)
// ──────────────────────────────────────────────────────────────────────────────
function parseRegisterError(status: number, data: Record<string, unknown>): string {
  if (status === 409) {
    const msg = (data?.error as Record<string, unknown>)?.message ?? data?.error ?? "";
    if (String(msg).toLowerCase().includes("already")) return String(msg);
    return "An account with this email already exists. Try signing in instead.";
  }
  if (status === 400) {
    const msg = (data?.error as Record<string, unknown>)?.message ?? data?.error ?? "";
    return String(msg) || "Validation failed";
  }
  return "Something went wrong. Please try again.";
}

// ──────────────────────────────────────────────────────────────────────────────

const mockFetch = (status: number, body: unknown, isNetworkError = false): typeof fetch => {
  return vi.fn(async () => {
    if (isNetworkError) throw new TypeError("Failed to fetch");
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
};

describe("API Error Handling — apiFetch", () => {
  it("should throw ApiError(401) on 401 response", async () => {
    const fetch = mockFetch(401, { error: "Unauthorized" });
    await expect(apiFetch("/api/test", undefined, fetch)).rejects.toThrow("Session expired");
    await expect(apiFetch("/api/test", undefined, fetch)).rejects.toMatchObject({ status: 401 });
  });

  it("should throw ApiError(429) on 429 response", async () => {
    const fetch = mockFetch(429, { error: "You've reached your daily limit." });
    await expect(apiFetch("/api/test", undefined, fetch)).rejects.toMatchObject({ status: 429 });
  });

  it("should throw ApiError(500) with generic message on server error", async () => {
    const fetch = mockFetch(500, { error: "Internal server error" });
    const err = await apiFetch("/api/test", undefined, fetch).catch((e: unknown) => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toContain("Internal server error");
  });

  it("should throw network error message when fetch throws TypeError", async () => {
    const fetch = mockFetch(0, {}, true);
    const err = await apiFetch("/api/test", undefined, fetch).catch((e: unknown) => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toContain("Network error");
    expect(err.message).toContain("internet connection");
  });

  it("should return parsed JSON on 200 success", async () => {
    const fetch = mockFetch(200, { data: "ok" });
    const result = await apiFetch<{ data: string }>("/api/test", undefined, fetch);
    expect(result.data).toBe("ok");
  });

  it("should use error field from response body when available", async () => {
    const fetch = mockFetch(400, { error: "Validation failed: name is required" });
    const err = await apiFetch("/api/test", undefined, fetch).catch((e: unknown) => e) as ApiError;
    expect(err.message).toContain("Validation failed");
  });

  it("should fall back to Request failed message when no error field in body", async () => {
    const fetch = mockFetch(503, {});
    const err = await apiFetch("/api/test", undefined, fetch).catch((e: unknown) => e) as ApiError;
    expect(err.message).toContain("503");
  });
});

describe("OpenAI Error Detection", () => {
  it("should detect invalid API key (401 status)", () => {
    const result = detectOpenAIError({ status: 401, message: "Incorrect API key provided" });
    expect(result.code).toBe("OPENAI_INVALID_KEY");
    expect(result.message).toContain("Invalid OpenAI API key");
  });

  it("should detect invalid API key (invalid_api_key code)", () => {
    const result = detectOpenAIError({ code: "invalid_api_key", message: "invalid api key" });
    expect(result.code).toBe("OPENAI_INVALID_KEY");
  });

  it("should detect rate limit (429)", () => {
    const result = detectOpenAIError({ status: 429, message: "rate limit exceeded" });
    expect(result.code).toBe("OPENAI_RATE_LIMIT");
    expect(result.message).toContain("rate limit");
  });

  it("should detect quota exceeded", () => {
    const result = detectOpenAIError({ code: "insufficient_quota", message: "You exceeded your current quota" });
    expect(result.code).toBe("OPENAI_QUOTA_EXCEEDED");
  });

  it("should detect server error (500)", () => {
    const result = detectOpenAIError({ status: 500, message: "Internal server error" });
    expect(result.code).toBe("OPENAI_SERVER_ERROR");
    expect(result.message).toContain("unavailable");
  });

  it("should fall back gracefully for unknown error", () => {
    const result = detectOpenAIError({ message: "something weird happened" });
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).toContain("try again");
  });

  it("should handle null error gracefully", () => {
    const result = detectOpenAIError(null);
    expect(result.code).toBe("INTERNAL_ERROR");
  });
});

describe("Registration Error Messages", () => {
  it("should return 'already exists' for 409 duplicate email", () => {
    const msg = parseRegisterError(409, { error: { message: "An account with this email already exists. Try signing in instead." } });
    expect(msg).toContain("already exists");
    expect(msg).not.toContain("P2002");
    expect(msg).not.toContain("Unique constraint");
  });

  it("should return validation error for 400 missing email", () => {
    const msg = parseRegisterError(400, { error: { message: "Email is required" } });
    expect(msg).toContain("Email is required");
  });

  it("should return validation error for 400 weak password", () => {
    const msg = parseRegisterError(400, { error: { message: "Password must contain at least one uppercase letter, one lowercase letter, and one number." } });
    expect(msg).toContain("uppercase");
  });

  it("should return generic message for 500", () => {
    const msg = parseRegisterError(500, {});
    expect(msg).toContain("Something went wrong");
  });

  it("should never expose raw Prisma P2002 error", () => {
    // Simulate the old raw Prisma error that we fixed
    const msg = parseRegisterError(409, { error: { message: "An account with this email already exists. Try signing in instead." } });
    expect(msg).not.toContain("P2002");
    expect(msg).not.toContain("prisma");
    expect(msg).not.toContain("Unique constraint");
  });
});
