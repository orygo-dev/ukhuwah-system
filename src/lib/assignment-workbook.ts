import ExcelJS from "exceljs";
import JSZip from "jszip";

async function normalizeWorkbookNamespaces(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes);
  let changed = false;
  for (const entry of Object.values(archive.files)) {
    if (entry.dir || !entry.name.endsWith(".xml")) continue;
    const xml = await entry.async("string");
    if (!xml.includes('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) continue;
    archive.file(entry.name, xml
      .replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
      .replaceAll("<x:", "<")
      .replaceAll("</x:", "</"));
    changed = true;
  }
  if (!changed) return Buffer.from(bytes);
  return Buffer.from(await archive.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}

export async function loadAssignmentWorkbook(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await normalizeWorkbookNamespaces(bytes) as never);
  return workbook;
}
