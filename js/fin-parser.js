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
    if (name === 'img') {
        // 본문 인라인 이미지(문자표 미지원 특수문자 등) — 소거하지 않고 마커로 보존.
        // fin-docx가 마커를 이미지 런으로 임베드하고, 라인 텍스트(변환결과 표시/복사)에서는 제거된다.
        const f = node.getAttribute('file') || '';
        if (!f) return '';
        return `<img data-finimg="${f}" data-wi="${node.getAttribute('wi') || ''}"`
            + ` data-he="${node.getAttribute('he') || ''}" data-fmt="${node.getAttribute('img-format') || ''}">`;
    }
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
                else if (nm === 'img') content += finSerializeNode(child); // 셀 내 인라인 이미지도 마커로 보존
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

    // 의심 문자 검사용 원문 단락 수집 (정규화 전 — 유니코드 첨자 잔존 여부까지 검사 가능)
    // loc은 .fin 원문의 단락번호([NNNN])/표 번호/청구항 번호로 위치를 표기한다.
    const rawParas = [];
    if (inventionTitle) {
        const raw = finSerializeInline(inventionTitle).trim();
        if (raw) rawParas.push({ loc: '【발명의 명칭】', text: raw });
    }
    for (const p of doc.getElementsByTagName('p')) {
        const raw = finSerializeInline(p).trim(); // <tables> 내용은 제외(아래에서 표 단위로 수집)
        // 본문 인라인 <img> = 문자표에 없는 특수문자를 이미지로 저장한 것(추정).
        // 파서가 텍스트로 변환하지 못해 소실되므로 개수를 기록해 경고에 사용한다.
        const inlineImgs = p.getElementsByTagName('img').length;
        if (!raw && !inlineImgs) continue;
        const num = p.getAttribute('num') || '';
        const entry = { loc: num ? `[${num}]` : '', text: raw };
        if (inlineImgs) entry.inlineImgs = inlineImgs;
        rawParas.push(entry);
    }
    for (const t of doc.getElementsByTagName('tables')) {
        const cells = [];
        for (const e of t.getElementsByTagName('entry')) {
            const raw = finSerializeInline(e).trim();
            if (raw) cells.push(raw);
        }
        if (cells.length) {
            const num = t.getAttribute('num') || '';
            rawParas.push({ loc: num ? `[표 ${num}]` : '[표]', text: cells.join(' | ') });
        }
    }
    ir.rawParas = rawParas;

    // 청구항
    const claimsEl = first('claims');
    if (claimsEl) {
        for (const claim of claimsEl.getElementsByTagName('claim')) {
            const ct = claim.getElementsByTagName('claim-text')[0];
            const text = ct ? finCleanText(finSerializeInline(ct)) : '';
            const num = claim.getAttribute('num') || '';
            ir.claims.push({ num, text });
            const raw = ct ? finSerializeInline(ct).trim() : '';
            if (raw) rawParas.push({ loc: `【청구항 ${num}】`, text: raw });
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

/* ── .fin 패키지(원출원 + 보정) ───────────────────────────────────────────
 * .fin(zip)의 실제 구성
 *   xresult.inf   매니페스트(EUC-KR). [APPLICATION] APPNAME=<원출원 .hlz>,<출원일>,n
 *                                     [AMENDMENT]  AMDCNT=n / AMD00N=<보정 .dta>,<일자>,n
 *   *.hlz         원출원 명세서(zip → KEAPS XML + 도면 이미지)
 *   *.dta         보정 패치(zip → 보정 XML). 명세서 전문이 아니라 변경분만 담는다.
 *
 * 보정 패치는 <AmendBody elementName status attributeName attributeValue> 단위이며
 * status="A"는 해당 요소 전체 교체, "D"는 삭제다. 각 보정은 직전 상태를 기준으로 하므로
 * 제N차 보정명세서는 원본에 1차부터 N차까지 순서대로 적용한 결과다.
 *
 * 보정 파일은 파일명으로 식별할 수 없다(접두어 "(보정N)"이 없는 경우가 있고,
 * 원출원 .hlz와 확장자만 다른 같은 이름을 쓰기도 한다). 매니페스트의 파일명과
 * 등재 순서가 유일한 근거다.
 */

// 삭제 보정된 청구항의 표기 (KIPO 관행: 번호는 남기고 본문을 '삭제'로 둔다)
const FIN_DELETED_CLAIM_TEXT = '삭제';

/**
 * EUC-KR 바이트열을 문자열로 디코딩 (KEAPS .fin은 UTF-8 플래그 없이 EUC-KR로 저장)
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string}
 */
function finDecodeKorean(bytes) {
    const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
    for (const enc of ['euc-kr', 'utf-8']) {
        try { return new TextDecoder(enc).decode(u8); } catch (e) { /* 미지원 인코딩 → 다음 후보 */ }
    }
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
}

// JSZip 로드 (UTF-8 플래그가 없는 항목의 파일명을 EUC-KR로 해석)
function finLoadZip(data) {
    return JSZip.loadAsync(data, { decodeFileName: finDecodeKorean });
}

// 'YYYY-MM-DD' 형태만 통과시킨다 (매니페스트 값 검증)
function finNormalizeDate(s) {
    const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[0] : '';
}

/**
 * xresult.inf(매니페스트) 파싱
 * @param {string} text
 * @returns {{appFile:string, filingDate:string, amendments:Array<{seq:number,file:string,date:string}>}}
 */
function finParseManifest(text) {
    const out = { appFile: '', filingDate: '', amendments: [] };
    if (!text) return out;
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim();
        let m = line.match(/^APPNAME\s*=\s*(.+)$/i);
        if (m) {
            const parts = m[1].split(',');
            out.appFile = (parts[0] || '').trim();
            out.filingDate = finNormalizeDate(parts[1]);
            continue;
        }
        // AMD001=... (AMDCNT은 숫자가 아니므로 매칭되지 않는다)
        m = line.match(/^AMD(\d+)\s*=\s*(.+)$/i);
        if (m) {
            const parts = m[2].split(',');
            out.amendments.push({
                seq: parseInt(m[1], 10),
                file: (parts[0] || '').trim(),
                date: finNormalizeDate(parts[1])
            });
        }
    }
    out.amendments.sort((a, b) => a.seq - b.seq);
    return out;
}

/**
 * 'YYYY-MM-DD' → {year, month, day} (월과 일은 앞의 0을 떼어 국문 표기에 맞춘다)
 * @param {string} s
 * @returns {?{year:string, month:string, day:string}}
 */
function finSplitDate(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return { year: m[1], month: String(parseInt(m[2], 10)), day: String(parseInt(m[3], 10)) };
}

// XML 파싱 (parsererror 검사 포함)
function finParseXml(text, label) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
        throw new Error((label || '명세서 XML') + ' 파싱에 실패했습니다.');
    }
    return doc;
}

/**
 * 보정 XML → 보정 항목 배열
 * @param {Document} doc - 보정(.dta 내부) XML
 * @returns {Array<{elementName:string, attrName:string, attrValue:string, status:string, replacement:?Element}>}
 */
function finExtractAmendOps(doc) {
    const ops = [];
    for (const body of doc.getElementsByTagName('AmendBody')) {
        const elementName = body.getAttribute('elementName') || '';
        const attrValue = body.getAttribute('attributeValue') || '';
        if (!elementName || !attrValue) continue;
        let replacement = null;
        for (const child of body.childNodes) {
            if (child.nodeType === 1) { replacement = child; break; } // ELEMENT_NODE
        }
        ops.push({
            elementName,
            attrName: body.getAttribute('attributeName') || 'num',
            attrValue,
            status: (body.getAttribute('status') || 'A').toUpperCase(),
            replacement
        });
    }
    return ops;
}

// 문서에서 태그명 + 속성값으로 요소 찾기 (KEAPS의 num은 문서 내에서 유일하다)
function finFindElement(doc, tag, attrName, attrValue) {
    for (const el of doc.getElementsByTagName(tag)) {
        if (el.getAttribute(attrName) === attrValue) return el;
    }
    return null;
}

/**
 * 대상이 없는 교체 항목(신설)을 번호 순서에 맞는 위치에 삽입
 * @returns {boolean} 삽입 성공 여부
 */
function finInsertInOrder(doc, node, op) {
    const n = parseInt(op.attrValue, 10);
    if (isNaN(n)) return false;
    const sibs = [];
    for (const el of doc.getElementsByTagName(op.elementName)) {
        const v = parseInt(el.getAttribute(op.attrName), 10);
        if (!isNaN(v) && el.parentNode) sibs.push({ el, v });
    }
    if (!sibs.length) return false;
    const next = sibs.find(it => it.v > n);
    if (next) next.el.parentNode.insertBefore(node, next.el);
    else {
        const last = sibs[sibs.length - 1];
        last.el.parentNode.insertBefore(node, last.el.nextSibling);
    }
    return true;
}

/**
 * 보정 항목을 문서에 적용 (문서는 제자리에서 수정된다)
 * @param {Document} doc - 직전 상태의 명세서 XML
 * @param {Array<Object>} ops - finExtractAmendOps 결과
 * @returns {Object} 적용 통계
 */
function finApplyAmendOps(doc, ops) {
    const stat = { claimAmended: 0, claimDeleted: 0, claimAdded: 0, paraAmended: 0, otherAmended: 0, deleted: 0, unmatched: 0 };
    for (const op of ops) {
        const target = finFindElement(doc, op.elementName, op.attrName, op.attrValue);
        const isClaim = op.elementName === 'claim';

        if (op.status === 'D') {
            if (!target) { stat.unmatched++; continue; }
            if (isClaim) {
                // 청구항은 번호를 남기고 본문만 '삭제'로 바꾼다 (뒤 청구항을 재번호하지 않는다)
                while (target.firstChild) target.removeChild(target.firstChild);
                const ct = doc.createElement('claim-text');
                ct.appendChild(doc.createTextNode(FIN_DELETED_CLAIM_TEXT));
                target.appendChild(ct);
                stat.claimDeleted++;
            } else {
                target.parentNode.removeChild(target);
                stat.deleted++;
            }
            continue;
        }

        // 그 외(관측된 값은 'A')는 요소 전체 교체. 보정 XML에는 기본 네임스페이스가 없지만
        // 파서가 태그명(qualified name)과 localName으로만 읽으므로 그대로 가져와도 무방하다.
        if (!op.replacement) { stat.unmatched++; continue; }
        const imported = doc.importNode(op.replacement, true);
        if (target) {
            target.parentNode.replaceChild(imported, target);
            if (isClaim) stat.claimAmended++;
            else if (op.elementName === 'p') stat.paraAmended++;
            else stat.otherAmended++;
        } else if (finInsertInOrder(doc, imported, op)) {
            if (isClaim) stat.claimAdded++;
            else if (op.elementName === 'p') stat.paraAmended++;
            else stat.otherAmended++;
        } else {
            stat.unmatched++;
        }
    }
    return stat;
}

/**
 * 보정 통계 → 사람이 읽는 요약 문구
 * @param {?Object} stat - finApplyAmendOps 결과
 * @returns {string}
 */
function finAmendSummary(stat) {
    if (!stat) return '';
    const parts = [];
    if (stat.claimAmended) parts.push(`청구항 ${stat.claimAmended}건 수정`);
    if (stat.claimDeleted) parts.push(`청구항 ${stat.claimDeleted}건 삭제`);
    if (stat.claimAdded) parts.push(`청구항 ${stat.claimAdded}건 신설`);
    if (stat.paraAmended) parts.push(`본문 ${stat.paraAmended}건 수정`);
    if (stat.otherAmended) parts.push(`기타 ${stat.otherAmended}건 수정`);
    if (stat.deleted) parts.push(`${stat.deleted}건 삭제`);
    if (stat.unmatched) parts.push(`${stat.unmatched}건 미적용`);
    if (!parts.length) return '변경 없음';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' 및 ' + parts[parts.length - 1];
}

// zip 엔트리 목록을 {파일명(경로 제외) → 엔트리}로 수집
function finZipFiles(zip) {
    const files = {};
    zip.forEach((path, entry) => {
        if (entry.dir) return;
        files[path.split('/').pop()] = entry;
    });
    return files;
}

/**
 * IR의 도면 및 본문 인라인 이미지 base64 로드
 * @param {Object} ir
 * @param {Object} imageEntries - 파일명 → zip 엔트리
 * @param {Map} cache - 엔트리 → base64 Promise (차수별 IR이 같은 이미지를 공유)
 */
async function finLoadIrImages(ir, imageEntries, cache) {
    const read = (entry) => {
        if (!entry) return Promise.resolve(null);
        if (!cache.has(entry)) cache.set(entry, entry.async('base64'));
        return cache.get(entry);
    };
    const pick = (f) => imageEntries[f] || imageEntries[String(f || '').split('/').pop()];

    await Promise.all(ir.drawings.map(async d => { d.base64 = await read(pick(d.file)); }));

    // 본문 인라인 이미지 마커(data-finimg)는 rawParas(제목/단락/표/청구항 원문)에 모두 나타난다.
    ir.inlineImages = {};
    const inlineFiles = new Set();
    const markerRe = /<img\b[^>]*data-finimg="([^"]+)"[^>]*>/gi;
    for (const p of (ir.rawParas || [])) {
        let m;
        markerRe.lastIndex = 0;
        while ((m = markerRe.exec(p.text || '')) !== null) inlineFiles.add(m[1]);
    }
    await Promise.all([...inlineFiles].map(async f => {
        const b64 = await read(pick(f));
        if (b64) ir.inlineImages[f] = { base64: b64 };
    }));
}

/**
 * .fin 파일을 패키지 단위로 파싱 (출원명세서 + 각 차수 보정명세서)
 * @param {File} file - .fin 파일
 * @returns {Promise<{docs:Array<Object>, meta:Object, warnings:Array<string>}>}
 *          docs[0] = 출원명세서, docs[N] = 제N차 보정명세서
 */
async function parseFinPackage(file) {
    const outerZip = await finLoadZip(await file.arrayBuffer());
    const outerFiles = finZipFiles(outerZip);
    const warnings = [];

    // 매니페스트 (없는 패키지도 있으므로 선택적)
    let infEntry = null;
    for (const name of Object.keys(outerFiles)) {
        if (/^xresult\.inf$/i.test(name)) { infEntry = outerFiles[name]; break; }
    }
    const manifest = infEntry
        ? finParseManifest(finDecodeKorean(await infEntry.async('uint8array')))
        : { appFile: '', filingDate: '', amendments: [] };

    // 원출원 명세서(.hlz) — 매니페스트가 지정한 파일명을 우선 사용
    let hlzEntry = manifest.appFile ? outerFiles[manifest.appFile] : null;
    if (!hlzEntry) {
        for (const name of Object.keys(outerFiles)) {
            if (/\.hlz$/i.test(name)) { hlzEntry = outerFiles[name]; break; }
        }
    }
    if (!hlzEntry) throw new Error('.fin 내부에서 .hlz 파일을 찾을 수 없습니다. 올바른 KIPO 전자출원 파일인지 확인해주세요.');

    const hlzZip = await finLoadZip(await hlzEntry.async('arraybuffer'));
    let xmlEntry = null;
    const baseImages = {};
    hlzZip.forEach((path, entry) => {
        if (entry.dir) return;
        const base = path.split('/').pop();
        if (/\.xml$/i.test(base)) { if (!xmlEntry) xmlEntry = entry; }
        else if (/\.(jpe?g|png|gif|bmp|tif|tiff)$/i.test(base)) baseImages[base] = entry;
    });
    if (!xmlEntry) throw new Error('.hlz 내부에서 명세서 XML을 찾을 수 없습니다.');

    const baseDoc = finParseXml(await xmlEntry.async('string'));

    // 보정 목록은 매니페스트가 근거. 매니페스트가 없는 패키지에 한해 .dta를 zip 순서대로 사용한다.
    let amendRefs = manifest.amendments;
    if (!infEntry) {
        amendRefs = Object.keys(outerFiles)
            .filter(n => /\.dta$/i.test(n))
            .map((n, i) => ({ seq: i + 1, file: n, date: '' }));
        if (amendRefs.length) warnings.push('xresult.inf가 없어 보정 순서를 파일 순서로 추정했습니다.');
    }

    // 상태 스냅샷: 원본 → 1차 적용본 → 2차 적용본 …
    const states = [{ kind: 'application', seq: 0, label: '출원명세서', date: manifest.filingDate, doc: baseDoc, images: baseImages, stat: null }];
    let curImages = baseImages;
    for (const ref of amendRefs) {
        const entry = outerFiles[ref.file];
        if (!entry) { warnings.push(`보정 파일 ${ref.file}을(를) .fin 내부에서 찾을 수 없습니다.`); continue; }
        const dtaZip = await finLoadZip(await entry.async('arraybuffer'));
        let amdXmlEntry = null;
        const amdImages = {};
        dtaZip.forEach((path, e) => {
            if (e.dir) return;
            const base = path.split('/').pop();
            if (/\.xml$/i.test(base)) { if (!amdXmlEntry) amdXmlEntry = e; }
            else if (/\.(jpe?g|png|gif|bmp|tif|tiff)$/i.test(base)) amdImages[base] = e;
        });
        if (!amdXmlEntry) { warnings.push(`보정 파일 ${ref.file} 내부에서 보정 XML을 찾을 수 없습니다.`); continue; }

        const ops = finExtractAmendOps(finParseXml(await amdXmlEntry.async('string'), '보정서 XML'));
        const prev = states[states.length - 1];
        const nextDoc = prev.doc.cloneNode(true); // 직전 상태를 복제해 누적 적용 (차수별 스냅샷 유지)
        const stat = finApplyAmendOps(nextDoc, ops);
        const seq = states.length;
        if (stat.unmatched) warnings.push(`제${seq}차 보정 중 ${stat.unmatched}건은 대상을 찾지 못해 적용되지 않았습니다.`);
        curImages = Object.assign({}, curImages, amdImages); // 보정된 도면이 있으면 덮어쓴다
        states.push({ kind: 'amendment', seq, label: `제${seq}차 보정명세서`, date: ref.date, doc: nextDoc, images: curImages, stat });
    }

    // 각 상태를 IR로 변환 (이미지 base64는 상태 간 캐시 공유)
    const cache = new Map();
    const docs = [];
    for (const st of states) {
        const ir = finXmlToIr(st.doc);
        await finLoadIrImages(ir, st.images, cache);
        const kipo = st.doc.getElementsByTagName('KIPO')[0];
        const caf = st.doc.getElementsByTagName('PatentCAFDOC')[0];
        ir.meta = {
            fileName: file.name,
            keapsVersion: kipo ? (kipo.getAttribute('keapsVersion') || '') : '',
            editorKind: kipo ? (kipo.getAttribute('editorKind') || '') : '',
            pageCount: kipo ? (kipo.getAttribute('pageCount') || '') : '',
            docId: caf ? (caf.getAttribute('documentID') || '') : '',
            filingDate: manifest.filingDate,
            amendCount: states.length - 1,
            docKind: st.kind,
            amendSeq: st.seq,
            docLabel: st.label,
            amendDate: st.date
        };
        docs.push({ kind: st.kind, seq: st.seq, label: st.label, date: st.date, stat: st.stat, ir });
    }

    return {
        docs,
        meta: { fileName: file.name, filingDate: manifest.filingDate, amendCount: docs.length - 1 },
        warnings
    };
}

/**
 * .fin 파일을 파싱하여 IR 하나를 반환 (보정이 있으면 최신 보정명세서)
 * @param {File} file - .fin 파일
 * @returns {Promise<Object>} IR
 */
async function parseFinFile(file) {
    const pkg = await parseFinPackage(file);
    return pkg.docs[pkg.docs.length - 1].ir;
}
