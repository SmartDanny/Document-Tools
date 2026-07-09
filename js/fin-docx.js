/**
 * Document Tools - js/fin-docx.js
 * IR(중간모델) → DOCX (KIPO 출원서식 / 해외출원용 국문 ROPKS)
 *
 * utils.js의 finBuildDocModel로 블록 모델을 만든 뒤 하나의 렌더러로 조립한다.
 * 글꼴 Times New Roman + 바탕(한글), 12pt. 도면 이미지는 media로 임베드.
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

// 본문 12pt(half-point 24) 런 속성
const FIN_SZ = '<w:sz w:val="24"/><w:szCs w:val="24"/>';

/**
 * 텍스트(첨자 <sub>/<sup> 태그·\n 줄바꿈 포함)를 <w:r> 런 XML로 변환
 * @param {string} text
 * @param {Object} [opts] - { bold, align }
 * @returns {string}
 */
function finTextToRuns(text, opts) {
    opts = opts || {};
    const boldXml = opts.bold ? '<w:b/><w:bCs/>' : '';
    let runs = '';
    const emit = (chunk, vert) => {
        const parts = String(chunk).split('\n');
        for (let i = 0; i < parts.length; i++) {
            if (i > 0) runs += `<w:r><w:rPr>${boldXml}${FIN_SZ}</w:rPr><w:br/></w:r>`;
            const t = parts[i];
            if (t === '') continue;
            const va = vert ? `<w:vertAlign w:val="${vert}"/>` : '';
            runs += `<w:r><w:rPr>${boldXml}${va}${FIN_SZ}</w:rPr><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>`;
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
 * 단락 블록 → <w:p> XML
 * @param {string} text
 * @param {Object} [opts] - { bold, align }
 * @returns {string}
 */
function finParagraphXml(text, opts) {
    opts = opts || {};
    const jc = opts.align ? `<w:jc w:val="${opts.align}"/>` : '';
    const boldMark = opts.bold ? '<w:b/><w:bCs/>' : '';
    const pPr = `<w:pPr>${jc}<w:rPr>${boldMark}${FIN_SZ}</w:rPr></w:pPr>`;
    return `<w:p>${pPr}${finTextToRuns(text, opts)}</w:p>`;
}

/**
 * HTML <table> → OOXML 표 (12pt, 셀 가운데 정렬, 표 뒤 빈 단락 포함)
 * @param {string} tableHtml
 * @returns {string}
 */
function finTableToOoxml(tableHtml) {
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
            const pPr = `<w:pPr><w:jc w:val="center"/><w:rPr>${FIN_SZ}</w:rPr></w:pPr>`;
            xml += `<w:tc>${tcPr}<w:p>${pPr}${finTextToRuns(inner, {})}</w:p></w:tc>`;
        });
        xml += '</w:tr>';
    });
    return xml + '</w:tbl><w:p/>';
}

/**
 * 커스텀 styles.xml (Times New Roman + 바탕, 12pt, 단락 뒤 0pt, TableGrid)
 * @returns {string}
 */
function finStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="바탕" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="ko-KR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>
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
    if (format === 'ropks') {
        // ROPKS 샘플 역설계값
        return '<w:sectPr><w:pgSz w:w="11908" w:h="16833"/><w:pgMar w:top="2239" w:right="1134" w:bottom="1106" w:left="1417" w:header="1134" w:footer="567" w:gutter="0"/></w:sectPr>';
    }
    // KIPO 출원서식: A4 + 균등 여백
    return '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
}

/**
 * IR → DOCX Blob (KIPO 출원서식 또는 ROPKS)
 * @param {Object} ir - parseFinFile 결과
 * @param {string} format - 'kipo' | 'ropks'
 * @returns {Promise<Blob>}
 */
async function buildFinDocxBlob(ir, format) {
    const model = finBuildDocModel(ir, format);
    const media = [];
    const usedExt = {};
    let imgCount = 0;
    let body = '';

    for (const block of model) {
        if (block.t === 'sub') {
            body += finParagraphXml(block.text, { bold: true });
        } else if (block.t === 'p') {
            body += finParagraphXml(block.text || '', {});
        } else if (block.t === 'table') {
            body += finTableToOoxml(block.html);
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
            body += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run}</w:p>`;
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

    zip.file('word/styles.xml', finStylesXml());

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
