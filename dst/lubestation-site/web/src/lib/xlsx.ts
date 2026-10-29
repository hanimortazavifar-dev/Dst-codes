/**
 * Minimal .xlsx reader: unzips the workbook in the browser (DecompressionStream) and returns each
 * sheet as rows of plain cell values. Formatting, formulas and styles are ignored; formula cells
 * yield their last calculated value, which Excel always stores.
 */

export type Cell = string | number | boolean | null;
export type Sheet = Cell[][];

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export class XlsxError extends Error {}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads every entry of a zip archive into memory (xlsx files are small). */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError("فایل اکسل (xlsx) معتبر نیست.");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== SIG_CENTRAL) throw new XlsxError("ساختار فایل اکسل خراب است.");
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (view.getUint32(local, true) !== SIG_LOCAL) throw new XlsxError("ساختار فایل اکسل خراب است.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compSize);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, await inflateRaw(raw));
    // Other compression methods never appear in xlsx files; skip them.
  }
  return files;
}

function parseXml(files: Map<string, Uint8Array>, path: string): Document | null {
  const data = files.get(path);
  if (!data) return null;
  return new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml");
}

// getElementsByTagNameNS("*", …) matches by local name, so prefixed files (x:c) work too.
const all = (root: Document | Element, tag: string) => Array.from(root.getElementsByTagNameNS("*", tag));

/** Text of an <si>/<is> node, skipping phonetic runs. */
function richText(node: Element) {
  return all(node, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

function columnIndex(ref: string) {
  let col = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    col = col * 26 + (code - 64);
  }
  return col - 1;
}

function resolveTarget(target: string) {
  if (target.startsWith("/")) return target.slice(1);
  return ("xl/" + target).replace(/\/[^/]+\/\.\.\//g, "/");
}

/** Parses an .xlsx file into `sheet name → rows`. */
export async function readXlsx(buf: ArrayBuffer): Promise<Map<string, Sheet>> {
  const files = await unzip(buf);
  const workbook = parseXml(files, "xl/workbook.xml");
  const rels = parseXml(files, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new XlsxError("این فایل، فایل اکسل (xlsx) نیست.");

  const targets = new Map(all(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""]));
  const sst = parseXml(files, "xl/sharedStrings.xml");
  const shared = sst ? all(sst, "si").map(richText) : [];

  const result = new Map<string, Sheet>();
  for (const sheet of all(workbook, "sheet")) {
    const name = sheet.getAttribute("name") ?? "";
    const rid = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? sheet.getAttribute("r:id");
    const target = targets.get(rid);
    const doc = target ? parseXml(files, resolveTarget(target)) : null;
    if (!doc) continue;

    const rows: Sheet = [];
    for (const row of all(doc, "row")) {
      const r = Number(row.getAttribute("r")) - 1;
      const cells: Cell[] = [];
      let next = 0;
      for (const c of all(row, "c")) {
        const ref = c.getAttribute("r");
        const col = ref ? columnIndex(ref) : next;
        next = col + 1;
        const type = c.getAttribute("t");
        const v = all(c, "v")[0]?.textContent ?? null;
        let value: Cell = null;
        if (type === "s") value = v != null ? (shared[Number(v)] ?? "") : null;
        else if (type === "inlineStr") value = all(c, "is")[0] ? richText(all(c, "is")[0]) : "";
        else if (type === "str" || type === "e") value = v;
        else if (type === "b") value = v === "1";
        else if (v != null && v !== "") value = Number(v);
        cells[col] = value;
      }
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = null;
      rows[Number.isFinite(r) && r >= 0 ? r : rows.length] = cells;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    result.set(name, rows);
  }
  return result;
}
