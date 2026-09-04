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
        
        // ── 우선권 모달 입력칸 이동 (자동 이동 + ←/→ 화살표 이동) ──────────
        // 연·월·일은 자릿수가 채워지면 다음 칸으로 자동 이동한다.
        // 월/일은 두 자리가 될 수 없는 첫 숫자(월 2~9, 일 4~9)를 입력한 경우에도 입력 완료로 본다.
        const priorityFieldComplete = {
            year: v => v.length === 4,
            month: v => v.length === 2 || /^[2-9]$/.test(v),
            day: v => v.length === 2 || /^[4-9]$/.test(v)
        };

        function setCaretToEnd(input) {
            const end = input.value.length;
            try { input.setSelectionRange(end, end); } catch (e) { /* 일부 입력 타입은 미지원 */ }
        }

        // ids: [연, 월, 일, 출원번호] 순서. 출원번호는 자동 이동 대상이 아니다.
        function setupPriorityFieldNav(ids) {
            const kinds = ['year', 'month', 'day'];
            const inputs = ids.map(id => document.getElementById(id));
            if (inputs.some(el => !el)) return;

            inputs.forEach((input, idx) => {
                const prev = inputs[idx - 1];
                const next = inputs[idx + 1];
                const isDone = priorityFieldComplete[kinds[idx]];

                // 자릿수가 채워지면 다음 칸으로 이동 (연 → 월 → 일 → 출원번호)
                if (isDone && next) {
                    input.addEventListener('input', () => {
                        const v = input.value.trim();
                        if (!/^\d+$/.test(v) || !isDone(v)) return;
                        next.focus();
                        next.select();
                    });
                }

                // 좌우 화살표로 칸 이동 (칸의 끝/처음에서만 이동하여 칸 안의 커서 이동은 유지)
                input.addEventListener('keydown', e => {
                    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
                    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
                    if (e.key === 'ArrowRight' && next && atEnd) {
                        e.preventDefault();
                        next.focus();
                        setCaretToEnd(next);
                    } else if (e.key === 'ArrowLeft' && prev && atStart) {
                        e.preventDefault();
                        prev.focus();
                        setCaretToEnd(prev);
                    } else if (e.key === 'Backspace' && prev && input.value === '') {
                        // 빈 칸에서 지우면 이전 칸으로 되돌아간다
                        e.preventDefault();
                        prev.focus();
                        setCaretToEnd(prev);
                    }
                });
            });
        }

        function initPriorityModalNav() {
            setupPriorityFieldNav(['modalYear1', 'modalMonth1', 'modalDay1', 'modalNumber1']);
            setupPriorityFieldNav(['modalYear2', 'modalMonth2', 'modalDay2', 'modalNumber2']);
        }
        // 모달 마크업이 스크립트 태그보다 뒤에 있으므로 DOM 로드 후 바인딩한다.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPriorityModalNav);
        } else {
            initPriorityModalNav();
        }

        function switchMainTab(tabId, btn) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');

            // 상단 탭 바와 플로팅 탭 바를 모두 tabId 기준으로 동기화 —
            // 클릭된 버튼(btn)이 어느 바에 있든 양쪽 선택 표시가 일치한다.
            // (data-tab이 없는 버튼이 있을 경우를 위해 클릭된 버튼은 직접 표시)
            document.querySelectorAll('.tab-btn, .floating-tab-btn').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === tabId);
            });
            if (btn) btn.classList.add('active');
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


        // ========== 기밀 표시 머리글 (Confidential Header) 공용 옵션 ==========
        // 각 탭의 DOCX 출력 구역에 있는 체크박스 상태를 읽는다 (기본값 uncheck = 미적용).
        // 실제 머리글 주입은 utils.js의 applyConfidentialHeaderToDocxZip()이 담당.
        function isConfidentialHeaderOn(checkboxId) {
            const el = document.getElementById(checkboxId);
            return !!(el && el.checked);
        }
