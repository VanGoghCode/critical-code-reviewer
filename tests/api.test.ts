import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASU_MODEL_PROVIDER,
  createAsuAimlProviderConfig,
  readAsuAimlProviderConfig,
} from "../src/core/api";

describe("asu provider config", () => {
  it("defaults the model provider to asu when omitted", () => {
    const config = createAsuAimlProviderConfig({
      apiKey: "api-key",
      model: "gpt5_2",
    });

    expect(config.modelProvider).toBe(DEFAULT_ASU_MODEL_PROVIDER);
  });

  it("keeps an explicit model provider when provided", () => {
    const config = createAsuAimlProviderConfig({
      apiKey: "api-key",
      model: "gpt5_2",
      modelProvider: "custom-provider",
    });

    expect(config.modelProvider).toBe("custom-provider");
  });

  it("reads the asu default from environment configuration", () => {
    const config = readAsuAimlProviderConfig({
      ASU_API_KEY: "api-key",
      ASU_MODEL: "gpt5_2",
    });

    expect(config.modelProvider).toBe(DEFAULT_ASU_MODEL_PROVIDER);
  });
});
