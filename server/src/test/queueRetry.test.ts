import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueError } from "../utils/errors.js";

const mocks = vi.hoisted(() => {
  const state = {
    failedJobs: [] as Array<Record<string, unknown>>,
    updatedRows: [] as Array<Record<string, unknown>>,
    updateSet: undefined as Record<string, unknown> | undefined,
    logs: [] as Array<Record<string, unknown>>
  };

  return {
    state,
    reset() {
      state.failedJobs = [];
      state.updatedRows = [];
      state.updateSet = undefined;
      state.logs = [];
    },
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => state.failedJobs)
        }))
      })),
      update: vi.fn(() => ({
        set: vi.fn((value: Record<string, unknown>) => {
          state.updateSet = value;
          return {
            where: vi.fn(() => ({
              returning: vi.fn(async () => state.updatedRows)
            }))
          };
        })
      }))
    },
    createLog: vi.fn(async (input: Record<string, unknown>) => {
      state.logs.push(input);
    })
  };
});

vi.mock("../database/db.js", () => ({ db: mocks.db }));
vi.mock("../services/logService.js", () => ({ createLog: mocks.createLog }));

const { retryFailedJobs } = await import("../queue/queueService.js");

describe("retryFailedJobs", () => {
  beforeEach(() => {
    mocks.reset();
    vi.clearAllMocks();
  });

  it("rejects retry attempts below the allowed range", async () => {
    await expect(retryFailedJobs({ jobIds: [1], retryAttempts: 0 })).rejects.toThrow();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("rejects retry attempts above the allowed range", async () => {
    await expect(retryFailedJobs({ jobIds: [1], retryAttempts: 4 })).rejects.toThrow();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("rejects an empty job selection", async () => {
    await expect(retryFailedJobs({ jobIds: [], retryAttempts: 3 })).rejects.toThrow();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("rejects jobs that are not currently failed", async () => {
    mocks.state.failedJobs = [{ id: 1, state: "Failed" }];

    await expect(retryFailedJobs({ jobIds: [1, 2], retryAttempts: 2 })).rejects.toBeInstanceOf(QueueError);
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("requeues selected failed jobs with the selected max attempts", async () => {
    mocks.state.failedJobs = [
      { id: 1, state: "Failed" },
      { id: 2, state: "Failed" }
    ];
    mocks.state.updatedRows = [
      { id: 1, state: "Pending" },
      { id: 2, state: "Pending" }
    ];

    const result = await retryFailedJobs({ jobIds: [1, 2], retryAttempts: 3 });

    expect(result).toEqual({ queued: 2 });
    expect(mocks.state.updateSet).toMatchObject({
      state: "Pending",
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      failureType: null,
      nextAttemptAt: null
    });
    expect(mocks.state.logs[0]).toMatchObject({
      event: "queue.retry_failed",
      metadata: { count: 2, jobIds: [1, 2], retryAttempts: 3 }
    });
  });
});
