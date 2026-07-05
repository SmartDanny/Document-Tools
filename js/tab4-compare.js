/**
 * Document Tools - js/tab4-compare.js
 * 탭4: 문서 비교 (텍스트/DOCX Track-Changes)
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // 탭4 - 문서 비교
        
        // 탭4 - 워드 파일에서 텍스트 추출 (번호 매기기 포함)
        async function extractTextFromDocx4(file) {
            // loadDocxDocument, parseDocxNumbering, formatNumber, extractDocxPlainText는 utils.js에서 로드됨
            const { zip, doc } = await loadDocxDocument(file);
            const numberingDefs = await parseDocxNumbering(zip);

            const paras = [];
            for (const p of doc.getElementsByTagName('w:p')) {
                let text = '';

                // 단락 번호 처리
                const pPr = p.getElementsByTagName('w:pPr')[0];
                const numPr = pPr?.getElementsByTagName('w:numPr')[0];
                if (numPr) {
                    const numId = numPr.getElementsByTagName('w:numId')[0]?.getAttribute('w:val');
                    const ilvl = numPr.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val') || '0';
                    if (numId && numberingDefs[numId] && numberingDefs[numId][ilvl]) {
                        const lvlDef = numberingDefs[numId][ilvl];
                        const formattedNum = formatNumber(lvlDef.counter, lvlDef.numFmt);
                        // lvlText 패턴 적용 (예: "%1.", "%1)", "(%1)" 등)
                        let numText = lvlDef.lvlText.replace(/%\d+/g, formattedNum);
                        text = numText + ' ';
                        lvlDef.counter++;
                    }
                }

                text += extractDocxPlainText(p);
                paras.push(text);
            }
            return paras.join('\n');
        }
        
        // 텍스트 정규화 함수 (포맷 무시를 위해)
        function normalizeText(text) {
            return text
                .replace(/\r\n/g, '\n')           // 줄바꿈 통일
                .replace(/\r/g, '\n')             // 줄바꿈 통일
                .replace(/\t/g, ' ')              // 탭을 공백으로
                .replace(/ +/g, ' ')              // 연속 공백을 하나로
                .trim();                          // 앞뒤 공백 제거
        }
        
        // 라인 정규화 함수 (비교용)
        function normalizeLine(line) {
            return line
                .replace(/^\s*\[\d+\]\s*/g, '')   // 단락번호 [0001], [00100] 등 모든 자리수 제거
                .replace(/\t/g, ' ')              // 탭을 공백으로
                .replace(/ +/g, ' ')              // 연속 공백을 하나로
                .trim();                          // 앞뒤 공백 제거
        }
        
        // 탭4 - 파일 처리 함수 (문서1)
        async function handleFile4a(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.docx')) {
                alert('❌ .docx 파일만 업로드 가능합니다.');
                return;
            }
            document.getElementById('fileName4a').textContent = file.name;
            try {
                const text = await extractTextFromDocx4(file);
                document.getElementById('inputText4a').value = text;
            } catch (error) { 
                alert('오류: ' + error.message); 
            }
        }
        
        // 탭4 - 파일 처리 함수 (문서2)
        async function handleFile4b(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.docx')) {
                alert('❌ .docx 파일만 업로드 가능합니다.');
                return;
            }
            document.getElementById('fileName4b').textContent = file.name;
            try {
                const text = await extractTextFromDocx4(file);
                document.getElementById('inputText4b').value = text;
            } catch (error) { 
                alert('오류: ' + error.message); 
            }
        }
        
        // 탭4 - 파일 선택 이벤트
        document.getElementById('fileInput4a').addEventListener('change', async function(e) {
            await handleFile4a(e.target.files[0]);
        });
        document.getElementById('fileInput4b').addEventListener('change', async function(e) {
            await handleFile4b(e.target.files[0]);
        });
        
        // 탭4 - 드래그 앤 드롭 (문서1)
        const inputText4a = document.getElementById('inputText4a');
        inputText4a.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });
        inputText4a.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });
        inputText4a.addEventListener('drop', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                await handleFile4a(e.dataTransfer.files[0]);
            }
        });
        
        // 탭4 - 드래그 앤 드롭 (문서2)
        const inputText4b = document.getElementById('inputText4b');
        inputText4b.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });
        inputText4b.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });
        inputText4b.addEventListener('drop', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                await handleFile4b(e.dataTransfer.files[0]);
            }
        });
        
        // Diff 알고리즘 함수는 utils.js에서 로드됨
        
        function getDiff(a, b) {
            const dp = computeLCS(a, b);
            const result = [];
            let i = a.length, j = b.length;
            
            while (i > 0 || j > 0) {
                if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
                    result.unshift({ type: 'same', lineA: i, lineB: j, textA: a[i-1], textB: b[j-1] });
                    i--; j--;
                } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
                    result.unshift({ type: 'added', lineA: null, lineB: j, textA: null, textB: b[j-1] });
                    j--;
                } else if (i > 0) {
                    result.unshift({ type: 'deleted', lineA: i, lineB: null, textA: a[i-1], textB: null });
                    i--;
                }
            }
            
            // 연속된 삭제/추가 블록을 순서대로 짝지어 modified로 병합 (MS Word 스타일)
            const merged = [];
            let k = 0;

            while (k < result.length) {
                if (result[k].type === 'same') {
                    merged.push(result[k]);
                    k++;
                    continue;
                }

                // same이 나올 때까지의 연속된 변경 블록 수집
                const dels = [], adds = [];
                while (k < result.length && result[k].type !== 'same') {
                    if (result[k].type === 'deleted') dels.push(result[k]);
                    else adds.push(result[k]);
                    k++;
                }

                // 블록 내에서 삭제-추가를 순서대로 짝지어 유사도가 있으면 병합
                const maxLen = Math.max(dels.length, adds.length);
                for (let p = 0; p < maxLen; p++) {
                    const del = p < dels.length ? dels[p] : null;
                    const add = p < adds.length ? adds[p] : null;

                    if (del && add && calculateSimilarity(del.textA, add.textB) >= 0.05) {
                        merged.push({
                            type: 'modified',
                            lineA: del.lineA,
                            lineB: add.lineB,
                            textA: del.textA,
                            textB: add.textB
                        });
                    } else {
                        if (del) merged.push(del);
                        if (add) merged.push(add);
                    }
                }
            }

            return merged;
        }
        
        function compareDocuments() {
            const textA = document.getElementById('inputText4a').value;
            const textB = document.getElementById('inputText4b').value;
            
            if (!textA.trim() || !textB.trim()) {
                alert('두 문서 모두 입력해주세요.');
                return;
            }
            
            // 줄바꿈 통일 후 라인 분리
            const unifiedTextA = textA.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const unifiedTextB = textB.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            // 원본 라인
            const allLinesA = unifiedTextA.split('\n');
            const allLinesB = unifiedTextB.split('\n');
            
            // 빈줄 제외한 라인과 원본 인덱스 추출
            const nonEmptyA = [];
            const nonEmptyB = [];
            
            allLinesA.forEach((line, idx) => {
                const normalized = normalizeLine(line);
                if (normalized) {  // 빈줄이 아닌 경우만
                    nonEmptyA.push({ text: normalized, origIdx: idx, origText: line });
                }
            });
            
            allLinesB.forEach((line, idx) => {
                const normalized = normalizeLine(line);
                if (normalized) {  // 빈줄이 아닌 경우만
                    nonEmptyB.push({ text: normalized, origIdx: idx, origText: line });
                }
            });
            
            // 비교용 텍스트 배열
            const linesA = nonEmptyA.map(item => item.text);
            const linesB = nonEmptyB.map(item => item.text);
            
            const diff = getDiff(linesA, linesB);
            
            // 통계 계산
            let sameCount = 0, modifiedCount = 0, addedCount = 0, deletedCount = 0;
            diff.forEach(d => {
                if (d.type === 'same') sameCount++;
                else if (d.type === 'modified') modifiedCount++;
                else if (d.type === 'added') addedCount++;
                else if (d.type === 'deleted') deletedCount++;
            });
            
            document.getElementById('totalLines4').textContent = Math.max(nonEmptyA.length, nonEmptyB.length);
            document.getElementById('sameLines4').textContent = sameCount;
            document.getElementById('modifiedLines4').textContent = modifiedCount;
            document.getElementById('addedLines4').textContent = addedCount;
            document.getElementById('deletedLines4').textContent = deletedCount;
            
            // 네비게이션 상태 초기화
            diffNavState.modified = 0;
            diffNavState.added = 0;
            diffNavState.deleted = 0;
            ['modifiedNavIndicator4', 'addedNavIndicator4', 'deletedNavIndicator4'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '';
            });

            // 결과 표시 (원본 텍스트 사용)
            let htmlA = '', htmlB = '';
            let navIdx = { modified: 0, added: 0, deleted: 0 };
            diff.forEach(d => {
                const escapeHtml = (t) => t ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';

                // 원본 라인 가져오기 (diff의 lineA/lineB는 1-based index) - 안전한 접근
                const itemA = (d.lineA && d.lineA > 0 && d.lineA <= nonEmptyA.length) ? nonEmptyA[d.lineA - 1] : null;
                const itemB = (d.lineB && d.lineB > 0 && d.lineB <= nonEmptyB.length) ? nonEmptyB[d.lineB - 1] : null;

                // 원본 텍스트 가져오기 - 여러 소스에서 폴백
                let origTextA = '';
                if (itemA && itemA.origText) {
                    origTextA = itemA.origText;
                } else if (d.textA) {
                    origTextA = d.textA;
                }

                let origTextB = '';
                if (itemB && itemB.origText) {
                    origTextB = itemB.origText;
                } else if (d.textB) {
                    origTextB = d.textB;
                }

                const origLineNumA = itemA ? (itemA.origIdx + 1) : (d.lineA || '-');
                const origLineNumB = itemB ? (itemB.origIdx + 1) : (d.lineB || '-');

                if (d.type === 'same') {
                    htmlA += `<div class="compare-line same"><span class="compare-line-num">${origLineNumA}</span>${escapeHtml(origTextA)}</div>`;
                    htmlB += `<div class="compare-line same"><span class="compare-line-num">${origLineNumB}</span>${escapeHtml(origTextB)}</div>`;
                } else if (d.type === 'modified') {
                    const idx = navIdx.modified++;
                    const escapedA = escapeHtml(origTextA);
                    const escapedB = escapeHtml(origTextB);
                    const highlighted = highlightModifiedLine(origTextA, origTextB);
                    const finalHtmlA = (highlighted && highlighted.htmlA) ? highlighted.htmlA : escapedA;
                    const finalHtmlB = (highlighted && highlighted.htmlB) ? highlighted.htmlB : escapedB;
                    htmlA += `<div class="compare-line modified" data-diff-type="modified" data-diff-index="${idx}"><span class="compare-line-num">${origLineNumA}</span>${finalHtmlA}</div>`;
                    htmlB += `<div class="compare-line modified" data-diff-type="modified" data-diff-index="${idx}"><span class="compare-line-num">${origLineNumB}</span>${finalHtmlB}</div>`;
                } else if (d.type === 'added') {
                    const idx = navIdx.added++;
                    htmlA += `<div class="compare-line added-placeholder" data-diff-type="added" data-diff-index="${idx}"><span class="compare-line-num">-</span><span style="color:#155724;font-style:italic;">(추가된 내용)</span></div>`;
                    htmlB += `<div class="compare-line added" data-diff-type="added" data-diff-index="${idx}"><span class="compare-line-num">${origLineNumB}</span>${escapeHtml(origTextB) || '(내용 없음)'}</div>`;
                } else if (d.type === 'deleted') {
                    const idx = navIdx.deleted++;
                    htmlA += `<div class="compare-line deleted" data-diff-type="deleted" data-diff-index="${idx}"><span class="compare-line-num">${origLineNumA}</span>${escapeHtml(origTextA) || '(내용 없음)'}</div>`;
                    htmlB += `<div class="compare-line deleted-placeholder" data-diff-type="deleted" data-diff-index="${idx}"><span class="compare-line-num">-</span><span style="color:#721c24;font-style:italic;">(삭제된 내용)</span></div>`;
                }
            });
            
            document.getElementById('compareResult4a').innerHTML = htmlA;
            document.getElementById('compareResult4b').innerHTML = htmlB;
            document.getElementById('compare4Section').classList.remove('hidden');
            
            // 스크롤 동기화
            const panelA = document.getElementById('compareResult4a');
            const panelB = document.getElementById('compareResult4b');
            panelA.onscroll = function() { panelB.scrollTop = panelA.scrollTop; };
            panelB.onscroll = function() { panelA.scrollTop = panelB.scrollTop; };
        }

        const diffNavState = { modified: 0, added: 0, deleted: 0 };

        function navigateDiff(type) {
            const panelA = document.getElementById('compareResult4a');
            const panelB = document.getElementById('compareResult4b');
            if (!panelA || !panelB) return;

            const elements = panelA.querySelectorAll(`[data-diff-type="${type}"]`);
            if (elements.length === 0) return;

            // 이전 하이라이트 제거
            panelA.querySelectorAll('.diff-nav-active').forEach(el => el.classList.remove('diff-nav-active'));
            panelB.querySelectorAll('.diff-nav-active').forEach(el => el.classList.remove('diff-nav-active'));

            // 순환 인덱스
            const currentIdx = diffNavState[type] % elements.length;
            diffNavState[type] = currentIdx + 1;

            // 두 패널 모두 하이라이트
            const targetA = panelA.querySelector(`[data-diff-type="${type}"][data-diff-index="${currentIdx}"]`);
            const targetB = panelB.querySelector(`[data-diff-type="${type}"][data-diff-index="${currentIdx}"]`);
            if (targetA) targetA.classList.add('diff-nav-active');
            if (targetB) targetB.classList.add('diff-nav-active');

            // 스크롤 이동 (패널 중앙에 오도록)
            // getBoundingClientRect()로 viewport 기준 상대 위치 계산하여 scrollTop에 반영
            const target = targetA || targetB;
            if (target) {
                const containerRect = panelA.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                const scrollTo = panelA.scrollTop + (targetRect.top - containerRect.top) - panelA.clientHeight / 2 + target.clientHeight / 2;
                panelA.scrollTop = Math.max(0, scrollTo);
                panelB.scrollTop = Math.max(0, scrollTo);
            }

            // 인디케이터 업데이트
            const indicatorId = type === 'modified' ? 'modifiedNavIndicator4'
                              : type === 'added'    ? 'addedNavIndicator4'
                              :                       'deletedNavIndicator4';
            const indicator = document.getElementById(indicatorId);
            if (indicator) indicator.textContent = `${currentIdx + 1} / ${elements.length}`;
        }

        function clearAll4() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            document.getElementById('inputText4a').value = '';
            document.getElementById('inputText4b').value = '';
            document.getElementById('fileName4a').textContent = '또는 아래에 .docx 파일을 드래그하세요';
            document.getElementById('fileName4b').textContent = '또는 아래에 .docx 파일을 드래그하세요';
            document.getElementById('compareResult4a').innerHTML = '';
            document.getElementById('compareResult4b').innerHTML = '';
            document.getElementById('compare4Section').classList.add('hidden');
        }
        
        // 서브탭 전환 함수
        function switchSubTab4(tabType, btn) {
            document.querySelectorAll('#tab4 .sub-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#tab4 .sub-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            if (tabType === 'text') {
                document.getElementById('subTab4Text').classList.add('active');
            } else {
                document.getElementById('subTab4Docx').classList.add('active');
            }
        }
        
        // ========== DOCX 비교 기능 ==========
        let docxFileA = null;
        let docxFileB = null;
        let docxDataA = null;
        let docxDataB = null;
        
        // DOCX 파일에서 텍스트 추출 (단락별)
        async function extractParagraphsFromDocx(file) {
            const { zip, xml, doc } = await loadDocxDocument(file);
            const paragraphs = [];
            for (const p of doc.getElementsByTagName('w:p')) {
                paragraphs.push(extractDocxPlainText(p));
            }
            return { paragraphs, zip, xml };
        }
        
        // DOCX 파일 처리 (원본)
        async function handleDocxFile4a(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.docx')) {
                alert('❌ .docx 파일만 업로드 가능합니다.');
                return;
            }
            docxFileA = file;
            document.getElementById('fileNameDocx4a').textContent = file.name;
            try {
                docxDataA = await extractParagraphsFromDocx(file);
                const preview = docxDataA.paragraphs.filter(p => p.trim()).slice(0, 10).join('\n');
                document.getElementById('docxPreview4a').value = preview + (docxDataA.paragraphs.length > 10 ? '\n...' : '');
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }
        
        // DOCX 파일 처리 (수정본)
        async function handleDocxFile4b(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.docx')) {
                alert('❌ .docx 파일만 업로드 가능합니다.');
                return;
            }
            docxFileB = file;
            document.getElementById('fileNameDocx4b').textContent = file.name;
            try {
                docxDataB = await extractParagraphsFromDocx(file);
                const preview = docxDataB.paragraphs.filter(p => p.trim()).slice(0, 10).join('\n');
                document.getElementById('docxPreview4b').value = preview + (docxDataB.paragraphs.length > 10 ? '\n...' : '');
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }
        
        // 파일 선택 이벤트
        document.getElementById('fileInputDocx4a').addEventListener('change', async function(e) {
            await handleDocxFile4a(e.target.files[0]);
        });
        document.getElementById('fileInputDocx4b').addEventListener('change', async function(e) {
            await handleDocxFile4b(e.target.files[0]);
        });
        
        // 드래그 앤 드롭 이벤트 (원본)
        const docxPreview4a = document.getElementById('docxPreview4a');
        docxPreview4a.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });
        docxPreview4a.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });
        docxPreview4a.addEventListener('drop', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                await handleDocxFile4a(e.dataTransfer.files[0]);
            }
        });
        docxPreview4a.addEventListener('click', function() {
            document.getElementById('fileInputDocx4a').click();
        });
        
        // 드래그 앤 드롭 이벤트 (수정본)
        const docxPreview4b = document.getElementById('docxPreview4b');
        docxPreview4b.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });
        docxPreview4b.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });
        docxPreview4b.addEventListener('drop', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                await handleDocxFile4b(e.dataTransfer.files[0]);
            }
        });
        docxPreview4b.addEventListener('click', function() {
            document.getElementById('fileInputDocx4b').click();
        });
        
        // 단락 비교를 위한 개선된 알고리즘
        // calculateSimilarity, getWordDiffForDocx는 utils.js에서 로드됨
        
        // 순서 기반 단락 비교 알고리즘 (MS Word 스타일)
        function getParagraphDiffWithMatching(parasA, parasB) {
            const normA = parasA.map(p => p.trim()).filter(p => p);
            const normB = parasB.map(p => p.trim()).filter(p => p);
            
            const result = [];
            
            // LCS를 사용하여 단락 순서 매칭
            const m = normA.length;
            const n = normB.length;
            
            // DP 테이블 생성 (단락 단위 LCS)
            const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
            
            // 유사도 캐시
            const simCache = {};
            const getSim = (i, j) => {
                const key = `${i}-${j}`;
                if (!(key in simCache)) {
                    simCache[key] = calculateSimilarity(normA[i], normB[j]);
                }
                return simCache[key];
            };
            
            // DP 채우기 - 유사도 15% 이상이면 매칭 가능
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    const sim = getSim(i - 1, j - 1);
                    if (sim >= 0.15 || normA[i-1] === normB[j-1]) {
                        dp[i][j] = dp[i-1][j-1] + 1;
                    } else {
                        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
                    }
                }
            }
            
            // Backtrack하여 매칭 결과 생성
            const matches = [];
            let i = m, j = n;
            while (i > 0 && j > 0) {
                const sim = getSim(i - 1, j - 1);
                if ((sim >= 0.15 || normA[i-1] === normB[j-1]) && dp[i][j] === dp[i-1][j-1] + 1) {
                    matches.unshift({ idxA: i - 1, idxB: j - 1, similarity: sim });
                    i--; j--;
                } else if (dp[i-1][j] >= dp[i][j-1]) {
                    i--;
                } else {
                    j--;
                }
            }
            
            // 매칭 결과를 기반으로 diff 생성
            let ptrA = 0, ptrB = 0;
            const usedA = new Set(matches.map(m => m.idxA));
            const usedB = new Set(matches.map(m => m.idxB));
            
            for (const match of matches) {
                // 매칭되기 전 A의 삭제된 단락들
                while (ptrA < match.idxA) {
                    if (!usedA.has(ptrA)) {
                        // 삭제된 단락과 인접한 추가 단락이 있으면 병합
                        let merged = false;
                        if (ptrB < match.idxB && !usedB.has(ptrB)) {
                            // 유사도 체크 후 병합
                            const mergeSim = calculateSimilarity(normA[ptrA], normB[ptrB]);
                            if (mergeSim >= 0.05) { // 매우 낮은 임계값 - 같은 위치면 병합
                                result.push({
                                    type: 'modified',
                                    textA: normA[ptrA],
                                    textB: normB[ptrB],
                                    wordDiff: getWordDiffForDocx(normA[ptrA], normB[ptrB])
                                });
                                ptrB++;
                                merged = true;
                            }
                        }
                        if (!merged) {
                            result.push({ type: 'deleted', textA: normA[ptrA] });
                        }
                    }
                    ptrA++;
                }
                
                // 매칭되기 전 B의 추가된 단락들
                while (ptrB < match.idxB) {
                    if (!usedB.has(ptrB)) {
                        result.push({ type: 'added', textB: normB[ptrB] });
                    }
                    ptrB++;
                }
                
                // 매칭된 단락 비교
                if (normA[match.idxA] === normB[match.idxB]) {
                    result.push({ type: 'same', textA: normA[match.idxA], textB: normB[match.idxB] });
                } else {
                    result.push({
                        type: 'modified',
                        textA: normA[match.idxA],
                        textB: normB[match.idxB],
                        wordDiff: getWordDiffForDocx(normA[match.idxA], normB[match.idxB])
                    });
                }
                ptrA = match.idxA + 1;
                ptrB = match.idxB + 1;
            }
            
            // 남은 단락들 처리 (삭제와 추가를 짝지어 병합 시도)
            const remainingA = [];
            const remainingB = [];
            
            while (ptrA < m) {
                if (!usedA.has(ptrA)) {
                    remainingA.push(ptrA);
                }
                ptrA++;
            }
            
            while (ptrB < n) {
                if (!usedB.has(ptrB)) {
                    remainingB.push(ptrB);
                }
                ptrB++;
            }
            
            // 남은 단락들을 순서대로 병합 또는 삭제/추가 처리
            const maxRemaining = Math.max(remainingA.length, remainingB.length);
            for (let k = 0; k < maxRemaining; k++) {
                const hasA = k < remainingA.length;
                const hasB = k < remainingB.length;
                
                if (hasA && hasB) {
                    const idxA = remainingA[k];
                    const idxB = remainingB[k];
                    const sim = calculateSimilarity(normA[idxA], normB[idxB]);
                    
                    if (sim >= 0.05) {
                        // 병합
                        result.push({
                            type: 'modified',
                            textA: normA[idxA],
                            textB: normB[idxB],
                            wordDiff: getWordDiffForDocx(normA[idxA], normB[idxB])
                        });
                    } else {
                        // 별도 처리
                        result.push({ type: 'deleted', textA: normA[idxA] });
                        result.push({ type: 'added', textB: normB[idxB] });
                    }
                } else if (hasA) {
                    result.push({ type: 'deleted', textA: normA[remainingA[k]] });
                } else if (hasB) {
                    result.push({ type: 'added', textB: normB[remainingB[k]] });
                }
            }
            
            return result;
        }
        
        // Track Changes가 적용된 DOCX 파일 생성 (단어 단위 비교 적용)
        async function compareDocxFiles() {
            const msg = document.getElementById('docxCompareMessage');
            msg.classList.add('hidden');
            
            if (!docxDataA || !docxDataB) {
                msg.textContent = '❌ 두 개의 DOCX 파일을 모두 업로드해주세요.';
                msg.className = 'message error';
                return;
            }
            
            try {
                const parasA = docxDataA.paragraphs;
                const parasB = docxDataB.paragraphs;
                
                // 개선된 diff 계산 (유사 단락 매칭 + 단어 단위 비교)
                const diff = getParagraphDiffWithMatching(parasA, parasB);
                
                // 통계 계산
                let sameCount = 0, modifiedCount = 0, addedCount = 0, deletedCount = 0;
                diff.forEach(d => {
                    if (d.type === 'same') sameCount++;
                    else if (d.type === 'modified') modifiedCount++;
                    else if (d.type === 'added') addedCount++;
                    else if (d.type === 'deleted') deletedCount++;
                });
                
                document.getElementById('docxTotalPara').textContent = diff.length;
                document.getElementById('docxSamePara').textContent = sameCount;
                document.getElementById('docxModifiedPara').textContent = modifiedCount;
                document.getElementById('docxAddedPara').textContent = addedCount;
                document.getElementById('docxDeletedPara').textContent = deletedCount;
                document.getElementById('docxCompareStats').classList.remove('hidden');
                
                // 현재 날짜/시간
                const now = new Date();
                const dateStr = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                
                // Track Changes XML 생성
                let bodyContent = '';
                let revisionId = 1;
                
                diff.forEach(d => {
                    if (d.type === 'same') {
                        // 동일한 단락
                        bodyContent += `<w:p><w:r><w:t xml:space="preserve">${escapeXml(d.textA)}</w:t></w:r></w:p>`;
                    } else if (d.type === 'deleted') {
                        // 완전히 삭제된 단락
                        bodyContent += `<w:p><w:del w:id="${revisionId}" w:author="user" w:date="${dateStr}"><w:r><w:delText xml:space="preserve">${escapeXml(d.textA)}</w:delText></w:r></w:del></w:p>`;
                        revisionId++;
                    } else if (d.type === 'added') {
                        // 완전히 추가된 단락
                        bodyContent += `<w:p><w:ins w:id="${revisionId}" w:author="user" w:date="${dateStr}"><w:r><w:t xml:space="preserve">${escapeXml(d.textB)}</w:t></w:r></w:ins></w:p>`;
                        revisionId++;
                    } else if (d.type === 'modified') {
                        // 수정된 단락 - 단어 단위로 변경 표시
                        bodyContent += '<w:p>';
                        
                        const wordDiff = d.wordDiff;
                        
                        for (let idx = 0; idx < wordDiff.length; idx++) {
                            const wd = wordDiff[idx];
                            const nextWd = wordDiff[idx + 1];
                            const prevWd = wordDiff[idx - 1];
                            
                            // 단어 + 공백 조합
                            let wordText = wd.word;
                            
                            // 공백 처리:
                            // 1. same/added 타입은 원본 공백 사용
                            // 2. deleted 타입은 다음 단어가 added가 아니면 공백 추가
                            // 3. deleted→added 연속은 공백 없음 (대체)
                            if (wd.type === 'deleted') {
                                // 삭제된 단어 뒤에 추가된 단어가 바로 오면 공백 없음
                                if (!nextWd || nextWd.type !== 'added') {
                                    wordText += ' ';
                                }
                            } else {
                                // same 또는 added는 원본 공백 사용
                                wordText += wd.space || '';
                            }
                            
                            if (wd.type === 'same') {
                                bodyContent += `<w:r><w:t xml:space="preserve">${escapeXml(wordText)}</w:t></w:r>`;
                            } else if (wd.type === 'deleted') {
                                bodyContent += `<w:del w:id="${revisionId}" w:author="user" w:date="${dateStr}"><w:r><w:delText xml:space="preserve">${escapeXml(wordText)}</w:delText></w:r></w:del>`;
                                revisionId++;
                            } else if (wd.type === 'added') {
                                bodyContent += `<w:ins w:id="${revisionId}" w:author="user" w:date="${dateStr}"><w:r><w:t xml:space="preserve">${escapeXml(wordText)}</w:t></w:r></w:ins>`;
                                revisionId++;
                            }
                        }
                        
                        bodyContent += '</w:p>';
                    }
                });
                
                // 새 DOCX 파일 생성
                const newZip = new JSZip();
                
                // [Content_Types].xml
                newZip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
                
                // _rels/.rels
                newZip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
                
                // word/_rels/document.xml.rels
                newZip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

                // word/styles.xml (단락 뒤 간격 0pt 통일, utils.js)
                newZip.file('word/styles.xml', makeDocxStylesXml());
                
                // word/settings.xml (Track Changes 활성화, 서식 비교 제외)
                newZip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:trackRevisions/>
<w:revisionView w:formatting="0"/>
<w:defaultTabStop w:val="720"/>
<w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>`);
                
                // word/document.xml
                const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyContent}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;
                
                newZip.file('word/document.xml', documentXml);
                
                // DOCX 파일 생성 및 다운로드
                const fileName = document.getElementById('outputFileNameDocx4').value.trim() || '비교결과';
                const blob = await newZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                saveAs(blob, fileName + '.docx');
                
                msg.textContent = `✅ 비교 완료! ${fileName}.docx 파일이 다운로드됩니다. MS Word에서 '검토' 탭으로 변경 내용을 확인하세요.`;
                msg.className = 'message success';
                
            } catch (error) {
                msg.textContent = '❌ 오류: ' + error.message;
                msg.className = 'message error';
            }
        }
        
        // escapeXml은 utils.js에서 로드됨
        
        // DOCX 비교 탭 초기화
        function clearDocx4() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            docxFileA = null;
            docxFileB = null;
            docxDataA = null;
            docxDataB = null;
            document.getElementById('docxPreview4a').value = '';
            document.getElementById('docxPreview4b').value = '';
            document.getElementById('fileNameDocx4a').textContent = '원본 .docx 파일을 선택하세요';
            document.getElementById('fileNameDocx4b').textContent = '수정된 .docx 파일을 선택하세요';
            document.getElementById('outputFileNameDocx4').value = '';
            document.getElementById('docxCompareMessage').classList.add('hidden');
            document.getElementById('docxCompareStats').classList.add('hidden');
        }
        
