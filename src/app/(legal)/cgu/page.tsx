import type { Metadata } from "next";
import MarkdownView from "@/components/legal/MarkdownView";
import { readLegalDoc } from "@/lib/legal";

export const metadata: Metadata = { title: "CGU / CGV — Soignect" };

export default function CguPage() {
  const { markdown } = readLegalDoc("cgu");
  return <MarkdownView>{markdown}</MarkdownView>;
}
