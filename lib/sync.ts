import prisma from "@/lib/prisma";
import { getSheetData } from "@/lib/googleSheets";

/**
 * Syncs leads from a Google Sheet into the local PostgreSQL database for a specific project.
 */
export async function syncLeadsFromGoogle(projectId: string, sheetName: string) {
  console.log(`🔄 Syncing leads for project ${projectId} from sheet ${sheetName}...`);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const rawData = await getSheetData(sheetName);

  const syncResults = {
    total: rawData.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rawData) {
    const metrikaVisitId = String(row["metrika_visit_id"] || "");
    if (!metrikaVisitId) {
      syncResults.skipped++;
      continue;
    }

    const dateStr = String(row["Дата"] || "");
    const timeStr = String(row["Время"] || "00:00:00");
    
    // Parse date: assuming DD.MM.YYYY or YYYY-MM-DD
    let dateObj: Date;
    if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [day, month, year] = dateStr.split('.');
      dateObj = new Date(`${year}-${month}-${day}T${timeStr}`);
    } else {
      dateObj = new Date(`${dateStr}T${timeStr}`);
    }

    if (isNaN(dateObj.getTime())) {
      dateObj = new Date(); // Fallback
    }

    await prisma.lead.upsert({
      where: { metrikaVisitId },
      update: {
        campaign: String(row["Кампания"] || ""),
        goal: String(row["Цель"] || ""),
        status: String(row["Целевой"] || ""),
        qualification: String(row["Квалификация"] || ""),
        comment: String(row["Комментарий"] || ""),
        saleAmount: parseFloat(String(row["Сумма продажи"] || "0").replace(/[^\d.]/g, "")) || 0,
        date: dateObj,
      },
      create: {
        metrikaVisitId,
        projectId,
        date: dateObj,
        campaign: String(row["Кампания"] || ""),
        goal: String(row["Цель"] || ""),
        status: String(row["Целевой"] || ""),
        qualification: String(row["Квалификация"] || ""),
        comment: String(row["Комментарий"] || ""),
        saleAmount: parseFloat(String(row["Сумма продажи"] || "0").replace(/[^\d.]/g, "")) || 0,
      },
    });

    syncResults.created++;
  }

  return syncResults;
}
