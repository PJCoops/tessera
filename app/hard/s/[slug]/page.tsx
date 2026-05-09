import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TesseraGame } from "../../../TesseraGame";
import { LocaleProvider } from "../../../lib/locale-context";
import { parseShareSlug } from "../../../lib/share";
import { buildShareMetadata } from "../../../lib/share-metadata";
import { HARD } from "../../../lib/mode";

// Path-based share route for hard mode. Slug shape: [h]N-M[-b|-r].
// The "h" prefix is optional in this route — share.ts emits it for the
// canonical /hard/s URL, but a bare slug also resolves here as hard.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseShareSlug(slug);
  if (!parsed) return {};
  return buildShareMetadata({ ...parsed, mode: "hard" }, "en");
}

export default async function HardSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!parseShareSlug(slug)) notFound();
  return (
    <LocaleProvider locale="en">
      <TesseraGame mode={HARD} />
    </LocaleProvider>
  );
}
