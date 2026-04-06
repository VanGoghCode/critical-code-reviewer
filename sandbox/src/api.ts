import type {
  LoadedPromptArchitecture,
  ReviewFileInput,
  ReviewRunMetrics,
  ReviewReport,
  ReviewRequest,
} from "../../src/core/types";

export interface FetchArchitecturesResponse {
  architectures: LoadedPromptArchitecture[];
}

export interface StartRunResponse {
  report: ReviewReport;
  sentPrompt?: string;
  rawModelOutput?: string;
  metrics?: ReviewRunMetrics;
}

export interface SandboxChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SandboxChatResponse {
  mode: string;
  model?: string;
  reply: string;
}

export async function fetchArchitectures(): Promise<
  LoadedPromptArchitecture[]
> {
  const response = await fetch("/api/architectures");
  if (!response.ok) {
    throw new Error(`Unable to load architectures: ${response.status}`);
  }

  const payload = (await response.json()) as FetchArchitecturesResponse;
  return payload.architectures;
}

export async function startSandboxRun(
  request: ReviewRequest,
): Promise<StartRunResponse> {
  const response = await fetch("/api/review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Unable to start sandbox review: ${response.status}`);
  }

  return (await response.json()) as StartRunResponse;
}

export async function sendSandboxChatMessage(params: {
  message: string;
  history?: SandboxChatMessage[];
}): Promise<SandboxChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(
      `Unable to send chat test message (${response.status}): ${rawBody}`,
    );
  }

  return JSON.parse(rawBody) as SandboxChatResponse;
}

export function toReviewRequestPayload(
  files: ReviewFileInput[],
  metadata: string,
  architectureId: string,
  promptOverrides?: Record<string, string>,
): ReviewRequest {
  return {
    architectureId,
    files,
    context: {
      metadata: metadata.trim().length > 0 ? metadata : undefined,
    },
    promptOverrides,
  };
}
