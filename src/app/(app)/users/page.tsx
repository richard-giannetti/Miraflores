import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserManager, type UserRow } from "./user-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAccess("users");
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    isSelf: u.id === me.id,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users &amp; roles</h1>
      <p className="text-sm text-slate-500">Owners manage everything · front desk runs operations · housekeeping sees the board only. Every reservation change is logged.</p>
      <UserManager users={rows} />
    </div>
  );
}
