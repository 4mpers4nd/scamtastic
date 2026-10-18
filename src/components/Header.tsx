import Link from 'next/link';
export default function Header(){return <header className="header"><Link className="brand" href="/"><span className="logo">S</span><span>SCAMTASTIC<span className="dot">.</span></span></Link><nav><Link href="/#about">About</Link><Link href="/apply">Request Access</Link><Link className="button secondary" href="/login">Sign In ↗</Link></nav></header>}
