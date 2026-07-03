"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { logoutAction } from "./actions";

const LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", roles: ["OWNER", "FRONT_DESK"] },
  { href: "/calendar", label: "Calendar", roles: ["OWNER", "FRONT_DESK"] },
  { href: "/reservations", label: "Reservations", roles: ["OWNER", "FRONT_DESK"] },
  { href: "/frontdesk", label: "Front desk", roles: ["OWNER", "FRONT_DESK"] },
  { href: "/housekeeping", label: "Housekeeping", roles: ["OWNER", "FRONT_DESK", "HOUSEKEEPING"] },
  { href: "/reports", label: "Reports", roles: ["OWNER"] },
  { href: "/rooms", label: "Rooms", roles: ["OWNER"] },
  { href: "/users", label: "Users", roles: ["OWNER"] },
];

export function Nav({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => l.roles.includes(role));

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
        <Link href="/" className="text-lg font-bold text-brand-700">Casa</Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {name} · <span className="capitalize">{role.replace("_", " ").toLowerCase()}</span>
          </span>
          <form action={logoutAction}>
            <button className="btn-secondary py-1.5" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
