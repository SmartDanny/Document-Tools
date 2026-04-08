/**
 * US Patent Application Format Template Generator
 * Generates US_patent_template.docx with SEQ field numbering, line numbers, headers/footers
 *
 * SEQ 필드 방식: { SEQ ParagraphNum \# "0000" } → 4자리 고정 (0001~0999)
 * settings.xml updateFields=1 → Word 열 때 자동 재계산
 */

const fs = require("fs");
const JSZip = require("jszip");

function escapeXml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// SEQ field paragraph number XML generator
let seqCounter = 1;
function makeSeqFieldXml() {
    const cacheVal = String(seqCounter).padStart(4, '0');
    seqCounter++;
    const rPr = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr>';
    return '' +
        `<w:r>${rPr}<w:t>[</w:t></w:r>` +
        `<w:r>${rPr}<w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r>${rPr}<w:instrText xml:space="preserve"> SEQ ParagraphNum \\# "0000" </w:instrText></w:r>` +
        `<w:r>${rPr}<w:fldChar w:fldCharType="separate"/></w:r>` +
        `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="000000"/><w:sz w:val="24"/><w:noProof/></w:rPr><w:t>${cacheVal}</w:t></w:r>` +
        `<w:r>${rPr}<w:fldChar w:fldCharType="end"/></w:r>` +
        `<w:r>${rPr}<w:t>]</w:t></w:r>` +
        `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">  </w:t></w:r>`;
}

const rPrBody = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr>';
const rPrHeading = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:szCs w:val="24"/></w:rPr>';
// 25라인/페이지: 본문영역(16838-1440-1701=13697) / 25 = 548 DXA
const pPrSpacing = '<w:spacing w:after="0" w:line="548" w:lineRule="exact"/>';

function numberedParagraph(text) {
    return `<w:p><w:pPr>${pPrSpacing}<w:ind w:leftChars="0"/></w:pPr>${makeSeqFieldXml()}<w:r>${rPrBody}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function headingParagraph(text) {
    return `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrHeading}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function plainParagraph(text) {
    return `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrBody}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function emptyParagraph() {
    return `<w:p><w:pPr>${pPrSpacing}</w:pPr></w:p>`;
}

function claimParagraph(text) {
    return `<w:p><w:pPr>${pPrSpacing}<w:ind w:firstLine="799"/></w:pPr><w:r>${rPrBody}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function claimNumberParagraph(text) {
    return `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrBody}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

async function generateTemplate() {
    const zip = new JSZip();

    // Build body content
    let body = '';

    // Section 1: Title
    body += plainParagraph('[발명의 명칭]');
    body += emptyParagraph();

    // Section 2: CROSS-REFERENCE
    body += headingParagraph('CROSS-REFERENCE TO RELATED APPLICATIONS');
    body += numberedParagraph('[Cross-reference 내용]');
    body += emptyParagraph();

    // Section 3: BACKGROUND
    body += headingParagraph('BACKGROUND');
    body += headingParagraph('1. Field');
    body += numberedParagraph('[Field 내용]');
    body += headingParagraph('2. Description of the Related Art');
    body += numberedParagraph('[Related Art 내용 1]');
    body += numberedParagraph('[Related Art 내용 2]');
    body += emptyParagraph();

    // Section 4: SUMMARY
    body += headingParagraph('SUMMARY');
    body += numberedParagraph('[Summary 내용 1]');
    body += numberedParagraph('[Summary 내용 2]');
    body += numberedParagraph('[Summary 내용 3]');
    body += emptyParagraph();

    // Section 5: BRIEF DESCRIPTION OF THE DRAWINGS
    body += headingParagraph('BRIEF DESCRIPTION OF THE DRAWINGS');
    body += numberedParagraph('[도면 설명 1]');
    body += numberedParagraph('[도면 설명 2]');
    body += numberedParagraph('[도면 설명 3]');
    body += emptyParagraph();

    // Section 6: DETAILED DESCRIPTION
    body += headingParagraph('DETAILED DESCRIPTION');
    body += numberedParagraph('[상세한 설명 1]');
    body += numberedParagraph('[상세한 설명 2]');
    body += numberedParagraph('[상세한 설명 3]');
    body += numberedParagraph('[상세한 설명 4]');
    body += numberedParagraph('[상세한 설명 5]');
    body += emptyParagraph();

    // Section 7: Description of Symbols
    body += headingParagraph('Description of Symbols');
    body += plainParagraph('[부호]: [명칭]    [부호]: [명칭]');
    body += plainParagraph('[부호]: [명칭]    [부호]: [명칭]');
    body += emptyParagraph();

    // Section 8: WHAT IS CLAIMED IS
    body += headingParagraph('WHAT IS CLAIMED IS:');
    body += claimNumberParagraph('1.');
    body += claimParagraph('A [발명 카테고리] comprising:');
    body += claimParagraph('a [구성요소 1]; and');
    body += claimParagraph('a [구성요소 2].');
    body += emptyParagraph();
    body += claimNumberParagraph('2.');
    body += claimParagraph('The [발명 카테고리] of claim 1, wherein [내용].');
    body += emptyParagraph();

    // Section 9: ABSTRACT
    body += headingParagraph('ABSTRACT');
    body += plainParagraph('[Abstract 내용]');

    // document.xml
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body}
<w:sectPr>
<w:headerReference w:type="even" r:id="rId10"/>
<w:headerReference w:type="default" r:id="rId11"/>
<w:footerReference w:type="even" r:id="rId12"/>
<w:footerReference w:type="default" r:id="rId13"/>
<w:headerReference w:type="first" r:id="rId14"/>
<w:footerReference w:type="first" r:id="rId15"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1701" w:bottom="1701" w:left="1701" w:header="1134" w:footer="1134" w:gutter="0"/>
<w:lnNumType w:countBy="5"/>
<w:cols w:space="720"/>
<w:docGrid w:type="lines" w:linePitch="548"/>
</w:sectPr>
</w:body></w:document>`;

    // numbering.xml
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
             xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             mc:Ignorable="w15">
<w:abstractNum w:abstractNumId="0" w15:restartNumberingAfterBreak="0">
<w:nsid w:val="639059B6"/>
<w:multiLevelType w:val="hybridMultilevel"/>
<w:tmpl w:val="DD9A07EC"/>
<w:lvl w:ilvl="0" w:tplc="A6E64738">
<w:start w:val="1"/><w:numFmt w:val="decimalZero"/><w:lvlRestart w:val="0"/>
<w:lvlText w:val="[00%1]"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr>
<w:rPr>
<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/>
<w:i w:val="0"/><w:caps w:val="0"/><w:strike w:val="0"/><w:dstrike w:val="0"/>
<w:outline w:val="0"/><w:shadow w:val="0"/><w:emboss w:val="0"/><w:imprint w:val="0"/>
<w:vanish w:val="0"/><w:color w:val="000000"/><w:sz w:val="24"/>
<w:u w:val="none"/><w:effect w:val="none"/><w:vertAlign w:val="baseline"/>
</w:rPr>
</w:lvl>
<w:lvl w:ilvl="1" w:tplc="ADA413E2">
<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%2."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1160" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="2" w:tplc="0409001B" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%3."/><w:lvlJc w:val="right"/><w:pPr><w:ind w:left="1600" w:hanging="400"/></w:pPr></w:lvl>
<w:lvl w:ilvl="3" w:tplc="0409000F" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%4."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2000" w:hanging="400"/></w:pPr></w:lvl>
<w:lvl w:ilvl="4" w:tplc="04090019" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%5."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2400" w:hanging="400"/></w:pPr></w:lvl>
<w:lvl w:ilvl="5" w:tplc="0409001B" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%6."/><w:lvlJc w:val="right"/><w:pPr><w:ind w:left="2800" w:hanging="400"/></w:pPr></w:lvl>
<w:lvl w:ilvl="6" w:tplc="0409000F" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%7."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="3200" w:hanging="400"/></w:pPr></w:lvl>
<w:lvl w:ilvl="7" w:tplc="04090019" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%8."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="3600" w:hanging="400"/></w:pPr></w:lvl>
<w:lvl w:ilvl="8" w:tplc="0409001B" w:tentative="1"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%9."/><w:lvlJc w:val="right"/><w:pPr><w:ind w:left="4000" w:hanging="400"/></w:pPr></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

    // styles.xml
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr>
<w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>
<w:kern w:val="2"/><w:szCs w:val="22"/>
<w:lang w:val="en-US" w:eastAsia="ko-KR" w:bidi="ar-SA"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr>
<w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
<w:jc w:val="both"/>
</w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="a">
<w:name w:val="Normal"/>
<w:pPr><w:widowControl w:val="0"/><w:wordWrap w:val="0"/><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/></w:pPr>
<w:rPr><w:rFonts w:ascii="바탕체" w:eastAsia="바탕체" w:hAnsi="바탕체"/><w:sz w:val="24"/></w:rPr>
</w:style>
<w:style w:type="character" w:default="1" w:styleId="a0"><w:name w:val="Default Paragraph Font"/></w:style>
<w:style w:type="table" w:default="1" w:styleId="a1"><w:name w:val="Normal Table"/></w:style>
<w:style w:type="numbering" w:default="1" w:styleId="a2"><w:name w:val="No List"/></w:style>
<w:style w:type="paragraph" w:styleId="a3"><w:name w:val="header"/><w:basedOn w:val="a"/>
<w:pPr><w:tabs/><w:snapToGrid w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="a4"><w:name w:val="footer"/><w:basedOn w:val="a"/>
<w:pPr><w:tabs/><w:snapToGrid w:val="0"/></w:pPr></w:style>
<w:style w:type="character" w:styleId="a5"><w:name w:val="line number"/><w:basedOn w:val="a0"/></w:style>
<w:style w:type="character" w:styleId="a6"><w:name w:val="page number"/><w:basedOn w:val="a0"/></w:style>
<w:style w:type="paragraph" w:styleId="a7"><w:name w:val="List Paragraph"/><w:basedOn w:val="a"/>
<w:pPr><w:ind w:leftChars="400" w:left="800"/></w:pPr></w:style>
</w:styles>`;

    // settings.xml
    const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:o="urn:schemas-microsoft-com:office:office">
<w:zoom w:percent="100"/>
<w:updateFields w:val="1"/>
<w:bordersDoNotSurroundHeader/>
<w:bordersDoNotSurroundFooter/>
<w:defaultTabStop w:val="800"/>
<w:characterSpacingControl w:val="doNotCompress"/>
<w:themeFontLang w:val="en-US" w:eastAsia="ko-KR"/>
<w:decimalSymbol w:val="."/>
<w:listSeparator w:val=","/>
</w:settings>`;

    // Headers (empty)
    const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:pStyle w:val="a3"/></w:pPr></w:p>
</w:hdr>`;

    // Footer with PAGE field (footer1, footer2)
    const footerWithPageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p>
<w:pPr>
<w:pStyle w:val="a4"/>
<w:framePr w:wrap="around" w:vAnchor="text" w:hAnchor="margin" w:xAlign="center" w:y="1"/>
<w:rPr><w:rStyle w:val="a6"/></w:rPr>
</w:pPr>
<w:r><w:rPr><w:rStyle w:val="a6"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:rStyle w:val="a6"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
<w:r><w:rPr><w:rStyle w:val="a6"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
</w:p>
<w:p><w:pPr><w:pStyle w:val="a4"/></w:pPr></w:p>
</w:ftr>`;

    // Footer first page (empty)
    const footerFirstPageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:pStyle w:val="a4"/></w:pPr></w:p>
</w:ftr>`;

    // [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/header3.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/word/footer3.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`);

    // _rels/.rels
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // word/_rels/document.xml.rels
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>
<Relationship Id="rId12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
<Relationship Id="rId13" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>
<Relationship Id="rId14" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header3.xml"/>
<Relationship Id="rId15" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer3.xml"/>
</Relationships>`);

    // Write all files
    zip.file('word/document.xml', documentXml);
    zip.file('word/numbering.xml', numberingXml);
    zip.file('word/styles.xml', stylesXml);
    zip.file('word/settings.xml', settingsXml);
    zip.file('word/header1.xml', headerXml);
    zip.file('word/header2.xml', headerXml);
    zip.file('word/header3.xml', headerXml);
    zip.file('word/footer1.xml', footerWithPageXml);
    zip.file('word/footer2.xml', footerWithPageXml);
    zip.file('word/footer3.xml', footerFirstPageXml);

    // Generate
    const finalBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    fs.writeFileSync("US_patent_template.docx", finalBuffer);
    console.log("✅ US_patent_template.docx 생성 완료!");

    // === Verification ===
    const vZip = await JSZip.loadAsync(finalBuffer);
    console.log("\n=== 검증 결과 ===");

    const docXml = await vZip.file("word/document.xml").async("string");
    console.log("✅ sectPr pgSz (no orient):", docXml.includes('w:w="11906"') && !docXml.includes('orient'));
    console.log("✅ cols (no num):", docXml.includes('w:space="720"') && !docXml.match(/cols[^>]*num/));
    console.log("✅ lnNumType countBy=5:", docXml.includes('countBy="5"'));
    console.log("✅ docGrid linePitch=548:", docXml.includes('linePitch="548"'));

    const seqCount = (docXml.match(/SEQ ParagraphNum/g) || []).length;
    console.log(`✅ SEQ 필드 개수: ${seqCount}`);

    // Check SEQ cache values
    const cacheMatches = docXml.match(/<w:noProof\/><\/w:rPr><w:t>(\d+)<\/w:t>/g) || [];
    if (cacheMatches.length > 0) {
        const lastCache = cacheMatches[cacheMatches.length - 1].match(/(\d+)/);
        console.log(`✅ 마지막 SEQ 캐시값: ${lastCache ? lastCache[0] : 'N/A'}`);
    }

    const stXml = await vZip.file("word/styles.xml").async("string");
    console.log("✅ styles Normal(바탕체):", stXml.includes("바탕체"));
    console.log("✅ docDefaults theme fonts:", stXml.includes("minorHAnsi"));
    console.log("✅ header tabs empty:", stXml.includes('<w:tabs/>'));
    console.log("✅ a0 Default Paragraph Font:", stXml.includes('styleId="a0"'));
    console.log("✅ a1 Normal Table:", stXml.includes('styleId="a1"'));
    console.log("✅ a2 No List:", stXml.includes('styleId="a2"'));
    console.log("✅ a5 basedOn a0:", stXml.includes('a5') && stXml.includes('<w:basedOn w:val="a0"/>'));

    const setXml = await vZip.file("word/settings.xml").async("string");
    console.log("✅ settings updateFields=1:", setXml.includes('updateFields w:val="1"'));
    console.log("✅ bordersDoNotSurroundHeader:", setXml.includes('bordersDoNotSurroundHeader'));
    console.log("✅ characterSpacingControl:", setXml.includes('doNotCompress'));
    console.log("✅ themeFontLang:", setXml.includes('eastAsia="ko-KR"'));

    const numXml = await vZip.file("word/numbering.xml").async("string");
    console.log("✅ numbering nsid:", numXml.includes('639059B6'));
    console.log("✅ numbering tmpl:", numXml.includes('DD9A07EC'));
    console.log("✅ numbering tentative:", numXml.includes('tentative="1"'));

    const f1 = await vZip.file("word/footer1.xml").async("string");
    console.log("✅ footer1 PAGE field:", f1.includes('PAGE'));
    console.log("✅ footer1 framePr (no jc):", f1.includes('framePr') && !f1.includes('w:jc'));
    console.log("✅ footer1 two paragraphs:", (f1.match(/<w:p>/g) || []).length === 2);

    const f3 = await vZip.file("word/footer3.xml").async("string");
    console.log("✅ footer3 empty (no PAGE):", !f3.includes('PAGE'));

    console.log("\n파일 크기:", (finalBuffer.length / 1024).toFixed(1), "KB");
}

generateTemplate().catch(err => {
    console.error("오류:", err);
    process.exit(1);
});
