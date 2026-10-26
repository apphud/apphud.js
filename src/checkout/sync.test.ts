import { describe, expect, it, vi } from "vitest";
import type { ApiClient, ApiResponse } from "./api";
import { syncPurchase } from "./sync";

const request = {
  providerId: "prov-1",
  customerId: "cust-1",
  purchaseId: "txn_1",
};

// Answers in order; the clock moves only through sleep().
const scripted = (answers: (ApiResponse | Error)[]) => {
  let clock = 0;
  const post = vi.fn(async () => {
    const answer = answers.shift();
    if (!answer) throw new Error("no more answers");
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const sleeps: number[] = [];
  return {
    api: { post } as ApiClient,
    post,
    sleeps,
    options: {
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
    },
  };
};

const ok = (results: unknown): ApiResponse => ({
  status: 200,
  body: { data: { results } },
});
const pending: ApiResponse = { status: 202, body: { data: { results: null } } };

describe("syncPurchase", () => {
  it("repeats 202 until 200 and returns the subscription", async () => {
    const { api, post, sleeps, options } = scripted([
      pending,
      pending,
      ok({ id: "sub" }),
    ]);
    await expect(syncPurchase(api, request, options)).resolves.toEqual({
      status: "synced",
      subscription: { id: "sub" },
    });
    expect(post).toHaveBeenCalledWith(
      "/v1/payment_providers/prov-1/subscriptions/sync",
      { user_id: "cust-1", id: "txn_1" },
    );
    expect(sleeps).toEqual([1500, 1500]);
  });

  it("waits longer after 429 and treats a network error as not ready", async () => {
    const { api, sleeps, options } = scripted([
      { status: 429, body: null },
      new TypeError("offline"),
      ok(null),
    ]);
    await expect(syncPurchase(api, request, options)).resolves.toMatchObject({
      status: "synced",
    });
    expect(sleeps).toEqual([2000, 1500]);
  });

  it("gives up as pending after ~15 s of 202", async () => {
    const { api, post, options } = scripted(Array(20).fill(pending));
    await expect(syncPurchase(api, request, options)).resolves.toEqual({
      status: "pending",
    });
    expect(post).toHaveBeenCalledTimes(11);
  });

  it("fails on 422 and 404 with the backend's message", async () => {
    const first = scripted([
      { status: 422, body: { errors: [{ title: "Transaction is not paid" }] } },
    ]);
    await expect(
      syncPurchase(first.api, request, first.options),
    ).resolves.toEqual({
      status: "failed",
      httpStatus: 422,
      message: "Transaction is not paid",
    });
    const second = scripted([{ status: 404, body: null }]);
    await expect(
      syncPurchase(second.api, request, second.options),
    ).resolves.toEqual({
      status: "failed",
      httpStatus: 404,
      message: null,
    });
  });
});
