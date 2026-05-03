import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TesseraGame } from "../../TesseraGame";
import { LocaleProvider } from "../../lib/locale-context";
import { parseShareSlug } from "../../lib/share";
import { buildShareMetadata } from "../../lib/share-metadata";

// Path-based share route. Slug shape: N-M[-b|-r] (see app/lib/share.ts).
// Renders the same game as /, with per-solve OG metadata so pasted links
// unfurl as a graphic in chat apps.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseShareSlug(slug);
  if (!parsed) return {};
  return buildShareMetadata(parsed, "en");
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!parseShareSlug(slug)) notFound();
  return (
    <LocaleProvider locale="en">
      <TesseraGame />
    </LocaleProvider>
  );
}
