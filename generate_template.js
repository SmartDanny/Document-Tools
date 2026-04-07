/**
 * US Patent Application Format Template Generator
 * Generates US_patent_template.docx with auto-numbering, line numbers, headers/footers
 */

const docx = require("docx");
const fs = require("fs");
const JSZip = require("jszip");

const {
    Document, Packer, Paragraph, TextRun, Header, Footer,
    AlignmentType, LevelFormat, TabStopType, PageNumber, PageNumberSeparator,
    NumberFormat
} = docx;

// ========== Helper Functions ==========

function createHeadingParagraph(text) {
    return new Paragraph({
        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
        children: [
            new TextRun({
                text: text,
                font: "Arial",
                size: 24,
                color: "000000",
            }),
        ],
    });
}

function createNumberedParagraph(text) {
    return new Paragraph({
        numbering: { reference: "patent-numbering", level: 0 },
        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
        children: [
            new TextRun({
                text: text,
                font: "Arial",
                size: 24,
                color: "000000",
            }),
        ],
    });
}

function createPlainParagraph(text) {
    return new Paragraph({
        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
        children: [
            new TextRun({
                text: text,
                font: "Arial",
                size: 24,
                color: "000000",
            }),
        ],
    });
}

function createEmptyParagraph() {
    return new Paragraph({
        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
        children: [
            new TextRun({
                text: "",
                font: "Arial",
                size: 24,
            }),
        ],
    });
}

function createClaimParagraph(text) {
    return new Paragraph({
        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
        indent: { firstLine: 799 },
        children: [
            new TextRun({
                text: text,
                font: "Arial",
                size: 24,
                color: "000000",
            }),
        ],
    });
}

function createClaimNumberParagraph(text) {
    return new Paragraph({
        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
        children: [
            new TextRun({
                text: text,
                font: "Arial",
                size: 24,
                color: "000000",
            }),
        ],
    });
}

// ========== Footer with PAGE field ==========
function createFooterWithPageNumber() {
    return new Footer({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        children: [PageNumber.CURRENT],
                        font: "Arial",
                        size: 24,
                    }),
                ],
            }),
        ],
    });
}

function createEmptyHeader() {
    return new Header({
        children: [
            new Paragraph({
                children: [],
            }),
        ],
    });
}

// ========== Main Document ==========
async function generateTemplate() {
    const doc = new Document({
        numbering: {
            config: [
                {
                    reference: "patent-numbering",
                    levels: [
                        {
                            level: 0,
                            format: LevelFormat.DECIMAL_ZERO,
                            text: "[00%1]",
                            start: 1,
                            alignment: AlignmentType.LEFT,
                            style: {
                                paragraph: {
                                    indent: { left: 0, firstLine: 0 },
                                },
                                run: {
                                    font: "Arial",
                                    bold: true,
                                    size: 24,
                                    color: "000000",
                                    italics: false,
                                },
                            },
                        },
                        {
                            level: 1,
                            format: LevelFormat.DECIMAL,
                            text: "%2.",
                            start: 1,
                            alignment: AlignmentType.LEFT,
                            style: {
                                paragraph: {
                                    indent: { left: 1160, hanging: 360 },
                                },
                            },
                        },
                    ],
                },
            ],
        },
        styles: {
            default: {
                document: {
                    run: {
                        font: "바탕체",
                        size: 24,
                        sizeCs: 24,
                    },
                    paragraph: {
                        spacing: { line: 480, lineRule: "auto", before: 0, after: 0 },
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            width: 11906,
                            height: 16838,
                            orientation: docx.PageOrientation.PORTRAIT,
                        },
                        margin: {
                            top: 1440,
                            bottom: 1701,
                            left: 1701,
                            right: 1701,
                            header: 1134,
                            footer: 1134,
                        },
                    },
                    column: {
                        space: 720,
                        count: 1,
                    },
                },
                headers: {
                    default: createEmptyHeader(),
                    even: createEmptyHeader(),
                    first: createEmptyHeader(),
                },
                footers: {
                    default: createFooterWithPageNumber(),
                    even: createFooterWithPageNumber(),
                    first: createFooterWithPageNumber(),
                },
                children: [
                    // === Section 1: Title ===
                    createPlainParagraph("[발명의 명칭 입력]"),
                    createEmptyParagraph(),

                    // === Section 2: CROSS-REFERENCE ===
                    createHeadingParagraph("CROSS-REFERENCE TO RELATED APPLICATIONS"),
                    createNumberedParagraph("[Cross-reference 내용 입력]"),
                    createEmptyParagraph(),

                    // === Section 3: BACKGROUND ===
                    createHeadingParagraph("BACKGROUND"),
                    createHeadingParagraph("1. Field"),
                    createNumberedParagraph("[Field 내용 입력]"),
                    createEmptyParagraph(),
                    createHeadingParagraph("2. Description of the Related Art"),
                    createNumberedParagraph("[Related Art 내용 입력]"),
                    createEmptyParagraph(),

                    // === Section 4: SUMMARY ===
                    createHeadingParagraph("SUMMARY"),
                    createNumberedParagraph("[Summary 내용 입력 1]"),
                    createNumberedParagraph("[Summary 내용 입력 2]"),
                    createNumberedParagraph("[Summary 내용 입력 3]"),
                    createEmptyParagraph(),

                    // === Section 5: BRIEF DESCRIPTION OF THE DRAWINGS ===
                    createHeadingParagraph("BRIEF DESCRIPTION OF THE DRAWINGS"),
                    createNumberedParagraph("[도면 설명 입력 1]"),
                    createNumberedParagraph("[도면 설명 입력 2]"),
                    createNumberedParagraph("[도면 설명 입력 3]"),
                    createEmptyParagraph(),

                    // === Section 6: DETAILED DESCRIPTION ===
                    createHeadingParagraph("DETAILED DESCRIPTION"),
                    createNumberedParagraph("[상세한 설명 입력 1]"),
                    createNumberedParagraph("[상세한 설명 입력 2]"),
                    createNumberedParagraph("[상세한 설명 입력 3]"),
                    createNumberedParagraph("[상세한 설명 입력 4]"),
                    createNumberedParagraph("[상세한 설명 입력 5]"),
                    createEmptyParagraph(),

                    // === Section 7: Description of Symbols ===
                    createHeadingParagraph("Description of Symbols"),
                    createPlainParagraph("[부호]: [명칭]    [부호]: [명칭]"),
                    createPlainParagraph("[부호]: [명칭]    [부호]: [명칭]"),
                    createEmptyParagraph(),

                    // === Section 8: WHAT IS CLAIMED IS ===
                    createHeadingParagraph("WHAT IS CLAIMED IS:"),
                    createClaimNumberParagraph("1."),
                    createClaimParagraph("A display device comprising:"),
                    createClaimParagraph("a [구성요소 1]; and"),
                    createClaimParagraph("a [구성요소 2]."),
                    createEmptyParagraph(),
                    createClaimNumberParagraph("2."),
                    createClaimParagraph("The display device of claim 1, wherein [내용]."),
                    createEmptyParagraph(),

                    // === Section 9: ABSTRACT ===
                    createHeadingParagraph("ABSTRACT"),
                    createPlainParagraph("[Abstract 내용 입력]"),
                ],
            },
        ],
    });

    // Step 1: Generate initial docx buffer
    const buffer = await Packer.toBuffer(doc);

    // Step 2: Post-process the docx to add unsupported features
    const zip = await JSZip.loadAsync(buffer);

    // ---- Modify word/document.xml ----
    let documentXml = await zip.file("word/document.xml").async("string");

    // Add line numbering (lnNumType) to sectPr
    documentXml = documentXml.replace(
        /<w:sectPr([^>]*)>/g,
        (match, attrs) => {
            // Only add if not already present
            if (!match.includes("lnNumType")) {
                return match;
            }
            return match;
        }
    );

    // Remove any existing docGrid elements
    documentXml = documentXml.replace(/<w:docGrid[^\/]*\/>/g, '');

    // Remove any existing lnNumType elements
    documentXml = documentXml.replace(/<w:lnNumType[^\/]*\/>/g, '');

    // Remove any existing pgNumType elements (we'll re-add properly)
    documentXml = documentXml.replace(/<w:pgNumType[^\/]*\/>/g, '');

    // Insert lnNumType + docGrid before closing </w:sectPr>
    documentXml = documentXml.replace(
        /<\/w:sectPr>/g,
        '<w:lnNumType w:countBy="5"/><w:docGrid w:type="lines" w:linePitch="326"/></w:sectPr>'
    );

    zip.file("word/document.xml", documentXml);

    // ---- Create/Modify word/numbering.xml ----
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             xmlns:o="urn:schemas-microsoft-com:office:office"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
             xmlns:v="urn:schemas-microsoft-com:vml"
             xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
             xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
             xmlns:w10="urn:schemas-microsoft-com:office:word"
             xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
             xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
             xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
             xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
             xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
             xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
             xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
             mc:Ignorable="w14 w15 wp14">
  <w:abstractNum w:abstractNumId="0" w15:restartNumberingAfterBreak="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimalZero"/>
      <w:lvlRestart w:val="0"/>
      <w:lvlText w:val="[00%1]"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="0" w:firstLine="0"/>
      </w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        <w:b/>
        <w:i w:val="0"/>
        <w:caps w:val="0"/>
        <w:strike w:val="0"/>
        <w:vanish w:val="0"/>
        <w:color w:val="000000"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:u w:val="none"/>
      </w:rPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%2."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="1160" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="2">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerRoman"/>
      <w:lvlText w:val="%3."/>
      <w:lvlJc w:val="right"/>
      <w:pPr>
        <w:ind w:left="2160" w:hanging="180"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="3">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%4."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="2880" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="4">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerLetter"/>
      <w:lvlText w:val="%5."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="3600" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="5">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerRoman"/>
      <w:lvlText w:val="%6."/>
      <w:lvlJc w:val="right"/>
      <w:pPr>
        <w:ind w:left="4320" w:hanging="180"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="6">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%7."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="5040" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="7">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerLetter"/>
      <w:lvlText w:val="%8."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="5760" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="8">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerRoman"/>
      <w:lvlText w:val="%9."/>
      <w:lvlJc w:val="right"/>
      <w:pPr>
        <w:ind w:left="6480" w:hanging="180"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

    zip.file("word/numbering.xml", numberingXml);

    // ---- Create/Modify word/styles.xml ----
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
          xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
          mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="바탕체" w:eastAsia="바탕체" w:hAnsi="바탕체" w:cs="바탕체"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="en-US" w:eastAsia="ko-KR"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="480" w:lineRule="auto" w:before="0" w:after="0"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="a">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="바탕체" w:eastAsia="바탕체" w:hAnsi="바탕체" w:cs="바탕체"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="a3">
    <w:name w:val="header"/>
    <w:basedOn w:val="a"/>
    <w:pPr>
      <w:tabs>
        <w:tab w:val="center" w:pos="4513"/>
        <w:tab w:val="right" w:pos="9026"/>
      </w:tabs>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="a4">
    <w:name w:val="footer"/>
    <w:basedOn w:val="a"/>
    <w:pPr>
      <w:tabs>
        <w:tab w:val="center" w:pos="4513"/>
        <w:tab w:val="right" w:pos="9026"/>
      </w:tabs>
    </w:pPr>
  </w:style>
  <w:style w:type="character" w:styleId="a5">
    <w:name w:val="line number"/>
  </w:style>
  <w:style w:type="character" w:styleId="a6">
    <w:name w:val="page number"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="a7">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="a"/>
    <w:qFormat/>
    <w:pPr>
      <w:ind w:left="800"/>
    </w:pPr>
  </w:style>
</w:styles>`;

    zip.file("word/styles.xml", stylesXml);

    // ---- Update [Content_Types].xml to include numbering ----
    let contentTypesXml = await zip.file("[Content_Types].xml").async("string");
    if (!contentTypesXml.includes("numbering.xml")) {
        contentTypesXml = contentTypesXml.replace(
            "</Types>",
            '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'
        );
    }
    zip.file("[Content_Types].xml", contentTypesXml);

    // ---- Update word/_rels/document.xml.rels to reference numbering.xml ----
    let docRels = await zip.file("word/_rels/document.xml.rels").async("string");
    if (!docRels.includes("numbering.xml")) {
        docRels = docRels.replace(
            "</Relationships>",
            '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'
        );
    }
    zip.file("word/_rels/document.xml.rels", docRels);

    // ---- Fix document.xml: update numId references to match our numbering ----
    documentXml = await zip.file("word/document.xml").async("string");

    // The docx library generates its own numbering IDs. We need to replace them
    // to match our custom numbering.xml (numId="1").
    // Find all numId references and replace with numId=1
    documentXml = documentXml.replace(
        /<w:numId w:val="[^"]*"\/>/g,
        '<w:numId w:val="1"/>'
    );
    // Ensure ilvl is 0 for all numbered paragraphs
    documentXml = documentXml.replace(
        /<w:ilvl w:val="[^"]*"\/>/g,
        '<w:ilvl w:val="0"/>'
    );

    // ---- Fix footer: add framePr to PAGE field paragraph ----
    // Find footer files and modify them
    const footerFiles = Object.keys(zip.files).filter(f => f.match(/word\/footer\d*\.xml/));
    for (const footerFile of footerFiles) {
        let footerXml = await zip.file(footerFile).async("string");

        // Add pStyle footer and framePr to the paragraph containing PAGE field
        footerXml = footerXml.replace(
            /<w:pPr>([\s\S]*?)<w:jc w:val="center"\/>/g,
            '<w:pPr><w:pStyle w:val="a4"/><w:framePr w:wrap="around" w:vAnchor="text" w:hAnchor="margin" w:xAlign="center" w:y="1"/>$1<w:jc w:val="center"/>'
        );

        // Add character style for page number runs
        footerXml = footerXml.replace(
            /(<w:r>[\s\S]*?<w:fldChar)/g,
            '<w:r><w:rPr><w:rStyle w:val="a6"/></w:rPr><w:fldChar'
        );

        zip.file(footerFile, footerXml);
    }

    // ---- Fix header files: add pStyle header ----
    const headerFiles = Object.keys(zip.files).filter(f => f.match(/word\/header\d*\.xml/));
    for (const headerFile of headerFiles) {
        let headerXml = await zip.file(headerFile).async("string");
        // Add header style to paragraphs
        if (!headerXml.includes('w:pStyle')) {
            headerXml = headerXml.replace(
                /<w:p[ >]/g,
                (match) => {
                    if (match === '<w:p>') {
                        return '<w:p><w:pPr><w:pStyle w:val="a3"/></w:pPr>';
                    }
                    return match;
                }
            );
            // Also handle <w:p> without children
            headerXml = headerXml.replace(
                /<w:p\/>/g,
                '<w:p><w:pPr><w:pStyle w:val="a3"/></w:pPr></w:p>'
            );
        }
        zip.file(headerFile, headerXml);
    }

    zip.file("word/document.xml", documentXml);

    // ---- Generate final docx ----
    const finalBuffer = await zip.generateAsync({
        type: "nodebuffer",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        compression: "DEFLATE",
    });

    fs.writeFileSync("US_patent_template.docx", finalBuffer);
    console.log("✅ US_patent_template.docx 생성 완료!");

    // ---- Verification: re-read and check contents ----
    const verifyZip = await JSZip.loadAsync(finalBuffer);

    console.log("\n=== 검증 결과 ===");

    // Check numbering.xml
    const numXml = await verifyZip.file("word/numbering.xml").async("string");
    console.log("✅ numbering.xml 존재:", numXml.includes("decimalZero") && numXml.includes("[00%1]"));
    console.log("   - abstractNumId=0, hybridMultilevel:", numXml.includes('abstractNumId="0"') && numXml.includes("hybridMultilevel"));
    console.log("   - lvlRestart=0:", numXml.includes('lvlRestart'));
    console.log("   - numId=1:", numXml.includes('numId="1"'));

    // Check styles.xml
    const stXml = await verifyZip.file("word/styles.xml").async("string");
    console.log("✅ styles.xml Normal(바탕체):", stXml.includes("바탕체"));
    console.log("   - header style a3:", stXml.includes('styleId="a3"'));
    console.log("   - footer style a4:", stXml.includes('styleId="a4"'));
    console.log("   - line number a5:", stXml.includes('styleId="a5"'));
    console.log("   - page number a6:", stXml.includes('styleId="a6"'));
    console.log("   - List Paragraph a7:", stXml.includes('styleId="a7"'));

    // Check document.xml
    const docXml = await verifyZip.file("word/document.xml").async("string");
    console.log("✅ document.xml lnNumType:", docXml.includes('lnNumType') && docXml.includes('countBy="5"'));
    console.log("   - docGrid:", docXml.includes('docGrid') && docXml.includes('linePitch="326"'));
    console.log("   - numId=1 참조:", docXml.includes('numId w:val="1"'));
    console.log("   - 페이지 크기 A4:", docXml.includes('w:w="11906"') && docXml.includes('w:h="16838"'));

    // Check footers
    for (const f of Object.keys(verifyZip.files).filter(f => f.match(/word\/footer/))) {
        const fXml = await verifyZip.file(f).async("string");
        console.log(`✅ ${f} PAGE필드:`, fXml.includes("PAGE"));
        console.log(`   - framePr:`, fXml.includes("framePr"));
    }

    // Check Content_Types
    const ctXml = await verifyZip.file("[Content_Types].xml").async("string");
    console.log("✅ Content_Types numbering:", ctXml.includes("numbering.xml"));

    // Check rels
    const relsXml = await verifyZip.file("word/_rels/document.xml.rels").async("string");
    console.log("✅ document.xml.rels numbering:", relsXml.includes("numbering.xml"));

    console.log("\n파일 크기:", (finalBuffer.length / 1024).toFixed(1), "KB");
}

generateTemplate().catch(err => {
    console.error("오류:", err);
    process.exit(1);
});
