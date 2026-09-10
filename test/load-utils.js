/**
 * utils.js를 Node 환경에서 로드하기 위한 헬퍼
 * (utils.js는 브라우저용 클래식 스크립트이므로 vm 컨텍스트에서 실행해 함수를 추출)
 *
 * js/fin-parser.js도 같은 컨텍스트에 올린다. DOMParser와 JSZip은 함수 본문에서만 쓰이므로
 * 로드 자체는 Node에서도 되고, 브라우저 의존이 없는 순수 함수(매니페스트 파싱 등)를 테스트할 수 있다.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console, setTimeout, TextDecoder };
vm.createContext(sandbox);
for (const rel of ['utils.js', path.join('js', 'fin-parser.js')]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf-8'), sandbox);
}

// function 선언은 컨텍스트 전역 객체의 속성으로 노출됨
module.exports = sandbox;
