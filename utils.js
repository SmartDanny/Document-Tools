/**
 * Document Tools - utils.js
 * 공통 유틸리티 함수 모음
 * Version: 1.0.0
 * Last Updated: 2026-01-08
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
 * @param {string} fmt - 형식 ('decimal', 'upperRoman', 'lowerRoman', 'upperLetter', 'lowerLetter')
 * @returns {string} 변환된 문자열
 */
function formatNumber(num, fmt) {
    switch (fmt) {
        case 'decimal': return String(num);
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
        // 공백을 보존하는 토크나이즈 (공백은 앞 단어에 붙임)
        const tokenize = (text) => {
            const tokens = [];
            const regex = /(\S+)(\s*)/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                tokens.push({ word: match[1], space: match[2] || '' });
            }
            return tokens;
        };

        const tokensA = tokenize(textA);
        const tokensB = tokenize(textB);

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
 * @param {string} textA - 원본 텍스트
 * @param {string} textB - 비교 텍스트
 * @returns {Array} diff 배열
 */
function getWordDiffForDocx(textA, textB) {
    // 단어 경계로 분리 (공백은 이전 단어에 포함)
    const tokenize = (text) => {
        const tokens = [];
        const regex = /(\S+)(\s*)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            tokens.push({
                word: match[1],
                space: match[2] || ''
            });
        }
        return tokens;
    };
    
    const tokensA = tokenize(textA);
    const tokensB = tokenize(textB);
    
    const m = tokensA.length, n = tokensB.length;
    
    // LCS DP 테이블
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (tokensA[i-1].word === tokensB[j-1].word) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }
    
    // Backtrack하여 diff 생성
    const diff = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && tokensA[i-1].word === tokensB[j-1].word) {
            diff.unshift({ 
                type: 'same', 
                word: tokensB[j-1].word,
                space: tokensB[j-1].space
            });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
            diff.unshift({ 
                type: 'added', 
                word: tokensB[j-1].word,
                space: tokensB[j-1].space
            });
            j--;
        } else {
            diff.unshift({ 
                type: 'deleted', 
                word: tokensA[i-1].word,
                space: ''
            });
            i--;
        }
    }
    
    return diff;
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
