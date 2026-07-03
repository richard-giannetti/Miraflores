"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">Casa</h1>
          <p className="text-sm text-slate-500">Miraflores — staff sign in</p>
        </div>
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoFocus className="input" placeholder="owner@casa.test" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="input" placeholder="••••••••" />
          </div>
          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Demo: owner@casa.test · frontdesk@casa.test · housekeeping@casa.test<br />password <span className="font-mono">casa1234</span>
        </p>
      </div>
    </main>
  );
}
