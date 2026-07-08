/**
 * Document Tools - utils.js
 * 공통 유틸리티 함수 모음
 * Version: 1.4.0
 * Last Updated: 2026-07-08
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
    // 하이라이트 클래스는 styles.css의 .diff-word-deleted / .diff-word-added 참조

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
                htmlA: `<span class="diff-word-deleted">${escapeHtml(textA)}</span>`,
                htmlB: `<span class="diff-word-added">${escapeHtml(textB)}</span>`
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
                partsA.push(`<span class="diff-word-deleted">${escapeHtml(d.textA)}</span>` + (d.spaceA || ' '));
            } else if (d.type === 'added') {
                partsB.push(`<span class="diff-word-added">${escapeHtml(d.textB)}</span>` + (d.spaceB || ' '));
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
// DOCX 생성 헬퍼
// ============================================

/**
 * 기본 word/styles.xml 생성 (단락 뒤 간격 0pt로 통일)
 * @param {Object} [options]
 * @param {number} [options.fontSize] - 기본 글꼴 크기 (half-point 단위, 예: 24 = 12pt). 생략 시 크기 미지정
 * @returns {string} styles.xml 문자열
 */
function makeDocxStylesXml(options = {}) {
    const { fontSize = null } = options;
    const rPr = fontSize ? `
<w:rPr><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal"/>
<w:pPr><w:spacing w:after="0"/></w:pPr>${rPr}
</w:style>
</w:styles>`;
}

// ============================================
// Markdown → DOCX 변환용 순수 헬퍼 (탭5)
// ============================================

/**
 * CSS 색상 문자열을 DOCX용 6자리 16진수(RRGGBB)로 변환
 * @param {string} str - '#rgb', '#rrggbb', 'rgb(r,g,b)' 등
 * @returns {string|null} 대문자 6자리 HEX 또는 변환 실패 시 null
 */
function cssColorToDocxHex(str) {
    if (!str || typeof str !== 'string') return null;
    let s = str.trim().toLowerCase();
    if (s === '' || s === 'transparent' || s === 'inherit' || s === 'initial' || s === 'currentcolor') return null;

    // #rgb / #rrggbb
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
        let hex = m[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        return hex.toUpperCase();
    }
    // rgb() / rgba()
    m = s.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})/);
    if (m) {
        const toHex = n => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, '0');
        return (toHex(m[1]) + toHex(m[2]) + toHex(m[3])).toUpperCase();
    }
    return null;
}

/**
 * 픽셀 길이를 EMU(English Metric Unit)로 변환 (1px @96dpi = 9525 EMU)
 * @param {number} px
 * @returns {number} 정수 EMU (최소 1)
 */
function pxToEmu(px) {
    const v = Math.round((Number(px) || 0) * 9525);
    return v > 0 ? v : 1;
}

/**
 * 런 서식(fmt) 객체를 DOCX <w:rPr> XML 문자열로 변환 (DOM 비의존, 순수 함수)
 * @param {Object} fmt - { bold, italic, underline, strike, code, color, bg, highlight, sz, vertAlign }
 *   color/bg 는 6자리 HEX, sz 는 half-point 정수, vertAlign 은 'superscript'|'subscript'
 * @returns {string} <w:rPr>...</w:rPr> 또는 빈 문자열
 */
function mdDocxRunProps(fmt) {
    if (!fmt) return '';
    let p = '';
    if (fmt.code) p += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>';
    if (fmt.bold) p += '<w:b/><w:bCs/>';
    if (fmt.italic) p += '<w:i/><w:iCs/>';
    if (fmt.strike) p += '<w:strike/>';
    if (fmt.color) p += `<w:color w:val="${fmt.color}"/>`;
    if (fmt.sz) p += `<w:sz w:val="${fmt.sz}"/><w:szCs w:val="${fmt.sz}"/>`;
    if (fmt.underline) p += '<w:u w:val="single"/>';
    if (fmt.bg) p += `<w:shd w:val="clear" w:color="auto" w:fill="${fmt.bg}"/>`;
    if (fmt.highlight) p += `<w:highlight w:val="${fmt.highlight}"/>`;
    if (fmt.vertAlign) p += `<w:vertAlign w:val="${fmt.vertAlign}"/>`;
    return p ? `<w:rPr>${p}</w:rPr>` : '';
}

// A4 크기(twips): 1mm ≈ 56.6929 twip
const MD_A4_SHORT = 11906; // 210mm
const MD_A4_LONG = 16838;  // 297mm

// 기본 페이지 여백(twips): 위 3cm, 아래·좌·우 2.54cm(=1inch)
// (1cm ≈ 566.929 twip, 2.54cm = 1440 twip)
const MD_DEFAULT_MARGINS = { top: 1701, bottom: 1440, left: 1440, right: 1440 };

/**
 * 용지 방향에 맞는 A4 <w:sectPr> XML 생성
 * @param {string} orientation - 'portrait' | 'landscape'
 * @param {Object} [margins] - 여백 override(twips). 미지정 시 기본 여백 사용
 *   ("별도 설정이 특정되어 있는 경우"에만 override, 그 외에는 기본값 유지)
 * @returns {string}
 */
function mdDocxSectPr(orientation, margins) {
    const m = Object.assign({}, MD_DEFAULT_MARGINS, margins || {});
    let pgSz;
    if (orientation === 'landscape') {
        pgSz = `<w:pgSz w:w="${MD_A4_LONG}" w:h="${MD_A4_SHORT}" w:orient="landscape"/>`;
    } else {
        pgSz = `<w:pgSz w:w="${MD_A4_SHORT}" w:h="${MD_A4_LONG}"/>`;
    }
    return `<w:sectPr>${pgSz}<w:pgMar w:top="${m.top}" w:right="${m.right}" w:bottom="${m.bottom}" w:left="${m.left}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
}

/**
 * 용지 방향/여백에 따른 본문 콘텐츠 폭(twips) 계산 - 표를 페이지 폭에 맞출 때 사용
 * @param {string} orientation - 'portrait' | 'landscape'
 * @param {Object} [margins] - 여백 override(twips). 미지정 시 기본 여백 사용
 * @returns {number} 콘텐츠 폭(twips)
 */
function mdDocxContentWidth(orientation, margins) {
    const m = Object.assign({}, MD_DEFAULT_MARGINS, margins || {});
    const pageW = orientation === 'landscape' ? MD_A4_LONG : MD_A4_SHORT;
    return pageW - m.left - m.right;
}

/**
 * 미리보기에서 측정한 열 폭(px 등 상대값) 비율을 유지하며 총 폭(twips)에 맞춰
 * 각 열의 DOCX 폭(twips)을 분배한다. 합계는 정확히 totalWidth가 되도록 보정한다.
 * (셀 내용에 따라 열 폭이 자동 조절되는 브라우저 표 렌더링을 DOCX에 재현하기 위함)
 * @param {number[]} colSizes - 열별 상대 폭(측정값). 길이 = 열 수
 * @param {number} totalWidth - 목표 총 폭(twips)
 * @param {number} [minWidth=200] - 열 최소 폭(twips)
 * @returns {number[]} 열별 폭(twips), 합계 = totalWidth
 */
function mdDistributeColumnWidths(colSizes, totalWidth, minWidth) {
    const n = Array.isArray(colSizes) ? colSizes.length : 0;
    if (n === 0) return [];
    const min = (typeof minWidth === 'number') ? minWidth : 200;
    const total = colSizes.reduce((a, b) => a + (b > 0 ? b : 0), 0);

    let widths;
    if (total <= 0) {
        // 측정 실패(예: 미리보기 비표시) → 균등 분배 폴백
        const g = Math.floor(totalWidth / n);
        widths = new Array(n).fill(g);
    } else {
        widths = colSizes.map(sz => Math.max(min, Math.round((sz > 0 ? sz : 0) / total * totalWidth)));
    }
    // 반올림/최소폭 보정: 합계를 정확히 totalWidth에 맞춤 (가장 넓은 열에서 조정)
    let sum = widths.reduce((a, b) => a + b, 0);
    let diff = totalWidth - sum;
    if (diff !== 0) {
        let idx = 0;
        for (let i = 1; i < n; i++) if (widths[i] > widths[idx]) idx = i;
        widths[idx] = Math.max(min, widths[idx] + diff);
        // 최소폭 때문에 여전히 어긋나면 마지막으로 한 번 더 보정
        sum = widths.reduce((a, b) => a + b, 0);
        diff = totalWidth - sum;
        if (diff !== 0) widths[idx] = Math.max(1, widths[idx] + diff);
    }
    return widths;
}

/**
 * 인라인 이미지(수식 등)를 담는 <w:r> 드로잉 런 XML 생성 (DOM 비의존)
 * @param {Object} opts - { rid, id, name, cx, cy } (cx/cy 는 EMU)
 * @returns {string}
 */
function mdDocxImageRunXml(opts) {
    const { rid, id, name, cx, cy } = opts;
    const safeName = escapeXml(name || ('image' + id));
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">`
        + `<wp:extent cx="${cx}" cy="${cy}"/>`
        + `<wp:effectExtent l="0" t="0" r="0" b="0"/>`
        + `<wp:docPr id="${id}" name="${safeName}"/>`
        + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
        + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
        + `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
        + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
        + `<pic:nvPicPr><pic:cNvPr id="${id}" name="${safeName}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
        + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/**
 * 제목 태그(h1~h6)에 대응하는 DOCX 글꼴 크기(half-point) 반환
 * @param {string} tag - 'h1'~'h6' (대소문자 무관)
 * @returns {number} half-point 크기 (해당 없으면 0)
 */
function mdDocxHeadingSize(tag) {
    const map = { h1: 48, h2: 40, h3: 32, h4: 28, h5: 26, h6: 24 };
    return map[String(tag).toLowerCase()] || 0;
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
 * 클립보드에 텍스트 복사 (성공 시 3초 후 메시지 자동 숨김)
 * @param {string} text - 복사할 텍스트
 * @param {HTMLElement} msgEl - 메시지 표시 요소 (선택)
 * @param {string} [successMsg] - 성공 메시지
 */
function copyToClipboard(text, msgEl, successMsg = '✅ 클립보드에 복사되었습니다.') {
    navigator.clipboard.writeText(text).then(() => {
        if (msgEl) {
            showMessage(msgEl, successMsg, 'success');
            setTimeout(() => msgEl.classList.add('hidden'), 3000);
        }
    }).catch(err => {
        console.error('복사 실패:', err);
        if (msgEl) {
            showMessage(msgEl, '❌ 복사에 실패했습니다.', 'error');
        }
    });
}

/**
 * .docx 파일 업로드 공통 처리 (확장자 검사 + 파일명 표시 + 오류 알림)
 * @param {File} file - 업로드된 파일
 * @param {string|null} fileNameElId - 파일명을 표시할 요소 id (선택)
 * @param {function(File): Promise} processFn - 파일 처리 함수
 */
async function handleDocxUpload(file, fileNameElId, processFn) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
        alert('❌ .docx 파일만 업로드 가능합니다.');
        return;
    }
    if (fileNameElId) document.getElementById(fileNameElId).textContent = file.name;
    try {
        await processFn(file);
    } catch (error) {
        alert('오류: ' + error.message);
    }
}

/**
 * 드래그 앤 드롭 영역 설정 (dragover/dragleave 시각 효과 + drop 시 첫 파일 전달)
 * @param {HTMLElement} el - 드롭 대상 요소
 * @param {function(File): Promise} onFile - 드롭된 파일 처리 함수
 * @param {Object} [options]
 * @param {string} [options.clickOpensInput] - 클릭 시 열 file input의 id
 */
function setupDropZone(el, onFile, options = {}) {
    el.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', e => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over');
    });
    el.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) await onFile(e.dataTransfer.files[0]);
    });
    if (options.clickOpensInput) {
        el.addEventListener('click', () => document.getElementById(options.clickOpensInput).click());
    }
}
