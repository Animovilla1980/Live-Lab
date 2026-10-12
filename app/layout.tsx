import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata = { title: 'Live Lab', description: 'InPlayGuru Intelligence: storico CSV, strategie e trading Exchange' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="it"><body><div className="shell"><Sidebar/><main className="main">{children}</main></div></body></html>;
}
