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

describe('마침표 누락 단락 검출', () => {
    const level = (line) => {
        const r = u.classifyMissingPeriodPara(line);
        return r ? r.level : null;
    };

    test('국문 문장 종결어미 → 마침표 누락 의심', () => {
        assert.equal(level('본 발명의 일 실시예에 따른 표시장치는 기판 상에 배치된 화소를 포함한다'), 'high');
        assert.equal(level('이때 제1 전극과 제2 전극은 서로 이격되어 배치될 수 있다'), 'high');
        assert.equal(level('도 1은 본 발명의 일 실시예에 따른 표시장치의 평면도이다'), 'high');
        assert.equal(level('상기 구조로 인해 효율이 향상된다)'), 'high'); // 끝 괄호는 무시
        assert.equal(level('그러하다'), null); // 너무 짧음
    });

    test('마침표가 있으나 규칙이 인식하지 못하는 형태', () => {
        assert.equal(level('상기 화소는 발광층을 포함한다．'), 'high');   // 전각 마침표
        assert.equal(level('상기 화소는 발광층을 포함한다.)'), 'high');   // 마침표 + 닫는 괄호
        assert.equal(level('상기 화소는 발광층을 포함한다.”'), 'high');   // 마침표 + 둥근 따옴표
        assert.equal(level('상기 화소는 발광층을 포함한다.'), null);      // 규칙 충족 → 대상 아님
        assert.equal(level('상기 화소는 발광층을 포함한다."'), null);     // 규칙 충족(마침표 + ")
    });

    test('영문 문장 / 짧은 문장', () => {
        assert.equal(level('The display device includes a pixel disposed on the substrate'), 'high');
        assert.equal(level('The pixel may include a layer'), 'low');
        assert.equal(level('BRIEF DESCRIPTION'), null); // 대문자 제목
        assert.equal(level('10 substrate 20 pixel'), null); // 도면부호 나열
    });

    test('부제목·표·수식·나열은 의심 대상 아님', () => {
        assert.equal(level('【발명의 상세한 설명】'), null);
        assert.equal(level('<table border="1"><tr><td>A</td></tr></table>'), null);
        assert.equal(level('y = ax + b'), null);
        assert.equal(level('10: 기판, 20: 화소'), null);
        assert.equal(level('상기 표시장치는 다음의 구성을 포함한다:'), null); // 콜론 도입부
        assert.equal(level('제1 전극 및'), null); // 이어지는 조각
    });

    test('findMissingPeriodParas: 범위·제외 규칙 적용 + 행 번호 보고', () => {
        const text = [
            'CROSS-REFERENCE TO RELATED APPLICATIONS',                    // 1 (이 줄부터 대상)
            'This application claims priority to KR 10-2026-0000001.',    // 2 마침표 있음
            'BACKGROUND',                                                 // 3 부제목
            '반도체 장치의 집적도가 지속적으로 증가하고 있다',              // 4 ← 의심 (high)
            '[0001] 이미 번호가 부여된 단락이다',                          // 5 번호 있음 → 제외
            '<table><tr><td>표 안의 문장이 마침표 없이 끝난다</td></tr></table>', // 6 표 → 제외
            'WHAT IS CLAIMED IS:',                                        // 7 이후 제외
            '1. 기판을 포함하는 반도체 장치',                              // 8 청구항 → 제외
        ].join('\n');

        const found = u.findMissingPeriodParas(text);
        assert.equal(found.length, 1);
        assert.equal(found[0].line, 4);
        assert.equal(found[0].level, 'high');
        assert.ok(found[0].label.includes('종결어미'));
    });

    test('findMissingPeriodParas: CROSS-REFERENCE 이전 단락은 제외', () => {
        const text = [
            '표시장치의 제조 방법이 개시되어 있다',                         // 1 (CROSS-REF 이전 → 제외)
            'CROSS-REFERENCE TO RELATED APPLICATIONS',                    // 2
            '상기 방법은 기판을 준비하는 단계를 포함한다',                  // 3 ← 의심
        ].join('\n');

        const found = u.findMissingPeriodParas(text);
        assert.equal(found.length, 1);
        assert.equal(found[0].line, 3);
    });

    test('findMissingPeriodParas: isSubtitle 주입 (탭2·3 = isGenericSubtitle 기준)', () => {
        const text = [
            'DETAILED DESCRIPTION OF THE EMBODIMENTS',                       // 1 대문자 부제
            '[Symbols]',                                                     // 2 [] 부제
            'Description of Symbols',                                        // 3 checkSymbols 옵션 대상
            'The substrate may be formed of glass or plastic material'       // 4 ← 의심
        ].join('\n');

        const found = u.findMissingPeriodParas(text, {
            isSubtitle: (l) => u.isGenericSubtitle(l, { checkSymbols: true })
        });
        assert.equal(found.length, 1);
        assert.equal(found[0].line, 4);
        assert.equal(found[0].level, 'high');

        // checkSymbols 없이 판별하면 'Description of Symbols'는 부제로 걸러지지 않지만
        // 문장 형태가 아니므로(4단어) 여전히 의심 대상이 아니다
        assert.equal(u.findMissingPeriodParas(text, { isSubtitle: u.isGenericSubtitle }).length, 1);
    });

    test('findMissingPeriodParas: isTargetLine·isClaimsStart 주입 (한영혼합본)', () => {
        const lines = [
            '상기 화소는 발광층을 포함하여 구성된다',      // 1 국문 → 의심
            'The pixel includes a light emitting layer',  // 2 영문 라인 → 번호 대상 아님
            '청구범위',                                   // 3 색변환 로직의 청구항 시작
            '기판을 포함하는 표시 장치는 다음과 같다'      // 4 청구항 이후 → 제외
        ];
        const found = u.findMissingPeriodParas(lines.join('\n'), {
            isTargetLine: (t) => /[가-힣]/.test(t),
            isClaimsStart: (l) => u.isClaimsStartLine(l) || l.trim() === '청구범위'
        });
        assert.equal(found.length, 1);
        assert.equal(found[0].line, 1);
    });

    test('formatMissingPeriodSummary', () => {
        assert.equal(u.formatMissingPeriodSummary([]), '');
        assert.equal(u.formatMissingPeriodSummary(null), '');
        assert.equal(u.formatMissingPeriodSummary([{ level: 'low' }]), '마침표 누락 의심 단락 1건');
        assert.equal(u.formatMissingPeriodSummary([{ level: 'high' }, { level: 'low' }]),
            '마침표 누락 의심 단락 2건(누락 가능성 높음 1건 포함)');
    });

    test('findMissingPeriodParas: 빈 입력/정상 문서는 0건', () => {
        assert.equal(u.findMissingPeriodParas('').length, 0);
        assert.equal(u.findMissingPeriodParas(null).length, 0);
        assert.equal(u.findMissingPeriodParas('BACKGROUND\n정상적으로 마침표로 끝나는 단락이다.').length, 0);
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

    test('mdDocxCellMarginsXml: 글꼴 비례 셀 여백', () => {
        const m = u.mdDocxCellMarginsXml(12); // em=240 → lr=132, tb=84
        assert.ok(m.includes('<w:tblCellMar>') && m.includes('</w:tblCellMar>'));
        assert.ok(m.includes('<w:left w:w="132" w:type="dxa"/>'));
        assert.ok(m.includes('<w:right w:w="132" w:type="dxa"/>'));
        assert.ok(m.includes('<w:top w:w="84" w:type="dxa"/>'));
        assert.ok(m.includes('<w:bottom w:w="84" w:type="dxa"/>'));
        // 글꼴이 커지면 여백도 커짐
        const big = u.mdDocxCellMarginsXml(20);
        assert.ok(big.includes('w:w="220"')); // lr = 20*20*0.55
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

describe('.fin 변환 순수 헬퍼', () => {
    // 최소 IR (fin-parser의 parseFinFile 결과 형태)
    const ir = {
        meta: { fileName: 'sample.fin' },
        titleRaw: '연마 슬러리{POLISHING SLURRY}',
        titleKo: '연마 슬러리', titleEn: 'POLISHING SLURRY',
        technicalField: [{ num: '0001', text: '본 개시는 A에 관한 것이다.' }],
        backgroundArt: [{ num: '0002', text: '배경 기술 설명.' }],
        techProblem: [{ num: '0003', text: '과제.' }],
        techSolution: [{ num: '0004', text: 'SiO<sub>2</sub> 해결.' }],
        advantageousEffects: [],
        descriptionOfDrawings: [{ num: '0004b', text: '도 1은 A이다.\n도 2는 B이다.' }],
        embodiments: [
            { kind: 'p', num: '0005', text: '실시예 설명.' },
            { kind: 'table', num: '1', html: '<table border="1"><tr><td>a</td><td>b</td></tr></table>' }
        ],
        referenceSigns: [{ num: '0008', text: 'SUB: 기판\nTR: 트랜지스터' }],
        claims: [{ num: '1', text: 'A;\nB를 포함하는 장치.' }],
        abstract: { summary: [{ num: '0001a', text: '요약 내용.' }], figureNum: '6' },
        drawings: [
            { num: '1', file: 'pat00001.jpg', fmt: 'jpg', mime: 'image/jpeg', wi: 100, he: 50, base64: 'AAAA' }
        ]
    };

    test('finMmToEmu: 1mm = 36000 EMU, 최소 1', () => {
        assert.equal(u.finMmToEmu(109), 3924000);
        assert.equal(u.finMmToEmu(0), 1);
        assert.equal(u.finMmToEmu(-5), 1);
    });

    test('finParseHtmlTable + finLayoutTableGrid: 가로/세로 병합 그리드 배치', () => {
        // 첨부 이미지형 표 축약: 헤더(가로 병합) + Example(세로 병합) + 값(세로 병합)
        const html = '<table>'
            + '<tr><td rowspan="2"></td><td rowspan="2"></td><td colspan="2">Energy</td><td colspan="2">Device</td></tr>'
            + '<tr><td>A Host</td><td>B Host</td><td>Cd/A</td><td>T97</td></tr>'
            + '<tr><td rowspan="2">Ex 1</td><td>HOMO</td><td>-5.58</td><td>-5.42</td><td rowspan="2">11.83</td><td rowspan="2">105%</td></tr>'
            + '<tr><td>LUMO</td><td>-1.88</td><td>-1.99</td></tr>'
            + '</table>';
        const grid = u.finLayoutTableGrid(u.finParseHtmlTable(html));
        assert.equal(grid.maxCols, 6);
        assert.equal(grid.rows.length, 4);
        // 각 행 슬롯이 그리드 전체(6열)를 채움
        for (const slots of grid.rows) {
            assert.equal(slots.reduce((a, s) => a + s.colspan, 0), 6);
        }
        // 행0: 세로 병합 시작 2 + 가로 병합 2
        assertSameJson(grid.rows[0].map(s => [s.colspan, s.vMerge]),
            [[1, 'restart'], [1, 'restart'], [2, null], [2, null]]);
        // 행1: 세로 병합 이어짐 2 + 헤더 4
        assertSameJson(grid.rows[1].map(s => [s.colspan, s.vMerge]),
            [[1, 'continue'], [1, 'continue'], [1, null], [1, null], [1, null], [1, null]]);
        // 행3: Ex1 이어짐 + LUMO/값2 + 우측 값 이어짐 2
        assertSameJson(grid.rows[3].map(s => [s.colspan, s.vMerge, s.content]),
            [[1, 'continue', ''], [1, null, 'LUMO'], [1, null, '-1.88'], [1, null, '-1.99'],
             [1, 'continue', ''], [1, 'continue', '']]);
        // 행2: 시작 셀 내용 확인
        assert.equal(grid.rows[2][0].content, 'Ex 1');
        assert.equal(grid.rows[2][0].vMerge, 'restart');
        assert.equal(grid.rows[2][4].content, '11.83');
    });

    test('finRopksBaseName: 해외관리번호 → 파일명', () => {
        assert.equal(u.finRopksBaseName('OPP20123456US', '260709'), 'OPP20123456ROPKS_260709');
        assert.equal(u.finRopksBaseName('OPP20123456us', '260709'), 'OPP20123456ROPKS_260709'); // 소문자 us
        assert.equal(u.finRopksBaseName('  OPP20999999US  ', '260709'), 'OPP20999999ROPKS_260709'); // 공백 트림
        assert.equal(u.finRopksBaseName('', '260709'), 'ROPKS_260709'); // 미입력
        assert.equal(u.finRopksBaseName(null, '260709'), 'ROPKS_260709');
    });

    test('finNormalizeScripts: 유니코드 첨자 → <sub>/<sup>', () => {
        assert.equal(u.finNormalizeScripts('H₂SO₄'), 'H<sub>2</sub>SO<sub>4</sub>');
        assert.equal(u.finNormalizeScripts('S₂O₈²⁻'), 'S<sub>2</sub>O<sub>8</sub><sup>2-</sup>');
        assert.equal(u.finNormalizeScripts('CO²'), 'CO<sup>2</sup>');
        assert.equal(u.finNormalizeScripts('일반 텍스트'), '일반 텍스트');
        assert.equal(u.finNormalizeScripts('SiO<sub>2</sub>'), 'SiO<sub>2</sub>'); // 기존 태그 보존
        assert.equal(u.finNormalizeScripts('<sub>₂</sub>'), '<sub>₂</sub>'); // 태그 내부는 미변환(중첩 방지)
        assert.equal(u.finNormalizeScripts('H₂O<sub>2</sub>파'), 'H<sub>2</sub>O<sub>2</sub>파'); // 혼재 처리
    });

    test('finCleanMultiline: 빈 줄 제거 + trim', () => {
        assert.equal(u.finCleanMultiline('도 1은 A.\n\n도 2는 B.\n'), '도 1은 A.\n도 2는 B.');
        assert.equal(u.finCleanMultiline('  x  '), 'x');
        assert.equal(u.finCleanMultiline('a\n \n \nb'), 'a\nb');
        assert.equal(u.finCleanMultiline(''), '');
    });

    test('findSuspiciousInText: 의심 문자 행 기반 검출 (.docx)', () => {
        const text = 'AB₂C\n정상 문장.\nX** Y*? Z?* W?\n？전각 문장';
        const items = u.findSuspiciousInText(text);
        const byLabel = Object.fromEntries(items.map(i => [i.label, i]));
        // 유니코드 첨자: 1건, 1행, 앞뒤 발췌
        assert.equal(byLabel['유니코드 첨자'].count, 1);
        assertSameJson(byLabel['유니코드 첨자'].occurrences[0],
            { line: 1, before: 'AB', match: '₂', after: 'C' });
        // 조합 패턴 우선 매칭: "*?"/"?*"에 소비된 ?는 단독 "?"로 중복 집계하지 않음
        assert.equal(byLabel['"**"'].count, 1);
        assert.equal(byLabel['"*?"'].count, 1);
        assert.equal(byLabel['"?*"'].count, 1);
        assert.equal(byLabel['"?"'].count, 2); // W?(반각) + ？(전각)
        assert.equal(byLabel['"?"'].occurrences[1].line, 4);
        // 정상 텍스트/<sub> 태그는 미검출
        assert.equal(u.findSuspiciousInText('SiO<sub>2</sub>를 포함하는 정상 문장.').length, 0);
        assert.equal(u.findSuspiciousInText('').length, 0);
    });

    test('findSuspiciousInParas: 단락번호 위치 표기 (.fin)', () => {
        const items = u.findSuspiciousInParas([
            { loc: '[0002]', text: '배경기술 H₂O₂ 포함.' },
            { loc: '【청구항 1】', text: '온도 300?에서 처리.' },
            { loc: '[표 1]', text: 'Ex | A** | B' }
        ]);
        const byLabel = Object.fromEntries(items.map(i => [i.label, i]));
        assert.equal(byLabel['유니코드 첨자'].count, 2);
        assert.equal(byLabel['유니코드 첨자'].occurrences[0].loc, '[0002]');
        assert.equal(byLabel['"?"'].count, 1);
        assert.equal(byLabel['"?"'].occurrences[0].loc, '【청구항 1】');
        assert.equal(byLabel['"**"'].occurrences[0].loc, '[표 1]');
        assert.equal(u.findSuspiciousInParas([]).length, 0);
    });

    test('findSuspiciousInParas: 본문 인라인 이미지 경고 항목', () => {
        const items = u.findSuspiciousInParas([
            { loc: '[0002]', text: '정상 단락.' },
            { loc: '[0010]', text: '과이황산이온 포함.', inlineImgs: 2 },
            { loc: '[0011]', text: '', inlineImgs: 1 }
        ]);
        assert.equal(items.length, 1); // 텍스트 패턴 없음 + 이미지 항목 1개
        const img = items[0];
        assert.equal(img.label, '본문 인라인 이미지(이미지로 임베드됨)');
        assert.equal(img.count, 3); // 이미지 총 개수
        assert.equal(img.occurrences.length, 2); // 단락별 1건
        assert.equal(img.occurrences[0].loc, '[0010]');
        assert.ok(img.occurrences[0].match.includes('2개'));
        assert.ok(img.occurrences[0].after.includes('과이황산이온'));
        assert.equal(img.occurrences[1].loc, '[0011]');
        // 이미지 없는 단락만 있으면 항목 없음
        assert.equal(u.findSuspiciousInParas([{ loc: '[0001]', text: '정상.' }]).length, 0);
        // 마커 텍스트 자체는 검사/발췌 대상 아님
        const mk = '<img data-finimg="pat00099.png" data-wi="3" data-he="3" data-fmt="png">';
        assert.equal(u.findSuspiciousInParas([{ loc: '[0001]', text: `온도${mk} 유지.` }]).length, 0);
    });

    test('본문 인라인 이미지 마커: 라인 텍스트에서 제거, docx 모델에는 유지', () => {
        const mk = '<img data-finimg="pat00099.png" data-wi="3" data-he="3" data-fmt="png">';
        const ir2 = { technicalField: [{ num: '0001', text: `온도 300${mk} 이상.` }] };
        const kipo = u.finBuildKipoLineText(ir2);
        assert.ok(!kipo.includes('data-finimg')); // 표시/복사용 텍스트에서는 제거
        assert.ok(kipo.includes('온도 300 이상.'));
        const ropksLine = u.finBuildRopksLineText(ir2);
        assert.ok(!ropksLine.includes('data-finimg'));
        assert.ok(ropksLine.includes('온도 300 이상.'));
        // docx 모델에는 마커 유지 → fin-docx가 이미지 런으로 임베드
        const model = u.finBuildDocModel(ir2, 'ropks');
        assert.ok(model.some(b => b.t === 'p' && String(b.text).includes('data-finimg="pat00099.png"')));
    });

    test('finImgFormatToMime', () => {
        assert.equal(u.finImgFormatToMime('jpg'), 'image/jpeg');
        assert.equal(u.finImgFormatToMime('JPEG'), 'image/jpeg');
        assert.equal(u.finImgFormatToMime('png'), 'image/png');
        assert.equal(u.finImgFormatToMime(''), 'image/jpeg');
    });

    test('finBuildKipoLineText: 국문 【】 부제 + 제목 분리 + [NNNN] 단락번호', () => {
        const t = u.finBuildKipoLineText(ir);
        assert.ok(t.includes('【발명의 명칭】\n연마 슬러리\nPOLISHING SLURRY')); // 국문/영문 분리
        assert.ok(t.includes('【기술분야】\n[0001] 본 개시는'));
        assert.ok(t.includes('【발명의 배경이 되는 기술】')); // KIPO 공식 서식 부제 (background-art)
        assert.ok(t.includes('【해결하고자 하는 과제】')); // KIPO 공식 서식 부제 (tech-problem)
        assert.ok(!t.includes('【해결하려는 과제】'));
        assert.ok(t.includes('【과제의 해결 수단】\n[0004] SiO<sub>2</sub> 해결.'));
        assert.ok(t.includes('【도면의 간단한 설명】\n[0004b] 도 1은 A이다.\n도 2는 B이다.')); // br → 여러 줄, 번호는 첫 줄만
        assert.ok(t.includes('[표 1]'));
        assert.ok(t.includes('<table border="1">'));
        assert.ok(t.includes('【부호의 설명】\n[0008] SUB: 기판\nTR: 트랜지스터'));
        assert.ok(t.includes('【청구범위】\n【청구항 1】\nA;\nB를 포함하는 장치.'));
        assert.ok(t.includes('【대표도】\n도 6'));
        assert.ok(t.includes('【도면】\n【도 1】'));
        assert.ok(!t.includes('【발명의 효과】'));
    });

    test('finBuildKipoLineText(numbered=false): [NNNN] 단락번호 제외', () => {
        const t = u.finBuildKipoLineText(ir, false);
        assert.ok(!/^\[\d{4,5}\]\s/m.test(t)); // 단락번호 없음
        assert.ok(t.includes('【기술분야】\n본 개시는'));
        assert.ok(t.includes('【발명을 실시하기 위한 구체적인 내용】\n실시예 설명.')); // embodiment 번호도 제외
        assert.ok(t.includes('[표 1]')); // 표 캡션은 유지
        assert.ok(t.includes('【부호의 설명】\nSUB: 기판\nTR: 트랜지스터'));
        // 부제/본문 구성은 numbered=true와 동일
        assert.ok(t.includes('【청구범위】\n【청구항 1】'));
    });

    test('finBuildRopksLineText: 변환결과(ROPKS 기준) 라인 텍스트', () => {
        const t = u.finBuildRopksLineText(ir);
        assert.ok(t.includes('TITLE OF THE INVENTION\n연마 슬러리{POLISHING SLURRY}')); // 부제 영문 + 제목 국문{영문}
        assert.ok(t.includes('WHAT IS CLAIMED IS:\n【청구항 1】\nA;\nB를 포함하는 장치.'));
        assert.ok(t.includes('<Description of symbols>\nSUB: 기판\nTR: 트랜지스터'));
        assert.ok(t.includes('[표 1]'));
        assert.ok(t.includes('<table border="1">'));
        assert.ok(t.includes('대표도: 도 6'));
        assert.ok(t.includes('【도면】\n【도 1】'));
        assert.ok(!/^\[0\d{3}\]/m.test(t)); // ROPKS는 단락번호 없음
        assert.ok(!t.includes('【발명의 명칭】')); // 국문 부제 아님
    });

    test('finBuildDocModel(ropks): 사무소표준US 부제 + 도면 섹션', () => {
        const m = u.finBuildDocModel(ir, 'ropks');
        const subs = m.filter(b => b.t === 'p' && b.bold).map(b => b.text);
        assertSameJson(subs, [
            'TITLE OF THE INVENTION', 'BACKGROUND OF THE INVENTION',
            '(a) Field of the Invention', '(b) Description of the Related Art',
            'SUMMARY OF THE INVENTION', 'BRIEF DESCRIPTION OF THE DRAWINGS',
            'DETAILED DESCRIPTION OF THE EMBODIMENTS', '<Description of symbols>',
            'WHAT IS CLAIMED IS:', 'ABSTRACT OF DISCLOSURE'
        ]); // 부제는 볼드+밑줄, 【도면】/【도 N】/청구항 헤더는 볼드 아님
        const texts = m.filter(b => b.t === 'p').map(b => b.text);
        assert.ok(texts.includes('연마 슬러리{POLISHING SLURRY}')); // ROPKS 제목은 국문{영문} 유지
        assert.ok(texts.includes('본 개시는 A에 관한 것이다.'));       // 단락번호 없음
        assert.ok(texts.includes('도 1은 A이다.') && texts.includes('도 2는 B이다.')); // 도면설명 분리
        assert.ok(texts.includes('[표 1]'));
        assert.ok(texts.includes('【청구항 1】'));
        assert.ok(texts.includes('대표도: 도 6'));
        assert.ok(texts.includes('【도 1】'));
        // 본문 단락은 첫줄 들여쓰기, 부제는 들여쓰기 없음
        assert.ok(m.find(b => b.text === '본 개시는 A에 관한 것이다.').indent === true);
        assert.ok(!m.find(b => b.text === 'TITLE OF THE INVENTION').indent);
        // 【도면】은 볼드 아님·중앙정렬·줄번호 생략
        const domyeon = m.find(b => b.text === '【도면】');
        assert.ok(domyeon && !domyeon.bold && domyeon.align === 'center' && domyeon.suppressLineNum === true);
        // 도면 섹션(【도 N】·이미지)은 모두 줄번호 생략
        assert.ok(m.find(b => b.text === '【도 1】').suppressLineNum === true);
        assert.ok(m.some(b => b.t === 'table'));
        assert.ok(m.some(b => b.t === 'img' && b.drawing.num === '1' && b.suppressLineNum === true));
        // 본문(TITLE)은 줄번호 생략하지 않음
        assert.ok(!m.find(b => b.text === 'TITLE OF THE INVENTION').suppressLineNum);
        assert.ok(!texts.some(t => /^\[0\d{3}\]/.test(t)));
        // 섹션별 페이지 나누기(pageBreakBefore): 청구범위/요약서/도면
        assert.ok(m.find(b => b.text === 'WHAT IS CLAIMED IS:').pageBreakBefore === true);
        assert.ok(m.find(b => b.text === 'ABSTRACT OF DISCLOSURE').pageBreakBefore === true);
        assert.ok(m.find(b => b.text === '【도면】').pageBreakBefore === true);
        // 빈 텍스트 단락이 없어야 함(빈줄 방지)
        assert.ok(!m.some(b => b.t === 'p' && b.text === ''));
    });

    test('finBuildDocModel(ropks, {crossRef}): 삽입된 Cross-reference를 BACKGROUND 앞에 포함', () => {
        const xrefText = '본 출원은 2026년 01월 29일 출원된 대한민국 특허출원 제10-2026-0017835호에 기초한 것으로서, 그 전체 내용이 참조로 여기에 포함된다.';
        const m = u.finBuildDocModel(ir, 'ropks', {
            crossRef: { title: 'CROSS-REFERENCE TO RELATED APPLICATIONS', text: xrefText }
        });
        const texts = m.filter(b => b.t === 'p').map(b => b.text);
        const xrefIdx = texts.indexOf('CROSS-REFERENCE TO RELATED APPLICATIONS');
        // 제목(TITLE) 뒤, BACKGROUND 앞에 부제+본문 순으로 삽입
        assert.ok(xrefIdx > texts.indexOf('TITLE OF THE INVENTION'));
        assert.ok(xrefIdx < texts.indexOf('BACKGROUND OF THE INVENTION'));
        assert.equal(texts[xrefIdx + 1], xrefText);
        // 부제는 볼드·들여쓰기 없음, 본문은 첫줄 들여쓰기
        const sub = m.find(b => b.text === 'CROSS-REFERENCE TO RELATED APPLICATIONS');
        assert.ok(sub.bold === true && !sub.indent);
        assert.ok(m.find(b => b.text === xrefText).indent === true);
        // title 생략 시 기본 제목 사용, crossRef 미지정/텍스트 없음이면 미포함
        const m2 = u.finBuildDocModel(ir, 'ropks', { crossRef: { text: xrefText } });
        assert.ok(m2.some(b => b.text === 'CROSS-REFERENCE TO RELATED APPLICATIONS'));
        const m3 = u.finBuildDocModel(ir, 'ropks');
        assert.ok(!m3.some(b => String(b.text).includes('CROSS-REFERENCE')));
        const m4 = u.finBuildDocModel(ir, 'ropks', { crossRef: { title: 'CROSS-REFERENCE TO RELATED APPLICATIONS' } });
        assert.ok(!m4.some(b => String(b.text).includes('CROSS-REFERENCE')));
    });

    test('finBuildDocModel(kipo): 4부 구조 + 페이지 나누기 + [NNNN] 단락번호', () => {
        const m = u.finBuildDocModel(ir, 'kipo');
        const bold = m.filter(b => b.t === 'p' && b.bold).map(b => b.text);
        // 부(部) 중앙 헤더
        assert.ok(bold.includes('명세서') && bold.includes('청구범위') && bold.includes('요약서') && bold.includes('도면'));
        assert.ok(bold.includes('【발명의 명칭】') && bold.includes('【청구항 1】'));
        assert.ok(!bold.includes('【발명의 설명】')); // KIPO 출원서식은 【발명의 설명】 없음
        const parthdr = m.find(b => b.text === '명세서');
        assert.equal(parthdr.align, 'center'); assert.equal(parthdr.size, 30);
        // 페이지 나누기 3곳(청구범위/요약서/도면)
        assert.equal(m.filter(b => b.t === 'pagebreak').length, 3);
        const texts = m.filter(b => b.t === 'p').map(b => b.text);
        assert.ok(texts.includes('연마 슬러리') && texts.includes('POLISHING SLURRY')); // 제목 분리
        assert.ok(texts.includes('[0001] 본 개시는 A에 관한 것이다.')); // 단락번호 있음
        // 도면설명은 각 행이 개별 단락(양쪽맞춤 시 늘어남 방지), 번호는 첫 줄만
        assert.ok(texts.includes('[0004b] 도 1은 A이다.') && texts.includes('도 2는 B이다.'));
        assert.ok(!texts.some(t => t.includes('\n'))); // 개별 단락이므로 내부 \n(br) 없음
        // 청구항 본문: 각 행이 개별 단락 + 행마다 들여쓰기(indent)
        assert.ok(texts.includes('A;') && texts.includes('B를 포함하는 장치.'));
        assert.ok(m.find(b => b.text === 'A;').indent === true);
        assert.ok(m.find(b => b.text === 'B를 포함하는 장치.').indent === true);
        assert.ok(texts.includes('[도 1]')); // 도면 캡션은 대괄호
        // 도면: 이미지 다음에 [도 N] 캡션
        const imgIdx = m.findIndex(b => b.t === 'img');
        assert.equal(m[imgIdx + 1].text, '[도 1]');
    });
});

describe('US양식 DOCX 공통 부품', () => {
    test('makeUSSeqFieldRunsXml: 일반 모드 (instrText/w:t)', () => {
        const n = u.makeUSSeqFieldRunsXml('0003', false);
        assert.ok(n.includes(' SEQ ParagraphNum \\# "0000" '));
        assert.ok(n.includes('<w:instrText'));
        assert.ok(n.includes('>0003<'));
        assert.ok(n.includes('<w:noProof/>'));
        assert.ok(!n.includes('delText') && !n.includes('delInstrText'));
        // [ ... ] + 공백 2개 구조
        assert.ok(n.includes('>[<') && n.includes('>]<') && n.includes('>  <'));
    });

    test('makeUSSeqFieldRunsXml: 삭제 개정 모드 (delInstrText/delText)', () => {
        const d = u.makeUSSeqFieldRunsXml('0004', true);
        assert.ok(d.includes('<w:delInstrText'));
        assert.ok(d.includes('<w:delText xml:space="preserve">0004</w:delText>'));
        assert.ok(!d.includes('<w:instrText ') && !d.includes('<w:t '));
    });

    test('makeUSDocxSectPrXml: 헤더/푸터 ID 주입 + 줄번호/docGrid/A4', () => {
        const s = u.makeUSDocxSectPrXml({
            headerEven: 'h1', headerDefault: 'h2', headerFirst: 'h3',
            footerEven: 'f1', footerDefault: 'f2', footerFirst: 'f3'
        });
        assert.ok(s.includes('w:type="even" r:id="h1"') && s.includes('w:type="default" r:id="h2"'));
        assert.ok(s.includes('w:type="first" r:id="f3"'));
        assert.ok(s.includes('<w:lnNumType w:countBy="5"/>')); // 5행마다 줄번호
        assert.ok(s.includes('w:linePitch="548"'));            // 25행/페이지 docGrid
        assert.ok(s.includes('<w:pgSz w:w="11906" w:h="16838"/>')); // A4
        assert.ok(s.includes('w:top="1440" w:right="1701" w:bottom="1701" w:left="1701"'));
    });

    test('makeUSDocxSettingsXml: trackRevisions 옵션', () => {
        assert.ok(!u.makeUSDocxSettingsXml().includes('trackRevisions'));
        const t = u.makeUSDocxSettingsXml({ trackRevisions: true });
        assert.ok(t.includes('<w:trackRevisions/>'));
        assert.ok(t.includes('<w:revisionView w:formatting="0"/>'));
    });

    test('US양식 부품 기본 구조', () => {
        assert.equal(u.makeUSDocxSpacingXml(), '<w:spacing w:after="0" w:line="548" w:lineRule="exact"/>');
        assert.ok(u.makeUSDocxStylesXml().includes('page number') && u.makeUSDocxStylesXml().includes('w:after="0"'));
        assert.ok(u.makeUSDocxFooterPageXml().includes(' PAGE '));
        assert.ok(u.makeUSDocxFooterFirstXml().includes('<w:ftr'));
        assert.ok(u.makeUSDocxHeaderXml().includes('<w:hdr'));
        assert.ok(u.makeUSDocxNumberingXml().includes('[00%1]'));
    });
});

describe('한영혼합본 문장 단위 분해', () => {
    describe('splitTextIntoSentences', () => {
        test('영문 문장 분리 (참조부호로 끝나는 문장 포함)', () => {
            const s = u.splitTextIntoSentences(
                'The bonding layer 130 is positioned at a gap between the first board 110 and the second board 120. ' +
                'That is, the bonding layer 130 includes an underfill 131.');
            assert.equal(s.length, 2);
            assert.ok(s[0].endsWith('second board 120.'));
            assert.ok(s[1].startsWith('That is,'));
        });
        test('약어(FIG./No./e.g./U.S.)에서는 끊지 않음', () => {
            assert.equal(u.splitTextIntoSentences('Referring to FIG. 1 and FIG. 2, the module includes a board.').length, 1);
            assert.equal(u.splitTextIntoSentences('Korean Patent Application No. 10-2020-0101222 was filed.').length, 1);
            assert.equal(u.splitTextIntoSentences('The device, e.g. An IC chip, is mounted.').length, 1);
            assert.equal(u.splitTextIntoSentences('U.S. Patent documents are cited.').length, 1);
        });
        test('항목 번호(1.)와 소수점에서는 끊지 않음', () => {
            assert.equal(u.splitTextIntoSentences('1. Field of the Invention').length, 1);
            assert.equal(u.splitTextIntoSentences('The thickness is 1.5 mm in this embodiment.').length, 1);
        });
        test('국문 문장 분리', () => {
            const s = u.splitTextIntoSentences(
                '접합층(130)은 제1 기판(110)과 제2 기판(120)의 사이 간격에 개재된다. ' +
                '즉, 접합층(130)은 언더필(underfill)(131)을 포함한다.');
            assert.equal(s.length, 2);
            assert.ok(s[1].startsWith('즉,'));
        });
        test('표(<table>)가 포함된 라인은 분해하지 않음', () => {
            const t = '<table><tr><td>A. B</td><td>C. D</td></tr></table>';
            assertSameJson(u.splitTextIntoSentences(t), [t]);
        });
        test('빈 텍스트는 빈 배열', () => {
            assertSameJson(u.splitTextIntoSentences('  '), []);
        });
    });

    describe('라인 판별', () => {
        test('bilingualLineKind', () => {
            assert.equal(u.bilingualLineKind(''), 'empty');
            assert.equal(u.bilingualLineKind('<pagebreak/>'), 'pagebreak');
            assert.equal(u.bilingualLineKind('제1 기판(110)은 …'), 'korean');
            assert.equal(u.bilingualLineKind('The first board 110 is …'), 'english');
        });
        test('isBilingualHeaderLine', () => {
            assert.ok(u.isBilingualHeaderLine('SUMMARY OF THE INVENTION'));
            assert.ok(u.isBilingualHeaderLine('WHAT IS CLAIMED IS:'));
            assert.ok(u.isBilingualHeaderLine('(a) Field of the Invention'));
            assert.ok(!u.isBilingualHeaderLine('The first board 110 includes a first side.'));
        });
        test('isAbstractStartLine', () => {
            assert.ok(u.isAbstractStartLine('ABSTRACT'));
            assert.ok(u.isAbstractStartLine('Abstract of the Disclosure'));
            assert.ok(!u.isAbstractStartLine('ABSTRACT OF THE INVENTION IS SHOWN BELOW.'));
        });
    });

    describe('decomposeBilingualText', () => {
        const EN1 = 'The first board 110 includes a first side 110a. The second board 120 includes a device accommodating portion 121.';
        const KO1 = '제1 기판(110)은 제1 면(110a)을 포함한다. 제2 기판(120)은 소자 수용부(121)를 포함한다.';

        test('문장 수가 같으면 문장별 pair로 분해하고 그룹 사이를 2행 띄움', () => {
            const src = ['SUMMARY OF THE INVENTION', EN1, KO1, 'A third device 127 is mounted.', '제3 소자(127)가 실장된다.'].join('\n');
            const { text, stats } = u.decomposeBilingualText(src);
            assertSameJson(text.split('\n'), [
                'SUMMARY OF THE INVENTION',
                'The first board 110 includes a first side 110a.',
                '제1 기판(110)은 제1 면(110a)을 포함한다.',
                'The second board 120 includes a device accommodating portion 121.',
                '제2 기판(120)은 소자 수용부(121)를 포함한다.',
                '', '',
                'A third device 127 is mounted.',
                '제3 소자(127)가 실장된다.'
            ]);
            assert.equal(stats.pairCount, 2);
            assert.equal(stats.splitPairCount, 1);
            assert.equal(stats.sentencePairCount, 3);
            assert.equal(stats.groupCount, 2);
        });

        test('문장 수가 다르면 분해하지 않고 보고 목록에 남김', () => {
            const src = [EN1, '제1 기판(110)은 제1 면(110a)을 포함하고, 제2 기판(120)은 소자 수용부(121)를 포함한다.'].join('\n');
            const { text, stats } = u.decomposeBilingualText(src);
            assert.equal(text.split('\n').length, 2);
            assert.equal(stats.splitPairCount, 0);
            assert.equal(stats.mismatched.length, 1);
            assert.equal(stats.mismatched[0].enCount, 2);
            assert.equal(stats.mismatched[0].koCount, 1);
        });

        test('단락번호는 첫 문장에만 유지', () => {
            const src = ['[0001] ' + KO1, EN1].join('\n');
            const lines = u.decomposeBilingualText(src).text.split('\n');
            assert.ok(lines[0].startsWith('[0001] 제1 기판'));
            assert.ok(!lines[2].startsWith('['));
        });

        test('청구항 섹션은 문장 분해하지 않고 간격만 정리', () => {
            const src = [
                'WHAT IS CLAIMED IS:',
                '1.An electronic device module comprising:',
                'a first board including a first side;',
                '제1 면을 포함하는 제1 기판;',
                'a bonding layer bonding the second board to the first board.',
                '상기 제2 기판을 상기 제1 기판에 접합하는 접합층',
                '을 포함하는 전자 소자 모듈.'
            ].join('\n');
            assertSameJson(u.decomposeBilingualText(src).text.split('\n'), [
                'WHAT IS CLAIMED IS:',
                '1.An electronic device module comprising:',
                'a first board including a first side;',
                '제1 면을 포함하는 제1 기판;',
                '', '',
                'a bonding layer bonding the second board to the first board.',
                '상기 제2 기판을 상기 제1 기판에 접합하는 접합층',
                '을 포함하는 전자 소자 모듈.'
            ]);
        });

        test('이미 분해된 문서를 다시 실행해도 결과가 같다 (멱등)', () => {
            const src = ['SUMMARY OF THE INVENTION', EN1, KO1, '', '', 'A third device 127 is mounted.', '제3 소자(127)가 실장된다.'].join('\n');
            const once = u.decomposeBilingualText(src).text;
            assert.equal(u.decomposeBilingualText(once).text, once);
        });

        test('everyPairSeparate 옵션은 입력의 빈 줄을 무시하고 pair마다 분리', () => {
            const src = ['A first device is mounted. A second device is mounted.',
                         '제1 소자가 실장된다. 제2 소자가 실장된다.'].join('\n');
            const lines = u.decomposeBilingualText(src, { everyPairSeparate: true }).text.split('\n');
            assertSameJson(lines, [
                'A first device is mounted.',
                '제1 소자가 실장된다.',
                '', '',
                'A second device is mounted.',
                '제2 소자가 실장된다.'
            ]);
        });

        test('추출 결과는 분해 전후가 동일 (국문/영문 라인 구성 보존)', () => {
            const src = ['SUMMARY OF THE INVENTION', EN1, KO1].join('\n');
            const pick = (t, ko) => t.split('\n')
                .filter(l => l.trim() && (u.bilingualLineKind(l) === (ko ? 'korean' : 'english')))
                .join(' ');
            const out = u.decomposeBilingualText(src).text;
            assert.equal(pick(out, true), pick(src, true));
            assert.equal(pick(out, false), pick(src, false));
        });

        test('짝 없는 라인은 unpaired로 보고', () => {
            const src = ['This application claims priority to Korean Patent Application 10-2020-0101222.',
                         'A device is mounted.', '소자가 실장된다.'].join('\n');
            const { stats } = u.decomposeBilingualText(src);
            assert.equal(stats.unpaired.length, 1);
            assert.equal(stats.unpaired[0].lineNo, 1);
        });

        test('빈 입력은 원본을 그대로 반환', () => {
            assert.equal(u.decomposeBilingualText('').text, '');
            assert.equal(u.decomposeBilingualText('   \n  ').text, '   \n  ');
        });
    });
});
