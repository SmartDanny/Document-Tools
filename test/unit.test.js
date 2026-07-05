/**
 * utils.js 순수 함수 유닛 테스트 (외부 의존성 없음)
 * 실행: npm test  (node --test test/unit.test.js)
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const u = require('./load-utils');

// vm 컨텍스트(다른 realm)에서 생성된 객체는 프로토타입이 달라
// strict deepEqual이 실패하므로 JSON 직렬화로 구조를 비교한다
const assertSameJson = (actual, expected) =>
    assert.equal(JSON.stringify(actual), JSON.stringify(expected));

describe('이스케이프', () => {
    test('escapeHtml', () => {
        assert.equal(u.escapeHtml('<sub>&</sub>'), '&lt;sub&gt;&amp;&lt;/sub&gt;');
        assert.equal(u.escapeHtml(''), '');
        assert.equal(u.escapeHtml(null), '');
    });
    test('escapeXml은 따옴표도 이스케이프', () => {
        assert.equal(u.escapeXml(`<a b="c">'d'</a>`), '&lt;a b=&quot;c&quot;&gt;&apos;d&apos;&lt;/a&gt;');
    });
});

describe('숫자 포맷팅', () => {
    test('formatNumber', () => {
        assert.equal(u.formatNumber(3, 'decimal'), '3');
        assert.equal(u.formatNumber(3, 'decimalZero'), '03');
        assert.equal(u.formatNumber(4, 'upperRoman'), 'IV');
        assert.equal(u.formatNumber(4, 'lowerRoman'), 'iv');
        assert.equal(u.formatNumber(1, 'upperLetter'), 'A');
        assert.equal(u.formatNumber(2, 'lowerLetter'), 'b');
        assert.equal(u.formatNumber(5, 'koreanCounting'), '5'); // 미지원 형식은 십진수
    });
    test('toRoman', () => {
        assert.equal(u.toRoman(1994), 'MCMXCIV');
        assert.equal(u.toRoman(9), 'IX');
    });
});

describe('diff 알고리즘', () => {
    test('tokenizeWords는 공백을 앞 단어에 보존', () => {
        assertSameJson(u.tokenizeWords('a  b c'), [
            { word: 'a', space: '  ' },
            { word: 'b', space: ' ' },
            { word: 'c', space: '' },
        ]);
    });

    test('computeLCS', () => {
        const dp = u.computeLCS(['a', 'b', 'c'], ['a', 'c']);
        assert.equal(dp[3][2], 2);
    });

    test('calculateSimilarity 경계값', () => {
        assert.equal(u.calculateSimilarity('같은 문장', '같은 문장'), 1);
        assert.equal(u.calculateSimilarity('', 'x'), 0);
        assert.ok(u.calculateSimilarity('짧은 텍스트', '이것은 짧은 텍스트') > 0.5); // 포함 관계
        assert.equal(u.calculateSimilarity('alpha beta', 'gamma delta'), 0);
    });

    test('getWordDiff: 동일 텍스트는 전부 same', () => {
        const d = u.getWordDiff('one two three', 'one two three');
        assert.ok(d.every(x => x.type === 'same'));
        assert.equal(d.length, 3);
    });

    test('getWordDiff: same/deleted로 원본, same/added로 수정본 복원 가능', () => {
        const a = 'the quick brown fox jumps.';
        const b = 'the slow brown fox leaps high.';
        const d = u.getWordDiff(a, b);
        const reconA = d.filter(x => x.type !== 'added').map(x => x.textA + x.spaceA).join('').trim();
        const reconB = d.filter(x => x.type !== 'deleted').map(x => x.textB + x.spaceB).join('').trim();
        assert.equal(reconA, a);
        assert.equal(reconB, b);
    });

    test('getWordDiff: 크기 안전장치 초과 시 null', () => {
        const big = (p) => Array.from({ length: 1100 }, (_, i) => p + i).join(' ');
        assert.equal(u.getWordDiff(big('a'), big('b')), null);
    });

    test('getWordDiffForDocx: word/space 형식으로 변환', () => {
        const d = u.getWordDiffForDocx('old word here', 'new word here');
        assertSameJson(d[0], { type: 'deleted', word: 'old', space: '' });
        assertSameJson(d[1], { type: 'added', word: 'new', space: ' ' });
        assert.equal(d[2].type, 'same');
    });

    test('getWordDiffForDocx: 안전장치 초과 시 전체 삭제+추가 폴백', () => {
        const big = (p) => Array.from({ length: 1100 }, (_, i) => p + i).join(' ');
        const d = u.getWordDiffForDocx(big('a'), big('b'));
        assert.equal(d.length, 2200);
        assert.ok(d.slice(0, 1100).every(x => x.type === 'deleted'));
        assert.ok(d.slice(1100).every(x => x.type === 'added'));
    });

    test('highlightModifiedLine: 클래스 기반 하이라이트 + HTML 이스케이프', () => {
        const r = u.highlightModifiedLine('H<sub>2</sub>O 물질', 'H<sub>2</sub>O 물체');
        assert.ok(r.htmlA.includes('class="diff-word-deleted"'));
        assert.ok(r.htmlB.includes('class="diff-word-added"'));
        assert.ok(r.htmlA.includes('&lt;sub&gt;'));
        assert.ok(!r.htmlA.includes('style='));

        const same = u.highlightModifiedLine('동일', '동일');
        assert.equal(same.htmlA, same.htmlB);
    });
});

describe('특허 문서 판별', () => {
    test('isClaimsStartLine', () => {
        assert.ok(u.isClaimsStartLine('WHAT IS CLAIMED IS:'));
        assert.ok(u.isClaimsStartLine('what is claimed is'));
        assert.ok(u.isClaimsStartLine('【청구범위】'));
        assert.ok(!u.isClaimsStartLine('CLAIMS OVERVIEW'));
    });

    test('isCrossRefLine', () => {
        assert.ok(u.isCrossRefLine('CROSS-REFERENCE TO RELATED APPLICATIONS'));
        assert.ok(u.isCrossRefLine('cross reference to related application'));
        assert.ok(!u.isCrossRefLine('CROSS-REFERENCE NOTES'));
    });

    test('isPatentSectionSubtitle', () => {
        assert.ok(u.isPatentSectionSubtitle('BACKGROUND'));
        assert.ok(u.isPatentSectionSubtitle('【표 1】'));
        assert.ok(u.isPatentSectionSubtitle('[Table 2]'));
        assert.ok(u.isPatentSectionSubtitle('1. Field'));
        assert.ok(u.isPatentSectionSubtitle('실시예 1'));
        assert.ok(!u.isPatentSectionSubtitle('This is a normal sentence.'));
    });

    test('isGenericSubtitle 기본/옵션', () => {
        assert.ok(u.isGenericSubtitle('【발명의 명칭】'));
        assert.ok(u.isGenericSubtitle('DETAILED DESCRIPTION'));
        assert.ok(!u.isGenericSubtitle('Description of Symbols'));
        assert.ok(u.isGenericSubtitle('Description of Symbols', { checkSymbols: true }));
        assert.ok(!u.isGenericSubtitle('1. Field'));
        assert.ok(u.isGenericSubtitle('1. Field', { checkNumberedHeading: true }));
        assert.ok(!u.isGenericSubtitle('1. This sentence ends with a period.', { checkNumberedHeading: true }));
    });
});

describe('DOCX 생성 헬퍼', () => {
    test('makeDocxStylesXml: 단락 뒤 간격 0pt 명시', () => {
        const xml = u.makeDocxStylesXml();
        assert.ok(xml.includes('<w:spacing w:after="0"/>'));
        assert.ok(!xml.includes('w:sz'));

        const sized = u.makeDocxStylesXml({ fontSize: 24 });
        assert.ok(sized.includes('<w:sz w:val="24"/>'));
        assert.ok(sized.includes('<w:spacing w:after="0"/>'));
    });
});
