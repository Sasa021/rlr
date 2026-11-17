import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { tokenCss } from "@/design/tokens";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RLR · SA ICD-10 coding",
  description: "Suggest South African ICD-10 codes from a clinical note and check them against the Master Industry Table.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-[var(--rlr-canvas)] font-sans text-[var(--rlr-ink)] antialiased">
        <style dangerouslySetInnerHTML={{ __html: tokenCss }} />
        {children}
      </body>
    </html>
  );
}
