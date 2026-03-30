import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { buildFontInitScript } from "@/lib/font-constants";
import "./globals.css";

export const metadata: Metadata = {
  title: "InnoClaw",
  description: "AI-powered research assistant for your workspace files",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: buildFontInitScript(),
          }}
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "var(--font-override, var(--font-geist-sans, sans-serif))" }}
        suppressHydrationWarning
      >
        <Script id="style-theme-init" strategy="beforeInteractive">{`try{var s=localStorage.getItem('style-theme');if(s&&s!=='default')document.documentElement.dataset.style=s}catch(e){}`}</Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
