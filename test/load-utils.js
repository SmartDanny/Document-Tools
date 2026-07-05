/**
 * utils.js를 Node 환경에서 로드하기 위한 헬퍼
 * (utils.js는 브라우저용 클래식 스크립트이므로 vm 컨텍스트에서 실행해 함수를 추출)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf-8');
const sandbox = { console, setTimeout };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// function 선언은 컨텍스트 전역 객체의 속성으로 노출됨
module.exports = sandbox;
