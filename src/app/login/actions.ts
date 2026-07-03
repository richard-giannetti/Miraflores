"use server";

import { authenticate, createSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(email, password);
  if (!user) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user);
  redirect(user.role === "HOUSEKEEPING" ? "/housekeeping" : "/");
}
