import type { Metadata } from 'next';
import './globals.css';
import './v040.css';
export const metadata: Metadata={title:'Scamtastic — Trust is a vulnerability',description:'An invitation-only social strategy experiment. No real-world currency or financial value.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
