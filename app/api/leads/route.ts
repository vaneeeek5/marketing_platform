export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Lead } from "@/types";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "100");
        const skip = (page - 1) * limit;
        const search = searchParams.get("search") || "";
        const campaign = searchParams.get("campaign") || "";
        const qualification = searchParams.get("qualification") || "";
        const target = searchParams.get("target") || "";
        const startDate = searchParams.get("startDate") || "";
        const endDate = searchParams.get("endDate") || "";

        const project = await prisma.project.findFirst();
        if (!project) {
            return NextResponse.json({ leads: [], total: 0, page, totalPages: 0 });
        }

        // Build where clause
        const where: any = { projectId: project.id };

        if (campaign) {
            where.campaign = { contains: campaign, mode: 'insensitive' };
        }
        if (qualification && qualification !== 'empty') {
            where.qualification = { equals: qualification, mode: 'insensitive' };
        } else if (qualification === 'empty') {
            where.OR = [{ qualification: null }, { qualification: '' }];
        }
        if (target && target !== 'empty') {
            where.status = { equals: target, mode: 'insensitive' };
        } else if (target === 'empty') {
            where.AND = [
                ...(where.AND || []),
                { OR: [{ status: null }, { status: '' }] }
            ];
        }
        if (search) {
            where.OR = [
                ...(where.OR || []),
                { comment: { contains: search, mode: 'insensitive' } },
                { campaign: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate + 'T00:00:00Z'),
                lte: new Date(endDate + 'T23:59:59Z'),
            };
        }

        const [rawLeads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: limit,
            }),
            prisma.lead.count({ where }),
        ]);

        const leads: Lead[] = rawLeads.map(l => ({
            id: l.id,
            metrika_visit_id: l.metrikaVisitId || "",
            number: "",
            campaign: l.campaign || "",
            date: l.date.toISOString().split('T')[0],
            time: l.date.toISOString().split('T')[1].substring(0, 8),
            qualification: l.qualification || "",
            comment: l.comment || "",
            sales: String(l.saleAmount || ""),
            "Целевой": l.status || "",
            "Цель": l.goal || ""
        }));

        return NextResponse.json({
            leads,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            sheetName: "Database"
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
