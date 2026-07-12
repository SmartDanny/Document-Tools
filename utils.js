/**
 * Document Tools - utils.js
 * 공통 유틸리티 함수 모음
 * Version: 1.5.0
 * Last Updated: 2026-07-09
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
// .fin(KIPO 전자출원) 변환용 순수 헬퍼
// (DOM 비의존 - fin-parser.js가 만든 IR 객체를 입력으로 받음)
// ============================================

/**
 * KIPO .fin 도면 치수(wi/he, 단위 mm)를 EMU로 변환 (1mm = 36000 EMU)
 * @param {number} mm - 밀리미터 치수
 * @returns {number} EMU (최소 1)
 */
function finMmToEmu(mm) {
    const v = Math.round((Number(mm) || 0) * 36000);
    return v > 0 ? v : 1;
}

// 유니코드 아래첨자/위첨자 → 기본 문자 매핑
const FIN_SUB_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')' };
const FIN_SUP_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ⁱ': 'i' };

/**
 * 유니코드 아래첨자/위첨자 문자를 <sub>/<sup> 태그로 정규화 (글꼴 독립 렌더링)
 * 예: "H₂SO₄" → "H<sub>2</sub>SO<sub>4</sub>", "S₂O₈²⁻" → "S<sub>2</sub>O<sub>8</sub><sup>2-</sup>"
 * @param {string} text
 * @returns {string}
 */
function finNormalizeScripts(text) {
    if (!text) return text;
    // 기존 <sub>/<sup> 태그 구간은 건드리지 않음 (이중 중첩 방지)
    return String(text)
        .split(/(<su[bp]>[\s\S]*?<\/su[bp]>)/)
        .map(seg => /^<su[bp]>/.test(seg) ? seg : seg
            .replace(/[₀-₎]+/g, m => '<sub>' + Array.from(m).map(c => FIN_SUB_MAP[c] || c).join('') + '</sub>')
            .replace(/[²³¹⁰ⁱ⁴-ⁿ]+/g, m => '<sup>' + Array.from(m).map(c => FIN_SUP_MAP[c] || c).join('') + '</sup>'))
        .join('');
}

/**
 * 여러 줄 텍스트 정리: 각 줄 trim + 빈 줄 제거 (XML 서식 개행과 <br/>가 겹쳐 생기는 빈 줄 방지)
 * @param {string} text
 * @returns {string}
 */
function finCleanMultiline(text) {
    return String(text || '').split('\n').map(s => s.trim()).filter(s => s.length > 0).join('\n');
}

/**
 * 해외출원용 국문(ROPKS) 파일명(확장자 제외) 생성
 *  - 해외관리번호 입력 시: 국가코드 US 제거 후 "<관리번호>ROPKS_<오늘6자리>"
 *  - 미입력 시: "ROPKS_<오늘6자리>"
 * @param {string} mgmtNo - 해외관리번호(예: OPP20123456US)
 * @param {string} today6 - 오늘 날짜 6자리(YYMMDD)
 * @returns {string}
 */
function finRopksBaseName(mgmtNo, today6) {
    const raw = (mgmtNo || '').trim();
    if (!raw) return `ROPKS_${today6}`;
    return `${raw.replace(/US$/i, '')}ROPKS_${today6}`;
}

/**
 * img-format 문자열을 MIME 타입으로 변환
 * @param {string} fmt - 'jpg' | 'jpeg' | 'png' | 'gif' 등
 * @returns {string} MIME 타입
 */
function finImgFormatToMime(fmt) {
    const f = String(fmt || '').toLowerCase();
    if (f === 'png') return 'image/png';
    if (f === 'gif') return 'image/gif';
    if (f === 'bmp') return 'image/bmp';
    if (f === 'tif' || f === 'tiff') return 'image/tiff';
    return 'image/jpeg'; // jpg/jpeg 및 기본값
}

// ============================================
// 의심 문자 검사 (특허명세서에서 잘 사용되지 않는 문자)
// ============================================

// 검사 패턴 목록. 배열 순서 = 매칭 우선순위(긴 패턴 먼저) = 보고서 표시 순서.
// 유니코드 첨자는 정규화(finNormalizeScripts) 전 원문에서 검사해야 누락분까지 잡힌다.
const SUSPICIOUS_CHAR_PATTERNS = [
    { label: '유니코드 첨자', re: /[₀-ₜ⁰-ⁿ¹²³]/g }, // ₀-ₜ ⁰-ⁿ ¹²³
    { label: '"**"', re: /\*\*/g },
    { label: '"*?"', re: /\*\?/g },
    { label: '"?*"', re: /\?\*/g },
    { label: '"?"', re: /[?？]/g }, // 반각/전각 물음표
    { label: '대체문자(�)', re: /�/g }
];

/**
 * 문자열에서 의심 문자 발생 위치 수집. 긴 패턴이 먼저 소비한 위치는
 * 뒤 패턴에서 제외한다(예: "*?"의 ?는 단독 "?"로 중복 집계하지 않음).
 * @param {string} str
 * @returns {Array<{label:string, index:number, match:string}>} index 오름차순
 */
function finScanSuspicious(str) {
    const found = [];
    const consumed = new Set();
    for (const p of SUSPICIOUS_CHAR_PATTERNS) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(str)) !== null) {
            const start = m.index, end = m.index + m[0].length;
            let overlap = false;
            for (let i = start; i < end; i++) { if (consumed.has(i)) { overlap = true; break; } }
            if (overlap) continue;
            for (let i = start; i < end; i++) consumed.add(i);
            found.push({ label: p.label, index: start, match: m[0] });
        }
    }
    found.sort((a, b) => a.index - b.index);
    return found;
}

// 발생 위치 앞뒤 ±15자 발췌 (줄바꿈 등 공백류는 한 칸으로 축약)
function finSuspiciousExcerpt(str, index, len) {
    const clip = (s) => s.replace(/\s+/g, ' ');
    return {
        before: clip(str.slice(Math.max(0, index - 15), index)),
        match: str.substr(index, len),
        after: clip(str.slice(index + len, index + len + 15))
    };
}

// 발생 목록을 패턴(label)별로 그룹화 → [{label, count, occurrences}]
function finGroupSuspicious(all) {
    const out = [];
    for (const p of SUSPICIOUS_CHAR_PATTERNS) {
        const occurrences = all.filter(a => a.label === p.label).map(a => a.occ);
        if (occurrences.length) out.push({ label: p.label, count: occurrences.length, occurrences });
    }
    return out;
}

/**
 * 라인 텍스트에서 의심 문자 검사 (.docx 업로드용 — 행 번호 + 앞뒤 발췌로 위치 표기)
 * @param {string} text
 * @returns {Array<{label, count, occurrences:Array<{line, before, match, after}>}>}
 */
function findSuspiciousInText(text) {
    const all = [];
    String(text == null ? '' : text).split('\n').forEach((lineStr, i) => {
        for (const f of finScanSuspicious(lineStr)) {
            all.push({ label: f.label, occ: Object.assign({ line: i + 1 }, finSuspiciousExcerpt(lineStr, f.index, f.match.length)) });
        }
    });
    return finGroupSuspicious(all);
}

// 인라인 이미지 경고 항목의 label (본문 <p> 안의 <img> — 특수문자 이미지 추정.
// docx에는 원본 이미지로 임베드되지만 텍스트가 아니므로 확인 대상으로 표시)
const FIN_INLINE_IMG_LABEL = '본문 인라인 이미지(이미지로 임베드됨)';

// 본문 인라인 이미지 마커 (fin-parser가 <p> 내 <img>를 보존한 형태) 제거 —
// 라인 텍스트(변환결과 표시/복사·후처리 파이프라인)에서 사용. docx 모델에는 마커가 유지된다.
function finStripInlineImgMarkers(s) {
    return String(s == null ? '' : s).replace(/<img\b[^>]*data-finimg[^>]*>/gi, '');
}

/**
 * 단락 배열에서 의심 문자 검사 (.fin 업로드용 — 단락번호 등 loc + 앞뒤 발췌로 위치 표기)
 * 단락에 inlineImgs(본문 인라인 <img> 개수)가 있으면 별도 경고 항목으로 함께 보고한다.
 * @param {Array<{loc:string, text:string, inlineImgs?:number}>} paras - 정규화 전 원문 단락 (fin-parser의 ir.rawParas)
 * @returns {Array<{label, count, occurrences:Array<{loc, before, match, after}>}>}
 */
function findSuspiciousInParas(paras) {
    const all = [];
    for (const p of (paras || [])) {
        // 마커(<img data-finimg…>) 자체는 검사/발췌 대상에서 제외
        const t = finStripInlineImgMarkers(p.text);
        for (const f of finScanSuspicious(t)) {
            all.push({ label: f.label, occ: Object.assign({ loc: p.loc || '' }, finSuspiciousExcerpt(t, f.index, f.match.length)) });
        }
    }
    const out = finGroupSuspicious(all);

    // 본문 인라인 이미지 — 단락별 1개 항목(개수 표기), count는 이미지 총 개수
    const imgOcc = [];
    let imgTotal = 0;
    for (const p of (paras || [])) {
        const n = p.inlineImgs || 0;
        if (!n) continue;
        imgTotal += n;
        const plain = finStripInlineImgMarkers(p.text).replace(/\s+/g, ' ').trim();
        imgOcc.push({
            loc: p.loc || '',
            before: '',
            match: `[인라인 이미지 ${n}개]`,
            after: plain ? ' ' + plain.slice(0, 20) : ''
        });
    }
    if (imgTotal) out.push({ label: FIN_INLINE_IMG_LABEL, count: imgTotal, occurrences: imgOcc });
    return out;
}

/**
 * IR의 단락 배열을 라인 텍스트로 직렬화 (내부 <br/>는 별도 라인으로 분해, 번호는 첫 줄에만)
 * @param {Array} paras - {num, text} 또는 문자열의 배열
 * @param {boolean} withNum - [NNNN] 단락번호 접두 여부
 * @returns {string[]} 라인 배열
 */
function finParasToLines(paras, withNum) {
    const out = [];
    for (const p of (paras || [])) {
        if (typeof p === 'string') { for (const l of p.split('\n')) out.push(l); continue; }
        const lines = String(p.text || '').split('\n');
        lines.forEach((ln, i) => {
            out.push((withNum && p.num && i === 0) ? `[${p.num}] ${ln}` : ln);
        });
    }
    return out;
}

/**
 * IR → KIPO 출원서식 라인 텍스트(【】 부제 + [NNNN] 단락번호 + <table>/<sub> 태그).
 * 기존 탭1 텍스트 파이프라인(부제표준화·단락번호·HTML 미리보기)과 그대로 합류한다.
 * @param {Object} ir - fin-parser의 parseFinFile 결과
 * @param {boolean} [numbered=true] - false면 .fin의 [NNNN] 단락번호를 제외 (단락번호 추가 기능으로 새로 부여 가능)
 * @returns {string} 줄바꿈으로 연결된 라인 텍스트
 */
function finBuildKipoLineText(ir, numbered) {
    if (!ir) return '';
    if (numbered == null) numbered = true;
    const L = [];
    L.push('【발명의 설명】');
    L.push('【발명의 명칭】');
    if (ir.titleKo) L.push(ir.titleKo);
    else if (ir.titleRaw) L.push(ir.titleRaw);
    if (ir.titleEn) L.push(ir.titleEn);
    L.push('【기술분야】');
    L.push(...finParasToLines(ir.technicalField, numbered));
    L.push('【발명의 배경이 되는 기술】');
    L.push(...finParasToLines(ir.backgroundArt, numbered));
    L.push('【발명의 내용】');
    if (ir.techProblem && ir.techProblem.length) {
        L.push('【해결하고자 하는 과제】');
        L.push(...finParasToLines(ir.techProblem, numbered));
    }
    if (ir.techSolution && ir.techSolution.length) {
        L.push('【과제의 해결 수단】');
        L.push(...finParasToLines(ir.techSolution, numbered));
    }
    if (ir.advantageousEffects && ir.advantageousEffects.length) {
        L.push('【발명의 효과】');
        L.push(...finParasToLines(ir.advantageousEffects, numbered));
    }
    L.push('【도면의 간단한 설명】');
    L.push(...finParasToLines(ir.descriptionOfDrawings, numbered));
    L.push('【발명을 실시하기 위한 구체적인 내용】');
    for (const item of (ir.embodiments || [])) {
        if (item.kind === 'table') {
            if (item.num) L.push(`[표 ${item.num}]`);
            L.push(item.html);
        } else {
            L.push((numbered && item.num ? `[${item.num}] ` : '') + (item.text || ''));
        }
    }
    if (ir.referenceSigns && ir.referenceSigns.length) {
        L.push('【부호의 설명】');
        L.push(...finParasToLines(ir.referenceSigns, numbered));
    }
    L.push('【청구범위】');
    for (const c of (ir.claims || [])) {
        L.push(`【청구항 ${c.num}】`);
        for (const line of String(c.text || '').split('\n')) L.push(line);
    }
    L.push('【요약서】');
    L.push('【요약】');
    L.push(...finParasToLines((ir.abstract && ir.abstract.summary) || [], false));
    if (ir.abstract && ir.abstract.figureNum) {
        L.push('【대표도】');
        L.push(`도 ${ir.abstract.figureNum}`);
    }
    if (ir.drawings && ir.drawings.length) {
        L.push('【도면】');
        for (const d of ir.drawings) L.push(`【도 ${d.num}】`);
    }
    // 본문 인라인 이미지 마커는 텍스트 파이프라인에서 제외 (docx 모델에는 유지되어 이미지로 임베드)
    return finStripInlineImgMarkers(L.join('\n'));
}

/**
 * 블록 모델을 라인 텍스트로 직렬화 (표는 HTML 그대로, 이미지/페이지나누기는 제외)
 * @param {Array<Object>} model - finBuildDocModel 결과
 * @returns {string}
 */
function finModelToLineText(model) {
    const L = [];
    for (const b of (model || [])) {
        if (b.t === 'table') L.push(b.html);
        else if (b.t === 'p') L.push(b.text == null ? '' : b.text);
        // img / pagebreak → 텍스트 표시 제외
    }
    // 본문 인라인 이미지 마커는 텍스트 파이프라인에서 제외 (docx 모델에는 유지되어 이미지로 임베드)
    return finStripInlineImgMarkers(L.join('\n'));
}

/**
 * IR → 해외출원용 국문(ROPKS) 라인 텍스트 ('변환결과' 표시용)
 * @param {Object} ir - parseFinFile 결과
 * @returns {string}
 */
function finBuildRopksLineText(ir) {
    return finModelToLineText(finBuildRopksModel(ir));
}

/**
 * HTML <table> 문자열을 셀 모델로 파싱 (colspan/rowspan 포함)
 * @param {string} tableHtml
 * @returns {Array<Array<{content:string, colspan:number, rowspan:number}>>} 행별 셀 배열
 */
function finParseHtmlTable(tableHtml) {
    const rows = [];
    const trs = String(tableHtml).match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trs) {
        const cells = [];
        const tds = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
        for (const td of tds) {
            const cs = td.match(/colspan\s*=\s*["']?(\d+)/i);
            const rs = td.match(/rowspan\s*=\s*["']?(\d+)/i);
            const content = td.replace(/^<t[dh][^>]*>/i, '').replace(/<\/t[dh]>$/i, '');
            cells.push({
                content,
                colspan: Math.max(1, cs ? parseInt(cs[1], 10) || 1 : 1),
                rowspan: Math.max(1, rs ? parseInt(rs[1], 10) || 1 : 1)
            });
        }
        rows.push(cells);
    }
    return rows;
}

/**
 * 셀 모델을 그리드에 배치. Word 표는 세로 병합이 이어지는 행에도 자리 셀이 필요하므로
 * rowspan 연속 위치에 vMerge='continue' 슬롯을 채워 넣는다.
 * @param {Array<Array<{content,colspan,rowspan}>>} rows - finParseHtmlTable 결과
 * @returns {{rows: Array<Array<{content,colspan,vMerge:null|'restart'|'continue'}>>, maxCols: number}}
 */
function finLayoutTableGrid(rows) {
    const out = [];
    const pending = {}; // 그리드 열 → {rowsLeft, colspan} (진행 중인 세로 병합)
    let maxCols = 0;
    for (const cells of rows) {
        const slots = [];
        let col = 0, idx = 0;
        while (true) {
            if (pending[col]) {
                const pm = pending[col];
                slots.push({ content: '', colspan: pm.colspan, vMerge: 'continue' });
                pm.rowsLeft--;
                if (pm.rowsLeft <= 0) delete pending[col];
                col += pm.colspan;
                continue;
            }
            if (idx < cells.length) {
                const c = cells[idx++];
                slots.push({ content: c.content, colspan: c.colspan, vMerge: c.rowspan > 1 ? 'restart' : null });
                if (c.rowspan > 1) pending[col] = { rowsLeft: c.rowspan - 1, colspan: c.colspan };
                col += c.colspan;
                continue;
            }
            // 셀 소진 후 오른쪽에 진행 중 병합이 남아 있으면 빈 셀로 간극을 메우고 이어감
            const rest = Object.keys(pending).map(Number).filter(k => k >= col);
            if (rest.length) {
                const next = Math.min.apply(null, rest);
                if (next > col) { slots.push({ content: '', colspan: next - col, vMerge: null }); col = next; }
                continue;
            }
            break;
        }
        out.push(slots);
        maxCols = Math.max(maxCols, col);
    }
    return { rows: out, maxCols };
}

// ROPKS(해외출원용 국문) 부제 = 사무소표준US. 도면/청구항/부호 라벨은 아래 모델 빌더에서 처리.
const FIN_ROPKS_SUBTITLES = {
    title: 'TITLE OF THE INVENTION',
    background: 'BACKGROUND OF THE INVENTION',
    field: '(a) Field of the Invention',
    related: '(b) Description of the Related Art',
    summary: 'SUMMARY OF THE INVENTION',
    drawingsBrief: 'BRIEF DESCRIPTION OF THE DRAWINGS',
    detailed: 'DETAILED DESCRIPTION OF THE EMBODIMENTS',
    symbols: '<Description of symbols>',
    claims: 'WHAT IS CLAIMED IS:',
    abstract: 'ABSTRACT OF DISCLOSURE'
};

/**
 * IR → 렌더링용 블록 모델. 공유 렌더러(fin-docx.js)가 소비한다.
 * 블록: {t:'p',text,bold,align,size,before,after} 단락(내부 \n → <w:br/>)
 *      | {t:'table',html} | {t:'img',drawing,align,before,after} | {t:'pagebreak'}
 * size 는 half-point, before/after 는 twips (생략 시 렌더러의 포맷 기본값).
 * @param {Object} ir - parseFinFile 결과
 * @param {string} format - 'kipo'(KIPO 출원서식) | 'ropks'(해외출원용 국문)
 * @param {Object} [opts] - ropks 전용 { crossRef: {title, text} } — 2단계에서 삽입된 Cross-reference
 * @returns {Array<Object>} 블록 배열
 */
function finBuildDocModel(ir, format, opts) {
    if (!ir) return [];
    return format === 'ropks' ? finBuildRopksModel(ir, opts) : finBuildKipoModel(ir);
}

// 해외출원용 국문(ROPKS): ROPKS 샘플 역설계.
//   sub  = 볼드+밑줄 부제(들여쓰기 없음)  | body = 첫줄 들여쓰기 본문
//   plain = 들여쓰기·볼드 없음(청구항 헤더·【도면】·【도 N】)
//   렌더러(fin-docx.js)가 바탕체·행간518·탭스톱을 공통 적용한다.
function finBuildRopksModel(ir, opts) {
    const B = [];
    const sub = (text) => { if (text) B.push({ t: 'p', text, bold: true }); };
    const body = (text) => B.push({ t: 'p', text: text == null ? '' : text, indent: true });
    const plain = (text, opt) => B.push(Object.assign({ t: 'p', text: text == null ? '' : text }, opt || {}));
    const bodyParas = (arr, withNum) => { for (const line of finParasToLines(arr, withNum)) body(line); };

    sub(FIN_ROPKS_SUBTITLES.title);
    body(ir.titleRaw);
    // 2단계에서 삽입된 Cross-reference — 변환결과 텍스트와 같은 위치(BACKGROUND 앞)에 포함
    if (opts && opts.crossRef && opts.crossRef.text) {
        sub(opts.crossRef.title || 'CROSS-REFERENCE TO RELATED APPLICATIONS');
        body(opts.crossRef.text);
    }
    sub(FIN_ROPKS_SUBTITLES.background);
    sub(FIN_ROPKS_SUBTITLES.field);
    bodyParas(ir.technicalField, false);
    sub(FIN_ROPKS_SUBTITLES.related);
    bodyParas(ir.backgroundArt, false);
    sub(FIN_ROPKS_SUBTITLES.summary);
    bodyParas(ir.techProblem, false);
    bodyParas(ir.techSolution, false);
    bodyParas(ir.advantageousEffects, false);
    sub(FIN_ROPKS_SUBTITLES.drawingsBrief);
    bodyParas(ir.descriptionOfDrawings, false);
    sub(FIN_ROPKS_SUBTITLES.detailed);
    for (const item of (ir.embodiments || [])) {
        if (item.kind === 'table') {
            if (item.num) body(`[표 ${item.num}]`);
            B.push({ t: 'table', html: item.html });
        } else {
            body(item.text || '');
        }
    }
    if (ir.referenceSigns && ir.referenceSigns.length) {
        sub(FIN_ROPKS_SUBTITLES.symbols);
        bodyParas(ir.referenceSigns, false);
    }
    // WHAT IS CLAIMED IS: 는 새 페이지에서 시작
    B.push({ t: 'p', text: FIN_ROPKS_SUBTITLES.claims, bold: true, pageBreakBefore: true });
    for (const c of (ir.claims || [])) {
        plain(`【청구항 ${c.num}】`);
        for (const line of String(c.text || '').split('\n')) { if (line.trim()) body(line); }
    }
    // ABSTRACT OF DISCLOSURE 는 새 페이지에서 시작
    B.push({ t: 'p', text: FIN_ROPKS_SUBTITLES.abstract, bold: true, pageBreakBefore: true });
    bodyParas((ir.abstract && ir.abstract.summary) || [], false);
    if (ir.abstract && ir.abstract.figureNum) body(`대표도: 도 ${ir.abstract.figureNum}`);
    // 【도면】 은 새 페이지에서 시작, 도면은 하나씩 개별 페이지 (도면 섹션은 줄번호 생략)
    if (ir.drawings && ir.drawings.length) {
        B.push({ t: 'p', text: '【도면】', align: 'center', pageBreakBefore: true, suppressLineNum: true });
        ir.drawings.forEach((d, j) => {
            plain(`【도 ${d.num}】`, Object.assign({ suppressLineNum: true }, j > 0 ? { pageBreakBefore: true } : {}));
            B.push({ t: 'img', drawing: d, align: 'center', suppressLineNum: true });
        });
    }
    return B;
}

// KIPO 출원서식 레이아웃(샘플 역설계): 명세서/청구범위/요약서/도면 4부(部) 구조.
// 부 헤더는 중앙 볼드, 【】부제 볼드 11pt(sz22), 본문 10pt(sz20), 부 사이 페이지 나누기.
function finBuildKipoModel(ir) {
    const B = [];
    // 부 헤더(중앙 볼드): 명세서=15pt/after400, 그 외=13pt/after300
    const parthdr = (text, first) => B.push({ t: 'p', text, bold: true, align: 'center', size: first ? 30 : 26, after: first ? 400 : 300 });
    // 【】 부제: 볼드 11pt, before280/after140
    const sub = (text, opt) => { if (text) B.push(Object.assign({ t: 'p', text, bold: true, size: 22, before: 280, after: 140 }, opt || {})); };
    // 본문 단락: 10pt, after120
    const p = (text, opt) => B.push(Object.assign({ t: 'p', text: text == null ? '' : text, after: 120 }, opt || {}));
    // 각 행을 개별 단락으로 (도면의 간단한 설명·부호의 설명 포함) — 양쪽맞춤 시 줄이 늘어나지 않도록
    const paras = (arr, withNum) => { for (const line of finParasToLines(arr, withNum)) p(line); };

    // ── 명세서 ──
    parthdr('명세서', true);
    sub('【발명의 명칭】');
    if (ir.titleKo) p(ir.titleKo, { after: 60 });
    else if (ir.titleRaw) p(ir.titleRaw, { after: 60 });
    if (ir.titleEn) p(ir.titleEn, { after: 200 });
    sub('【기술분야】');
    paras(ir.technicalField, true);
    sub('【발명의 배경이 되는 기술】');
    paras(ir.backgroundArt, true);
    sub('【발명의 내용】');
    if (ir.techProblem && ir.techProblem.length) { sub('【해결하고자 하는 과제】'); paras(ir.techProblem, true); }
    if (ir.techSolution && ir.techSolution.length) { sub('【과제의 해결 수단】'); paras(ir.techSolution, true); }
    if (ir.advantageousEffects && ir.advantageousEffects.length) { sub('【발명의 효과】'); paras(ir.advantageousEffects, true); }
    sub('【도면의 간단한 설명】');
    paras(ir.descriptionOfDrawings, true);
    sub('【발명을 실시하기 위한 구체적인 내용】');
    for (const item of (ir.embodiments || [])) {
        if (item.kind === 'table') {
            if (item.num) p(`[표 ${item.num}]`);
            B.push({ t: 'table', html: item.html });
        } else {
            p((item.num ? `[${item.num}] ` : '') + (item.text || ''));
        }
    }
    if (ir.referenceSigns && ir.referenceSigns.length) { sub('【부호의 설명】'); paras(ir.referenceSigns, true); }

    // ── 청구범위 (새 페이지) ──
    B.push({ t: 'pagebreak' });
    parthdr('청구범위');
    for (const c of (ir.claims || [])) {
        sub(`【청구항 ${c.num}】`, { before: 160, after: 40 });
        // 청구항 본문: 각 행을 개별 단락으로 + 행마다 들여쓰기
        const lines = String(c.text || '').split('\n').filter(l => l.trim());
        lines.forEach((line, idx) => p(line, { indent: true, after: idx === lines.length - 1 ? 160 : 0 }));
    }

    // ── 요약서 (새 페이지) ──
    B.push({ t: 'pagebreak' });
    parthdr('요약서');
    sub('【요약】');
    paras((ir.abstract && ir.abstract.summary) || [], false);
    if (ir.abstract && ir.abstract.figureNum) { sub('【대표도】'); p(`도 ${ir.abstract.figureNum}`, { after: 200 }); }

    // ── 도면 (새 페이지): 이미지 → 그 아래 [도 N] 캡션 ──
    if (ir.drawings && ir.drawings.length) {
        B.push({ t: 'pagebreak' });
        parthdr('도면');
        for (const d of ir.drawings) {
            B.push({ t: 'img', drawing: d, align: 'center', before: 120, after: 60 });
            p(`[도 ${d.num}]`, { bold: true, align: 'center', after: 240 });
        }
    }
    return B;
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
 * 표 셀 여백(<w:tblCellMar>) XML 생성 - 미리보기의 셀 padding(≈0.75em)에 대응
 * 본문 글꼴 크기에 비례해 좌우/상하 여백을 산출한다.
 * @param {number} bodyPt - 본문 글꼴 크기(pt)
 * @returns {string} <w:tblCellMar>...</w:tblCellMar>
 */
function mdDocxCellMarginsXml(bodyPt) {
    const em = (Number(bodyPt) || 12) * 20; // 1pt = 20 twip
    const lr = Math.round(em * 0.55);
    const tb = Math.round(em * 0.35);
    return `<w:tblCellMar>`
        + `<w:top w:w="${tb}" w:type="dxa"/>`
        + `<w:left w:w="${lr}" w:type="dxa"/>`
        + `<w:bottom w:w="${tb}" w:type="dxa"/>`
        + `<w:right w:w="${lr}" w:type="dxa"/>`
        + `</w:tblCellMar>`;
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
