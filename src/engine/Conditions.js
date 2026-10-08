// Tiny safe expression evaluator for script/map "condition" strings (ARCHITECTURE §5.3).
// Tokenizer + recursive-descent parser; no eval/Function. Pure module (no Phaser).
//
// Grammar (lowest to highest precedence):
//   or    := and ('||' and)*
//   and   := eq ('&&' eq)*
//   eq    := cmp (('==' | '!=') cmp)*
//   cmp   := add (('<' | '<=' | '>' | '>=') add)*
//   add   := unary (('+' | '-') unary)*
//   unary := ('!' | '-') unary | primary
//   primary := number | 'string' | true | false | null | '(' or ')' | path [ '(' args ')' ]
//   path  := ident ('.' ident)*
//
// Identifiers resolve against a context object (see `contextFor`): `flags.x`, `vars.x`, `money`,
// `party.has('ryan')`, `party.size`, `inventory.has('x')`, `inventory.count('x')`, `level('lucky')`.

const TOKEN_RE = /\s*(?:(\d+(?:\.\d+)?)|('(?:[^'\\]|\\.)*')|(==|!=|<=|>=|&&|\|\||[()!<>+\-.,])|([A-Za-z_][A-Za-z0-9_]*))/y;

/**
 * @typedef {{type: 'num'|'str'|'op'|'id', value: string|number}} Token
 */

/**
 * Split an expression into tokens.
 * @param {string} src
 * @returns {Token[]}
 */
export function tokenize(src) {
  const tokens = [];
  let pos = 0;
  while (pos < src.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new SyntaxError(`Condition: unexpected character at ${pos} in "${src}"`);
    }
    if (m[1] !== undefined) tokens.push({ type: 'num', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'str', value: m[2].slice(1, -1).replace(/\\(.)/g, '$1') });
    else if (m[3] !== undefined) tokens.push({ type: 'op', value: m[3] });
    else tokens.push({ type: 'id', value: m[4] });
    pos = TOKEN_RE.lastIndex;
  }
  return tokens;
}

/** AST node shapes: {op, left, right} | {op:'!'|'neg', arg} | {lit} | {path, args?} */
class Parser {
  /** @param {Token[]} tokens */
  constructor(tokens) {
    this.t = tokens;
    this.i = 0;
  }

  peek() { return this.t[this.i]; }

  isOp(v) { const tk = this.peek(); return tk && tk.type === 'op' && tk.value === v; }

  expect(v) {
    if (!this.isOp(v)) throw new SyntaxError(`Condition: expected "${v}"`);
    this.i++;
  }

  parse() {
    const node = this.or();
    if (this.i < this.t.length) throw new SyntaxError('Condition: trailing tokens');
    return node;
  }

  or() {
    let left = this.and();
    while (this.isOp('||')) { this.i++; left = { op: '||', left, right: this.and() }; }
    return left;
  }

  and() {
    let left = this.eq();
    while (this.isOp('&&')) { this.i++; left = { op: '&&', left, right: this.eq() }; }
    return left;
  }

  eq() {
    let left = this.cmp();
    while (this.isOp('==') || this.isOp('!=')) {
      const op = this.peek().value; this.i++;
      left = { op, left, right: this.cmp() };
    }
    return left;
  }

  cmp() {
    let left = this.add();
    while (this.isOp('<') || this.isOp('<=') || this.isOp('>') || this.isOp('>=')) {
      const op = this.peek().value; this.i++;
      left = { op, left, right: this.add() };
    }
    return left;
  }

  add() {
    let left = this.unary();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.peek().value; this.i++;
      left = { op, left, right: this.unary() };
    }
    return left;
  }

  unary() {
    if (this.isOp('!')) { this.i++; return { op: '!', arg: this.unary() }; }
    if (this.isOp('-')) { this.i++; return { op: 'neg', arg: this.unary() }; }
    return this.primary();
  }

  primary() {
    const tk = this.peek();
    if (!tk) throw new SyntaxError('Condition: unexpected end of expression');
    if (tk.type === 'num' || tk.type === 'str') { this.i++; return { lit: tk.value }; }
    if (tk.type === 'op' && tk.value === '(') {
      this.i++;
      const node = this.or();
      this.expect(')');
      return node;
    }
    if (tk.type === 'id') {
      this.i++;
      if (tk.value === 'true') return { lit: true };
      if (tk.value === 'false') return { lit: false };
      if (tk.value === 'null') return { lit: null };
      const path = [tk.value];
      while (this.isOp('.')) {
        this.i++;
        const id = this.peek();
        if (!id || id.type !== 'id') throw new SyntaxError('Condition: expected identifier after "."');
        path.push(id.value); this.i++;
      }
      let args = null;
      if (this.isOp('(')) {
        this.i++;
        args = [];
        if (!this.isOp(')')) {
          args.push(this.or());
          while (this.isOp(',')) { this.i++; args.push(this.or()); }
        }
        this.expect(')');
      }
      return { path, args };
    }
    throw new SyntaxError(`Condition: unexpected token "${tk.value}"`);
  }
}

/** Parse an expression string into an AST (cached). */
const cache = new Map();
export function parse(src) {
  let ast = cache.get(src);
  if (!ast) {
    ast = new Parser(tokenize(src)).parse();
    cache.set(src, ast);
  }
  return ast;
}

/**
 * Walk a dotted path on a context, calling the final function value with args if present.
 * Missing segments resolve to undefined (so `!flags.unset` is true).
 */
function resolve(path, args, ctx) {
  let parent = null;
  let cur = ctx;
  for (const seg of path) {
    if (cur === null || cur === undefined) return undefined;
    parent = cur;
    cur = cur[seg];
  }
  if (typeof cur === 'function') return cur.apply(parent, args || []);
  if (args) throw new TypeError(`Condition: "${path.join('.')}" is not callable`);
  return cur;
}

function evalNode(node, ctx) {
  if ('lit' in node) return node.lit;
  if (node.path) return resolve(node.path, node.args ? node.args.map((a) => evalNode(a, ctx)) : null, ctx);
  switch (node.op) {
    case '!': return !evalNode(node.arg, ctx);
    case 'neg': return -evalNode(node.arg, ctx);
    case '||': return evalNode(node.left, ctx) || evalNode(node.right, ctx);
    case '&&': return evalNode(node.left, ctx) && evalNode(node.right, ctx);
    case '==': return evalNode(node.left, ctx) == evalNode(node.right, ctx); // eslint-disable-line eqeqeq
    case '!=': return evalNode(node.left, ctx) != evalNode(node.right, ctx); // eslint-disable-line eqeqeq
    case '<': return evalNode(node.left, ctx) < evalNode(node.right, ctx);
    case '<=': return evalNode(node.left, ctx) <= evalNode(node.right, ctx);
    case '>': return evalNode(node.left, ctx) > evalNode(node.right, ctx);
    case '>=': return evalNode(node.left, ctx) >= evalNode(node.right, ctx);
    case '+': return evalNode(node.left, ctx) + evalNode(node.right, ctx);
    case '-': return evalNode(node.left, ctx) - evalNode(node.right, ctx);
    default: throw new Error(`Condition: unknown op ${node.op}`);
  }
}

/**
 * Build the identifier context for a GameState (or anything with the same shape).
 * @param {import('./GameState.js').GameState} state
 */
export function contextFor(state) {
  return {
    flags: state.flags,
    vars: state.vars,
    money: state.money,
    chapter: state.chapter,
    map: state.map,
    party: {
      has: (id) => state.party.has(id),
      size: state.party.size,
    },
    inventory: {
      has: (id) => state.inventory.has(id),
      count: (id) => state.inventory.count(id),
    },
    level: (id) => state.party.level(id),
  };
}

/**
 * Evaluate a condition string against a GameState. Empty/undefined conditions are true.
 * @param {string|undefined|null} expr
 * @param {import('./GameState.js').GameState} state
 * @returns {boolean}
 */
export function evaluate(expr, state) {
  if (expr === undefined || expr === null || expr === '' || expr === true) return true;
  if (expr === false) return false;
  return !!evalNode(parse(String(expr)), contextFor(state));
}

/** Evaluate against a raw context object (used by tests). */
export function evaluateWith(expr, ctx) {
  return evalNode(parse(String(expr)), ctx);
}
