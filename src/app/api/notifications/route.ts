import { db } from "@/utils/db";
import { notification, project } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get unread notifications for the user
    // Scoped to the user's userId (since they are generated specific to the user)
    const notifications = await db
      .select({
        id: notification.id,
        projectId: notification.projectId,
        type: notification.type,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt,
        projectName: project.name,
      })
      .from(notification)
      .innerJoin(project, eq(notification.projectId, project.id))
      .where(and(eq(notification.userId, userId), eq(notification.read, false)))
      .orderBy(desc(notification.createdAt))
      .limit(20);

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
