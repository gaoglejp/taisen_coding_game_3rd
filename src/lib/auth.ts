import { cookies } from "next/headers";
import { prisma } from "./db";
import { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  role: UserRole;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const [userId] = Buffer.from(token, "base64").toString().split(":");
    const user = await prisma.user.findUnique({
      where: { id: userId, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
}

export function isAdmin(role: UserRole): boolean {
  return role === "SYSTEM_ADMIN" || role === "ROOM_ADMIN";
}

export function isSystemAdmin(role: UserRole): boolean {
  return role === "SYSTEM_ADMIN";
}
