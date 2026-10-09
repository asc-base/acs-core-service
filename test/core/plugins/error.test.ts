import { describe, expect, test, vi } from "vitest";
import { Elysia } from "elysia";
import { errorPlugin } from "../../../src/core/plugins/error";

describe("API error logging", () => {
  test("logs unexpected error type and code without request data", async () => {
    const error = Object.assign(new Error("Database update failed"), {
      code: "P2002",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = new Elysia().use(errorPlugin).post("/update", () => {
      throw error;
    });

    await app.handle(
      new Request("http://localhost/update", {
        method: "POST",
        body: JSON.stringify({ privateField: "not logged" }),
      }),
    );

    expect(log).toHaveBeenCalledWith("Unhandled API error", {
      type: "Error",
      code: "P2002",
      stack: expect.stringContaining("Database update failed"),
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("not logged");
  });
});
