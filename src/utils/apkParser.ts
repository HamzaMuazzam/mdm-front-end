import JSZip from 'jszip';

export interface ApkInfo {
  packageName?: string;
  versionName?: string;
  versionCode?: number;
  appName?: string;
}

export async function parseApkFile(file: File): Promise<ApkInfo> {
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // XAPK: has a manifest.json at root
    const xapkManifest = zip.file('manifest.json');
    if (xapkManifest) {
      const text = await xapkManifest.async('text');
      const manifest = JSON.parse(text);
      return {
        packageName: manifest.package_name ?? undefined,
        versionName: manifest.version_name ?? undefined,
        versionCode: manifest.version_code != null ? Number(manifest.version_code) : undefined,
        appName: manifest.name ?? undefined,
      };
    }

    // APK: has AndroidManifest.xml in binary AXML format
    const manifestFile = zip.file('AndroidManifest.xml');
    if (manifestFile) {
      const manifestBuffer = await manifestFile.async('arraybuffer');
      return parseAndroidManifest(manifestBuffer);
    }
  } catch {
    // Ignore parse errors — caller will leave fields empty
  }
  return {};
}

// ─── Binary AXML Parser ────────────────────────────────────────────────────────

function parseAndroidManifest(buffer: ArrayBuffer): ApkInfo {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8) return {};

  const magic = view.getUint32(0, true);
  if (magic !== 0x00080003) return {}; // Not valid AXML

  const result: ApkInfo = {};
  let offset = 8; // skip main header (type + headerSize + chunkSize, 8 bytes)

  let strings: string[] = [];

  while (offset + 8 <= buffer.byteLength) {
    const chunkType = view.getUint16(offset, true);
    const headerSize = view.getUint16(offset + 2, true);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkSize < 8 || offset + chunkSize > buffer.byteLength) break;

    if (chunkType === 0x0001) {
      // String pool
      strings = readStringPool(view, buffer, offset);
    } else if (chunkType === 0x0102) {
      // Start element — ResXMLTree_node (headerSize=16) + ResXMLTree_attrExt
      if (offset + headerSize + 20 <= buffer.byteLength) {
        const attrExtBase = offset + headerSize; // starts right after node header (16 bytes)
        const nameIdx = view.getInt32(attrExtBase + 4, true);
        const elementName = getStr(strings, nameIdx);

        if (elementName === 'manifest') {
          const attributeStart = view.getUint16(attrExtBase + 8, true);
          const attributeSize = view.getUint16(attrExtBase + 10, true);
          const attributeCount = view.getUint16(attrExtBase + 12, true);
          const firstAttrOffset = attrExtBase + attributeStart;

          for (let i = 0; i < attributeCount; i++) {
            const ao = firstAttrOffset + i * attributeSize;
            if (ao + 20 > buffer.byteLength) break;

            const attrNameIdx = view.getInt32(ao + 4, true);
            const rawValueIdx = view.getInt32(ao + 8, true);
            const dataType = view.getUint8(ao + 15);
            const valueData = view.getUint32(ao + 16, true);

            const attrName = getStr(strings, attrNameIdx);

            if (attrName === 'package') {
              result.packageName = getStr(strings, rawValueIdx) || undefined;
            } else if (attrName === 'versionName') {
              if (dataType === 0x03) {
                // TYPE_STRING — rawValueIdx or valueData is string index
                result.versionName =
                  (rawValueIdx >= 0 ? getStr(strings, rawValueIdx) : getStr(strings, valueData)) || undefined;
              }
            } else if (attrName === 'versionCode') {
              // TYPE_INT_DEC (0x10) or TYPE_INT_HEX (0x11)
              if (dataType === 0x10 || dataType === 0x11) {
                result.versionCode = valueData;
              }
            }
          }
          // Found the manifest element — we have what we need
          break;
        }
      }
    }

    offset += chunkSize;
  }

  return result;
}

function getStr(strings: string[], idx: number): string {
  if (idx < 0 || idx >= strings.length) return '';
  return strings[idx] ?? '';
}

function readStringPool(view: DataView, buffer: ArrayBuffer, chunkOffset: number): string[] {
  const headerSize = view.getUint16(chunkOffset + 2, true);
  const stringCount = view.getUint32(chunkOffset + 8, true);
  const flags = view.getUint32(chunkOffset + 16, true);
  const stringsStart = view.getUint32(chunkOffset + 20, true);
  const isUtf8 = (flags & 0x100) !== 0;

  const strings: string[] = [];
  const offsetsBase = chunkOffset + headerSize;
  const strDataBase = chunkOffset + stringsStart;

  for (let i = 0; i < stringCount; i++) {
    try {
      const strRelOffset = view.getUint32(offsetsBase + i * 4, true);
      const strAbsOffset = strDataBase + strRelOffset;

      if (isUtf8) {
        strings.push(readUtf8Str(view, buffer, strAbsOffset));
      } else {
        strings.push(readUtf16Str(view, buffer, strAbsOffset));
      }
    } catch {
      strings.push('');
    }
  }

  return strings;
}

function readUtf8Str(view: DataView, buffer: ArrayBuffer, offset: number): string {
  // UTF-16 length (1-2 bytes, high bit = 2-byte form)
  let b = view.getUint8(offset++);
  if (b & 0x80) { b = ((b & 0x7f) << 8) | view.getUint8(offset++); }

  // UTF-8 byte length (1-2 bytes, high bit = 2-byte form)
  let len = view.getUint8(offset++);
  if (len & 0x80) { len = ((len & 0x7f) << 8) | view.getUint8(offset++); }

  const bytes = new Uint8Array(buffer, offset, len);
  return new TextDecoder('utf-8').decode(bytes);
}

function readUtf16Str(view: DataView, buffer: ArrayBuffer, offset: number): string {
  // Length in chars (1-2 uint16s, high bit = 2-uint16 form)
  let len = view.getUint16(offset, true);
  offset += 2;
  if (len & 0x8000) {
    len = ((len & 0x7fff) << 16) | view.getUint16(offset, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer, offset, len * 2);
  return new TextDecoder('utf-16le').decode(bytes);
}
