/**
 * Document Tools - js/tab1-preprocess.js
 * 탭1: 전처리 단계 (DOCX → HTML)
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // 탭1 - .fin 파싱 결과(IR) 보관용 (docx 산출물 버튼에서 사용)
        let finParsedIR1 = null;
        // 탭1 - 2단계에서 삽입된 Cross-reference 보관용 (ROPKS DOCX 생성 시 포함)
        let finCrossRef1 = null;

        // 탭1 - .fin ROPKS 산출물 섹션(2단계) 표시/숨김
        function setFinRopksSectionVisible(visible) {
            document.getElementById('finRopksSection').classList.toggle('hidden', !visible);
        }

        // 탭1 - 파일 처리 공통 함수 (.docx / .fin 확장자 분기)
        async function handleFile1(file) {
            if (!file) return;
            if ((file.name || '').toLowerCase().endsWith('.fin')) {
                await handleFinFile(file);
                return;
            }
            // 기존 .docx 경로
            finParsedIR1 = null;
            finCrossRef1 = null;
            document.getElementById('finOutputSection').classList.add('hidden');
            setFinRopksSectionVisible(false);
            await handleDocxUpload(file, 'fileName1', async (file) => {
                const result = await processDocx1(file);
                document.getElementById('textInput1').value = result.text;
                // 의심 문자 검사 (.docx: 행 번호 + 앞뒤 발췌로 위치 표기)
                fileAnalysisResult.suspicious = { mode: 'line', items: findSuspiciousInText(result.text) };
                displayResult1(result);
            });
        }

        // 탭1 - .fin 파일 처리: 파싱 → KIPO 라인텍스트(HTML 변환) + 산출물 버튼 활성화
        async function handleFinFile(file) {
            document.getElementById('fileName1').textContent = file.name;
            finCrossRef1 = null;
            const msg = document.getElementById('finOutputMessage');
            if (msg) msg.classList.add('hidden');
            const ropksMsg = document.getElementById('finRopksMessage');
            if (ropksMsg) ropksMsg.classList.add('hidden');
            try {
                const ir = await parseFinFile(file);
                finParsedIR1 = ir;

                // 1단계 창: .fin 원본 부제(국문 【】) 그대로 표시.
                // 단, .fin의 [NNNN] 단락번호는 기본 제거 — ROPKS 변환 산출물에는 번호가 없고,
                // 필요 시 4단계 '단락번호 추가'로 새로 부여한다. (KIPO 출원서식 DOCX는 IR 기반이라 번호 유지)
                const kipoText = finBuildKipoLineText(ir, false);
                // 변환결과(6단계): 해외출원용 국문(ROPKS) 기준
                const ropksText = finBuildRopksLineText(ir);
                document.getElementById('textInput1').value = kipoText;
                // 분석 결과(5단계)는 변환결과(6단계) 텍스트 기준으로 집계
                const subscriptCount = (ropksText.match(/<sub>/gi) || []).length;
                const superscriptCount = (ropksText.match(/<sup>/gi) || []).length;
                // 의심 문자 검사 (.fin: 정규화 전 원문 단락 기준, 단락번호로 위치 표기)
                fileAnalysisResult.suspicious = { mode: 'para', items: findSuspiciousInParas(ir.rawParas) };
                displayResult1({ text: kipoText, outputText: ropksText, subscriptCount, superscriptCount });

                // .fin 산출물 섹션 표시 (KIPO: 1단계, ROPKS: 2단계 Cross-reference 삽입 단계)
                document.getElementById('finOutputSection').classList.remove('hidden');
                setFinRopksSectionVisible(true);
                const drawn = ir.drawings.filter(d => d.base64).length;
                document.getElementById('finDrawingsInfo').textContent =
                    `분석 완료 — 도면 ${ir.drawings.length}개(이미지 ${drawn}개 임베드) · 청구항 ${ir.claims.length}개 · 표 ${ir.embodiments.filter(e => e.kind === 'table').length}개`;
            } catch (e) {
                finParsedIR1 = null;
                document.getElementById('finOutputSection').classList.add('hidden');
                setFinRopksSectionVisible(false);
                alert('오류: ' + e.message);
            }
        }

        // .fin → KIPO 출원서식 DOCX
        async function downloadFinKipoDocx() { await downloadFinDocx('kipo'); }
        // .fin → 해외출원용 국문(ROPKS) DOCX
        async function downloadFinRopksDocx() { await downloadFinDocx('ropks'); }

        // 오늘 날짜 6자리(YYMMDD)
        function finTodayYYMMDD() {
            const d = new Date();
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return yy + mm + dd;
        }

        async function downloadFinDocx(format) {
            // 메시지는 각 버튼이 있는 위치에 표시 (KIPO: 1단계, ROPKS: 2단계)
            const msg = document.getElementById(format === 'ropks' ? 'finRopksMessage' : 'finOutputMessage');
            if (!finParsedIR1) { showMessage(msg, '❌ 먼저 .fin 파일을 업로드해주세요.', 'error'); return; }
            const label = format === 'ropks' ? '해외출원용 국문(ROPKS)' : 'KIPO 출원서식';
            try {
                // ROPKS: 2단계에서 삽입된 Cross-reference가 있으면 DOCX에도 포함
                const opts = format === 'ropks' && finCrossRef1 ? { crossRef: finCrossRef1 } : undefined;
                const blob = await buildFinDocxBlob(finParsedIR1, format, opts);
                let fileName;
                if (format === 'ropks') {
                    const mgmtNo = (document.getElementById('finMgmtNo1') || {}).value || '';
                    fileName = finRopksBaseName(mgmtNo, finTodayYYMMDD());
                } else {
                    const base = ((finParsedIR1.meta && finParsedIR1.meta.fileName) || 'document').replace(/\.fin$/i, '');
                    fileName = base + '_출원명세서';
                }
                saveAs(blob, fileName + '.docx');
                const included = opts ? ' Cross-reference가 포함되었습니다.' : '';
                showMessage(msg, `✅ ${label} DOCX가 생성되었습니다! (${fileName}.docx)${included}`, 'success');
                setTimeout(() => msg.classList.add('hidden'), 4000);
            } catch (e) {
                showMessage(msg, `❌ ${label} DOCX 생성 실패: ` + e.message, 'error');
            }
        }
        
        // 파일 선택 버튼
        document.getElementById('fileInput1').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            await handleFile1(file);
        });
        
        // 드래그 앤 드롭 (textarea)
        const textInput1 = document.getElementById('textInput1');
        
        setupDropZone(textInput1, handleFile1, { clickOpensInput: 'fileInput1' }); // 드래그 앤 드롭 + 클릭 열기 (utils.js)
        
        async function processDocx1(file) {
            // loadDocxDocument, parseDocxNumbering, extractDocxParagraphText, convertDocxTableToHtml은 utils.js에서 로드됨
            const { zip, doc } = await loadDocxDocument(file);
            const numberingDefs = await parseDocxNumbering(zip);

            const countScripts = { sub: 0, sup: 0 };
            const results = [];
            
            // body 내의 요소들을 순서대로 처리
            const body = doc.getElementsByTagName('w:body')[0];
            if (body) {
                for (const child of body.children) {
                    const tagName = child.tagName;
                    
                    if (tagName === 'w:p') {
                        // 일반 단락 처리
                        let text = '';
                        
                        // 단락 번호 처리
                        const pPr = child.getElementsByTagName('w:pPr')[0];
                        const numPr = pPr?.getElementsByTagName('w:numPr')[0];
                        if (numPr) {
                            const numId = numPr.getElementsByTagName('w:numId')[0]?.getAttribute('w:val');
                            const ilvl = numPr.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val') || '0';
                            if (numId && numberingDefs[numId] && numberingDefs[numId][ilvl]) {
                                const lvlDef = numberingDefs[numId][ilvl];
                                const formattedNum = lvlDef.counter.toString().padStart(4, '0');
                                text = '[' + formattedNum + '] ';
                                lvlDef.counter++;
                            }
                        }
                        
                        text += extractDocxParagraphText(child, countScripts);
                        if (text.trim()) results.push(text);

                    } else if (tagName === 'w:tbl') {
                        // 표 처리
                        const tableHtml = convertDocxTableToHtml(child, countScripts);
                        results.push(tableHtml);
                    }
                }
            }
            
            return { 
                text: results.join('\n'), 
                subscriptCount: countScripts.sub, 
                superscriptCount: countScripts.sup 
            };
        }
        
        let originalText1 = ''; // 원본 텍스트 저장용
        
        // 파일 분석 결과 표시 함수
        function updateFileAnalysisDisplay() {
            const analysisSection = document.getElementById('fileAnalysis1');
            analysisSection.classList.remove('hidden');
            
            // Cross-reference
            const crossRefEl = document.getElementById('analysisCrossRef');
            if (fileAnalysisResult.hasCrossRef) {
                crossRefEl.innerHTML = '<span class="analysis-icon">✅</span> Cross-reference';
                crossRefEl.className = 'analysis-item exists';
            } else {
                crossRefEl.innerHTML = '<span class="analysis-icon">❌</span> Cross-reference';
                crossRefEl.className = 'analysis-item not-exists';
            }
            
            // 첨자
            const scriptEl = document.getElementById('analysisScript');
            if (fileAnalysisResult.hasScript) {
                scriptEl.innerHTML = '<span class="analysis-icon">✅</span> 첨자';
                scriptEl.className = 'analysis-item exists';
            } else {
                scriptEl.innerHTML = '<span class="analysis-icon">❌</span> 첨자';
                scriptEl.className = 'analysis-item not-exists';
            }
            
            // 단락번호
            const paragraphNumEl = document.getElementById('analysisParagraphNum');
            if (fileAnalysisResult.hasParagraphNum) {
                paragraphNumEl.innerHTML = '<span class="analysis-icon">✅</span> 단락번호';
                paragraphNumEl.className = 'analysis-item exists';
            } else {
                paragraphNumEl.innerHTML = '<span class="analysis-icon">❌</span> 단락번호';
                paragraphNumEl.className = 'analysis-item not-exists';
            }
            
            // 표
            const tableEl = document.getElementById('analysisTable');
            if (fileAnalysisResult.hasTable) {
                tableEl.innerHTML = '<span class="analysis-icon">✅</span> 표';
                tableEl.className = 'analysis-item exists';
            } else {
                tableEl.innerHTML = '<span class="analysis-icon">❌</span> 표';
                tableEl.className = 'analysis-item not-exists';
            }

            // 특수문자(의심 문자) 경고
            updateSuspiciousDisplay1();
        }

        // 의심 문자 검사 결과 표시 (배지 + 상세 패널).
        // .fin은 단락번호(loc), .docx는 행 번호 + 앞뒤 발췌로 위치를 표기한다.
        function updateSuspiciousDisplay1() {
            const badgeEl = document.getElementById('analysisSuspicious');
            const detailEl = document.getElementById('suspiciousDetail1');
            const s = fileAnalysisResult.suspicious;
            const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            if (!s) { // 검사 이력 없음 (직접 입력 등) — 배지/패널 숨김
                badgeEl.className = 'analysis-item hidden';
                detailEl.className = 'suspicious-detail hidden';
                detailEl.innerHTML = '';
                return;
            }

            // 인라인 이미지(docx에 원본 임베드됨)는 경고가 아닌 정보성 안내로 분리
            const warnItems = s.items.filter(it => it.label !== FIN_INLINE_IMG_LABEL);
            const imgItem = s.items.find(it => it.label === FIN_INLINE_IMG_LABEL) || null;
            const warnTotal = warnItems.reduce((a, it) => a + it.count, 0);

            if (!warnTotal && !imgItem) {
                badgeEl.innerHTML = '<span class="analysis-icon">✅</span> 특수문자 없음';
                badgeEl.className = 'analysis-item exists';
                detailEl.className = 'suspicious-detail hidden';
                detailEl.innerHTML = '';
                return;
            }

            const MAX_SHOWN = 5; // 패턴당 표시 상한
            const occListHtml = (it) => {
                let ul = '<ul>';
                for (const o of it.occurrences.slice(0, MAX_SHOWN)) {
                    const where = s.mode === 'para' ? (o.loc || '(위치 미상)') : `${o.line}행`;
                    ul += `<li><span class="suspicious-loc">${esc(where)}</span>`
                        + `…${esc(o.before)}<span class="warn-mark">${esc(o.match)}</span>${esc(o.after)}…</li>`;
                }
                if (it.occurrences.length > MAX_SHOWN) ul += `<li>외 ${it.occurrences.length - MAX_SHOWN}건</li>`;
                return ul + '</ul>';
            };

            let html = '';
            if (warnTotal) {
                badgeEl.innerHTML = `<span class="analysis-icon">⚠️</span> 특수문자 ${warnTotal}건`;
                badgeEl.className = 'analysis-item warn';
                html += '<div class="suspicious-title">⚠️ 특허명세서에서 잘 사용되지 않는 문자가 발견되었습니다. 아래 위치를 확인해주세요.</div>';
                // .fin에서 손상 잔재("**"/"?" 등)가 발견되면 특수문자 소실 가능성 안내.
                // 유니코드 첨자(정상 변환됨)만 있는 경우는 제외.
                if (s.mode === 'para' && warnItems.some(it => it.label !== '유니코드 첨자')) {
                    html += '<div class="suspicious-notice">🔍 이 .fin은 전자출원 문서 작성 단계에서 특수문자(문자표 미지원 첨자 등)가'
                        + ' 소실·대체되었을 가능성이 있습니다. 사무소 원본과의 대조(문서비교 탭)를 권장합니다.</div>';
                }
                for (const it of warnItems) {
                    html += `<div class="suspicious-group"><strong>${esc(it.label)}</strong> ${it.count}건${occListHtml(it)}</div>`;
                }
            } else {
                // 인라인 이미지만 있는 경우 — 정보성 배지 (경고 아님)
                badgeEl.innerHTML = `<span class="analysis-icon">ℹ️</span> 인라인 이미지 ${imgItem.count}건`;
                badgeEl.className = 'analysis-item info';
            }
            if (imgItem) {
                html += `<div class="suspicious-info">ℹ️ <strong>본문 인라인 이미지</strong> ${imgItem.count}건 —`
                    + ' docx 변환 시 해당 위치에 원본 이미지가 그대로 삽입됩니다.'
                    + ` 텍스트가 아니므로 번역·복사 작업 시 참고하세요.${occListHtml(imgItem)}</div>`;
            }
            detailEl.innerHTML = html;
            detailEl.className = warnTotal ? 'suspicious-detail' : 'suspicious-detail info';
        }
        
        function displayResult1(r) {
            resetStatNavState('tab1');
            // 출력 박스/미리보기(변환결과)는 outputText가 있으면 그것을, 없으면 r.text를 사용한다.
            // (fin 업로드 시: 1단계 창/분석 = r.text(국문 원본), 변환결과 = outputText(ROPKS))
            const outText = (r.outputText != null) ? r.outputText : r.text;
            document.getElementById('subCount1').textContent = r.subscriptCount;
            document.getElementById('supCount1').textContent = r.superscriptCount;
            // 분석 결과(단락/청구항/표 개수)는 변환결과 텍스트(outText) 기준 — 6단계 표시 내용과 일치
            document.getElementById('paragraphCount1').textContent = countParagraphsInText(outText);

            originalText1 = r.text; // 원본 저장
            rawOutput1 = outText;

            // 파일 분석 결과 계산 (업로드 원본 기준)
            fileAnalysisResult.hasCrossRef = /CROSS-REFERENCE/i.test(r.text);
            fileAnalysisResult.hasScript = (r.subscriptCount + r.superscriptCount) > 0;
            fileAnalysisResult.hasParagraphNum = /^\[0\d{3,4}\]\s/m.test(r.text);
            fileAnalysisResult.hasTable = /<table[^>]*>/i.test(r.text);
            
            // 파일 분석 결과 표시
            updateFileAnalysisDisplay();
            
            // 청구항 개수 계산 - 【청구항 XX】 패턴에서 가장 큰 숫자 찾기 (변환결과 기준)
            let claimCount = 0;
            const claimMatches = outText.match(/【청구항\s*(\d+)】/g);
            if (claimMatches) {
                claimMatches.forEach(match => {
                    const num = parseInt(match.match(/\d+/)[0]);
                    if (num > claimCount) claimCount = num;
                });
            }
            document.getElementById('claimCount1').textContent = claimCount;

            // 표 개수 계산 (변환결과 기준)
            const tableMatches = outText.match(/<table[^>]*>/gi);
            const tableCount = tableMatches ? tableMatches.length : 0;
            document.getElementById('tableCount1').textContent = tableCount;
            
            // 출력 박스 - 표 태그 하이라이트 처리
            let outputHtml = rawOutput1
                .replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>')
                .replace(/&lt;table[^&]*&gt;/g,'<span class="table-tag">&lt;table&gt;</span>')
                .replace(/&lt;\/table&gt;/g,'<span class="table-tag">&lt;/table&gt;</span>')
                .replace(/&lt;tr&gt;/g,'<span class="table-tag">&lt;tr&gt;</span>')
                .replace(/&lt;\/tr&gt;/g,'<span class="table-tag">&lt;/tr&gt;</span>')
                .replace(/&lt;td([^&]*)&gt;/g,'<span class="table-tag">&lt;td$1&gt;</span>')
                .replace(/&lt;\/td&gt;/g,'<span class="table-tag">&lt;/td&gt;</span>')
                .replace(/&lt;br&gt;/g,'<span class="table-tag">&lt;br&gt;</span>')
                .replace(/__([^_]+)__/g,'<span class="warn-mark">$1</span>')
                .replace(/\[(\d{4,5})\]/g,'<span class="para-num-mark">[$1]</span>');
            document.getElementById('output1').innerHTML = outputHtml;
            
            // 미리보기 - 표는 실제 HTML로 렌더링
            let previewHtml = rawOutput1;
            // 표가 아닌 줄바꿈만 <br>로 변환
            let inTable = false;
            const lines = previewHtml.split('\n');
            let previewLines = [];
            for (let line of lines) {
                if (line.trim().startsWith('<table')) inTable = true;
                if (inTable) {
                    previewLines.push(line);
                } else {
                    previewLines.push(line + '<br>');
                }
                if (line.trim().endsWith('</table>')) inTable = false;
            }
            previewHtml = previewLines.join('').replace(/__([^_]+)__/g,'<strong>$1</strong>');
            document.getElementById('preview1').innerHTML = previewHtml;
            
            document.getElementById('result1Section').classList.remove('hidden');
            document.getElementById('output1Section').classList.remove('hidden');
        }
        
        function insertCrossReference() {
            const msg = document.getElementById('crossRefMessage');
            msg.classList.add('hidden');
            
            const textInput1 = document.getElementById('textInput1');
            const currentText = textInput1.value;
            
            // 텍스트 입력 확인
            if (!currentText.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력하거나 워드 파일을 업로드해주세요.', 'error');
                return;
            }
            
            // 이미 Cross-reference가 존재하는지 확인
            if (/CROSS-REFERENCE/i.test(currentText)) {
                showMessage(msg, '⚠️ 이미 Cross-reference가 존재합니다.', 'error');
                return;
            }
            
            // 우선권출원 정보 확인
            if (priorityList1.length === 0) {
                showMessage(msg, '❌ 우선권출원 정보를 추가해주세요.', 'error');
                return;
            }

            // Cross-reference 텍스트 생성
            let priorityText1;
            if (priorityList1.length === 1) {
                const p = priorityList1[0];
                priorityText1 = `본 출원은 ${p.year}년 ${p.month}월 ${p.day}일 출원된 대한민국 특허출원 제${p.appNum}호에 기초한 것으로서, 그 전체 내용이 참조로 여기에 포함된다.`;
            } else {
                const parts = priorityList1.map(p => `${p.year}년 ${p.month}월 ${p.day}일 출원된 대한민국 특허출원 제${p.appNum}호`);
                priorityText1 = `본 출원은 ${parts.join(' 및 ')}에 기초한 것으로서, 그 전체 내용이 참조로 여기에 포함된다.`;
            }
            const crossRef = `CROSS-REFERENCE TO RELATED APPLICATIONS\n${priorityText1}`;

            // 삽입 위치: BACKGROUND(영문) 앞. 국문 KIPO 텍스트는 【기술분야】 앞
            // (US 서식에서 Field는 BACKGROUND 하위 절이므로 【기술분야】 앞이 같은 위치),
            // 【기술분야】가 없으면 【발명의 배경이 되는 기술】/【배경기술】 앞.
            const findInsertIndex = (lines) => {
                const patterns = [
                    (t) => t.toUpperCase().startsWith('BACKGROUND'),
                    (t) => /^【기술\s*분야】$/.test(t),
                    (t) => /^【(발명의 배경이 되는 기술|배경\s*기술)】$/.test(t)
                ];
                for (const match of patterns) {
                    const idx = lines.findIndex(l => match(l.trim()));
                    if (idx >= 0) return idx;
                }
                return -1;
            };
            const insertInto = (text) => {
                const lines = text.split('\n');
                const idx = findInsertIndex(lines);
                if (idx < 0) return null;
                lines.splice(idx, 0, crossRef); // 삽입 (빈줄 없이)
                return lines.join('\n');
            };

            const newInput = insertInto(currentText);
            if (newInput == null) {
                showMessage(msg, '❌ BACKGROUND(또는 【기술분야】) 단락을 찾을 수 없습니다.', 'error');
                return;
            }

            if (finParsedIR1 && rawOutput1) {
                // fin 흐름: 변환결과(ROPKS)에도 같은 위치 규칙으로 삽입 후 재렌더링
                const newOutput = insertInto(rawOutput1);
                if (newOutput == null) {
                    showMessage(msg, '❌ 변환결과에서 BACKGROUND 단락을 찾을 수 없습니다.', 'error');
                    return;
                }
                // ROPKS DOCX 생성 시 같은 내용이 포함되도록 보관
                finCrossRef1 = { title: 'CROSS-REFERENCE TO RELATED APPLICATIONS', text: priorityText1 };
                document.getElementById('textInput1').value = newInput;
                displayResult1({
                    text: newInput,
                    outputText: newOutput,
                    subscriptCount: (newOutput.match(/<sub>/gi) || []).length,
                    superscriptCount: (newOutput.match(/<sup>/gi) || []).length
                });
            } else {
                rawOutput1 = newInput;
                document.getElementById('textInput1').value = rawOutput1;

                // 분석 결과 업데이트
                fileAnalysisResult.hasCrossRef = true;
                updateFileAnalysisDisplay();

                // 화면 업데이트
                document.getElementById('output1').innerHTML = rawOutput1.replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                    .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                    .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                    .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>')
                    .replace(/__([^_]+)__/g,'<span class="warn-mark">$1</span>');
                document.getElementById('preview1').innerHTML = rawOutput1.replace(/\n/g,'<br>').replace(/__([^_]+)__/g,'<strong>$1</strong>');
            }

            const finNote = finCrossRef1 ? ' 이제 ROPKS DOCX에 Cross-reference가 포함되어 출력됩니다.' : '';
            showMessage(msg, `✅ Cross-reference가 삽입되었습니다!${finNote}`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }

        // 부제표준화 함수
        function standardizeSubtitles() {
            const msg = document.getElementById('subtitleMessage');
            msg.classList.add('hidden');
            
            const textInput1El = document.getElementById('textInput1');
            const currentText = textInput1El.value;
            
            if (!currentText.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력하거나 워드 파일을 업로드해주세요.', 'error');
                return;
            }
            
            // 선택된 표준 확인
            const selectedStandard = document.querySelector('input[name="subtitleStandard"]:checked').value;
            
            let result = currentText;
            let convertedCount = 0;
            
            // 변환 규칙 정의
            const officeUSRules = [
                // 국문부제 -> 영문부제 (사무소 표준 US)
                { from: '【발명의 설명】', to: '', delete: true },
                { from: '【발명의 명칭】', to: 'TITLE OF THE INVENTION' },
                { from: '【기술분야】', to: 'BACKGROUND OF THE INVENTION\n(a) Field of the Invention' },
                { from: '【발명의 배경이 되는 기술】', to: '(b) Description of the Related Art' },
                { from: '【배경기술】', to: '(b) Description of the Related Art' },
                { from: '【발명의 내용】', to: 'SUMMARY OF THE INVENTION' },
                { from: '【해결하고자 하는 과제】', to: '', delete: true },
                { from: '【해결하려는 과제】', to: '', delete: true },
                { from: '【기술적 과제】', to: '', delete: true },
                { from: '【과제의 해결 수단】', to: '', delete: true },
                { from: '【기술적 해결방법】', to: '', delete: true },
                { from: '【발명의 효과】', to: '', delete: true },
                { from: '【도면의 간단한 설명】', to: 'BRIEF DESCRIPTION OF THE DRAWINGS' },
                { from: '【발명을 실시하기 위한 구체적인 내용】', to: 'DETAILED DESCRIPTION OF THE EMBODIMENTS' },
                { from: '【발명의 실시를 위한 형태】', to: 'DETAILED DESCRIPTION OF THE EMBODIMENTS' },
                { from: '【부호의 설명】', to: 'Description of Symbols' },
                { from: '【청구범위】', to: 'WHAT IS CLAIMED IS:' },
                { from: '【청구의 범위】', to: 'WHAT IS CLAIMED IS:' },
                { from: '【요약서】', to: 'ABSTRACT OF DISCLOSURE' },
                { from: '【요약】', to: '', delete: true },
                { from: '【대표도】', to: 'Representative Drawing:' }
            ];
            
            const sdcUSRules = [
                // 국문부제 -> SDC표준 US
                { from: '【발명의 설명】', to: '', delete: true },
                { from: '【발명의 명칭】', to: '', delete: true },
                { from: '【기술분야】', to: 'BACKGROUND\n1. Field' },
                { from: '【발명의 배경이 되는 기술】', to: '2. Description of the Related Art' },
                { from: '【배경기술】', to: '2. Description of the Related Art' },
                { from: '【발명의 내용】', to: 'SUMMARY' },
                { from: '【해결하고자 하는 과제】', to: '', delete: true },
                { from: '【해결하려는 과제】', to: '', delete: true },
                { from: '【기술적 과제】', to: '', delete: true },
                { from: '【과제의 해결 수단】', to: '', delete: true },
                { from: '【기술적 해결방법】', to: '', delete: true },
                { from: '【발명의 효과】', to: '', delete: true },
                { from: '【도면의 간단한 설명】', to: 'BRIEF DESCRIPTION OF THE DRAWINGS' },
                { from: '【발명을 실시하기 위한 구체적인 내용】', to: 'DETAILED DESCRIPTION' },
                { from: '【발명의 실시를 위한 형태】', to: 'DETAILED DESCRIPTION' },
                { from: '【부호의 설명】', to: 'Description of Symbols' },
                { from: '【청구범위】', to: 'WHAT IS CLAIMED IS:' },
                { from: '【청구의 범위】', to: 'WHAT IS CLAIMED IS:' },
                { from: '【요약서】', to: 'ABSTRACT' },
                { from: '【요약】', to: '', delete: true },
                { from: '【대표도】', to: 'Representative Drawing:' },
                // 사무소표준 -> SDC표준 변환
                { from: 'TITLE OF THE INVENTION', to: '', delete: true },
                { from: 'BACKGROUND OF THE INVENTION', to: 'BACKGROUND' },
                { from: '(a) Field of the Invention', to: '1. Field' },
                { from: '(b) Description of the Related Art', to: '2. Description of the Related Art' },
                { from: 'SUMMARY OF THE INVENTION', to: 'SUMMARY' },
                { from: 'DETAILED DESCRIPTION OF THE EMBODIMENTS', to: 'DETAILED DESCRIPTION' },
                { from: 'DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENTS', to: 'DETAILED DESCRIPTION' },
                { from: 'ABSTRACT OF DISCLOSURE', to: 'ABSTRACT' }
            ];
            
            const pctRules = [
                // 국문부제 -> PCT출원용
                { from: '【발명의 설명】', to: '【DESCRIPTION】' },
                { from: '【발명의 명칭】', to: '【Invention Title】' },
                { from: '【기술분야】', to: '【Technical Field】' },
                { from: '【배경기술】', to: '【Background Art】' },
                { from: '【발명의 배경이 되는 기술】', to: '【Background Art】' },
                { from: '【발명의 내용】', to: '【Disclosure】' },
                { from: '【기술적 과제】', to: '【Technical Problem】' },
                { from: '【해결하고자 하는 과제】', to: '【Technical Problem】' },
                { from: '【해결하려는 과제】', to: '【Technical Problem】' },
                { from: '【기술적 해결방법】', to: '【Technical Solution】' },
                { from: '【과제의 해결 수단】', to: '【Technical Solution】' },
                { from: '【발명의 효과】', to: '【Advantageous Effects】' },
                { from: '【도면의 간단한 설명】', to: '【Description of Drawings】' },
                { from: '【발명의 실시를 위한 최선의 형태】', to: '【Best Mode】' },
                { from: '【발명의 실시를 위한 형태】', to: '【Mode for Invention】' },
                { from: '【발명을 실시하기 위한 구체적인 내용】', to: '【Mode for Invention】' },
                { from: '【산업상 이용가능성】', to: '【Industrial Applicability】' },
                { from: '【서열목록】', to: '【Sequence List Text】' },
                { from: '【부호의 설명】', to: '【Description of Symbols】' },
                { from: '【청구의 범위】', to: '【CLAIMS】' },
                { from: '【청구범위】', to: '【CLAIMS】' },
                { from: '【요약서】', to: '【ABSTRACT】' },
                { from: '【요약】', to: '【ABSTRACT】' },
                { from: '【도면】', to: '【DRAWINGS】' },
                { from: '【대표도】', to: '【Representative Drawing】' },
                // 영문부제(사무소표준US) -> PCT출원용
                { from: 'TITLE OF THE INVENTION', to: '【Invention Title】' },
                { from: 'BACKGROUND OF THE INVENTION', to: '', delete: true },
                { from: '(a) Field of the Invention', to: '【Technical Field】' },
                { from: '(b) Description of the Related Art', to: '【Background Art】' },
                { from: 'SUMMARY OF THE INVENTION', to: '【Disclosure】\n【Technical Problem】\n【Technical Solution】**적소이동필요**\n【Advantageous Effects】**적소이동필요**' },
                { from: 'BRIEF DESCRIPTION OF THE DRAWINGS', to: '【Description of Drawings】' },
                { from: 'DETAILED DESCRIPTION OF THE EMBODIMENTS', to: '【Mode for Invention】' },
                { from: 'DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENTS', to: '【Mode for Invention】' },
                { from: 'WHAT IS CLAIMED IS:', to: '【CLAIMS】' },
                { from: 'ABSTRACT OF DISCLOSURE', to: '【ABSTRACT】' },
                { from: 'Description of Symbols', to: '【Description of Symbols】' },
                // SDC표준US -> PCT출원용
                { from: 'BACKGROUND', to: '', delete: true },
                { from: '1. Field', to: '【Technical Field】' },
                { from: '2. Description of the Related Art', to: '【Background Art】' },
                { from: 'SUMMARY', to: '【Disclosure】\n【Technical Problem】\n【Technical Solution】**적소이동필요**\n【Advantageous Effects】**적소이동필요**' },
                { from: 'DETAILED DESCRIPTION', to: '【Mode for Invention】' },
                { from: 'ABSTRACT', to: '【ABSTRACT】' }
            ];
            
            // 선택된 표준에 따라 규칙 선택
            let rules = [];
            let standardName = '';
            
            if (selectedStandard === 'office') {
                rules = officeUSRules;
                standardName = '사무소표준US';
            } else if (selectedStandard === 'sdc') {
                rules = sdcUSRules;
                standardName = 'SDC표준US';
            } else if (selectedStandard === 'pct') {
                rules = pctRules;
                standardName = 'PCT출원용';
            }
            
            // 라인 단위로 변환 적용
            const lines = result.split('\n');
            const resultLines = [];
            let figureCount = 0; // 도면 개수 추적
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let trimmedLine = line.trim();
                let matched = false;
                
                for (const rule of rules) {
                    if (trimmedLine === rule.from) {
                        matched = true;
                        convertedCount++;
                        if (rule.delete) {
                            // 삭제 (라인 건너뜀)
                        } else {
                            // 변환 적용 (여러 줄일 수 있음)
                            const newLines = rule.to.split('\n');
                            newLines.forEach(nl => resultLines.push(nl));
                        }
                        break;
                    }
                }
                
                // PCT 출원용 특수 패턴 처리
                if (!matched && selectedStandard === 'pct') {
                    // 【청구항 X】 -> 【Claim X】 패턴 처리
                    const claimMatch = trimmedLine.match(/^【청구항\s*(\d+)】$/);
                    if (claimMatch) {
                        resultLines.push(`【Claim ${claimMatch[1]}】`);
                        matched = true;
                        convertedCount++;
                    }
                    
                    // 【도 X】 -> 【Figure X】 패턴 처리
                    const figMatch = trimmedLine.match(/^【도\s*(\d+)】$/);
                    if (figMatch) {
                        resultLines.push(`【Figure ${figMatch[1]}】`);
                        matched = true;
                        convertedCount++;
                        figureCount = Math.max(figureCount, parseInt(figMatch[1]));
                    }
                    
                    // 청구항 번호 패턴: "X." 또는 "X. " (줄의 시작) -> 【Claim X】
                    const claimNumMatch = trimmedLine.match(/^(\d+)\.\s+(.*)$/);
                    if (claimNumMatch) {
                        resultLines.push(`【Claim ${claimNumMatch[1]}】`);
                        resultLines.push(claimNumMatch[2]); // 청구항 내용
                        matched = true;
                        convertedCount++;
                    }
                    
                    // FIG. X 또는 Fig. X 패턴 카운트 (도면 개수 파악용)
                    const figRefMatch = trimmedLine.match(/(?:FIG\.|Fig\.)\s*(\d+)/gi);
                    if (figRefMatch) {
                        figRefMatch.forEach(m => {
                            const num = parseInt(m.match(/\d+/)[0]);
                            figureCount = Math.max(figureCount, num);
                        });
                    }
                }
                
                if (!matched) {
                    resultLines.push(line);
                }
            }
            
            // PCT 출원용: 문서 맨 앞에 【DESCRIPTION】 추가 (없는 경우)
            if (selectedStandard === 'pct') {
                const hasDescription = resultLines.some(line => 
                    line.trim() === '【DESCRIPTION】' || line.trim() === '【발명의 설명】'
                );
                if (!hasDescription) {
                    resultLines.unshift('【DESCRIPTION】');
                    convertedCount++;
                }
                
                // 문서 마지막에 【DRAWINGS】와 【Figure X】 추가 (도면 참조가 있는 경우)
                if (figureCount > 0) {
                    const hasDrawings = resultLines.some(line => 
                        line.trim() === '【DRAWINGS】' || line.trim() === '【도면】'
                    );
                    if (!hasDrawings) {
                        resultLines.push('【DRAWINGS】');
                        for (let f = 1; f <= figureCount; f++) {
                            resultLines.push(`【Figure ${f}】`);
                        }
                        convertedCount++;
                    }
                }
            }
            
            result = resultLines.join('\n');
            
            if (convertedCount === 0) {
                showMessage(msg, '⚠️ 변환할 부제를 찾지 못했습니다. 문서에 국문 또는 영문 부제가 있는지 확인해주세요.', 'error');
                return;
            }
            
            // 결과 적용
            rawOutput1 = result;
            textInput1El.value = result;
            
            // 화면 업데이트
            document.getElementById('output1').innerHTML = result.replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>');
            document.getElementById('preview1').innerHTML = result.replace(/\n/g,'<br>');
            
            showMessage(msg, `✅ 부제표준화 완료! (${standardName} 형식, ${convertedCount}개 부제 변환됨)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 5000);
        }
        
        // 모달 관련 함수
        function showCrossRefWarningModal() {
            document.getElementById('crossRefWarningModal').classList.add('active');
        }
        
        function closeModal() {
            document.getElementById('crossRefWarningModal').classList.remove('active');
        }
        
        function goToCrossRefInsert() {
            closeModal();
            // 2단계(Cross-reference 삽입) 영역으로 스크롤
            const prioritySection = document.getElementById('priorityList1');
            if (prioritySection) {
                prioritySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        function proceedWithoutCrossRef() {
            closeModal();
            // Cross-reference 없이 단락번호 추가 진행
            executeAddParagraphNumbers();
        }
        
        function addParagraphNumbers() {
            const msg = document.getElementById('paragraphNumMessage');
            msg.classList.add('hidden');
            
            const textInput1El = document.getElementById('textInput1');
            const currentText = textInput1El.value;
            
            // 텍스트 입력 확인
            if (!currentText.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력하거나 워드 파일을 업로드해주세요.', 'error');
                return;
            }
            
            // 이미 단락번호가 존재하는지 확인 (0으로 시작하는 4~5자리, 뒤에 공백)
            if (/^\[0\d{3,4}\]\s/m.test(currentText)) {
                showMessage(msg, '⚠️ 이미 단락번호가 존재합니다. 단락번호를 제거한 후 다시 시도해주세요.', 'error');
                return;
            }
            
            // 바로 단락번호 추가 진행
            executeAddParagraphNumbers();
        }
        
        // 라인 텍스트에 [NNNN] 단락번호 부여 (표 내용/부제/청구항 이후 제외, 마침표로 끝나는 단락만)
        // 부제목/청구항/CROSS-REFERENCE 판별 함수는 utils.js에서 로드됨
        function numberParagraphLines1(text) {
            const lines = text.split('\n');

            // CROSS-REFERENCE 시작 위치 찾기 (이전 줄은 단락번호 부여 안함)
            const crossRefIndex = lines.findIndex(isCrossRefLine);

            // 종료 지점 찾기 (WHAT IS CLAIMED IS: 또는 【CLAIMS】)
            const stopIndex = lines.findIndex(isClaimsStartLine);

            let counter = 1;
            let insideTable = false;
            const resultLines = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // 표 시작/종료 감지
                if (trimmed.startsWith('<table')) {
                    insideTable = true;
                }
                if (trimmed.endsWith('</table>')) {
                    insideTable = false;
                    resultLines.push(line);
                    continue;
                }

                // 종료 지점 도달 시, 또는 CROSS-REFERENCE 이전이면 번호 추가 중단
                let stopNumbering = (stopIndex >= 0 && i >= stopIndex) || (crossRefIndex >= 0 && i < crossRefIndex);

                // 번호 붙이기 로직 (표 내용에는 번호 부여하지 않음, 마침표로 끝나는 단락만)
                if (!stopNumbering && trimmed && !isPatentSectionSubtitle(line) && !insideTable && /[.。]["']?$/.test(trimmed)) {
                    // 이미 단락번호가 있는지 확인 (4~5자리)
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

        function executeAddParagraphNumbers() {
            const msg = document.getElementById('paragraphNumMessage');
            const textInput1El = document.getElementById('textInput1');
            const currentText = textInput1El.value;

            const numberedInput = numberParagraphLines1(currentText);
            textInput1El.value = numberedInput.text;
            let count = numberedInput.count;

            if (finParsedIR1 && rawOutput1) {
                // fin 흐름: 변환결과(ROPKS)가 입력창과 다른 텍스트 — 같은 규칙으로 별도 번호 부여 후 재렌더링
                const numberedOutput = numberParagraphLines1(rawOutput1);
                count = numberedOutput.count;
                displayResult1({
                    text: numberedInput.text,
                    outputText: numberedOutput.text,
                    subscriptCount: (numberedOutput.text.match(/<sub>/gi) || []).length,
                    superscriptCount: (numberedOutput.text.match(/<sup>/gi) || []).length
                });
            } else {
                rawOutput1 = numberedInput.text;

                // 분석 결과 업데이트
                fileAnalysisResult.hasParagraphNum = true;
                updateFileAnalysisDisplay();

                // 화면 업데이트
                document.getElementById('output1').innerHTML = rawOutput1.replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                    .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                    .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                    .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>')
                    .replace(/\[(\d{4,5})\]/g,'<span class="para-num-mark">[$1]</span>');
                document.getElementById('preview1').innerHTML = rawOutput1.replace(/\n/g,'<br>');

                // 단락 개수 업데이트
                document.getElementById('paragraphCount1').textContent = count;
            }

            showMessage(msg, `✅ 단락번호가 추가되었습니다! (총 ${count}개 단락)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        function removeParagraphNumbers() {
            const msg = document.getElementById('paragraphNumMessage');
            msg.classList.add('hidden');
            
            const textInput1El = document.getElementById('textInput1');
            const currentText = textInput1El.value;
            
            // 텍스트 입력 확인
            if (!currentText.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력하거나 워드 파일을 업로드해주세요.', 'error');
                return;
            }
            
            // 모든 단락을 검사하여 규정된 양식(4~5자리 숫자)의 단락번호 제거
            const strip = (text) => {
                let removed = 0;
                const out = text.split('\n').map(line => {
                    if (/^\[\d{4,5}\]\s?/.test(line)) {
                        removed++;
                        return line.replace(/^\[\d{4,5}\]\s?/, '');
                    }
                    return line;
                }).join('\n');
                return { text: out, removed };
            };

            const inputStripped = strip(currentText);
            // fin 흐름: 변환결과(ROPKS)가 입력창과 다른 텍스트 — 거기서도 제거
            const finFlow = !!(finParsedIR1 && rawOutput1);
            const outputStripped = finFlow ? strip(rawOutput1) : null;

            const removedCount = Math.max(inputStripped.removed, outputStripped ? outputStripped.removed : 0);
            if (removedCount === 0) {
                showMessage(msg, '❌ 제거할 단락번호가 없습니다.', 'error');
                return;
            }

            document.getElementById('textInput1').value = inputStripped.text;

            if (finFlow) {
                // 재렌더링 + 분석결과 재계산 (변환결과 기준)
                displayResult1({
                    text: inputStripped.text,
                    outputText: outputStripped.text,
                    subscriptCount: (outputStripped.text.match(/<sub>/gi) || []).length,
                    superscriptCount: (outputStripped.text.match(/<sup>/gi) || []).length
                });
            } else {
                rawOutput1 = inputStripped.text;

                // 분석 결과 업데이트
                fileAnalysisResult.hasParagraphNum = false;
                updateFileAnalysisDisplay();

                // 화면 업데이트
                document.getElementById('output1').innerHTML = rawOutput1.replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/&lt;sub&gt;/g,'<span class="sub-tag">&lt;sub&gt;</span>')
                    .replace(/&lt;\/sub&gt;/g,'<span class="sub-tag">&lt;/sub&gt;</span>')
                    .replace(/&lt;sup&gt;/g,'<span class="sup-tag">&lt;sup&gt;</span>')
                    .replace(/&lt;\/sup&gt;/g,'<span class="sup-tag">&lt;/sup&gt;</span>');
                document.getElementById('preview1').innerHTML = rawOutput1.replace(/\n/g,'<br>');

                // 단락 개수 재계산 (번호 제거 후에도 실제 단락 수 유지)
                document.getElementById('paragraphCount1').textContent = countParagraphsInText(rawOutput1);
            }

            showMessage(msg, `✅ 단락번호가 제거되었습니다! (${removedCount}개 제거)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        function copyResult1() {
            // 변환결과(출력 박스)에 표시된 텍스트를 복사 (.fin은 ROPKS, .docx는 원본과 동일)
            const text = rawOutput1 || document.getElementById('textInput1').value;
            navigator.clipboard.writeText(text).then(() => {
                const b = document.querySelector('#output1Section .copy-btn');
                b.textContent = '복사됨!'; setTimeout(() => b.textContent = '📋 복사', 2000);
            });
        }
        
        // DOCX 생성 공통 함수 (후처리 탭에서 사용) - font size 12pt 적용
        async function generateDocxCommon(text, filename, msgElement) {
            let bodyContent = '';
            let insideTable = false;
            let tableBuffer = '';

            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // 페이지 나누기 마커 처리
                if (trimmed === '<pagebreak/>') {
                    bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
                    continue;
                }

                // 표 시작 감지
                if (trimmed.startsWith('<table')) {
                    // 한 줄에 표 전체가 있는 경우
                    if (trimmed.includes('</table>')) {
                        bodyContent += convertHtmlTableToOoxml(line);
                        continue;
                    }
                    // 여러 줄에 걸친 표 시작
                    insideTable = true;
                    tableBuffer = line + '\n';
                    continue;
                }

                // 표 내용 수집
                if (insideTable) {
                    tableBuffer += line + '\n';
                    if (trimmed.includes('</table>')) {
                        // 표 종료 - 변환
                        bodyContent += convertHtmlTableToOoxml(tableBuffer);
                        insideTable = false;
                        tableBuffer = '';
                    }
                    continue;
                }

                // 일반 텍스트 (font size 12pt = w:sz val 24)
                bodyContent += `<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>${parseOoxmlWithSize(line)}</w:p>`;
            }

            const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyContent}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
            const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
            const relXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
            const drXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
            const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
            const zip = new JSZip();
            zip.file('[Content_Types].xml', ctXml);
            zip.folder('_rels').file('.rels', relXml);
            zip.folder('word').file('document.xml', docXml);
            zip.folder('word').file('settings.xml', settingsXml);
            zip.folder('word').file('styles.xml', makeDocxStylesXml({ fontSize: 24 })); // 단락 뒤 간격 0pt (utils.js)
            zip.folder('word/_rels').file('document.xml.rels', drXml);
            saveAs(await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), filename+'.docx');
            showMessage(msgElement, '✅ 워드 파일(.docx)이 생성되었습니다!', 'success');
            setTimeout(() => msgElement.classList.add('hidden'), 3000);
        }
        
        // parseOoxml with font size 12pt
        function parseOoxmlWithSize(line) {
            const re = /<(sub|sup)>(.*?)<\/\1>/gi;
            let res = '', last = 0, m;
            while ((m = re.exec(line)) !== null) {
                if (m.index > last) {
                    const t = escapeXml(line.slice(last, m.index));
                    if (t) res += `<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
                }
                const tag = m[1].toLowerCase();
                const vert = tag === 'sub' ? 'subscript' : 'superscript';
                res += `<w:r><w:rPr><w:vertAlign w:val="${vert}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(m[2])}</w:t></w:r>`;
                last = re.lastIndex;
            }
            if (last < line.length) {
                const t = escapeXml(line.slice(last));
                if (t) res += `<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
            }
            return res;
        }
        
        function clearAll1() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            document.getElementById('textInput1').value = '';
            document.getElementById('fileName1').textContent = '또는 아래에 .docx / .fin 파일을 드래그하세요';
            document.getElementById('fileInput1').value = '';
            finParsedIR1 = null;
            finCrossRef1 = null;
            document.getElementById('finOutputSection').classList.add('hidden');
            document.getElementById('finOutputMessage').classList.add('hidden');
            setFinRopksSectionVisible(false);
            document.getElementById('finRopksMessage').classList.add('hidden');
            document.getElementById('finMgmtNo1').value = '';
            priorityList1 = [];
            renderPriorityList1();
            document.getElementById('output1').innerHTML = '';
            document.getElementById('preview1').innerHTML = '';
            document.getElementById('result1Section').classList.add('hidden');
            document.getElementById('output1Section').classList.add('hidden');
            document.getElementById('fileAnalysis1').classList.add('hidden');
            document.getElementById('crossRefMessage').classList.add('hidden');
            document.getElementById('subtitleMessage').classList.add('hidden');
            document.getElementById('paragraphNumMessage').classList.add('hidden');
            rawOutput1 = '';
            fileAnalysisResult = { hasCrossRef: false, hasScript: false, hasParagraphNum: false, hasTable: false, suspicious: null };
            document.getElementById('suspiciousDetail1').className = 'suspicious-detail hidden';
            document.getElementById('suspiciousDetail1').innerHTML = '';
            document.getElementById('subCount1').textContent = '0';
            document.getElementById('supCount1').textContent = '0';
            document.getElementById('paragraphCount1').textContent = '0';
            document.getElementById('tableCount1').textContent = '0';
            document.getElementById('claimCount1').textContent = '0';
        }
        
