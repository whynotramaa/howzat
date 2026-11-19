const up = (x: number, y: number) => `M${x - 4.2} ${y + 4.2}L${x} ${y}L${x + 4.2} ${y + 4.2}`;
const down = (x: number, y: number) => `M${x - 4.2} ${y - 4.2}L${x} ${y}L${x + 4.2} ${y - 4.2}`;
const right = (x: number, y: number) => `M${x - 4.2} ${y - 4.2}L${x} ${y}L${x - 4.2} ${y + 4.2}`;

function Plate({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <svg
      className="pl"
      viewBox="0 0 560 440"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      role="img"
      aria-label={`${title}. ${desc}`}
    >
      {children}
    </svg>
  );
}

function Label({
  x,
  y,
  children,
  value,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  value?: boolean;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={value ? 10 : 11}
      fill="currentColor"
      stroke="none"
      opacity={value ? 0.5 : 0.72}
      className="pl-text"
    >
      {children}
    </text>
  );
}

const cells = (xs: number[], y: number, w = 8) =>
  xs.map((x) => <rect key={x} x={x} y={y} width={w} height={w} pathLength={1} />);

export function OneLinkDrawing() {
  const devices = [
    { cx: 108, label: 'Boundary rope' },
    { cx: 280, label: 'Clubhouse' },
    { cx: 452, label: 'Away end' },
  ];
  return (
    <Plate title="One link, one score" desc="A single match link routes to three screens, each showing the same score and the same latest ball.">
      <g className="pl-draw">
        <rect x="176" y="64" width="208" height="32" pathLength={1} />
        <rect x="64" y="200" width="88" height="160" pathLength={1} />
        <rect x="408" y="200" width="88" height="160" pathLength={1} />
        <rect x="196" y="224" width="168" height="112" pathLength={1} />
        <path d="M180 344H380" pathLength={1} />
        {devices.map(({ cx }) => (
          <rect key={cx} x={cx + 26} y="292" width="8" height="8" pathLength={1} />
        ))}
      </g>
      <g opacity="0.32" className="pl-fade">
        <path d="M76 220H140M420 220H484M208 240H352" />
        {devices.map(({ cx }) => (
          <g key={cx}>{cells([cx - 34, cx - 22, cx - 10, cx + 2, cx + 14], 292)}</g>
        ))}
      </g>
      <g opacity="0.32" className="pl-flow-group">
        <path
          className="pl-flow"
          d="M280 96V224M280 128H124A16 16 0 0 0 108 144V200M280 128H436A16 16 0 0 1 452 144V200"
          strokeDasharray="4 6"
        />
        <path d={`${down(280, 224)}${down(108, 200)}${down(452, 200)}`} />
      </g>
      <Label x={280} y={84}>howzat.ramaa.tech/m/14</Label>
      {devices.map(({ cx, label }) => (
        <g key={cx}>
          <Label x={cx} y={276}>146/3</Label>
          <Label x={cx} y={386}>{label}</Label>
        </g>
      ))}
    </Plate>
  );
}

export function OfflineDrawing() {
  const x = (i: number) => 104 + i * 40;
  const synced = ['1', '·', '4', '2', '6'];
  const queued = ['4', '·', '1'];
  return (
    <Plate title="Saved in order" desc="Three balls scored without signal wait on the phone, then fill the three open places in the match record in the order they were bowled.">
      <rect x="296" y="272" width="128" height="48" fill="currentColor" fillOpacity="0.055" stroke="none" />
      <g className="pl-draw">
        {synced.map((_, i) => (
          <rect key={i} x={x(i)} y="112" width="32" height="32" pathLength={1} />
        ))}
        <rect x="280" y="232" width="160" height="168" pathLength={1} />
        {queued.map((_, i) => (
          <rect key={i} x={x(i + 5)} y="280" width="32" height="32" pathLength={1} />
        ))}
      </g>
      <g opacity="0.32" className="pl-fade">
        {queued.map((_, i) => (
          <rect key={i} x={x(i + 5)} y="112" width="32" height="32" strokeDasharray="3 5" />
        ))}
      </g>
      <path d="M220 96V160" opacity="0.14" strokeDasharray="8 3 1 3" className="pl-fade" />
      <g opacity="0.32" className="pl-flow-group">
        <path className="pl-flow" d="M320 264V144M360 264V144M400 264V144" strokeDasharray="4 6" />
        <path d={`${up(320, 144)}${up(360, 144)}${up(400, 144)}`} />
      </g>
      <Label x={104} y={102} anchor="start" value>Over 16</Label>
      <Label x={224} y={102} anchor="start" value>Over 17</Label>
      {synced.map((v, i) => (
        <Label key={i} x={x(i) + 16} y={132} value>{v}</Label>
      ))}
      {queued.map((v, i) => (
        <Label key={i} x={x(i + 5) + 16} y={300}>{v}</Label>
      ))}
      <Label x={104} y={172} anchor="start">Match record</Label>
      <Label x={296} y={256} anchor="start" value>No signal</Label>
      <Label x={360} y={372}>Saved on this phone</Label>
    </Plate>
  );
}

export function PlayoffDrawing() {
  const rows = [
    ['Harbour', '8'],
    ['Northgate', '6'],
    ['Riverside', '4'],
    ['St Albans', '4'],
    ['Eastfield', '2'],
    ['Oakley', '2'],
  ];
  return (
    <Plate title="The table sets the bracket" desc="The top four rows of the points table project into two semi-finals, which meet in one final.">
      <g transform="translate(0 48)">
        <rect x="88" y="112" width="184" height="96" fill="currentColor" fillOpacity="0.055" stroke="none" />
        <g className="pl-draw">
          <rect x="88" y="112" width="184" height="144" pathLength={1} />
          <path d="M88 208H272" pathLength={1} />
          <rect x="328" y="112" width="88" height="32" pathLength={1} />
          <rect x="328" y="176" width="88" height="32" pathLength={1} />
          <rect x="448" y="144" width="72" height="32" pathLength={1} />
          <path d="M416 128H432V192H416M432 160H448" pathLength={1} />
        </g>
        <path d="M88 136H272M88 160H272M88 184H272M88 232H272" opacity="0.32" className="pl-fade" />
        <g opacity="0.32" className="pl-flow-group">
          <path className="pl-flow" d="M280 160H300M300 128V192M300 128H328M300 192H328" strokeDasharray="4 6" />
          <path d={`${right(328, 128)}${right(328, 192)}`} />
        </g>
        {rows.map(([name, pts], i) => (
          <g key={name}>
            <Label x={100} y={128 + i * 24} anchor="start">{name}</Label>
            <Label x={260} y={128 + i * 24} anchor="end" value>{pts}</Label>
          </g>
        ))}
        <Label x={80} y={164} anchor="end" value>Top 4</Label>
        <Label x={372} y={132}>1 v 4</Label>
        <Label x={372} y={196}>2 v 3</Label>
        <Label x={484} y={164}>Final</Label>
      </g>
    </Plate>
  );
}
