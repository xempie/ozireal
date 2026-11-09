/**
 * A generic new Australian home, drawn (owner's choice, 2026-11-09): one illustration
 * per New Homes project instead of a stock photo, so no card implies a real building.
 *
 * Five types follow the card's `kind`; eight palettes of common new-build finishes
 * rotate by the card's position so neighbours differ. Inline SVG: nothing to download,
 * sharp at any size. A listing with a real photo from the CRM never gets one.
 */

type Palette = {
  wall: string;
  wall2: string;
  roof: string;
  accent: string;
  door: string;
  garage: string;
  glass: string;
  frame: string;
  sky: string;
};

const PALETTES: Palette[] = [
  // White render
  { wall: "#F4F2EE", wall2: "#E3E0DA", roof: "#3A3D42", accent: "#B98A5E", door: "#2B2E33", garage: "#D7D4CF", glass: "#8FB1CC", frame: "#2B2E33", sky: "#CFE4F3" },
  // Surfmist and Monument
  { wall: "#EDEBE4", wall2: "#4B4F54", roof: "#323538", accent: "#2B2E33", door: "#B98A5E", garage: "#3A3D42", glass: "#9CBBD3", frame: "#1F2124", sky: "#D7E8F2" },
  // Shale grey
  { wall: "#C9CBC8", wall2: "#E9E9E6", roof: "#5A5E63", accent: "#A9774E", door: "#33363A", garage: "#8E9196", glass: "#88AACB", frame: "#33363A", sky: "#CDE2F0" },
  // Sandstone brick
  { wall: "#C9A27E", wall2: "#EFE9DF", roof: "#3A3D42", accent: "#F2EFEA", door: "#2B2E33", garage: "#D9D4CB", glass: "#93B4CE", frame: "#2B2E33", sky: "#D3E6F3" },
  // Charcoal cladding
  { wall: "#3E4247", wall2: "#E8E6E1", roof: "#D3D1CC", accent: "#B98A5E", door: "#E8E6E1", garage: "#5C6066", glass: "#A6C3D9", frame: "#E8E6E1", sky: "#CBE1F1" },
  // Red brick and Monument
  { wall: "#A65E46", wall2: "#ECE8E1", roof: "#3A3D42", accent: "#3A3D42", door: "#F2EFEA", garage: "#C9C4BB", glass: "#94B5CF", frame: "#2B2E33", sky: "#D5E7F2" },
  // Off-white and Woodland
  { wall: "#F1EFE8", wall2: "#6F7A62", roof: "#4E5A47", accent: "#C79A6B", door: "#2E3329", garage: "#D9D6CE", glass: "#8EB0C8", frame: "#2E3329", sky: "#D2E6EF" },
  // Greige and Basalt
  { wall: "#D8D1C6", wall2: "#F3F1EC", roof: "#2F3134", accent: "#2F3134", door: "#B98A5E", garage: "#6B6E73", glass: "#9AB9D1", frame: "#2F3134", sky: "#CFE3F2" },
];

const GROOVE = "#00000022";

function Tree({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#5E8C4A" />
      <rect x={x - 3} y={y + r * 0.45} width={6} height={r * 0.8} fill="#6B4E36" />
    </>
  );
}

function House({ p }: { p: Palette }) {
  return (
    <>
      <polygon points="330,330 510,330 560,372 300,372" fill="#D9D6CF" />
      <rect x={80} y={200} width={250} height={130} fill={p.wall} />
      <rect x={330} y={214} width={190} height={116} fill={p.wall2} />
      <polygon points="60,206 130,142 470,142 540,214 330,214 330,206" fill={p.roof} />
      <rect x={350} y={250} width={150} height={80} fill={p.garage} />
      {[268, 288, 308].map((y) => (
        <rect key={y} x={350} y={y} width={150} height={3} fill={GROOVE} />
      ))}
      <rect x={210} y={214} width={78} height={116} fill={p.accent} />
      <rect x={232} y={246} width={36} height={84} fill={p.door} />
      <rect x={104} y={236} width={88} height={58} fill={p.glass} />
      <rect x={146} y={236} width={4} height={58} fill={p.frame} />
      <rect x={200} y={196} width={100} height={10} fill={p.roof} />
      <Tree x={40} y={282} r={38} />
    </>
  );
}

function HouseAndLand({ p }: { p: Palette }) {
  return (
    <>
      <polygon points="40,346 560,346 590,392 10,392" fill="#C8B48C" />
      <polyline points="40,346 10,392 590,392 560,346" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeDasharray="10 8" />
      <rect x={130} y={214} width={230} height={116} fill={p.wall} />
      <rect x={360} y={226} width={140} height={104} fill={p.wall2} />
      <polygon points="114,220 176,164 444,164 516,226 360,226 360,220" fill={p.roof} />
      <rect x={378} y={258} width={104} height={72} fill={p.garage} />
      {[282, 304].map((y) => (
        <rect key={y} x={378} y={y} width={104} height={3} fill={GROOVE} />
      ))}
      <rect x={250} y={226} width={64} height={104} fill={p.accent} />
      <rect x={268} y={254} width={30} height={76} fill={p.door} />
      <rect x={150} y={246} width={80} height={54} fill={p.glass} />
      <rect x={188} y={246} width={4} height={54} fill={p.frame} />
      <rect x={520} y={292} width={6} height={58} fill="#4A5878" />
      <rect x={490} y={262} width={66} height={34} fill="#FFFFFF" stroke="#0034C8" strokeWidth={3} />
      <rect x={500} y={272} width={46} height={5} fill="#0034C8" />
      <rect x={500} y={282} width={30} height={5} fill="#D84315" />
      <Tree x={70} y={300} r={30} />
    </>
  );
}

function Townhouses({ p }: { p: Palette }) {
  const units = [
    { x: 60, top: 150, wall: p.wall },
    { x: 220, top: 140, wall: p.wall2 },
    { x: 380, top: 150, wall: p.wall },
  ];
  return (
    <>
      {units.map((u) => (
        <g key={u.x}>
          <rect x={u.x} y={u.top} width={160} height={330 - u.top} fill={u.wall} />
          <polygon points={`${u.x - 10},${u.top} ${u.x + 170},${u.top - 24} ${u.x + 170},${u.top}`} fill={p.roof} />
          <rect x={u.x + 14} y={u.top + 22} width={70} height={56} fill={p.glass} />
          <rect x={u.x + 96} y={u.top + 14} width={52} height={330 - u.top - 14} fill={p.accent} />
          <rect x={u.x + 14} y={262} width={76} height={68} fill={p.garage} />
          <rect x={u.x + 106} y={270} width={30} height={60} fill={p.door} />
        </g>
      ))}
      <rect x={60} y={244} width={480} height={6} fill={p.frame} />
      <Tree x={570} y={290} r={26} />
    </>
  );
}

function Apartments({ p }: { p: Palette }) {
  return (
    <>
      <rect x={140} y={70} width={320} height={260} fill={p.wall} />
      <rect x={140} y={70} width={320} height={14} fill={p.roof} />
      <rect x={380} y={84} width={80} height={246} fill={p.wall2} />
      {[96, 146, 196, 246].map((y) => (
        <g key={y}>
          <rect x={160} y={y} width={60} height={38} fill={p.glass} />
          <rect x={236} y={y} width={60} height={38} fill={p.glass} />
          <rect x={312} y={y} width={52} height={38} fill={p.glass} />
          <rect x={152} y={y + 38} width={220} height={6} fill={p.frame} />
          <rect x={394} y={y} width={52} height={38} fill={p.accent} />
        </g>
      ))}
      <rect x={230} y={286} width={90} height={44} fill={p.glass} />
      <rect x={222} y={278} width={106} height={8} fill={p.frame} />
      <Tree x={100} y={290} r={34} />
      <circle cx={510} cy={296} r={28} fill="#6E9A55" />
    </>
  );
}

function Warehouse({ p }: { p: Palette }) {
  return (
    <>
      <rect x={40} y={190} width={520} height={140} fill={p.wall2} />
      <polygon points="30,192 300,160 570,192" fill={p.roof} />
      <rect x={40} y={200} width={120} height={130} fill={p.wall} />
      <rect x={56} y={222} width={88} height={60} fill={p.glass} />
      <rect x={80} y={290} width={40} height={40} fill={p.door} />
      {[182, 304, 426].map((x) => (
        <rect key={x} x={x} y={232} width={100} height={98} fill={p.garage} />
      ))}
      {[262, 292].map((y) => (
        <rect key={y} x={182} y={y} width={344} height={3} fill={GROOVE} />
      ))}
      <rect x={40} y={200} width={520} height={8} fill={p.accent} />
      <polygon points="182,330 526,330 560,372 150,372" fill="#C9C7C2" />
    </>
  );
}

const SCENES: Record<string, (props: { p: Palette }) => React.ReactElement> = {
  House: House,
  "House and land": HouseAndLand,
  Townhouse: Townhouses,
  Apartment: Apartments,
  Warehouse: Warehouse,
};

export function HouseArt({ kind, index, label }: { kind?: string; index: number; label: string }) {
  const p = PALETTES[(index * 3) % PALETTES.length];
  const Scene = SCENES[kind ?? ""] ?? House;
  return (
    <svg className="proj-art" viewBox="0 0 600 400" role="img" aria-label={label}>
      <rect x={0} y={0} width={600} height={400} fill={p.sky} />
      <circle cx={520} cy={70} r={34} fill="#FFE6A8" opacity={0.9} />
      <rect x={0} y={318} width={600} height={82} fill="#9BBF74" />
      <rect x={0} y={372} width={600} height={28} fill="#B9BCC2" />
      <Scene p={p} />
    </svg>
  );
}
