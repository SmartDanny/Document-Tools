# Document Tools (문서 도구 모음)

[![Version](https://img.shields.io/badge/version-1.7.0-blue.svg)](https://github.com/)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](https://github.com/)

특허 명세서 작성 및 편집을 위한 웹 기반 문서 처리 도구 모음입니다.

## 🚀 주요 기능

### 1. 전처리 단계 (DOCX / FIN → HTML · DOCX)
- DOCX 파일에서 첨자(아래첨자/위첨자), 표 자동 추출
- HTML 태그(`<sub>`, `<sup>`, `<table>`)로 변환
- Cross-reference 자동 삽입
- 단락번호 자동 부여
- **마침표 누락 단락 안내** (전처리·후처리·한영혼합본 탭의 모든 '단락번호 추가'에 공통 적용):
  단락번호는 마침표(.)로 끝나는 단락에만 부여되므로(부제목·표·수학식 제외 목적), 작성자가 마침표를
  빠뜨린 문장은 번호를 받지 못한다. '단락번호 추가' 실행 시 번호가 부여되지 않은 단락 중
  **완성된 문장으로 보이는 것**(국문 종결어미 `…한다/…있다`, 영문 문장 형태, 전각 마침표 `．`,
  마침표 뒤 괄호·따옴표 `…한다.)` 등)을 검출해 확신도(🔴 누락 가능성 높음 / 🟡 확인 권장)와 함께
  행 번호·발췌 목록으로 안내한다. 편집 가능한 탭(전처리 1단계 입력창, 후처리 입력창)에서는 목록 항목을
  클릭하면 해당 행으로 이동·선택된다. 검출 조건은 각 탭의 단락번호 부여 규칙과 동일하게 맞춘다
  (부제목 판별 기준, 한영혼합본은 국문 라인만 대상). 번호 부여 자체는 그대로 진행되며,
  마침표를 보완한 뒤 '단락번호 제거 → 추가'를 다시 실행하면 반영된다
- **`.fin`(KIPO 전자출원 파일) 지원**: `.fin`(zip → `.hlz` → KIPO KEAPS XML + 도면)을 분석해
  - **KIPO 출원서식 DOCX**로 변환 — 실제 KIPO 서식 역설계 반영: 명세서/청구범위/요약서/도면 4부(部) 구조(부 사이 페이지 나누기), 중앙 볼드 부 헤더, 국문 【】 부제, 제목 국문/영문 분리, `[NNNN]` 단락번호, **단락 양쪽맞춤**, **청구항 행마다 들여쓰기**, **페이지 하단 페이지 번호**, 도면 이미지 임베드 후 `[도 N]` 캡션, Malgun Gothic 10pt. 파일명: `<원본파일명>_출원명세서.docx`
  - **해외출원용 국문(ROPKS) DOCX**로 변환 — ROPKS 샘플 역설계 반영: 사무소표준US 부제(볼드+밑줄), 바탕체 12pt, 본문 첫줄 들여쓰기·**양쪽맞춤**, **줄번호(페이지마다 1부터, 도면 섹션 제외)**, **페이지당 20행(고정 행 높이)**, **페이지 하단 가운데 페이지 번호**, 지정 여백, 청구범위·요약서·도면(및 각 도면)의 **페이지 나누기**, 유니코드 첨자 자동 정규화. 파일명은 **해외관리번호** 입력에 따라 자동 지정 — `OPP20******US` 입력 시 국가코드 US를 떼고 `OPP20******ROPKS_(오늘6자리)`, 미입력 시 `ROPKS_(오늘6자리)`.docx. **KIPO 출원서식 DOCX와 ROPKS DOCX 생성 버튼은 1단계(업로드 단계)에 인접 배치**되어 업로드 직후 필요한 산출물을 곧바로 선택할 수 있다. Cross-reference는 번역용 국문 변환에 사용되는 것으로 ROPKS 생성의 전제 조건이 아니며, 2단계에서 삽입한 경우에 한해 1단계의 **[ROPKS DOCX에 Cross-reference 포함]** 체크박스로 포함 여부를 선택한다(삽입 직후 기본 포함)
  - 명세서 본문은 기존 HTML 변환 텍스트로도 함께 표시되어 부제표준화·단락번호 도구를 그대로 사용 가능

### 2. 후처리 단계 (HTML → DOCX)
- HTML 태그가 포함된 텍스트를 DOCX 파일로 변환
- 첨자, 표가 워드 서식으로 자동 렌더링
- 단락번호 추가/제거 + **마침표 누락 단락 안내**(위 1번 참조 — 입력창 행 이동 지원)

### 3. 국문/영문 추출/병합
- 한영 혼합 명세서에서 국문본/영문본 자동 분리 추출
- 국문 명세서와 영문 명세서 병합 기능
- PCT 부제 표준화 지원
- 영문본·국문본·한영혼합본의 단락번호 추가 시 **마침표 누락 단락 안내**(위 1번 참조 — 결과가 읽기 전용
  표시 영역이므로 행 번호·발췌만 표시. 한영혼합본은 번호 부여 대상인 국문 라인만 검사)

### 4. 문서 비교
- 두 문서 간 차이점 비교 (Diff)
- 추가/삭제/수정 내용 하이라이트 표시
- 비교 결과 DOCX 다운로드 — 수정본 서식을 유지하되 **단락 뒤 간격은 0pt**로 통일(문서 기본값의 Word 기본 8pt와 단락 직접 서식의 뒤 간격 모두 제거, 줄간격·단락 앞 간격·제목 등 개별 스타일 간격은 유지)
- **비교 및 US양식 다운로드**: 변경 내용(Track Changes)을 유지한 채 US 특허출원 양식(A4, Arial 12pt, 25행/페이지 고정 행 높이, 5행마다 줄번호, 페이지번호, SEQ 필드 단락번호, 청구항 들여쓰기)을 적용해 다운로드. 양식표준화가 자동 적용되고(멱등 — 이미 표준화된 문서에는 중복 적용되지 않음) 기존 `[0001]` 텍스트 단락번호는 SEQ 필드로 대체되며(양쪽 문서 공통 전처리라 변경추적에 표시되지 않음), 삽입/삭제 단락의 SEQ 번호도 개정(ins/del)으로 감싸 변경 수락·거부와 함께 정리됨

### 5. Markdown to PDF/docx
- 마크다운·HTML·LaTeX 수식 문서를 PDF 또는 DOCX(Word)로 변환
- 실시간 미리보기 지원 (용지 방향·글꼴 크기 조절)
- DOCX 저장: 미리보기 DOM을 순회해 제목/문단/목록/표/서식을 네이티브 OOXML로 생성하고, LaTeX 수식은 이미지로 임베드(모든 뷰어에서 동일하게 렌더링)

### 6. 양식표준화 — 청구항 레이아웃 (모든 탭 공통)
- **청구항 들여쓰기**: 청구항 머리 단락(영문 `1.` 로 시작)은 번호를 왼쪽 여백에 두고
  명시적 탭 정지점(**800 twips**)으로 본문 시작 위치를 잡고, **같은 청구항의 후속 단락은
  첫 줄만 같은 위치로 들여써** 문장 시작을 정렬한다. 접힌 줄은 양쪽 모두 왼쪽 여백으로
  돌아간다(내어쓰기가 아니라 첫 줄 들여쓰기). 탭 정지점을 명시하므로 `defaultTabStop`
  설정이나 번호 자릿수(`1.` / `10.` / `100.`)와 무관하게 항상 같은 자리에 정렬된다
- **청구항 사이에만 빈 줄**: 빈 줄은 청구항과 청구항 사이에 한 줄만 두고 **동일 청구항
  내부에는 넣지 않는다**. 종전에는 마침표로 끝나는 단락마다 빈 줄을 넣어, 마침표로 끝나는
  청구항 내부 단락에서 같은 청구항이 둘로 갈라져 보였다. 이미 들어가 있던 청구항 내부
  빈 줄도 함께 정리된다
- **국문 라인 제외**: 한글이 포함된 라인은 번호 뒤 탭 삽입 대상이 아니므로 들여쓰기와
  빈 줄 정리에서도 제외된다(한영혼합본의 라인 짝 구조 보존)
- 텍스트 양식표준화는 **텍스트를 들여쓰기로 오염시키지 않는다** — 들여쓰기는 DOCX 생성
  단계에서만 적용되고, 텍스트에는 빈 줄 정리만 반영된다
- 적용 대상: 탭2 US양식 다운로드, 탭3 영문본 US양식 다운로드, 탭4 DOCX 양식표준화 및
  비교 US양식 다운로드. 탭4는 원본과 수정본 양쪽에 동일하게 적용되므로 **변경추적에
  잡히지 않는다**
- `w:pPr`의 자식 요소는 스키마 순서(`tabs` → `spacing` → `ind`)를 지킨다. 순서를 어기면
  Word가 문서를 열지 못하고 빈 문서로 표시되므로, 생성 함수와 테스트로 순서를 강제한다

### 7. 기밀 표시 머리글 (모든 탭 공통)
- 모든 DOCX 출력 구역에 **[🔒 기밀 머리글 추가]** 체크박스 제공 (**기본값은 미적용**)
- 체크 시 `Confidential and Privileged/ Attorney-Client Work Product` 문구가
  **Tahoma 9pt, 진한 빨강(C00000), 오른쪽 정렬**로 **첫 페이지를 포함한 전 페이지** 머리글에 삽입됨
- 적용 대상: 탭1 KIPO 출원서식/ROPKS, 탭2 워드파일/US양식, 탭3 영문본/국문본/한영혼합본/병합결과,
  탭4 텍스트 비교/DOCX 비교/비교 US양식, 탭5 DOCX 저장
- 비어 있던 머리글은 덧붙이지 않고 대체하는 방식이라 **US양식의 25행/페이지가 그대로 유지**됨
- 머리글 단락에는 `keepNext`/`keepLines`/`pageBreakBefore`/`suppressLineNumbers`를 쓰지 않아
  **Word가 왼쪽 여백에 찍는 단락 서식 표시자(검은 사각형)가 생기지 않음**
  (줄번호는 본문에만 매겨지므로 머리글에 `suppressLineNumbers`는 불필요)
- 탭4 DOCX 비교는 수정본(B)의 패키지를 재사용하므로, **기존 머리글이 있으면 그 내용을 보존한 채
  맨 앞에 문구만 덧붙임**. 같은 문서에 두 번 적용해도 문구가 중복되지 않음(멱등)

## 📦 설치 및 사용법

### 방법 1: 직접 실행
1. 저장소를 클론하거나 파일을 다운로드합니다.
2. 폴더 구조를 유지한 채 저장합니다.
3. `index.html`을 웹 브라우저로 엽니다.

```bash
git clone https://github.com/[username]/document-tools.git
cd document-tools
# index.html을 브라우저로 열기
```

### 방법 2: 웹 서버 사용
```bash
# Python 간이 서버
python -m http.server 8000

# 브라우저에서 http://localhost:8000/index.html 접속
```

## 📁 파일 구조

```
document-tools/
├── index.html               # 메인 HTML (UI 마크업 + 스크립트 로드)
├── styles.css               # 스타일시트
├── utils.js                 # 공통 유틸리티 (이스케이프, diff, DOCX 파싱/판별, US양식·기밀 머리글 부품)
├── js/
│   ├── app-core.js          # 공통 UI (탭 전환, 플로팅 탭 바, 우선권 모달, 기밀 머리글 옵션)
│   ├── tab1-preprocess.js   # 탭1: 전처리 (DOCX/FIN → HTML·DOCX)
│   ├── fin-parser.js        # .fin(KIPO 전자출원) 파싱 → IR(중간모델)
│   ├── fin-docx.js          # IR → KIPO 출원서식 / 해외출원용 국문(ROPKS) DOCX
│   ├── tab2-postprocess.js  # 탭2: 후처리 (HTML → DOCX)
│   ├── tab3-bilingual.js    # 탭3: 한영혼합본 추출/색변환/DOCX 생성
│   ├── tab3-merge.js        # 탭3: 한영혼합본 병합
│   ├── tab4-compare.js      # 탭4: 문서 비교 (텍스트/DOCX Track-Changes)
│   ├── tab5-mdpdf.js        # 탭5: Markdown to PDF/docx
│   └── stat-nav.js          # 첨자/표 통계 카드 내비게이션 (공용)
├── generate_template.js     # US 특허 템플릿 생성 스크립트 (Node.js)
├── US_patent_template.docx  # 생성된 US 특허 템플릿
└── README.md                # 이 파일
```

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Libraries** (CDN 로드):
  - [JSZip](https://stuk.github.io/jszip/) - DOCX 파일 처리
  - [FileSaver.js](https://github.com/eligrey/FileSaver.js/) - 파일 다운로드
  - [marked.js](https://marked.js.org/) - Markdown 파싱
  - [KaTeX](https://katex.org/) - 수식 렌더링 (Markdown 미리보기)
  - [MathJax](https://www.mathjax.org/) - DOCX 저장 시 수식 SVG 생성 (필요 시 지연 로드)
- **PDF 변환**: 브라우저 인쇄 기능(`window.print`)의 "PDF로 저장" 사용
- **DOCX 변환**: JSZip으로 OOXML 패키지를 직접 조립, 수식은 MathJax SVG → 고DPI PNG로 임베드

## 💻 시스템 요구사항

- 모던 웹 브라우저 (Chrome, Firefox, Edge, Safari)
- JavaScript 활성화 필요
- 인터넷 연결 (CDN 라이브러리 로드용)

## 📋 지원 파일 형식

| 입력 | 출력 |
|-----|------|
| .docx | .docx |
| .fin | .docx (KIPO 출원서식 / ROPKS), HTML |
| .txt | .pdf |
| .md | |

## 🧪 테스트

```bash
npm test               # 유닛 테스트 (utils.js 순수 함수, 외부 의존성 없음)
npm run test:browser   # 브라우저 E2E (Playwright + Chromium)
```

- **유닛 테스트** (`test/unit.test.js`): 이스케이프, diff 알고리즘, 특허 문서
  판별, DOCX 스타일 생성 등 utils.js의 순수 함수를 Node 내장 `node:test`로 검증.
- **브라우저 E2E** (`test/browser-test.js`): 실제 페이지를 로드해 DOCX
  파싱/생성(단락 뒤 0pt 포함), 파일 드롭, 탭 전환 등 주요 흐름을 검증.
  최초 1회 `npm install` 후 `npx playwright install chromium`이 필요할 수
  있습니다 (JSZip CDN은 로컬 사본으로 대체되므로 오프라인에서도 동작).

## 🔖 버전 관리

버전의 원본은 `package.json`이며, 아래 명령 한 번으로 프로젝트 전체의 버전 표기
(index.html 주석·meta 태그, utils.js/styles.css 헤더, README 배지·문의란)와
Last Updated 날짜가 동기화되고 git 커밋 + 태그까지 생성됩니다:

```bash
npm version patch   # 1.3.0 → 1.3.1 (버그 수정 등 작은 변경)
npm version minor   # 1.3.0 → 1.4.0 (기능 추가)
npm version major   # 1.3.0 → 2.0.0 (호환성이 깨지는 변경)
```

- 버전 올리기 없이 표기만 다시 맞추려면: `npm run sync-version`
- 대상 파일의 버전 표기 형식이 바뀌어 패턴을 찾지 못하면 커밋/태그 생성 전에
  중단됩니다. 이때 `git checkout package.json`으로 되돌린 뒤
  `scripts/sync-version.js`의 치환 규칙을 수정하고 다시 실행하세요.

## 🔒 개인정보 보호

- 모든 파일 처리는 **브라우저 내에서 로컬로** 수행됩니다.
- 서버로 파일이 전송되지 않습니다.
- 업로드된 파일은 브라우저 메모리에서만 처리됩니다.

## 📄 라이선스

Copyright (c) 2026 Smart Danny. All rights reserved.

이 소프트웨어는 저작권법의 보호를 받습니다.
무단 복제, 배포, 수정을 금지합니다.

## 📞 문의

- **Author**: Smart Danny
- **Version**: 1.7.0
- **Last Updated**: 2026-09-04
