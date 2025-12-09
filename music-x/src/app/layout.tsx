import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Music X | Decentralized Music on XRPL",
  description: "Stream, collect, and trade music NFTs on the XRP Ledger. Empowering artists with true ownership and fair monetization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-black">
        {children}
      </body>
    </html>
  );
}
