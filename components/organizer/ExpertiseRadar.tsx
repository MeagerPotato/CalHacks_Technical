import { Card } from "@/components/ui/Card";
import type { ExpertiseRadarView, RadarAxisView } from "@/lib/view-models/organizer-types";

export interface ExpertiseRadarProps {
  radar: ExpertiseRadarView;
}

// Chart geometry in SVG user units, centered on the origin. Labels sit just outside the outer ring.
const RADIUS = 150;
const LABEL_RADIUS = 168;
const RINGS = [0.25, 0.5, 0.75, 1] as const;

function round(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}

/** Spoke `index` of `count` at `distance`, starting at the top and going clockwise. */
function pointOn(index: number, count: number, distance: number): [number, number] {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [round(Math.cos(angle) * distance), round(Math.sin(angle) * distance)];
}

function polygonPoints(axes: readonly RadarAxisView[], distanceOf: (axis: RadarAxisView) => number): string {
  return axes.map((axis, index) => pointOn(index, axes.length, distanceOf(axis)).join(",")).join(" ");
}

function anchorFor(x: number): "start" | "middle" | "end" {
  if (x > 1) {
    return "start";
  }
  return x < -1 ? "end" : "middle";
}

/**
 * The Expertise Radar: an SVG radar of submitted Judges per expertise category (every category, zero counts
 * included) with `role="img"` named by its `title`, followed by a table with the same numbers and the coverage gap
 * callout. The chart is never the only source of a number.
 */
export function ExpertiseRadar({ radar }: ExpertiseRadarProps) {
  const { axes } = radar;

  return (
    <Card labelledBy="expertise-radar-title" data-testid="expertise-radar">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="expertise-radar-title" className="text-xl font-bold">
            {radar.title}
          </h2>
          <p>{radar.intro}</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {axes.length > 0 ? (
            <svg
              role="img"
              aria-labelledby="expertise-radar-image-title"
              viewBox="-300 -215 600 430"
              data-testid="expertise-radar-chart"
              className="h-auto w-full"
            >
              <title id="expertise-radar-image-title">{radar.imageLabel}</title>
              <g className="fill-none stroke-border" strokeOpacity={0.3} strokeWidth={1}>
                {RINGS.map((ring) => (
                  <polygon key={ring} points={polygonPoints(axes, () => RADIUS * ring)} />
                ))}
                {axes.map((axis, index) => {
                  const [x, y] = pointOn(index, axes.length, RADIUS);
                  return <line key={axis.key} x1={0} y1={0} x2={x} y2={y} />;
                })}
              </g>
              <polygon
                data-testid="expertise-radar-shape"
                points={polygonPoints(axes, (axis) => RADIUS * axis.fraction)}
                className="fill-accent stroke-border"
                fillOpacity={0.7}
                strokeWidth={2}
              />
              {axes.map((axis, index) => {
                const [x, y] = pointOn(index, axes.length, RADIUS * axis.fraction);
                return <circle key={axis.key} cx={x} cy={y} r={4} className="fill-ink" />;
              })}
              <g className="fill-ink text-xs font-semibold">
                {axes.map((axis, index) => {
                  const [x, y] = pointOn(index, axes.length, LABEL_RADIUS);
                  return (
                    <text
                      key={axis.key}
                      x={x}
                      y={y}
                      textAnchor={anchorFor(x)}
                      dominantBaseline="middle"
                      data-expertise={axis.key}
                    >
                      {`${axis.label} (${axis.count})`}
                    </text>
                  );
                })}
              </g>
            </svg>
          ) : null}
          <div className="flex flex-col gap-5">
            <div className="overflow-x-auto">
              <table data-testid="expertise-radar-table" className="w-full border-collapse text-left">
                <caption className="pb-2 text-left font-semibold">{radar.tableCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="border-b-2 border-border py-2 pr-4">
                      {radar.columns.area}
                    </th>
                    <th scope="col" className="border-b-2 border-border py-2 text-right">
                      {radar.columns.judges}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {axes.map((axis) => (
                    <tr
                      key={axis.key}
                      data-expertise={axis.key}
                      data-gap={axis.count === 0 ? "true" : "false"}
                      className="border-b border-border/30"
                    >
                      <th scope="row" className="py-1.5 pr-4 font-normal">
                        {axis.label}
                      </th>
                      <td className="py-1.5 text-right font-semibold">{axis.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              data-testid="coverage-gap"
              data-gap-count={radar.gap.items.length}
              className="flex flex-col gap-2 rounded-card border-2 border-l-8 border-border bg-highlight p-4 text-ink"
            >
              <h3 className="text-lg font-bold">{radar.gap.title}</h3>
              <p>{radar.gap.body}</p>
              {radar.gap.items.length > 0 ? (
                <ul role="list" className="flex flex-wrap gap-2">
                  {radar.gap.items.map((item) => (
                    <li key={item} className="rounded-full border-2 border-border bg-surface px-2.5 py-0.5 text-sm font-semibold">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
