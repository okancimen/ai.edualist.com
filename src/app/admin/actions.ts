"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const password = formData.get("password") as string;
  if (password && password === process.env.ADMIN_PASSWORD) {
    (await cookies()).set("admin_auth", password, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/admin",
    });
    redirect("/admin");
  }
  redirect("/admin?error=1");
}

export async function logout() {
  (await cookies()).delete("admin_auth");
  redirect("/admin");
}
