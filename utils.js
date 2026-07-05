/**
 * Document Tools - utils.js
 * 공통 유틸리티 함수 모음
 * Version: 1.1.0
 * Last Updated: 2026-07-05
 * 
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 * 이 소프트웨어는 저작권법의 보호를 받습니다.
 * 무단 복제, 배포, 수정을 금지합니다.
 */

// ============================================
// 텍스트 이스케이프 함수
// ============================================

/**
 * HTML 특수문자 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * XML 특수문자 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeXml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============================================
// 숫자 포맷팅 함수
// ============================================

/**
 * 숫자를 지정된 형식으로 변환
 * @param {number} num - 변환할 숫자
 * @param {string} fmt - 형식 ('decimal', 'decimalZero', 'upperRoman', 'lowerRoman', 'upperLetter', 'lowerLetter')
 * @returns {string} 변환된 문자열
 */
function formatNumber(num, fmt) {
    switch (fmt) {
        case 'decimal': return String(num);
        case 'decimalZero': return String(num).padStart(2, '0');
        case 'upperRoman': return toRoman(num).toUpperCase();
        case 'lowerRoman': return toRoman(num).toLowerCase();
        case 'upperLetter': return String.fromCharCode(64 + ((num - 1) % 26) + 1);
        case 'lowerLetter': return String.fromCharCode(96 + ((num - 1) % 26) + 1);
        default: return String(num);
    }
}

/**
 * 숫자를 로마 숫자로 변환
 * @param {number} num - 변환할 숫자
 * @returns {string} 로마 숫자
 */
function toRoman(num) {
    const lookup = { M:1000, CM:900, D:500, CD:400, C:100, XC:90, L:50, XL:40, X:10, IX:9, V:5, IV:4, I:1 };
    let roman = '';
    for (let i in lookup) {
        while (num >= lookup[i]) { roman += i; num -= lookup[i]; }
    }
    return roman;
}

// ============================================
// Diff 알고리즘 함수
// ============================================

/**
 * 공백을 보존하는 단어 토크나이즈 (공백은 앞 단어에 붙임)
 * @param {string} text - 토크나이즈할 텍스트
 * @returns {Array<{word: string, space: string}>} 토큰 배열
 */
function tokenizeWords(text) {
    const tokens = [];
    const regex = /(\S+)(\s*)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        tokens.push({ word: match[1], space: match[2] || '' });
    }
    return tokens;
}

/**
 * LCS(Longest Common Subsequence) DP 테이블 계산
 * @param {Array} a - 첫 번째 배열
 * @param {Array} b - 두 번째 배열
 * @returns {Array} DP 테이블
 */
function computeLCS(a, b) {
    const m = a.length, n = b.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i-1] === b[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }
    return dp;
}

/**
 * 두 텍스트의 유사도 계산 (0~1)
 * @param {string} textA - 첫 번째 텍스트
 * @param {string} textB - 두 번째 텍스트
 * @returns {number} 유사도 (0~1)
 */
function calculateSimilarity(textA, textB) {
    if (!textA || !textB) return 0;
    
    const normA = textA.toLowerCase().trim();
    const normB = textB.toLowerCase().trim();
    
    // 완전 일치
    if (normA === normB) return 1;
    
    // 부분 문자열 포함 관계 체크
    if (normA.includes(normB) || normB.includes(normA)) {
        const shorter = normA.length < normB.length ? normA : normB;
        const longer = normA.length < normB.length ? normB : normA;
        return 0.5 + (shorter.length / longer.length) * 0.5;
    }
    
    // 단어 기반 Jaccard 유사도
    const wordsA = new Set(normA.split(/\s+/).filter(w => w.length > 0));
    const wordsB = new Set(normB.split(/\s+/).filter(w => w.length > 0));
    
    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    
    let intersection = 0;
    wordsA.forEach(w => { if (wordsB.has(w)) intersection++; });
    const union = wordsA.size + wordsB.size - intersection;
    const jaccardSim = intersection / union;
    
    // 공통 단어 비율 (작은 집합 기준)
    const smallerSize = Math.min(wordsA.size, wordsB.size);
    const overlapRatio = intersection / smallerSize;
    
    return Math.max(jaccardSim, overlapRatio * 0.8);
}

/**
 * 단어 단위 diff 계산 (텍스트 비교용 - textA/textB/spaceA/spaceB 속성 반환)
 * 공통 접두사/접미사를 LCS 계산 전에 제거하여 긴 단락도 처리 가능
 * @param {string} textA - 원본 텍스트
 * @param {string} textB - 비교 텍스트
 * @returns {Array|null} diff 배열 또는 null
 */
function getWordDiff(textA, textB) {
    try {
        const tokensA = tokenizeWords(textA);
        const tokensB = tokenizeWords(textB);

        const sameItem = (tA, tB) => ({
            type: 'same',
            textA: tA.word, spaceA: tA.space,
            textB: tB.word, spaceB: tB.space
        });

        // 공통 접두사 길이 계산
        const minLen = Math.min(tokensA.length, tokensB.length);
        let prefixLen = 0;
        while (prefixLen < minLen && tokensA[prefixLen].word === tokensB[prefixLen].word) {
            prefixLen++;
        }

        // 공통 접미사 길이 계산 (접두사와 겹치지 않는 범위)
        let suffixLen = 0;
        while (suffixLen < minLen - prefixLen &&
               tokensA[tokensA.length - 1 - suffixLen].word === tokensB[tokensB.length - 1 - suffixLen].word) {
            suffixLen++;
        }

        const midA = tokensA.slice(prefixLen, tokensA.length - suffixLen);
        const midB = tokensB.slice(prefixLen, tokensB.length - suffixLen);

        // DP 테이블 크기 안전장치 (변경 구간 기준 약 1000x1000 단어까지 허용)
        if (midA.length * midB.length > 1000000) {
            return null;
        }

        const dp = computeLCS(midA.map(t => t.word), midB.map(t => t.word));
        const middle = [];
        let i = midA.length, j = midB.length;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && midA[i-1].word === midB[j-1].word) {
                middle.unshift(sameItem(midA[i-1], midB[j-1]));
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
                middle.unshift({ type: 'added', textA: '', spaceA: '', textB: midB[j-1].word, spaceB: midB[j-1].space });
                j--;
            } else if (i > 0) {
                middle.unshift({ type: 'deleted', textA: midA[i-1].word, spaceA: midA[i-1].space, textB: '', spaceB: '' });
                i--;
            }
        }

        const result = [];
        for (let k = 0; k < prefixLen; k++) {
            result.push(sameItem(tokensA[k], tokensB[k]));
        }
        result.push(...middle);
        for (let k = suffixLen; k > 0; k--) {
            result.push(sameItem(tokensA[tokensA.length - k], tokensB[tokensB.length - k]));
        }

        return result;
    } catch (e) {
        console.error('getWordDiff error:', e);
        return null;
    }
}

/**
 * 단어 단위 diff 계산 (DOCX 비교용 - word/space 속성 반환)
 * getWordDiff를 재사용하므로 공통 접두사/접미사 최적화와 크기 안전장치가 함께 적용됨
 * @param {string} textA - 원본 텍스트
 * @param {string} textB - 비교 텍스트
 * @returns {Array} diff 배열
 */
function getWordDiffForDocx(textA, textB) {
    const diff = getWordDiff(textA, textB);
    if (diff) {
        return diff.map(d => d.type === 'deleted'
            ? { type: 'deleted', word: d.textA, space: '' }
            : { type: d.type, word: d.textB, space: d.spaceB });
    }
    // 크기 안전장치 초과(또는 오류) 시 전체 삭제 + 전체 추가로 폴백
    return [
        ...tokenizeWords(textA).map(t => ({ type: 'deleted', word: t.word, space: '' })),
        ...tokenizeWords(textB).map(t => ({ type: 'added', word: t.word, space: t.space }))
    ];
}

/**
 * 수정된 라인에 하이라이트 적용 (삭제/추가 단어 표시)
 * @param {string} textA - 원본 텍스트
 * @param {string} textB - 비교 텍스트
 * @returns {Object} { htmlA, htmlB } 하이라이트된 HTML
 */
function highlightModifiedLine(textA, textB) {
    // 인라인 스타일 정의
    const deletedStyle = 'background:#ffcccc;color:#721c24;padding:1px 3px;border-radius:3px;text-decoration:line-through;';
    const addedStyle = 'background:#ccffcc;color:#155724;padding:1px 3px;border-radius:3px;text-decoration:underline;font-weight:600;';
    
    // 빈 텍스트 처리
    if (!textA && !textB) return { htmlA: '', htmlB: '' };
    if (!textA) return { htmlA: '', htmlB: escapeHtml(textB) };
    if (!textB) return { htmlA: escapeHtml(textA), htmlB: '' };
    
    // 텍스트가 동일하면 그대로 반환
    if (textA === textB) {
        return { htmlA: escapeHtml(textA), htmlB: escapeHtml(textB) };
    }
    
    try {
        const wordDiff = getWordDiff(textA, textB);
        
        // wordDiff가 null이면 전체 텍스트를 하이라이트
        if (!wordDiff || wordDiff.length === 0) {
            return { 
                htmlA: `<span style="${deletedStyle}">${escapeHtml(textA)}</span>`, 
                htmlB: `<span style="${addedStyle}">${escapeHtml(textB)}</span>` 
            };
        }
        
        // A와 B의 결과를 각각 배열로 구성 (원본 공백 보존)
        let partsA = [];
        let partsB = [];

        wordDiff.forEach(d => {
            if (d.type === 'same') {
                partsA.push(escapeHtml(d.textA) + (d.spaceA || ' '));
                partsB.push(escapeHtml(d.textB) + (d.spaceB || ' '));
            } else if (d.type === 'deleted') {
                partsA.push(`<span style="${deletedStyle}">${escapeHtml(d.textA)}</span>` + (d.spaceA || ' '));
            } else if (d.type === 'added') {
                partsB.push(`<span style="${addedStyle}">${escapeHtml(d.textB)}</span>` + (d.spaceB || ' '));
            }
        });

        // 배열을 연결하여 최종 HTML 생성 (뒤쪽 공백 정리)
        const htmlAResult = partsA.join('').replace(/\s+$/, '');
        const htmlBResult = partsB.join('').replace(/\s+$/, '');

        return { htmlA: htmlAResult, htmlB: htmlBResult };
    } catch (e) {
        console.error('highlightModifiedLine error:', e);
        return { htmlA: escapeHtml(textA), htmlB: escapeHtml(textB) };
    }
}

// ============================================
// 특허 문서 판별 함수
// ============================================

/**
 * 정확히 일치하는 특허 명세서 표준 섹션 부제목 목록
 */
const PATENT_SECTION_TITLES = [
    'CROSS-REFERENCE TO RELATED APPLICATIONS',
    'BACKGROUND OF THE INVENTION',
    'BACKGROUND',
    'SUMMARY OF THE INVENTION',
    'SUMMARY',
    'BRIEF DESCRIPTION OF THE DRAWINGS',
    'DETAILED DESCRIPTION OF THE EMBODIMENTS',
    'DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENTS',
    'DETAILED DESCRIPTION',
    'DESCRIPTION OF SYMBOLS',
    '<DESCRIPTION OF SYMBOLS>',
    'WHAT IS CLAIMED IS:',
    'WHAT IS CLAIMED IS',
    'TITLE OF THE INVENTION',
    'ABSTRACT OF DISCLOSURE',
    'ABSTRACT'
];

/**
 * 청구항 섹션 시작 라인 판별
 * @param {string} line - 검사할 라인
 * @returns {boolean}
 */
function isClaimsStartLine(line) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (upper === 'WHAT IS CLAIMED IS:' || upper === 'WHAT IS CLAIMED IS') return true;
    if (trimmed === '【CLAIMS】' || trimmed === '【청구의 범위】' || trimmed === '【청구범위】') return true;
    return false;
}

/**
 * CROSS-REFERENCE 섹션 제목 라인 판별
 * @param {string} line - 검사할 라인
 * @returns {boolean}
 */
function isCrossRefLine(line) {
    const t = line.trim().toUpperCase();
    return t === 'CROSS-REFERENCE TO RELATED APPLICATIONS' ||
           t === 'CROSS-REFERENCE TO RELATED APPLICATION' ||
           t === 'CROSS REFERENCE TO RELATED APPLICATIONS' ||
           t === 'CROSS REFERENCE TO RELATED APPLICATION';
}

/**
 * 특허 명세서 부제목 판별 (단락번호 부여/단락 개수 계산 기준)
 * @param {string} line - 검사할 라인
 * @returns {boolean}
 */
function isPatentSectionSubtitle(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // 정확히 일치하는 부제목들
    if (PATENT_SECTION_TITLES.some(s => trimmed.toUpperCase() === s.toUpperCase())) return true;

    // 【】로 묶인 부제 패턴 (PCT형식 포함)
    if (/^【[^】]+】$/.test(trimmed)) return true;

    // <Description of Symbols> 형식 체크
    if (/^<?\s*Description\s+of\s+Symbols\s*>?$/i.test(trimmed)) return true;

    // 표 타이틀 패턴: 【표 1】, [표 1], 【Table 1】, [Table 1] 등
    if (/^[【\[]표\s*\d+[】\]]$/i.test(trimmed)) return true;
    if (/^[【\[]Table\s*\d+[】\]]$/i.test(trimmed)) return true;

    // 수학식/화학식/반응식/분자식 등 타이틀 패턴
    if (/^[【\[](수학식|화학식|반응식|분자식)\s*\d*[】\]]$/.test(trimmed)) return true;
    if (/^[【\[](Mathematical|Chemical|Reaction|Molecular)\s*(Formula)?\s*\d*[】\]]$/i.test(trimmed)) return true;

    // 실시예, 실험예 등을 포함하면서 마침표 없이 끝나는 경우
    if (/^(실시예|실험예|비교예|참고예|제조예|Example|Comparative\s*Example|Reference\s*Example)/i.test(trimmed) && !trimmed.includes('.')) return true;

    // (a), (b), (c) 등으로 시작하는 부제목
    if (/^\([a-zA-Z]\)\s+/.test(trimmed)) return true;

    // 1., 2., 3. 등 숫자로 시작하는 부제목 (숫자. 텍스트 형식)
    if (/^\d+\.\s+[A-Z]/.test(trimmed)) return true;

    // 전체가 대문자인 짧은 제목 (단어 수 6개 이하)
    const words = trimmed.split(/\s+/);
    if (words.length <= 6 && /^[A-Z\s]+$/.test(trimmed) && trimmed.length > 3) return true;

    return false;
}

/**
 * 일반 부제목 휴리스틱 판별 (괄호 묶음/대문자 제목 기준)
 * @param {string} line - 검사할 라인
 * @param {Object} [options] - 추가 판별 옵션
 * @param {boolean} [options.checkSymbols] - 'Description of Symbols' 형식도 부제목으로 판별
 * @param {boolean} [options.checkNumberedHeading] - '1. Field' 형식의 번호 헤딩도 부제목으로 판별
 * @returns {boolean}
 */
function isGenericSubtitle(line, options = {}) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // 【】로 묶인 타이틀
    if (/^【[^】]+】$/.test(trimmed)) return true;

    // [] 로 묶인 타이틀
    if (/^\[[^\]]+\]$/.test(trimmed) && trimmed.length <= 30) return true;

    // 영어 대문자로만 이루어진 부제목
    const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
    const lowerCount = (trimmed.match(/[a-z]/g) || []).length;
    if (upperCount >= 2 && lowerCount === 0 && /^[A-Z0-9\s\-:\/,]+$/.test(trimmed)) return true;

    // Description of Symbols
    if (options.checkSymbols && /^<?\s*Description\s+of\s+Symbols\s*>?$/i.test(trimmed)) return true;

    // 1. Field 등 번호 헤딩 (마침표로 끝나지 않는 짧은 제목)
    if (options.checkNumberedHeading && /^\d+\.\s+[A-Z]/.test(trimmed) && trimmed.length <= 60 && !/\.$/.test(trimmed)) return true;

    return false;
}

// ============================================
// DOCX 파싱 함수
// ============================================

/**
 * DOCX 파일에서 word/document.xml을 파싱
 * @param {File} file - 업로드된 .docx 파일
 * @returns {Promise<{zip: Object, xml: string, doc: Document}>}
 */
async function loadDocxDocument(file) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return { zip, xml, doc };
}

/**
 * DOCX의 word/numbering.xml에서 번호 매김 정의 파싱
 * @param {Object} zip - JSZip 인스턴스
 * @returns {Promise<Object>} numId → ilvl → { numFmt, lvlText, start, counter } 매핑
 */
async function parseDocxNumbering(zip) {
    const numberingDefs = {};
    const numberingFile = zip.file('word/numbering.xml');
    if (!numberingFile) return numberingDefs;

    const numXml = await numberingFile.async('string');
    const numDoc = new DOMParser().parseFromString(numXml, 'application/xml');

    // abstractNum 정의 파싱
    const abstractNumDefs = {};
    for (const absNum of numDoc.getElementsByTagName('w:abstractNum')) {
        const absNumId = absNum.getAttribute('w:abstractNumId');
        const levels = {};
        for (const lvl of absNum.getElementsByTagName('w:lvl')) {
            const ilvl = lvl.getAttribute('w:ilvl');
            const numFmt = lvl.getElementsByTagName('w:numFmt')[0]?.getAttribute('w:val') || 'decimal';
            const lvlText = lvl.getElementsByTagName('w:lvlText')[0]?.getAttribute('w:val') || '%1.';
            const start = parseInt(lvl.getElementsByTagName('w:start')[0]?.getAttribute('w:val') || '1');
            levels[ilvl] = { numFmt, lvlText, start };
        }
        abstractNumDefs[absNumId] = levels;
    }

    // num -> abstractNum 매핑 (counter는 start로 초기화)
    for (const num of numDoc.getElementsByTagName('w:num')) {
        const numId = num.getAttribute('w:numId');
        const absNumIdRef = num.getElementsByTagName('w:abstractNumId')[0]?.getAttribute('w:val');
        if (absNumIdRef && abstractNumDefs[absNumIdRef]) {
            numberingDefs[numId] = {};
            for (const ilvl in abstractNumDefs[absNumIdRef]) {
                numberingDefs[numId][ilvl] = { ...abstractNumDefs[absNumIdRef][ilvl], counter: abstractNumDefs[absNumIdRef][ilvl].start };
            }
        }
    }
    return numberingDefs;
}

/**
 * 단락(w:p)에서 텍스트 추출 - 첨자는 <sub>/<sup> 태그로 변환
 * @param {Element} p - w:p 요소
 * @param {{sub: number, sup: number}} [countScripts] - 첨자 개수 집계 객체 (선택)
 * @returns {string}
 */
function extractDocxParagraphText(p, countScripts) {
    let text = '';
    for (const r of p.getElementsByTagName('w:r')) {
        let t = '';
        for (const x of r.getElementsByTagName('w:t')) t += x.textContent || '';
        if (!t) continue;
        const rPr = r.getElementsByTagName('w:rPr')[0];
        const va = rPr?.getElementsByTagName('w:vertAlign')[0]?.getAttribute('w:val');
        if (va === 'subscript') { text += `<sub>${t}</sub>`; if (countScripts) countScripts.sub++; }
        else if (va === 'superscript') { text += `<sup>${t}</sup>`; if (countScripts) countScripts.sup++; }
        else text += t;
    }
    return text;
}

/**
 * 단락(w:p)에서 서식 없이 순수 텍스트만 추출
 * @param {Element} p - w:p 요소
 * @returns {string}
 */
function extractDocxPlainText(p) {
    let text = '';
    for (const r of p.getElementsByTagName('w:r')) {
        for (const t of r.getElementsByTagName('w:t')) {
            text += t.textContent || '';
        }
    }
    return text;
}

/**
 * 표(w:tbl)를 HTML <table>로 변환 (셀 병합 처리 포함)
 * @param {Element} tbl - w:tbl 요소
 * @param {{sub: number, sup: number}} [countScripts] - 첨자 개수 집계 객체 (선택)
 * @returns {string}
 */
function convertDocxTableToHtml(tbl, countScripts) {
    let html = '<table border="1">';
    for (const tr of tbl.getElementsByTagName('w:tr')) {
        html += '<tr>';
        for (const tc of tr.getElementsByTagName('w:tc')) {
            // 셀 병합 처리
            const tcPr = tc.getElementsByTagName('w:tcPr')[0];
            const gridSpan = tcPr?.getElementsByTagName('w:gridSpan')[0]?.getAttribute('w:val');
            const vMerge = tcPr?.getElementsByTagName('w:vMerge')[0];

            // vMerge가 있고 val이 없으면 병합된 셀 (continue)
            if (vMerge && !vMerge.getAttribute('w:val')) {
                continue;
            }

            let colspan = gridSpan ? ` colspan="${gridSpan}"` : '';

            // 셀 내용 추출
            let cellContent = '';
            for (const p of tc.getElementsByTagName('w:p')) {
                const pText = extractDocxParagraphText(p, countScripts);
                if (cellContent && pText) cellContent += '<br>';
                cellContent += pText;
            }
            html += `<td${colspan}>${cellContent}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    return html;
}

/**
 * 문서 body의 단락/표를 순서대로 텍스트로 변환
 * @param {Document} doc - 파싱된 word/document.xml
 * @param {Object} [options]
 * @param {boolean} [options.skipEmptyParagraphs] - 빈 단락 제외 여부
 * @param {{sub: number, sup: number}} [options.countScripts] - 첨자 개수 집계 객체
 * @returns {string}
 */
function extractDocxBodyText(doc, options = {}) {
    const { skipEmptyParagraphs = false, countScripts = null } = options;
    const results = [];
    const body = doc.getElementsByTagName('w:body')[0];
    if (!body) return '';

    // body의 직접 자식만 순회 (표 내부 단락 중복 방지)
    for (const child of body.childNodes) {
        if (child.nodeName === 'w:p') {
            const text = extractDocxParagraphText(child, countScripts);
            if (!skipEmptyParagraphs || text.trim()) {
                results.push(text);
            }
        } else if (child.nodeName === 'w:tbl') {
            results.push(convertDocxTableToHtml(child, countScripts));
        }
    }
    return results.join('\n');
}

// ============================================
// UI 헬퍼 함수
// ============================================

/**
 * 메시지 표시
 * @param {HTMLElement} el - 메시지를 표시할 요소
 * @param {string} msg - 메시지 내용
 * @param {string} type - 메시지 타입 ('success', 'error', 'info')
 */
function showMessage(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = `message ${type}`;
    el.classList.remove('hidden');
}

/**
 * 클립보드에 텍스트 복사
 * @param {string} text - 복사할 텍스트
 * @param {HTMLElement} msgEl - 메시지 표시 요소 (선택)
 */
function copyToClipboard(text, msgEl) {
    navigator.clipboard.writeText(text).then(() => {
        if (msgEl) {
            showMessage(msgEl, '✅ 클립보드에 복사되었습니다.', 'success');
        }
    }).catch(err => {
        console.error('복사 실패:', err);
        if (msgEl) {
            showMessage(msgEl, '❌ 복사에 실패했습니다.', 'error');
        }
    });
}
