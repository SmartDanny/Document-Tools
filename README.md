# Document Tools (문서 도구 모음)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](https://github.com/)

특허 명세서 작성 및 편집을 위한 웹 기반 문서 처리 도구 모음입니다.

## 🚀 주요 기능

### 1. 전처리 단계 (DOCX → HTML)
- DOCX 파일에서 첨자(아래첨자/위첨자), 표 자동 추출
- HTML 태그(`<sub>`, `<sup>`, `<table>`)로 변환
- Cross-reference 자동 삽입
- 단락번호 자동 부여

### 2. 후처리 단계 (HTML → DOCX)
- HTML 태그가 포함된 텍스트를 DOCX 파일로 변환
- 첨자, 표가 워드 서식으로 자동 렌더링

### 3. 국문/영문 추출/병합
- 한영 혼합 명세서에서 국문본/영문본 자동 분리 추출
- 국문 명세서와 영문 명세서 병합 기능
- PCT 부제 표준화 지원

### 4. 문서 비교
- 두 문서 간 차이점 비교 (Diff)
- 추가/삭제/수정 내용 하이라이트 표시
- 비교 결과 DOCX 다운로드

### 5. Markdown to PDF
- 마크다운 문서를 PDF로 변환
- 실시간 미리보기 지원

## 📦 설치 및 사용법

### 방법 1: 직접 실행
1. 저장소를 클론하거나 파일을 다운로드합니다.
2. 세 파일을 같은 폴더에 저장합니다.
3. `document_tools.html`을 웹 브라우저로 엽니다.

```bash
git clone https://github.com/[username]/document-tools.git
cd document-tools
# document_tools.html을 브라우저로 열기
```

### 방법 2: 웹 서버 사용
```bash
# Python 간이 서버
python -m http.server 8000

# 브라우저에서 http://localhost:8000/document_tools.html 접속
```

## 📁 파일 구조

```
document-tools/
├── document_tools.html   # 메인 HTML 파일
├── styles.css            # 스타일시트
├── utils.js              # 공통 유틸리티 함수
└── README.md             # 이 파일
```

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Libraries**:
  - [JSZip](https://stuk.github.io/jszip/) - DOCX 파일 처리
  - [FileSaver.js](https://github.com/eligrey/FileSaver.js/) - 파일 다운로드
  - [marked.js](https://marked.js.org/) - Markdown 파싱
  - [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) - PDF 생성

## 💻 시스템 요구사항

- 모던 웹 브라우저 (Chrome, Firefox, Edge, Safari)
- JavaScript 활성화 필요
- 인터넷 연결 (CDN 라이브러리 로드용)

## 📋 지원 파일 형식

| 입력 | 출력 |
|-----|------|
| .docx | .docx |
| .txt | .pdf |
| .md | |

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
- **Version**: 1.0.0
- **Last Updated**: 2026-01-08
