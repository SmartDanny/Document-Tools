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

describe('Markdown → DOCX 헬퍼 (탭5)', () => {
    test('cssColorToDocxHex: 다양한 표기 → 대문자 6자리 HEX', () => {
        assert.equal(u.cssColorToDocxHex('#dc2626'), 'DC2626');
        assert.equal(u.cssColorToDocxHex('#FFF'), 'FFFFFF');
        assert.equal(u.cssColorToDocxHex('rgb(220, 38, 38)'), 'DC2626');
        assert.equal(u.cssColorToDocxHex('rgba(0, 0, 0, 0.5)'), '000000');
        assert.equal(u.cssColorToDocxHex('transparent'), null);
        assert.equal(u.cssColorToDocxHex(''), null);
        assert.equal(u.cssColorToDocxHex(null), null);
        assert.equal(u.cssColorToDocxHex('red'), null); // 이름 색상 미지원
    });

    test('pxToEmu: 1px=9525EMU, 최소 1', () => {
        assert.equal(u.pxToEmu(1), 9525);
        assert.equal(u.pxToEmu(10), 95250);
        assert.equal(u.pxToEmu(0), 1);
        assert.equal(u.pxToEmu(-5), 1);
    });

    test('mdDocxRunProps: 서식 → rPr XML', () => {
        assert.equal(u.mdDocxRunProps({}), '');
        assert.equal(u.mdDocxRunProps(null), '');
        const bold = u.mdDocxRunProps({ bold: true, italic: true });
        assert.ok(bold.includes('<w:b/>') && bold.includes('<w:i/>'));
        const styled = u.mdDocxRunProps({ color: 'DC2626', bg: 'FEF08A', sz: 48 });
        assert.ok(styled.includes('<w:color w:val="DC2626"/>'));
        assert.ok(styled.includes('w:fill="FEF08A"'));
        assert.ok(styled.includes('<w:sz w:val="48"/>'));
        assert.ok(u.mdDocxRunProps({ code: true }).includes('Consolas'));
        assert.ok(u.mdDocxRunProps({ vertAlign: 'superscript' }).includes('w:val="superscript"'));
    });

    test('mdDocxSectPr: 방향에 따른 A4 크기/orient', () => {
        const p = u.mdDocxSectPr('portrait');
        assert.ok(p.includes('w:w="11906"') && p.includes('w:h="16838"'));
        assert.ok(!p.includes('w:orient'));
        const l = u.mdDocxSectPr('landscape');
        assert.ok(l.includes('w:w="16838"') && l.includes('w:h="11906"'));
        assert.ok(l.includes('w:orient="landscape"'));
    });

    test('mdDocxSectPr: 기본 여백(위 3cm, 나머지 2.54cm) + override', () => {
        const p = u.mdDocxSectPr('portrait');
        // 위 3cm=1701, 아래·좌·우 2.54cm(1inch)=1440
        assert.ok(p.includes('w:top="1701"'));
        assert.ok(p.includes('w:bottom="1440"'));
        assert.ok(p.includes('w:left="1440"'));
        assert.ok(p.includes('w:right="1440"'));
        // 별도 설정이 특정된 경우만 override
        const o = u.mdDocxSectPr('portrait', { top: 500 });
        assert.ok(o.includes('w:top="500"'));
        assert.ok(o.includes('w:bottom="1440"'));
    });

    test('mdDocxContentWidth: 방향/여백 반영한 본문 폭', () => {
        // portrait: 11906 - 1440 - 1440
        assert.equal(u.mdDocxContentWidth('portrait'), 9026);
        // landscape: 16838 - 1440 - 1440
        assert.equal(u.mdDocxContentWidth('landscape'), 13958);
        assert.equal(u.mdDocxContentWidth('portrait', { left: 1000, right: 1000 }), 9906);
    });

    test('mdDistributeColumnWidths: 측정 비율 유지 + 합계 정확', () => {
        // 좁은 라벨 열 + 넓은 텍스트 열 비율이 유지되어야 함
        const w = u.mdDistributeColumnWidths([50, 400, 400], 9000);
        assert.equal(w.reduce((a, b) => a + b, 0), 9000); // 합계 정확
        assert.ok(w[1] > w[0] * 3 && w[2] > w[0] * 3);    // 텍스트 열이 훨씬 넓음
        assert.ok(w[0] >= 200);                            // 최소폭 보장

        // 균등 입력 → 균등 분배
        const eq = u.mdDistributeColumnWidths([100, 100, 100, 100], 8000);
        assert.equal(eq.reduce((a, b) => a + b, 0), 8000);
        assert.ok(eq.every(x => Math.abs(x - 2000) <= 1));

        // 측정 실패(0) → 균등 폴백
        const fb = u.mdDistributeColumnWidths([0, 0, 0], 9000);
        assert.equal(fb.reduce((a, b) => a + b, 0), 9000);

        assert.equal(u.mdDistributeColumnWidths([], 9000).length, 0);
    });

    test('mdDocxImageRunXml: 드로잉 런 + 관계 ID/치수', () => {
        const xml = u.mdDocxImageRunXml({ rid: 'rIdImg1', id: 1, name: 'math1.png', cx: 95250, cy: 47625 });
        assert.ok(xml.includes('<w:drawing>'));
        assert.ok(xml.includes('r:embed="rIdImg1"'));
        assert.ok(xml.includes('<wp:extent cx="95250" cy="47625"/>'));
        assert.ok(xml.includes('<a:ext cx="95250" cy="47625"/>'));
    });

    test('mdDocxHeadingSize: h1~h6 단계별 크기', () => {
        assert.equal(u.mdDocxHeadingSize('h1'), 48);
        assert.equal(u.mdDocxHeadingSize('H2'), 40);
        assert.equal(u.mdDocxHeadingSize('h6'), 24);
        assert.equal(u.mdDocxHeadingSize('p'), 0);
    });
});
