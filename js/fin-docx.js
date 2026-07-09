/**
 * Document Tools - js/fin-docx.js
 * IR(중간모델) → DOCX (KIPO 출원서식 / 해외출원용 국문 ROPKS)
 *
 * utils.js의 finBuildDocModel로 스타일드 블록 모델을 만든 뒤 하나의 렌더러로 조립한다.
 * 포맷별 글꼴/크기/여백:
 *   - ropks: Times New Roman + 바탕, 12pt(sz24), ROPKS 샘플 여백
 *   - kipo : Malgun Gothic, 10pt(sz20), KIPO 출원서식 샘플 여백 + 4부(部) 페이지 나누기
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

// 포맷별 기본 글꼴 크기(half-point)
const FIN_BASE_SIZE = { ropks: 24, kipo: 20 };

// ROPKS 샘플의 공통 탭 스톱(12개, 약 799 간격)
const FIN_ROPKS_TABS = '<w:tabs>'
    + [799, 1599, 2398, 3197, 3997, 4796, 5596, 6395, 7194, 7994, 8793, 9592]
        .map(pos => `<w:tab w:val="left" w:pos="${pos}"/>`).join('')
    + '</w:tabs>';

/**
 * 첨자/줄바꿈을 포함한 텍스트를 <w:r> 런들로 변환 (rPrInner 는 vertAlign 이전까지의 런 속성)
 * @param {string} text
 * @param {string} rPrInner - 런 공통 속성(rFonts/b/kern/sz 등)
 * @returns {string}
 */
function finRunsFromText(text, rPrInner) {
    let runs = '';
    const emit = (chunk, vert) => {
        const parts = String(chunk).split('\n');
        for (let i = 0; i < parts.length; i++) {
            if (i > 0) runs += `<w:r><w:rPr>${rPrInner}</w:rPr><w:br/></w:r>`;
            const t = parts[i];
            if (t === '') continue;
            const va = vert ? `<w:vertAlign w:val="${vert}"/>` : '';
            runs += `<w:r><w:rPr>${rPrInner}${va}</w:rPr><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>`;
        }
    };
    const re = /<(sub|sup)>([\s\S]*?)<\/\1>/gi;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) emit(text.slice(last, m.index), null);
        emit(m[2], m[1].toLowerCase() === 'sub' ? 'subscript' : 'superscript');
        last = re.lastIndex;
    }
    if (last < String(text).length) emit(String(text).slice(last), null);
    return runs;
}

/**
 * 텍스트 → 런 XML (KIPO/표 공용: bold/size 만 지정)
 * @param {string} text
 * @param {Object} opts - { bold, size }
 * @returns {string}
 */
function finTextToRuns(text, opts) {
    opts = opts || {};
    const boldXml = opts.bold ? '<w:b/><w:bCs/>' : '';
    const size = opts.size || 24;
    return finRunsFromText(text, `${boldXml}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
}

// ROPKS 런 공통 속성(바탕체 + kern0 + 12pt, 볼드 시 볼드+밑줄)
function finRopksRunProps(bold) {
    return '<w:rFonts w:ascii="바탕체" w:eastAsia="바탕체" w:hAnsi="바탕체"/>'
        + (bold ? '<w:b/>' : '')
        + '<w:kern w:val="0"/><w:sz w:val="24"/><w:szCs w:val="24"/>'
        + (bold ? '<w:u w:val="single"/>' : '');
}

/**
 * ROPKS 단락 블록 → <w:p> XML (바탕체·행간518·탭·첫줄들여쓰기·볼드+밑줄, 샘플 역설계)
 * @param {Object} block - {text, bold, indent, align}
 * @returns {string}
 */
function finRopksParagraphXml(block) {
    const bold = !!block.bold;
    const rPrInner = finRopksRunProps(bold);
    const ind = block.indent ? '<w:ind w:firstLine="799"/>' : '';
    const jc = block.align ? `<w:jc w:val="${block.align}"/>` : '';
    const outline = bold ? '<w:outlineLvl w:val="0"/>' : '';
    const pPr = `<w:pPr>${FIN_ROPKS_TABS}<w:adjustRightInd w:val="0"/><w:spacing w:line="518" w:lineRule="auto"/>${ind}${jc}<w:contextualSpacing/>${outline}<w:rPr>${rPrInner}</w:rPr></w:pPr>`;
    return `<w:p>${pPr}${finRunsFromText(block.text, rPrInner)}</w:p>`;
}

/**
 * KIPO 단락 블록 → <w:p> XML (bold/align/size/before/after 반영)
 * @param {Object} block - {text, bold, align, size, before, after}
 * @param {number} baseSize - 포맷 기본 글꼴 크기(half-point)
 * @returns {string}
 */
function finParagraphXml(block, baseSize) {
    const size = block.size || baseSize;
    let spacing = '';
    if (block.before != null || block.after != null) {
        const b = block.before != null ? ` w:before="${block.before}"` : '';
        const a = block.after != null ? ` w:after="${block.after}"` : '';
        spacing = `<w:spacing${b}${a}/>`;
    }
    const jc = block.align ? `<w:jc w:val="${block.align}"/>` : '';
    const boldMark = block.bold ? '<w:b/><w:bCs/>' : '';
    const pPr = `<w:pPr>${spacing}${jc}<w:rPr>${boldMark}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:pPr>`;
    return `<w:p>${pPr}${finTextToRuns(block.text, { bold: block.bold, size })}</w:p>`;
}

/**
 * HTML <table> → OOXML 표 (셀 가운데 정렬, 표 뒤 빈 단락 포함)
 * @param {string} tableHtml
 * @param {string} format - 'ropks' | 'kipo' (셀 글꼴/크기 결정)
 * @returns {string}
 */
function finTableToOoxml(tableHtml, format) {
    const baseSize = FIN_BASE_SIZE[format] || 24;
    // ROPKS 셀은 바탕체, KIPO 셀은 기본(Malgun) — 런 공통 속성
    const cellRPr = format === 'ropks'
        ? finRopksRunProps(false)
        : `<w:sz w:val="${baseSize}"/><w:szCs w:val="${baseSize}"/>`;
    const trs = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!trs || !trs.length) return '';
    let maxCols = 0;
    trs.forEach(tr => {
        let c = 0;
        (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).forEach(td => {
            const cs = td.match(/colspan\s*=\s*["']?(\d+)/i);
            c += cs ? parseInt(cs[1], 10) : 1;
        });
        maxCols = Math.max(maxCols, c);
    });
    if (!maxCols) return '';

    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
    let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>'
        + `<w:jc w:val="center"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>`
        + Array(maxCols).fill('<w:gridCol w:w="1500"/>').join('')
        + '</w:tblGrid>';

    trs.forEach(tr => {
        xml += '<w:tr>';
        (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).forEach(td => {
            const cs = td.match(/colspan\s*=\s*["']?(\d+)/i);
            let tcPr = '<w:tcPr>';
            if (cs && parseInt(cs[1], 10) > 1) tcPr += `<w:gridSpan w:val="${cs[1]}"/>`;
            tcPr += '<w:vAlign w:val="center"/></w:tcPr>';
            let inner = td.replace(/<t[dh][^>]*>/i, '').replace(/<\/t[dh]>/i, '').replace(/<br\s*\/?>/gi, '\n');
            const pPr = `<w:pPr><w:jc w:val="center"/><w:rPr>${cellRPr}</w:rPr></w:pPr>`;
            xml += `<w:tc>${tcPr}<w:p>${pPr}${finRunsFromText(inner, cellRPr)}</w:p></w:tc>`;
        });
        xml += '</w:tr>';
    });
    return xml + '</w:tbl><w:p/>';
}

/**
 * 페이지 나누기 단락
 * @returns {string}
 */
function finPageBreakXml() {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

/**
 * 포맷별 커스텀 styles.xml (글꼴/기본 크기 + 단락 뒤 0pt + TableGrid)
 * @param {string} format - 'ropks' | 'kipo'
 * @returns {string}
 */
function finStylesXml(format) {
    const font = format === 'kipo'
        ? '<w:rFonts w:ascii="Malgun Gothic" w:eastAsia="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        : '<w:rFonts w:ascii="Times New Roman" w:eastAsia="바탕" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
    const sz = FIN_BASE_SIZE[format] || 24;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="en-US" w:eastAsia="ko-KR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;
}

/**
 * 포맷별 <w:sectPr> (용지·여백)
 * @param {string} format - 'ropks' | 'kipo'
 * @returns {string}
 */
function finSectPr(format) {
    if (format === 'kipo') {
        // KIPO 출원서식 샘플 역설계값
        return '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="850" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
    }
    // ROPKS 샘플 역설계값
    return '<w:sectPr><w:pgSz w:w="11908" w:h="16833"/><w:pgMar w:top="2239" w:right="1134" w:bottom="1106" w:left="1417" w:header="1134" w:footer="567" w:gutter="0"/></w:sectPr>';
}

/**
 * IR → DOCX Blob (KIPO 출원서식 또는 ROPKS)
 * @param {Object} ir - parseFinFile 결과
 * @param {string} format - 'kipo' | 'ropks'
 * @returns {Promise<Blob>}
 */
async function buildFinDocxBlob(ir, format) {
    const baseSize = FIN_BASE_SIZE[format] || 24;
    const model = finBuildDocModel(ir, format);
    const media = [];
    const usedExt = {};
    let imgCount = 0;
    let body = '';

    const isRopks = format === 'ropks';
    for (const block of model) {
        if (block.t === 'pagebreak') {
            body += finPageBreakXml();
        } else if (block.t === 'table') {
            body += finTableToOoxml(block.html, format);
        } else if (block.t === 'img') {
            const d = block.drawing;
            if (!d || !d.base64) { body += '<w:p/>'; continue; }
            imgCount++;
            const ext = (String(d.fmt || 'jpg').toLowerCase() === 'png') ? 'png' : 'jpg';
            usedExt[ext] = d.mime || (ext === 'png' ? 'image/png' : 'image/jpeg');
            const rid = 'rIdImg' + imgCount;
            const target = 'media/finimg' + imgCount + '.' + ext;
            media.push({ path: 'word/' + target, base64: d.base64, rid, target });
            const run = mdDocxImageRunXml({
                rid, id: imgCount, name: 'fig' + d.num + '.' + ext,
                cx: finMmToEmu(d.wi), cy: finMmToEmu(d.he)
            });
            const align = block.align || 'center';
            if (isRopks) {
                // ROPKS 공통 단락 서식(탭·행간518) + 중앙 정렬
                body += `<w:p><w:pPr>${FIN_ROPKS_TABS}<w:adjustRightInd w:val="0"/><w:spacing w:line="518" w:lineRule="auto"/><w:jc w:val="${align}"/><w:contextualSpacing/></w:pPr>${run}</w:p>`;
            } else {
                let spacing = '';
                if (block.before != null || block.after != null) {
                    const b = block.before != null ? ` w:before="${block.before}"` : '';
                    const a = block.after != null ? ` w:after="${block.after}"` : '';
                    spacing = `<w:spacing${b}${a}/>`;
                }
                body += `<w:p><w:pPr>${spacing}<w:jc w:val="${align}"/></w:pPr>${run}</w:p>`;
            }
        } else {
            // 'p' 블록 — 포맷별 단락 렌더링
            body += isRopks ? finRopksParagraphXml(block) : finParagraphXml(block, baseSize);
        }
    }

    if (!body.trim()) body = '<w:p/>';
    body += finSectPr(format);

    // 패키지 조립
    const zip = new JSZip();

    const extDefaults = Object.keys(usedExt)
        .map(ext => `<Default Extension="${ext}" ContentType="${usedExt[ext]}"/>`).join('');
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${extDefaults}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    let docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    for (const m of media) {
        docRels += `\n<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.target}"/>`;
    }
    docRels += '\n</Relationships>';
    zip.file('word/_rels/document.xml.rels', docRels);

    zip.file('word/styles.xml', finStylesXml(format));

    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${body}</w:body>
</w:document>`);

    for (const m of media) {
        zip.file(m.path, m.base64, { base64: true });
    }

    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}
