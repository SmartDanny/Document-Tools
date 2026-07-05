/**
 * Document Tools - js/tab5-mdpdf.js
 * 탭5: Markdown to PDF
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // ========== 탭5: Markdown to PDF ==========
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

