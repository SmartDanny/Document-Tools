/**
 * Document Tools - js/tab5-mdpdf.js
 * 탭5: Markdown to PDF/docx
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // ========== 탭5: Markdown to PDF/docx ==========
        const mdInputText = document.getElementById('mdInputText');
        const mdPreviewContent = document.getElementById('mdPreviewContent');
        const mdPreviewPaper = document.getElementById('mdPreviewPaper');
        const mdFontSizeDisplay = document.getElementById('mdFontSizeDisplay');
        const mdOrientationSelect = document.getElementById('mdOrientationSelect');
        const mdPaperSizeLabel = document.getElementById('mdPaperSizeLabel');
        
        let mdCurrentFontSize = 12;
        let mdCurrentOrientation = 'portrait';
        const mdDefaultExampleText = mdInputText ? mdInputText.value : '';
        
        // 동적 스타일 시트 (인쇄 용지 방향 설정용)
        const mdStyleSheet = document.createElement("style");
        document.head.appendChild(mdStyleSheet);
        
        // Marked.js 옵션 - 볼드체 등 인라인 스타일 지원
        if (window.marked) {
            marked.setOptions({ 
                breaks: true, 
                gfm: true,
                pedantic: false,
                smartLists: true,
                smartypants: false
            });
        }
        
        // 렌더링 로직
        function renderMdMarkdown() {
            if (!mdInputText || !mdPreviewContent) return;
            
            let rawText = mdInputText.value;
            const mathBlocks = [];
            
            // 수식 보호 처리 (디스플레이 수식 먼저)
            rawText = rawText.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
                mathBlocks.push(match);
                return `%%%MATH_BLOCK_${mathBlocks.length - 1}%%%`;
            });
            // 인라인 수식 (단일 $ 사이의 내용, 줄바꿈 없음)
            // 볼드체 **와 충돌하지 않도록 $ 앞뒤가 *가 아닌 경우만 매칭
            rawText = rawText.replace(/([^*\$]|^)\$([^\$\n*]+?)\$([^*]|$)/g, (match, before, content, after) => {
                mathBlocks.push('$' + content + '$');
                return before + `%%%MATH_BLOCK_${mathBlocks.length - 1}%%%` + after;
            });
            
            // marked.js가 없을 경우 기본 마크다운 변환 (볼드, 이탤릭)
            let html;
            if (window.marked) {
                html = marked.parse(rawText, { breaks: true, gfm: true });
            } else {
                // Fallback: 기본적인 마크다운 변환
                html = rawText
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // **볼드**
                    .replace(/__(.+?)__/g, '<strong>$1</strong>')      // __볼드__
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')              // *이탤릭*
                    .replace(/_(.+?)_/g, '<em>$1</em>')                // _이탤릭_
                    .replace(/~~(.+?)~~/g, '<del>$1</del>')            // ~~취소선~~
                    .replace(/\n/g, '<br>');
            }
            
            // 수식 복구
            mathBlocks.forEach((block, index) => {
                const safeBlock = block.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html = html.replace(`%%%MATH_BLOCK_${index}%%%`, safeBlock);
            });
            
            mdPreviewContent.innerHTML = html;
            
            // KaTeX 렌더링
            if (window.renderMathInElement) {
                renderMathInElement(mdPreviewContent, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false,
                    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
                });
            }
        }
        
        // 초기 렌더링
        document.addEventListener("DOMContentLoaded", function() {
            renderMdMarkdown();
            changeMdOrientation();
        });
        
        if (mdInputText) {
            mdInputText.addEventListener('input', renderMdMarkdown);
            
            // 포커스 시 예제 삭제
            mdInputText.addEventListener('focus', function() {
                if (this.value === mdDefaultExampleText) {
                    this.value = '';
                    renderMdMarkdown();
                }
            });
            
            // 표 붙여넣기 기능
            mdInputText.addEventListener('paste', function(e) {
                const clipboardData = e.clipboardData || window.clipboardData;
                const pastedHTML = clipboardData.getData('text/html');
                
                if (pastedHTML && pastedHTML.includes('<table')) {
                    e.preventDefault();
                    const markdownTable = convertHtmlTableToMdMarkdown(pastedHTML);
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.setRangeText(markdownTable, start, end, 'end');
                    renderMdMarkdown();
                    alert('표를 감지하여 Markdown으로 변환했습니다.');
                }
            });
        }
        
        function convertHtmlTableToMdMarkdown(htmlString) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            const table = doc.querySelector('table');
            if (!table) return '';
            
            let md = '\n';
            const rows = Array.from(table.querySelectorAll('tr'));
            
            rows.forEach((row, rowIndex) => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                const cellText = cells.map(cell => 
                    cell.textContent.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')
                );
                if (cellText.length === 0) return;
                md += '| ' + cellText.join(' | ') + ' |\n';
                if (rowIndex === 0) {
                    const separator = cells.map(() => '---'); 
                    md += '| ' + separator.join(' | ') + ' |\n';
                }
            });
            return md + '\n';
        }
        
        // 폰트 크기 조절
        function changeMdFontSize(delta) {
            mdCurrentFontSize += delta;
            if (mdCurrentFontSize < 10) mdCurrentFontSize = 10;
            if (mdCurrentFontSize > 32) mdCurrentFontSize = 32;
            
            if (mdPreviewContent) {
                mdPreviewContent.style.fontSize = `${mdCurrentFontSize}px`;
            }
            if (mdFontSizeDisplay) {
                mdFontSizeDisplay.innerText = `${mdCurrentFontSize}px`;
            }
        }
        
        // 용지 방향 조절
        function changeMdOrientation() {
            if (!mdOrientationSelect || !mdPreviewPaper) return;
            
            mdCurrentOrientation = mdOrientationSelect.value;
            
            if (mdCurrentOrientation === 'portrait') {
                mdPreviewPaper.style.maxWidth = '210mm';
                mdPreviewPaper.style.minHeight = '297mm';
                if (mdPaperSizeLabel) mdPaperSizeLabel.innerText = 'A4 Portrait';
            } else {
                mdPreviewPaper.style.maxWidth = '297mm';
                mdPreviewPaper.style.minHeight = '210mm';
                if (mdPaperSizeLabel) mdPaperSizeLabel.innerText = 'A4 Landscape';
            }
            
            // 인쇄 시 용지 방향 CSS 설정
            mdStyleSheet.innerText = `@page { size: ${mdCurrentOrientation}; margin: 15mm; }`;
        }
        
        // 에디터 지우기
        function clearMdEditor() {
            if (!mdInputText) return;
            if (mdInputText.value.trim() === '') return;
            if (confirm('작성 중인 내용을 모두 지우시겠습니까?')) {
                mdInputText.value = '';
                renderMdMarkdown();
                mdInputText.focus();
            }
        }
        
        // 예제 복구
        function resetMdExample() {
            if (!mdInputText) return;
            if (confirm('작성 중인 내용이 사라집니다. 기본 예제로 초기화하시겠습니까?')) {
                mdInputText.value = mdDefaultExampleText;
                renderMdMarkdown();
            }
        }
        
        // PDF 다운로드 (브라우저 인쇄 모드 사용)
        function downloadMdPDF() {
            alert("인쇄 창에서 'PDF로 저장'을 선택해주세요.\n(대상: PDF로 저장 선택)");
            setTimeout(() => {
                window.print();
            }, 300);
        }

        // ========== DOCX 저장 ==========

        // MathJax(tex-svg) 지연 로드 - 미리보기(KaTeX)와 분리, 자동 조판 없음
        let mdMathJaxPromise = null;
        function loadMdMathJax() {
            if (window.MathJax && typeof window.MathJax.tex2svg === 'function') {
                return Promise.resolve();
            }
            if (mdMathJaxPromise) return mdMathJaxPromise;
            mdMathJaxPromise = new Promise((resolve, reject) => {
                window.MathJax = {
                    startup: { typeset: false },
                    svg: { fontCache: 'none' }
                };
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
                s.async = true;
                s.onload = () => {
                    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
                        window.MathJax.startup.promise.then(resolve).catch(reject);
                    } else {
                        resolve();
                    }
                };
                s.onerror = () => reject(new Error('MathJax 로드 실패'));
                document.head.appendChild(s);
            });
            return mdMathJaxPromise;
        }

        // SVG 데이터 URL을 고DPI PNG(base64)로 래스터화
        function mdRasterizeSvg(dataUrl, wpx, hpx, scale) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(wpx * scale));
                        canvas.height = Math.max(1, Math.round(hpx * scale));
                        const cx = canvas.getContext('2d');
                        cx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/png').split(',')[1]);
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = () => reject(new Error('SVG 래스터화 실패'));
                img.src = dataUrl;
            });
        }

        // LaTeX → PNG(base64) + 픽셀 크기. 실패 시 null 반환(호출부에서 텍스트 폴백)
        async function mdLatexToPng(latex, displayMode, emPx) {
            await loadMdMathJax();
            const node = window.MathJax.tex2svg(latex, { display: !!displayMode });
            const svg = node.querySelector('svg');
            if (!svg) throw new Error('수식 SVG 생성 실패');

            const pxPerEx = emPx * 0.5;
            const wEx = parseFloat(svg.getAttribute('width')) || 1;
            const hEx = parseFloat(svg.getAttribute('height')) || 1;
            const wpx = Math.max(1, wEx * pxPerEx);
            const hpx = Math.max(1, hEx * pxPerEx);

            svg.setAttribute('width', wpx + 'px');
            svg.setAttribute('height', hpx + 'px');
            if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            const svgStr = new XMLSerializer().serializeToString(svg);
            const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
            const base64 = await mdRasterizeSvg(dataUrl, wpx, hpx, 4);
            return { base64, wpx, hpx };
        }

        // 미리보기 DOM 내 모든 KaTeX 수식을 이미지로 사전 렌더링 → Map(katexEl → imgInfo|null)
        async function mdPrerenderMath(root, emPx) {
            const map = new Map();
            const katexEls = root.querySelectorAll('.katex');
            for (const el of katexEls) {
                // 중첩된 .katex(예: \text 안)의 이중 처리 방지: 최상위만
                if (el.parentElement && el.parentElement.closest('.katex')) continue;
                const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
                const latex = annotation ? annotation.textContent : el.textContent;
                const displayMode = !!el.closest('.katex-display');
                try {
                    map.set(el, await mdLatexToPng(latex, displayMode, emPx));
                } catch (e) {
                    console.warn('수식 이미지 변환 실패, 텍스트로 대체:', latex, e);
                    map.set(el, null); // 폴백 표시
                }
            }
            return map;
        }

        // --- DOM → OOXML 매핑 ---

        function mdRunText(text, fmt) {
            if (text === '') return '';
            return `<w:r>${mdDocxRunProps(fmt)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
        }

        function mdMathImageRun(ctx, imgInfo, latexFallback, fmt) {
            if (!imgInfo) {
                // 폴백: LaTeX 원문 텍스트
                return mdRunText(latexFallback || '', Object.assign({}, fmt, { code: true }));
            }
            ctx.imgCounter++;
            const n = ctx.imgCounter;
            const rid = 'rIdImg' + n;
            ctx.media.push({ path: 'word/media/image' + n + '.png', base64: imgInfo.base64, rid, target: 'media/image' + n + '.png' });
            return mdDocxImageRunXml({
                rid, id: n, name: 'math' + n + '.png',
                cx: pxToEmu(imgInfo.wpx), cy: pxToEmu(imgInfo.hpx)
            });
        }

        // 인라인 노드 → 런 XML
        function mdInlineToRuns(node, ctx, fmt) {
            if (node.nodeType === 3) { // TEXT_NODE
                return mdRunText(node.textContent, fmt);
            }
            if (node.nodeType !== 1) return '';
            const el = node;

            // 인라인 수식
            if (el.classList && el.classList.contains('katex')) {
                if (el.parentElement && el.parentElement.closest('.katex')) return '';
                const info = ctx.mathMap.get(el);
                const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
                const latex = annotation ? annotation.textContent : el.textContent;
                return mdMathImageRun(ctx, info, '$' + latex + '$', fmt);
            }

            const tag = el.tagName.toLowerCase();
            if (tag === 'br') return '<w:br/>';
            if (tag === 'img') return mdRunText(el.getAttribute('alt') || '[이미지]', fmt);

            const f = Object.assign({}, fmt);
            switch (tag) {
                case 'strong': case 'b': f.bold = true; break;
                case 'em': case 'i': f.italic = true; break;
                case 'u': case 'ins': f.underline = true; break;
                case 'del': case 's': case 'strike': f.strike = true; break;
                case 'code': case 'kbd': case 'samp': case 'tt': f.code = true; break;
                case 'sub': f.vertAlign = 'subscript'; break;
                case 'sup': f.vertAlign = 'superscript'; break;
                case 'mark': f.bg = 'FFFF00'; break;
                case 'a': f.underline = true; if (!f.color) f.color = '0563C1'; break;
            }
            // 인라인 스타일(색상/배경) 반영
            if (el.style) {
                const c = cssColorToDocxHex(el.style.color);
                if (c) f.color = c;
                const bg = cssColorToDocxHex(el.style.backgroundColor);
                if (bg) f.bg = bg;
            }

            let out = '';
            for (const child of el.childNodes) out += mdInlineToRuns(child, ctx, f);
            return out;
        }

        function mdChildrenToRuns(el, ctx, fmt) {
            let out = '';
            for (const child of el.childNodes) out += mdInlineToRuns(child, ctx, fmt);
            return out;
        }

        function mdParagraph(runs, pPr) {
            if (!runs) runs = '';
            return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
        }

        const MD_BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr',
            'blockquote', 'pre', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'details', 'summary',
            'section', 'article', 'header', 'footer', 'figure']);

        function mdHasBlockChild(el) {
            for (const c of el.childNodes) {
                if (c.nodeType === 1 && MD_BLOCK_TAGS.has(c.tagName.toLowerCase())) return true;
            }
            return false;
        }

        function mdMathDisplayParagraph(displayEl, ctx) {
            const katex = displayEl.querySelector('.katex');
            let run = '';
            if (katex) {
                const info = ctx.mathMap.get(katex);
                const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
                const latex = annotation ? annotation.textContent : katex.textContent;
                run = mdMathImageRun(ctx, info, '$$' + latex + '$$', {});
            }
            return mdParagraph(run, '<w:jc w:val="center"/>');
        }

        function mdListToDocx(listEl, ctx, level, ordered) {
            let out = '';
            let index = 0;
            for (const li of listEl.children) {
                if (li.tagName.toLowerCase() !== 'li') continue;
                index++;
                // 직속 인라인 내용과 중첩 목록 분리
                let inlineRuns = '';
                let nested = '';
                let checkbox = '';
                for (const child of li.childNodes) {
                    if (child.nodeType === 1) {
                        const ct = child.tagName.toLowerCase();
                        if (ct === 'ul' || ct === 'ol') {
                            nested += mdListToDocx(child, ctx, level + 1, ct === 'ol');
                            continue;
                        }
                        if (ct === 'input' && child.getAttribute('type') === 'checkbox') {
                            checkbox = child.checked || child.hasAttribute('checked') ? '☑ ' : '☐ ';
                            continue;
                        }
                    }
                    inlineRuns += mdInlineToRuns(child, ctx, {});
                }
                const marker = checkbox || (ordered ? index + '. ' : '• ');
                const indent = 360 + level * 360;
                const pPr = `<w:ind w:left="${indent}" w:hanging="360"/>`;
                out += mdParagraph(mdRunText(marker, {}) + inlineRuns, pPr);
                out += nested;
            }
            return out;
        }

        function mdTableBorders() {
            const b = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
                .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('');
            return `<w:tblBorders>${b}</w:tblBorders>`;
        }

        // 미리보기에서 렌더된 각 열의 실제 폭(px)을 측정 (셀 내용 기반 자동 폭)
        function mdMeasureColumnPx(rows, maxCols) {
            const colPx = new Array(maxCols).fill(0);
            for (const row of rows) {
                const cells = row.querySelectorAll('th,td');
                let colIdx = 0;
                for (const cell of cells) {
                    if (colIdx >= maxCols) break;
                    const span = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
                    const rect = cell.getBoundingClientRect ? cell.getBoundingClientRect() : { width: 0 };
                    const per = (rect.width || 0) / span; // colspan 셀은 균등 배분
                    for (let s = 0; s < span && colIdx < maxCols; s++, colIdx++) {
                        if (per > colPx[colIdx]) colPx[colIdx] = per;
                    }
                }
            }
            return colPx;
        }

        function mdTableToDocx(tableEl, ctx) {
            const rows = Array.from(tableEl.querySelectorAll('tr'));
            if (rows.length === 0) return '';
            let maxCols = 0;
            rows.forEach(r => { maxCols = Math.max(maxCols, r.querySelectorAll('th,td').length); });
            if (maxCols === 0) return '';

            // 용지 방향/여백 기준 콘텐츠 폭에 맞춰 표를 페이지 폭으로 채우되,
            // 미리보기의 열 폭 비율(내용 기반 자동 폭)을 그대로 반영한다.
            const contentWidth = ctx.contentWidth || mdDocxContentWidth(mdCurrentOrientation);
            const colPx = mdMeasureColumnPx(rows, maxCols);
            const widths = mdDistributeColumnWidths(colPx, contentWidth);
            const tableWidth = widths.reduce((a, b) => a + b, 0);

            let grid = '';
            for (let i = 0; i < maxCols; i++) grid += `<w:gridCol w:w="${widths[i]}"/>`;

            // 고정 레이아웃 + 열별 명시 폭 → 미리보기 비율 유지 + 페이지 폭에 맞춤.
            // 셀 여백(tblCellMar)으로 미리보기 padding을 재현. (tblPr 자식 순서는 스키마 준수)
            const cellMar = mdDocxCellMarginsXml(ctx.bodyPt || 12);
            let xml = `<w:tbl><w:tblPr><w:tblW w:w="${tableWidth}" w:type="dxa"/>${mdTableBorders()}<w:tblLayout w:type="fixed"/>${cellMar}<w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>`;
            for (const row of rows) {
                xml += '<w:tr>';
                const cells = Array.from(row.querySelectorAll('th,td'));
                let colIdx = 0;
                for (const cell of cells) {
                    if (colIdx >= maxCols) break;
                    const isHeader = cell.tagName.toLowerCase() === 'th';
                    const runs = mdChildrenToRuns(cell, ctx, isHeader ? { bold: true } : {});
                    // 미리보기의 실제 정렬(계산된 스타일: th 기본 center, 열 정렬 :---: 등)을 반영.
                    // 명시(기본 left)해 뷰어 기본 스타일의 양쪽정렬 상속도 방지.
                    let align = '';
                    try { align = window.getComputedStyle(cell).textAlign; } catch (e) {}
                    if (!align) align = (cell.style && cell.style.textAlign) || cell.getAttribute('align') || '';
                    const jcVal = align === 'center' ? 'center'
                        : (align === 'right' || align === 'end') ? 'right' : 'left';
                    const pPr = `<w:jc w:val="${jcVal}"/>`;
                    const shd = isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '';
                    const span = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
                    let cellW = 0;
                    for (let s = 0; s < span && colIdx + s < maxCols; s++) cellW += widths[colIdx + s];
                    const spanXml = span > 1 ? `<w:gridSpan w:val="${Math.min(span, maxCols - colIdx)}"/>` : '';
                    // tcPr 자식 순서: tcW, gridSpan, shd, vAlign
                    xml += `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/>${spanXml}${shd}<w:vAlign w:val="top"/></w:tcPr>`
                        + mdParagraph(runs, pPr) + '</w:tc>';
                    colIdx += span;
                }
                // 부족한 열 채우기
                for (; colIdx < maxCols; colIdx++) {
                    xml += `<w:tc><w:tcPr><w:tcW w:w="${widths[colIdx]}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${mdParagraph('', '<w:jc w:val="left"/>')}</w:tc>`;
                }
                xml += '</w:tr>';
            }
            xml += '</w:tbl>' + mdParagraph('', ''); // 표 뒤 빈 단락(Word 요구사항)
            return xml;
        }

        function mdCodeBlockToDocx(preEl, ctx) {
            const text = preEl.textContent.replace(/\n$/, '');
            const lines = text.split('\n');
            let runs = '';
            lines.forEach((line, i) => {
                if (i > 0) runs += '<w:br/>';
                runs += mdRunText(line, { code: true });
            });
            const pPr = '<w:ind w:left="360" w:right="360"/><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>';
            return mdParagraph(runs, pPr);
        }

        function mdBlockToDocx(node, ctx) {
            if (node.nodeType === 3) {
                if (!node.textContent.trim()) return '';
                return mdParagraph(mdRunText(node.textContent, {}), '');
            }
            if (node.nodeType !== 1) return '';
            const el = node;

            if (el.classList && el.classList.contains('katex-display')) {
                return mdMathDisplayParagraph(el, ctx);
            }

            const tag = el.tagName.toLowerCase();
            switch (tag) {
                case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
                    const sz = mdDocxHeadingSize(tag);
                    const runs = mdChildrenToRuns(el, ctx, { bold: true, sz });
                    return mdParagraph(runs, '<w:spacing w:before="120" w:after="60"/>');
                }
                case 'p': {
                    const runs = mdChildrenToRuns(el, ctx, {});
                    return runs ? mdParagraph(runs, '') : mdParagraph('', '');
                }
                case 'ul': return mdListToDocx(el, ctx, 0, false);
                case 'ol': return mdListToDocx(el, ctx, 0, true);
                case 'table': return mdTableToDocx(el, ctx);
                case 'pre': return mdCodeBlockToDocx(el, ctx);
                case 'hr':
                    return mdParagraph('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>');
                case 'blockquote': {
                    let out = '';
                    for (const c of el.childNodes) {
                        if (c.nodeType === 1 && MD_BLOCK_TAGS.has(c.tagName.toLowerCase())) {
                            // 블록 자식은 들여쓰기된 단락으로
                            const runs = mdChildrenToRuns(c, ctx, { italic: true });
                            out += mdParagraph(runs, '<w:ind w:left="720"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="CCCCCC"/></w:pBdr>');
                        } else {
                            const runs = mdInlineToRuns(c, ctx, { italic: true });
                            if (runs) out += mdParagraph(runs, '<w:ind w:left="720"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="CCCCCC"/></w:pBdr>');
                        }
                    }
                    return out;
                }
                case 'summary':
                    return mdParagraph(mdChildrenToRuns(el, ctx, { bold: true }), '');
                case 'br':
                    return '';
                default:
                    if (mdHasBlockChild(el)) {
                        let out = '';
                        for (const c of el.childNodes) out += mdBlockToDocx(c, ctx);
                        return out;
                    }
                    const runs = mdChildrenToRuns(el, ctx, {});
                    return runs ? mdParagraph(runs, '') : '';
            }
        }

        // DOCX 다운로드 메인
        async function downloadMdDOCX() {
            if (!mdPreviewContent) return;
            if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
                alert('DOCX 생성에 필요한 라이브러리를 불러오지 못했습니다.');
                return;
            }

            const btn = document.querySelector('button[onclick="downloadMdDOCX()"]');
            const originalLabel = btn ? btn.innerHTML : '';
            if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 변환 중...'; }

            try {
                // 본문 글꼴 크기(pt) 기준 em 픽셀 (수식 크기 산출용)
                const bodyPt = mdCurrentFontSize;
                const emPx = bodyPt * (96 / 72);

                // 수식 사전 렌더링 (이미지)
                const mathMap = await mdPrerenderMath(mdPreviewContent, emPx);
                const mathFailed = Array.from(mathMap.values()).some(v => v === null);

                const ctx = {
                    media: [], imgCounter: 0, mathMap,
                    orientation: mdCurrentOrientation,
                    contentWidth: mdDocxContentWidth(mdCurrentOrientation),
                    bodyPt
                };
                let body = '';
                for (const child of mdPreviewContent.childNodes) {
                    body += mdBlockToDocx(child, ctx);
                }
                if (!body.trim()) body = mdParagraph('', '');
                body += mdDocxSectPr(mdCurrentOrientation);

                // 패키지 조립
                const zip = new JSZip();

                const hasImages = ctx.media.length > 0;
                zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${hasImages ? '\n<Default Extension="png" ContentType="image/png"/>' : ''}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

                zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

                let docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
                for (const m of ctx.media) {
                    docRels += `\n<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.target}"/>`;
                }
                docRels += '\n</Relationships>';
                zip.file('word/_rels/document.xml.rels', docRels);

                // 본문 글꼴 크기 → half-point (pt 값을 그대로 사용)
                zip.file('word/styles.xml', makeDocxStylesXml({ fontSize: bodyPt * 2 }));

                zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
${body}
</w:body>
</w:document>`);

                for (const m of ctx.media) {
                    zip.file(m.path, m.base64, { base64: true });
                }

                const blob = await zip.generateAsync({
                    type: 'blob',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });
                saveAs(blob, 'markdown-document.docx');

                if (mathFailed) {
                    alert('일부 수식을 이미지로 변환하지 못해 LaTeX 원문 텍스트로 삽입했습니다.\n(네트워크 상태를 확인해 주세요.)');
                }
            } catch (e) {
                console.error('DOCX 생성 실패:', e);
                alert('DOCX 생성 중 오류가 발생했습니다: ' + e.message);
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
            }
        }

