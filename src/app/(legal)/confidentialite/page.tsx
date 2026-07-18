import type { Metadata } from "next";
import MarkdownView from "@/components/legal/MarkdownView";
import { readLegalDoc } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité — Soignect" };

export default function ConfidentialitePage() {
  const { markdown } = readLegalDoc("confidentialite");
  return <MarkdownView>{markdown}</MarkdownView>;
}
