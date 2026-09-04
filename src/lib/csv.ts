/**
 * CSV import/export.
 *
 * Bulk camera onboarding (FR1) and the detection/route report exports (FR12, test
 * scenario 4) both run through here. The parser handles quoted fields and embedded
 * commas/newlines, because a real department inventory will contain site names like
 * `"Ring Road, Gate 2"` and a naive split would silently corrupt the import.
 */

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^﻿/, ""));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, i) => {
        o[h] = (r[i] ?? "").trim();
      });
      return o;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return "";
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}

/** Template handed to department admins for bulk onboarding. */
export const CAMERA_CSV_TEMPLATE = [
  "name,site,district,lat,lng,dept_id,type,vendor,model,protocol,endpoint,storage_type,retention_days,anpr_enabled,analog,bearing",
  'CAM-DEMO-01 Ring Road Gate,"Ring Road, Gate 2",Ahmedabad,23.0225,72.5714,D02,anpr,Hikvision HikCentral,DS-2CD2T87G2,onvif,rtsp://10.22.14.5:554/stream1,local_nvr,30,true,false,180',
  "CAM-DEMO-02 Depot Yard,GSRTC Depot Yard,Vadodara,22.3072,73.1812,D05,dome,CP Plus Orange,CP-UNC-TA41L3C,rtsp,rtsp://10.25.9.11:554/stream1,dvr,15,false,true,90",
].join("\r\n");

export const WATCHLIST_CSV_TEMPLATE = [
  "kind,category,value,description,severity,source,case_ref",
  "vehicle,stolen_vehicle,GJ01AB1234,White Maruti Swift reported stolen,critical,eGujCop (synthetic),FIR/2026/AMD/0417",
  "person,wanted_person,Suspect C (synthetic),Absconding accused — synthetic demo record,high,CCTNS (synthetic),CR/2026/AMD/1102",
].join("\r\n");
