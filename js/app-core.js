/**
 * Document Tools - js/app-core.js
 * 공통 UI (탭 전환, 플로팅 탭 바, 우선권 모달, 단락 개수 계산)
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        let rawOutput1 = '';
        let fileAnalysisResult = {
            hasCrossRef: false,
            hasScript: false,
            hasParagraphNum: false,
            hasTable: false,
            suspicious: null // {mode:'line'|'para', items:[{label,count,occurrences}]} — 업로드 시 의심 문자 검사 결과
        };
        let priorityList1 = [];
        let priorityList2 = [];

        function openPriorityModal1() {
            document.getElementById('modalYear1').value = '';
            document.getElementById('modalMonth1').value = '';
            document.getElementById('modalDay1').value = '';
            document.getElementById('modalNumber1').value = '';
            document.getElementById('priorityModal1').classList.add('active');
            setTimeout(() => document.getElementById('modalYear1').focus(), 100);
        }
        function closePriorityModal1() {
            document.getElementById('priorityModal1').classList.remove('active');
        }
        function addPriority1() {
            const year = document.getElementById('modalYear1').value.trim();
            const month = document.getElementById('modalMonth1').value.trim();
            const day = document.getElementById('modalDay1').value.trim();
            const appNum = document.getElementById('modalNumber1').value.trim();
            if (!year || !month || !day || !appNum) {
                alert('모든 필드를 입력해주세요.');
                return;
            }
            priorityList1.push({ year, month, day, appNum });
            renderPriorityList1();
            closePriorityModal1();
        }
        function removePriority1(index) {
            priorityList1.splice(index, 1);
            renderPriorityList1();
        }
        function renderPriorityList1() {
            const container = document.getElementById('priorityList1');
            if (priorityList1.length === 0) {
                container.innerHTML = '<div class="priority-empty">추가된 우선권출원 정보가 없습니다.</div>';
                return;
            }
            container.innerHTML = priorityList1.map((p, i) => `
                <div class="priority-entry">
                    <span class="priority-entry-info">${p.year}년 ${p.month}월 ${p.day}일 · ${p.appNum}</span>
                    <button class="priority-entry-delete" onclick="removePriority1(${i})" title="삭제">✕</button>
                </div>
            `).join('');
        }

        function openPriorityModal2() {
            document.getElementById('modalYear2').value = '';
            document.getElementById('modalMonth2').value = '';
            document.getElementById('modalDay2').value = '';
            document.getElementById('modalNumber2').value = '';
            document.getElementById('priorityModal2').classList.add('active');
            setTimeout(() => document.getElementById('modalYear2').focus(), 100);
        }
        function closePriorityModal2() {
            document.getElementById('priorityModal2').classList.remove('active');
        }
        function addPriority2() {
            const year = document.getElementById('modalYear2').value.trim();
            const month = document.getElementById('modalMonth2').value.trim();
            const day = document.getElementById('modalDay2').value.trim();
            const appNum = document.getElementById('modalNumber2').value.trim();
            if (!year || !month || !day || !appNum) {
                alert('모든 필드를 입력해주세요.');
                return;
            }
            priorityList2.push({ year, month, day, appNum });
            renderPriorityList2();
            closePriorityModal2();
        }
        function removePriority2(index) {
            priorityList2.splice(index, 1);
            renderPriorityList2();
        }
        function renderPriorityList2() {
            const container = document.getElementById('priorityList2');
            if (priorityList2.length === 0) {
                container.innerHTML = '<div class="priority-empty">추가된 우선권출원 정보가 없습니다.</div>';
                return;
            }
            container.innerHTML = priorityList2.map((p, i) => `
                <div class="priority-entry">
                    <span class="priority-entry-info">${p.year}년 ${p.month}월 ${p.day}일 · ${p.appNum}</span>
                    <button class="priority-entry-delete" onclick="removePriority2(${i})" title="삭제">✕</button>
                </div>
            `).join('');
        }
        
        function switchMainTab(tabId, btn) {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            btn.classList.add('active');
            // 플로팅 탭 바 active 상태 동기화
            document.querySelectorAll('.floating-tab-btn').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === tabId);
            });
        }

        // 탭 바가 뷰포트 밖으로 나가면 플로팅 바 표시
        const _floatingNav = document.getElementById('floatingTabNav');
        const _tabNavEl = document.querySelector('.tab-nav');
        new IntersectionObserver(function(entries) {
            _floatingNav.classList.toggle('visible', !entries[0].isIntersecting);
        }, { threshold: 0 }).observe(_tabNavEl);

        // 단락 개수 계산 헬퍼 (단락번호 추가 기준과 동일한 규칙 적용)
        // 이미 [NNNN] 번호가 붙은 단락도 하나의 단락으로 센다(번호 유무와 무관한 실제 단락 개수).
        // isPatentSectionSubtitle, isClaimsStartLine, isCrossRefLine은 utils.js에서 로드됨
        function countParagraphsInText(text) {
            const lines = text.split('\n');
            const stopIdx = lines.findIndex(isClaimsStartLine);
            const crossIdx = lines.findIndex(isCrossRefLine);
            let count = 0, inTable = false;
            for (let i = 0; i < lines.length; i++) {
                const t = lines[i].trim();
                if (t.startsWith('<table')) inTable = true;
                if (t.endsWith('</table>')) { inTable = false; continue; }
                const stopped = (stopIdx >= 0 && i >= stopIdx) || (crossIdx >= 0 && i < crossIdx);
                // 기존 단락번호를 떼고 판별 → 번호가 있어도 같은 규칙으로 카운트
                const core = t.replace(/^\[\d{4,5}\]\s?/, '');
                if (!stopped && core && !isPatentSectionSubtitle(core) && !inTable && /[.。]["']?$/.test(core)) count++;
            }
            return count;
        }

