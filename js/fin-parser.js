/**
 * Document Tools - js/fin-parser.js
 * .fin(KIPO 전자출원 압축파일) 파싱 → IR(중간모델)
 *
 * 구조: sample.fin(zip) → *.hlz(zip) → KIPO KEAPS XML + pat0000N 도면 이미지
 * IR은 utils.js의 finBuildKipoLineText / finBuildDocModel이 소비한다.
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

/**
 * 인라인 노드를 텍스트로 직렬화 (첨자는 <sub>/<sup> 태그로 유지, <br/>는 \n, <figref>는 "도 N")
 * @param {Node} node - 부모 요소
 * @returns {string}
 */
function finSerializeNode(node) {
    if (node.nodeType === 3) return node.nodeValue;        // TEXT_NODE
    if (node.nodeType !== 1) return '';                    // ELEMENT_NODE만
    const name = node.localName || node.nodeName;
    if (name === 'br') return '\n';
    if (name === 'sub') return '<sub>' + finSerializeInline(node) + '</sub>';
    if (name === 'sup') return '<sup>' + finSerializeInline(node) + '</sup>';
    if (name === 'figref') { const n = node.getAttribute('num'); return n ? `도 ${n}` : ''; }
    if (name === 'tables') return '';                      // 표는 별도 블록으로 처리(인라인 제외)
    return finSerializeInline(node);                       // 기타 태그는 내용만
}

function finSerializeInline(node) {
    let out = '';
    if (!node) return out;
    for (const child of node.childNodes) out += finSerializeNode(child);
    return out;
}

/**
 * 부모의 직접 자식 <p>들을 {num, text} 배열로 추출 (중첩 표 내부 단락과 분리)
 * @param {Element} parent
 * @returns {Array<{num:string, text:string}>}
 */
function finSectionParas(parent) {
    const arr = [];
    if (!parent) return arr;
    for (const child of parent.childNodes) {
        if (child.nodeType === 1 && (child.localName || child.nodeName) === 'p') {
            arr.push({ num: child.getAttribute('num') || '', text: finCleanText(finSerializeInline(child)) });
        }
    }
    return arr;
}

// 직렬화 텍스트 정규화: 빈 줄 제거 + 유니코드 첨자 → <sub>/<sup> (utils.js)
function finCleanText(s) {
    return finNormalizeScripts(finCleanMultiline(s));
}

/**
 * OASIS CALS 표 요소(<tables>)를 HTML <table>로 변환 (셀 병합·첨자·<br> 유지)
 * @param {Element} tablesEl
 * @returns {string} HTML 문자열
 */
function finCalsToHtml(tablesEl) {
    // 열 순서(colspec colname → 인덱스)
    const colIdx = {};
    let ci = 0;
    for (const cs of tablesEl.getElementsByTagName('colspec')) {
        colIdx[cs.getAttribute('colname') || ('col' + (ci + 1))] = ci;
        ci++;
    }
    const cellInline = (entry) => {
        let content = '';
        for (const child of entry.childNodes) {
            if (child.nodeType === 3) content += child.nodeValue;
            else if (child.nodeType === 1) {
                const nm = child.localName || child.nodeName;
                if (nm === 'br') content += '<br>';
                else if (nm === 'sub') content += '<sub>' + finSerializeInline(child) + '</sub>';
                else if (nm === 'sup') content += '<sup>' + finSerializeInline(child) + '</sup>';
                else content += finSerializeInline(child);
            }
        }
        return finNormalizeScripts(content.trim());
    };
    let html = '<table border="1">';
    for (const row of tablesEl.getElementsByTagName('row')) {
        html += '<tr>';
        for (const entry of row.getElementsByTagName('entry')) {
            const nst = entry.getAttribute('namest');
            const nend = entry.getAttribute('nameend');
            let colspan = 1;
            if (nst && nend && colIdx[nst] != null && colIdx[nend] != null) {
                colspan = colIdx[nend] - colIdx[nst] + 1;
            }
            const mr = entry.getAttribute('morerows');
            const rowspan = mr ? (parseInt(mr, 10) + 1) : 1;
            let attrs = '';
            if (colspan > 1) attrs += ` colspan="${colspan}"`;
            if (rowspan > 1) attrs += ` rowspan="${rowspan}"`;
            html += `<td${attrs}>${cellInline(entry)}</td>`;
        }
        html += '</tr>';
    }
    return html + '</table>';
}

/**
 * description-of-embodiments의 직접 자식 <p>/<tables>를 문서 순서대로 추출
 * @param {Element} parent
 * @returns {Array<Object>} {kind:'p',num,text} | {kind:'table',num,html}
 */
function finEmbodiments(parent) {
    const out = [];
    if (!parent) return out;
    for (const child of parent.childNodes) {
        if (child.nodeType !== 1) continue;
        const name = child.localName || child.nodeName;
        if (name === 'tables') {
            out.push({ kind: 'table', num: child.getAttribute('num') || '', html: finCalsToHtml(child) });
            continue;
        }
        if (name !== 'p') continue;
        const num = child.getAttribute('num') || '';
        // <p> 내부에 <tables>가 없으면 단순 단락
        if (child.getElementsByTagName('tables').length === 0) {
            out.push({ kind: 'p', num, text: finCleanText(finSerializeInline(child)) });
            continue;
        }
        // <p>가 표를 포함하면 텍스트/표를 문서 순서대로 분리
        let buf = '';
        let firstText = true;
        const flush = () => {
            const t = buf.trim();
            if (t) { out.push({ kind: 'p', num: firstText ? num : '', text: t }); firstText = false; }
            buf = '';
        };
        for (const node of child.childNodes) {
            if (node.nodeType === 1 && (node.localName || node.nodeName) === 'tables') {
                flush();
                out.push({ kind: 'table', num: node.getAttribute('num') || '', html: finCalsToHtml(node) });
            } else {
                buf += finSerializeNode(node);
            }
        }
        flush();
    }
    // 표 앞뒤 텍스트 단락 정규화
    for (const it of out) {
        if (it.kind === 'p') it.text = finCleanText(it.text);
    }
    return out;
}

/**
 * 파싱된 KIPO XML Document → IR
 * @param {Document} doc
 * @returns {Object} IR
 */
function finXmlToIr(doc) {
    const first = (tag, parent) => (parent || doc).getElementsByTagName(tag)[0] || null;

    const inventionTitle = first('invention-title');
    const titleRaw = inventionTitle ? finNormalizeScripts(finSerializeInline(inventionTitle).trim()) : '';
    let titleKo = titleRaw, titleEn = '';
    const bm = titleRaw.match(/^([\s\S]*?)\{([\s\S]*)\}\s*$/);
    if (bm) { titleKo = bm[1].trim(); titleEn = bm[2].trim(); }

    const summary = first('summary-of-invention');
    const ir = {
        titleRaw, titleKo, titleEn,
        technicalField: finSectionParas(first('technical-field')),
        backgroundArt: finSectionParas(first('background-art')),
        techProblem: finSectionParas(first('tech-problem', summary)),
        techSolution: finSectionParas(first('tech-solution', summary)),
        advantageousEffects: finSectionParas(first('advantageous-effects')),
        // 도면의 간단한 설명·부호의 설명은 하나의 <p>(내부 <br/>는 \n으로 보존) → {num,text}
        descriptionOfDrawings: finSectionParas(first('description-of-drawings')),
        embodiments: finEmbodiments(first('description-of-embodiments')),
        referenceSigns: finSectionParas(first('reference-signs-list')),
        claims: [],
        abstract: { summary: [], figureNum: '' },
        drawings: []
    };

    // 청구항
    const claimsEl = first('claims');
    if (claimsEl) {
        for (const claim of claimsEl.getElementsByTagName('claim')) {
            const ct = claim.getElementsByTagName('claim-text')[0];
            const text = ct ? finCleanText(finSerializeInline(ct)) : '';
            ir.claims.push({ num: claim.getAttribute('num') || '', text });
        }
    }

    // 요약서
    const absEl = first('abstract');
    if (absEl) {
        ir.abstract.summary = finSectionParas(first('summary', absEl));
        const figref = absEl.getElementsByTagName('figref')[0];
        if (figref) ir.abstract.figureNum = figref.getAttribute('num') || '';
    }

    // 도면
    const drawingsEl = first('drawings');
    if (drawingsEl) {
        for (const fig of drawingsEl.getElementsByTagName('figure')) {
            const img = fig.getElementsByTagName('img')[0];
            if (!img) continue;
            const fmt = img.getAttribute('img-format') || 'jpg';
            ir.drawings.push({
                num: fig.getAttribute('num') || '',
                file: img.getAttribute('file') || '',
                fmt,
                mime: finImgFormatToMime(fmt),
                wi: parseFloat(img.getAttribute('wi')) || 0,
                he: parseFloat(img.getAttribute('he')) || 0,
                base64: null
            });
        }
    }

    return ir;
}

/**
 * .fin 파일을 파싱하여 IR을 반환 (도면 이미지 base64 포함)
 * @param {File} file - .fin 파일
 * @returns {Promise<Object>} IR
 */
async function parseFinFile(file) {
    const outerZip = await JSZip.loadAsync(await file.arrayBuffer());

    // 내부 .hlz 찾기
    let hlzEntry = null;
    outerZip.forEach((path, entry) => {
        if (!entry.dir && /\.hlz$/i.test(path)) hlzEntry = entry;
    });
    if (!hlzEntry) throw new Error('.fin 내부에서 .hlz 파일을 찾을 수 없습니다. 올바른 KIPO 전자출원 파일인지 확인해주세요.');

    const hlzZip = await JSZip.loadAsync(await hlzEntry.async('arraybuffer'));

    // XML + 이미지 엔트리 수집
    let xmlEntry = null;
    const imageEntries = {};
    hlzZip.forEach((path, entry) => {
        if (entry.dir) return;
        const base = path.split('/').pop();
        if (/\.xml$/i.test(base)) { if (!xmlEntry) xmlEntry = entry; }
        else if (/\.(jpe?g|png|gif|bmp|tif|tiff)$/i.test(base)) imageEntries[base] = entry;
    });
    if (!xmlEntry) throw new Error('.hlz 내부에서 명세서 XML을 찾을 수 없습니다.');

    const xmlText = await xmlEntry.async('string');
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
        throw new Error('명세서 XML 파싱에 실패했습니다.');
    }

    const ir = finXmlToIr(doc);

    // 도면 이미지 base64 로드 (병렬)
    await Promise.all(ir.drawings.map(async d => {
        const entry = imageEntries[d.file] || imageEntries[(d.file || '').split('/').pop()];
        d.base64 = entry ? await entry.async('base64') : null;
    }));

    // 메타
    const kipo = doc.getElementsByTagName('KIPO')[0];
    const caf = doc.getElementsByTagName('PatentCAFDOC')[0];
    ir.meta = {
        fileName: file.name,
        keapsVersion: kipo ? (kipo.getAttribute('keapsVersion') || '') : '',
        editorKind: kipo ? (kipo.getAttribute('editorKind') || '') : '',
        pageCount: kipo ? (kipo.getAttribute('pageCount') || '') : '',
        docId: caf ? (caf.getAttribute('documentID') || '') : ''
    };

    return ir;
}
