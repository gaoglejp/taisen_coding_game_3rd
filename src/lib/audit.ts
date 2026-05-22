import { AuditAction } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function logAudit(
  action: AuditAction,
  actorId: string | null | undefined,
  targetType: string | null | undefined,
  targetId: string | null | undefined,
  summary: string | null | undefined,
  metadata?: Record<string, unknown> | null,
  req?: NextRequest | null,
  targetRoomId?: string | null
): Promise<void> {
  try {
    const ipAddress =
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req?.headers.get("x-real-ip") ??
      null;
    const userAgent = req?.headers.get("user-agent") ?? null;

    await prisma.auditLog.create({
      data: {
        action,
        actorId: actorId ?? null,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        targetRoomId: targetRoomId ?? null,
        summary: summary ?? null,
        metadata: metadata ? (metadata as unknown as object) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Audit logging must not crash the main request
    console.error("[audit] Failed to write audit log:", err);
  }
}
