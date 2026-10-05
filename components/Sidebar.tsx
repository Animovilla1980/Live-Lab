'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links=[['/','Dashboard'],['/paper','Paper Exchange'],['/archivio','Archivio & Analytics'],['/storico','Storico'],['/campionati','Campionati'],['/strategia','Strategia'],['/impostazioni','Impostazioni']];
export default function Sidebar(){const path=usePathname();return <aside className="sidebar"><div className="brand"><Image src="/live-lab-logo.png" width={48} height={48} alt="Live Lab"/><div><h1>Live Lab</h1><small>Analizza. Segnala. Misura.</small></div></div><nav className="nav">{links.map(([href,label])=><Link key={href} className={path===href?'active':''} href={href}>{label}</Link>)}</nav><div className="status"><div><span className="dot"/>Sistema pronto</div><div className="muted" style={{marginTop:6}}>Diretta + Forebet + QSC Markets Exchange</div><div className="muted" style={{marginTop:8}}>Live Lab v0.7.0</div></div></aside>}
