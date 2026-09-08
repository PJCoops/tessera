// Locks app/lib/api/v1-schema.json to the zod source of truth. The JSON
// Schema file is what generates the Flutter Dart models, so it must never
// drift from the schema the server validates against.
//
// Regenerate deliberately after an additive schema change:
//   npm run gen:v1-schema

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { v1ResponseSchemas } from "./v1-schema";

const JSON_PATH = fileURLToPath(new URL("./v1-schema.json", import.meta.url));

function buildJsonSchema() {
  const out: Record<string, unknown> = {};
  for (const [route, schema] of Object.entries(v1ResponseSchemas)) {
    out[route] = z.toJSONSchema(schema, { target: "draft-2020-12" });
  }
  return out;
}

describe("v1 JSON Schema artifact", () => {
  const live = buildJsonSchema();

  if (process.env.UPDATE_V1_SCHEMA) {
    writeFileSync(JSON_PATH, JSON.stringify(live, null, 2) + "\n");
  }

  it("is checked in", () => {
    expect(existsSync(JSON_PATH)).toBe(true);
  });

  it("matches the zod source of truth (run `npm run gen:v1-schema` after a schema change)", () => {
    const committed = JSON.parse(readFileSync(JSON_PATH, "utf8"));
    expect(live).toEqual(committed);
  });
});
