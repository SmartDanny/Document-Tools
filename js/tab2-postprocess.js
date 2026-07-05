/**
 * Document Tools - js/tab2-postprocess.js
 * 탭2: 후처리 단계 (HTML → DOCX)
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // 탭2
        const inp2 = document.getElementById('htmlInput2');
        window.tab2USFormat = false;
        inp2.addEventListener('input', () => { window.tab2USFormat = false; updatePreview2(); });
        function updatePreview2() {
            resetStatNavState('tab2');
            const t = inp2.value;

            // 미리보기 - 표는 실제 HTML로 렌더링
            let previewHtml = t;
            let inTable = false;
            const lines = previewHtml.split('\n');
            let previewLines = [];
            for (let line of lines) {
                const trimmed = line.trim();
                // 페이지 나누기 마커 시각화
                if (trimmed === '<pagebreak/>') {
                    previewLines.push('<div style="border-top:2px dashed #e74c3c;margin:10px 0;padding:5px 0;text-align:center;color:#e74c3c;font-size:0.85em;">--- 페이지 나누기 ---</div>');
                    continue;
                }
                if (line.trim().startsWith('<table')) inTable = true;
                if (inTable) {
                    previewLines.push(line);
                } else {
                    previewLines.push(line + '<br>');
                }
                if (line.trim().endsWith('</table>')) inTable = false;
            }
            document.getElementById('preview2').innerHTML = previewLines.join('') || '입력된 텍스트의 미리보기가 여기에 표시됩니다.';
            
            // 첨자 개수
            document.getElementById('subCount2').textContent = (t.match(/<sub>/gi)||[]).length;
            document.getElementById('supCount2').textContent = (t.match(/<sup>/gi)||[]).length;
            
            // 표 개수
            const tableMatches = t.match(/<table[^>]*>/gi);
            document.getElementById('tableCount2').textContent = tableMatches ? tableMatches.length : 0;
            
            // 단락 개수 (WHAT IS CLAIMED IS: 이전, 마침표로 끝나는 단락만 카운트)
            let paragraphCount = 0;
            let insideTable = false;
            let afterClaimsSection = false;
            for (let line of lines) {
                const trimmed = line.trim();
                
                // pagebreak 마커는 건너뜀
                if (trimmed === '<pagebreak/>') continue;
                
                // WHAT IS CLAIMED IS: 이후는 카운트하지 않음
                if (trimmed === 'WHAT IS CLAIMED IS:' || trimmed === 'WHAT IS CLAIMED IS') {
                    afterClaimsSection = true;
                }
                
                if (trimmed.startsWith('<table')) insideTable = true;
                
                // 단락 카운트 조건: 표 밖, WHAT IS CLAIMED IS: 이전, 마침표로 끝남
                if (!afterClaimsSection && !insideTable && trimmed && 
                    !trimmed.startsWith('<table') && !trimmed.endsWith('</table>') &&
                    /[.。]["']?$/.test(trimmed)) {
                    paragraphCount++;
                }
                
                if (trimmed.endsWith('</table>')) insideTable = false;
            }
            document.getElementById('paragraphCount2').textContent = paragraphCount;
        }
        function loadExample2(type) {
            const ex = {
                chemistry: '물: H<sub>2</sub>O\n이산화탄소: CO<sub>2</sub>\n황산: H<sub>2</sub>SO<sub>4</sub>',
                math: '피타고라스: a<sup>2</sup> + b<sup>2</sup> = c<sup>2</sup>\n거듭제곱: 2<sup>10</sup> = 1024',
                mixed: '아보가드로 수: 6.022 × 10<sup>23</sup>\n황산 이온: SO<sub>4</sub><sup>2-</sup>',
                table: '【표 1】\n<table border="1">\n<tr><td>항목</td><td>설명</td></tr>\n<tr><td>H<sub>2</sub>O</td><td>물</td></tr>\n<tr><td>CO<sub>2</sub></td><td>이산화탄소</td></tr>\n</table>\n위 표는 화학식 예시입니다.'
            };
            inp2.value = ex[type]; updatePreview2();
        }
        
        // 탭1 3단계 접기/펼치기
        function toggleSection1(step) {
            const content = document.getElementById('content1' + step);
            const btn = document.getElementById('toggleBtn1' + step);
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? '' : 'none';
            btn.textContent = isCollapsed ? '▲ 접기' : '▶ 펼치기';
        }

        // 탭2 2단계/3단계 접기/펼치기
        function toggleSection2(step) {
            const content = document.getElementById('content2' + step);
            const btn = document.getElementById('toggleBtn2' + step);
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? '' : 'none';
            btn.textContent = isCollapsed ? '▲ 접기' : '▶ 펼치기';
        }

        function clearAll2() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            inp2.value = '';
            window.tab2USFormat = false;
            document.getElementById('fileName2').textContent = '또는 아래에 .docx 파일을 드래그하세요';
            document.getElementById('fileInput2').value = '';
            document.getElementById('outputFileName2').value = '';
            document.getElementById('preview2').innerHTML = '입력된 텍스트의 미리보기가 여기에 표시됩니다.';
            document.getElementById('subCount2').textContent = '0';
            document.getElementById('supCount2').textContent = '0';
            document.getElementById('paragraphCount2').textContent = '0';
            document.getElementById('tableCount2').textContent = '0';
            // 우선권 목록 초기화
            priorityList2 = [];
            renderPriorityList2();
            // 메시지 초기화
            document.getElementById('crossRefMessage2').classList.add('hidden');
            document.getElementById('subtitleMessage2').classList.add('hidden');
            document.getElementById('paragraphNumMessage2').classList.add('hidden');
        }
        
        // 탭2 파일 업로드 처리
        async function handleFile2(file) {
            await handleDocxUpload(file, 'fileName2', async (file) => {
                const result = await processDocx1(file); // 동일한 파싱 함수 사용
                inp2.value = result.text;
                updatePreview2();
            });
        }
        
        // 탭2 파일 선택 버튼
        document.getElementById('fileInput2').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            await handleFile2(file);
        });
        
        // 탭2 드래그 앤 드롭
        setupDropZone(inp2, handleFile2); // 드래그 앤 드롭 (utils.js)
        
        // 탭2 Cross-reference 삽입 함수
        function insertCrossReference2() {
            const msg = document.getElementById('crossRefMessage2');
            msg.classList.add('hidden');
            
            const currentText = inp2.value;
            
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
            if (priorityList2.length === 0) {
                showMessage(msg, '❌ 우선권출원 정보를 추가해주세요.', 'error');
                return;
            }

            // 월 영문 변환 헬퍼
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'];

            // Cross-reference 텍스트 생성 (영문)
            let priorityText2;
            if (priorityList2.length === 1) {
                const p = priorityList2[0];
                const mEng = monthNames[parseInt(p.month) - 1] || p.month;
                priorityText2 = `This application is based on Korean Patent Application No. ${p.appNum}, filed on ${mEng} ${parseInt(p.day)}, ${p.year}, the entire contents of which are incorporated herein by reference.`;
            } else {
                const parts = priorityList2.map(p => {
                    const mEng = monthNames[parseInt(p.month) - 1] || p.month;
                    return `Korean Patent Application No. ${p.appNum}, filed on ${mEng} ${parseInt(p.day)}, ${p.year}`;
                });
                priorityText2 = `This application is based on ${parts.join(', and ')}, the entire contents of which are incorporated herein by reference.`;
            }
            const crossRef = `CROSS-REFERENCE TO RELATED APPLICATIONS\n${priorityText2}`;
            
            // BACKGROUND로 시작하는 단락 찾기
            const lines = currentText.split('\n');
            let insertIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().toUpperCase().startsWith('BACKGROUND')) {
                    insertIndex = i;
                    break;
                }
            }
            
            if (insertIndex < 0) {
                showMessage(msg, '❌ BACKGROUND 단락을 찾을 수 없습니다.', 'error');
                return;
            }
            
            // 삽입 (빈줄 없이)
            lines.splice(insertIndex, 0, crossRef);
            inp2.value = lines.join('\n');
            
            // 미리보기 업데이트
            updatePreview2();
            
            showMessage(msg, '✅ Cross-reference가 삽입되었습니다!', 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 탭2 부제표준화 함수
        function standardizeSubtitles2() {
            const msg = document.getElementById('subtitleMessage2');
            msg.classList.add('hidden');
            
            const currentText = inp2.value;
            
            if (!currentText.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력하거나 워드 파일을 업로드해주세요.', 'error');
                return;
            }
            
            // 선택된 표준 확인
            const selectedStandard = document.querySelector('input[name="subtitleStandard2"]:checked').value;
            
            let result = currentText;
            let convertedCount = 0;
            
            // 변환 규칙 정의
            const officeUSRules = [
                { from: '【발명의 설명】', to: '', delete: true },
                { from: '【발명의 명칭】', to: 'TITLE OF THE INVENTION' },
                { from: '【기술분야】', to: 'BACKGROUND OF THE INVENTION\n(a) Field of the Invention' },
                { from: '【발명의 배경이 되는 기술】', to: '(b) Description of the Related Art' },
                { from: '【배경기술】', to: '(b) Description of the Related Art' },
                { from: '【발명의 내용】', to: 'SUMMARY OF THE INVENTION' },
                { from: '【해결하고자 하는 과제】', to: '', delete: true },
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
                { from: '【발명의 설명】', to: '', delete: true },
                { from: '【발명의 명칭】', to: '', delete: true },
                { from: '【기술분야】', to: 'BACKGROUND\n1. Field' },
                { from: '【발명의 배경이 되는 기술】', to: '2. Description of the Related Art' },
                { from: '【배경기술】', to: '2. Description of the Related Art' },
                { from: '【발명의 내용】', to: 'SUMMARY' },
                { from: '【해결하고자 하는 과제】', to: '', delete: true },
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
            inp2.value = result;
            
            // 미리보기 업데이트
            updatePreview2();
            
            showMessage(msg, `✅ 부제표준화 완료! (${standardName} 형식, ${convertedCount}개 부제 변환됨)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 5000);
        }
        
        // 양식표준화 공통 로직 (텍스트 입력, 결과 반환)
        function applyFormatStandardization(text) {
            // 1단계: 단락 뒤 불필요한 공백(trailing spaces) 제거
            const rawLines = text.split('\n');
            let trailingSpaceRemoved = 0;
            const cleanedLines = rawLines.map(line => {
                const trimmedRight = line.replace(/\s+$/, '');
                if (trimmedRight !== line && line.trim() !== '') {
                    trailingSpaceRemoved++;
                }
                return trimmedRight;
            });
            text = cleanedLines.join('\n');

            // 2단계: 양식표준화 규칙 적용
            const lines = text.split('\n');
            const resultLines = [];
            let inClaims = false;
            let changeCount = trailingSpaceRemoved;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                const upperTrimmed = trimmed.toUpperCase();
                
                // CROSS-REFERENCE TO RELATED APPLICATIONS 앞에 1줄 추가
                if (upperTrimmed === 'CROSS-REFERENCE TO RELATED APPLICATIONS' || 
                    upperTrimmed === 'CROSS-REFERENCE TO RELATED APPLICATION') {
                    if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '') {
                        resultLines.push('');
                        changeCount++;
                    }
                    resultLines.push(line);
                    continue;
                }
                
                // BACKGROUND 또는 BACKGROUND OF THE INVENTION 앞에 1줄 추가
                if (upperTrimmed === 'BACKGROUND' || 
                    upperTrimmed === 'BACKGROUND OF THE INVENTION') {
                    if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '') {
                        resultLines.push('');
                        changeCount++;
                    }
                    resultLines.push(line);
                    continue;
                }
                
                // WHAT IS CLAIMED IS: 앞에 페이지 나누기, 다음에 빈줄 추가
                if (upperTrimmed === 'WHAT IS CLAIMED IS:' || upperTrimmed === 'WHAT IS CLAIMED IS') {
                    resultLines.push('<pagebreak/>');
                    resultLines.push(line);
                    // WHAT IS CLAIMED IS: 다음에 빈줄 추가
                    resultLines.push('');
                    inClaims = true;
                    changeCount++;
                    continue;
                }
                
                // ABSTRACT 또는 ABSTRACT OF DISCLOSURE 앞에 페이지 나누기
                if (upperTrimmed === 'ABSTRACT' || upperTrimmed === 'ABSTRACT OF DISCLOSURE') {
                    resultLines.push('<pagebreak/>');
                    resultLines.push(line);
                    inClaims = false; // 청구항 섹션 종료
                    changeCount++;
                    continue;
                }
                
                // WHAT IS CLAIMED IS: 이후, 영문 단락이 마침표로 끝나면 다음에 빈줄 추가
                if (inClaims) {
                    // 영문청구항 번호(X.)와 첫 단어 사이에 탭 삽입
                    const isKorean = /[가-힣]/.test(trimmed);
                    if (!isKorean && /^\d+\./.test(trimmed)) {
                        const modifiedLine = line.replace(/^(\s*)(\d+\.)\s*/, '$1$2\t');
                        if (modifiedLine !== line) changeCount++;
                        resultLines.push(modifiedLine);
                    } else {
                        resultLines.push(line);
                    }
                    // 영문 단락(한글이 없는)이고 마침표로 끝나는 경우에만 빈줄 추가
                    if (!isKorean && /\.\s*$/.test(trimmed)) {
                        // 다음 줄이 빈줄이 아니고, 마지막이 아닌 경우에만 빈줄 추가
                        if (i + 1 < lines.length && lines[i + 1].trim() !== '') {
                            resultLines.push('');
                            changeCount++;
                        }
                    }
                    continue;
                }
                
                resultLines.push(line);
            }
            
            return { text: resultLines.join('\n'), changeCount: changeCount };
        }
        
        // 탭2 양식표준화
        function standardizeFormat2() {
            const msg = document.getElementById('formatMessage2');
            msg.classList.add('hidden');

            const text = inp2.value;
            if (!text.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력해주세요.', 'error');
                return;
            }

            const result = applyFormatStandardization(text);

            if (result.changeCount === 0) {
                showMessage(msg, '❌ 적용할 양식 변경이 없습니다.', 'error');
                return;
            }

            inp2.value = result.text;
            updatePreview2();

            showMessage(msg, `✅ 양식표준화 완료! (${result.changeCount}개 변경 적용)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }

        // 탭2 US양식 적용 (양식표준화 + US 특허출원 DOCX 양식 활성화)
        function applyUSFormat2() {
            const msg = document.getElementById('formatMessage2');
            msg.classList.add('hidden');

            const text = inp2.value;
            if (!text.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력해주세요.', 'error');
                return;
            }

            // 양식표준화가 아직 안 되어 있으면 먼저 적용
            const result = applyFormatStandardization(text);
            if (result.changeCount > 0) {
                inp2.value = result.text;
                updatePreview2();
            }

            window.tab2USFormat = true; // US 특허출원 DOCX 양식 플래그

            const changes = result.changeCount > 0 ? ` 양식표준화 ${result.changeCount}개 변경 포함.` : '';
            showMessage(msg, `✅ US양식 적용 완료!${changes} DOCX 다운로드 시 US 특허출원 양식이 적용됩니다.`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 5000);
        }
        
        // 탭2 단락번호 추가
        function addParagraphNumbers2() {
            const msg = document.getElementById('paragraphNumMessage2');
            msg.classList.add('hidden');
            
            const text = inp2.value;
            if (!text.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력해주세요.', 'error');
                return;
            }
            
            // 이미 단락번호가 있는지 확인 (0으로 시작하는 4~5자리, 뒤에 공백)
            if (/^\[0\d{3,4}\]\s/m.test(text)) {
                showMessage(msg, '⚠️ 이미 단락번호가 존재합니다. 단락번호를 제거한 후 다시 시도해주세요.', 'error');
                return;
            }
            
            // 부제목/청구항/CROSS-REFERENCE 판별 함수는 utils.js에서 로드됨
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

                // 번호 붙이기 로직 (마침표로 끝나는 단락만)
                if (!stopNumbering && trimmed && !isGenericSubtitle(line, { checkSymbols: true }) && !insideTable && /[.。]["']?$/.test(trimmed)) {
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
            
            inp2.value = resultLines.join('\n');
            updatePreview2();
            
            showMessage(msg, `✅ 단락번호가 추가되었습니다! (총 ${counter - 1}개 단락)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 탭2 단락번호 제거
        function removeParagraphNumbers2() {
            const msg = document.getElementById('paragraphNumMessage2');
            msg.classList.add('hidden');

            const text = inp2.value;
            if (!text.trim()) {
                showMessage(msg, '❌ 먼저 텍스트를 입력해주세요.', 'error');
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

            inp2.value = resultLines.join('\n');
            updatePreview2();

            showMessage(msg, `✅ 단락번호가 제거되었습니다! (${removedCount}개 제거)`, 'success');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // escapeXml은 utils.js에서 로드됨
        function parseOoxml(line) {
            const re = /<(sub|sup)>(.*?)<\/\1>/gi;
            let res = '', last = 0, m;
            while ((m = re.exec(line)) !== null) {
                if (m.index > last) res += `<w:r><w:t xml:space="preserve">${escapeXml(line.substring(last, m.index))}</w:t></w:r>`;
                res += `<w:r><w:rPr><w:vertAlign w:val="${m[1]==='sub'?'subscript':'superscript'}"/></w:rPr><w:t>${escapeXml(m[2])}</w:t></w:r>`;
                last = re.lastIndex;
            }
            if (last < line.length) res += `<w:r><w:t xml:space="preserve">${escapeXml(line.substring(last))}</w:t></w:r>`;
            return res;
        }
        
        // HTML 표를 OOXML 표로 변환 (정규식 기반)
        function convertHtmlTableToOoxml(tableHtml) {
            // 행 추출
            const trMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
            if (!trMatches || trMatches.length === 0) return '';
            
            // 열 개수 계산
            let maxCols = 0;
            trMatches.forEach(tr => {
                let colCount = 0;
                const tdMatches = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
                if (tdMatches) {
                    tdMatches.forEach(td => {
                        const colspanMatch = td.match(/colspan\s*=\s*["']?(\d+)["']?/i);
                        colCount += colspanMatch ? parseInt(colspanMatch[1]) : 1;
                    });
                }
                maxCols = Math.max(maxCols, colCount);
            });
            
            if (maxCols === 0) return '';
            
            // 테이블 XML 생성
            let tblXml = '<w:tbl>';
            
            // 테이블 속성 (테두리 설정)
            tblXml += '<w:tblPr>';
            tblXml += '<w:tblStyle w:val="TableGrid"/>';
            tblXml += '<w:tblW w:w="0" w:type="auto"/>';
            tblXml += '<w:tblBorders>';
            tblXml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
            tblXml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
            tblXml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
            tblXml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
            tblXml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
            tblXml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
            tblXml += '</w:tblBorders>';
            tblXml += '</w:tblPr>';
            
            // 테이블 그리드
            tblXml += '<w:tblGrid>';
            for (let i = 0; i < maxCols; i++) {
                tblXml += '<w:gridCol w:w="2000"/>';
            }
            tblXml += '</w:tblGrid>';
            
            // 행 처리
            trMatches.forEach(tr => {
                tblXml += '<w:tr>';
                const tdMatches = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
                if (tdMatches) {
                    tdMatches.forEach(td => {
                        tblXml += '<w:tc>';
                        
                        // colspan 추출
                        const colspanMatch = td.match(/colspan\s*=\s*["']?(\d+)["']?/i);
                        if (colspanMatch && parseInt(colspanMatch[1]) > 1) {
                            tblXml += '<w:tcPr>';
                            tblXml += `<w:gridSpan w:val="${colspanMatch[1]}"/>`;
                            tblXml += '</w:tcPr>';
                        }
                        
                        // 셀 내용 추출 (태그 제거하고 내용만)
                        let cellContent = td.replace(/<t[dh][^>]*>/i, '').replace(/<\/t[dh]>/i, '');
                        // <br> 태그를 줄바꿈으로 변환
                        cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                        
                        // 여러 줄이면 여러 단락으로
                        const lines = cellContent.split('\n');
                        let hasContent = false;
                        lines.forEach(line => {
                            if (line.trim()) {
                                tblXml += `<w:p>${parseOoxml(line)}</w:p>`;
                                hasContent = true;
                            }
                        });
                        
                        // 빈 셀이면 빈 단락 추가
                        if (!hasContent) {
                            tblXml += '<w:p></w:p>';
                        }
                        
                        tblXml += '</w:tc>';
                    });
                }
                tblXml += '</w:tr>';
            });
            
            tblXml += '</w:tbl>';
            return tblXml;
        }
        
        async function convertToDocx2() {
            const t = inp2.value.trim(), msg = document.getElementById('message2');
            msg.classList.add('hidden');
            if (!t) { showMessage(msg, '❌ 텍스트를 입력해주세요.', 'error'); return; }
            const fn = document.getElementById('outputFileName2').value.trim() || 'output';
            try {
                await generateDocxCommon(t, fn, msg);
            } catch (e) { showMessage(msg, '❌ 오류: ' + e.message, 'error'); }
        }

        async function downloadUSFormat2() {
            const msg = document.getElementById('message2');
            msg.classList.add('hidden');
            let t = inp2.value.trim();
            if (!t) { showMessage(msg, '❌ 텍스트를 입력해주세요.', 'error'); return; }
            const result = applyFormatStandardization(t);
            if (result.changeCount > 0) {
                inp2.value = result.text;
                t = result.text;
                updatePreview2();
            }
            const fn = document.getElementById('outputFileName2').value.trim() || 'output';
            try {
                await generateDocxUSPatent(t, fn + '.docx');
                showMessage(msg, '✅ US 특허출원 양식 DOCX 파일이 생성되었습니다!', 'success');
                setTimeout(() => msg.classList.add('hidden'), 3000);
            } catch (e) { showMessage(msg, '❌ 오류: ' + e.message, 'error'); }
        }
        
