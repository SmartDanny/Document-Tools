/**
 * Document Tools - js/tab3-bilingual.js
 * 탭3: 한영혼합본 도구 (추출/색변환/DOCX 생성)
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // 탭3 - 워드 파일에서 텍스트 추출 (첨자/표 포함, 공통 함수는 utils.js에서 로드됨)
        async function extractTextFromDocx3(file) {
            const { doc } = await loadDocxDocument(file);
            return extractDocxBodyText(doc);
        }
        
        // 탭3 - 파일 처리 공통 함수
        async function handleFile3(file) {
            await handleDocxUpload(file, 'fileName3', async (file) => {
                const text = await extractTextFromDocx3(file);
                document.getElementById('inputText3').value = text;
            });
        }
        
        // 탭3 - 파일 선택 버튼
        document.getElementById('fileInput3').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            await handleFile3(file);
        });
        
        // 탭3 - 드래그 앤 드롭 (textarea)
        const inputText3 = document.getElementById('inputText3');
        
        setupDropZone(inputText3, handleFile3); // 드래그 앤 드롭 (utils.js)
        
        // 탭3
        let lines3 = [], afterClaims = false, afterTitle = false, beforeCross = true;
        
        // Description of Symbols 관련 패턴 체크
        function isDescriptionOfSymbols(s) {
            // 다양한 형태: "Description of Symbols", "<Description of Symbols>", "DESCRIPTION OF SYMBOLS" 등
            return /^<?\s*description\s+of\s+symbols\s*>?$/i.test(s.trim());
        }
        
        function detectType(t) {
            const s = t.trim();
            if (!s.length) { afterTitle = false; return 'empty'; }
            if (s === '<pagebreak/>') { return 'pagebreak'; }
            if (s === 'TITLE OF THE INVENTION') { afterTitle = true; return 'subtitle'; }
            if (s === 'CROSS-REFERENCE TO RELATED APPLICATIONS') { beforeCross = false; afterTitle = false; return 'subtitle'; }
            if (s === 'WHAT IS CLAIMED IS:' || s === 'WHAT IS CLAIMED IS') { afterClaims = true; afterTitle = false; return 'subtitle'; }
            // Description of Symbols 체크 (한글 체크보다 먼저)
            if (isDescriptionOfSymbols(s)) { afterTitle = false; return 'subtitle'; }
            if (/[가-힣]/.test(s)) { afterTitle = false; return 'korean'; }
            if (isTitle(s)) { afterTitle = false; return 'english'; }
            if (isSub(s)) { afterTitle = false; return 'subtitle'; }
            if (/[a-zA-Z]/.test(s)) { afterTitle = false; return 'english'; }
            afterTitle = false; return 'other';
        }
        function isTitle(s) {
            const up = (s.match(/[A-Z]/g)||[]).length, lo = (s.match(/[a-z]/g)||[]).length;
            if (afterTitle && up >= 2 && lo === 0 && /^[A-Z0-9\s\-:\/,]+$/.test(s)) return true;
            if (beforeCross && up >= 2 && lo === 0) {
                const kw = ['BACKGROUND','FIELD','DESCRIPTION','SUMMARY','BRIEF','DETAILED','EMBODIMENT','INVENTION','REFERENCE','CROSS-REFERENCE','RELATED','APPLICATIONS'];
                if (!kw.some(k => s.includes(k)) && /^[A-Z0-9\s\-:\/,]+$/.test(s)) return true;
            }
            return false;
        }
        function isSub(s) {
            if (isDescriptionOfSymbols(s)) return true;
            if (/^\([a-zA-Z0-9]+\)/.test(s)) return true;
            if (!afterClaims && /^\d+\./.test(s)) return true;
            const up = (s.match(/[A-Z]/g)||[]).length, lo = (s.match(/[a-z]/g)||[]).length;
            return up >= 2 && lo === 0 && /^[A-Z0-9\s\-:\/]+$/.test(s);
        }
        
        // 단락 개수에서 제외할 라인인지 판별 (부제목, 표, 실시예 등 마침표 없는 단락)
        function isExcludedFromParagraphCount(text) {
            const trimmed = text.trim();
            if (!trimmed) return true;
            
            // 부제목 (subtitle type)은 이미 제외됨
            
            // 표 태그
            if (trimmed.startsWith('<table') || trimmed.endsWith('</table>')) return true;
            if (/<table[^>]*>/.test(trimmed) || /<\/table>/.test(trimmed)) return true;
            
            // 【】 또는 []로 묶인 타이틀 (표, 수학식, 화학식 등)
            if (/^[【\[][^【\[\]】]+[】\]]$/.test(trimmed)) return true;
            
            // 마침표로 끝나지 않는 단락은 제외 (부제목, 제목 성격)
            // 단, 마침표(.), 물음표(?), 느낌표(!)로 끝나는 경우는 실제 단락으로 간주
            // 마침표 뒤에 따옴표가 오는 경우도 포함
            if (!/[.?!。]["']?$/.test(trimmed)) return true;
            
            return false;
        }
        
        // 단락/청구항 개수 계산 (isKorean: 국문본 여부)
        function countParagraphsAndClaims(filteredLines, isKorean = false) {
            let paragraphCount = 0;
            let claimCount = 0;
            let afterClaimsSection = false;
            
            for (const line of filteredLines) {
                const trimmed = line.text.trim();
                
                // WHAT IS CLAIMED IS: 체크
                if (trimmed === 'WHAT IS CLAIMED IS:' || trimmed === 'WHAT IS CLAIMED IS') {
                    afterClaimsSection = true;
                    continue;
                }
                
                if (afterClaimsSection) {
                    if (isKorean) {
                        // 국문본: 【청구항 X】 또는 [청구항 X] 패턴 카운트
                        if (/^[【\[]청구항\s*\d+[】\]]$/.test(trimmed)) {
                            claimCount++;
                        }
                    } else {
                        // 영문본: 숫자로 시작하는 행 카운트
                        if (/^\d+\.?\s/.test(trimmed)) {
                            claimCount++;
                        }
                    }
                } else {
                    // 단락: 부제목이 아니고, 제외 대상이 아닌 경우
                    if (line.type !== 'subtitle' && line.type !== 'empty' && !isExcludedFromParagraphCount(line.text)) {
                        paragraphCount++;
                    }
                }
            }
            
            return { paragraphCount, claimCount };
        }
        
        function analyzeText3() {
            const t = document.getElementById('inputText3').value;
            if (!t.trim()) { alert('텍스트를 입력해주세요.'); return; }
            afterClaims = false; afterTitle = false; beforeCross = true;
            currentFilter3 = 'all';
            lines3 = t.split('\n').map((x,i) => ({id:i, text:x, type:detectType(x)}));
            if (!lines3.filter(l => l.type !== 'empty').length) { alert('유효한 내용이 없습니다.'); return; }
            displayPreview3(); updateStats3(); generateResults3();
            ['stats3Section','preview3Section','result3Section'].forEach(x => document.getElementById(x).classList.remove('hidden'));
            document.getElementById('colorResult3Section').classList.add('hidden');
            // 필터 버튼 초기화
            document.querySelectorAll('#stats3Section .stat-card.clickable').forEach(card => {
                card.classList.remove('active');
                if (card.dataset.filter === 'all') card.classList.add('active');
            });
        }
        function displayPreview3() {
            const c = document.getElementById('paragraphList3');
            c.innerHTML = '';
            const lb = {subtitle:'영어부제목',korean:'한글단락',english:'영어단락'};
            const bc = {subtitle:'badge-subtitle',korean:'badge-korean',english:'badge-english'};
            lines3.forEach(l => {
                if (l.type === 'empty' || l.type === 'other') return;
                const d = document.createElement('div');
                d.className = `paragraph-item type-${l.type}`;
                // HTML 태그를 이스케이프하여 텍스트로 표시
                const escapedText = escapeHtml(l.text);
                d.innerHTML = `<div class="paragraph-header"><span>줄 ${l.id+1}</span><span class="language-badge ${bc[l.type]}">${lb[l.type]}</span></div><div class="paragraph-text">${escapedText}</div>`;
                c.appendChild(d);
            });
        }
        
        let currentFilter3 = 'all';
        
        function filterPreview3(filterType, clickedCard) {
            currentFilter3 = filterType;
            
            // 모든 카드에서 active 클래스 제거
            document.querySelectorAll('#stats3Section .stat-card.clickable').forEach(card => {
                card.classList.remove('active');
            });
            // 클릭된 카드에 active 클래스 추가
            clickedCard.classList.add('active');
            
            // 미리보기 필터링
            const c = document.getElementById('paragraphList3');
            c.innerHTML = '';
            const lb = {subtitle:'영어부제목',korean:'한글단락',english:'영어단락'};
            const bc = {subtitle:'badge-subtitle',korean:'badge-korean',english:'badge-english'};
            
            lines3.forEach(l => {
                if (l.type === 'empty' || l.type === 'other') return;
                
                // 필터 적용
                if (filterType !== 'all' && l.type !== filterType) return;
                
                const d = document.createElement('div');
                d.className = `paragraph-item type-${l.type}`;
                // HTML 태그를 이스케이프하여 텍스트로 표시
                const escapedText = escapeHtml(l.text);
                d.innerHTML = `<div class="paragraph-header"><span>줄 ${l.id+1}</span><span class="language-badge ${bc[l.type]}">${lb[l.type]}</span></div><div class="paragraph-text">${escapedText}</div>`;
                c.appendChild(d);
            });
            
            // 필터링된 결과가 없으면 메시지 표시
            if (c.children.length === 0) {
                c.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">해당 유형의 단락이 없습니다.</div>';
            }
        }
        function updateStats3() {
            document.getElementById('totalCount3').textContent = lines3.filter(l => l.type !== 'empty').length;
            document.getElementById('subtitleCount3').textContent = lines3.filter(l => l.type === 'subtitle').length;
            document.getElementById('koreanCount3').textContent = lines3.filter(l => l.type === 'korean').length;
            document.getElementById('englishCount3').textContent = lines3.filter(l => l.type === 'english').length;
        }
        
        // HTML/Markdown 태그 존재 여부 확인
        function hasRenderableContent(text) {
            // HTML 태그 체크
            const htmlTags = /<(sub|sup|table|tr|td|th|strong|em|b|i|u|code|pre|blockquote|h[1-6]|ul|ol|li|a|img|br|hr)[^>]*>/i;
            if (htmlTags.test(text)) return true;
            
            // Markdown 문법 체크
            const mdPatterns = [
                /\*\*[^*]+\*\*/,           // **bold**
                /\*[^*]+\*/,               // *italic*
                /__[^_]+__/,               // __bold__
                /_[^_]+_/,                 // _italic_
                /`[^`]+`/,                 // `code`
                /^#{1,6}\s/m,              // # heading
                /^\s*[-*+]\s/m,            // - list
                /^\s*\d+\.\s/m,            // 1. ordered list
                /\[.+\]\(.+\)/,            // [link](url)
                /!\[.+\]\(.+\)/,           // ![image](url)
                /^>\s/m,                   // > blockquote
                /^---$/m,                  // horizontal rule
                /\|.+\|/                   // | table |
            ];
            
            for (const pattern of mdPatterns) {
                if (pattern.test(text)) return true;
            }
            
            return false;
        }
        
        // 텍스트를 렌더링 HTML로 변환
        function renderTextToHtml(text) {
            if (!text) return '';
            
            // 줄 단위로 처리
            let lines = text.split('\n');
            let html = '';
            
            for (let line of lines) {
                let rendered = line;
                
                // HTML 태그는 그대로 유지 (이미 HTML인 경우)
                // 단, 특수 문자 이스케이프 필요한 부분 제외
                
                // Markdown bold/italic 변환
                rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                rendered = rendered.replace(/__([^_]+)__/g, '<strong>$1</strong>');
                rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
                rendered = rendered.replace(/_([^_]+)_/g, '<em>$1</em>');
                
                // Markdown inline code 변환
                rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
                
                // Markdown headings 변환
                rendered = rendered.replace(/^######\s+(.+)$/g, '<h6>$1</h6>');
                rendered = rendered.replace(/^#####\s+(.+)$/g, '<h5>$1</h5>');
                rendered = rendered.replace(/^####\s+(.+)$/g, '<h4>$1</h4>');
                rendered = rendered.replace(/^###\s+(.+)$/g, '<h3>$1</h3>');
                rendered = rendered.replace(/^##\s+(.+)$/g, '<h2>$1</h2>');
                rendered = rendered.replace(/^#\s+(.+)$/g, '<h1>$1</h1>');
                
                // Markdown blockquote 변환
                rendered = rendered.replace(/^>\s+(.+)$/g, '<blockquote>$1</blockquote>');
                
                // Markdown horizontal rule 변환
                if (/^---$/.test(rendered) || /^\*\*\*$/.test(rendered)) {
                    rendered = '<hr>';
                }
                
                html += rendered + '<br>\n';
            }
            
            return html;
        }
        
        function generateResults3() {
            // 국문본: subtitle + korean
            const krLines = lines3.filter(l => l.type === 'subtitle' || l.type === 'korean');
            const kr = krLines.map(l => l.text);
            const krText = kr.length ? kr.join('\n') : '국문본에 포함될 내용이 없습니다';
            
            // 영문본: subtitle + english
            const enLines = lines3.filter(l => l.type === 'subtitle' || l.type === 'english');
            const en = enLines.map(l => {
                // 영문청구항 번호(X.)와 첫 단어 사이에 탭 삽입
                return l.text.replace(/^(\d+\.)\s*/, '$1\t');
            });
            const enText = en.length ? en.join('\n') : '영문본에 포함될 내용이 없습니다';
            
            // 원본 텍스트 저장 (복사용)
            window.koreanRawText3 = krText;
            window.englishRawText3 = enText;
            window.englishFormatStandardized = false; // 재분석 시 양식표준화 플래그 초기화
            
            // 국문본 단락/청구항 개수 계산
            const krStats = countParagraphsAndClaims(krLines, true);
            document.getElementById('koreanParagraphCount3').textContent = krStats.paragraphCount;
            document.getElementById('koreanClaimCount3').textContent = krStats.claimCount;
            
            // 국문본 HTML 태그 카운트
            const krSubCount = (krText.match(/<sub>/gi) || []).length;
            const krSupCount = (krText.match(/<sup>/gi) || []).length;
            const krTableCount = (krText.match(/<table/gi) || []).length;
            document.getElementById('koreanSubCount3').textContent = krSubCount;
            document.getElementById('koreanSupCount3').textContent = krSupCount;
            document.getElementById('koreanTableCount3').textContent = krTableCount;
            
            // 영문본 단락/청구항 개수 계산
            const enStats = countParagraphsAndClaims(enLines, false);
            document.getElementById('englishParagraphCount3').textContent = enStats.paragraphCount;
            document.getElementById('englishClaimCount3').textContent = enStats.claimCount;
            
            // 영문본 HTML 태그 카운트
            const enSubCount = (enText.match(/<sub>/gi) || []).length;
            const enSupCount = (enText.match(/<sup>/gi) || []).length;
            const enTableCount = (enText.match(/<table/gi) || []).length;
            document.getElementById('englishSubCount3').textContent = enSubCount;
            document.getElementById('englishSupCount3').textContent = enSupCount;
            document.getElementById('englishTableCount3').textContent = enTableCount;
            
            resetStatNavState('tab3_eng');
            resetStatNavState('tab3_kor');

            // 원본 텍스트 창에 태그 강조 표시 (전처리 탭처럼)
            const krHighlighted = highlightHtmlTags(krText);
            document.getElementById('koreanResult3').innerHTML = krHighlighted;

            const enHighlighted = highlightHtmlTags(enText);
            document.getElementById('englishResult3').innerHTML = enHighlighted;
            
            // 렌더링 패널 업데이트 - 국문본 (첨자/표가 있는 경우에만 표시)
            const krRenderPanel = document.getElementById('koreanRenderPanel3');
            const krRender = document.getElementById('koreanRender3');
            const krHasSpecialContent = (krSubCount > 0 || krSupCount > 0 || krTableCount > 0);
            if (krHasSpecialContent) {
                krRenderPanel.style.display = 'block';
                krRender.innerHTML = renderTextToHtml(krText);
            } else {
                krRenderPanel.style.display = 'none';
                krRender.innerHTML = '';
            }
            
            // 렌더링 패널 업데이트 - 영문본 (첨자/표가 있는 경우에만 표시)
            const enRenderPanel = document.getElementById('englishRenderPanel3');
            const enRender = document.getElementById('englishRender3');
            const enHasSpecialContent = (enSubCount > 0 || enSupCount > 0 || enTableCount > 0);
            if (enHasSpecialContent) {
                enRenderPanel.style.display = 'block';
                enRender.innerHTML = renderTextToHtml(enText);
            } else {
                enRenderPanel.style.display = 'none';
                enRender.innerHTML = '';
            }
        }
        
        // HTML 태그를 이스케이프하고 강조 표시하는 함수
        function highlightHtmlTags(text) {
            if (!text) return '';
            
            // 먼저 HTML 이스케이프
            let html = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            
            // 줄바꿈을 <br>로 변환
            html = html.replace(/\n/g, '<br>');
            
            // 이스케이프된 태그를 색상 클래스로 감싸기
            // 아래첨자 태그
            html = html.replace(/&lt;sub&gt;/gi, '<span class="sub-tag">&lt;sub&gt;</span>');
            html = html.replace(/&lt;\/sub&gt;/gi, '<span class="sub-tag">&lt;/sub&gt;</span>');
            
            // 위첨자 태그
            html = html.replace(/&lt;sup&gt;/gi, '<span class="sup-tag">&lt;sup&gt;</span>');
            html = html.replace(/&lt;\/sup&gt;/gi, '<span class="sup-tag">&lt;/sup&gt;</span>');
            
            // 표 관련 태그
            html = html.replace(/&lt;table[^&]*&gt;/gi, '<span class="table-tag">&lt;table&gt;</span>');
            html = html.replace(/&lt;\/table&gt;/gi, '<span class="table-tag">&lt;/table&gt;</span>');
            html = html.replace(/&lt;tr&gt;/gi, '<span class="table-tag">&lt;tr&gt;</span>');
            html = html.replace(/&lt;\/tr&gt;/gi, '<span class="table-tag">&lt;/tr&gt;</span>');
            html = html.replace(/&lt;td([^&]*)&gt;/gi, '<span class="table-tag">&lt;td$1&gt;</span>');
            html = html.replace(/&lt;\/td&gt;/gi, '<span class="table-tag">&lt;/td&gt;</span>');
            html = html.replace(/&lt;th([^&]*)&gt;/gi, '<span class="table-tag">&lt;th$1&gt;</span>');
            html = html.replace(/&lt;\/th&gt;/gi, '<span class="table-tag">&lt;/th&gt;</span>');
            html = html.replace(/&lt;br&gt;/gi, '<span class="table-tag">&lt;br&gt;</span>');
            
            // 강조 텍스트 (__ __ 형식)
            html = html.replace(/__([^_]+)__/g, '<span class="warn-mark">$1</span>');
            
            // Markdown 문법 강조 (보라색)
            html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="md-tag">**$1**</span>');
            html = html.replace(/`([^`]+)`/g, '<span class="md-tag">`$1`</span>');
            
            return html;
        }
        
        function copyKorean3() {
            const t = window.koreanRawText3 || '';
            const msg = document.getElementById('korParagraphNumMessage3');
            if (!t || t.includes('없습니다')) {
                showMessage(msg, '❌ 복사할 내용이 없습니다.', 'error');
                return;
            }
            copyToClipboard(t, msg, '✅ 국문본이 클립보드에 복사되었습니다!');
        }
        function copyEnglish3() {
            const t = window.englishRawText3 || '';
            const msg = document.getElementById('engParagraphNumMessage3');
            if (!t || t.includes('없습니다')) {
                showMessage(msg, '❌ 복사할 내용이 없습니다.', 'error');
                return;
            }
            copyToClipboard(t, msg, '✅ 영문본이 클립보드에 복사되었습니다!');
        }
        
        // 국문본 DOCX 다운로드
        async function downloadKorDocx3() {
            const text = window.koreanRawText3 || '';
            const msg = document.getElementById('korParagraphNumMessage3');
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 다운로드할 내용이 없습니다.', 'error');
                return;
            }
            try {
                await generateDocxFromText3(text, 'korean_extracted.docx');
                showMessage(msg, '✅ 국문본 DOCX 파일이 다운로드되었습니다!', 'success');
                setTimeout(() => msg.classList.add('hidden'), 3000);
            } catch (e) {
                showMessage(msg, '❌ 오류: ' + e.message, 'error');
            }
        }

        // 영문본 DOCX 다운로드
        async function downloadEngDocx3() {
            const text = window.englishRawText3 || '';
            const msg = document.getElementById('engParagraphNumMessage3');
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 다운로드할 내용이 없습니다.', 'error');
                return;
            }
            try {
                await generateDocxBasic(text, 'english_extracted.docx');
                showMessage(msg, '✅ 영문본 DOCX 파일이 다운로드되었습니다!', 'success');
                setTimeout(() => msg.classList.add('hidden'), 3000);
            } catch (e) {
                showMessage(msg, '❌ 오류: ' + e.message, 'error');
            }
        }

        // 영문본 US양식 다운로드
        async function downloadUSFormatEng3() {
            const msg = document.getElementById('engParagraphNumMessage3');
            msg.classList.add('hidden');
            let text = window.englishRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 영문본이 없습니다.', 'error');
                return;
            }
            const result = applyFormatStandardization(text);
            if (result.changeCount > 0) {
                window.englishRawText3 = result.text;
                text = result.text;
                updateEnglishDisplay3();
            }
            try {
                await generateDocxUSPatent(text, 'english_extracted_US.docx');
                showMessage(msg, '✅ US 특허출원 양식 DOCX 파일이 다운로드되었습니다!', 'success');
                setTimeout(() => msg.classList.add('hidden'), 3000);
            } catch (e) {
                showMessage(msg, '❌ 오류: ' + e.message, 'error');
            }
        }

        // 국문 색변환 함수
        function convertKoreanColorSplit3() {
            const chunks = splitSlots3
                .map(s => (document.getElementById(`splitTextarea3_${s.id}`) || {}).value || '')
                .filter(t => t.trim());
            if (chunks.length === 0) { alert('입력된 내용이 없습니다.'); return; }
            let text;
            if (chunks.length === 1) {
                text = chunks[0];
            } else {
                const { text: merged, duplicates } = mergeSplitChunks3(chunks);
                text = merged;
                const existingWarn = document.getElementById('splitMergeWarning3');
                if (existingWarn) existingWarn.remove();
                if (duplicates.length > 0) {
                    const warn = document.createElement('div');
                    warn.id = 'splitMergeWarning3';
                    warn.className = 'split-merge-warning';
                    const nums = [...new Set(duplicates.map(d => `[${String(d.num).padStart(4,'0')}]`))].join(', ');
                    warn.textContent = `⚠️ 중복 단락번호 발견 (첫 번째 항목을 사용): ${nums}`;
                    document.getElementById('btnGroup3Split').after(warn);
                }
            }
            document.getElementById('inputText3').value = text;
            convertKoreanColor3();
        }

        function convertKoreanColor3() {
            const t = document.getElementById('inputText3').value;
            if (!t.trim()) { alert('텍스트를 입력해주세요.'); return; }
            
            afterClaims = false; afterTitle = false; beforeCross = true;
            const colorLines = t.split('\n').map((x, i) => ({id: i, text: x, type: detectType(x)}));
            
            if (!colorLines.filter(l => l.type !== 'empty').length) { 
                alert('유효한 내용이 없습니다.'); 
                return; 
            }
            
            // 색변환 데이터 저장
            window.colorLines3 = colorLines;
            window.originalText3 = t;
            
            // 통계 업데이트
            document.getElementById('colorTotalCount3').textContent = colorLines.filter(l => l.type !== 'empty' && l.type !== 'pagebreak').length;
            document.getElementById('colorSubtitleCount3').textContent = colorLines.filter(l => l.type === 'subtitle').length;
            document.getElementById('colorKoreanCount3').textContent = colorLines.filter(l => l.type === 'korean').length;
            document.getElementById('colorEnglishCount3').textContent = colorLines.filter(l => l.type === 'english').length;
            
            // 미리보기 생성 (국문만 색 적용, 첨자 태그 렌더링)
            const previewEl = document.getElementById('colorPreview3');
            let previewHtml = '';
            colorLines.forEach(l => {
                if (l.type === 'empty') {
                    previewHtml += '<br>';
                    return;
                }
                if (l.type === 'pagebreak') {
                    previewHtml += '<div class="pagebreak-divider-plain">── 페이지 나누기 ──</div>';
                    return;
                }
                // 첨자 태그는 렌더링되도록 유지
                const renderedText = l.text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/&lt;sub&gt;/gi, '<sub>')
                    .replace(/&lt;\/sub&gt;/gi, '</sub>')
                    .replace(/&lt;sup&gt;/gi, '<sup>')
                    .replace(/&lt;\/sup&gt;/gi, '</sup>');
                if (l.type === 'korean') {
                    // 국문 단락은 갈색으로 표시
                    previewHtml += `<div data-line-type="korean" style="color:#993300;margin:3px 0;">${renderedText}</div>`;
                } else if (l.type === 'subtitle') {
                    previewHtml += `<div data-line-type="subtitle" style="color:#e67e22;font-weight:bold;margin:3px 0;">${renderedText}</div>`;
                } else if (l.type === 'english') {
                    previewHtml += `<div data-line-type="english" style="color:#2980b9;margin:3px 0;">${renderedText}</div>`;
                } else {
                    previewHtml += `<div data-line-type="${l.type}" style="margin:3px 0;">${renderedText}</div>`;
                }
            });
            previewEl.innerHTML = previewHtml;

            // 단락 개수, 첨자, 표 통계 계산 (한글/영어 분리)
            let krParagraphCount = 0, krSubCount = 0, krSupCount = 0, krTableCount = 0;
            let enParagraphCount = 0, enSubCount = 0, enSupCount = 0, enTableCount = 0;
            let insideTable = false;
            let afterClaimsSection = false;

            colorLines.forEach(l => {
                const trimmed = l.text.trim();
                const isKorean = l.type === 'korean';

                if (trimmed === 'WHAT IS CLAIMED IS:' || trimmed === 'WHAT IS CLAIMED IS') {
                    afterClaimsSection = true;
                }

                if (trimmed.startsWith('<table')) insideTable = true;

                // 표 개수 (한글/영어 분리)
                const tableMatches = l.text.match(/<table[^>]*>/gi);
                if (tableMatches) {
                    if (isKorean) krTableCount += tableMatches.length;
                    else enTableCount += tableMatches.length;
                }

                // 첨자 개수 (한글/영어 분리)
                const subMatches = l.text.match(/<sub>/gi);
                const supMatches = l.text.match(/<sup>/gi);
                if (subMatches) { if (isKorean) krSubCount += subMatches.length; else enSubCount += subMatches.length; }
                if (supMatches) { if (isKorean) krSupCount += supMatches.length; else enSupCount += supMatches.length; }

                // 단락 카운트 (한글/영어 분리, 표 밖, WHAT IS CLAIMED IS: 이전, 마침표로 끝남)
                if (!afterClaimsSection && !insideTable && trimmed &&
                    !trimmed.startsWith('<table') && !trimmed.endsWith('</table>') &&
                    /[.。]["']?$/.test(trimmed)) {
                    if (isKorean) krParagraphCount++;
                    else if (l.type === 'english') enParagraphCount++;
                }

                if (trimmed.endsWith('</table>')) insideTable = false;
            });

            resetStatNavState('tab3_color');
            document.getElementById('colorKrParagraphCount3').textContent = krParagraphCount;
            document.getElementById('colorKrSubCount3').textContent = krSubCount;
            document.getElementById('colorKrSupCount3').textContent = krSupCount;
            document.getElementById('colorKrTableCount3').textContent = krTableCount;
            document.getElementById('colorEnParagraphCount3').textContent = enParagraphCount;
            document.getElementById('colorEnSubCount3').textContent = enSubCount;
            document.getElementById('colorEnSupCount3').textContent = enSupCount;
            document.getElementById('colorEnTableCount3').textContent = enTableCount;

            // 색변환 결과 섹션 표시, 영문/국문 추출 결과 숨기기
            document.getElementById('colorResult3Section').classList.remove('hidden');
            document.getElementById('stats3Section').classList.add('hidden');
            document.getElementById('preview3Section').classList.add('hidden');
            document.getElementById('result3Section').classList.add('hidden');
        }
        
        // 한영혼합본 DOCX 다운로드 (국문 색변환 적용)
        async function downloadColorDocx3() {
            if (!window.colorLines3 || !window.originalText3) {
                alert('먼저 국문 색변환을 실행해주세요.');
                return;
            }
            
            try {
                const zip = new JSZip();
                
                // [Content_Types].xml
                zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
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
</Relationships>`);
                
                // word/styles.xml (font size 12pt)
                zip.file('word/styles.xml', makeDocxStylesXml({ fontSize: 24 })); // 단락 뒤 간격 0pt (utils.js)
                
                // word/document.xml 생성
                let bodyContent = '';
                
                for (const line of window.colorLines3) {
                    const trimmed = line.text.trim();
                    
                    // 페이지 나누기 마커 처리
                    if (line.type === 'pagebreak' || trimmed === '<pagebreak/>') {
                        bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
                        continue;
                    }
                    
                    // 빈 줄 처리
                    if (line.type === 'empty' || !trimmed) {
                        bodyContent += '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>';
                        continue;
                    }
                    
                    // 표 처리
                    if (line.text.includes('<table')) {
                        bodyContent += convertTableToDocx3(line.text);
                        continue;
                    }
                    
                    // 국문 단락 - 갈색(993300) 적용
                    if (line.type === 'korean') {
                        bodyContent += `<w:p><w:pPr><w:rPr><w:color w:val="993300"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="993300"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>${convertRunToDocxColor3(line.text, '993300')}</w:r></w:p>`;
                    } else {
                        // 영문/부제목 - 기본 색상
                        bodyContent += `<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>${convertRunToDocx3(line.text)}</w:r></w:p>`;
                    }
                }
                
                const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${bodyContent}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;
                
                zip.file('word/document.xml', documentXml);

                const blob = await zip.generateAsync({ type: 'blob' });
                saveAs(blob, 'mixed_korean_colored.docx');

                const msg = document.getElementById('colorMessage3');
                showMessage(msg, '✅ 한영혼합본 DOCX 파일이 다운로드되었습니다!', 'success');
                setTimeout(() => msg.classList.add('hidden'), 3000);
            } catch (error) {
                console.error('DOCX 생성 오류:', error);
                const msg = document.getElementById('colorMessage3');
                showMessage(msg, '❌ DOCX 생성 중 오류가 발생했습니다.', 'error');
            }
        }
        
        // 텍스트를 DOCX run으로 변환 (색상 적용 버전)
        function convertRunToDocxColor3(text, color) {
            let result = '';
            let i = 0;
            
            while (i < text.length) {
                // <sub> 태그 처리
                if (text.substr(i, 5).toLowerCase() === '<sub>') {
                    const endIdx = text.toLowerCase().indexOf('</sub>', i);
                    if (endIdx !== -1) {
                        const subText = text.substring(i + 5, endIdx);
                        result += `</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="subscript"/><w:color w:val="${color}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(subText)}</w:t></w:r><w:r><w:rPr><w:color w:val="${color}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">`;
                        i = endIdx + 6;
                        continue;
                    }
                }
                // <sup> 태그 처리
                if (text.substr(i, 5).toLowerCase() === '<sup>') {
                    const endIdx = text.toLowerCase().indexOf('</sup>', i);
                    if (endIdx !== -1) {
                        const supText = text.substring(i + 5, endIdx);
                        result += `</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/><w:color w:val="${color}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(supText)}</w:t></w:r><w:r><w:rPr><w:color w:val="${color}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">`;
                        i = endIdx + 6;
                        continue;
                    }
                }
                // <br> 태그 처리
                if (text.substr(i, 4).toLowerCase() === '<br>' || text.substr(i, 5).toLowerCase() === '<br/>') {
                    result += '</w:t><w:br/><w:t xml:space="preserve">';
                    i += text.substr(i, 4).toLowerCase() === '<br>' ? 4 : 5;
                    continue;
                }
                result += escapeXml(text[i]);
                i++;
            }
            
            return `<w:t xml:space="preserve">${result}</w:t>`;
        }
        
        // 색변환용 양식표준화
        function standardizeFormatColor3() {
            const msg = document.getElementById('colorMessage3');
            msg.classList.add('hidden');
            
            if (!window.colorLines3 || !window.originalText3) {
                showMessage(msg, '❌ 먼저 국문 색변환을 실행해주세요.', 'error');
                return;
            }
            
            const result = applyFormatStandardization(window.originalText3);
            
            if (result.changeCount === 0) {
                showMessage(msg, '❌ 적용할 양식 변경이 없습니다.', 'error');
                return;
            }
            
            window.originalText3 = result.text;
            // colorLines3도 다시 생성
            afterClaims = false; afterTitle = false; beforeCross = true;
            window.colorLines3 = result.text.split('\n').map((x, i) => ({id: i, text: x, type: detectType(x)}));
            
            // 미리보기 갱신
            updateColorPreview3();
            
            showMessage(msg, `✅ 양식표준화 완료! (${result.changeCount}개 변경 적용)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 색변환용 단락번호 추가 (국문단락에만)
        function addParagraphNumbersColor3() {
            const msg = document.getElementById('colorMessage3');
            msg.classList.add('hidden');
            
            if (!window.colorLines3 || !window.originalText3) {
                showMessage(msg, '❌ 먼저 국문 색변환을 실행해주세요.', 'error');
                return;
            }
            
            // 이미 단락번호가 있는지 확인 (국문단락 중에서)
            // 단락번호 형식: [0001] 또는 [00001] - 0으로 시작하고 뒤에 공백이 있음
            const hasExistingNumbers = window.colorLines3.some(l => 
                l.type === 'korean' && /^\[0\d{3,4}\]\s/.test(l.text.trim())
            );
            if (hasExistingNumbers) {
                showMessage(msg, '❌ 이미 단락번호가 있습니다.', 'error');
                return;
            }
            
            // 국문단락에만 단락번호 추가
            let paragraphNum = 1;
            let insideTable = false;
            let afterClaimsSection = false;
            let addedCount = 0;

            // CROSS-REFERENCE 시작 위치 찾기 (이전 줄은 단락번호 부여 안함)
            let crossRefIndex = -1;
            for (let ci = 0; ci < window.colorLines3.length; ci++) {
                const t = window.colorLines3[ci].text.trim().toUpperCase();
                if (t === 'CROSS-REFERENCE TO RELATED APPLICATIONS' || t === 'CROSS-REFERENCE TO RELATED APPLICATION' ||
                    t === 'CROSS REFERENCE TO RELATED APPLICATIONS' || t === 'CROSS REFERENCE TO RELATED APPLICATION') {
                    crossRefIndex = ci;
                    break;
                }
            }

            const resultLines = window.colorLines3.map((l, idx) => {
                const trimmed = l.text.trim();

                // 청구항 시작 이후는 번호 부여 중단
                if (trimmed === 'WHAT IS CLAIMED IS:' || trimmed === 'WHAT IS CLAIMED IS' ||
                    trimmed === '특허청구범위' || trimmed === '청구범위') {
                    afterClaimsSection = true;
                }

                // 표 내부 감지
                if (trimmed.startsWith('<table')) insideTable = true;
                if (trimmed.endsWith('</table>')) {
                    insideTable = false;
                    return l.text;
                }

                // CROSS-REFERENCE 이전이면 번호 부여 안함
                if (crossRefIndex >= 0 && idx < crossRefIndex) return l.text;

                // 국문단락이고, 표 밖이고, 청구항 이전이고, 마침표로 끝나는 경우에만 번호 추가
                if (l.type === 'korean' && !insideTable && !afterClaimsSection &&
                    trimmed && /[.。]["']?$/.test(trimmed)) {
                    const numStr = String(paragraphNum).padStart(4, '0');
                    paragraphNum++;
                    addedCount++;
                    return `[${numStr}] ${l.text}`;
                }

                return l.text;
            });
            
            if (addedCount === 0) {
                showMessage(msg, '❌ 단락번호를 추가할 국문단락이 없습니다.', 'error');
                return;
            }
            
            window.originalText3 = resultLines.join('\n');
            
            // colorLines3도 다시 생성
            afterClaims = false; afterTitle = false; beforeCross = true;
            window.colorLines3 = window.originalText3.split('\n').map((x, i) => ({id: i, text: x, type: detectType(x)}));
            
            // 미리보기 갱신
            updateColorPreview3();
            
            showMessage(msg, `✅ 국문단락에 단락번호가 추가되었습니다. (${addedCount}개)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 색변환용 단락번호 제거
        function removeParagraphNumbersColor3() {
            const msg = document.getElementById('colorMessage3');
            msg.classList.add('hidden');
            
            if (!window.colorLines3 || !window.originalText3) {
                showMessage(msg, '❌ 먼저 국문 색변환을 실행해주세요.', 'error');
                return;
            }
            
            const lines = window.originalText3.split('\n');
            let removedCount = 0;
            const resultLines = lines.map(line => {
                // 마침표로 끝나는 단락의 단락번호만 제거
                if (/^\[\d+\]/.test(line) && /[.。]["']?$/.test(line.trim())) {
                    removedCount++;
                    return line.replace(/^\[\d+\]\s?/, '');
                }
                return line;
            });
            
            if (removedCount === 0) {
                showMessage(msg, '❌ 제거할 단락번호가 없습니다.', 'error');
                return;
            }
            
            window.originalText3 = resultLines.join('\n');
            
            // colorLines3도 다시 생성
            afterClaims = false; afterTitle = false; beforeCross = true;
            window.colorLines3 = window.originalText3.split('\n').map((x, i) => ({id: i, text: x, type: detectType(x)}));
            
            // 미리보기 갱신
            updateColorPreview3();
            
            showMessage(msg, `✅ 단락번호가 제거되었습니다. (${removedCount}개)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 색변환 미리보기 갱신
        function updateColorPreview3() {
            const previewEl = document.getElementById('colorPreview3');
            let previewHtml = '';
            
            window.colorLines3.forEach(l => {
                if (l.type === 'empty') {
                    previewHtml += '<br>';
                    return;
                }
                if (l.type === 'pagebreak') {
                    previewHtml += '<div class="pagebreak-divider-plain">── 페이지 나누기 ──</div>';
                    return;
                }
                // 첨자 태그는 렌더링되도록 유지
                const renderedText = l.text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/&lt;sub&gt;/gi, '<sub>')
                    .replace(/&lt;\/sub&gt;/gi, '</sub>')
                    .replace(/&lt;sup&gt;/gi, '<sup>')
                    .replace(/&lt;\/sup&gt;/gi, '</sup>');
                if (l.type === 'korean') {
                    previewHtml += `<div data-line-type="korean" style="color:#993300;margin:3px 0;">${renderedText}</div>`;
                } else if (l.type === 'subtitle') {
                    previewHtml += `<div data-line-type="subtitle" style="color:#e67e22;font-weight:bold;margin:3px 0;">${renderedText}</div>`;
                } else if (l.type === 'english') {
                    previewHtml += `<div data-line-type="english" style="color:#2980b9;margin:3px 0;">${renderedText}</div>`;
                } else {
                    previewHtml += `<div data-line-type="${l.type}" style="margin:3px 0;">${renderedText}</div>`;
                }
            });
            previewEl.innerHTML = previewHtml;

            // 통계 갱신
            document.getElementById('colorTotalCount3').textContent = window.colorLines3.filter(l => l.type !== 'empty' && l.type !== 'pagebreak').length;
            document.getElementById('colorSubtitleCount3').textContent = window.colorLines3.filter(l => l.type === 'subtitle').length;
            document.getElementById('colorKoreanCount3').textContent = window.colorLines3.filter(l => l.type === 'korean').length;
            document.getElementById('colorEnglishCount3').textContent = window.colorLines3.filter(l => l.type === 'english').length;

            // 단락 개수, 첨자, 표 통계 계산 (한글/영어 분리)
            let krParagraphCount = 0, krSubCount = 0, krSupCount = 0, krTableCount = 0;
            let enParagraphCount = 0, enSubCount = 0, enSupCount = 0, enTableCount = 0;
            let insideTable = false;
            let afterClaimsSection = false;

            window.colorLines3.forEach(l => {
                const trimmed = l.text.trim();
                const isKorean = l.type === 'korean';

                if (trimmed === 'WHAT IS CLAIMED IS:' || trimmed === 'WHAT IS CLAIMED IS') {
                    afterClaimsSection = true;
                }

                if (trimmed.startsWith('<table')) insideTable = true;

                const tableMatches = l.text.match(/<table[^>]*>/gi);
                if (tableMatches) {
                    if (isKorean) krTableCount += tableMatches.length;
                    else enTableCount += tableMatches.length;
                }

                const subMatches = l.text.match(/<sub>/gi);
                const supMatches = l.text.match(/<sup>/gi);
                if (subMatches) { if (isKorean) krSubCount += subMatches.length; else enSubCount += subMatches.length; }
                if (supMatches) { if (isKorean) krSupCount += supMatches.length; else enSupCount += supMatches.length; }

                if (!afterClaimsSection && !insideTable && trimmed &&
                    !trimmed.startsWith('<table') && !trimmed.endsWith('</table>') &&
                    /[.。]["']?$/.test(trimmed)) {
                    if (isKorean) krParagraphCount++;
                    else if (l.type === 'english') enParagraphCount++;
                }

                if (trimmed.endsWith('</table>')) insideTable = false;
            });

            resetStatNavState('tab3_color');
            document.getElementById('colorKrParagraphCount3').textContent = krParagraphCount;
            document.getElementById('colorKrSubCount3').textContent = krSubCount;
            document.getElementById('colorKrSupCount3').textContent = krSupCount;
            document.getElementById('colorKrTableCount3').textContent = krTableCount;
            document.getElementById('colorEnParagraphCount3').textContent = enParagraphCount;
            document.getElementById('colorEnSubCount3').textContent = enSubCount;
            document.getElementById('colorEnSupCount3').textContent = enSupCount;
            document.getElementById('colorEnTableCount3').textContent = enTableCount;
        }

        // 영문본 양식표준화 (국문과 동일 조건)
        function standardizeFormatEng3() {
            const msg = document.getElementById('engParagraphNumMessage3');
            msg.classList.add('hidden');

            let text = window.englishRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 영문본이 없습니다.', 'error');
                return;
            }

            const result = applyFormatStandardization(text);

            if (result.changeCount === 0) {
                showMessage(msg, '❌ 적용할 양식 변경이 없습니다.', 'error');
                return;
            }

            window.englishRawText3 = result.text;
            updateEnglishDisplay3();

            showMessage(msg, `✅ 양식표준화 완료! (${result.changeCount}개 변경 적용)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }

        // 영문본 US양식 적용 (양식표준화 + US 특허출원 DOCX 양식 활성화)
        function applyUSFormatEng3() {
            const msg = document.getElementById('engParagraphNumMessage3');
            msg.classList.add('hidden');

            let text = window.englishRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 영문본이 없습니다.', 'error');
                return;
            }

            // 양식표준화가 아직 안 되어 있으면 먼저 적용
            const result = applyFormatStandardization(text);
            if (result.changeCount > 0) {
                window.englishRawText3 = result.text;
            }

            window.englishFormatStandardized = true; // US 특허출원 DOCX 양식 플래그
            updateEnglishDisplay3();

            const changes = result.changeCount > 0 ? ` 양식표준화 ${result.changeCount}개 변경 포함.` : '';
            showMessage(msg, `✅ US양식 적용 완료!${changes} DOCX 다운로드 시 US 특허출원 양식이 적용됩니다.`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 5000);
        }
        
        // 국문본 양식표준화
        function standardizeFormatKor3() {
            const msg = document.getElementById('korParagraphNumMessage3');
            msg.classList.add('hidden');
            
            let text = window.koreanRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 국문본이 없습니다.', 'error');
                return;
            }
            
            const result = applyFormatStandardization(text);
            
            if (result.changeCount === 0) {
                showMessage(msg, '❌ 적용할 양식 변경이 없습니다.', 'error');
                return;
            }
            
            window.koreanRawText3 = result.text;
            updateKoreanDisplay3();
            
            showMessage(msg, `✅ 양식표준화 완료! (${result.changeCount}개 변경 적용)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 영문본 단락번호 추가
        function addParagraphNumbersEng3() {
            const msg = document.getElementById('engParagraphNumMessage3');
            msg.classList.add('hidden');
            
            let text = window.englishRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 영문본이 없습니다.', 'error');
                return;
            }
            
            // 이미 단락번호가 있는지 확인 (0으로 시작하는 4~5자리, 뒤에 공백)
            if (/^\[0\d{3,4}\]\s/m.test(text)) {
                showMessage(msg, '⚠️ 이미 단락번호가 존재합니다. 단락번호를 제거한 후 다시 시도해주세요.', 'error');
                return;
            }
            
            const result = addParagraphNumbersToText(text);
            window.englishRawText3 = result.text;
            updateEnglishDisplay3();
            
            showMessage(msg, `✅ 단락번호가 추가되었습니다! (총 ${result.count}개 단락)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 영문본 단락번호 제거
        function removeParagraphNumbersEng3() {
            const msg = document.getElementById('engParagraphNumMessage3');
            msg.classList.add('hidden');

            let text = window.englishRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 영문본이 없습니다.', 'error');
                return;
            }

            const lines = text.split('\n');
            let removedCount = 0;
            // 모든 단락을 검사하여 규정된 양식(4~5자리 숫자)의 단락번호 제거
            const resultLines = lines.map(line => {
                if (/^\[\d{4,5}\]\s?/.test(line)) {
                    removedCount++;
                    return line.replace(/^\[\d{4,5}\]\s?/, '');
                }
                return line;
            });
            
            if (removedCount === 0) {
                showMessage(msg, '❌ 제거할 단락번호가 없습니다.', 'error');
                return;
            }
            
            window.englishRawText3 = resultLines.join('\n');
            updateEnglishDisplay3();
            
            showMessage(msg, `✅ 단락번호가 제거되었습니다! (${removedCount}개 제거)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 국문본 단락번호 추가
        function addParagraphNumbersKor3() {
            const msg = document.getElementById('korParagraphNumMessage3');
            msg.classList.add('hidden');
            
            let text = window.koreanRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 국문본이 없습니다.', 'error');
                return;
            }
            
            // 이미 단락번호가 있는지 확인 (0으로 시작하는 4~5자리, 뒤에 공백)
            if (/^\[0\d{3,4}\]\s/m.test(text)) {
                showMessage(msg, '⚠️ 이미 단락번호가 존재합니다. 단락번호를 제거한 후 다시 시도해주세요.', 'error');
                return;
            }
            
            const result = addParagraphNumbersToText(text);
            window.koreanRawText3 = result.text;
            updateKoreanDisplay3();
            
            showMessage(msg, `✅ 단락번호가 추가되었습니다! (총 ${result.count}개 단락)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 국문본 단락번호 제거
        function removeParagraphNumbersKor3() {
            const msg = document.getElementById('korParagraphNumMessage3');
            msg.classList.add('hidden');

            let text = window.koreanRawText3 || '';
            if (!text || text.includes('없습니다')) {
                showMessage(msg, '❌ 국문본이 없습니다.', 'error');
                return;
            }

            const lines = text.split('\n');
            let removedCount = 0;
            // 모든 단락을 검사하여 규정된 양식(4~5자리 숫자)의 단락번호 제거
            const resultLines = lines.map(line => {
                if (/^\[\d{4,5}\]\s?/.test(line)) {
                    removedCount++;
                    return line.replace(/^\[\d{4,5}\]\s?/, '');
                }
                return line;
            });
            
            if (removedCount === 0) {
                showMessage(msg, '❌ 제거할 단락번호가 없습니다.', 'error');
                return;
            }
            
            window.koreanRawText3 = resultLines.join('\n');
            updateKoreanDisplay3();
            
            showMessage(msg, `✅ 단락번호가 제거되었습니다! (${removedCount}개 제거)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 텍스트에 단락번호 추가 (공통 함수)
        // 부제목/청구항/CROSS-REFERENCE 판별 함수는 utils.js에서 로드됨
        function addParagraphNumbersToText(text) {
            const lines = text.split('\n');
            let counter = 1;
            let insideTable = false;

            // CROSS-REFERENCE 시작 위치 찾기 (이전 줄은 단락번호 부여 안함)
            const crossRefIndex = lines.findIndex(isCrossRefLine);

            // 청구항 시작 위치 찾기
            const stopIndex = lines.findIndex(isClaimsStartLine);

            const resultLines = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // 표 내부 감지
                if (trimmed.toLowerCase().startsWith('<table')) insideTable = true;
                if (trimmed.toLowerCase().includes('</table>')) {
                    insideTable = false;
                    resultLines.push(line);
                    continue;
                }

                // 종료 지점 도달 시, 또는 CROSS-REFERENCE 이전이면 번호 추가 중단
                let stopNumbering = (stopIndex >= 0 && i >= stopIndex) || (crossRefIndex >= 0 && i < crossRefIndex);
                
                // 번호 붙이기 로직 (마침표로 끝나는 단락만)
                if (!stopNumbering && trimmed && !isGenericSubtitle(line) && !insideTable && /[.。]["']?$/.test(trimmed)) {
                    if (!/^\[\d{4,5}\]\s/.test(trimmed)) {
                        const paraNum = '[' + counter.toString().padStart(4, '0') + '] ';
                        resultLines.push(paraNum + line);
                        counter++;
                    } else {
                        resultLines.push(line);
                    }
                } else {
                    resultLines.push(line);
                }
            }
            
            return { text: resultLines.join('\n'), count: counter - 1 };
        }
        
        // 영문본 표시 업데이트
        function updateEnglishDisplay3() {
            const text = window.englishRawText3 || '';
            const el = document.getElementById('englishResult3');
            el.innerHTML = text.replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/&lt;pagebreak\/&gt;/g,'<div class="pagebreak-divider">--- 페이지 나누기 ---</div>')
                .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>')
                .replace(/\[(\d+)\]/g,'<span class="para-num-mark">[$1]</span>')
                .replace(/\n/g,'<br>');
            
            // 렌더링 미리보기
            const renderEl = document.getElementById('englishRender3');
            if (renderEl) {
                renderEl.innerHTML = text.replace(/<pagebreak\/>/g,'<div class="pagebreak-divider">--- 페이지 나누기 ---</div>').replace(/\n/g,'<br>');
            }
        }
        
        // 국문본 표시 업데이트
        function updateKoreanDisplay3() {
            const text = window.koreanRawText3 || '';
            const el = document.getElementById('koreanResult3');
            el.innerHTML = text.replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/&lt;pagebreak\/&gt;/g,'<div class="pagebreak-divider">--- 페이지 나누기 ---</div>')
                .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>')
                .replace(/\[(\d+)\]/g,'<span class="para-num-mark">[$1]</span>')
                .replace(/\n/g,'<br>');
            
            // 렌더링 미리보기
            const renderEl = document.getElementById('koreanRender3');
            if (renderEl) {
                renderEl.innerHTML = text.replace(/<pagebreak\/>/g,'<div class="pagebreak-divider">--- 페이지 나누기 ---</div>').replace(/\n/g,'<br>');
            }
        }
        
        // 텍스트를 DOCX로 변환하여 다운로드 (HTML 태그 렌더링)
        // 영문본 + 양식표준화 실행: US 특허출원 양식 (A4, Arial 12pt, SEQ 단락번호, 행번호, 페이지번호)
        // 영문본 + 양식표준화 미실행: 기본 양식 (국문본과 동일)
        // 국문본: 기본 양식 (Letter, 12pt, 기본 줄간격)
        async function generateDocxFromText3(text, filename) {
            const isEnglish = filename.toLowerCase().includes('english');
            if (isEnglish && window.englishFormatStandardized) {
                await generateDocxUSPatent(text, filename);
            } else {
                await generateDocxBasic(text, filename);
            }
        }

        // 기존 기본 DOCX 생성 (국문본용)
        async function generateDocxBasic(text, filename) {
            const zip = new JSZip();

            zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

            zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

            zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

            zip.file('word/styles.xml', makeDocxStylesXml({ fontSize: 24 })); // 단락 뒤 간격 0pt (utils.js)

            let bodyContent = '';
            const paragraphs = text.split('\n');

            for (const para of paragraphs) {
                const trimmed = para.trim();
                if (trimmed === '<pagebreak/>') {
                    bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
                    continue;
                }
                if (!trimmed) {
                    bodyContent += '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>';
                    continue;
                }
                if (para.includes('<table')) {
                    bodyContent += convertTableToDocx3(para);
                } else {
                    bodyContent += `<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>${convertRunToDocx3(para)}</w:r></w:p>`;
                }
            }

            const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${bodyContent}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;

            zip.file('word/document.xml', documentXml);

            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, filename);
        }

        // US 특허출원 양식 DOCX 생성 (영문본용)
        // - A4, 여백(top=1440, bottom=1701, left/right=1701), 줄간격 2배, Arial 12pt
        // - SEQ 필드 단락번호 [0001]~ (4자리 고정, 단락 삭제/추가 시 재열기로 자동 갱신)
        // - 5행마다 행번호, 페이지번호 (푸터), docGrid
        async function generateDocxUSPatent(text, filename) {
            const zip = new JSZip();

            // === 부제목/청구항 판별 헬퍼 (utils.js의 공통 판별 함수 사용) ===
            function isSubtitleLine(line) {
                return isGenericSubtitle(line, { checkSymbols: true, checkNumberedHeading: true });
            }

            function stripTextParagraphNumber(line) {
                return line.replace(/^\[\d+\]\s?/, '');
            }

            function isNumberedBodyParagraph(line, inClaims, inTable, beforeCrossRef, inAbstract) {
                const t = line.trim();
                if (!t) return false;
                if (t === '<pagebreak/>') return false;
                if (inClaims) return false;
                if (inAbstract) return false;
                if (inTable) return false;
                if (beforeCrossRef) return false;
                if (isSubtitleLine(line)) return false;
                if (line.includes('<table')) return false;
                if (/[.。]["']?$/.test(t)) return true;
                return false;
            }

            // === SEQ 필드 단락번호 XML 생성 ===
            // { SEQ ParagraphNum \# "0000" } → 4자리 고정 (0001~0999)
            let seqCounter = 1;
            function makeSeqFieldXml() {
                const cacheVal = String(seqCounter).padStart(4, '0');
                seqCounter++;
                const seqRPr = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr>';
                return '' +
                    // [
                    `<w:r>${seqRPr}<w:t>[</w:t></w:r>` +
                    // SEQ begin
                    `<w:r>${seqRPr}<w:fldChar w:fldCharType="begin"/></w:r>` +
                    // instrText
                    `<w:r>${seqRPr}<w:instrText xml:space="preserve"> SEQ ParagraphNum \\# "0000" </w:instrText></w:r>` +
                    // separate
                    `<w:r>${seqRPr}<w:fldChar w:fldCharType="separate"/></w:r>` +
                    // cache value
                    `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="000000"/><w:sz w:val="24"/><w:noProof/></w:rPr><w:t>${cacheVal}</w:t></w:r>` +
                    // end
                    `<w:r>${seqRPr}<w:fldChar w:fldCharType="end"/></w:r>` +
                    // ]
                    `<w:r>${seqRPr}<w:t>]</w:t></w:r>` +
                    // 공백 2개
                    `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">  </w:t></w:r>`;
            }

            // === pPr/rPr 공통 XML 조각 ===
            const rPrBody = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr>';
            const rPrHeading = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:szCs w:val="24"/></w:rPr>';
            // 25라인/페이지: 본문영역(16838-1440-1701=13697) / 25 = 548 DXA
            const pPrSpacing = '<w:spacing w:after="0" w:line="548" w:lineRule="exact"/>';

            // === 본문 생성 ===
            let bodyContent = '';
            const lines = text.split('\n');
            let inClaims = false;
            let inAbstract = false;
            let inTable = false;

            const crossRefIndex = lines.findIndex(isCrossRefLine);

            for (let i = 0; i < lines.length; i++) {
                const para = lines[i];
                const trimmed = para.trim();

                // 페이지 나누기
                if (trimmed === '<pagebreak/>') {
                    bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
                    continue;
                }

                // 빈 줄
                if (!trimmed) {
                    bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr></w:p>`;
                    continue;
                }

                // 표 내부 추적
                if (trimmed.toLowerCase().startsWith('<table')) inTable = true;
                if (trimmed.toLowerCase().includes('</table>')) {
                    inTable = false;
                    bodyContent += convertTableToDocx3(para);
                    continue;
                }
                if (inTable) {
                    bodyContent += convertTableToDocx3(para);
                    continue;
                }

                // 청구항 시작 감지
                if (isClaimsStartLine(para)) {
                    inClaims = true;
                    bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrHeading}${convertRunToDocxArial(trimmed)}</w:r></w:p>`;
                    continue;
                }

                // 청구항 내부 단락
                if (inClaims) {
                    const upperTrimmed = trimmed.toUpperCase();
                    if (upperTrimmed === 'ABSTRACT' || upperTrimmed === 'ABSTRACT OF DISCLOSURE') {
                        inClaims = false;
                        inAbstract = true;
                        bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrHeading}${convertRunToDocxArial(trimmed)}</w:r></w:p>`;
                        continue;
                    }

                    const isClaimNum = /^\d+\.\s*$/.test(trimmed);
                    if (isClaimNum) {
                        bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrBody}${convertRunToDocxArial(trimmed)}</w:r></w:p>`;
                    } else {
                        const claimText = stripTextParagraphNumber(trimmed);
                        const cleanText = claimText.replace(/^\d+\.\t/, (m) => m);
                        bodyContent += `<w:p><w:pPr>${pPrSpacing}<w:ind w:firstLine="799"/></w:pPr><w:r>${rPrBody}${convertRunToDocxArial(cleanText)}</w:r></w:p>`;
                    }
                    continue;
                }

                let beforeCrossRef = (crossRefIndex >= 0 && i < crossRefIndex);

                // ABSTRACT 섹션 감지 (청구항 밖에서 도달한 경우)
                const upperTrimmedBody = trimmed.toUpperCase();
                if (!inAbstract && (upperTrimmedBody === 'ABSTRACT' || upperTrimmedBody === 'ABSTRACT OF DISCLOSURE')) {
                    inAbstract = true;
                    bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrHeading}${convertRunToDocxArial(trimmed)}</w:r></w:p>`;
                    continue;
                }

                // 부제목 → 번호 없음, 헤딩 서식
                if (isSubtitleLine(para)) {
                    bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrHeading}${convertRunToDocxArial(trimmed)}</w:r></w:p>`;
                    continue;
                }

                // 표 처리
                if (para.includes('<table')) {
                    bodyContent += convertTableToDocx3(para);
                    continue;
                }

                // 본문 단락: SEQ 필드 단락번호 적용 여부 판별
                if (isNumberedBodyParagraph(para, inClaims, inTable, beforeCrossRef, inAbstract)) {
                    const cleanPara = stripTextParagraphNumber(trimmed);
                    bodyContent += `<w:p><w:pPr>${pPrSpacing}<w:ind w:leftChars="0"/></w:pPr>${makeSeqFieldXml()}<w:r>${rPrBody}${convertRunToDocxArial(cleanPara)}</w:r></w:p>`;
                } else {
                    const cleanPara = stripTextParagraphNumber(trimmed);
                    bodyContent += `<w:p><w:pPr>${pPrSpacing}</w:pPr><w:r>${rPrBody}${convertRunToDocxArial(cleanPara)}</w:r></w:p>`;
                }
            }

            // === document.xml ===
            const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${bodyContent}
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

            // === numbering.xml (호환성 유지, 본문 번호는 SEQ 필드 사용) ===
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
<w:start w:val="1"/>
<w:numFmt w:val="decimalZero"/>
<w:lvlRestart w:val="0"/>
<w:lvlText w:val="[00%1]"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr>
<w:rPr>
<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
<w:b/>
<w:i w:val="0"/>
<w:caps w:val="0"/>
<w:strike w:val="0"/>
<w:dstrike w:val="0"/>
<w:outline w:val="0"/>
<w:shadow w:val="0"/>
<w:emboss w:val="0"/>
<w:imprint w:val="0"/>
<w:vanish w:val="0"/>
<w:color w:val="000000"/>
<w:sz w:val="24"/>
<w:u w:val="none"/>
<w:effect w:val="none"/>
<w:vertAlign w:val="baseline"/>
</w:rPr>
</w:lvl>
<w:lvl w:ilvl="1" w:tplc="ADA413E2">
<w:start w:val="1"/>
<w:numFmt w:val="decimal"/>
<w:lvlText w:val="%2."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1160" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="2" w:tplc="0409001B" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="lowerRoman"/>
<w:lvlText w:val="%3."/><w:lvlJc w:val="right"/>
<w:pPr><w:ind w:left="1600" w:hanging="400"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="3" w:tplc="0409000F" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="decimal"/>
<w:lvlText w:val="%4."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2000" w:hanging="400"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="4" w:tplc="04090019" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="upperLetter"/>
<w:lvlText w:val="%5."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2400" w:hanging="400"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="5" w:tplc="0409001B" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="lowerRoman"/>
<w:lvlText w:val="%6."/><w:lvlJc w:val="right"/>
<w:pPr><w:ind w:left="2800" w:hanging="400"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="6" w:tplc="0409000F" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="decimal"/>
<w:lvlText w:val="%7."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="3200" w:hanging="400"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="7" w:tplc="04090019" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="upperLetter"/>
<w:lvlText w:val="%8."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="3600" w:hanging="400"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="8" w:tplc="0409001B" w:tentative="1">
<w:start w:val="1"/><w:numFmt w:val="lowerRoman"/>
<w:lvlText w:val="%9."/><w:lvlJc w:val="right"/>
<w:pPr><w:ind w:left="4000" w:hanging="400"/></w:pPr>
</w:lvl>
</w:abstractNum>
<w:num w:numId="1">
<w:abstractNumId w:val="0"/>
</w:num>
</w:numbering>`;

            // === styles.xml ===
            const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr>
<w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>
<w:kern w:val="2"/>
<w:szCs w:val="22"/>
<w:lang w:val="en-US" w:eastAsia="ko-KR" w:bidi="ar-SA"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr>
<w:spacing w:after="0" w:line="259" w:lineRule="auto"/>
<w:jc w:val="both"/>
</w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="a">
<w:name w:val="Normal"/>
<w:pPr>
<w:widowControl w:val="0"/>
<w:wordWrap w:val="0"/>
<w:autoSpaceDE w:val="0"/>
<w:autoSpaceDN w:val="0"/>
</w:pPr>
<w:rPr>
<w:rFonts w:ascii="바탕체" w:eastAsia="바탕체" w:hAnsi="바탕체"/>
<w:sz w:val="24"/>
</w:rPr>
</w:style>
<w:style w:type="character" w:default="1" w:styleId="a0">
<w:name w:val="Default Paragraph Font"/>
</w:style>
<w:style w:type="table" w:default="1" w:styleId="a1">
<w:name w:val="Normal Table"/>
</w:style>
<w:style w:type="numbering" w:default="1" w:styleId="a2">
<w:name w:val="No List"/>
</w:style>
<w:style w:type="paragraph" w:styleId="a3">
<w:name w:val="header"/>
<w:basedOn w:val="a"/>
<w:pPr>
<w:tabs/>
<w:snapToGrid w:val="0"/>
</w:pPr>
</w:style>
<w:style w:type="paragraph" w:styleId="a4">
<w:name w:val="footer"/>
<w:basedOn w:val="a"/>
<w:pPr>
<w:tabs/>
<w:snapToGrid w:val="0"/>
</w:pPr>
</w:style>
<w:style w:type="character" w:styleId="a5">
<w:name w:val="line number"/>
<w:basedOn w:val="a0"/>
</w:style>
<w:style w:type="character" w:styleId="a6">
<w:name w:val="page number"/>
<w:basedOn w:val="a0"/>
</w:style>
<w:style w:type="paragraph" w:styleId="a7">
<w:name w:val="List Paragraph"/>
<w:basedOn w:val="a"/>
<w:pPr>
<w:ind w:leftChars="400" w:left="800"/>
</w:pPr>
</w:style>
</w:styles>`;

            // === settings.xml ===
            const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:o="urn:schemas-microsoft-com:office:office">
<w:zoom w:percent="100"/>
<w:bordersDoNotSurroundHeader/>
<w:bordersDoNotSurroundFooter/>
<w:defaultTabStop w:val="800"/>
<w:characterSpacingControl w:val="doNotCompress"/>
<w:themeFontLang w:val="en-US" w:eastAsia="ko-KR"/>
<w:decimalSymbol w:val="."/>
<w:listSeparator w:val=","/>
</w:settings>`;

            // === 헤더 (빈 내용) ===
            const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:pStyle w:val="a3"/></w:pPr></w:p>
</w:hdr>`;

            // === 푸터 (footer1/footer2 — PAGE 필드 + 빈 단락) ===
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

            // === 푸터 (footer3 — 첫 페이지, 빈 단락만) ===
            const footerFirstPageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:pStyle w:val="a4"/></w:pPr></w:p>
</w:ftr>`;

            // === [Content_Types].xml ===
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

            // === _rels/.rels ===
            zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

            // === word/_rels/document.xml.rels ===
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

            // === 파일 생성 ===
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

            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, filename);
        }
        
        // 텍스트를 DOCX run으로 변환 (sub, sup 처리) - font size 12pt
        function convertRunToDocx3(text) {
            let result = '';
            let i = 0;

            while (i < text.length) {
                // <sub> 태그 처리
                if (text.substr(i, 5).toLowerCase() === '<sub>') {
                    const endIdx = text.toLowerCase().indexOf('</sub>', i);
                    if (endIdx !== -1) {
                        const subText = text.substring(i + 5, endIdx);
                        result += `</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="subscript"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(subText)}</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">`;
                        i = endIdx + 6;
                        continue;
                    }
                }
                // <sup> 태그 처리
                if (text.substr(i, 5).toLowerCase() === '<sup>') {
                    const endIdx = text.toLowerCase().indexOf('</sup>', i);
                    if (endIdx !== -1) {
                        const supText = text.substring(i + 5, endIdx);
                        result += `</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(supText)}</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">`;
                        i = endIdx + 6;
                        continue;
                    }
                }
                // <br> 태그 처리
                if (text.substr(i, 4).toLowerCase() === '<br>' || text.substr(i, 5).toLowerCase() === '<br/>') {
                    result += '</w:t><w:br/><w:t xml:space="preserve">';
                    i += text.substr(i, 4).toLowerCase() === '<br>' ? 4 : 5;
                    continue;
                }
                result += escapeXml(text[i]);
                i++;
            }

            return `<w:t xml:space="preserve">${result}</w:t>`;
        }

        // US특허 양식용 run 변환 - sub/sup 생성 run에도 Arial 폰트 유지
        function convertRunToDocxArial(text) {
            const arialFonts = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="24"/>';
            let result = '';
            let i = 0;

            while (i < text.length) {
                // <sub> 태그 처리
                if (text.substr(i, 5).toLowerCase() === '<sub>') {
                    const endIdx = text.toLowerCase().indexOf('</sub>', i);
                    if (endIdx !== -1) {
                        const subText = text.substring(i + 5, endIdx);
                        result += `</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="subscript"/>${arialFonts}</w:rPr><w:t xml:space="preserve">${escapeXml(subText)}</w:t></w:r><w:r><w:rPr>${arialFonts}</w:rPr><w:t xml:space="preserve">`;
                        i = endIdx + 6;
                        continue;
                    }
                }
                // <sup> 태그 처리
                if (text.substr(i, 5).toLowerCase() === '<sup>') {
                    const endIdx = text.toLowerCase().indexOf('</sup>', i);
                    if (endIdx !== -1) {
                        const supText = text.substring(i + 5, endIdx);
                        result += `</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="superscript"/>${arialFonts}</w:rPr><w:t xml:space="preserve">${escapeXml(supText)}</w:t></w:r><w:r><w:rPr>${arialFonts}</w:rPr><w:t xml:space="preserve">`;
                        i = endIdx + 6;
                        continue;
                    }
                }
                // <br> 태그 처리
                if (text.substr(i, 4).toLowerCase() === '<br>' || text.substr(i, 5).toLowerCase() === '<br/>') {
                    result += '</w:t><w:br/><w:t xml:space="preserve">';
                    i += text.substr(i, 4).toLowerCase() === '<br>' ? 4 : 5;
                    continue;
                }
                result += escapeXml(text[i]);
                i++;
            }

            return `<w:t xml:space="preserve">${result}</w:t>`;
        }
        
        // 표를 DOCX 형식으로 변환
        function convertTableToDocx3(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const table = doc.querySelector('table');
            
            if (!table) return `<w:p><w:r><w:t>${escapeXml(html)}</w:t></w:r></w:p>`;
            
            let tableXml = '<w:tbl><w:tblPr><w:tblBorders>';
            tableXml += '<w:top w:val="single" w:sz="4" w:color="000000"/>';
            tableXml += '<w:left w:val="single" w:sz="4" w:color="000000"/>';
            tableXml += '<w:bottom w:val="single" w:sz="4" w:color="000000"/>';
            tableXml += '<w:right w:val="single" w:sz="4" w:color="000000"/>';
            tableXml += '<w:insideH w:val="single" w:sz="4" w:color="000000"/>';
            tableXml += '<w:insideV w:val="single" w:sz="4" w:color="000000"/>';
            tableXml += '</w:tblBorders></w:tblPr>';
            
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                tableXml += '<w:tr>';
                const cells = row.querySelectorAll('td, th');
                cells.forEach(cell => {
                    const colspan = cell.getAttribute('colspan') || 1;
                    const rowspan = cell.getAttribute('rowspan') || 1;
                    
                    tableXml += '<w:tc><w:tcPr>';
                    if (colspan > 1) tableXml += `<w:gridSpan w:val="${colspan}"/>`;
                    if (rowspan > 1) tableXml += `<w:vMerge w:val="restart"/>`;
                    tableXml += '</w:tcPr>';
                    tableXml += `<w:p><w:r>${convertRunToDocx3(cell.innerHTML)}</w:r></w:p>`;
                    tableXml += '</w:tc>';
                });
                tableXml += '</w:tr>';
            });
            
            tableXml += '</w:tbl>';
            return tableXml;
        }
        
        // escapeXml은 utils.js에서 로드됨
        function togglePreview3() {
            const c = document.getElementById('previewContent3'), b = document.getElementById('toggleBtn3');
            if (c.classList.contains('collapsed')) { c.classList.remove('collapsed'); b.textContent = '▲ 접기'; }
            else { c.classList.add('collapsed'); b.textContent = '▼ 펼치기'; }
        }
        function clearAll3() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            document.getElementById('inputText3').value = '';
            document.getElementById('fileName3').textContent = '또는 아래에 .docx 파일을 드래그하세요';
            lines3 = []; afterClaims = false; afterTitle = false; beforeCross = true;
            currentFilter3 = 'all';
            document.getElementById('paragraphList3').innerHTML = '';
            document.getElementById('koreanResult3').innerHTML = '국문본이 여기에 표시됩니다';
            document.getElementById('englishResult3').innerHTML = '영문본이 여기에 표시됩니다';
            // 원본 텍스트 변수 초기화
            window.koreanRawText3 = '';
            window.englishRawText3 = '';
            window.englishFormatStandardized = false;
            window.colorLines3 = null;
            window.originalText3 = '';
            ['stats3Section','preview3Section','result3Section','colorResult3Section'].forEach(x => document.getElementById(x).classList.add('hidden'));
            document.getElementById('previewContent3').classList.add('collapsed');
            document.getElementById('toggleBtn3').textContent = '▼ 펼치기';
            // 필터 버튼 초기화
            document.querySelectorAll('#stats3Section .stat-card.clickable').forEach(card => {
                card.classList.remove('active');
                if (card.dataset.filter === 'all') card.classList.add('active');
            });
            // 통계 초기화
            document.getElementById('koreanParagraphCount3').textContent = '0';
            document.getElementById('koreanClaimCount3').textContent = '0';
            document.getElementById('koreanSubCount3').textContent = '0';
            document.getElementById('koreanSupCount3').textContent = '0';
            document.getElementById('koreanTableCount3').textContent = '0';
            document.getElementById('englishParagraphCount3').textContent = '0';
            document.getElementById('englishClaimCount3').textContent = '0';
            document.getElementById('englishSubCount3').textContent = '0';
            document.getElementById('englishSupCount3').textContent = '0';
            document.getElementById('englishTableCount3').textContent = '0';
            // 색변환 통계 초기화
            document.getElementById('colorTotalCount3').textContent = '0';
            document.getElementById('colorSubtitleCount3').textContent = '0';
            document.getElementById('colorKoreanCount3').textContent = '0';
            document.getElementById('colorEnglishCount3').textContent = '0';
            document.getElementById('colorKrParagraphCount3').textContent = '0';
            document.getElementById('colorKrSubCount3').textContent = '0';
            document.getElementById('colorKrSupCount3').textContent = '0';
            document.getElementById('colorKrTableCount3').textContent = '0';
            document.getElementById('colorEnParagraphCount3').textContent = '0';
            document.getElementById('colorEnSubCount3').textContent = '0';
            document.getElementById('colorEnSupCount3').textContent = '0';
            document.getElementById('colorEnTableCount3').textContent = '0';
            document.getElementById('colorPreview3').innerHTML = '색변환 미리보기가 여기에 표시됩니다.';
            document.getElementById('colorMessage3').classList.add('hidden');
            // 렌더링 패널 초기화
            document.getElementById('koreanRenderPanel3').style.display = 'none';
            document.getElementById('koreanRender3').innerHTML = '';
            document.getElementById('englishRenderPanel3').style.display = 'none';
            document.getElementById('englishRender3').innerHTML = '';
            // 분할 입력 초기화
            splitSlots3 = [];
            splitSlotIdCounter3 = 0;
            renderSplitSlots3();
        }

        // ── 분할 입력 (탭3) ──────────────────────────────────────────
        let splitSlots3 = [];
        let splitSlotIdCounter3 = 0;

        function setInputMode3(mode) {
            const isSplit = mode === 'split';
            document.getElementById('modeBtn3Single').classList.toggle('active', !isSplit);
            document.getElementById('modeBtn3Split').classList.toggle('active', isSplit);
            document.getElementById('singleInputArea3').style.display = isSplit ? 'none' : '';
            document.getElementById('splitInputArea3').style.display = isSplit ? '' : 'none';
            document.getElementById('btnGroup3Single').style.display = isSplit ? 'none' : '';
            document.getElementById('btnGroup3Split').style.display = isSplit ? '' : 'none';
            if (isSplit && splitSlots3.length === 0) {
                addSplitSlot3(); addSplitSlot3();
            }
        }

        function addSplitSlot3() {
            const id = ++splitSlotIdCounter3;
            splitSlots3.push({ id, fileName: '' });
            renderSplitSlots3();
        }

        function removeSplitSlot3(id) {
            splitSlots3 = splitSlots3.filter(s => s.id !== id);
            renderSplitSlots3();
        }

        function clearAllSplit3() {
            if (!confirm('모든 분할 입력을 지우시겠습니까?')) return;
            splitSlots3 = [];
            splitSlotIdCounter3 = 0;
            addSplitSlot3(); addSplitSlot3();
        }

        function renderSplitSlots3() {
            const container = document.getElementById('splitSlotList3');
            // 재렌더링 전 현재 textarea 내용 저장
            splitSlots3.forEach(slot => {
                const ta = document.getElementById(`splitTextarea3_${slot.id}`);
                if (ta) slot.content = ta.value;
            });
            container.innerHTML = '';
            splitSlots3.forEach((slot, idx) => {
                const div = document.createElement('div');
                div.className = 'split-slot';
                div.innerHTML = `
                    <div class="split-slot-header">
                        <span class="split-slot-num">파트 ${idx + 1}</span>
                        <input type="file" id="splitFile3_${slot.id}" accept=".docx" style="display:none;">
                        <button class="file-select-btn" style="padding:5px 12px;font-size:0.82em;" onclick="document.getElementById('splitFile3_${slot.id}').click()">📁 파일 선택</button>
                        <span class="file-name-display split-slot-filename" id="splitFileName3_${slot.id}">${slot.fileName || '파일 선택 또는 아래 직접 입력'}</span>
                        ${splitSlots3.length > 1 ? `<button class="split-slot-remove" onclick="removeSplitSlot3(${slot.id})" title="제거">✕</button>` : ''}
                    </div>
                    <textarea class="split-slot-textarea" id="splitTextarea3_${slot.id}" placeholder="텍스트를 입력하거나 .docx 파일을 드래그하세요..."></textarea>
                `;
                container.appendChild(div);

                // 저장된 내용 복원
                document.getElementById(`splitTextarea3_${slot.id}`).value = slot.content || '';

                document.getElementById(`splitFile3_${slot.id}`).addEventListener('change', async function(e) {
                    if (e.target.files[0]) await handleFileSplitSlot3(slot.id, e.target.files[0]);
                });

                const ta = document.getElementById(`splitTextarea3_${slot.id}`);
                setupDropZone(ta, file => handleFileSplitSlot3(slot.id, file)); // 드래그 앤 드롭 (utils.js)
            });
        }

        async function handleFileSplitSlot3(id, file) {
            await handleDocxUpload(file, `splitFileName3_${id}`, async (file) => {
                const slot = splitSlots3.find(s => s.id === id);
                if (slot) slot.fileName = file.name;
                document.getElementById(`splitTextarea3_${id}`).value = await extractTextFromDocx3(file);
            });
        }

        function completeSplitInput3() {
            const chunks = splitSlots3
                .map(s => (document.getElementById(`splitTextarea3_${s.id}`) || {}).value || '')
                .filter(t => t.trim());
            if (chunks.length === 0) { alert('입력된 내용이 없습니다.'); return; }
            if (chunks.length === 1) {
                document.getElementById('inputText3').value = chunks[0];
                analyzeText3(); return;
            }
            const { text, duplicates } = mergeSplitChunks3(chunks);
            document.getElementById('inputText3').value = text;

            // 기존 경고 제거 후 새 경고 표시
            const existingWarn = document.getElementById('splitMergeWarning3');
            if (existingWarn) existingWarn.remove();
            if (duplicates.length > 0) {
                const warn = document.createElement('div');
                warn.id = 'splitMergeWarning3';
                warn.className = 'split-merge-warning';
                const nums = [...new Set(duplicates.map(d => `[${String(d.num).padStart(4,'0')}]`))].join(', ');
                warn.textContent = `⚠️ 중복 단락번호 발견 (첫 번째 항목을 사용): ${nums}`;
                document.getElementById('btnGroup3Split').after(warn);
            }
            analyzeText3();
        }

        function mergeSplitChunks3(chunks) {
            const PARA_RE = /^\[(\d{4,5})\]\s/;
            function isDos(l) { return isDescriptionOfSymbols(l.trim()); }
            function isClaims(l) {
                const s = l.trim();
                return s === 'WHAT IS CLAIMED IS:' || s === 'WHAT IS CLAIMED IS' ||
                       s === '【CLAIMS】' || s === '【청구의 범위】' || s === '【청구범위】';
            }
            function isAbstract(l) {
                const s = l.trim().toUpperCase();
                return s === 'ABSTRACT OF DISCLOSURE' || s === 'ABSTRACT' ||
                       s === '【ABSTRACT】' || s === '【요약】';
            }
            function langPri(l) { return /[가-힣]/.test(l) ? 0 : 1; }

            const groups = [];                          // {num, lang, line, headers:[], trailing:[]}
            const dosLines = [], claimsLines = [], absLines = [], pre = [];
            let secState = 'body';                      // 'body' | 'dos' | 'claims' | 'abs'
            let bodyState = 'pre';                      // 'pre' | 'in_group' | 'between'
            let pending = [];                           // 다음 그룹의 섹션헤더 후보

            for (const chunk of chunks) {
                if (!chunk.trim()) continue;
                secState = 'body';  // 각 청크는 독립적으로 본문 파싱 시작 (이전 청크의 특수 섹션 상태 이월 방지)
                for (const line of chunk.split('\n')) {
                    const t = line.trim();

                    // ── 특수 섹션 라우팅 ──
                    if (secState === 'abs') { absLines.push(line); continue; }
                    if (secState === 'claims') {
                        if (isAbstract(line)) { secState = 'abs'; absLines.push(line); pending = []; }
                        else claimsLines.push(line);
                        continue;
                    }
                    if (secState === 'dos') {
                        if (isClaims(line)) { secState = 'claims'; claimsLines.push(line); pending = []; }
                        else if (isAbstract(line)) { secState = 'abs'; absLines.push(line); pending = []; }
                        else dosLines.push(line);
                        continue;
                    }

                    // ── 특수 섹션 진입 감지 ──
                    if (isAbstract(line)) { secState = 'abs'; bodyState = 'between'; absLines.push(line); pending = []; continue; }
                    if (isClaims(line)) { secState = 'claims'; bodyState = 'between'; claimsLines.push(line); pending = []; continue; }
                    if (isDos(line)) { secState = 'dos'; bodyState = 'between'; dosLines.push(line); pending = []; continue; }

                    // ── 본문 처리 ──
                    const m = line.match(PARA_RE);
                    if (m) {
                        // 번호단락: pending(섹션헤더)을 headers로 가져오고 trailing 초기화
                        groups.push({ num: parseInt(m[1]), lang: langPri(line), line, headers: pending, trailing: [] });
                        pending = [];
                        bodyState = 'in_group';
                    } else if (!t) {
                        // 빈 줄
                        if (bodyState === 'pre') pre.push(line);
                        else if (bodyState === 'in_group') bodyState = 'between'; // 그룹 trailing 종료
                        // 'between' 상태의 빈 줄은 버림 (헤더 구분선은 재구성 시 추가)
                    } else {
                        // 비어있지 않은 비번호 줄
                        if (bodyState === 'pre') {
                            pre.push(line);
                        } else if (bodyState === 'in_group') {
                            // 번호단락 직후 → 영문단락 등 trailing 콘텐츠
                            groups[groups.length - 1].trailing.push(line);
                        } else {
                            // 'between' → 다음 번호단락의 섹션헤더 후보
                            pending.push(line);
                        }
                    }
                }
                // 청크 경계: in_group 상태를 이월하지 않음
                if (bodyState === 'in_group') bodyState = 'between';
            }

            // 정렬: 번호 오름차순, 동일 번호는 한국어(0) 우선
            groups.sort((a, b) => a.num !== b.num ? a.num - b.num : a.lang - b.lang);

            // 중복 제거 (같은 번호+언어 → 첫 번째 유지)
            const seen = new Set(), dups = [];
            const deduped = groups.filter(g => {
                const k = `${g.num}-${g.lang}`;
                if (seen.has(k)) { dups.push(g); return false; }
                seen.add(k); return true;
            });

            // 재조합
            const out = [...pre];
            let prevHKey = null;
            for (const g of deduped) {
                if (g.headers.length > 0) {
                    const hk = g.headers.join('\n');
                    if (hk !== prevHKey) {
                        if (out.length && out[out.length - 1].trim() !== '') out.push('');
                        out.push(...g.headers);
                        prevHKey = hk;
                    }
                }
                out.push(g.line);
                out.push(...g.trailing);  // 영문단락 등 trailing 콘텐츠 포함
            }

            // 후미 섹션: DoS → Claims → Abstract
            if (dosLines.length) { out.push(''); out.push(...dosLines); }
            if (claimsLines.length) { out.push(''); out.push(...claimsLines); }
            if (absLines.length) { out.push(''); out.push(...absLines); }

            return { text: out.join('\n'), duplicates: dups };
        }

        // 서브탭 전환 함수 (탭3)
        function switchSubTab3(tabType, btn) {
            document.querySelectorAll('#tab3 .sub-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#tab3 .sub-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            if (tabType === 'extract') {
                document.getElementById('subTab3Extract').classList.add('active');
            } else {
                document.getElementById('subTab3Merge').classList.add('active');
            }
        }
        
