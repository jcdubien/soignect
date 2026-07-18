import type { Metadata } from "next";
import MarkdownView from "@/components/legal/MarkdownView";
import { readLegalDoc } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales — Soignect" };

export default function MentionsLegalesPage() {
  const { markdown } = readLegalDoc("mentions-legales");
  return <MarkdownView>{markdown}</MarkdownView>;
}
