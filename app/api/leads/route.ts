import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        if (!projectId) {
            // If no projectId, we might want to return all leads for admin or error
            // For now, let's require it for safety
            return NextResponse.json({ error: "projectId is required" }, { status: 400 });
        }

        const leads = await prisma.lead.findMany({
            where: { projectId },
            orderBy: { date: 'desc' },
        });

        return NextResponse.json({
            leads: leads.map(l => ({
                id: l.id,
                metrika_visit_id: l.metrikaVisitId,
                campaign: l.campaign,
                date: l.date.toISOString().split('T')[0],
                time: l.date.toTimeString().split(' ')[0],
                qualification: l.qualification || "",
                comment: l.comment || "",
                sales: l.saleAmount?.toString() || "0",
                "Целевой": l.status || "",
                "Цель": l.goal || ""
            })),
            total: leads.length
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch leads from database" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, field, value } = body;

        if (!id || !field) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const updateData: any = {};
        if (field === 'qualification') updateData.qualification = value;
        if (field === 'comment') updateData.comment = value;
        if (field === 'target') updateData.status = value;
        if (field === 'sales') updateData.saleAmount = parseFloat(value) || 0;

        await prisma.lead.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update lead in database" }, { status: 500 });
    }
}
