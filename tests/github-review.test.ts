import { beforeEach, describe, expect, it, vi } from "vitest";

const { paginateMock, createReviewMock, getOctokitMock } = vi.hoisted(() => {
  const paginateMock = vi.fn();
  const createReviewMock = vi.fn();
  const getOctokitMock = vi.fn(() => ({
    paginate: paginateMock,
    rest: {
      pulls: {
        listReviewComments: vi.fn(),
        createReview: createReviewMock,
      },
    },
  }));

  return {
    paginateMock,
    createReviewMock,
    getOctokitMock,
  };
});

vi.mock("@actions/github", () => ({
  getOctokit: getOctokitMock,
}));

import { publishInlineReview } from "../src/core/github-review";

beforeEach(() => {
  paginateMock.mockReset();
  createReviewMock.mockReset();
  getOctokitMock.mockClear();

  paginateMock.mockResolvedValue([]);
  createReviewMock.mockResolvedValue({
    data: {
      id: 123,
    },
  });
});

describe("publishInlineReview", () => {
  it("posts multi-line review comments using start_line and line", async () => {
    const result = await publishInlineReview({
      githubToken: "token",
      owner: "octo",
      repo: "repo",
      pullNumber: 42,
      reviewBody: "Review body",
      commitId: "abc123",
      comments: [
        {
          path: "src/app/alerts.ts",
          line: 28,
          startLine: 23,
          endLine: 33,
          body: "Comment body",
          severity: "high",
          title: "Opaque AI Decision Outputs",
        },
      ],
    });

    expect(result).toEqual({
      postedCount: 1,
      reviewId: 123,
    });

    expect(createReviewMock).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      pull_number: 42,
      event: "COMMENT",
      body: "Review body",
      comments: [
        {
          path: "src/app/alerts.ts",
          line: 33,
          side: "RIGHT",
          start_line: 23,
          start_side: "RIGHT",
          body: "Comment body",
        },
      ],
      commit_id: "abc123",
    });
  });
});
