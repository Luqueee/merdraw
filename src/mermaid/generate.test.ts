import { describe, it, expect } from 'vitest';
import { generateMermaid } from './generate';
import type {
  FlowNode,
  FlowEdge,
  ShapeKind,
  LineStyle,
} from '../flow/types';

// Terse builders matching the type contract in src/flow/types.ts.
// Position is irrelevant to the pure generator; fixed at origin.
const node = (id: string, shape: ShapeKind, label: string): FlowNode => ({
  id,
  position: { x: 0, y: 0 },
  type: 'shape',
  data: { label, shape },
});

const edge = (
  id: string,
  source: string,
  target: string,
  lineStyle: LineStyle,
  arrow: boolean,
  label: string,
): FlowEdge => ({
  id,
  source,
  target,
  data: { label, lineStyle, arrow },
});

describe('generateMermaid — header & empty graph', () => {
  it('empty graph emits ONLY the header line, no trailing newline', () => {
    expect(generateMermaid([], [], 'TD')).toBe('flowchart TD');
  });

  it.each(['TD', 'LR', 'BT', 'RL'] as const)(
    'header reflects direction %s',
    (direction) => {
      expect(generateMermaid([], [], direction)).toBe(`flowchart ${direction}`);
    },
  );
});

describe('generateMermaid — shape delimiters', () => {
  // Each shape wraps a quoted label in its own delimiter pair.
  const cases: Array<{ shape: ShapeKind; expected: string }> = [
    { shape: 'rectangle', expected: 'n1["x"]' },
    { shape: 'rounded', expected: 'n1("x")' },
    { shape: 'stadium', expected: 'n1(["x"])' },
    { shape: 'subroutine', expected: 'n1[["x"]]' },
    { shape: 'circle', expected: 'n1(("x"))' },
    { shape: 'decision', expected: 'n1{"x"}' },
  ];

  it.each(cases)('$shape -> $expected', ({ shape, expected }) => {
    expect(generateMermaid([node('a', shape, 'x')], [], 'TD')).toBe(
      `flowchart TD\n    ${expected}`,
    );
  });
});

describe('generateMermaid — synthetic id mapping by array order', () => {
  it('assigns n1..nN by array index, ignoring the React Flow id', () => {
    const nodes = [
      node('node_zzz', 'rectangle', 'A'),
      node('abc', 'rectangle', 'B'),
      node('q9', 'rectangle', 'C'),
    ];
    // Edge references the arbitrary ids; must render with synthetic ids.
    const edges = [edge('e1', 'node_zzz', 'q9', 'solid', true, '')];

    expect(generateMermaid(nodes, edges, 'TD')).toBe(
      [
        'flowchart TD',
        '    n1["A"]',
        '    n2["B"]',
        '    n3["C"]',
        '    n1 --> n3',
      ].join('\n'),
    );
  });
});

describe('generateMermaid — connector matrix (6 styles x plain/pipe)', () => {
  // Two-node scaffold shared by every row.
  const nodes = [node('a', 'rectangle', 'X'), node('b', 'rectangle', 'Y')];
  const head = 'flowchart TD\n    n1["X"]\n    n2["Y"]\n';

  const rows: Array<{
    name: string;
    lineStyle: LineStyle;
    arrow: boolean;
    conn: string;
  }> = [
    { name: 'solid arrow', lineStyle: 'solid', arrow: true, conn: '-->' },
    { name: 'solid open', lineStyle: 'solid', arrow: false, conn: '---' },
    { name: 'dotted arrow', lineStyle: 'dotted', arrow: true, conn: '-.->' },
    { name: 'dotted open', lineStyle: 'dotted', arrow: false, conn: '-.-' },
    { name: 'thick arrow', lineStyle: 'thick', arrow: true, conn: '==>' },
    { name: 'thick open', lineStyle: 'thick', arrow: false, conn: '===' },
  ];

  it.each(rows)('$name — plain form uses $conn', ({ lineStyle, arrow, conn }) => {
    const edges = [edge('e', 'a', 'b', lineStyle, arrow, '')];
    expect(generateMermaid(nodes, edges, 'TD')).toBe(`${head}    n1 ${conn} n2`);
  });

  it.each(rows)('$name — pipe-label form wraps "go"', ({ lineStyle, arrow, conn }) => {
    const edges = [edge('e', 'a', 'b', lineStyle, arrow, 'go')];
    expect(generateMermaid(nodes, edges, 'TD')).toBe(
      `${head}    n1 ${conn}|"go"| n2`,
    );
  });
});

describe('generateMermaid — label escaping', () => {
  const oneNode = (label: string) =>
    generateMermaid([node('a', 'rectangle', label)], [], 'TD');

  it('node: double quote -> #quot;', () => {
    expect(oneNode('a"b')).toBe('flowchart TD\n    n1["a#quot;b"]');
  });

  it('node: newline -> <br/>', () => {
    expect(oneNode('a\nb')).toBe('flowchart TD\n    n1["a<br/>b"]');
  });

  it('node: CRLF newline -> <br/>', () => {
    expect(oneNode('a\r\nb')).toBe('flowchart TD\n    n1["a<br/>b"]');
  });

  it('node: empty label -> single space', () => {
    expect(oneNode('')).toBe('flowchart TD\n    n1[" "]');
  });

  it('node: all-whitespace label -> single space', () => {
    expect(oneNode('   ')).toBe('flowchart TD\n    n1[" "]');
  });

  // The asymmetry: node labels are NOT trimmed (surrounding whitespace kept),
  // edge labels ARE trimmed before the emptiness check and escaping.
  it('node keeps surrounding whitespace while edge label is trimmed', () => {
    const nodes = [node('a', 'rectangle', '  a  '), node('b', 'rectangle', 'X')];
    const edges = [edge('e', 'a', 'b', 'solid', true, '  a  ')];
    expect(generateMermaid(nodes, edges, 'TD')).toBe(
      [
        'flowchart TD',
        '    n1["  a  "]',
        '    n2["X"]',
        '    n1 -->|"a"| n2',
      ].join('\n'),
    );
  });

  const twoNodes = [node('a', 'rectangle', 'X'), node('b', 'rectangle', 'Y')];
  const head2 = 'flowchart TD\n    n1["X"]\n    n2["Y"]\n';

  it('edge: double quote -> #quot; inside pipe', () => {
    const edges = [edge('e', 'a', 'b', 'solid', true, 'x"y')];
    expect(generateMermaid(twoNodes, edges, 'TD')).toBe(
      `${head2}    n1 -->|"x#quot;y"| n2`,
    );
  });

  it('edge: newline -> <br/> inside pipe', () => {
    const edges = [edge('e', 'a', 'b', 'solid', true, 'x\ny')];
    expect(generateMermaid(twoNodes, edges, 'TD')).toBe(
      `${head2}    n1 -->|"x<br/>y"| n2`,
    );
  });

  it('edge: empty label -> plain form (no pipe)', () => {
    const edges = [edge('e', 'a', 'b', 'solid', true, '')];
    expect(generateMermaid(twoNodes, edges, 'TD')).toBe(`${head2}    n1 --> n2`);
  });

  it('edge: all-whitespace label -> plain form (trim-then-check)', () => {
    const edges = [edge('e', 'a', 'b', 'solid', true, '   ')];
    expect(generateMermaid(twoNodes, edges, 'TD')).toBe(`${head2}    n1 --> n2`);
  });
});

describe('generateMermaid — dangling edge guard', () => {
  it('omits edges whose source or target id is not a node; keeps valid ones', () => {
    const nodes = [node('a', 'rectangle', 'A'), node('b', 'rectangle', 'B')];
    const edges = [
      edge('valid', 'a', 'b', 'solid', true, ''),
      edge('bad-source', 'ghost', 'b', 'solid', true, ''),
      edge('bad-target', 'a', 'ghost', 'solid', true, ''),
    ];

    const out = generateMermaid(nodes, edges, 'TD');

    // Full exact string proves ONLY the valid edge survives (no `undefined` legs).
    expect(out).toBe(
      ['flowchart TD', '    n1["A"]', '    n2["B"]', '    n1 --> n2'].join('\n'),
    );
    expect(out).not.toContain('undefined');
  });
});

describe('generateMermaid — integration (ordering + mixed shapes/styles)', () => {
  it('emits all node lines before all edge lines, exact multi-line string', () => {
    const nodes = [
      node('start', 'decision', 'Start?'),
      node('work', 'rounded', 'Do work'),
      node('done', 'stadium', 'End'),
    ];
    const edges = [
      edge('e1', 'start', 'work', 'dotted', true, 'yes'),
      edge('e2', 'work', 'done', 'thick', false, ''),
    ];

    expect(generateMermaid(nodes, edges, 'LR')).toBe(
      [
        'flowchart LR',
        '    n1{"Start?"}',
        '    n2("Do work")',
        '    n3(["End"])',
        '    n1 -.->|"yes"| n2',
        '    n2 === n3',
      ].join('\n'),
    );
  });
});
