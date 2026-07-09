/**
 * 브라우저 E2E 테스트 (Playwright + Chromium)
 * 실행: npm run test:browser
 *
 * 실제 페이지를 로드해 DOCX 파싱/생성, diff, 판별 함수, 드롭존,
 * 탭 전환 등 주요 흐름을 검증한다. 오프라인 환경을 위해 JSZip CDN
 * 요청은 node_modules의 로컬 사본으로 대체된다.
 *
 * 브라우저 탐색 순서:
 *   1) Playwright 기본 탐색 (npx playwright install chromium)
 *   2) CHROMIUM_PATH 환경변수
 *   3) /opt/pw-browsers/chromium (프리인스톨 환경)
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZipNode = require('jszip');

const ROOT = path.join(__dirname, '..');

// 합성 .fin 픽스처(zip → hlz(zip) → KIPO XML + 도면 이미지) 생성
async function buildSampleFin() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<KIPO keapsVersion="5.6" editorKind="K" pageCount="3" xmlns="http://www.kipo.go.kr"><PatentCAFDOC docflag="1.0" documentID="123"><description><invention-title>테스트 발명{TEST INVENTION}</invention-title><technical-field><p num="0001">기술분야 단락.</p></technical-field><background-art><p num="0002">배경기술.</p></background-art><summary-of-invention><tech-solution><p num="0003">SiO<sub>2</sub> 포함.</p></tech-solution></summary-of-invention><description-of-drawings><p num="0004">도 1은 예시이다.</p></description-of-drawings><description-of-embodiments><p num="0005">실시예 설명.</p><p num="0006"><tables num="1"><table><tgroup xmlns='http://www.oasis-open.org/tables/exchange/1.0' cols="2"><colspec colnum="1" colname="col1"/><colspec colnum="2" colname="col2"/><tbody><row><entry colname="col1">A</entry><entry colname="col2">B</entry></row></tbody></tgroup></table></tables></p><p num="0007">이후 단락.</p></description-of-embodiments><reference-signs-list><p num="0008">SUB: 기판<br/>TR: 트랜지스터</p></reference-signs-list></description><claims><claim num="1"><claim-text>A; <br/>B를 포함하는 장치.</claim-text></claim></claims><abstract><summary><p num="0001a">요약 내용.</p></summary><abstract-figure><p num="0002a"><figref num="1"/></p></abstract-figure></abstract><drawings><figure num="1"><img id="i0001" he="50" wi="50" file="pat00001.png" img-format="png"/></figure></drawings></PatentCAFDOC></KIPO>`;
    const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const hlz = new JSZipNode();
    hlz.file('DOC_251222.xml', xml);
    hlz.file('pat00001.png', png1x1, { base64: true });
    const hlzBuf = await hlz.generateAsync({ type: 'nodebuffer' });
    const fin = new JSZipNode();
    fin.file('xresult.inf', '[APPLICATION]\nAPPNAME=DOC_251222.hlz,2025-12-22,1\n');
    fin.file('DOC_251222.hlz', hlzBuf);
    return fin.generateAsync({ type: 'nodebuffer' });
}

// 간단한 정적 서버
const server = http.createServer((req, res) => {
    const file = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    try {
        const data = fs.readFileSync(file);
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
    } catch (e) {
        res.writeHead(404); res.end('not found');
    }
});

(async () => {
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;
    let browser;
    try {
        browser = await chromium.launch();
    } catch (e) {
        const fallback = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
        browser = await chromium.launch({ executablePath: fallback });
    }
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

    // CDN JSZip 요청을 로컬 파일로 대체 (프록시 차단 우회)
    await page.route('**/jszip/3.10.1/jszip.min.js', route => route.fulfill({
        contentType: 'text/javascript',
        body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'), 'utf-8')
    }));

    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1500);

    const results = await page.evaluate(async () => {
        const out = {};
        const assert = (name, cond, extra) => { out[name] = cond ? 'PASS' : 'FAIL' + (extra ? ' ' + JSON.stringify(extra) : ''); };

        // ===== 기존 getWordDiffForDocx 구현 (리팩토링 전 원본) =====
        function oldGetWordDiffForDocx(textA, textB) {
            const tokenize = (text) => {
                const tokens = []; const regex = /(\S+)(\s*)/g; let match;
                while ((match = regex.exec(text)) !== null) tokens.push({ word: match[1], space: match[2] || '' });
                return tokens;
            };
            const tokensA = tokenize(textA), tokensB = tokenize(textB);
            const m = tokensA.length, n = tokensB.length;
            const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
            for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
                if (tokensA[i-1].word === tokensB[j-1].word) dp[i][j] = dp[i-1][j-1] + 1;
                else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
            }
            const diff = []; let i = m, j = n;
            while (i > 0 || j > 0) {
                if (i > 0 && j > 0 && tokensA[i-1].word === tokensB[j-1].word) {
                    diff.unshift({ type: 'same', word: tokensB[j-1].word, space: tokensB[j-1].space }); i--; j--;
                } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
                    diff.unshift({ type: 'added', word: tokensB[j-1].word, space: tokensB[j-1].space }); j--;
                } else {
                    diff.unshift({ type: 'deleted', word: tokensA[i-1].word, space: '' }); i--;
                }
            }
            return diff;
        }

        // 1) getWordDiffForDocx 동등성 (다양한 케이스)
        const cases = [
            ['the quick brown fox jumps over the lazy dog.', 'the fast brown fox leaps over the dog.'],
            ['동일한 문장입니다.', '동일한 문장입니다.'],
            ['', 'new text only'],
            ['old text only', ''],
            ['a b c d e', 'x y z'],
            ['The device includes a processor, a memory, and a display unit.',
             'The apparatus includes a processor, a storage, and a display unit configured to display images.'],
            ['word', 'word extra   spaced\ttokens here'],
        ];
        let eq = true, firstDiff = null;
        for (const [a, b] of cases) {
            const oldR = JSON.stringify(oldGetWordDiffForDocx(a, b));
            const newR = JSON.stringify(getWordDiffForDocx(a, b));
            if (oldR !== newR) { eq = false; firstDiff = { a, b, oldR, newR }; break; }
        }
        assert('getWordDiffForDocx 동등성', eq, firstDiff);

        // 2) 대용량 폴백 (기존엔 메모리 폭발 위험, 이제 안전장치)
        const bigA = Array.from({length: 3000}, (_, i) => 'wordA' + i).join(' ');
        const bigB = Array.from({length: 3000}, (_, i) => 'wordB' + i).join(' ');
        const bigDiff = getWordDiffForDocx(bigA, bigB);
        assert('getWordDiffForDocx 대용량 폴백', Array.isArray(bigDiff) && bigDiff.length === 6000 &&
            bigDiff[0].type === 'deleted' && bigDiff[5999].type === 'added');

        // 3) 판별 함수
        assert('isClaimsStartLine', isClaimsStartLine('WHAT IS CLAIMED IS:') && isClaimsStartLine('what is claimed is') === true &&
            isClaimsStartLine('【청구범위】') && !isClaimsStartLine('CLAIMS OVERVIEW'));
        assert('isCrossRefLine', isCrossRefLine('CROSS-REFERENCE TO RELATED APPLICATIONS') &&
            isCrossRefLine('cross reference to related application') && !isCrossRefLine('CROSS-REFERENCE NOTES'));
        assert('isPatentSectionSubtitle', isPatentSectionSubtitle('BACKGROUND') && isPatentSectionSubtitle('【표 1】') &&
            isPatentSectionSubtitle('1. Field') && !isPatentSectionSubtitle('This is a normal sentence.'));
        assert('isGenericSubtitle 기본', isGenericSubtitle('【발명의 명칭】') && isGenericSubtitle('DETAILED DESCRIPTION') &&
            !isGenericSubtitle('Description of Symbols') && !isGenericSubtitle('1. Field'));
        assert('isGenericSubtitle 옵션', isGenericSubtitle('Description of Symbols', { checkSymbols: true }) &&
            isGenericSubtitle('1. Field', { checkNumberedHeading: true }) &&
            !isGenericSubtitle('1. This is a long sentence ending with a period.', { checkNumberedHeading: true }));

        // 4) countParagraphsInText
        const sampleText = [
            'TITLE OF THE INVENTION',
            'CROSS-REFERENCE TO RELATED APPLICATIONS',
            'This application claims priority.',
            'BACKGROUND',
            'This is the first paragraph.',
            'This is the second paragraph.',
            'WHAT IS CLAIMED IS:',
            'A device comprising a sensor.'
        ].join('\n');
        assert('countParagraphsInText', countParagraphsInText(sampleText) === 3, countParagraphsInText(sampleText));

        // 5) addParagraphNumbersToText
        const numbered0 = addParagraphNumbersToText([
            'CROSS-REFERENCE TO RELATED APPLICATIONS',
            'This application claims priority.',
            'BACKGROUND',
            'First body paragraph.',
            'WHAT IS CLAIMED IS:',
            'A device comprising a sensor.'
        ].join('\n'));
        const numbered = numbered0.text;
        assert('addParagraphNumbersToText', numbered.includes('[0001] This application claims priority.') &&
            numbered.includes('[0002] First body paragraph.') &&
            numbered0.count === 2 &&
            !numbered.includes('[0003]'), numbered0);

        // 6) DOCX 파싱 (합성 DOCX 생성 → 추출)
        if (typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>2</w:t></w:r><w:r><w:t> world</w:t></w:r></w:p>
<w:p></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Numbered para.</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>cell1</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>c</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r></w:p></w:tc>
<w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p></w:p></w:tc></w:tr></w:tbl>
</w:body></w:document>`;
            const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimalZero"/><w:lvlText w:val="[00%1]"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
            zip.file('word/document.xml', docXml);
            zip.file('word/numbering.xml', numberingXml);
            const blob = await zip.generateAsync({ type: 'blob' });
            const file = new File([blob], 'test.docx');

            // loadDocxDocument + extractDocxBodyText
            const { doc } = await loadDocxDocument(file);
            const bodyText = extractDocxBodyText(doc);
            assert('extractDocxBodyText', bodyText.split('\n').length === 4 &&
                bodyText.includes('Hello <sub>2</sub> world') &&
                bodyText.includes('<td colspan="2">cell1</td>') &&
                bodyText.includes('c<sup>2</sup>') &&
                !bodyText.includes('vMerge'), bodyText);

            const bodyTextSkip = extractDocxBodyText(doc, { skipEmptyParagraphs: true });
            assert('extractDocxBodyText skipEmpty', bodyTextSkip.split('\n').length === 3, bodyTextSkip);

            // countScripts 집계
            const cs = { sub: 0, sup: 0 };
            extractDocxBodyText(doc, { countScripts: cs });
            assert('countScripts 집계', cs.sub === 1 && cs.sup === 1, cs);

            // processDocx1 (탭1 전체 경로: 번호매김 [0001] 부여)
            const r1 = await processDocx1(file);
            assert('processDocx1', r1.text.includes('[0001] Numbered para.') &&
                r1.subscriptCount === 1 && r1.superscriptCount === 1, r1);

            // extractTextFromDocx3 / Simple
            const t3 = await extractTextFromDocx3(file);
            const t3s = await extractTextFromDocx3Simple(file);
            assert('extractTextFromDocx3', t3.split('\n').length === 4 && t3s.split('\n').length === 3);

            // extractTextFromDocx4 (numbering lvlText 패턴 적용: [0001]... decimalZero → 01)
            const t4 = await extractTextFromDocx4(file);
            assert('extractTextFromDocx4', t4.includes('[0001] Numbered para.'), t4);

            // loadDocxForCompare (body 직접 자식 블록: 단락 3 + 표 1, 빈 단락 유지)
            const p4 = await loadDocxForCompare(file);
            assert('loadDocxForCompare', p4.blocks.length === 4 && p4.blocks[0].text === 'Hello 2 world' &&
                p4.blocks[1].text === '' && p4.blocks[3].kind === 'tbl', p4.blocks.map(b => ({ kind: b.kind, text: b.text })));
        } else {
            out['DOCX 테스트'] = 'SKIP (JSZip CDN 로드 실패)';
        }

        // 7) DOCX 출력물의 단락 뒤 간격 0pt 검증 (다운로드 가로채기)
        if (typeof JSZip !== 'undefined') {
            const captured = [];
            window.saveAs = (blob, name) => captured.push({ blob, name });
            URL.createObjectURL = (blob) => { captured.push({ blob, name: '(objectURL)' }); return 'blob:fake'; };
            URL.revokeObjectURL = () => {};

            await generateDocxCommon('첫 단락입니다.\n\n둘째<sub>2</sub> 단락.', 'test_common', document.createElement('div'));
            await generateDocxBasic('국문 단락입니다.\n둘째 단락.', 'basic.docx');
            await generateDocxUSPatent([
                'CROSS-REFERENCE TO RELATED APPLICATIONS',
                'This application claims priority.',
                'BACKGROUND',
                'Body paragraph one.',
                'WHAT IS CLAIMED IS:',
                '1.',
                'A device comprising a sensor.'
            ].join('\n'), 'us.docx');

            // 문서비교 Track-Changes DOCX (수정본 패키지 기반, 서식/빈줄/표 보존)
            const makeComparePkg = async (bodyXml) => {
                const z = new JSZip();
                z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
                z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
                z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
                z.file('word/styles.xml', makeDocxStylesXml());
                z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`);
                const b = await z.generateAsync({ type: 'blob' });
                return new File([b], 'cmp.docx');
            };
            const subPara = (tail) => `<w:p><w:r><w:t xml:space="preserve">The value H</w:t></w:r>` +
                `<w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>2</w:t></w:r>` +
                `<w:r><w:t xml:space="preserve">O was ${tail}.</w:t></w:r></w:p>`;
            const tblXml = (cell) => `<w:tbl><w:tblPr/><w:tblGrid><w:gridCol/></w:tblGrid>` +
                `<w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
            const fileCmpA = await makeComparePkg(
                `<w:p><w:r><w:t>Same paragraph here.</w:t></w:r></w:p><w:p/>` + subPara('old') +
                `<w:p><w:r><w:t>Removed old sentence entirely.</w:t></w:r></w:p>` + tblXml('cell old'));
            const fileCmpB = await makeComparePkg(
                `<w:p><w:r><w:t>Same paragraph here.</w:t></w:r></w:p><w:p/>` + subPara('new') +
                tblXml('cell new') + `<w:p><w:r><w:t>Brand fresh inserted line.</w:t></w:r></w:p>`);
            docxDataA = await loadDocxForCompare(fileCmpA);
            docxDataB = await loadDocxForCompare(fileCmpB);
            await compareDocxFiles();

            // 텍스트 비교 → 변경내용 DOCX 내보내기
            document.getElementById('inputText4a').value = 'Line one same\nOld middle here';
            document.getElementById('inputText4b').value = 'Line one same\nNew middle here\nTotally fresh addition';
            compareDocuments();
            await exportTextCompareDocx();

            assert('DOCX 생성 5종 캡처', captured.length === 5, captured.map(c => c.name));

            // 자체 생성 패키지(공통/기본/US특허/텍스트비교)의 스타일 검증
            for (const ci of [0, 1, 2, 4]) {
                if (!captured[ci]) continue;
                const z = await JSZip.loadAsync(captured[ci].blob);
                const stylesFile = z.file('word/styles.xml');
                const styles = stylesFile ? await stylesFile.async('string') : null;
                assert(`DOCX #${ci + 1} 단락뒤 0pt`, !!styles && styles.includes('w:after="0"') && !styles.includes('w:after="160"'),
                    { name: captured[ci].name, hasStyles: !!styles });
                // 관계/콘텐츠타입에 styles 등록 확인
                const ct = await z.file('[Content_Types].xml').async('string');
                const rels = await z.file('word/_rels/document.xml.rels').async('string');
                assert(`DOCX #${ci + 1} styles 관계등록`, ct.includes('/word/styles.xml') && rels.includes('styles.xml'));
            }

            // DOCX 비교 결과 검증 (MS Word 검토>비교와 같은 형태)
            if (captured[3]) {
                const zc = await JSZip.loadAsync(captured[3].blob);
                const cmpXml = await zc.file('word/document.xml').async('string');
                assert('비교: 유효한 개정 날짜(xsd:dateTime)', /w:date="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/.test(cmpXml));
                assert('비교: 빈 단락 유지', /<w:p( [^>]*)?\/>/.test(cmpXml), cmpXml.slice(0, 800));
                assert('비교: 표 유지 + 셀 단위 개정', cmpXml.includes('<w:tbl') &&
                    /<w:delText[^>]*>old<\/w:delText>/.test(cmpXml) &&
                    /<w:t[^>]*>new<\/w:t>/.test(cmpXml), cmpXml.slice(0, 800));
                assert('비교: 첨자 서식 유지', cmpXml.includes('vertAlign'), cmpXml);
                assert('비교: 삭제 단락 delText + 단락기호 삭제', cmpXml.includes('Removed old sentence entirely.') &&
                    /<w:delText[^>]*>Removed old sentence entirely\.<\/w:delText>/.test(cmpXml) &&
                    /<w:rPr><w:del /.test(cmpXml), cmpXml);
                assert('비교: 추가 단락 ins + 단락기호 삽입', /<w:ins [^>]*><w:r><w:t[^>]*>Brand fresh inserted line\.<\/w:t><\/w:r><\/w:ins>/.test(cmpXml) &&
                    /<w:rPr><w:ins /.test(cmpXml), cmpXml);
                assert('비교: 수정 단락 단어 단위 그룹화', /<w:delText[^>]*>old\.\s*<\/w:delText>/.test(cmpXml) &&
                    /old\./.test(cmpXml) && /new\./.test(cmpXml), cmpXml);
                // 수정본 패키지 유지 확인 (styles.xml 승계)
                const cs = await zc.file('word/styles.xml').async('string');
                assert('비교: 수정본 styles 유지', cs.includes('w:after="0"'));
            }

            // 탭4 양식표준화 (텍스트 비교) - 다른 탭과 동일 규칙
            document.getElementById('inputText4a').value =
                'Intro line\nBACKGROUND\nWHAT IS CLAIMED IS:\n1. A sensor device.\nSecond claim line.';
            document.getElementById('inputText4b').value = '';
            standardizeFormat4Text();
            const stdText = document.getElementById('inputText4a').value;
            assert('탭4 텍스트 양식표준화', stdText.includes('Intro line\n\nBACKGROUND') &&
                stdText.includes('<pagebreak/>\nWHAT IS CLAIMED IS:\n') &&
                stdText.includes('1.\tA sensor device.'), stdText);

            // 탭4 양식표준화 (DOCX 비교) - DOM 버전 동일 규칙
            const fileStd = await makeComparePkg('<w:p><w:r><w:t>Intro line.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t xml:space="preserve">BACKGROUND   </w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>WHAT IS CLAIMED IS:</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>1. A sensor device.</w:t></w:r></w:p>');
            docxDataA = await loadDocxForCompare(fileStd);
            docxDataB = null;
            standardizeFormat4Docx();
            const stdBlocks = docxDataA.blocks.map(b => b.text);
            assert('탭4 DOCX 양식표준화', JSON.stringify(stdBlocks) === JSON.stringify(
                ['Intro line.', '', 'BACKGROUND', '\n', 'WHAT IS CLAIMED IS:', '', '1.\tA sensor device.']), stdBlocks);

            // 텍스트 비교 내보내기 결과 검증
            if (captured[4]) {
                const zt = await JSZip.loadAsync(captured[4].blob);
                const txtXml = await zt.file('word/document.xml').async('string');
                assert('텍스트 내보내기: 개정 표시', txtXml.includes('<w:del ') && txtXml.includes('<w:ins ') &&
                    txtXml.includes('Old') && txtXml.includes('New') &&
                    txtXml.includes('Totally fresh addition'), txtXml);
                assert('텍스트 내보내기: 날짜 형식', /w:date="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/.test(txtXml));
            }
        }

        // 8) 헬퍼 통일 검증
        if (typeof JSZip !== 'undefined') {
            // setupDropZone: 드롭 이벤트로 파일 로드 + drag-over 클래스 토글
            const zip2 = new JSZip();
            zip2.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>드롭 테스트 문장.</w:t></w:r></w:p></w:body></w:document>`);
            const dropBlob = await zip2.generateAsync({ type: 'blob' });
            const dt = new DataTransfer();
            dt.items.add(new File([dropBlob], 'drop.docx'));
            const el3 = document.getElementById('inputText3');
            el3.value = '';
            el3.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
            const hadDragClass = el3.classList.contains('drag-over');
            el3.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 400));
            assert('setupDropZone 드롭 로드', hadDragClass && el3.value.includes('드롭 테스트 문장.') &&
                !el3.classList.contains('drag-over'), el3.value);

            // handleDocxUpload: 확장자 거부
            let alerted = '';
            const origAlert = window.alert;
            window.alert = m => { alerted = m; };
            await handleFile3(new File([''], 'wrong.txt'));
            window.alert = origAlert;
            assert('handleDocxUpload 확장자 거부', alerted.includes('.docx'), alerted);
        }

        // showMessage 경로 (빈 입력 시 오류 메시지)
        document.getElementById('textInput1').value = '';
        addParagraphNumbers();
        const pnMsg = document.getElementById('paragraphNumMessage');
        assert('showMessage 오류 표시', pnMsg.textContent.includes('먼저 텍스트를') &&
            pnMsg.className === 'message error' && !pnMsg.classList.contains('hidden'));

        // 9) formatNumber 확장
        assert('formatNumber', formatNumber(3, 'decimal') === '3' && formatNumber(3, 'decimalZero') === '03' &&
            formatNumber(4, 'upperRoman') === 'IV' && formatNumber(2, 'lowerLetter') === 'b' &&
            formatNumber(5, 'koreanCounting') === '5');

        return out;
    });

    // 탭 전환 스모크 테스트 (분할된 파일들이 함께 동작하는지)
    for (const tab of ['tab2', 'tab3', 'tab4', 'tab5', 'tab1']) {
        await page.click(`.tab-btn[onclick*="'${tab}'"]`);
        const active = await page.evaluate(t => document.getElementById(t).classList.contains('active'), tab);
        results[`탭 전환 ${tab}`] = active ? 'PASS' : 'FAIL';
    }
    // 탭2 입력 → 미리보기 갱신 (app-core의 inp2 리스너 + stat-nav의 resetStatNavState 연동)
    await page.click(`.tab-btn[onclick*="'tab2'"]`);
    await page.fill('#htmlInput2', '테스트 문장<sub>2</sub>입니다.');
    await page.waitForTimeout(200);
    const previewOk = await page.evaluate(() => document.getElementById('preview2').innerHTML.includes('<sub>2</sub>'));
    results['탭2 미리보기 연동'] = previewOk ? 'PASS' : 'FAIL';

    // .fin 업로드 → 파싱 → KIPO 라인텍스트 + KIPO/ROPKS DOCX 생성 (전 파이프라인)
    await page.click(`.tab-btn[onclick*="'tab1'"]`);
    const finBuf = await buildSampleFin();
    await page.setInputFiles('#fileInput1', { name: 'sample.fin', mimeType: 'application/octet-stream', buffer: finBuf });
    await page.waitForFunction(
        () => document.getElementById('textInput1').value.includes('【발명의 명칭】'),
        { timeout: 15000 }
    ).catch(() => {});
    const finRes = await page.evaluate(async () => {
        const r = {};
        const ta = document.getElementById('textInput1').value;
        r.textHasTitle = ta.includes('【발명의 명칭】\n테스트 발명\nTEST INVENTION'); // 국문/영문 분리
        r.textHasTable = ta.includes('<table');
        r.textHasClaim = ta.includes('【청구항 1】');
        r.sectionVisible = !document.getElementById('finOutputSection').classList.contains('hidden');
        r.irOk = !!(typeof finParsedIR1 === 'object' && finParsedIR1 && finParsedIR1.drawings.length === 1);
        const blobR = await buildFinDocxBlob(finParsedIR1, 'ropks');
        r.ropksSize = blobR.size;
        const zr = await JSZip.loadAsync(new Uint8Array(await blobR.arrayBuffer()));
        const docR = await zr.file('word/document.xml').async('string');
        r.ropksTable = /<w:tbl>/.test(docR);
        r.ropksImg = /<w:drawing>/.test(docR);
        r.ropksSubtitle = docR.includes('TITLE OF THE INVENTION');
        r.ropksSub2 = /vertAlign w:val="subscript"/.test(docR);
        r.ropksMedia = Object.keys(zr.files).some(f => f.startsWith('word/media/'));
        const blobK = await buildFinDocxBlob(finParsedIR1, 'kipo');
        r.kipoSize = blobK.size;
        const zk = await JSZip.loadAsync(new Uint8Array(await blobK.arrayBuffer()));
        const docK = await zk.file('word/document.xml').async('string');
        r.kipoParts = ['명세서', '청구범위', '요약서', '도면'].every(h => docK.includes(h));
        r.kipoPageBreaks = (docK.match(/w:type="page"/g) || []).length; // 청구범위/요약서/도면 = 3
        r.kipoCaption = docK.includes('[도 1]');
        r.kipoMalgun = (await zk.file('word/styles.xml').async('string')).includes('Malgun Gothic');
        return r;
    });
    results['탭1 .fin 파싱→텍스트'] = (finRes.textHasTitle && finRes.textHasTable && finRes.textHasClaim &&
        finRes.sectionVisible && finRes.irOk) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);
    results['탭1 .fin→ROPKS DOCX'] = (finRes.ropksSize > 0 && finRes.ropksTable && finRes.ropksImg &&
        finRes.ropksSubtitle && finRes.ropksSub2 && finRes.ropksMedia) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);
    results['탭1 .fin→KIPO 출원서식 DOCX'] = (finRes.kipoSize > 0 && finRes.kipoParts &&
        finRes.kipoPageBreaks === 3 && finRes.kipoCaption && finRes.kipoMalgun) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);

    console.log('=== 테스트 결과 ===');
    for (const [k, v] of Object.entries(results)) console.log(`${v.startsWith('PASS') ? '✅' : '❌'} ${k}: ${v}`);
    console.log('\n=== 콘솔 에러 ===');
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(없음)');

    await browser.close();
    server.close();
    process.exit(Object.values(results).some(v => String(v).startsWith('FAIL')) ? 1 : 0);
})();
