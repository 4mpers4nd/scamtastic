'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavigationLink = [label: string, href: string];

export default function HeaderPrimaryNavigation({
  links,
}: {
  links: NavigationLink[];
}) {
  const pathname = usePathname();

  return (
    <>
      {links.map(([label, href]) => {
        const route = href.split(/[?#]/, 1)[0];
        const isCurrent = route === pathname && (route !== '/' || href === '/#about');
        return (
          <Link
            aria-current={isCurrent ? 'page' : undefined}
            key={href}
            href={href}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
