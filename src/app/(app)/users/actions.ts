"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["OWNER", "FRONT_DESK", "HOUSEKEEPING"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface UserFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createUserAction(
  _prev: UserFormState | null,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requireAccess("users");
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
    return { fieldErrors: fe };
  }
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    await logAudit({ userId: actor.id, action: "user.create", entityType: "User", entityId: user.id, details: { role: user.role } });
  } catch {
    return { error: "A user with that email already exists." };
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function toggleUserActiveAction(userId: string, active: boolean) {
  const actor = await requireAccess("users");
  if (userId === actor.id) return; // don't let owner disable themselves
  await prisma.user.update({ where: { id: userId }, data: { active } });
  await logAudit({ userId: actor.id, action: "user.active", entityType: "User", entityId: userId, details: { active } });
  revalidatePath("/users");
}
