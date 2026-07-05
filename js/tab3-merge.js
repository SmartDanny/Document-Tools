/**
 * Document Tools - js/tab3-merge.js
 * 탭3: 한영혼합본 병합 기능
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // ========== 병합 기능 ==========
        let mergeKorParagraphs = [];
        let mergeEngParagraphs = [];
        let mergeResult = '';
        let mergeResultPairs = []; // [{text: '...', type: 'kor'|'eng'}, ...]
        
        // 국문 파일 처리
        async function handleFileKor3(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.docx')) {
                alert('❌ .docx 파일만 업로드 가능합니다.');
                return;
            }
            document.getElementById('fileNameKor3').textContent = file.name;
            try {
                const text = await extractTextFromDocx3Simple(file);
                document.getElementById('inputTextKor3').value = text;
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }
        
        // 영문 파일 처리
        async function handleFileEng3(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.docx')) {
                alert('❌ .docx 파일만 업로드 가능합니다.');
                return;
            }
            document.getElementById('fileNameEng3').textContent = file.name;
            try {
                const text = await extractTextFromDocx3Simple(file);
                document.getElementById('inputTextEng3').value = text;
            } catch (error) {
                alert('오류: ' + error.message);
            }
        }
        
        // 간단한 텍스트 추출 함수 (첨자, 표 포함 / 빈 단락 제외)
        async function extractTextFromDocx3Simple(file) {
            const { doc } = await loadDocxDocument(file);
            return extractDocxBodyText(doc, { skipEmptyParagraphs: true });
        }
        
        // 파일 선택 이벤트
        document.getElementById('fileInputKor3').addEventListener('change', async function(e) {
            await handleFileKor3(e.target.files[0]);
        });
        document.getElementById('fileInputEng3').addEventListener('change', async function(e) {
            await handleFileEng3(e.target.files[0]);
        });
        
        // 드래그 앤 드롭 이벤트 (국문)
        const inputTextKor3 = document.getElementById('inputTextKor3');
        inputTextKor3.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });
        inputTextKor3.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });
        inputTextKor3.addEventListener('drop', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                await handleFileKor3(e.dataTransfer.files[0]);
            }
        });
        
        // 드래그 앤 드롭 이벤트 (영문)
        const inputTextEng3 = document.getElementById('inputTextEng3');
        inputTextEng3.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });
        inputTextEng3.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });
        inputTextEng3.addEventListener('drop', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                await handleFileEng3(e.dataTransfer.files[0]);
            }
        });
        
        // 병합 실행
        function mergeDocuments3() {
            const korText = document.getElementById('inputTextKor3').value;
            const engText = document.getElementById('inputTextEng3').value;
            const msg = document.getElementById('merge3Message');
            
            if (!korText.trim() || !engText.trim()) {
                msg.textContent = '❌ 국문명세서와 영문명세서를 모두 입력해주세요.';
                msg.className = 'message error';
                return;
            }
            
            // 단락 분리 (줄 기준)
            const korLines = korText.split(/\n/).map(p => p.trim()).filter(p => p);
            const engLines = engText.split(/\n/).map(p => p.trim()).filter(p => p);
            
            // 단락번호 패턴: [0001], [0002], ... 또는 【0001】, 【0002】, ... (4~5자리)
            const paraNumPattern = /^\[(\d{4,5})\]\s*/;
            const paraNumPatternAlt = /^【(\d{4,5})】\s*/;
            
            // 단락번호 추출 함수
            function extractParaNum(line) {
                let match = line.match(paraNumPattern);
                if (match) return match[1];
                match = line.match(paraNumPatternAlt);
                if (match) return match[1];
                return null;
            }
            
            // 단락번호 제거 함수
            function removeParaNum(line) {
                return line.replace(paraNumPattern, '').replace(paraNumPatternAlt, '');
            }
            
            // 사무소표준US 메인 부제 목록 (섹션 구분용)
            const mainSectionHeaders = [
                { key: 'title', patterns: ['TITLE OF THE INVENTION', '【발명의 명칭】'] },
                { key: 'crossref', patterns: ['CROSS-REFERENCE TO RELATED APPLICATIONS', 'CROSS-REFERENCE TO RELATED APPLICATION', 'CROSS REFERENCE TO RELATED APPLICATIONS', 'CROSS REFERENCE TO RELATED APPLICATION'] },
                { key: 'background', patterns: ['BACKGROUND OF THE INVENTION', '【기술분야】', '【배경기술】'] },
                { key: 'summary', patterns: ['SUMMARY OF THE INVENTION', '【발명의 내용】'] },
                { key: 'drawings', patterns: ['BRIEF DESCRIPTION OF THE DRAWINGS', '【도면의 간단한 설명】'] },
                { key: 'detailed', patterns: ['DETAILED DESCRIPTION OF THE EMBODIMENTS', 'DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENTS', '【발명을 실시하기 위한 구체적인 내용】', '【발명의 실시를 위한 형태】'] },
                { key: 'symbols', patterns: ['Description of Symbols', 'DESCRIPTION OF SYMBOLS', '【부호의 설명】'] },
                { key: 'claims', patterns: ['WHAT IS CLAIMED IS:', 'WHAT IS CLAIMED IS', '【청구범위】', '【청구의 범위】'] },
                { key: 'abstract', patterns: ['ABSTRACT OF DISCLOSURE', 'ABSTRACT', '【요약서】', '【요약】'] }
            ];
            
            // 소부제 패턴 (섹션 내부에서 사용)
            const subSectionHeaders = [
                '(a) Field of the Invention',
                '(b) Description of the Related Art',
                '【해결하고자 하는 과제】',
                '【기술적 과제】',
                '【과제의 해결 수단】',
                '【기술적 해결방법】',
                '【발명의 효과】',
                'Description of Symbols',
                'DESCRIPTION OF SYMBOLS',
                '<Description of Symbols>',
                '<Description of symbols>',
                '<DESCRIPTION OF SYMBOLS>',
                '【부호의 설명】',
                '부호의 설명'
            ];
            
            // 메인 섹션 헤더인지 확인
            function getMainSectionKey(line) {
                const trimmed = removeParaNum(line).trim();
                for (const section of mainSectionHeaders) {
                    for (const pattern of section.patterns) {
                        if (trimmed.toUpperCase() === pattern.toUpperCase()) {
                            return section.key;
                        }
                    }
                }
                return null;
            }
            
            // 소부제인지 확인
            function isSubSectionHeader(line) {
                const trimmed = removeParaNum(line).trim();
                return subSectionHeaders.some(h => trimmed === h || trimmed.toUpperCase() === h.toUpperCase());
            }
            
            // 부제(메인 또는 소부제)인지 확인
            function isAnySubtitle(line) {
                const trimmed = removeParaNum(line).trim();
                if (!trimmed) return false;
                if (getMainSectionKey(line)) return true;
                if (isSubSectionHeader(line)) return true;
                return false;
            }
            
            // 본문 단락인지 확인 (마침표로 끝나거나 단락번호가 있음)
            function isContentParagraph(line) {
                const trimmed = removeParaNum(line).trim();
                if (!trimmed) return false;
                // 부제가 아니면 본문
                if (isAnySubtitle(line)) return false;
                return true;
            }

            // 단락 개수 카운트 (단락번호 추가 기준과 동일: 마침표로 끝나는 본문 단락, 청구항 이전, 표 제외)
            function countParagraphsForMerge(text) {
                // 기존 단락번호([XXXX], 【XXXX】) 제거 후 addParagraphNumbersToText 방식 그대로 적용
                const stripped = text.replace(/^\[(\d{4,5})\]\s*/gm, '').replace(/^【(\d{4,5})】\s*/gm, '');
                return addParagraphNumbersToText(stripped).count;
            }

            // 단락번호가 없는 본문 단락에 순서대로 단락번호 추가
            function ensureParaNumbers(lines) {
                // 기존 단락번호를 모두 제거한 뒤 addParagraphNumbersToText 기준으로 재번호 부여.
                // 이렇게 해야 국문(기존 번호 있음)과 영문(번호 없음) 모두 동일한 기준
                // (마침표로 끝나는 단락만, CROSS-REFERENCE 이전 제외)으로 번호가 매겨져
                // 단락번호 기반 매칭이 정확하게 이루어진다.
                const stripped = lines.map(line =>
                    line.replace(paraNumPattern, '').replace(paraNumPatternAlt, '')
                );
                const result = addParagraphNumbersToText(stripped.join('\n'));
                return result.text.split('\n');
            }

            // 청구항 시작 패턴 감지
            function isClaimStart(line) {
                const trimmed = removeParaNum(line).trim();
                if (/^\d+\./.test(trimmed)) return true;
                if (/^【청구항\s*\d+】/.test(trimmed)) return true;
                if (/^【Claim\s*\d+】/i.test(trimmed)) return true;
                return false;
            }
            
            // 문서를 메인 섹션별로 분리
            function splitByMainSections(lines) {
                const sections = [];
                let currentSection = { key: null, header: null, lines: [] };
                
                for (const line of lines) {
                    const sectionKey = getMainSectionKey(line);
                    if (sectionKey) {
                        // 새 섹션 시작
                        if (currentSection.key || currentSection.lines.length > 0) {
                            sections.push(currentSection);
                        }
                        currentSection = { 
                            key: sectionKey, 
                            header: removeParaNum(line).trim(), 
                            lines: [] 
                        };
                    } else {
                        currentSection.lines.push(line);
                    }
                }
                
                if (currentSection.key || currentSection.lines.length > 0) {
                    sections.push(currentSection);
                }
                
                return sections;
            }
            
            // 단락개수 카운트 (단락번호 추가 기준: 마침표로 끝나는 본문 단락, 청구항 이전, 표 제외)
            const korParaCount = countParagraphsForMerge(korText);
            const engParaCount = countParagraphsForMerge(engText);

            // 단락개수 불일치 시 경고 및 병합 중단
            if (korParaCount !== engParaCount) {
                msg.innerHTML = `❌ 단락 개수 불일치로 병합을 중단합니다.<br>` +
                    `국문 단락: <strong>${korParaCount}개</strong>, 영문 단락: <strong>${engParaCount}개</strong><br>` +
                    `단락 수를 일치시킨 후 다시 시도하세요.`;
                msg.className = 'message error';
                return;
            }

            // 단락번호 확보: 없는 단락에 순서대로 [XXXX] 번호 추가
            const korLinesNumbered = ensureParaNumbers(korLines);
            const engLinesNumbered = ensureParaNumbers(engLines);

            // 섹션 분리
            const korSections = splitByMainSections(korLinesNumbered);
            const engSections = splitByMainSections(engLinesNumbered);
            
            // 섹션 키로 매핑
            const korSectionMap = new Map();
            korSections.forEach(s => {
                if (s.key) {
                    korSectionMap.set(s.key, s);
                }
            });
            
            const engSectionMap = new Map();
            engSections.forEach(s => {
                if (s.key) {
                    engSectionMap.set(s.key, s);
                }
            });
            
            // 부제 비교
            const korKeys = Array.from(korSectionMap.keys());
            const engKeys = Array.from(engSectionMap.keys());
            const allKeys = [...new Set([...korKeys, ...engKeys])];
            const mismatches = [];
            
            for (const key of allKeys) {
                const korHas = korKeys.includes(key);
                const engHas = engKeys.includes(key);
                
                if (korHas && !engHas) {
                    const korSection = korSectionMap.get(key);
                    mismatches.push({ key, type: 'kor_only', kor: korSection.header, eng: null });
                } else if (!korHas && engHas) {
                    const engSection = engSectionMap.get(key);
                    mismatches.push({ key, type: 'eng_only', kor: null, eng: engSection.header });
                }
            }
            
            let resultLines = [];
            let resultHtml = '';
            mergeResultPairs = [];
            
            // 경고 메시지 추가
            if (mismatches.length > 0) {
                resultHtml += `<div style="background:#fff3cd;padding:12px;margin:8px 0;border-radius:4px;border-left:4px solid #ffc107;">
                    <strong>⚠️ 부제 불일치 감지!</strong> 병합 전에 부제표준화를 권장합니다.<br>`;
                mismatches.forEach(m => {
                    if (m.type === 'kor_only') {
                        resultHtml += `<span style="color:#d63384;">국문에만 존재: ${m.kor}</span><br>`;
                    } else if (m.type === 'eng_only') {
                        resultHtml += `<span style="color:#0d6efd;">영문에만 존재: ${m.eng}</span><br>`;
                    }
                });
                resultHtml += `</div>`;
            }
            
            // 단락 추가 헬퍼 함수
            function addKorLine(line) {
                const cleaned = removeParaNum(line).trim();
                // 한글이 포함된 줄만 국문(갈색)으로, 한글이 없는 줄(영문부제 등)은 영문(검정)으로 처리
                const hasKorean = /[가-힣]/.test(cleaned);
                resultLines.push(line);
                if (hasKorean) {
                    mergeResultPairs.push({ text: line, type: 'kor' });
                    resultHtml += `<div style="background:#e8f5e9;padding:8px 12px;margin:4px 0;border-radius:4px;border-left:3px solid #4caf50;">${escapeHtml(line)}</div>`;
                } else {
                    mergeResultPairs.push({ text: line, type: 'eng' });
                    resultHtml += `<div style="background:#e3f2fd;padding:8px 12px;margin:4px 0;border-radius:4px;border-left:3px solid #2196f3;">${escapeHtml(line)}</div>`;
                }
            }
            
            function addEngLine(line) {
                resultLines.push(line);
                mergeResultPairs.push({ text: line, type: 'eng' });
                resultHtml += `<div style="background:#e3f2fd;padding:8px 12px;margin:4px 0;border-radius:4px;border-left:3px solid #2196f3;">${escapeHtml(line)}</div>`;
            }
            
            // 섹션 내용 병합 함수
            function mergeSectionContent(korSection, engSection, sectionKey) {
                // 부제 출력: 영문부제는 영문 색상, 국문부제는 국문 색상
                if (korSection && korSection.header && engSection && engSection.header) {
                    // 양쪽 모두 부제 있음
                    if (/[가-힣]/.test(korSection.header)) {
                        // 국문 섹션의 부제가 한글 → 영문부제 먼저, 국문부제 다음
                        addEngLine(engSection.header);
                        addKorLine(korSection.header);
                    } else {
                        // 국문 섹션의 부제가 영문 → 영문 색상으로 한 번만 출력
                        addEngLine(korSection.header);
                    }
                } else if (korSection && korSection.header) {
                    // 국문 섹션만 있음
                    if (/[가-힣]/.test(korSection.header)) {
                        addKorLine(korSection.header);
                    } else {
                        addEngLine(korSection.header);
                    }
                } else if (engSection && engSection.header) {
                    // 영문 섹션만 있음
                    addEngLine(engSection.header);
                }
                
                const korParas = korSection ? korSection.lines : [];
                const engParas = engSection ? engSection.lines : [];
                
                // symbols 섹션: 국문 전체 배치 후 영문 전체 배치
                if (sectionKey === 'symbols') {
                    // 국문 단락 전체 출력 (addKorLine이 한글 유무로 색상 자동 판별)
                    korParas.forEach(line => addKorLine(line));
                    // 영문 단락 전체 출력 (부제 제외, 단락번호 유지)
                    engParas.forEach(line => {
                        if (isContentParagraph(line)) {
                            addEngLine(line);
                        }
                    });
                    return;
                }
                
                // 청구항 섹션: 국문 청구항 그룹 + 영문 청구항 그룹 번갈아 배치 (청구항 번호 기반 매칭)
                if (sectionKey === 'claims') {
                    // 국문 청구항 그룹화: 【청구항 X】 또는 [청구항 X] 헤더 기준으로 그룹 구분
                    // (다음 청구항 헤더가 나올 때까지 모든 줄을 현재 청구항 그룹에 포함)
                    function groupKoreanClaims(paragraphs) {
                        const claims = {}; // 청구항 번호를 키로 사용
                        const preContent = []; // 청구항 시작 전 내용
                        let currentClaim = [];
                        let currentClaimNum = null;

                        for (const line of paragraphs) {
                            const trimmed = removeParaNum(line).trim();
                            // 청구항 시작: 【청구항 X】 또는 [청구항 X]
                            const claimMatch = trimmed.match(/^[【\[]청구항\s*(\d+)[】\]]/);
                            if (claimMatch) {
                                // 이전 청구항 저장
                                if (currentClaimNum !== null && currentClaim.length > 0) {
                                    claims[currentClaimNum] = currentClaim;
                                }
                                currentClaimNum = parseInt(claimMatch[1]);
                                currentClaim = [line];
                            } else if (currentClaimNum !== null) {
                                // 현재 청구항에 속하는 줄 추가
                                currentClaim.push(line);
                            } else {
                                // 청구항 시작 전의 내용
                                preContent.push(line);
                            }
                        }
                        // 마지막 청구항 저장
                        if (currentClaimNum !== null && currentClaim.length > 0) {
                            claims[currentClaimNum] = currentClaim;
                        }

                        return { claims, preContent };
                    }

                    // 영문 청구항 그룹화: 숫자. 헤더 기준으로 그룹 구분
                    // (다음 청구항 헤더가 나올 때까지 모든 줄을 현재 청구항 그룹에 포함)
                    function groupEnglishClaims(paragraphs) {
                        const claims = {}; // 청구항 번호를 키로 사용
                        const preContent = []; // 청구항 시작 전 내용
                        let currentClaim = [];
                        let currentClaimNum = null;

                        for (const line of paragraphs) {
                            const trimmed = removeParaNum(line).trim();
                            // 청구항 시작: 숫자. 로 시작 (공백 유무 무관)
                            const claimMatch = trimmed.match(/^(\d+)\./);
                            if (claimMatch) {
                                // 이전 청구항 저장
                                if (currentClaimNum !== null && currentClaim.length > 0) {
                                    claims[currentClaimNum] = currentClaim;
                                }
                                currentClaimNum = parseInt(claimMatch[1]);
                                currentClaim = [line];
                            } else if (currentClaimNum !== null) {
                                // 현재 청구항에 속하는 줄 추가
                                currentClaim.push(line);
                            } else {
                                // 청구항 시작 전의 내용
                                preContent.push(line);
                            }
                        }
                        // 마지막 청구항 저장
                        if (currentClaimNum !== null && currentClaim.length > 0) {
                            claims[currentClaimNum] = currentClaim;
                        }

                        return { claims, preContent };
                    }
                    
                    const korResult = groupKoreanClaims(korParas);
                    const engResult = groupEnglishClaims(engParas);
                    
                    // 청구항 시작 전 내용 먼저 출력 (국문 → 영문, 단락번호 유지)
                    korResult.preContent.forEach(line => addKorLine(line));
                    engResult.preContent.forEach(line => addEngLine(line));
                    
                    // 청구항 번호 목록 (모든 번호 수집 후 정렬)
                    const allClaimNums = new Set([
                        ...Object.keys(korResult.claims).map(Number),
                        ...Object.keys(engResult.claims).map(Number)
                    ]);
                    const sortedClaimNums = Array.from(allClaimNums).sort((a, b) => a - b);
                    
                    // 청구항 번호순으로 국문 → 영문 배치
                    for (const num of sortedClaimNums) {
                        if (korResult.claims[num]) {
                            korResult.claims[num].forEach(line => addKorLine(line));
                        }
                        if (engResult.claims[num]) {
                            engResult.claims[num].forEach(line => {
                                // 단락번호([XXXX])는 유지하고 영문청구항 번호(X.) 뒤에 탭 삽입
                                const paraNum = extractParaNum(line);
                                const cleaned = removeParaNum(line);
                                const formatted = cleaned.replace(/^(\d+\.)\s*/, '$1\t');
                                addEngLine(paraNum ? `[${paraNum}] ${formatted}` : formatted);
                            });
                        }
                    }
                    return;
                }
                
                // 영문에서 본문 단락만 추출 (부제 제외)
                const engContentParas = engParas.filter(line => isContentParagraph(line));
                
                // 단락번호 기반 매칭 준비
                const engByNum = new Map();
                const engNoNum = [];
                engContentParas.forEach(line => {
                    const num = extractParaNum(line);
                    if (num) {
                        if (!engByNum.has(num)) engByNum.set(num, []);
                        engByNum.get(num).push(line);
                    } else {
                        engNoNum.push(line);
                    }
                });
                
                let engNoNumIdx = 0;
                const usedEngNums = new Set();
                
                // 국문 라인을 순서대로 처리
                for (const korLine of korParas) {
                    // addKorLine이 한글 유무로 색상 자동 판별 (영문부제는 자동으로 영문 색상)
                    addKorLine(korLine);
                    
                    // 본문 단락이면 대응하는 영문 찾기
                    if (isContentParagraph(korLine)) {
                        const korNum = extractParaNum(korLine);
                        
                        if (korNum && engByNum.has(korNum) && !usedEngNums.has(korNum)) {
                            // 단락번호 기반 매칭 (영문 단락번호 유지)
                            const engLinesForNum = engByNum.get(korNum);
                            engLinesForNum.forEach(line => addEngLine(line));
                            usedEngNums.add(korNum);
                        } else if (!korNum && engNoNumIdx < engNoNum.length) {
                            // 단락번호 없는 경우 순서 매칭 (영문 단락번호 유지)
                            addEngLine(engNoNum[engNoNumIdx]);
                            engNoNumIdx++;
                        } else if (korNum) {
                            // 단락번호가 있지만 영문에 해당 번호가 없으면 순서 매칭 시도
                            if (engNoNumIdx < engNoNum.length) {
                                addEngLine(engNoNum[engNoNumIdx]);
                                engNoNumIdx++;
                            }
                        }
                    }
                }
                
                // 남은 영문 단락 출력 (매칭되지 않은 것들, 단락번호 유지)
                engByNum.forEach((lines, num) => {
                    if (!usedEngNums.has(num)) {
                        lines.forEach(line => addEngLine(line));
                    }
                });
                while (engNoNumIdx < engNoNum.length) {
                    addEngLine(engNoNum[engNoNumIdx]);
                    engNoNumIdx++;
                }
            }
            
            // 섹션 없는 앞부분 처리 (있는 경우)
            const korNoSection = korSections.find(s => !s.key);
            const engNoSection = engSections.find(s => !s.key);
            if (korNoSection || engNoSection) {
                mergeSectionContent(korNoSection, engNoSection, null);
            }
            
            // 사무소표준US 순서대로 섹션 병합
            const sectionOrder = ['title', 'crossref', 'background', 'summary', 'drawings', 'detailed', 'symbols', 'claims', 'abstract'];
            
            for (const sectionKey of sectionOrder) {
                const korSection = korSectionMap.get(sectionKey);
                const engSection = engSectionMap.get(sectionKey);
                
                if (!korSection && !engSection) continue;
                
                mergeSectionContent(korSection, engSection, sectionKey);
            }
            
            mergeResult = resultLines.join('\n');
            
            // 통계 업데이트 (단락 개수 기준)
            document.getElementById('mergeKorCount').textContent = korParaCount;
            document.getElementById('mergeEngCount').textContent = engParaCount;
            document.getElementById('mergeTotalCount').textContent = resultLines.length;
            document.getElementById('merge3StatsSection').classList.remove('hidden');
            
            // 결과 표시
            document.getElementById('mergeResult3').innerHTML = resultHtml;
            document.getElementById('merge3ResultSection').classList.remove('hidden');
            
            // 메시지
            if (mismatches.length > 0) {
                msg.textContent = `⚠️ 병합 완료! (부제 ${mismatches.length}개 불일치 - 부제표준화 권장)`;
                msg.className = 'message error';
            } else {
                msg.textContent = '✅ 병합 완료! (사무소표준US 기준, 부제 일치)';
                msg.className = 'message success';
            }
        }
        
        // escapeHtml은 utils.js에서 로드됨
        
        // 단락번호 제거 헬퍼 (출력용)
        function stripParaNumsFromText(text) {
            return text.split('\n').map(line =>
                line.replace(/^\[(\d{4,5})\]\s*/, '').replace(/^【(\d{4,5})】\s*/, '')
            ).join('\n');
        }

        // 결과 복사
        function copyMergeResult3() {
            const msg = document.getElementById('mergeMessage3');
            if (!mergeResult) {
                msg.textContent = '❌ 병합 결과가 없습니다.';
                msg.className = 'message error';
                return;
            }
            const stripNums = document.getElementById('stripParaNumsOption').checked;
            const text = stripNums ? stripParaNumsFromText(mergeResult) : mergeResult;
            navigator.clipboard.writeText(text).then(() => {
                msg.textContent = '✅ 한영혼합본이 클립보드에 복사되었습니다.' + (stripNums ? ' (단락번호 삭제됨)' : '');
                msg.className = 'message success';
                setTimeout(() => msg.classList.add('hidden'), 3000);
            }).catch(() => {
                msg.textContent = '❌ 복사에 실패했습니다.';
                msg.className = 'message error';
            });
        }
        
        // DOCX 다운로드 (국문 단락은 갈색 폰트, 영문 단락은 검정)
        async function downloadMergeDocx3() {
            const msg = document.getElementById('mergeMessage3');
            if (!mergeResult || mergeResultPairs.length === 0) {
                msg.textContent = '❌ 병합 결과가 없습니다.';
                msg.className = 'message error';
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
                
                // word/document.xml 생성 (mergeResultPairs 사용)
                const stripNums = document.getElementById('stripParaNumsOption').checked;
                let bodyContent = '';

                mergeResultPairs.forEach(item => {
                    // 단락번호 삭제 옵션 적용
                    const lineText = stripNums
                        ? item.text.replace(/^\[(\d{4,5})\]\s*/, '').replace(/^【(\d{4,5})】\s*/, '')
                        : item.text;
                    const trimmed = lineText.trim();

                    // 페이지 나누기 마커 처리
                    if (trimmed === '<pagebreak/>') {
                        bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
                        return;
                    }

                    // 빈 줄 처리
                    if (!trimmed) {
                        bodyContent += '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>';
                        return;
                    }

                    // 국문 단락 - 갈색(993300) 폰트 적용
                    if (item.type === 'kor') {
                        bodyContent += `<w:p><w:pPr><w:rPr><w:color w:val="993300"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="993300"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>${convertRunToDocxColor3(lineText, '993300')}</w:r></w:p>`;
                    } else {
                        // 영문 단락 - 기본 검정색
                        bodyContent += `<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>${convertRunToDocx3(lineText)}</w:r></w:p>`;
                    }
                });
                
                const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyContent}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;
                
                zip.file('word/document.xml', documentXml);
                
                const fileName = document.getElementById('mergeFileName3').value.trim() || '한영혼합본';
                const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                saveAs(blob, fileName + '.docx');

                msg.textContent = '✅ 한영혼합본 DOCX 파일이 다운로드되었습니다!';
                msg.className = 'message success';
                setTimeout(() => msg.classList.add('hidden'), 3000);
            } catch (error) {
                msg.textContent = '❌ 오류: ' + error.message;
                msg.className = 'message error';
            }
        }
        
        // 병합 결과 양식표준화
        function standardizeFormatMerge3() {
            const msg = document.getElementById('mergeMessage3');
            msg.classList.add('hidden');
            
            if (!mergeResult || mergeResultPairs.length === 0) {
                msg.textContent = '❌ 먼저 한영혼합본을 생성해주세요.';
                msg.className = 'message error';
                return;
            }
            
            const result = applyFormatStandardization(mergeResult);
            
            if (result.changeCount === 0) {
                msg.textContent = '❌ 적용할 양식 변경이 없습니다.';
                msg.className = 'message error';
                return;
            }
            
            // mergeResult 업데이트
            mergeResult = result.text;
            
            // mergeResultPairs 재생성
            const newLines = result.text.split('\n');
            const newPairs = [];
            let pairIdx = 0;
            
            for (const line of newLines) {
                const trimmed = line.trim();
                
                // 빈 줄이나 pagebreak 마커는 이전 타입을 유지하거나 기본값 사용
                if (!trimmed || trimmed === '<pagebreak/>') {
                    // 가장 최근의 타입 유지 또는 기본값
                    const lastType = newPairs.length > 0 ? newPairs[newPairs.length - 1].type : 'eng';
                    newPairs.push({ text: line, type: lastType });
                } else {
                    // 기존 mergeResultPairs에서 매칭되는 항목 찾기
                    let foundType = 'eng'; // 기본값
                    
                    // 한글이 포함되어 있으면 국문
                    if (/[가-힣]/.test(trimmed)) {
                        foundType = 'kor';
                    }
                    
                    newPairs.push({ text: line, type: foundType });
                }
            }
            
            mergeResultPairs = newPairs;
            
            // 미리보기 갱신
            updateMergePreview3();
            
            msg.textContent = `✅ 양식표준화 완료! (${result.changeCount}개 변경 적용)`;
            msg.className = 'message success';
            setTimeout(() => msg.classList.add('hidden'), 3000);
        }
        
        // 병합 결과 미리보기 갱신
        function updateMergePreview3() {
            let resultHtml = '';
            
            mergeResultPairs.forEach(item => {
                const trimmed = item.text.trim();
                
                // 페이지 나누기 마커
                if (trimmed === '<pagebreak/>') {
                    resultHtml += '<div style="border-top:2px dashed #999;margin:10px 0;text-align:center;color:#999;font-size:11px;">── 페이지 나누기 ──</div>';
                    return;
                }
                
                // 빈 줄
                if (!trimmed) {
                    resultHtml += '<br>';
                    return;
                }
                
                if (item.type === 'kor') {
                    resultHtml += `<div style="background:#e8f5e9;padding:8px 12px;margin:4px 0;border-radius:4px;border-left:3px solid #4caf50;">${escapeHtml(item.text)}</div>`;
                } else {
                    resultHtml += `<div style="background:#e3f2fd;padding:8px 12px;margin:4px 0;border-radius:4px;border-left:3px solid #2196f3;">${escapeHtml(item.text)}</div>`;
                }
            });
            
            document.getElementById('mergeResult3').innerHTML = resultHtml;
        }
        
        // 병합 탭 초기화
        function clearMerge3() {
            if (!confirm('모든 내용을 지우시겠습니까?')) return;
            document.getElementById('inputTextKor3').value = '';
            document.getElementById('inputTextEng3').value = '';
            document.getElementById('fileNameKor3').textContent = '국문명세서 .docx 파일을 선택하세요';
            document.getElementById('fileNameEng3').textContent = '영문명세서 .docx 파일을 선택하세요';
            document.getElementById('mergeFileName3').value = '';
            document.getElementById('mergeResult3').innerHTML = '한영혼합본이 여기에 표시됩니다';
            document.getElementById('merge3StatsSection').classList.add('hidden');
            document.getElementById('merge3ResultSection').classList.add('hidden');
            document.getElementById('merge3Message').classList.add('hidden');
            document.getElementById('mergeMessage3').classList.add('hidden');
            document.getElementById('stripParaNumsOption').checked = false;
            mergeKorParagraphs = [];
            mergeEngParagraphs = [];
            mergeResult = '';
            mergeResultPairs = [];
        }
        
