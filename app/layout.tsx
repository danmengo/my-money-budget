import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Money",
  description: "Track spending, budgets, savings, and investing in one place.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
