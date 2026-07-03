import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canAccess } from "@/lib/auth";
import { buildReport, reportToCsv } from "@/lib/reports";
import { addDaysStr, today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role, "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = iso.test(params.get("from") ?? "") ? params.get("from")! : addDaysStr(today(), -29);
  const to = iso.test(params.get("to") ?? "") ? params.get("to")! : today();

  const report = await buildReport(from, to);
  const csv = reportToCsv(report);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casa-report-${from}_${to}.csv"`,
    },
  });
}
