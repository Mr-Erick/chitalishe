import { unzipSync } from "fflate";
import { type ChapterText, splitChapters, splitIntoParts } from "../engine/chapters";

export type BookFormat = "TXT" | "DOCX" | "DOC" | "TEXT";

export interface ParsedBook {
  title: string;
  author: string;
  format: BookFormat;
  chapters: ChapterText[];
}

export class UnsupportedFormatError extends Error {}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "Без названия";

export async function parseFile(file: File): Promise<ParsedBook> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (ext === "txt") return { title: stripExt(file.name), author: "", format: "TXT", chapters: splitChapters(decodeText(bytes)) };
  if (ext === "docx") return parseDocx(bytes, file.name);
  if (ext === "doc")
    throw new UnsupportedFormatError("DOC пока не открывается. Пересохраните файл в DOCX в Word или Google Документах.");
  throw new UnsupportedFormatError("Поддерживаются файлы TXT и DOCX.");
}

export function parsePasted(text: string): ParsedBook {
  const firstLine = text.trim().split("\n")[0].trim();
  const title = firstLine.length <= 60 ? firstLine : firstLine.slice(0, 57).trimEnd() + "…";
  return { title: title || "Вставленный текст", author: "", format: "TEXT", chapters: splitChapters(text) };
}

// ---- TXT: кодировка ----

const CYRILLIC_COMMON = "оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё";

/** UTF-8, а если не он — выбираем между CP1251 и KOI8-R по частоте обычных русских букв. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    const score = (s: string) => {
      let n = 0;
      for (const ch of s.slice(0, 20000)) if (CYRILLIC_COMMON.includes(ch)) n++;
      return n;
    };
    const cp = new TextDecoder("windows-1251").decode(bytes);
    const koi = new TextDecoder("koi8-r").decode(bytes);
    return score(koi) > score(cp) ? koi : cp;
  }
}

// ---- DOCX ----

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const isHeadingStyle = (style: string) => /heading|title|заголовок|^\d$/i.test(style);

export function parseDocx(bytes: Uint8Array, fileName: string): ParsedBook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" || f.name === "docProps/core.xml" });
  } catch {
    throw new UnsupportedFormatError("Не удалось открыть DOCX: файл повреждён.");
  }
  const docXml = files["word/document.xml"];
  if (!docXml) throw new UnsupportedFormatError("Не удалось открыть DOCX: внутри нет текста.");
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(docXml), "application/xml");

  const chapters: ChapterText[] = [];
  let title = "";
  let body: string[] = [];
  let headings = 0;
  const flush = () => {
    const text = body.join("\n\n").trim();
    if (text) chapters.push({ title, text });
    body = [];
  };
  for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
    const text = Array.from(p.getElementsByTagNameNS(W, "t"))
      .map((t) => t.textContent ?? "")
      .join("")
      .trim();
    if (!text) continue;
    const style = p.getElementsByTagNameNS(W, "pStyle")[0]?.getAttributeNS(W, "val") ?? "";
    if (isHeadingStyle(style) && text.length < 120) {
      flush();
      title = text;
      headings++;
    } else {
      body.push(text);
    }
  }
  flush();

  let meta = { title: "", author: "" };
  const core = files["docProps/core.xml"];
  if (core) {
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(core), "application/xml");
    meta = {
      title: xml.getElementsByTagName("dc:title")[0]?.textContent?.trim() ?? "",
      author: xml.getElementsByTagName("dc:creator")[0]?.textContent?.trim() ?? "",
    };
  }

  const all = chapters.map((c) => c.text).join("\n\n");
  const result =
    headings > 0 ? chapters.map((c, i) => ({ ...c, title: c.title || (i === 0 ? "Начало" : `Часть ${i + 1}`) })) : splitChapters(all);
  return {
    title: meta.title || stripExt(fileName),
    author: meta.author,
    format: "DOCX",
    chapters: result.length ? result : splitIntoParts(all),
  };
}
