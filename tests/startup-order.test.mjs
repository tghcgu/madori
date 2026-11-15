import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// 起動の順番（TDZ）: main.ts は上から順に実行されるので、トップレベルの文（let state = loadInitialState() など）が呼ぶ関数が、
// その文より後ろで宣言した const / let を読むと「宣言の前に読んだ」で止まる。保存データを読む所で起きると、
// 名前を付けた階・間取りや取り込んだ画像のある保存データが、開き直したときに読み込めなくなる（2026-10-21〜11-15 に起きていた）。
// トップレベルの文ごとに、その場で呼ぶ関数を（呼ぶ先までたどって）調べ、後ろで宣言した変数を読んでいないかを見る。
// 関数の名前を書いただけ（オブジェクトに入れる・イベントに登録する）は、その場では呼ばないので数えない
const file = 'src/main.ts';
const text = await readFile(file, 'utf8');
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const lineOf = pos => source.getLineAndCharacterOfPosition(pos).line + 1;

const functions = new Map();
const variables = new Map();
for (const statement of source.statements) {
  if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement.body);
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    const names = [];
    const collect = name => {
      if (ts.isIdentifier(name)) names.push(name.text);
      else name.elements?.forEach(element => element.name && collect(element.name));
    };
    collect(declaration.name);
    for (const name of names) {
      variables.set(name, statement.getStart());
      const value = declaration.initializer;
      if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) functions.set(name, value.body);
    }
  }
}

const isFunctionLike = node => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)
  || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isConstructorDeclaration(node);

// 変数として読む名前か（a.b の b・{ b: … } の b・型の名前は除く）
function isRead(identifier) {
  const parent = identifier.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) && parent.name === identifier) return false;
  if (ts.isTypeReferenceNode(parent) || ts.isQualifiedName(parent) || ts.isTypeQueryNode(parent)) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === identifier) return false;
  if (ts.isParameter(parent) && parent.name === identifier) return false;
  return true;
}

// その場で実行される部分（中の関数の中身は、呼ばれるまで実行されない）で読む名前と、呼ぶ関数
function scan(node) {
  const reads = new Set(), calls = new Set();
  const visit = current => {
    if (current !== node && isFunctionLike(current)) return;
    if (ts.isTypeNode(current)) return;
    if (ts.isIdentifier(current) && isRead(current)) reads.add(current.text);
    // 呼び出し（f()・new F()）と、呼び出しに渡す関数（list.map(f)）は、その場で呼ぶとみなす
    if ((ts.isCallExpression(current) || ts.isNewExpression(current)) && current.expression) {
      if (ts.isIdentifier(current.expression)) calls.add(current.expression.text);
      current.arguments?.forEach(argument => { if (ts.isIdentifier(argument)) calls.add(argument.text); });
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return { reads, calls };
}

// 関数を呼んだときに読む変数。中の関数（コールバック）も、すぐ呼ばれることがあるので中身まで数える（多めに見る）
const readsByFunction = new Map();
function readsOfCall(name, seen = new Set()) {
  if (readsByFunction.has(name)) return readsByFunction.get(name);
  if (seen.has(name) || !functions.get(name)) return new Set();
  seen.add(name);
  const reads = new Set();
  const visit = current => {
    if (ts.isIdentifier(current) && isRead(current)) {
      reads.add(current.text);
      if (functions.has(current.text)) readsOfCall(current.text, seen).forEach(item => reads.add(item));
    }
    ts.forEachChild(current, visit);
  };
  visit(functions.get(name));
  readsByFunction.set(name, reads);
  return reads;
}

test('top-level code in main.ts never reads a const or let declared further down (TDZ)', () => {
  const problems = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isImportDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
      || ts.isInterfaceDeclaration(statement) || ts.isClassDeclaration(statement)) continue;
    const start = statement.getStart();
    const { reads, calls } = scan(statement);
    const all = new Set([...reads].filter(name => !functions.has(name)));
    for (const name of calls) readsOfCall(name).forEach(item => all.add(item));
    for (const name of all) {
      const declared = variables.get(name);
      if (declared !== undefined && declared > start) problems.push(`line ${lineOf(start)} reads ${name} (declared on line ${lineOf(declared)})`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the checker finds a read before the declaration', () => {
  // 見張りが働いていることの確かめ: 保存データを読む所は、名前の長さの上限を使う
  assert.ok(readsOfCall('loadInitialState').has('MAX_FLOOR_LABEL'), 'loading a plan reads the floor name limit');
  assert.ok(readsOfCall('loadInitialState').has('IMAGE_DATA_URL'), 'loading a plan reads the image check');
  assert.ok(variables.get('MAX_FLOOR_LABEL') < variables.get('state'), 'the limit is declared before the plan is loaded');
});
