import { unzipSync } from "fflate";
import { type ChapterText, prettifyTitle, splitChapters, splitIntoParts } from "../engine/chapters";

export type BookFormat = "TXT" | "DOCX" | "DOC" | "FB2" | "TEXT";

export interface ParsedBook {
  title: string;
  author: string;
  format: BookFormat;
  chapters: ChapterText[];
  /** Книга из бесплатной библиотеки: её id в каталоге. */
  catalogId?: string;
}

export class UnsupportedFormatError extends Error {}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "Без названия";

export async function parseFile(file: File): Promise<ParsedBook> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (ext === "txt") return { title: stripExt(file.name), author: "", format: "TXT", chapters: splitChapters(decodeText(bytes)) };
  if (ext === "docx") return parseDocx(bytes, file.name);
  if (ext === "fb2") return parseFb2(bytes, file.name);
  if (ext === "zip" && /\.fb2\.zip$/i.test(file.name)) return parseFb2Zip(bytes, file.name);
  if (ext === "doc")
    throw new UnsupportedFormatError("DOC пока не открывается. Пересохраните файл в DOCX в Word или Google Документах.");
  throw new UnsupportedFormatError("Поддерживаются файлы TXT, DOCX и FB2.");
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
      title = prettifyTitle(text);
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

// ---- FB2 ----

/** Кодировку берём из заголовка XML: многие FB2 в windows-1251. */
function decodeXml(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const enc = head.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return decodeText(bytes);
  }
}

const childrenNamed = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const firstNamed = (el: Element | Document, name: string) =>
  Array.from((el as Element).getElementsByTagName?.("*") ?? []).find((c) => c.localName === name);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Текст абзаца без ссылок на сноски. */
function inlineText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const a of Array.from(copy.getElementsByTagName("*")))
    if (a.localName === "a" && /note/i.test(a.getAttribute("type") ?? "")) a.remove();
  return clean(copy.textContent ?? "");
}

/** Абзацы блока: обычные, стихи (строки через \n), цитаты, эпиграфы. */
function blockParagraphs(el: Element): string[] {
  const out: string[] = [];
  for (const c of Array.from(el.children)) {
    switch (c.localName) {
      case "p":
      case "subtitle":
      case "text-author": {
        const t = inlineText(c);
        if (t) out.push(t);
        break;
      }
      case "poem":
      case "stanza": {
        const lines = Array.from(c.getElementsByTagName("*")).filter((v) => v.localName === "v").map(inlineText).filter(Boolean);
        const title = childrenNamed(c, "title").map((t) => blockParagraphs(t).join(" "));
        if (c.localName === "poem") {
          // У poem строфы — отдельные абзацы.
          out.push(...title);
          for (const st of childrenNamed(c, "stanza")) out.push(...blockParagraphs(st));
          out.push(...childrenNamed(c, "text-author").map(inlineText));
        } else if (lines.length) out.push(lines.join("\n"));
        break;
      }
      case "cite":
      case "epigraph":
        out.push(...blockParagraphs(c));
        break;
    }
  }
  return out.filter(Boolean);
}

const titleOf = (el: Element) => {
  const t = childrenNamed(el, "title")[0];
  return t ? clean(blockParagraphs(t).join(". ").replace(/\.\s*\./g, ".")) : "";
};

/** Разворачивает вложенные section в плоский список глав; заголовок части идёт в название первой главы. */
function collectSections(el: Element, prefix: string, out: ChapterText[]) {
  const subs = childrenNamed(el, "section");
  const title = titleOf(el);
  const full = [prefix, title && prettifyTitle(title)].filter(Boolean).join(" · ");
  const own = blockParagraphs(el);
  if (!subs.length) {
    if (own.length) out.push({ title: full, text: own.join("\n\n") });
    return;
  }
  let pending = full;
  if (own.length) {
    out.push({ title: full, text: own.join("\n\n") });
    pending = "";
  }
  for (const s of subs) {
    collectSections(s, pending, out);
    pending = "";
  }
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: "\u00a0", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", bdquo: "„", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", shy: "", copy: "©", deg: "°", middot: "·", times: "×", minus: "−", sect: "§", numero: "№",
};
const XML_ENTITIES = new Set(["amp", "lt", "gt", "quot", "apos"]);
const fixEntities = (xml: string) =>
  xml.replace(/&([a-z]+);/gi, (m, name: string) => (XML_ENTITIES.has(name) ? m : (HTML_ENTITIES[name.toLowerCase()] ?? "")));

export function parseFb2(bytes: Uint8Array, fileName: string): ParsedBook {
  const xml = decodeXml(bytes);
  let doc = new DOMParser().parseFromString(xml, "application/xml");
  // Частая поломка — HTML-сущности вроде &nbsp;, которых нет в XML: заменяем их и пробуем ещё раз.
  if (doc.getElementsByTagName("parsererror").length)
    doc = new DOMParser().parseFromString(fixEntities(xml), "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new UnsupportedFormatError("Не удалось открыть FB2: файл повреждён.");

  const info = firstNamed(doc, "title-info");
  const title = info ? clean(firstNamed(info, "book-title")?.textContent ?? "") : "";
  const authorEl = info ? firstNamed(info, "author") : undefined;
  const author = authorEl
    ? clean(["first-name", "middle-name", "last-name"].map((n) => firstNamed(authorEl, n)?.textContent ?? "").join(" ")) ||
      clean(firstNamed(authorEl, "nickname")?.textContent ?? "")
    : "";

  const bodies = Array.from(doc.getElementsByTagName("*")).filter((e) => e.localName === "body");
  const body = bodies.find((b) => !/notes|comments/i.test(b.getAttribute("name") ?? "")) ?? bodies[0];
  if (!body) throw new UnsupportedFormatError("Не удалось открыть FB2: внутри нет текста.");

  const chapters: ChapterText[] = [];
  // Эпиграф и прочее до первой главы.
  const intro = blockParagraphs(body);
  for (const s of childrenNamed(body, "section")) collectSections(s, "", chapters);
  if (intro.length) {
    if (chapters.length) chapters[0] = { ...chapters[0], text: `${intro.join("\n\n")}\n\n${chapters[0].text}` };
    else chapters.push({ title: "", text: intro.join("\n\n") });
  }

  const all = chapters.map((c) => c.text).join("\n\n");
  // Разметки нет (всё в одной section без заголовков) — ищем главы по тексту, как в TXT.
  const titled = chapters.filter((c) => c.title).length;
  const result =
    chapters.length > 1 && titled > 0
      ? chapters.map((c, i) => ({ ...c, title: c.title || (i === 0 ? "Начало" : `Часть ${i + 1}`) }))
      : splitChapters(all);
  return {
    title: title || stripExt(fileName.replace(/\.fb2(\.zip)?$/i, "")),
    author,
    format: "FB2",
    chapters: result.length ? result : splitIntoParts(all),
  };
}

function parseFb2Zip(bytes: Uint8Array, fileName: string): ParsedBook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => /\.fb2$/i.test(f.name) });
  } catch {
    throw new UnsupportedFormatError("Не удалось открыть архив: файл повреждён.");
  }
  const name = Object.keys(files)[0];
  if (!name) throw new UnsupportedFormatError("В архиве нет файла FB2.");
  return parseFb2(files[name], fileName);
}
