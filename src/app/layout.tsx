import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("innoclaw-font-size");if(s){var n=Number(s);if(n>=12&&n<=24)document.documentElement.style.fontSize=n+"px"}var f=localStorage.getItem("innoclaw-font-family");if(f&&f!=="geist"){var m={"system":"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif","inter":"'Inter',sans-serif","noto-sans":"'Noto Sans','Noto Sans SC',sans-serif","roboto":"'Roboto',sans-serif","lato":"'Lato',sans-serif","source-han":"'Source Han Sans SC','Noto Sans SC',sans-serif"};var v=m[f];if(v){document.documentElement.style.setProperty("--font-override",v);var u={"inter":"Inter:wght@300;400;500;600;700","noto-sans":"Noto+Sans:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700","roboto":"Roboto:wght@300;400;500;700","lato":"Lato:wght@300;400;700","source-han":"Noto+Sans+SC:wght@300;400;500;700"};if(u[f]){var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+u[f]+"&display=swap";document.head.appendChild(l)}}}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-override, var(--font-geist-sans, sans-serif))" }}
      >
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
