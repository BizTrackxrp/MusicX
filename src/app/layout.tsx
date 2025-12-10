import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { XamanProvider } from "@/lib/xaman-context";

export const metadata: Metadata = {
  title: "XRP Music | Decentralized Music on XRPL",
  description: "Stream, collect, and trade music NFTs on the XRP Ledger.",
  icons: {
    icon: "/xrpmusic-logo.png",
    apple: "/xrpmusic-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <XamanProvider>
            {children}
          </XamanProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
