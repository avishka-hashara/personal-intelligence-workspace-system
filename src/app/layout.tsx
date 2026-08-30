import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Personal Intelligence Workspace",
  description: "A single-user, AI-native web workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  // 1. Block extension from mutating DOM elements with bis_skin_checked
                  try {
                    const origSetAttribute = Element.prototype.setAttribute;
                    Element.prototype.setAttribute = function(name, value) {
                      if (name === 'bis_skin_checked' || name === 'bis_size') {
                        return;
                      }
                      return origSetAttribute.apply(this, arguments);
                    };
                  } catch (e) {}

                  // 2. Active MutationObserver to immediately strip any extension attributes
                  try {
                    const observer = new MutationObserver(function(mutations) {
                      for (let i = 0; i < mutations.length; i++) {
                        const m = mutations[i];
                        if (m.type === 'attributes' && (m.attributeName === 'bis_skin_checked' || m.attributeName === 'bis_size')) {
                          m.target.removeAttribute(m.attributeName);
                        }
                      }
                    });
                    observer.observe(document.documentElement, {
                      attributes: true,
                      subtree: true,
                      attributeFilter: ['bis_skin_checked', 'bis_size'],
                    });
                  } catch (e) {}

                  // 3. Suppress console hydration warnings caused by browser extensions
                  const origError = console.error;
                  console.error = function(...args) {
                    const str = args.map(a => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
                    if (
                      str.includes('bis_skin_checked') ||
                      str.includes('chrome-extension://') ||
                      str.includes('kiilhncajadbgbmdbdcopdpnmdhlbdle')
                    ) {
                      return;
                    }
                    origError.apply(console, args);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} bg-white text-slate-900 antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}