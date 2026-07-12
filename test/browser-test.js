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
<KIPO keapsVersion="5.6" editorKind="K" pageCount="3" xmlns="http://www.kipo.go.kr"><PatentCAFDOC docflag="1.0" documentID="123"><description><invention-title>테스트 발명{TEST INVENTION}</invention-title><technical-field><p num="0001">기술분야 단락.</p></technical-field><background-art><p num="0002">배경기술 H₂O₂ 포함.</p></background-art><summary-of-invention><tech-solution><p num="0003">SiO<sub>2</sub> 포함.</p></tech-solution></summary-of-invention><description-of-drawings><p num="0004">도 1은 예시이다.</p></description-of-drawings><description-of-embodiments><p num="0005">실시예 설명.<img id="i0002" he="3" wi="3" file="pat00099.png" img-format="png"/></p><p num="0006"><tables num="1"><table><tgroup xmlns='http://www.oasis-open.org/tables/exchange/1.0' cols="3"><colspec colnum="1" colname="col1"/><colspec colnum="2" colname="col2"/><colspec colnum="3" colname="col3"/><tbody><row><entry morerows="1" colname="col1">Ex</entry><entry colname="col2">A</entry><entry colname="col3">B</entry></row><row><entry namest="col2" nameend="col3">C</entry></row></tbody></tgroup></table></tables></p><p num="0007">이후 단락.</p></description-of-embodiments><reference-signs-list><p num="0008">SUB: 기판<br/>TR: 트랜지스터</p></reference-signs-list></description><claims><claim num="1"><claim-text>A; <br/>B를 포함하는 장치.</claim-text></claim></claims><abstract><summary><p num="0001a">요약 내용.</p></summary><abstract-figure><p num="0002a"><figref num="1"/></p></abstract-figure></abstract><drawings><figure num="1"><img id="i0001" he="50" wi="50" file="pat00001.png" img-format="png"/></figure></drawings></PatentCAFDOC></KIPO>`;
    const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const hlz = new JSZipNode();
    hlz.file('DOC_251222.xml', xml);
    hlz.file('pat00001.png', png1x1, { base64: true });
    hlz.file('pat00099.png', png1x1, { base64: true }); // 본문 인라인 특수문자 이미지
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
        // 이미 번호가 붙은 단락도 실제 단락으로 카운트
        assert('countParagraphsInText 번호포함',
            countParagraphsInText('BACKGROUND\n[0001] Numbered body para.\nPlain body para.') === 2,
            countParagraphsInText('BACKGROUND\n[0001] Numbered body para.\nPlain body para.'));

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

            // 의심 문자 경고 (.docx 업로드: 행 번호 + 앞뒤 발췌)
            const zipSusp = new JSZip();
            zipSusp.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>온도 300? 및 A**B 처리.</w:t></w:r></w:p>
<w:p><w:r><w:t>H₂O 잔존 확인.</w:t></w:r></w:p>
</w:body></w:document>`);
            const fileSusp = new File([await zipSusp.generateAsync({ type: 'blob' })], 'susp.docx');
            await handleFile1(fileSusp);
            const suspD = fileAnalysisResult.suspicious;
            assert('의심문자 docx 행 기반 검출', !!suspD && suspD.mode === 'line' &&
                JSON.stringify(suspD.items.map(i => [i.label, i.count, i.occurrences[0].line])) ===
                JSON.stringify([['유니코드 첨자', 1, 2], ['"**"', 1, 1], ['"?"', 1, 1]]), suspD);
            const suspBadgeD = document.getElementById('analysisSuspicious');
            const suspPanelD = document.getElementById('suspiciousDetail1');
            assert('의심문자 docx 배지+상세 패널', suspBadgeD.textContent.includes('특수문자 3건') &&
                suspBadgeD.className.includes('warn') &&
                !suspPanelD.className.includes('hidden') &&
                suspPanelD.textContent.includes('2행') && suspPanelD.textContent.includes('H₂O') &&
                !suspPanelD.textContent.includes('원본과의 대조'), // .fin 전용 안내는 docx에 미표시
                { badge: suspBadgeD.textContent, panel: suspPanelD.textContent });

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

            // 양식표준화 멱등성: 이미 표준화된 문서에 재실행해도 변경 0건
            // (US양식 비교의 자동 표준화가 중복 적용되지 않는 근거)
            const secondCount = applyFormatStandardizationToDoc(docxDataA.doc);
            docxDataA.blocks = getBodyBlocks(docxDataA.doc);
            const stdBlocks2 = docxDataA.blocks.map(b => b.text);
            assert('탭4 DOCX 양식표준화 멱등성', secondCount === 0 &&
                JSON.stringify(stdBlocks2) === JSON.stringify(stdBlocks), { secondCount, stdBlocks2 });

            // 텍스트 비교 내보내기 결과 검증
            if (captured[4]) {
                const zt = await JSZip.loadAsync(captured[4].blob);
                const txtXml = await zt.file('word/document.xml').async('string');
                assert('텍스트 내보내기: 개정 표시', txtXml.includes('<w:del ') && txtXml.includes('<w:ins ') &&
                    txtXml.includes('Old') && txtXml.includes('New') &&
                    txtXml.includes('Totally fresh addition'), txtXml);
                assert('텍스트 내보내기: 날짜 형식', /w:date="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/.test(txtXml));
            }

            // 탭4 비교 및 US양식 다운로드: 변경추적 유지 + US 특허출원 양식 적용
            const fileUsA = await makeComparePkg(
                '<w:p><w:r><w:t>CROSS-REFERENCE TO RELATED APPLICATIONS</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>This application claims priority to KR application.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>BACKGROUND OF THE INVENTION</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t xml:space="preserve">[0001] Body paragraph stays mostly old.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t xml:space="preserve">[0002] Alpha beta gamma delta.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>WHAT IS CLAIMED IS:</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>1. A device.</w:t></w:r></w:p>');
            const fileUsB = await makeComparePkg(
                '<w:p><w:r><w:t>CROSS-REFERENCE TO RELATED APPLICATIONS</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>This application claims priority to KR application.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>BACKGROUND OF THE INVENTION</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t xml:space="preserve">[0001] Body paragraph stays mostly new.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t xml:space="preserve">[0002] Zulu yankee xray whiskey victor.</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>WHAT IS CLAIMED IS:</w:t></w:r></w:p>' +
                '<w:p><w:r><w:t>1. A device.</w:t></w:r></w:p>');
            docxDataA = await loadDocxForCompare(fileUsA);
            docxDataB = await loadDocxForCompare(fileUsB);
            // 사용자가 '양식표준화' 버튼을 미리 실행한 상황 — US 흐름의 자동 표준화가 중복 적용되지 않아야 함
            standardizeFormat4Docx();
            document.getElementById('outputFileNameDocx4').value = '';
            const usCapIdx = captured.length;
            await compareDocxFilesUS();
            assert('US비교: 다운로드 캡처(기본 파일명)', captured.length === usCapIdx + 1 &&
                captured[usCapIdx].name === '비교결과_US.docx', captured.map(c => c.name));

            if (captured[usCapIdx]) {
                const zu = await JSZip.loadAsync(captured[usCapIdx].blob);
                const usXml = await zu.file('word/document.xml').async('string');

                // 변경추적 유지 (수정 단락 단어 단위 + 삭제/추가 단락)
                assert('US비교: 변경추적 유지', usXml.includes('<w:ins ') && usXml.includes('<w:del ') &&
                    /<w:delText[^>]*>old\.<\/w:delText>/.test(usXml) &&
                    usXml.includes('Zulu yankee xray whiskey victor.') &&
                    /<w:delText[^>]*>Alpha beta gamma delta\.[\s\S]*?<\/w:delText>/.test(usXml), usXml.slice(0, 1500));

                // US양식: 고정 행 높이(25행/페이지) + Arial 12pt + US sectPr(줄번호/docGrid/A4)
                assert('US비교: 고정 행 높이', usXml.includes('w:line="548" w:lineRule="exact"'));
                assert('US비교: Arial 12pt', usXml.includes('w:ascii="Arial"') && usXml.includes('w:val="24"'));
                assert('US비교: US sectPr', usXml.includes('<w:lnNumType w:countBy="5"/>') &&
                    usXml.includes('w:linePitch="548"') && usXml.includes('<w:pgSz w:w="11906" w:h="16838"/>') &&
                    usXml.includes('r:id="rIdUSHdr"') && usXml.includes('r:id="rIdUSFtrFirst"'));

                // 텍스트 단락번호 제거 + SEQ 필드 대체
                assert('US비교: 텍스트 단락번호 제거', !usXml.includes('[0001]') && !usXml.includes('[0002]'));
                assert('US비교: SEQ 단락번호', usXml.includes(' SEQ ParagraphNum ') && usXml.includes('<w:instrText'));

                // 삽입 단락 SEQ는 w:ins, 삭제 단락 SEQ는 w:del(delInstrText)로 감싸 수락/거부와 연동
                const usDoc = new DOMParser().parseFromString(usXml, 'application/xml');
                const wrappedIn = (el, name) => {
                    for (let a = el.parentNode; a; a = a.parentNode) if (a.nodeName === name) return true;
                    return false;
                };
                let insSeq = false, delSeq = false, plainSeq = false;
                for (const el of usDoc.getElementsByTagName('w:instrText')) {
                    if (!el.textContent.includes('SEQ ParagraphNum')) continue;
                    if (wrappedIn(el, 'w:ins')) insSeq = true; else plainSeq = true;
                }
                for (const el of usDoc.getElementsByTagName('w:delInstrText')) {
                    if (el.textContent.includes('SEQ ParagraphNum') && wrappedIn(el, 'w:del')) delSeq = true;
                }
                assert('US비교: SEQ 개정 래핑(ins/del/일반)', insSeq && delSeq && plainSeq,
                    { insSeq, delSeq, plainSeq });

                // 패키지: trackRevisions 설정 + 헤더/푸터 부품 + 관계/콘텐츠타입 등록
                const usSettings = await zu.file('word/settings.xml').async('string');
                assert('US비교: trackRevisions 설정', usSettings.includes('<w:trackRevisions/>'));
                assert('US비교: 헤더/푸터 부품', !!zu.file('word/usHeader1.xml') &&
                    !!zu.file('word/usFooter1.xml') && !!zu.file('word/usFooter2.xml'));
                const usCt = await zu.file('[Content_Types].xml').async('string');
                const usRels = await zu.file('word/_rels/document.xml.rels').async('string');
                assert('US비교: 부품 등록', usCt.includes('/word/usHeader1.xml') && usCt.includes('/word/settings.xml') &&
                    usRels.includes('Id="rIdUSHdr"') && usRels.includes('Id="rIdUSFtrFirst"') &&
                    usRels.includes('Target="settings.xml"'));

                // 양식표준화 선실행에도 페이지 나누기 중복 없음 (WHAT IS CLAIMED IS: 앞 1개만)
                assert('US비교: 양식표준화 중복 미적용',
                    (usXml.match(/w:type="page"/g) || []).length === 1, usXml.match(/w:type="page"/g));

                // 업로드 상태 비오염: 원본 업로드 zip에는 US 부품이 추가되지 않음 (일반 비교 재실행 대비)
                assert('US비교: 업로드 zip 비오염', !docxDataB.zip.file('word/usHeader1.xml') &&
                    !(await docxDataB.zip.file('word/styles.xml').async('string')).includes('page number'));
            }

            // 일반 비교: 수정본 styles의 기본 단락 뒤 간격(Word 기본 8pt) 제거 — 제목 스타일 간격은 유지
            const spacedStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:after="240"/></w:pPr></w:style>
</w:styles>`;
            const fileSpA = await makeComparePkg('<w:p><w:r><w:t>Spacing test line.</w:t></w:r></w:p>');
            const fileSpB = await makeComparePkg('<w:p><w:r><w:t>Spacing test line changed.</w:t></w:r></w:p>');
            docxDataA = await loadDocxForCompare(fileSpA);
            docxDataB = await loadDocxForCompare(fileSpB);
            docxDataB.zip.file('word/styles.xml', spacedStyles);
            document.getElementById('outputFileNameDocx4').value = '';
            const spCapIdx = captured.length;
            await compareDocxFiles();
            assert('비교: 단락뒤 0pt 다운로드 캡처', captured.length === spCapIdx + 1, captured.map(c => c.name));
            if (captured[spCapIdx]) {
                const zsp = await JSZip.loadAsync(captured[spCapIdx].blob);
                const spStyles = await zsp.file('word/styles.xml').async('string');
                assert('비교: 기본 단락 뒤 간격 0pt 패치', !spStyles.includes('w:after="160"') &&
                    /w:pPrDefault[\s\S]*?w:after="0"/.test(spStyles) &&
                    spStyles.includes('w:after="240"') && spStyles.includes('w:line="259"'), spStyles);
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
        // 1단계 창 = .fin 원본 국문 부제(【】)
        r.textHasTitle = ta.includes('【발명의 명칭】') && ta.includes('【기술분야】') && !ta.includes('TITLE OF THE INVENTION');
        r.textHasTable = ta.includes('<table');
        // HTML 변환: 가로/세로 병합 속성 유지
        r.textTableMerge = ta.includes('rowspan="2"') && ta.includes('colspan="2"');
        r.textHasClaim = ta.includes('【청구항 1】');
        // 변환결과(output1) = ROPKS (영문 부제)
        r.resultIsRopks = document.getElementById('output1').innerHTML.includes('TITLE OF THE INVENTION');
        r.sectionVisible = !document.getElementById('finOutputSection').classList.contains('hidden');
        // ROPKS DOCX 버튼 섹션은 2단계(Cross-reference 삽입 단계)에 표시
        const ropksSection = document.getElementById('finRopksSection');
        r.ropksSectionVisible = !ropksSection.classList.contains('hidden');
        r.ropksBtnInStep2 = !!(ropksSection.querySelector('button[onclick*="downloadFinRopksDocx"]') &&
            ropksSection.closest('.section') === document.getElementById('priorityList1').closest('.section') &&
            !document.getElementById('finOutputSection').querySelector('button[onclick*="downloadFinRopksDocx"]'));
        r.irOk = !!(typeof finParsedIR1 === 'object' && finParsedIR1 && finParsedIR1.drawings.length === 1);
        // 의심 문자 경고 (.fin: 정규화 전 원문 + 단락번호 위치) — 샘플의 H₂O₂([0002])가 검출되어야 함
        const susp = fileAnalysisResult.suspicious;
        r.suspMode = susp && susp.mode;
        r.suspItems = susp ? susp.items.map(i => [i.label, i.count, i.occurrences[0].loc]) : null;
        r.suspBadge = document.getElementById('analysisSuspicious').textContent;
        r.suspPanel = document.getElementById('suspiciousDetail1').textContent;
        // 인라인 이미지 마커는 표시/복사용 텍스트에서 제거됨
        r.textNoMarker = !ta.includes('data-finimg') && !rawOutput1.includes('data-finimg');
        const blobR = await buildFinDocxBlob(finParsedIR1, 'ropks');
        r.ropksSize = blobR.size;
        const zr = await JSZip.loadAsync(new Uint8Array(await blobR.arrayBuffer()));
        const docR = await zr.file('word/document.xml').async('string');
        r.ropksTable = /<w:tbl>/.test(docR);
        // docx 표: 세로 병합(vMerge restart/continue) + 가로 병합(gridSpan)
        r.ropksTableMerge = docR.includes('<w:vMerge w:val="restart"/>') &&
            docR.includes('<w:vMerge/>') && docR.includes('<w:gridSpan w:val="2"/>');
        r.ropksImg = /<w:drawing>/.test(docR);
        // 본문 인라인 이미지([0005]의 pat00099.png) 임베드: 도면 + 인라인 = 미디어 2개, 마커 잔존 없음
        r.ropksMediaCount = Object.keys(zr.files).filter(f => f.startsWith('word/media/') && !zr.files[f].dir).length;
        r.ropksInlineImg = docR.includes('name="pat00099.png"') && !docR.includes('data-finimg');
        // 이미지 포함 단락은 고정 행높이(exact) 대신 최소 행높이(atLeast) — 이미지·글자 중첩 방지
        r.ropksImgParaAtLeast = docR.includes(`w:line="680" w:lineRule="atLeast"`);
        r.ropksSubtitle = docR.includes('TITLE OF THE INVENTION');
        r.ropksSub2 = /vertAlign w:val="subscript"/.test(docR);
        r.ropksMedia = Object.keys(zr.files).some(f => f.startsWith('word/media/'));
        // ROPKS 서식(샘플 역설계): 바탕체 + 행간518 + 부제 밑줄 + 줄번호 + 양쪽맞춤 + 페이지나누기
        r.ropksBatang = docR.includes('바탕체');
        r.ropksLine = docR.includes('w:line="518"');
        r.ropksUnderline = docR.includes('w:u w:val="single"');
        r.ropksLineNo = docR.includes('lnNumType');
        r.ropksJustify = docR.includes('w:jc w:val="both"');
        r.ropksPageBreak = /<w:pageBreakBefore\/>/.test(docR);
        r.ropksNoUnicodeScript = !/[₀-₎²³¹⁰ⁱ⁴-ⁿ]/.test(docR); // 유니코드 첨자 전부 변환
        // ROPKS 페이지번호 footer (fldChar PAGE, 중앙)
        const ftrR = zr.file('word/footer1.xml') ? await zr.file('word/footer1.xml').async('string') : '';
        r.ropksFooter = !!zr.file('word/footer1.xml') && docR.includes('footerReference') &&
            ftrR.includes(' PAGE ') && ftrR.includes('fldChar') && ftrR.includes('w:jc w:val="center"');
        // 20행/페이지: 본문 단락 고정 행높이(exact) + docGrid type=lines 미사용
        r.ropksLineGrid = /w:line="\d+" w:lineRule="exact"/.test(docR) && !/w:type="lines"/.test(docR);
        // 도면 섹션 줄번호 생략(suppressLineNumbers)
        r.ropksSuppressDrawing = docR.includes('<w:suppressLineNumbers/>');
        // 해외관리번호 파일명 규칙
        r.fnameEmpty = finRopksBaseName('', '260709');
        r.fnameMgmt = finRopksBaseName('OPP20123456US', '260709');
        r.mgmtField = !!document.getElementById('finMgmtNo1');
        const blobK = await buildFinDocxBlob(finParsedIR1, 'kipo');
        r.kipoSize = blobK.size;
        const zk = await JSZip.loadAsync(new Uint8Array(await blobK.arrayBuffer()));
        const docK = await zk.file('word/document.xml').async('string');
        r.kipoParts = ['명세서', '청구범위', '요약서', '도면'].every(h => docK.includes(h));
        r.kipoPageBreaks = (docK.match(/w:type="page"/g) || []).length; // 청구범위/요약서/도면 = 3
        r.kipoCaption = docK.includes('[도 1]');
        r.kipoMalgun = (await zk.file('word/styles.xml').async('string')).includes('Malgun Gothic');
        // KIPO: 청구항 행 들여쓰기 + 양쪽맞춤 + 페이지번호 footer
        r.kipoClaimIndent = docK.includes('w:firstLine="400"');
        r.kipoJustify = docK.includes('w:jc w:val="both"');
        r.kipoFooter = !!zk.file('word/footer1.xml') && docK.includes('footerReference') &&
            (await (zk.file('word/footer1.xml').async('string'))).includes(' PAGE ');
        return r;
    });
    results['탭1 .fin 파싱→텍스트'] = (finRes.textHasTitle && finRes.textHasTable && finRes.textHasClaim &&
        finRes.textTableMerge && finRes.resultIsRopks && finRes.sectionVisible &&
        finRes.ropksSectionVisible && finRes.ropksBtnInStep2 && finRes.irOk) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);
    results['탭1 .fin 특수문자 경고(정규화 전+단락번호)'] = (finRes.suspMode === 'para' &&
        JSON.stringify(finRes.suspItems) === JSON.stringify([
            ['유니코드 첨자', 2, '[0002]'],
            ['본문 인라인 이미지(이미지로 임베드됨)', 1, '[0005]']
        ]) &&
        // 배지는 경고 항목(첨자 2건)만 집계 — 인라인 이미지는 정보성으로 분리
        finRes.suspBadge.includes('특수문자 2건') && finRes.suspPanel.includes('[0002]') &&
        finRes.suspPanel.includes('[0005]') &&
        finRes.suspPanel.includes('원본 이미지가 그대로 삽입') &&
        // 손상 잔재 없음(첨자·인라인 이미지뿐) → 원본 대조 안내 미표시
        !finRes.suspPanel.includes('원본과의 대조') && finRes.textNoMarker)
        ? 'PASS' : 'FAIL ' + JSON.stringify({ mode: finRes.suspMode, items: finRes.suspItems, badge: finRes.suspBadge, panel: finRes.suspPanel && finRes.suspPanel.slice(0, 300), noMarker: finRes.textNoMarker });
    results['탭1 .fin→ROPKS DOCX'] = (finRes.ropksSize > 0 && finRes.ropksTable && finRes.ropksTableMerge && finRes.ropksImg &&
        finRes.ropksSubtitle && finRes.ropksSub2 && finRes.ropksMedia &&
        finRes.ropksMediaCount === 2 && finRes.ropksInlineImg && finRes.ropksImgParaAtLeast &&
        finRes.ropksBatang && finRes.ropksLine && finRes.ropksUnderline &&
        finRes.ropksLineNo && finRes.ropksJustify && finRes.ropksPageBreak &&
        finRes.ropksNoUnicodeScript && finRes.ropksFooter &&
        finRes.ropksLineGrid && finRes.ropksSuppressDrawing) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);
    results['탭1 ROPKS 파일명 규칙'] = (finRes.fnameEmpty === 'ROPKS_260709' &&
        finRes.fnameMgmt === 'OPP20123456ROPKS_260709' && finRes.mgmtField) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);
    results['탭1 .fin→KIPO 출원서식 DOCX'] = (finRes.kipoSize > 0 && finRes.kipoParts &&
        finRes.kipoPageBreaks === 3 && finRes.kipoCaption && finRes.kipoMalgun &&
        finRes.kipoClaimIndent && finRes.kipoJustify && finRes.kipoFooter) ? 'PASS' : 'FAIL ' + JSON.stringify(finRes);

    // 인라인 이미지만 있는 경우: 경고(⚠️/warn)가 아닌 정보성(ℹ️/info) 배지·패널
    const infoOnlyRes = await page.evaluate(() => {
        const saved = fileAnalysisResult.suspicious;
        fileAnalysisResult.suspicious = {
            mode: 'para',
            items: [{
                label: FIN_INLINE_IMG_LABEL, count: 2,
                occurrences: [{ loc: '[0005]', before: '', match: '[인라인 이미지 2개]', after: ' 실시예 설명.' }]
            }]
        };
        updateSuspiciousDisplay1();
        const badge = document.getElementById('analysisSuspicious');
        const panel = document.getElementById('suspiciousDetail1');
        const r = {
            badgeText: badge.textContent, badgeClass: badge.className,
            panelClass: panel.className,
            panelHasWarnTitle: panel.textContent.includes('잘 사용되지 않는'),
            panelHasInfo: panel.textContent.includes('원본 이미지가 그대로 삽입')
        };
        fileAnalysisResult.suspicious = saved;
        updateSuspiciousDisplay1();
        return r;
    });
    results['탭1 인라인 이미지 정보성 표시'] = (infoOnlyRes.badgeText.includes('인라인 이미지 2건') &&
        infoOnlyRes.badgeClass.includes('info') && !infoOnlyRes.badgeClass.includes('warn') &&
        infoOnlyRes.panelClass.includes('info') && !infoOnlyRes.panelHasWarnTitle && infoOnlyRes.panelHasInfo)
        ? 'PASS' : 'FAIL ' + JSON.stringify(infoOnlyRes);

    // .fin 흐름: 단락번호 기본 제거 + 분석결과(5단계)=변환결과(6단계) 일치 + 4단계 단락번호 추가/제거 동작
    const finNumRes = await page.evaluate(() => {
        const r = {};
        const ta = document.getElementById('textInput1').value;
        r.noNum = !/^\[\d{4,5}\]\s/m.test(ta); // .fin의 단락번호는 기본 제거
        r.paraShown = document.getElementById('paragraphCount1').textContent;
        r.paraRopks = countParagraphsInText(rawOutput1); // 분석결과 = 변환결과(ROPKS) 기준
        // 4단계 단락번호 추가: '이미 존재' 오류 없이 입력창+변환결과 모두 번호 부여
        addParagraphNumbers();
        r.addMsg = document.getElementById('paragraphNumMessage').textContent;
        r.addOk = r.addMsg.includes('추가되었습니다');
        r.inputNumbered = /^\[0001\]\s/m.test(document.getElementById('textInput1').value);
        r.outputNumbered = /^\[0001\]\s/m.test(rawOutput1) && rawOutput1.includes('TITLE OF THE INVENTION');
        r.paraAfterAdd = document.getElementById('paragraphCount1').textContent;
        // 단락번호 제거: 양쪽 모두 원복
        removeParagraphNumbers();
        r.removedInput = !/^\[\d{4,5}\]\s/m.test(document.getElementById('textInput1').value);
        r.removedOutput = !/^\[\d{4,5}\]\s/m.test(rawOutput1) && rawOutput1.includes('TITLE OF THE INVENTION');
        r.paraAfterRemove = document.getElementById('paragraphCount1').textContent;
        return r;
    });
    results['탭1 .fin 단락번호 기본제거+추가/제거'] = (finNumRes.noNum &&
        finNumRes.paraShown === String(finNumRes.paraRopks) && Number(finNumRes.paraShown) === 6 &&
        finNumRes.addOk && finNumRes.inputNumbered && finNumRes.outputNumbered &&
        finNumRes.paraAfterAdd === finNumRes.paraShown &&
        finNumRes.removedInput && finNumRes.removedOutput &&
        finNumRes.paraAfterRemove === finNumRes.paraShown) ? 'PASS' : 'FAIL ' + JSON.stringify(finNumRes);

    // .fin 흐름: Cross-reference 삽입 — 국문 KIPO(【기술분야】 앞) + 변환결과 ROPKS(BACKGROUND 앞) 동시 삽입
    //           + 삽입 후 ROPKS DOCX에 Cross-reference 포함
    const finXrefRes = await page.evaluate(async () => {
        const r = {};
        priorityList1.push({ year: '2026', month: '01', day: '29', appNum: '10-2026-0017835' });
        insertCrossReference();
        r.msg = document.getElementById('crossRefMessage').textContent;
        r.ok = r.msg.includes('삽입되었습니다');
        const ta = document.getElementById('textInput1').value;
        const xref = 'CROSS-REFERENCE TO RELATED APPLICATIONS';
        // 국문 KIPO: 【기술분야】 바로 앞에 삽입
        r.inputPos = ta.indexOf(xref) >= 0 && ta.indexOf(xref) < ta.indexOf('【기술분야】');
        r.inputBody = ta.includes('2026년 01월 29일 출원된 대한민국 특허출원 제10-2026-0017835호');
        // 변환결과 ROPKS: TITLE 뒤, BACKGROUND OF THE INVENTION 앞에 삽입
        r.outputPos = rawOutput1.indexOf(xref) > rawOutput1.indexOf('TITLE OF THE INVENTION') &&
            rawOutput1.indexOf(xref) < rawOutput1.indexOf('BACKGROUND OF THE INVENTION');
        r.analysis = fileAnalysisResult.hasCrossRef === true;
        // 분석결과 단락 개수: 본문 6 + Cross-reference 본문 1 = 7 (변환결과 기준과 일치)
        r.paraShown = document.getElementById('paragraphCount1').textContent;
        r.paraRopks = countParagraphsInText(rawOutput1);
        // 삽입된 Cross-reference 보관 → ROPKS DOCX에 포함 (downloadFinDocx와 동일 경로)
        r.xrefStored = !!(finCrossRef1 && finCrossRef1.text.includes('제10-2026-0017835호'));
        const blob = await buildFinDocxBlob(finParsedIR1, 'ropks', finCrossRef1 ? { crossRef: finCrossRef1 } : undefined);
        const z = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
        const doc = await z.file('word/document.xml').async('string');
        r.docxXref = doc.indexOf(xref) >= 0 && doc.indexOf(xref) < doc.indexOf('BACKGROUND OF THE INVENTION');
        r.docxXrefBody = doc.includes('제10-2026-0017835호');
        return r;
    });
    results['탭1 .fin Cross-reference 삽입'] = (finXrefRes.ok && finXrefRes.inputPos && finXrefRes.inputBody &&
        finXrefRes.outputPos && finXrefRes.analysis &&
        finXrefRes.paraShown === String(finXrefRes.paraRopks) && Number(finXrefRes.paraShown) === 7 &&
        finXrefRes.xrefStored && finXrefRes.docxXref && finXrefRes.docxXrefBody)
        ? 'PASS' : 'FAIL ' + JSON.stringify(finXrefRes);

    // .docx 흐름(처음부터 해외출원용 ROPKS/US 서식): Cross-reference 삽입 시 5단계 분석 결과 갱신
    const docxXrefRes = await page.evaluate(() => {
        const r = {};
        // .docx 업로드 흐름 시뮬레이션 — fin 상태 해제 + US 서식 텍스트 표시
        finParsedIR1 = null;
        finCrossRef1 = null;
        fileAnalysisResult.suspicious = null;
        const text = 'TITLE OF THE INVENTION\n연마 장치\nBACKGROUND OF THE INVENTION\n배경 설명 단락이다.\n추가 본문 단락이다.\nWHAT IS CLAIMED IS:\n【청구항 1】\n장치.';
        document.getElementById('textInput1').value = text;
        displayResult1({ text, subscriptCount: 0, superscriptCount: 0 });
        r.paraBefore = document.getElementById('paragraphCount1').textContent;
        r.crossBefore = fileAnalysisResult.hasCrossRef === false;
        priorityList1.length = 0;
        priorityList1.push({ year: '2026', month: '03', day: '15', appNum: '10-2026-0033333' });
        insertCrossReference();
        r.msg = document.getElementById('crossRefMessage').textContent;
        r.ok = r.msg.includes('삽입되었습니다');
        // 5단계 분석 결과: 단락 개수 = 본문 2 + Cross-reference 본문 1 = 3
        r.paraAfter = document.getElementById('paragraphCount1').textContent;
        r.paraExpected = countParagraphsInText(rawOutput1);
        r.crossAfter = fileAnalysisResult.hasCrossRef === true;
        r.outputHasXref = document.getElementById('output1').textContent.includes('CROSS-REFERENCE TO RELATED APPLICATIONS');
        return r;
    });
    results['탭1 .docx Cross-reference 삽입 분석갱신'] = (docxXrefRes.ok && docxXrefRes.crossBefore && docxXrefRes.crossAfter &&
        docxXrefRes.paraBefore === '2' && docxXrefRes.paraAfter === '3' &&
        docxXrefRes.paraAfter === String(docxXrefRes.paraExpected) && docxXrefRes.outputHasXref)
        ? 'PASS' : 'FAIL ' + JSON.stringify(docxXrefRes);

    // 후처리/US서식 HTML표 → OOXML: 가로+세로 병합 그리드 정합성 (fin 미리보기와 docx 일치)
    const tblRes = await page.evaluate(() => {
        const html = '<table>'
            + '<tr><td rowspan="2"></td><td rowspan="2"></td><td colspan="2">Energy</td><td colspan="2">Device</td></tr>'
            + '<tr><td>A Host</td><td>B Host</td><td>Cd/A</td><td>T97</td></tr>'
            + '<tr><td rowspan="2">Ex 1</td><td>HOMO</td><td>-5.58</td><td>-5.42</td><td rowspan="2">11.83</td><td rowspan="2">105%</td></tr>'
            + '<tr><td>LUMO</td><td>-1.88</td><td>-1.99</td></tr>'
            + '</table>';
        // 각 행의 그리드 폭(gridSpan 합) 계산
        const rowWidths = (xml) => (xml.match(/<w:tr>[\s\S]*?<\/w:tr>/g) || []).map(tr =>
            (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).reduce((a, tc) => {
                const m = tc.match(/<w:gridSpan w:val="(\d+)"\/>/);
                return a + (m ? parseInt(m[1], 10) : 1);
            }, 0));
        const check = (xml) => ({
            widths: rowWidths(xml),
            restart: (xml.match(/<w:vMerge w:val="restart"\/>/g) || []).length,
            cont: (xml.match(/<w:vMerge\/>/g) || []).length,
            gridCols: (xml.match(/<w:gridCol /g) || []).length
        });
        return { tab2: check(convertHtmlTableToOoxml(html)), tab3: check(convertTableToDocx3(html)) };
    });
    for (const key of ['tab2', 'tab3']) {
        const c = tblRes[key];
        const ok = c.widths.length === 4 && c.widths.every(w => w === 6) &&
            c.restart === 5 && c.cont === 5 && c.gridCols === 6;
        results[`${key === 'tab2' ? '탭2 후처리' : '탭3 US서식'} HTML표 세로병합 그리드`] =
            ok ? 'PASS' : 'FAIL ' + JSON.stringify(c);
    }

    console.log('=== 테스트 결과 ===');
    for (const [k, v] of Object.entries(results)) console.log(`${v.startsWith('PASS') ? '✅' : '❌'} ${k}: ${v}`);
    console.log('\n=== 콘솔 에러 ===');
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(없음)');

    await browser.close();
    server.close();
    process.exit(Object.values(results).some(v => String(v).startsWith('FAIL')) ? 1 : 0);
})();
