/**
 * Video Walkthrough Service — Cinematic architectural video from renders.
 * Uses Kling Official API (api.klingai.com) with JWT authentication.
 *
 * Official API reference (from Kling API docs):
 *   POST /v1/videos/image2video — create task
 *   GET  /v1/videos/image2video/{task_id} — poll status
 *
 * Supported model_name: kling-v1-6, kling-v2-1, kling-v2-1-master, kling-v2-6
 * Supported duration: "5" or "10"
 * Supported mode: "std" (720p) or "pro" (1080p)
 * cfg_scale: 0-1 (only on v1.x models)
 *
 * Strategy: Generate TWO 10s videos (exterior + interior) for 20s total,
 * or a single 10s cinematic walkthrough for speed.
 */

import { generateId } from "@/lib/utils";

// ─── Configuration ──────────────────────────────────────────────────────────

const KLING_BASE_URL = "https://api.klingai.com";
const KLING_IMAGE2VIDEO_PATH = "/v1/videos/image2video";
const COST_PER_SECOND = 0.10;
const REQUEST_TIMEOUT_MS = 600_000; // 10 minutes
const POLL_INTERVAL_MS = 8_000;     // 8 seconds between status checks
const JWT_EXPIRY_SECONDS = 1800;

// Model names in priority order — try best first, fall back
const MODELS = ["kling-v2-6", "kling-v2-1-master", "kling-v2-1", "kling-v1-6"] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoInput {
  imageUrl: string;
  prompt: string;
  /** "5" or "10" — only valid values for official Kling API */
  duration?: "5" | "10";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  negativePrompt?: string;
  mode?: "std" | "pro";
}

export interface VideoResult {
  id: string;
  videoUrl: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  costUsd: number;
  generationTimeMs: number;
  shotCount: number;
}

interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: string;           // "submitted" | "processing" | "succeed" | "failed"
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

// ─── Error Handling ─────────────────────────────────────────────────────────

class VideoServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean
  ) {
    super(message);
    this.name = "VideoServiceError";
  }
}

// ─── JWT Token Generation ───────────────────────────────────────────────────

function generateJwtToken(): string {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new VideoServiceError(
      "KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables are required",
      500,
      false
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: accessKey,
    exp: now + JWT_EXPIRY_SECONDS,
    nbf: now - 5,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const crypto = require("crypto");
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── API Helpers ────────────────────────────────────────────────────────────

async function klingFetch(
  path: string,
  options: { method: string; body?: unknown }
): Promise<KlingTaskResponse> {
  const token = generateJwtToken();
  const url = `${KLING_BASE_URL}${path}`;

  console.log(`[Video] ${options.method} ${path}`, options.body ? JSON.stringify(options.body).slice(0, 300) : "");

  const res = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    // Try parsing JSON body first (Kling returns JSON even on 429)
    let errorMessage = `Kling API HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.code === 1102) {
        errorMessage = "Kling account balance is empty — please top up your Kling AI account at klingai.com to generate professional videos";
      } else if (errData?.message) {
        errorMessage = `Kling API error: ${errData.message} (code ${errData.code})`;
      }
    } catch {
      const text = await res.text().catch(() => "Unknown error");
      errorMessage = `Kling API HTTP ${res.status}: ${text.slice(0, 300)}`;
    }
    console.error("[Video] Kling HTTP error", { status: res.status, path, errorMessage });
    throw new VideoServiceError(errorMessage, res.status, res.status >= 500);
  }

  const data = (await res.json()) as KlingTaskResponse;

  if (data.code !== 0) {
    console.error("[Video] Kling API error", { code: data.code, message: data.message, requestId: data.request_id });
    const msg = data.code === 1102
      ? "Kling account balance is empty — please top up your Kling AI account at klingai.com"
      : `Kling API error: ${data.message} (code ${data.code})`;
    throw new VideoServiceError(msg, 400, false);
  }

  return data;
}

/**
 * Poll a Kling task until it completes or fails.
 */
async function pollTask(taskId: string): Promise<KlingTaskResponse> {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    const result = await klingFetch(
      `${KLING_IMAGE2VIDEO_PATH}/${taskId}`,
      { method: "GET" }
    );

    const status = result.data.task_status;
    console.log(`[Video] Poll #${attempt}: status="${status}" taskId=${taskId}`);

    if (status === "succeed") {
      return result;
    }

    if (status === "failed") {
      throw new VideoServiceError(
        `Video generation failed: ${result.data.task_status_msg ?? "Unknown error"}`,
        500,
        true
      );
    }

    // "submitted" or "processing" — keep waiting
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new VideoServiceError(
    "Video generation timed out after 10 minutes",
    504,
    true
  );
}

// ─── Core Function ──────────────────────────────────────────────────────────

/**
 * Create a Kling image-to-video task, trying model names in priority order.
 * Returns as soon as one model accepts the task.
 */
async function createTask(
  imageUrl: string,
  prompt: string,
  negativePrompt: string,
  duration: "5" | "10",
  aspectRatio: string,
  mode: string,
): Promise<KlingTaskResponse> {
  const errors: string[] = [];

  for (const modelName of MODELS) {
    try {
      console.log(`[Video] Trying model: ${modelName}, mode: ${mode}, duration: ${duration}s`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model_name: modelName,
        image: imageUrl,
        prompt: prompt.slice(0, 2500), // API max 2500 chars
        negative_prompt: negativePrompt.slice(0, 2500),
        aspect_ratio: aspectRatio,
        mode,
        duration,
      };

      // cfg_scale only supported on v1.x models
      if (modelName.startsWith("kling-v1")) {
        body.cfg_scale = 0.5;
      }

      const result = await klingFetch(KLING_IMAGE2VIDEO_PATH, {
        method: "POST",
        body,
      });

      console.log(`[Video] Task created with ${modelName}! taskId=${result.data.task_id}`);
      return result;
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`${modelName}: ${msg}`);
      console.warn(`[Video] ${modelName} failed: ${msg}`);
    }
  }

  throw new VideoServiceError(
    `All Kling models failed:\n${errors.join("\n")}`,
    500,
    false
  );
}

/**
 * Generate a cinematic walkthrough video using Kling Official API.
 * Creates the task, polls until complete, returns the video URL.
 */
export async function generateWalkthroughVideo(
  input: VideoInput
): Promise<VideoResult> {
  const {
    imageUrl,
    prompt,
    duration = "10",
    aspectRatio = "16:9",
    negativePrompt = "blur, distortion, low quality, warped geometry, melting walls, deformed architecture, shaky camera, noise, artifacts, morphing surfaces, bent lines, wobbly structure, jittery motion, flickering textures, plastic appearance, fisheye distortion, floating objects",
    mode = "pro",
  } = input;

  const startTime = Date.now();
  const requestId = generateId();

  console.log("[Video] Starting walkthrough generation", {
    requestId,
    imageUrl: imageUrl.slice(0, 80),
    duration: `${duration}s`,
    mode,
    promptLength: prompt.length,
  });

  try {
    // Step 1: Create the task (tries models in priority order)
    const createResult = await createTask(
      imageUrl,
      prompt,
      negativePrompt,
      duration,
      aspectRatio,
      mode,
    );

    const taskId = createResult.data.task_id;

    // Step 2: Poll until completion
    const completedTask = await pollTask(taskId);

    const videos = completedTask.data.task_result?.videos;
    const videoUrl = videos?.[0]?.url;

    if (!videoUrl) {
      throw new VideoServiceError(
        "Video generation completed but no video URL returned",
        500,
        false
      );
    }

    const durationSeconds = parseInt(duration, 10);
    const costUsd = parseFloat((durationSeconds * COST_PER_SECOND).toFixed(3));
    const generationTimeMs = Date.now() - startTime;

    console.log("[Video] Walkthrough complete!", {
      requestId,
      taskId,
      videoUrl: videoUrl.slice(0, 80),
      durationSeconds,
      costUsd,
      generationTimeMs,
    });

    return {
      id: taskId,
      videoUrl,
      fileName: `walkthrough_${requestId}.mp4`,
      fileSize: 0,
      durationSeconds,
      costUsd,
      generationTimeMs,
      shotCount: 1,
    };
  } catch (error: unknown) {
    const err = error as Record<string, unknown> | null;
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const message =
      typeof err?.message === "string"
        ? err.message
        : "Video generation failed";

    console.error("[Video] Generation failed", { requestId, error: message });

    if (error instanceof VideoServiceError) throw error;

    throw new VideoServiceError(message, status, status >= 500);
  }
}

// ─── Dual Video (15s total: 5s exterior + 10s interior) ─────────────────────

export interface DualVideoResult {
  exteriorVideo: VideoResult;
  interiorVideo: VideoResult;
  totalDurationSeconds: number;
  totalCostUsd: number;
  totalGenerationTimeMs: number;
}

/**
 * Generate 15s architectural walkthrough as TWO parallel videos:
 *   Part 1 (5s): Ultra-realistic 3D model — left, right, top views
 *   Part 2 (10s): Interior walkthrough — lobby, corridors, spaces
 *
 * Both videos are generated in parallel via Promise.all for speed.
 */
export async function generateDualWalkthrough(
  imageUrl: string,
  buildingDescription: string,
  mode: "std" | "pro" = "pro",
): Promise<DualVideoResult> {
  const negativePrompt = "blur, distortion, low quality, warped geometry, melting walls, deformed architecture, shaky camera, noise, artifacts, morphing surfaces, bent lines, wobbly structure, jittery motion, flickering textures, plastic appearance, fisheye distortion, floating objects, wireframe, cartoon, sketch, low polygon, unrealistic proportions, text overlay, watermark";

  const exteriorPrompt = buildExteriorPrompt(buildingDescription);
  const interiorPrompt = buildInteriorPrompt(buildingDescription);

  console.log("[Video] Starting DUAL walkthrough (5s exterior + 10s interior)");

  // Generate both in parallel for speed
  const [exterior, interior] = await Promise.all([
    generateWalkthroughVideo({
      imageUrl,
      prompt: exteriorPrompt,
      duration: "5",
      mode,
      negativePrompt,
    }),
    generateWalkthroughVideo({
      imageUrl,
      prompt: interiorPrompt,
      duration: "10",
      mode,
      negativePrompt,
    }),
  ]);

  console.log("[Video] DUAL walkthrough complete!", {
    exteriorId: exterior.id,
    interiorId: interior.id,
    totalCost: (exterior.costUsd + interior.costUsd).toFixed(2),
    totalTime: exterior.generationTimeMs + interior.generationTimeMs,
  });

  return {
    exteriorVideo: exterior,
    interiorVideo: interior,
    totalDurationSeconds: 15,
    totalCostUsd: exterior.costUsd + interior.costUsd,
    totalGenerationTimeMs: Math.max(exterior.generationTimeMs, interior.generationTimeMs),
  };
}

// ─── Prompt Builders ────────────────────────────────────────────────────────

function detectBuildingType(desc: string) {
  const lower = desc.toLowerCase();
  const isHighrise =
    /(\d{2,})\s*(?:stor|floor)/i.test(lower) ||
    lower.includes("tower") ||
    lower.includes("skyscraper");
  const isResidential =
    lower.includes("villa") ||
    lower.includes("house") ||
    lower.includes("residential");
  const hasGlass =
    lower.includes("glass") ||
    lower.includes("curtain wall") ||
    lower.includes("glazing");
  return { isHighrise, isResidential, hasGlass };
}

/**
 * Build prompt for Part 1 (5s): Ultra-realistic exterior — front elevation approach,
 * cinematic side orbit, and dramatic aerial rise to roof plan.
 *
 * Scene timeline:
 *   0s–2s: Front elevation — camera slowly moves toward main entrance
 *   2s–4s: Side elevation — cinematic orbit revealing building depth
 *   4s–5s: Aerial rise — camera rises to top-down roof plan view
 */
export function buildExteriorPrompt(buildingDescription: string): string {
  const desc = buildingDescription.slice(0, 600);
  const { isHighrise, hasGlass } = detectBuildingType(desc);

  const materialNote = hasGlass
    ? "Glass curtain wall façade reflecting sunlight, visible structural grid, realistic ray-traced reflections."
    : "Highly detailed facade panels, exposed steel structural frame, reinforced concrete slabs, realistic architectural materials with photorealistic accuracy.";

  if (isHighrise) {
    return (
      `Ultra-realistic 3D BIM architectural visualization of: ${desc.slice(0, 200)}. ` +
      "Highly detailed parametric architecture, high-polygon detailed BIM building model. " +
      "Camera starts at front elevation view, slowly moving forward toward the main entrance — " +
      "large glass façade reflecting sunlight, visible structural grid, landscaped plaza, realistic shadows and architectural proportions. " +
      "Camera smoothly transitions to side elevation with cinematic orbit movement — " +
      "building depth becomes visible, façade panels, balconies, structural columns, curtain wall systems, and architectural details clearly visible. " +
      "Camera rises upward into aerial top view — roof plan visible with detailed BIM elements: " +
      "HVAC units, skylights, rooftop mechanical equipment, service walkways, parapet walls, and full site plan. " +
      `${materialNote} ` +
      "Cinematic drone movement, smooth orbit, slow dolly camera motion, " +
      "natural daylight, realistic shadows, global illumination, " +
      "photorealistic architecture render, professional BIM visualization, extremely detailed geometry, 4K architectural animation, " +
      "Unreal Engine quality rendering, ray tracing, ultra detailed, no distortion."
    );
  }

  return (
    `Ultra-realistic 3D BIM architectural visualization of: ${desc.slice(0, 200)}. ` +
    "Highly detailed parametric architecture, high-polygon detailed BIM building model. " +
    "Camera starts at front elevation view, slowly moving forward toward the main entrance — " +
    "large façade with visible structural grid, entrance canopy, ground floor frontage, landscaped plaza, realistic shadows and architectural proportions. " +
    "Camera smoothly transitions to side elevation with cinematic orbit movement — " +
    "building depth becomes visible, façade panels, structural columns, curtain wall systems, secondary entrances, and architectural details clearly visible. " +
    "Camera rises dramatically to aerial bird's-eye top-down view — " +
    "complete roof plan visible with BIM elements: mechanical penthouses, HVAC units, skylights, solar panels, drainage, service walkways, parapet walls, and surrounding streets. " +
    `${materialNote} ` +
    "Cinematic drone movement, smooth orbit, architectural flythrough, slow dolly camera motion, " +
    "natural daylight, realistic shadows, global illumination, " +
    "photorealistic architecture render, professional BIM visualization, extremely detailed geometry, 4K architectural animation, " +
    "Unreal Engine quality rendering, ray tracing, ultra detailed, no distortion."
  );
}

/**
 * Build prompt for Part 2 (10s): BIM sectional cutaway revealing structure,
 * then interior walkthrough with detailed BIM elements.
 *
 * Scene timeline:
 *   0s–3s: Roof transitions to BIM sectional cutaway — floors visible layer by layer
 *          showing structural beams, columns, floor slabs, building core, staircases, elevator shafts
 *   3s–10s: Camera moves inside — modern lobby and office floor with interior BIM details:
 *           glass partitions, staircases, elevators, furniture layout, lighting fixtures, finishes
 */
export function buildInteriorPrompt(buildingDescription: string): string {
  const desc = buildingDescription.slice(0, 600);
  const { isHighrise, isResidential } = detectBuildingType(desc);

  if (isHighrise) {
    return (
      `Ultra-realistic 3D BIM architectural visualization interior of: ${desc.slice(0, 200)}. ` +
      "Highly detailed parametric architecture, high-polygon detailed BIM building model. " +
      "Scene begins with BIM sectional cutaway — roof transitions to reveal floors layer by layer, " +
      "structural beams, columns, floor slabs, building core, staircases, and elevator shafts all clearly visible in cross-section. " +
      "Camera then moves inside the building showing modern grand double-height lobby — " +
      "reception desk, exposed concrete columns with steel base plates, polished terrazzo flooring, " +
      "elevator bank with stainless steel doors and floor indicator panels. " +
      "Camera glides through corridor with suspended acoustic ceiling, recessed LED downlights, fire sprinkler heads, smoke detectors, " +
      "enters typical office floor revealing open plan workspace, glass partitions, raised access floor, " +
      "cable trays visible below ceiling, floor-to-ceiling curtain wall mullions, " +
      "furniture layout, lighting fixtures, and architectural finishes clearly visible. " +
      "Camera approaches window wall revealing panoramic views through high-performance glazing. " +
      "Soft interior lighting, natural daylight, global illumination, realistic shadows, " +
      "real material textures — concrete formwork marks, brushed steel, timber veneers, glass, " +
      "cinematic smooth dolly camera motion, architectural flythrough, " +
      "photorealistic architecture render, professional BIM visualization, extremely detailed geometry, 4K architectural animation, " +
      "Unreal Engine quality rendering, ray tracing, ultra detailed, no distortion."
    );
  }

  if (isResidential) {
    return (
      `Ultra-realistic 3D BIM architectural visualization interior of: ${desc.slice(0, 200)}. ` +
      "Highly detailed parametric architecture, high-polygon detailed BIM building model. " +
      "Scene begins with BIM sectional cutaway — roof peels away to reveal floor structure layer by layer, " +
      "timber joists, load-bearing walls, floor slabs, staircases, and service risers visible in cross-section. " +
      "Camera moves inside through the front entrance — solid timber door frame, entrance hall with tiled floor, " +
      "glides into open-plan living room with double-height space, exposed timber ceiling joists, engineered hardwood flooring, " +
      "floor-to-ceiling windows with triple-glazed units and integrated blinds, " +
      "moves through kitchen with stone countertops, integrated appliances, pendant lights over island, " +
      "glass partitions, staircases, furniture layout, lighting fixtures, and architectural finishes clearly visible, " +
      "exits through sliding glass doors onto terrace showing outdoor living space and landscaped garden. " +
      "Soft interior lighting, warm morning sunlight streaming through windows, global illumination, realistic shadows, " +
      "high-end material finishes throughout, " +
      "cinematic smooth dolly camera motion, architectural flythrough, " +
      "photorealistic architecture render, professional BIM visualization, extremely detailed geometry, 4K architectural animation, " +
      "Unreal Engine quality rendering, ray tracing, ultra detailed, no distortion."
    );
  }

  return (
    `Ultra-realistic 3D BIM architectural visualization interior of: ${desc.slice(0, 200)}. ` +
    "Highly detailed parametric architecture, high-polygon detailed BIM building model. " +
    "Scene begins with BIM sectional cutaway — roof transitions to reveal floors layer by layer, " +
    "structural beams, columns, floor slabs, building core, staircases, and elevator shafts all clearly visible in cross-section. " +
    "Camera moves inside the building — enters through main entrance showing spacious lobby, " +
    "high ceilings, exposed structural columns, polished concrete floor, feature reception desk, " +
    "glides through corridor with suspended ceiling grid, LED panels, sprinkler heads, air diffusers, " +
    "passes glazed meeting room with acoustic glass partitions, " +
    "enters open office area with workstations, glass partitions, furniture layout, lighting fixtures, " +
    "exposed ceiling showing painted ductwork and cable trays, " +
    "staircases, elevators, and architectural finishes clearly visible throughout, " +
    "approaches large windows revealing exterior view through high-performance glazing. " +
    "Soft interior lighting, natural daylight, global illumination, realistic shadows, " +
    "real material textures — concrete, timber, steel, and glass, " +
    "cinematic smooth dolly camera motion, architectural flythrough, " +
    "photorealistic architecture render, professional BIM visualization, extremely detailed geometry, 4K architectural animation, " +
    "Unreal Engine quality rendering, ray tracing, ultra detailed, no distortion."
  );
}

/**
 * Build a cinematic AEC walkthrough prompt from the building description.
 * Single-video fallback: complete 15s timeline in one video.
 * Kept under 2500 chars (Kling API limit).
 *
 * Scene timeline (15s):
 *   0s–3s:  Front elevation — camera moves toward main entrance
 *   3s–6s:  Side elevation — cinematic orbit revealing depth
 *   6s–9s:  Aerial rise — roof plan with BIM elements
 *   9s–12s: BIM sectional cutaway — floors layer by layer
 *   12s–15s: Interior walkthrough — lobby and office floor
 */
export function buildArchitecturalVideoPrompt(
  buildingDescription: string
): string {
  const desc = buildingDescription.slice(0, 800);
  const lower = desc.toLowerCase();

  const hasGlass =
    lower.includes("glass") ||
    lower.includes("curtain wall") ||
    lower.includes("glazing");

  const materialNote = hasGlass
    ? "Glass curtain wall façade reflecting sunlight, visible structural grid, ray-traced reflections."
    : "Exposed steel structural frame, reinforced concrete slabs, realistic architectural materials, visible structural grid.";

  // Universal 5-phase camera motion matching the user's scene timeline
  const cameraMotion =
    "Front elevation view — camera slowly moves forward toward main entrance, " +
    "large façade with visible structural grid, landscaped plaza, realistic shadows and architectural proportions. " +
    "Camera smoothly transitions to side elevation with cinematic orbit — " +
    "building depth visible, façade panels, structural columns, curtain wall systems, architectural details. " +
    "Camera rises upward into aerial top view — roof plan with HVAC units, skylights, mechanical equipment, service walkways, parapet walls. " +
    "Roof transitions into BIM sectional cutaway — floors visible layer by layer showing structural beams, columns, floor slabs, building core, staircases, elevator shafts. " +
    "Camera moves inside showing modern lobby and office floor — glass partitions, staircases, elevators, furniture layout, lighting fixtures, architectural finishes.";

  return (
    `Ultra-realistic 3D BIM architectural visualization of: ${desc.slice(0, 200)}. ` +
    "Highly detailed parametric architecture, high-polygon detailed BIM building model. " +
    `${cameraMotion} ` +
    `${materialNote} ` +
    "Cinematic drone movement, smooth orbit, architectural flythrough, slow dolly camera motion, " +
    "natural daylight, realistic shadows, soft interior lighting, global illumination, " +
    "photorealistic architecture render, professional BIM visualization, extremely detailed geometry, 4K architectural animation, " +
    "Unreal Engine quality rendering, ray tracing, ultra detailed, no distortion."
  );
}

/**
 * Build multi-shot camera prompts (kept for backward compatibility).
 * Now returns a single-element array since official Kling API doesn't support multi-shot.
 */
export function buildArchitecturalMultiShot(
  buildingDescription: string
): { prompt: string; duration: number }[] {
  return [{ prompt: buildArchitecturalVideoPrompt(buildingDescription), duration: 10 }];
}

// ─── Non-Blocking Submit + Status Check ──────────────────────────────────────

export interface SubmittedVideoTasks {
  exteriorTaskId: string;
  interiorTaskId: string;
  buildingDescription: string;
  submittedAt: number;
}

/**
 * Submit both video generation tasks to Kling API and return immediately
 * with the task IDs (no polling/waiting).
 */
export async function submitDualWalkthrough(
  imageUrl: string,
  buildingDescription: string,
  mode: "std" | "pro" = "pro",
): Promise<SubmittedVideoTasks> {
  const negativePrompt = "blur, distortion, low quality, warped geometry, melting walls, deformed architecture, shaky camera, noise, artifacts, morphing surfaces, bent lines, wobbly structure, jittery motion, flickering textures, plastic appearance, fisheye distortion, floating objects, wireframe, cartoon, sketch, low polygon, unrealistic proportions, text overlay, watermark";

  const exteriorPrompt = buildExteriorPrompt(buildingDescription);
  const interiorPrompt = buildInteriorPrompt(buildingDescription);

  console.log("[Video] Submitting DUAL walkthrough tasks (non-blocking)");

  // Submit both tasks in parallel — don't poll, return task IDs immediately
  const [exteriorResult, interiorResult] = await Promise.all([
    createTask(imageUrl, exteriorPrompt, negativePrompt, "5", "16:9", mode),
    createTask(imageUrl, interiorPrompt, negativePrompt, "10", "16:9", mode),
  ]);

  const result = {
    exteriorTaskId: exteriorResult.data.task_id,
    interiorTaskId: interiorResult.data.task_id,
    buildingDescription,
    submittedAt: Date.now(),
  };

  console.log("[Video] Tasks submitted!", {
    exteriorTaskId: result.exteriorTaskId,
    interiorTaskId: result.interiorTaskId,
  });

  return result;
}

export interface VideoTaskStatus {
  exteriorStatus: "submitted" | "processing" | "succeed" | "failed";
  interiorStatus: "submitted" | "processing" | "succeed" | "failed";
  exteriorVideoUrl: string | null;
  interiorVideoUrl: string | null;
  progress: number; // 0-100
  isComplete: boolean;
  hasFailed: boolean;
  failureMessage: string | null;
}

/**
 * Check the status of both video tasks. Returns progress percentage
 * and video URLs when available. Non-blocking single check.
 */
export async function checkDualVideoStatus(
  exteriorTaskId: string,
  interiorTaskId: string,
): Promise<VideoTaskStatus> {
  // Check both tasks in parallel
  const [extResult, intResult] = await Promise.all([
    klingFetch(`${KLING_IMAGE2VIDEO_PATH}/${exteriorTaskId}`, { method: "GET" }),
    klingFetch(`${KLING_IMAGE2VIDEO_PATH}/${interiorTaskId}`, { method: "GET" }),
  ]);

  const extStatus = extResult.data.task_status as VideoTaskStatus["exteriorStatus"];
  const intStatus = intResult.data.task_status as VideoTaskStatus["interiorStatus"];

  const extUrl = extResult.data.task_result?.videos?.[0]?.url ?? null;
  const intUrl = intResult.data.task_result?.videos?.[0]?.url ?? null;

  // Calculate progress: exterior = 33% weight (5s), interior = 67% weight (10s)
  const statusToProgress = (s: string) =>
    s === "succeed" ? 100 : s === "processing" ? 50 : s === "submitted" ? 10 : 0;

  const extProgress = statusToProgress(extStatus);
  const intProgress = statusToProgress(intStatus);
  const progress = Math.round(extProgress * 0.33 + intProgress * 0.67);

  const hasFailed = extStatus === "failed" || intStatus === "failed";
  const isComplete = extStatus === "succeed" && intStatus === "succeed";

  let failureMessage: string | null = null;
  if (extStatus === "failed") {
    failureMessage = `Exterior video failed: ${extResult.data.task_status_msg ?? "Unknown error"}`;
  } else if (intStatus === "failed") {
    failureMessage = `Interior video failed: ${intResult.data.task_status_msg ?? "Unknown error"}`;
  }

  console.log("[Video] Status check:", {
    exterior: extStatus,
    interior: intStatus,
    progress,
    isComplete,
  });

  return {
    exteriorStatus: extStatus,
    interiorStatus: intStatus,
    exteriorVideoUrl: extUrl,
    interiorVideoUrl: intUrl,
    progress,
    isComplete,
    hasFailed,
    failureMessage,
  };
}
