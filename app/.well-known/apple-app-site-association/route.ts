// Apple App Site Association — lets the iOS app claim tesserapuzzle.com
// Universal Links so a shared result / league-invite link opens the app
// (docs/flutter-app-spec.md §14.1, §16.2). Served at
// /.well-known/apple-app-site-association with an application/json
// content type and no file extension, which is what Apple now requires.
//
// Required env:
//   APPLE_APP_ID   "<TeamID>.com.tesserapuzzle.app" (10-char Team ID prefix)

export const dynamic = "force-static";

// The app only handles these link shapes; everything else stays on web.
const PATHS = [
  "/s/*", // shared result
  "/hard/s/*",
  "/es/s/*",
  "/es/hard/s/*",
  "/join/*", // league invite (also accepted as /?join=<code>)
];

export function GET() {
  const appID = process.env.APPLE_APP_ID ?? "TEAMID.com.tesserapuzzle.app";
  return Response.json(
    {
      applinks: {
        apps: [],
        details: [{ appID, appIDs: [appID], paths: PATHS, components: PATHS.map((p) => ({ "/": p })) }],
      },
    },
    { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } },
  );
}
