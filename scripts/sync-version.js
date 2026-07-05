/**
 * Document Tools - scripts/sync-version.js
 * package.json의 version을 원본으로 삼아 프로젝트 전체의 버전 표기를 동기화
 *
 * 사용법:
 *   npm version patch|minor|major   → 버전 증가 + 전 파일 동기화 + 커밋 + 태그 (권장)
 *   node scripts/sync-version.js    → 현재 package.json 버전으로 동기화만 수행
 *
 * 갱신 대상:
 *   - index.html : 헤더 주석 Version/Last Updated, <meta name="version">
 *   - utils.js   : 헤더 주석 Version/Last Updated
 *   - styles.css : 헤더 주석 Version/Last Updated
 *   - README.md  : 버전 배지, 문의 섹션 Version/Last Updated
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

// 로컬 기준 오늘 날짜 (YYYY-MM-DD)
const now = new Date();
const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
].join('-');

// 파일별 치환 규칙: [정규식, 치환 문자열]
const targets = {
    'index.html': [
        [/^( \* Version: )\d+\.\d+\.\d+$/m, `$1${version}`],
        [/^( \* Last Updated: )\d{4}-\d{2}-\d{2}$/m, `$1${today}`],
        [/(<meta name="version" content=")\d+\.\d+\.\d+(">)/, `$1${version}$2`],
    ],
    'utils.js': [
        [/^( \* Version: )\d+\.\d+\.\d+$/m, `$1${version}`],
        [/^( \* Last Updated: )\d{4}-\d{2}-\d{2}$/m, `$1${today}`],
    ],
    'styles.css': [
        [/^( \* Version: )\d+\.\d+\.\d+$/m, `$1${version}`],
        [/^( \* Last Updated: )\d{4}-\d{2}-\d{2}$/m, `$1${today}`],
    ],
    'README.md': [
        [/(badge\/version-)\d+\.\d+\.\d+(-blue\.svg)/, `$1${version}$2`],
        [/^(- \*\*Version\*\*: )\d+\.\d+\.\d+$/m, `$1${version}`],
        [/^(- \*\*Last Updated\*\*: )\d{4}-\d{2}-\d{2}$/m, `$1${today}`],
    ],
};

let failures = 0;

for (const [file, rules] of Object.entries(targets)) {
    const filePath = path.join(ROOT, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    for (const [pattern, replacement] of rules) {
        if (!pattern.test(content)) {
            console.error(`❌ ${file}: 패턴을 찾지 못했습니다 → ${pattern}`);
            failures++;
            continue;
        }
        const updated = content.replace(pattern, replacement);
        if (updated !== content) {
            content = updated;
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ ${file} 동기화 완료`);
    } else {
        console.log(`— ${file} 변경 없음 (이미 최신)`);
    }
}

if (failures > 0) {
    console.error(`\n동기화 실패: 패턴 불일치 ${failures}건. 대상 파일의 버전 표기 형식이 바뀌었는지 확인하세요.`);
    process.exit(1);
}

console.log(`\n버전 ${version} / 날짜 ${today} 동기화 완료`);
