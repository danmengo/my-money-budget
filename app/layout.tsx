import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "./theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://budget.danmengo.com"),
  title: {
    default: "My Money — Personal Budget Dashboard",
    template: "%s | My Money",
  },
  description: "Track spending, monthly budgets, savings, and investing goals in one private dashboard.",
  applicationName: "My Money",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "My Money — Personal Budget Dashboard",
    description: "A simple, private dashboard for spending, budgets, savings, and investing goals.",
    url: "https://budget.danmengo.com",
    siteName: "My Money",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className="antialiased"><ThemeProvider>{children}</ThemeProvider></body></html>;
}
