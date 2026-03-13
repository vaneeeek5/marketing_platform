export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Lead } from "@/types";

export async function GET(request: NextRequest) {
    try {
        const project = await prisma.project.findFirst();
        if (!project) {
            return NextResponse.json({ leads: [], total: 0, sheetName: "" });
        }

        const rawLeads = await prisma.lead.findMany({
            where: { projectId: project.id },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
        });

        // Transform to Match Lead interface
        const leads: Lead[] = rawLeads.map(l => ({
            id: l.id,
            metrika_visit_id: l.metrikaVisitId || "",
            number: "", // Phone numbers may be added later if stored
            campaign: l.campaign || "",
            date: l.date.toISOString().split('T')[0], // format to YYYY-MM-DD
            time: l.date.toISOString().split('T')[1].substring(0,8),
            qualification: l.qualification || "",
            comment: l.comment || "",
            sales: String(l.saleAmount || ""),
            "Целевой": l.status || "",
            "Цель": l.goal || ""
        }));

        return NextResponse.json({
            leads,
            total: leads.length,
            sheetName: "Database" // Maintained for compat
        });
    } catch (error) {
        console.error("GET leads error:", error);
        return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, field, value } = body;

        if (!id || !field) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let updateData: any = {};
        if (field === 'qualification') updateData.qualification = value;
        if (field === 'comment') updateData.comment = value;
        if (field === 'target') updateData.status = value;
        if (field === 'sales') {
            updateData.saleAmount = parseFloat(String(value).replace(/[^\d.]/g, "")) || 0;
        }

        await prisma.lead.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH leads error:", error);
        return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
    }
}
