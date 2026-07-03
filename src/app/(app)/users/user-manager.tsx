"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAction, toggleUserActiveAction, type UserFormState } from "./actions";
import { titleCase } from "@/lib/format";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  isSelf: boolean;
}

export function UserManager({ users }: { users: UserRow[] }) {
  const [state, action, pending] = useActionState<UserFormState | null, FormData>(createUserAction, null);
  const fe = (f: string) => state?.fieldErrors?.[f];
  const router = useRouter();
  const [busy, start] = useTransition();

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Add a staff member</h2>
        <form action={action} className="grid gap-3 sm:grid-cols-5">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
            {fe("name") && <p className="text-xs text-red-600">{fe("name")}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required className="input" />
            {fe("email") && <p className="text-xs text-red-600">{fe("email")}</p>}
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="FRONT_DESK">
              <option value="OWNER">Owner</option>
              <option value="FRONT_DESK">Front desk</option>
              <option value="HOUSEKEEPING">Housekeeping</option>
            </select>
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required className="input" />
            {fe("password") && <p className="text-xs text-red-600">{fe("password")}</p>}
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={pending}>{pending ? "…" : "Add"}</button>
          </div>
        </form>
        {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      </section>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.name}{u.isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">{titleCase(u.role)}</td>
                <td className="px-4 py-3">
                  {u.isSelf ? (
                    <span className="chip bg-green-100 text-green-700">Active</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => start(async () => { await toggleUserActiveAction(u.id, !u.active); router.refresh(); })}
                      className={`chip ${u.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {u.active ? "Active — click to disable" : "Disabled — click to enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
