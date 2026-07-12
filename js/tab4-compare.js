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
            await handleDocxUpload(file, 'fileName4a', async (file) => {
                const text = await extractTextFromDocx4(file);
                document.getElementById('inputText4a').value = text;
            });
        }
        
        // 탭4 - 파일 처리 함수 (문서2)
        async function handleFile4b(file) {
            await handleDocxUpload(file, 'fileName4b', async (file) => {
                const text = await extractTextFromDocx4(file);
                document.getElementById('inputText4b').value = text;
            });
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
        setupDropZone(inputText4a, handleFile4a); // 드래그 앤 드롭 (utils.js)
        
        // 탭4 - 드래그 앤 드롭 (문서2)
        const inputText4b = document.getElementById('inputText4b');
        setupDropZone(inputText4b, handleFile4b); // 드래그 앤 드롭 (utils.js)
        
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

            // DOCX 내보내기용으로 비교 결과 보관
            lastTextDiff4 = { diff, nonEmptyA, nonEmptyB };

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

        // 텍스트 비교 결과 (DOCX 내보내기용)
        let lastTextDiff4 = null;

        // 텍스트 비교 결과를 Track Changes DOCX로 내보내기
        async function exportTextCompareDocx() {
            if (!lastTextDiff4) {
                alert('먼저 문서 비교를 실행해주세요.');
                return;
            }
            const { diff, nonEmptyA, nonEmptyB } = lastTextDiff4;
            const ctx = createRevisionContext();

            // 화면 표시와 동일하게 원본 라인 텍스트 사용
            const origA = (d) => {
                const item = (d.lineA && d.lineA > 0 && d.lineA <= nonEmptyA.length) ? nonEmptyA[d.lineA - 1] : null;
                return (item && item.origText) || d.textA || '';
            };
            const origB = (d) => {
                const item = (d.lineB && d.lineB > 0 && d.lineB <= nonEmptyB.length) ? nonEmptyB[d.lineB - 1] : null;
                return (item && item.origText) || d.textB || '';
            };

            // 페이지 나누기 마커는 실제 페이지 나누기로 변환 (다른 탭의 DOCX 생성과 동일)
            const lineRunsXml = (text, isDel) => {
                if (text.trim() === '<pagebreak/>') return '<w:r><w:br w:type="page"/></w:r>';
                return segsToRunsXml([{ text, rPr: '' }], isDel);
            };

            let bodyContent = '';
            diff.forEach(d => {
                if (d.type === 'same') {
                    bodyContent += '<w:p>' + lineRunsXml(origB(d), false) + '</w:p>';
                } else if (d.type === 'modified') {
                    const ops = diffTokenLists(tokensFromPlainText(origA(d)), tokensFromPlainText(origB(d)));
                    bodyContent += '<w:p>' + emitTrackedOps(ops, ctx) + '</w:p>';
                } else if (d.type === 'added') {
                    // 단락 기호도 삽입으로 표시하여 거부 시 단락 자체가 사라지도록 함
                    bodyContent += `<w:p><w:pPr><w:rPr><w:ins w:id="${ctx.nextId()}" w:author="${ctx.author}" w:date="${ctx.dateStr}"/></w:rPr></w:pPr>`
                        + `<w:ins w:id="${ctx.nextId()}" w:author="${ctx.author}" w:date="${ctx.dateStr}">${lineRunsXml(origB(d), false)}</w:ins></w:p>`;
                } else if (d.type === 'deleted') {
                    // 단락 기호도 삭제로 표시하여 수락 시 단락 자체가 사라지도록 함
                    bodyContent += `<w:p><w:pPr><w:rPr><w:del w:id="${ctx.nextId()}" w:author="${ctx.author}" w:date="${ctx.dateStr}"/></w:rPr></w:pPr>`
                        + `<w:del w:id="${ctx.nextId()}" w:author="${ctx.author}" w:date="${ctx.dateStr}">${lineRunsXml(origA(d), true)}</w:del></w:p>`;
                }
            });

            const fileName = '텍스트비교결과';
            await downloadTrackChangeDocx(bodyContent, fileName);
        }

        // 텍스트 비교 - 양식표준화 (다른 탭과 동일한 공통 규칙을 문서1/문서2에 적용)
        function standardizeFormat4Text() {
            const msg = document.getElementById('formatMessage4');
            msg.classList.add('hidden');

            const elA = document.getElementById('inputText4a');
            const elB = document.getElementById('inputText4b');
            if (!elA.value.trim() && !elB.value.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력해주세요.', 'error');
                return;
            }

            const parts = [];
            let total = 0;
            [['문서1', elA], ['문서2', elB]].forEach(([label, el]) => {
                if (!el.value.trim()) return;
                const result = applyFormatStandardization(el.value); // 공통 로직 (tab2-postprocess.js)
                el.value = result.text;
                parts.push(`${label} ${result.changeCount}개`);
                total += result.changeCount;
            });

            if (total === 0) {
                showMessage(msg, '❌ 적용할 양식 변경이 없습니다.', 'error');
                return;
            }
            showMessage(msg, `✅ 양식표준화 완료! (${parts.join(', ')} 변경 적용)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }

        function clearAll4() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            lastTextDiff4 = null;
            document.getElementById('formatMessage4').classList.add('hidden');
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
        
        // ========== Track Changes 생성 공통 헬퍼 ==========
        const DOCX_W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const XML_SPACE_NS = 'http://www.w3.org/XML/1998/namespace';

        function serializeXmlNode(node) {
            return new XMLSerializer().serializeToString(node);
        }

        // 개정(ins/del) 컨텍스트 - 문서 전체에서 고유한 w:id 발급 + xsd:dateTime 형식 날짜
        function createRevisionContext() {
            const dateStr = new Date().toISOString().split('.')[0] + 'Z';
            return { author: 'user', dateStr, _id: 1, nextId() { return this._id++; } };
        }

        // 블록(단락/표/셀)에서 현재 본문 텍스트 추출 (삭제된 개정 내용과 속성 요소 제외)
        const BLOCK_TEXT_SKIP = new Set(['w:del', 'w:pPr', 'w:rPr', 'w:tblPr', 'w:trPr', 'w:tcPr', 'w:tblGrid', 'w:sectPr', 'w:instrText']);
        function getBlockText(node) {
            let out = '';
            for (const child of node.childNodes) {
                const name = child.nodeName;
                if (BLOCK_TEXT_SKIP.has(name)) continue;
                if (name === 'w:t') out += child.textContent || '';
                else if (name === 'w:tab') out += '\t';
                else if (name === 'w:br' || name === 'w:cr') out += '\n';
                else if (name === 'w:p') out += getBlockText(child) + '\n';
                else if (child.childNodes && child.childNodes.length) out += getBlockText(child);
            }
            return out;
        }

        // 문서 body의 직접 자식 블록(단락/표) 목록 추출 - 빈 단락도 유지
        function getBodyBlocks(doc) {
            const body = doc.getElementsByTagName('w:body')[0];
            const blocks = [];
            if (!body) return blocks;
            for (const child of body.childNodes) {
                if (child.nodeName === 'w:p') blocks.push({ kind: 'p', el: child, text: getBlockText(child) });
                else if (child.nodeName === 'w:tbl') blocks.push({ kind: 'tbl', el: child, text: getBlockText(child) });
                else if (child.nodeType === 1 && child.nodeName !== 'w:sectPr') blocks.push({ kind: 'raw', el: child, text: '' });
            }
            return blocks;
        }

        // 단락(w:p)에서 단어 토큰 추출 - 각 토큰은 run 서식(rPr)을 유지하는 세그먼트로 구성
        // (아래첨자/위첨자 등 서식이 다른 run에 걸친 단어도 하나의 토큰으로 묶어 비교)
        function extractParagraphTokens(p) {
            const tokens = [];
            let open = null;

            const runs = [];
            (function collectRuns(node) {
                for (const child of node.childNodes) {
                    if (child.nodeName === 'w:r') runs.push(child);
                    else if (child.nodeName === 'w:del' || child.nodeName === 'w:pPr') continue; // 이미 삭제된 개정/단락 속성 제외
                    else if (child.childNodes && child.childNodes.length) collectRuns(child);
                }
            })(p);

            const flushOpen = () => { if (open) { tokens.push(open); open = null; } };

            for (const r of runs) {
                let rPr = '';
                for (const c of r.childNodes) {
                    if (c.nodeName === 'w:rPr') { rPr = serializeXmlNode(c); break; }
                }
                for (const child of r.childNodes) {
                    if (child.nodeName === 'w:t') {
                        const text = child.textContent || '';
                        const re = /\s+|\S+/g;
                        let m;
                        while ((m = re.exec(text)) !== null) {
                            const chunk = m[0];
                            if (/\s/.test(chunk[0])) {
                                if (open) { open.space += chunk; flushOpen(); }
                                else if (tokens.length) tokens[tokens.length - 1].space += chunk;
                                // 단락 선두 공백은 무시
                            } else {
                                if (!open) open = { key: '', space: '', segs: [] };
                                open.key += chunk;
                                const last = open.segs[open.segs.length - 1];
                                if (last && !last.special && last.rPr === rPr) last.text += chunk;
                                else open.segs.push({ text: chunk, rPr });
                            }
                        }
                    } else if (child.nodeName === 'w:tab' || child.nodeName === 'w:br') {
                        flushOpen();
                        tokens.push({
                            key: child.nodeName === 'w:tab' ? '\t' : '\n',
                            space: '',
                            segs: [{ special: child.nodeName, rPr }]
                        });
                    }
                }
            }
            flushOpen();
            return tokens;
        }

        // 일반 텍스트 → 토큰 배열 (텍스트 비교 내보내기용, 서식 없음)
        function tokensFromPlainText(text) {
            return tokenizeWords(text || '').map(t => ({ key: t.word, space: t.space, segs: [{ text: t.word, rPr: '' }] }));
        }

        // 토큰 목록 diff (LCS, 공통 접두/접미 최적화 + 크기 안전장치)
        function diffTokenLists(tokensA, tokensB) {
            const lenA = tokensA.length, lenB = tokensB.length;
            const minLen = Math.min(lenA, lenB);
            let pre = 0;
            while (pre < minLen && tokensA[pre].key === tokensB[pre].key) pre++;
            let suf = 0;
            while (suf < minLen - pre && tokensA[lenA - 1 - suf].key === tokensB[lenB - 1 - suf].key) suf++;

            const midA = tokensA.slice(pre, lenA - suf);
            const midB = tokensB.slice(pre, lenB - suf);

            const ops = [];
            for (let k = 0; k < pre; k++) ops.push({ type: 'same', a: tokensA[k], b: tokensB[k] });

            if (midA.length * midB.length > 1000000) {
                // 안전장치 초과 시 전체 삭제 + 전체 추가로 폴백
                midA.forEach(t => ops.push({ type: 'del', a: t }));
                midB.forEach(t => ops.push({ type: 'ins', b: t }));
            } else {
                const dp = computeLCS(midA.map(t => t.key), midB.map(t => t.key));
                const mid = [];
                let i = midA.length, j = midB.length;
                while (i > 0 || j > 0) {
                    if (i > 0 && j > 0 && midA[i - 1].key === midB[j - 1].key) {
                        mid.unshift({ type: 'same', a: midA[i - 1], b: midB[j - 1] });
                        i--; j--;
                    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                        mid.unshift({ type: 'ins', b: midB[j - 1] });
                        j--;
                    } else {
                        mid.unshift({ type: 'del', a: midA[i - 1] });
                        i--;
                    }
                }
                ops.push(...mid);
            }

            for (let k = suf; k > 0; k--) ops.push({ type: 'same', a: tokensA[lenA - k], b: tokensB[lenB - k] });
            return ops;
        }

        // 세그먼트 목록 → run XML (동일 서식의 연속 세그먼트는 하나의 run으로 병합)
        function segsToRunsXml(segs, isDel) {
            let xml = '';
            let buf = null;
            const flush = () => {
                if (buf && buf.text) {
                    const tag = isDel ? 'w:delText' : 'w:t';
                    xml += `<w:r>${buf.rPr}<${tag} xml:space="preserve">${escapeXml(buf.text)}</${tag}></w:r>`;
                }
                buf = null;
            };
            for (const s of segs) {
                if (s.special) {
                    flush();
                    xml += `<w:r>${s.rPr || ''}<${s.special}/></w:r>`;
                } else if (buf && buf.rPr === (s.rPr || '')) {
                    buf.text += s.text;
                } else {
                    flush();
                    buf = { rPr: s.rPr || '', text: s.text };
                }
            }
            flush();
            return xml;
        }

        // 토큰 diff 결과 → Track Changes run XML
        // 연속된 삭제/추가를 하나의 w:del/w:ins로 그룹화하고(MS Word 방식),
        // 공백만 달라진 경우도 삭제/추가로 정확히 표시한다
        function emitTrackedOps(ops, ctx) {
            let xml = '';
            let sameSegs = [], delSegs = [], insSegs = [];
            const lastRPr = (segs) => segs.length ? (segs[segs.length - 1].rPr || '') : '';

            const flushSame = () => {
                if (sameSegs.length) { xml += segsToRunsXml(sameSegs, false); sameSegs = []; }
            };
            const flushChanges = () => {
                if (delSegs.length) {
                    xml += `<w:del w:id="${ctx.nextId()}" w:author="${escapeXml(ctx.author)}" w:date="${ctx.dateStr}">${segsToRunsXml(delSegs, true)}</w:del>`;
                    delSegs = [];
                }
                if (insSegs.length) {
                    xml += `<w:ins w:id="${ctx.nextId()}" w:author="${escapeXml(ctx.author)}" w:date="${ctx.dateStr}">${segsToRunsXml(insSegs, false)}</w:ins>`;
                    insSegs = [];
                }
            };

            for (const op of ops) {
                if (op.type === 'same') {
                    flushChanges();
                    sameSegs.push(...op.b.segs);
                    if (op.a.space === op.b.space) {
                        if (op.b.space) sameSegs.push({ text: op.b.space, rPr: lastRPr(op.b.segs) });
                    } else {
                        // 단어는 같지만 뒤 공백이 달라진 경우: 원본 공백 삭제 + 수정본 공백 추가
                        flushSame();
                        if (op.a.space) delSegs.push({ text: op.a.space, rPr: lastRPr(op.a.segs) });
                        if (op.b.space) insSegs.push({ text: op.b.space, rPr: lastRPr(op.b.segs) });
                    }
                } else if (op.type === 'del') {
                    flushSame();
                    delSegs.push(...op.a.segs);
                    if (op.a.space) delSegs.push({ text: op.a.space, rPr: lastRPr(op.a.segs) });
                } else {
                    flushSame();
                    insSegs.push(...op.b.segs);
                    if (op.b.space) insSegs.push({ text: op.b.space, rPr: lastRPr(op.b.segs) });
                }
            }
            flushSame();
            flushChanges();
            return xml;
        }

        // 텍스트 비교용 최소 구성 Track Changes DOCX 다운로드 (기존 출력 포맷과 동일)
        async function downloadTrackChangeDocx(bodyContent, fileName) {
            const newZip = new JSZip();

            newZip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

            newZip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

            newZip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

            // 단락 뒤 간격 0pt 통일 (utils.js)
            newZip.file('word/styles.xml', makeDocxStylesXml());

            newZip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:trackRevisions/>
<w:revisionView w:formatting="0"/>
<w:defaultTabStop w:val="720"/>
<w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>`);

            newZip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyContent}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`);

            const blob = await newZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            saveAs(blob, fileName + '.docx');
        }

        // ========== DOCX 비교 기능 ==========
        let docxFileA = null;
        let docxFileB = null;
        let docxDataA = null;
        let docxDataB = null;

        // DOCX 파일 로드 (비교용) - 원본 XML/DOM/zip과 블록(단락/표) 목록 유지
        async function loadDocxForCompare(file) {
            const { zip, xml, doc } = await loadDocxDocument(file);
            return { zip, xml, doc, blocks: getBodyBlocks(doc) };
        }

        // DOCX 파일 처리 (원본)
        async function handleDocxFile4a(file) {
            await handleDocxUpload(file, 'fileNameDocx4a', async (file) => {
                docxFileA = file;
                docxDataA = await loadDocxForCompare(file);
                const texts = docxDataA.blocks.map(b => b.text).filter(t => t.trim());
                document.getElementById('docxPreview4a').value = texts.slice(0, 10).join('\n') + (texts.length > 10 ? '\n...' : '');
            });
        }

        // DOCX 파일 처리 (수정본)
        async function handleDocxFile4b(file) {
            await handleDocxUpload(file, 'fileNameDocx4b', async (file) => {
                docxFileB = file;
                docxDataB = await loadDocxForCompare(file);
                const texts = docxDataB.blocks.map(b => b.text).filter(t => t.trim());
                document.getElementById('docxPreview4b').value = texts.slice(0, 10).join('\n') + (texts.length > 10 ? '\n...' : '');
            });
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
        setupDropZone(docxPreview4a, handleDocxFile4a, { clickOpensInput: 'fileInputDocx4a' }); // 드래그 앤 드롭 + 클릭 열기 (utils.js)
        
        // 드래그 앤 드롭 이벤트 (수정본)
        const docxPreview4b = document.getElementById('docxPreview4b');
        setupDropZone(docxPreview4b, handleDocxFile4b, { clickOpensInput: 'fileInputDocx4b' }); // 드래그 앤 드롭 + 클릭 열기 (utils.js)

        // ===== DOCX 양식표준화 (applyFormatStandardization과 동일 규칙의 DOM 버전) =====

        function makeEmptyParagraph(doc) {
            return doc.createElementNS(DOCX_W_NS, 'w:p');
        }

        function makePageBreakParagraph(doc) {
            const p = doc.createElementNS(DOCX_W_NS, 'w:p');
            const r = doc.createElementNS(DOCX_W_NS, 'w:r');
            const br = doc.createElementNS(DOCX_W_NS, 'w:br');
            br.setAttributeNS(DOCX_W_NS, 'w:type', 'page');
            r.appendChild(br);
            p.appendChild(r);
            return p;
        }

        // 단락 끝 공백 제거 (w:t 텍스트를 뒤에서부터 정리)
        function stripParagraphTrailingSpaces(p) {
            const texts = Array.from(p.getElementsByTagName('w:t'));
            let changed = false;
            for (let i = texts.length - 1; i >= 0; i--) {
                const t = texts[i];
                const stripped = (t.textContent || '').replace(/\s+$/, '');
                if (stripped !== t.textContent) { t.textContent = stripped; changed = true; }
                if (stripped !== '') break; // 더 이상 단락 끝 공백이 아님
            }
            return changed;
        }

        // 청구항 번호(X.)와 첫 단어 사이에 탭 삽입
        function insertClaimNumberTab(p, doc) {
            const texts = Array.from(p.getElementsByTagName('w:t'));
            if (!texts.length) return false;
            const t0 = texts[0];
            const m = (t0.textContent || '').match(/^(\s*\d+\.)([\s\S]*)$/);
            if (!m) return false;
            // 이미 번호 바로 뒤에 탭 요소가 있으면 유지
            if (!m[2] && t0.nextSibling && t0.nextSibling.nodeName === 'w:tab') return false;
            const rest = m[2].replace(/^[ \t]*/, '');
            t0.textContent = m[1];
            const tab = doc.createElementNS(DOCX_W_NS, 'w:tab');
            t0.parentNode.insertBefore(tab, t0.nextSibling);
            if (rest) {
                const nt = doc.createElementNS(DOCX_W_NS, 'w:t');
                nt.setAttributeNS(XML_SPACE_NS, 'xml:space', 'preserve');
                nt.textContent = rest;
                t0.parentNode.insertBefore(nt, tab.nextSibling);
            } else if (texts[1]) {
                texts[1].textContent = (texts[1].textContent || '').replace(/^[ \t]*/, '');
            }
            return true;
        }

        // DOCX 문서에 양식표준화 규칙 적용 (텍스트 양식표준화와 동일 규칙/순서)
        function applyFormatStandardizationToDoc(doc) {
            const body = doc.getElementsByTagName('w:body')[0];
            if (!body) return 0;
            let changeCount = 0;

            const blocks = [];
            for (const c of body.childNodes) {
                if (c.nodeName === 'w:p' || c.nodeName === 'w:tbl') blocks.push(c);
            }

            // 1단계: 단락 뒤 불필요한 공백 제거
            for (const node of blocks) {
                if (node.nodeName === 'w:p' && getBlockText(node).trim() && stripParagraphTrailingSpaces(node)) {
                    changeCount++;
                }
            }

            // 2단계: 양식표준화 규칙 적용
            let inClaims = false;
            const isNonEmpty = (node) => node.nodeName === 'w:tbl' || getBlockText(node).trim() !== '';

            for (let i = 0; i < blocks.length; i++) {
                const node = blocks[i];
                if (node.nodeName !== 'w:p') continue;
                const trimmed = getBlockText(node).trim();
                const upper = trimmed.toUpperCase();

                // CROSS-REFERENCE / BACKGROUND 앞에 빈 단락 추가
                if (upper === 'CROSS-REFERENCE TO RELATED APPLICATIONS' || upper === 'CROSS-REFERENCE TO RELATED APPLICATION' ||
                    upper === 'BACKGROUND' || upper === 'BACKGROUND OF THE INVENTION') {
                    if (i > 0 && isNonEmpty(blocks[i - 1])) {
                        body.insertBefore(makeEmptyParagraph(doc), node);
                        changeCount++;
                    }
                    continue;
                }

                // WHAT IS CLAIMED IS: 앞에 페이지 나누기, 다음에 빈 단락 추가
                if (upper === 'WHAT IS CLAIMED IS:' || upper === 'WHAT IS CLAIMED IS') {
                    body.insertBefore(makePageBreakParagraph(doc), node);
                    body.insertBefore(makeEmptyParagraph(doc), node.nextSibling);
                    inClaims = true;
                    changeCount++;
                    continue;
                }

                // ABSTRACT 앞에 페이지 나누기
                if (upper === 'ABSTRACT' || upper === 'ABSTRACT OF DISCLOSURE') {
                    body.insertBefore(makePageBreakParagraph(doc), node);
                    inClaims = false;
                    changeCount++;
                    continue;
                }

                // 청구항 구간: 번호 뒤 탭 삽입 + 마침표로 끝나는 영문 단락 다음 빈 단락 추가
                if (inClaims) {
                    const isKorean = /[가-힣]/.test(trimmed);
                    if (!isKorean && /^\d+\./.test(trimmed) && insertClaimNumberTab(node, doc)) {
                        changeCount++;
                    }
                    if (!isKorean && /\.\s*$/.test(trimmed) && i + 1 < blocks.length && isNonEmpty(blocks[i + 1])) {
                        body.insertBefore(makeEmptyParagraph(doc), node.nextSibling);
                        changeCount++;
                    }
                }
            }
            return changeCount;
        }

        // DOCX 비교 - 양식표준화 (업로드된 원본/수정본에 동일 규칙 적용)
        function standardizeFormat4Docx() {
            const msg = document.getElementById('docxCompareMessage');
            msg.classList.add('hidden');

            if (!docxDataA && !docxDataB) {
                showMessage(msg, '❌ 먼저 DOCX 파일을 업로드해주세요.', 'error');
                return;
            }

            const parts = [];
            let total = 0;
            [['원본', docxDataA, 'docxPreview4a'], ['수정본', docxDataB, 'docxPreview4b']].forEach(([label, data, previewId]) => {
                if (!data) return;
                const count = applyFormatStandardizationToDoc(data.doc);
                data.blocks = getBodyBlocks(data.doc); // 블록 목록 갱신
                const texts = data.blocks.map(b => b.text).filter(t => t.trim());
                document.getElementById(previewId).value = texts.slice(0, 10).join('\n') + (texts.length > 10 ? '\n...' : '');
                parts.push(`${label} ${count}개`);
                total += count;
            });

            if (total === 0) {
                showMessage(msg, '❌ 적용할 양식 변경이 없습니다.', 'error');
                return;
            }
            showMessage(msg, `✅ 양식표준화 완료! (${parts.join(', ')} 변경 적용) 이제 'DOCX 비교 및 다운로드'를 실행하세요.`, 'success');
        }

        // 단락 비교를 위한 개선된 알고리즘
        // calculateSimilarity는 utils.js에서 로드됨

        // 순서 기반 블록(단락/표) 비교 알고리즘 (MS Word 스타일)
        // 빈 단락도 블록으로 유지하여 문서 레이아웃(빈줄) 변경까지 추적한다
        function getBlockDiffWithMatching(blocksA, blocksB) {
            const m = blocksA.length;
            const n = blocksB.length;
            const result = [];

            // 완전 일치: 종류(단락/표)와 텍스트가 정확히 같음 (빈 단락끼리도 일치)
            const eq = (a, b) => a.kind === b.kind && a.text === b.text;

            // 유사도 캐시 (종류가 다르거나 한쪽이 비어 있으면 0)
            const simCache = {};
            const getSim = (i, j) => {
                const a = blocksA[i], b = blocksB[j];
                if (a.kind !== b.kind || a.kind === 'raw' || !a.text.trim() || !b.text.trim()) return 0;
                const key = `${i}-${j}`;
                if (!(key in simCache)) {
                    simCache[key] = calculateSimilarity(a.text, b.text);
                }
                return simCache[key];
            };
            const matchable = (i, j) => eq(blocksA[i], blocksB[j]) || getSim(i, j) >= 0.15;

            // DP 테이블 (블록 단위 LCS) - 유사도 15% 이상이면 매칭 가능
            const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (matchable(i - 1, j - 1)) {
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
                if (matchable(i - 1, j - 1) && dp[i][j] === dp[i-1][j-1] + 1) {
                    matches.unshift({ idxA: i - 1, idxB: j - 1 });
                    i--; j--;
                } else if (dp[i-1][j] >= dp[i][j-1]) {
                    i--;
                } else {
                    j--;
                }
            }

            const pushPair = (a, b) => {
                if (eq(a, b)) result.push({ type: 'same', a, b });
                else result.push({ type: 'modified', a, b });
            };

            // 매칭 결과를 기반으로 diff 생성
            let ptrA = 0, ptrB = 0;
            const usedA = new Set(matches.map(x => x.idxA));
            const usedB = new Set(matches.map(x => x.idxB));

            for (const match of matches) {
                // 매칭되기 전 A의 삭제된 블록들 (인접한 B의 추가 블록과 병합 시도)
                while (ptrA < match.idxA) {
                    if (!usedA.has(ptrA)) {
                        let merged = false;
                        if (ptrB < match.idxB && !usedB.has(ptrB) && getSim(ptrA, ptrB) >= 0.05) {
                            result.push({ type: 'modified', a: blocksA[ptrA], b: blocksB[ptrB] });
                            ptrB++;
                            merged = true;
                        }
                        if (!merged) {
                            result.push({ type: 'deleted', a: blocksA[ptrA] });
                        }
                    }
                    ptrA++;
                }

                // 매칭되기 전 B의 추가된 블록들
                while (ptrB < match.idxB) {
                    if (!usedB.has(ptrB)) {
                        result.push({ type: 'added', b: blocksB[ptrB] });
                    }
                    ptrB++;
                }

                pushPair(blocksA[match.idxA], blocksB[match.idxB]);
                ptrA = match.idxA + 1;
                ptrB = match.idxB + 1;
            }

            // 남은 블록들 처리 (삭제와 추가를 짝지어 병합 시도)
            const remainingA = [];
            const remainingB = [];
            while (ptrA < m) { if (!usedA.has(ptrA)) remainingA.push(ptrA); ptrA++; }
            while (ptrB < n) { if (!usedB.has(ptrB)) remainingB.push(ptrB); ptrB++; }

            const maxRemaining = Math.max(remainingA.length, remainingB.length);
            for (let k = 0; k < maxRemaining; k++) {
                const hasA = k < remainingA.length;
                const hasB = k < remainingB.length;
                if (hasA && hasB && getSim(remainingA[k], remainingB[k]) >= 0.05) {
                    result.push({ type: 'modified', a: blocksA[remainingA[k]], b: blocksB[remainingB[k]] });
                } else {
                    if (hasA) result.push({ type: 'deleted', a: blocksA[remainingA[k]] });
                    if (hasB) result.push({ type: 'added', b: blocksB[remainingB[k]] });
                }
            }

            return result;
        }

        // ===== 블록 → Track Changes XML 변환 =====

        function setRevisionAttrs(el, ctx) {
            el.setAttributeNS(DOCX_W_NS, 'w:id', String(ctx.nextId()));
            el.setAttributeNS(DOCX_W_NS, 'w:author', ctx.author);
            el.setAttributeNS(DOCX_W_NS, 'w:date', ctx.dateStr);
        }

        // run 내 w:t → w:delText 변환 (삭제 표시용)
        function convertRunTextToDelText(r) {
            const doc = r.ownerDocument;
            for (const t of Array.from(r.getElementsByTagName('w:t'))) {
                const delT = doc.createElementNS(DOCX_W_NS, 'w:delText');
                delT.setAttributeNS(XML_SPACE_NS, 'xml:space', 'preserve');
                delT.textContent = t.textContent;
                t.parentNode.replaceChild(delT, t);
            }
        }

        // 컨테이너의 직접 자식 run들을 연속 그룹 단위로 w:ins/w:del로 감싸기
        function wrapRunsInRevision(parent, kind, ctx) {
            const doc = parent.ownerDocument;
            let wrapper = null;
            for (const child of Array.from(parent.childNodes)) {
                if (child.nodeName === 'w:r') {
                    if (kind === 'del') convertRunTextToDelText(child);
                    if (!wrapper) {
                        wrapper = doc.createElementNS(DOCX_W_NS, kind === 'del' ? 'w:del' : 'w:ins');
                        setRevisionAttrs(wrapper, ctx);
                        parent.insertBefore(wrapper, child);
                    }
                    wrapper.appendChild(child);
                } else {
                    wrapper = null;
                }
            }
        }

        // 단락 기호(paragraph mark)에 삽입/삭제 개정 표시
        // (수락/거부 시 단락 자체가 합쳐지거나 사라지도록 - MS Word 비교와 동일)
        function markParagraphMark(p, kind, ctx) {
            const doc = p.ownerDocument;
            let pPr = null;
            for (const c of p.childNodes) if (c.nodeName === 'w:pPr') { pPr = c; break; }
            if (!pPr) {
                pPr = doc.createElementNS(DOCX_W_NS, 'w:pPr');
                p.insertBefore(pPr, p.firstChild);
            }
            let rPr = null;
            for (const c of pPr.childNodes) if (c.nodeName === 'w:rPr') { rPr = c; break; }
            if (!rPr) {
                rPr = doc.createElementNS(DOCX_W_NS, 'w:rPr');
                let sectPr = null;
                for (const c of pPr.childNodes) if (c.nodeName === 'w:sectPr') { sectPr = c; break; }
                pPr.insertBefore(rPr, sectPr);
            }
            const rev = doc.createElementNS(DOCX_W_NS, kind === 'del' ? 'w:del' : 'w:ins');
            setRevisionAttrs(rev, ctx);
            rPr.insertBefore(rev, rPr.firstChild);
        }

        // 단락 전체를 삽입/삭제로 표시 (원본 서식 유지)
        function buildRevisedParagraph(pEl, kind, ctx) {
            const p = pEl.cloneNode(true);
            wrapRunsInRevision(p, kind, ctx);
            markParagraphMark(p, kind, ctx);
            return serializeXmlNode(p);
        }

        // 표 전체를 삽입/삭제로 표시 (행 단위 개정 표시 + 셀 내용 개정 표시)
        function buildRevisedTable(tblEl, kind, ctx) {
            const doc = tblEl.ownerDocument;
            const tbl = tblEl.cloneNode(true);
            for (const tr of Array.from(tbl.getElementsByTagName('w:tr'))) {
                let trPr = null;
                for (const c of tr.childNodes) if (c.nodeName === 'w:trPr') { trPr = c; break; }
                if (!trPr) {
                    trPr = doc.createElementNS(DOCX_W_NS, 'w:trPr');
                    tr.insertBefore(trPr, tr.firstChild);
                }
                const rev = doc.createElementNS(DOCX_W_NS, kind === 'del' ? 'w:del' : 'w:ins');
                setRevisionAttrs(rev, ctx);
                trPr.appendChild(rev);
            }
            for (const p of Array.from(tbl.getElementsByTagName('w:p'))) {
                wrapRunsInRevision(p, kind, ctx);
            }
            return serializeXmlNode(tbl);
        }

        // 수정된 단락: 수정본(B)의 단락 속성을 유지하며 단어 단위 개정 표시
        function buildModifiedParagraph(pA, pB, ctx) {
            const ops = diffTokenLists(extractParagraphTokens(pA), extractParagraphTokens(pB));
            let pPrXml = '';
            for (const c of pB.childNodes) if (c.nodeName === 'w:pPr') { pPrXml = serializeXmlNode(c); break; }
            return '<w:p>' + pPrXml + emitTrackedOps(ops, ctx) + '</w:p>';
        }

        function directChildren(el, name) {
            const out = [];
            for (const c of el.childNodes) if (c.nodeName === name) out.push(c);
            return out;
        }

        // 수정된 표: 행/열 구조가 같으면 셀 단위로 비교, 다르면 표 전체 삭제+추가
        function buildModifiedTable(tblA, tblB, ctx) {
            const rowsA = directChildren(tblA, 'w:tr');
            const rowsB = directChildren(tblB, 'w:tr');
            const sameShape = rowsA.length === rowsB.length &&
                rowsA.every((tr, idx) => directChildren(tr, 'w:tc').length === directChildren(rowsB[idx], 'w:tc').length);
            if (!sameShape) {
                return buildRevisedTable(tblA, 'del', ctx) + buildRevisedTable(tblB, 'ins', ctx);
            }
            let xml = '<w:tbl>';
            for (const c of tblB.childNodes) {
                if (c.nodeName === 'w:tblPr' || c.nodeName === 'w:tblGrid') xml += serializeXmlNode(c);
            }
            for (let idx = 0; idx < rowsB.length; idx++) {
                xml += '<w:tr>';
                for (const c of rowsB[idx].childNodes) {
                    if (c.nodeName === 'w:trPr') xml += serializeXmlNode(c);
                }
                const cellsA = directChildren(rowsA[idx], 'w:tc');
                const cellsB = directChildren(rowsB[idx], 'w:tc');
                for (let cIdx = 0; cIdx < cellsB.length; cIdx++) {
                    xml += buildModifiedCell(cellsA[cIdx], cellsB[cIdx], ctx);
                }
                xml += '</w:tr>';
            }
            xml += '</w:tbl>';
            return xml;
        }

        function buildModifiedCell(tcA, tcB, ctx) {
            if (getBlockText(tcA) === getBlockText(tcB)) return serializeXmlNode(tcB);
            let xml = '<w:tc>';
            for (const c of tcB.childNodes) if (c.nodeName === 'w:tcPr') xml += serializeXmlNode(c);
            const pAs = directChildren(tcA, 'w:p');
            const pBs = directChildren(tcB, 'w:p');
            const maxLen = Math.max(pAs.length, pBs.length);
            for (let k = 0; k < maxLen; k++) {
                const pA = pAs[k], pB = pBs[k];
                if (pA && pB) {
                    xml += getBlockText(pA) === getBlockText(pB)
                        ? serializeXmlNode(pB)
                        : buildModifiedParagraph(pA, pB, ctx);
                } else if (pA) {
                    xml += buildRevisedParagraph(pA, 'del', ctx);
                } else {
                    xml += buildRevisedParagraph(pB, 'ins', ctx);
                }
            }
            xml += '</w:tc>';
            return xml;
        }
        
        // 비교 통계 계산 + 화면 표시 (일반/US양식 공용)
        function updateDocxCompareStats(diff) {
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
        }

        // 블록 diff → Track Changes body XML (일반/US양식 공용)
        function buildTrackedBodyXml(diff, ctx) {
            let bodyContent = '';
            diff.forEach(d => {
                if (d.type === 'same') {
                    // 동일한 블록: 수정본 원본 그대로 (서식 완전 보존)
                    bodyContent += serializeXmlNode(d.b.el);
                } else if (d.type === 'deleted') {
                    if (d.a.kind === 'raw') return; // 북마크 등 비본문 요소는 생략
                    bodyContent += d.a.kind === 'tbl'
                        ? buildRevisedTable(d.a.el, 'del', ctx)
                        : buildRevisedParagraph(d.a.el, 'del', ctx);
                } else if (d.type === 'added') {
                    if (d.b.kind === 'raw') { bodyContent += serializeXmlNode(d.b.el); return; }
                    bodyContent += d.b.kind === 'tbl'
                        ? buildRevisedTable(d.b.el, 'ins', ctx)
                        : buildRevisedParagraph(d.b.el, 'ins', ctx);
                } else if (d.type === 'modified') {
                    bodyContent += d.a.kind === 'tbl'
                        ? buildModifiedTable(d.a.el, d.b.el, ctx)
                        : buildModifiedParagraph(d.a.el, d.b.el, ctx);
                }
            });
            return bodyContent;
        }

        // ===== US양식 비교 전용 헬퍼 =====

        // zip 전체 복사 (US양식 부품 덧입히기가 업로드된 수정본 zip을 오염시키지 않도록)
        async function copyDocxZip(zip) {
            const out = new JSZip();
            for (const name of Object.keys(zip.files)) {
                const f = zip.files[name];
                if (f.dir) { out.folder(name); continue; }
                out.file(name, await f.async('uint8array'));
            }
            return out;
        }

        // 업로드 상태(DOM/zip)를 건드리지 않는 US양식 작업용 복제본 생성
        async function cloneDocxDataForUS(data) {
            const doc = data.doc.cloneNode(true);
            return { zip: await copyDocxZip(data.zip), xml: data.xml, doc, blocks: getBodyBlocks(doc) };
        }

        // body 직접 자식 단락의 선두 텍스트 단락번호 [NNNN] 제거
        // (US양식은 SEQ 필드 번호로 대체 — 양쪽 문서에 공통 적용되는 전처리라 변경추적에 잡히지 않음)
        function stripDocParagraphNumbers(doc) {
            const body = doc.getElementsByTagName('w:body')[0];
            if (!body) return 0;
            let count = 0;
            for (const child of body.childNodes) {
                if (child.nodeName !== 'w:p') continue;
                const t0 = child.getElementsByTagName('w:t')[0];
                if (!t0) continue;
                const m = (t0.textContent || '').match(/^\[\d{4,5}\]\s?/);
                if (m) { t0.textContent = t0.textContent.slice(m[0].length); count++; }
            }
            return count;
        }

        // 블록 텍스트 (삭제된 개정 내용 포함 — 전부 삭제된 단락의 원문 판별용)
        function getBlockTextIncludingDeleted(node) {
            let out = '';
            for (const child of node.childNodes) {
                const name = child.nodeName;
                if (name === 'w:pPr' || name === 'w:rPr' || name === 'w:instrText' || name === 'w:delInstrText') continue;
                if (name === 'w:t' || name === 'w:delText') out += child.textContent || '';
                else if (name === 'w:tab') out += '\t';
                else if (name === 'w:br' || name === 'w:cr') out += '\n';
                else if (child.childNodes && child.childNodes.length) out += getBlockTextIncludingDeleted(child);
            }
            return out;
        }

        // 단락 기호(pPr>rPr)의 개정 표시 조회 → 'ins' | 'del' | null
        // (buildRevisedParagraph가 추가/삭제 단락에 표시한 마크 — 단락 전체의 개정 상태 판별)
        function getParagraphMarkRevision(p) {
            for (const pPr of p.childNodes) {
                if (pPr.nodeName !== 'w:pPr') continue;
                for (const rPr of pPr.childNodes) {
                    if (rPr.nodeName !== 'w:rPr') continue;
                    for (const c of rPr.childNodes) {
                        if (c.nodeName === 'w:del') return 'del';
                        if (c.nodeName === 'w:ins') return 'ins';
                    }
                }
            }
            return null;
        }

        // 표 내부 단락 여부 (US양식 고정 행 높이는 표 밖 단락에만 적용)
        function usIsInsideTable(node) {
            for (let a = node.parentNode; a; a = a.parentNode) {
                if (a.nodeName === 'w:tbl') return true;
                if (a.nodeName === 'w:body') return false;
            }
            return false;
        }

        // XML 조각을 단락의 pPr 바로 뒤(본문 런 앞)에 삽입
        function insertXmlAfterPPr(p, xml) {
            const doc = p.ownerDocument;
            const frag = new DOMParser().parseFromString(
                `<w:x xmlns:w="${DOCX_W_NS}">${xml}</w:x>`, 'application/xml').documentElement;
            let ref = null;
            for (const c of p.childNodes) {
                if (c.nodeName !== 'w:pPr') { ref = c; break; }
            }
            for (const c of Array.from(frag.childNodes)) {
                p.insertBefore(doc.importNode(c, true), ref);
            }
        }

        // 단락 pPr에 US양식 고정 행 높이(548 exact) 적용 (기존 spacing 교체)
        function usSetParagraphSpacing(p) {
            const doc = p.ownerDocument;
            let pPr = null;
            for (const c of p.childNodes) if (c.nodeName === 'w:pPr') { pPr = c; break; }
            if (!pPr) {
                pPr = doc.createElementNS(DOCX_W_NS, 'w:pPr');
                p.insertBefore(pPr, p.firstChild);
            }
            for (const c of Array.from(pPr.childNodes)) {
                if (c.nodeName === 'w:spacing') pPr.removeChild(c);
            }
            const spacing = doc.createElementNS(DOCX_W_NS, 'w:spacing');
            spacing.setAttributeNS(DOCX_W_NS, 'w:after', '0');
            spacing.setAttributeNS(DOCX_W_NS, 'w:line', String(US_DOCX_LINE));
            spacing.setAttributeNS(DOCX_W_NS, 'w:lineRule', 'exact');
            // 스키마 순서 근사: ind/jc/rPr/sectPr 앞에 삽입
            let ref = null;
            for (const c of pPr.childNodes) {
                const n = c.nodeName;
                if (n === 'w:ind' || n === 'w:jc' || n === 'w:rPr' || n === 'w:sectPr') { ref = c; break; }
            }
            pPr.insertBefore(spacing, ref);
        }

        // 런 rPr에 Arial 12pt 검정 적용 — 첨자(vertAlign)·볼드 등 기존 속성은 유지
        function usSetRunFonts(r) {
            const doc = r.ownerDocument;
            let rPr = null;
            for (const c of r.childNodes) if (c.nodeName === 'w:rPr') { rPr = c; break; }
            if (!rPr) {
                rPr = doc.createElementNS(DOCX_W_NS, 'w:rPr');
                r.insertBefore(rPr, r.firstChild);
            }
            for (const c of Array.from(rPr.childNodes)) {
                const n = c.nodeName;
                if (n === 'w:rFonts' || n === 'w:color' || n === 'w:sz' || n === 'w:szCs') rPr.removeChild(c);
            }
            const mk = (name, attrs) => {
                const el = doc.createElementNS(DOCX_W_NS, name);
                for (const k in attrs) el.setAttributeNS(DOCX_W_NS, k, attrs[k]);
                return el;
            };
            // rFonts는 앞쪽(rStyle 뒤), color/sz/szCs는 u/vertAlign 앞에
            let front = rPr.firstChild;
            while (front && front.nodeName === 'w:rStyle') front = front.nextSibling;
            rPr.insertBefore(mk('w:rFonts', { 'w:ascii': 'Arial', 'w:hAnsi': 'Arial', 'w:cs': 'Arial' }), front);
            let tail = null;
            for (const c of rPr.childNodes) {
                if (c.nodeName === 'w:u' || c.nodeName === 'w:vertAlign') { tail = c; break; }
            }
            rPr.insertBefore(mk('w:color', { 'w:val': '000000' }), tail);
            rPr.insertBefore(mk('w:sz', { 'w:val': '24' }), tail);
            rPr.insertBefore(mk('w:szCs', { 'w:val': '24' }), tail);
        }

        // 본문 단락에 SEQ 필드 단락번호 삽입 (탭2/3 US양식의 번호 부여 규칙과 동일)
        // 삽입/삭제 개정 단락의 번호도 w:ins/w:del로 감싸 수락·거부와 함께 움직인다
        function usAddSeqParagraphNumbers(body, ctx) {
            const blocks = [];
            for (const c of body.childNodes) {
                if (c.nodeName === 'w:p' || c.nodeName === 'w:tbl') blocks.push(c);
            }
            const textOf = (blk) => {
                if (blk.nodeName !== 'w:p') return getBlockText(blk);
                // 전부 삭제된 단락은 최종 텍스트가 비므로 삭제 포함 원문으로 판별
                return getParagraphMarkRevision(blk) === 'del'
                    ? getBlockTextIncludingDeleted(blk) : getBlockText(blk);
            };

            let crossRefIdx = -1;
            blocks.forEach((blk, i) => {
                if (crossRefIdx < 0 && blk.nodeName === 'w:p' && isCrossRefLine(textOf(blk))) crossRefIdx = i;
            });

            let inClaims = false, inAbstract = false, seq = 1;
            blocks.forEach((blk, i) => {
                if (blk.nodeName !== 'w:p') return; // 표에는 번호 없음
                const trimmed = textOf(blk).trim();
                if (!trimmed) return;
                if (isClaimsStartLine(trimmed)) { inClaims = true; return; }
                const upper = trimmed.toUpperCase();
                if (upper === 'ABSTRACT' || upper === 'ABSTRACT OF DISCLOSURE') {
                    inClaims = false; inAbstract = true; return;
                }
                if (inClaims || inAbstract) return;
                if (crossRefIdx >= 0 && i < crossRefIdx) return;
                if (isGenericSubtitle(trimmed, { checkSymbols: true, checkNumberedHeading: true })) return;
                if (!/[.。]["']?$/.test(trimmed)) return;

                const rev = getParagraphMarkRevision(blk);
                const cached = String(seq++).padStart(4, '0');
                let xml = makeUSSeqFieldRunsXml(cached, rev === 'del');
                if (rev === 'del') {
                    xml = `<w:del w:id="${ctx.nextId()}" w:author="${escapeXml(ctx.author)}" w:date="${ctx.dateStr}">${xml}</w:del>`;
                } else if (rev === 'ins') {
                    xml = `<w:ins w:id="${ctx.nextId()}" w:author="${escapeXml(ctx.author)}" w:date="${ctx.dateStr}">${xml}</w:ins>`;
                }
                insertXmlAfterPPr(blk, xml);
            });
        }

        // 변경추적 body XML에 US양식(고정 행 높이·Arial·SEQ 단락번호) 덧입히기
        function applyUSFormatToTrackedBodyXml(bodyXml, ctx) {
            const dom = new DOMParser().parseFromString(
                `<w:body xmlns:w="${DOCX_W_NS}">${bodyXml}</w:body>`, 'application/xml');
            if (dom.getElementsByTagName('parsererror').length) {
                throw new Error('US양식 변환 중 XML 파싱에 실패했습니다.');
            }
            const body = dom.documentElement;

            for (const p of Array.from(body.getElementsByTagName('w:p'))) {
                if (!usIsInsideTable(p)) usSetParagraphSpacing(p);
            }
            for (const r of Array.from(body.getElementsByTagName('w:r'))) {
                usSetRunFonts(r);
            }
            usAddSeqParagraphNumbers(body, ctx); // SEQ 런은 자체 Arial rPr 포함 — 글꼴 적용 뒤 삽입

            let out = '';
            for (const c of body.childNodes) out += serializeXmlNode(c);
            return out;
        }

        // US양식 헤더/푸터 관계 ID (수정본 기존 관계와 충돌하지 않는 전용 ID)
        const US_COMPARE_REL_IDS = {
            headerEven: 'rIdUSHdr', headerDefault: 'rIdUSHdr', headerFirst: 'rIdUSHdr',
            footerEven: 'rIdUSFtrPage', footerDefault: 'rIdUSFtrPage', footerFirst: 'rIdUSFtrFirst'
        };

        // 수정본(B) zip에 US양식 부품 덧입히기
        // (styles/settings 교체 + 헤더/푸터 추가 — 이미지 등 기존 부품·관계는 유지)
        async function overlayUSPackageParts(zip) {
            const CT_PREFIX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';
            const REL_PREFIX = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

            zip.file('word/styles.xml', makeUSDocxStylesXml());
            zip.file('word/settings.xml', makeUSDocxSettingsXml({ trackRevisions: true }));
            zip.file('word/usHeader1.xml', makeUSDocxHeaderXml());
            zip.file('word/usFooter1.xml', makeUSDocxFooterPageXml());
            zip.file('word/usFooter2.xml', makeUSDocxFooterFirstXml());

            // [Content_Types].xml에 새 부품 Override 등록 (기존 항목 유지)
            let ct = await zip.file('[Content_Types].xml').async('string');
            const ensureOverride = (part, type) => {
                if (ct.indexOf(`PartName="${part}"`) < 0) {
                    ct = ct.replace('</Types>', `<Override PartName="${part}" ContentType="${CT_PREFIX}${type}+xml"/></Types>`);
                }
            };
            ensureOverride('/word/styles.xml', 'styles');
            ensureOverride('/word/settings.xml', 'settings');
            ensureOverride('/word/usHeader1.xml', 'header');
            ensureOverride('/word/usFooter1.xml', 'footer');
            ensureOverride('/word/usFooter2.xml', 'footer');
            zip.file('[Content_Types].xml', ct);

            // document.xml.rels에 헤더/푸터(+누락 시 styles/settings) 관계 추가
            let rels = await zip.file('word/_rels/document.xml.rels').async('string');
            const ensureRel = (id, type, target, skipIfTypeExists) => {
                if (skipIfTypeExists && rels.indexOf(`Type="${REL_PREFIX}${type}"`) >= 0) return;
                if (rels.indexOf(`Id="${id}"`) < 0) {
                    rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL_PREFIX}${type}" Target="${target}"/></Relationships>`);
                }
            };
            ensureRel('rIdUSStyles', 'styles', 'styles.xml', true);
            ensureRel('rIdUSSettings', 'settings', 'settings.xml', true);
            ensureRel('rIdUSHdr', 'header', 'usHeader1.xml');
            ensureRel('rIdUSFtrPage', 'footer', 'usFooter1.xml');
            ensureRel('rIdUSFtrFirst', 'footer', 'usFooter2.xml');
            zip.file('word/_rels/document.xml.rels', rels);
        }

        // Track Changes가 적용된 DOCX 파일 생성
        // 수정본(B)의 패키지(스타일/글꼴/머리글/섹션 설정)를 기반으로 결과를 생성하여
        // 첨자·표·빈줄·단락 나누기 등 원본 서식을 유지한다 (MS Word 검토>비교와 동일한 방식)
        async function compareDocxFiles() { await compareDocxFilesCore(false); }

        // US양식 비교: 변경추적을 유지한 채 US 특허출원 양식(탭2 'US양식 다운로드'와 동일 규격) 적용
        async function compareDocxFilesUS() { await compareDocxFilesCore(true); }

        async function compareDocxFilesCore(usFormat) {
            const msg = document.getElementById('docxCompareMessage');
            msg.classList.add('hidden');

            if (!docxDataA || !docxDataB) {
                showMessage(msg, '❌ 두 개의 DOCX 파일을 모두 업로드해주세요.', 'error');
                return;
            }

            try {
                let dataA = docxDataA, dataB = docxDataB;
                if (usFormat) {
                    // 업로드 상태를 오염시키지 않도록 복제본에 전처리 적용
                    // (양쪽 문서에 동일 적용 → 전처리 자체는 변경추적에 잡히지 않음)
                    dataA = await cloneDocxDataForUS(docxDataA);
                    dataB = await cloneDocxDataForUS(docxDataB);
                    for (const d of [dataA, dataB]) {
                        applyFormatStandardizationToDoc(d.doc); // 양식표준화 자동 적용 (탭2 US 다운로드와 동일)
                        stripDocParagraphNumbers(d.doc);        // 텍스트 단락번호 제거 → SEQ 필드로 대체
                        d.blocks = getBodyBlocks(d.doc);
                    }
                }

                // 블록(단락/표) 단위 diff 계산 (유사 블록 매칭 + 단어 단위 비교)
                const diff = getBlockDiffWithMatching(dataA.blocks, dataB.blocks);
                updateDocxCompareStats(diff);

                const ctx = createRevisionContext();
                let bodyContent = buildTrackedBodyXml(diff, ctx);

                // 수정본(B) 문서를 기반으로 결과 생성 - body만 교체하고 나머지 부품은 그대로 유지
                const srcXml = dataB.xml;
                const bodyOpen = srcXml.match(/<w:body[^>]*>/);
                if (!bodyOpen) throw new Error('수정본 문서에서 본문(w:body)을 찾을 수 없습니다.');
                let head = srcXml.slice(0, bodyOpen.index + bodyOpen[0].length);

                let tailSect = '';
                if (usFormat) {
                    // US양식 덧입히기 (변경추적 유지) + US sectPr/패키지 부품
                    bodyContent = applyUSFormatToTrackedBodyXml(bodyContent, ctx);
                    await overlayUSPackageParts(dataB.zip);
                    tailSect = makeUSDocxSectPrXml(US_COMPARE_REL_IDS);
                    // sectPr의 r:id 참조를 위해 r 네임스페이스 선언 보장
                    if (head.indexOf('xmlns:r=') < 0) {
                        head = head.replace('<w:document', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
                    }
                } else {
                    // 수정본 body의 섹션 설정(용지/여백) 유지
                    const bodyB = dataB.doc.getElementsByTagName('w:body')[0];
                    for (const c of bodyB.childNodes) {
                        if (c.nodeName === 'w:sectPr') tailSect = serializeXmlNode(c);
                    }
                }

                dataB.zip.file('word/document.xml', head + bodyContent + tailSect + '</w:body></w:document>');

                // DOCX 파일 생성 및 다운로드
                const fileName = document.getElementById('outputFileNameDocx4').value.trim() || (usFormat ? '비교결과_US' : '비교결과');
                const blob = await dataB.zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                saveAs(blob, fileName + '.docx');

                showMessage(msg, usFormat
                    ? `✅ 비교 완료! US 특허출원 양식(변경추적 유지)으로 ${fileName}.docx가 다운로드됩니다. MS Word '검토' 탭에서 변경 내용을 확인하고, 단락번호는 필드 갱신(Ctrl+A → F9) 시 재계산됩니다.`
                    : `✅ 비교 완료! ${fileName}.docx 파일이 다운로드됩니다. MS Word에서 '검토' 탭으로 변경 내용을 확인하세요.`, 'success');

            } catch (error) {
                showMessage(msg, '❌ 오류: ' + error.message, 'error');
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
        
