import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TesseraGame } from "../../../../TesseraGame";
import { LocaleProvider } from "../../../../lib/locale-context";
import { parseShareSlug } from "../../../../lib/share";
import { buildShareMetadata } from "../../../../lib/share-metadata";
import { HARD } from "../../../../lib/mode";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseShareSlug(slug);
  if (!parsed) return {};
  return buildShareMetadata({ ...parsed, mode: "hard" }, "es");
}

export default async function HardSharePageEs({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!parseShareSlug(slug)) notFound();
  return (
    <LocaleProvider locale="es">
      <TesseraGame mode={HARD} />
    </LocaleProvider>
  );
}
