export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const project = await prisma.project.findFirst();
        if (!project) {
            return NextResponse.json({ success: false, error: "No project found" }, { status: 400 });
        }

        const leads = await prisma.lead.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: 'asc' } // oldest first to keep the first one
        });

        const map = new Set<string>();
        const duplicatesToUpdate: string[] = [];

        leads.forEach((lead) => {
            const date = lead.date.toISOString().split('T')[0];
            const time = lead.date.toISOString().split('T')[1].substring(0,8);

            if (!date || !time) return;

            const key = `${date}|${time}`;

            if (map.has(key)) {
                // Duplicate found
                const qual = lead.qualification?.toLowerCase() || "";
                if (!qual.includes("дубль")) {
                    duplicatesToUpdate.push(lead.id);
                }
            } else {
                map.add(key);
            }
        });

        console.log(`Found ${duplicatesToUpdate.length} new duplicates to mark.`);

        if (duplicatesToUpdate.length > 0) {
            await prisma.lead.updateMany({
                where: { id: { in: duplicatesToUpdate } },
                data: {
                    qualification: "Дубль",
                    comment: "Автоматически определен как дубль"
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: `Проверено. Отмечено дублей: ${duplicatesToUpdate.length}`,
            count: duplicatesToUpdate.length
        });

    } catch (error) {
        console.error("Error checking duplicates:", error);
        return NextResponse.json(
            { success: false, error: "Failed to check duplicates" },
            { status: 500 }
        );
    }
}
