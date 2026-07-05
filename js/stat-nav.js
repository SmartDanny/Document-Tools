/**
 * Document Tools - js/stat-nav.js
 * 첨자/표 통계 카드 내비게이션 (탭1/2/3 공용)
 *
 * Copyright (c) 2026 Smart Danny. All rights reserved.
 */

        // ===== 첨자/표 통계 카드 내비게이션 =====
        const statElemNavState = {};

        const statNavConfig = {
            'tab1': {
                textBox: { id: 'output1', type: 'div' },
                preview: { id: 'preview1', type: 'div' },
                indicators: { sub: 'subNavIndicator1', sup: 'supNavIndicator1', table: 'tableNavIndicator1' }
            },
            'tab2': {
                textBox: { id: 'htmlInput2', type: 'textarea' },
                preview: { id: 'preview2', type: 'div' },
                indicators: { sub: 'subNavIndicator2', sup: 'supNavIndicator2', table: 'tableNavIndicator2' }
            },
            'tab3_eng': {
                textBox: { id: 'englishResult3', type: 'div' },
                preview: { id: 'englishRender3', type: 'div' },
                indicators: { sub: 'engSubNavIndicator3', sup: 'engSupNavIndicator3', table: 'engTableNavIndicator3' }
            },
            'tab3_kor': {
                textBox: { id: 'koreanResult3', type: 'div' },
                preview: { id: 'koreanRender3', type: 'div' },
                indicators: { sub: 'korSubNavIndicator3', sup: 'korSupNavIndicator3', table: 'korTableNavIndicator3' }
            },
            'tab3_color_kr': {
                textBox: null,
                preview: { id: 'colorPreview3', type: 'div', filterType: 'korean' },
                indicators: { sub: 'colorKrSubNavIndicator3', sup: 'colorKrSupNavIndicator3', table: 'colorKrTableNavIndicator3' }
            },
            'tab3_color_en': {
                textBox: null,
                preview: { id: 'colorPreview3', type: 'div', filterType: 'english' },
                indicators: { sub: 'colorEnSubNavIndicator3', sup: 'colorEnSupNavIndicator3', table: 'colorEnTableNavIndicator3' }
            }
        };

        function navigateStatElem(section, elemType) {
            const config = statNavConfig[section];
            if (!config) return;

            const stateKey = `${section}_${elemType}`;
            if (statElemNavState[stateKey] === undefined) statElemNavState[stateKey] = 0;

            // 기존 하이라이트 제거
            document.querySelectorAll('.elem-nav-active').forEach(el => el.classList.remove('elem-nav-active'));

            // ---- 원본 텍스트 창 (div) 요소 수집 ----
            let textBoxElems = [];
            if (config.textBox && config.textBox.type === 'div') {
                const textBox = document.getElementById(config.textBox.id);
                if (textBox) {
                    const tagClass = elemType === 'sub' ? 'span.sub-tag'
                                   : elemType === 'sup' ? 'span.sup-tag'
                                   : 'span.table-tag';
                    // 여는 태그 span만 선택 (닫는 태그 /sub /sup /table 제외)
                    textBoxElems = [...textBox.querySelectorAll(tagClass)].filter(el =>
                        !el.textContent.includes('/'));
                }
            }

            // ---- 렌더링 미리보기 창 요소 수집 ----
            let previewElems = [];
            if (config.preview) {
                const preview = document.getElementById(config.preview.id);
                if (preview) {
                    const selector = elemType === 'sub' ? 'sub'
                                   : elemType === 'sup' ? 'sup'
                                   : 'table';
                    let elems = [...preview.querySelectorAll(selector)];
                    // filterType이 지정된 경우 해당 줄 타입만 선택
                    if (config.preview.filterType) {
                        elems = elems.filter(el => {
                            const lineDiv = el.closest('[data-line-type]');
                            return lineDiv && lineDiv.dataset.lineType === config.preview.filterType;
                        });
                    }
                    previewElems = elems;
                }
            }

            const totalCount = Math.max(textBoxElems.length, previewElems.length);
            if (totalCount === 0) return;

            const currentIdx = statElemNavState[stateKey] % totalCount;
            statElemNavState[stateKey] = currentIdx + 1;

            // 원본 텍스트 창 (div) 스크롤 및 하이라이트
            if (textBoxElems[currentIdx]) {
                const el = textBoxElems[currentIdx];
                el.classList.add('elem-nav-active');
                scrollContainerToElem(config.textBox.id, el);
            }

            // 원본 텍스트 창 (textarea) 선택 및 스크롤
            if (config.textBox && config.textBox.type === 'textarea') {
                const textarea = document.getElementById(config.textBox.id);
                if (textarea) {
                    const text = textarea.value;
                    const pattern = elemType === 'sub' ? /<sub>/gi
                                  : elemType === 'sup' ? /<sup>/gi
                                  : /<table/gi;
                    const matches = [...text.matchAll(pattern)];
                    if (matches[currentIdx]) {
                        const matchPos = matches[currentIdx].index;
                        const matchEnd = matchPos + matches[currentIdx][0].length;
                        textarea.focus();
                        textarea.setSelectionRange(matchPos, matchEnd);
                        const linesBefore = text.substring(0, matchPos).split('\n').length - 1;
                        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 21;
                        textarea.scrollTop = Math.max(0, linesBefore * lineHeight - textarea.clientHeight / 2);
                    }
                }
            }

            // 렌더링 미리보기 스크롤 및 하이라이트
            if (previewElems[currentIdx]) {
                const el = previewElems[currentIdx];
                el.classList.add('elem-nav-active');
                scrollContainerToElem(config.preview.id, el);
            }

            // 인디케이터 업데이트
            const indicatorId = config.indicators[elemType];
            const indicator = document.getElementById(indicatorId);
            if (indicator) indicator.textContent = `${currentIdx + 1} / ${totalCount}`;
        }

        function scrollContainerToElem(containerId, el) {
            const container = document.getElementById(containerId);
            if (!container || !el) return;
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const scrollTo = container.scrollTop + (elRect.top - containerRect.top) - container.clientHeight / 2 + el.clientHeight / 2;
            container.scrollTop = Math.max(0, scrollTo);
        }

        function resetStatNavState(section) {
            // section으로 시작하는 모든 상태 키 삭제
            Object.keys(statElemNavState)
                .filter(k => k.startsWith(section))
                .forEach(k => { delete statElemNavState[k]; });
            // section으로 시작하는 모든 config 항목의 인디케이터 초기화
            Object.keys(statNavConfig)
                .filter(k => k.startsWith(section))
                .forEach(configKey => {
                    const cfg = statNavConfig[configKey];
                    if (cfg && cfg.indicators) {
                        Object.values(cfg.indicators).forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.textContent = '';
                        });
                    }
                });
            document.querySelectorAll('.elem-nav-active').forEach(el => el.classList.remove('elem-nav-active'));
        }
