"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export const BackgroundRippleEffect = ({
  rows = 8,
  cols = 27,
  cellSize = 56,
}: {
  rows?: number;
  cols?: number;
  cellSize?: number;
}) => {
  const [clickedCell, setClickedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [rippleKey, setRippleKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 h-full w-full overflow-hidden",
        "[--cell-border-color:hsl(var(--border))] [--cell-fill-color:hsl(var(--muted))] [--cell-shadow-color:hsl(var(--muted-foreground))]",
        "dark:[--cell-border-color:hsl(var(--border))] dark:[--cell-fill-color:hsl(var(--muted))] dark:[--cell-shadow-color:hsl(var(--muted-foreground))]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-hidden" />
      <DivGrid
        key={`base-${rippleKey}`}
        className="absolute inset-0 opacity-60"
        rows={rows}
        cols={cols}
        cellSize={cellSize}
        borderColor="var(--cell-border-color)"
        fillColor="var(--cell-fill-color)"
        clickedCell={clickedCell}
        onCellClick={(row, col) => {
          setClickedCell({ row, col });
          setRippleKey((k) => k + 1);
        }}
        interactive
      />
    </div>
  );
};

type DivGridProps = {
  className?: string;
  rows: number;
  cols: number;
  cellSize: number;
  borderColor: string;
  fillColor: string;
  clickedCell: { row: number; col: number } | null;
  onCellClick?: (row: number, col: number) => void;
  interactive?: boolean;
};

type CellStyle = React.CSSProperties & {
  ["--delay"]?: string;
  ["--duration"]?: string;
};

const DivGrid = ({
  className,
  rows = 7,
  cols = 30,
  cellSize = 56,
  borderColor = "#3f3f46",
  fillColor = "rgba(14,165,233,0.3)",
  clickedCell = null,
  onCellClick = () => {},
  interactive = true,
}: DivGridProps) => {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

  const cells = useMemo(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) {
      return [];
    }
    const gridCols = Math.ceil(viewportSize.width / cellSize);
    const gridRows = Math.ceil(viewportSize.height / cellSize);
    return Array.from({ length: gridRows * gridCols }, (_, idx) => idx);
  }, [viewportSize, cellSize]);

  const gridCols =
    viewportSize.width > 0 ? Math.ceil(viewportSize.width / cellSize) : cols;
  const gridRows =
    viewportSize.height > 0 ? Math.ceil(viewportSize.height / cellSize) : rows;

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
    width: "100vw",
    height: "100vh",
    position: "absolute",
    top: 0,
    left: 0,
  };

  return (
    <div className={cn("relative z-[3]", className)} style={gridStyle}>
      {cells.map((idx) => {
        const rowIdx = Math.floor(idx / cols);
        const colIdx = idx % cols;
        const distance = clickedCell
          ? Math.hypot(clickedCell.row - rowIdx, clickedCell.col - colIdx)
          : 0;
        const delay = clickedCell ? Math.max(0, distance * 55) : 0;
        const duration = 200 + distance * 80;

        const style: CellStyle = clickedCell
          ? {
              "--delay": `${delay}ms`,
              "--duration": `${duration}ms`,
            }
          : {};

        return (
          <div
            key={idx}
            className={cn(
              "cell relative border-[0.5px] opacity-40 transition-opacity duration-150 will-change-transform hover:opacity-80 dark:shadow-[0px_0px_40px_1px_var(--cell-shadow-color)_inset]",
              clickedCell && "animate-pulse",
              !interactive && "pointer-events-none",
            )}
            style={{
              backgroundColor: fillColor,
              borderColor: borderColor,
              ...style,
            }}
            onClick={
              interactive ? () => onCellClick?.(rowIdx, colIdx) : undefined
            }
          />
        );
      })}
    </div>
  );
};
