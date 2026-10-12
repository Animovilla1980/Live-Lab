'use client';
import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const legacy=[['/radar','Dashboard Radar'],['/paper','Paper Exchange'],['/archivio','Archivio & Analytics'],['/storico','Storico Diretta'],['/campionati','Campionati legacy'],['/strategia','Strategia legacy'],['/impostazioni','Impostazioni legacy']];
export default function Sidebar(){const path=usePathname();return <aside className="sidebar"><div className="brand"><Image src="/live-lab-logo.png" width={48} height={48} alt="Live Lab"/><div><h1>Live Lab</h1><small>InPlayGuru Intelligence</small></div></div><nav className="nav"><Link href="/" className={path==='/'?'active':''}>Laboratorio InPlayGuru</Link><details open={path!=='/'}><summary>Archivio precedente</summary>{legacy.map(([href,label])=><Link key={href} className={path===href?'active':''} href={href}>{label}</Link>)}</details></nav><div className="status"><b>Importa. Studia. Verifica.</b><p className="muted">CSV cumulativi · ricerca statistica · uscita Exchange manuale</p><div className="muted">Live Lab v0.8.0</div></div></aside>;}
