// Android Digital Asset Links — lets the Android app verify
// tesserapuzzle.com App Links so shared / invite links open the app
// (docs/flutter-app-spec.md §14.1). Served at /.well-known/assetlinks.json.
//
// Required env:
//   ANDROID_CERT_SHA256   comma-separated upper-case SHA-256 signing-cert
//                         fingerprints (colon-separated hex). Include both
//                         the Play App Signing cert and the upload cert.

export const dynamic = "force-static";

const PACKAGE = "com.tesserapuzzle.app";

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
