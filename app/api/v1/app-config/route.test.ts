// Contract test for GET /api/v1/app-config against the frozen v1 schema
// (docs/flutter-app-spec.md §20.1).

import { afterEach, describe, expect, it } from "vitest";
import { appConfigResponseSchema } from "../../../lib/api/v1-schema";
import { GET } from "./route";

const call = () => GET(new Request("https://tesserapuzzle.com/api/v1/app-config"));

afterEach(() => {
  delete process.env.MIN_SUPPORTED_VERSION;
  delete process.env.WHATS_NEW;
  delete process.env.APP_FLAGS;
});

describe("GET /api/v1/app-config", () => {
  it("returns a schema-valid body with defaults", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control") ?? "").toMatch(/s-maxage=\d+/);
    const body = await res.json();
    expect(appConfigResponseSchema.parse(body)).toEqual({
      minSupportedVersion: "1.0.0",
      whatsNew: null,
      flags: {},
    });
  });

  it("reflects env overrides and ignores malformed JSON", async () => {
    process.env.MIN_SUPPORTED_VERSION = "1.4.0";
    process.env.APP_FLAGS = '{"interstitial":true}';
    process.env.WHATS_NEW = "{ not json";
    const body = await (await call()).json();
    expect(body.minSupportedVersion).toBe("1.4.0");
    expect(body.flags).toEqual({ interstitial: true });
    expect(body.whatsNew).toBeNull();
  });

  it("drops a partial whatsNew payload", async () => {
    process.env.WHATS_NEW = '{"id":"x","title":"only title"}';
    const body = await (await call()).json();
    expect(body.whatsNew).toBeNull();
  });

  it("has a stable ETag and honours If-None-Match", async () => {
    const a = await call();
    const etag = a.headers.get("etag")!;
    const b = await GET(
      new Request("https://tesserapuzzle.com/api/v1/app-config", {
        headers: { "if-none-match": etag },
      }),
    );
    expect(b.status).toBe(304);
  });
});
