import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAsuAimlChatCompletion } from "../src/core/llm";
import type { AsuAimlProviderConfig } from "../src/core/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestAsuAimlChatCompletion", () => {
  it("fails fast when ASU returns a project rate-limit response", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Rate limit for project has exceeded. Try again later.",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const config: AsuAimlProviderConfig = {
      apiKey: "test-key",
      baseUrl: "https://example.com/query",
      model: "gpt-5.2",
      modelProvider: "openai",
      temperature: 0.2,
      timeoutMs: 50,
    };

    await expect(
      requestAsuAimlChatCompletion(config, [
        { role: "system", content: "System instructions" },
        { role: "user", content: "Review this diff" },
      ]),
    ).rejects.toThrow(/Rate limit for project has exceeded/);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});