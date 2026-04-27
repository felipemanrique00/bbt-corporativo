import './globals.css'
import type { Metadata } from 'next'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'BBT Corporativo - Sistema de Gestão',
  description: 'CRM/ERP para viagens corporativas — BBT Corporativo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Inicializa o tema antes de render para evitar flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('bbt-theme') || 'light';
                if (theme === 'dark') document.documentElement.classList.add('dark');
              } catch(e){}
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
