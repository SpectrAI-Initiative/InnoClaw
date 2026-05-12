import React, { useState, useEffect, useCallback, useRef } from "react";

interface DialogPosition {
  x: number;
  y: number;
}

interface DialogSize {
  width: number;
  height: number;
}

interface UseDraggableDialogOptions {
  open: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

export function useDraggableDialog({
  open,
  defaultWidth = 512,
  defaultHeight = 520,
}: UseDraggableDialogOptions) {
  const [dialogPos, setDialogPos] = useState<DialogPosition>({ x: 0, y: 0 });
  const [dialogSize, setDialogSize] = useState<DialogSize>({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<string | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0, posX: 0, posY: 0 });

  // Reset position/size when dialog transitions from closed to open
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDialogPos(() => ({ x: 0, y: 0 })); // eslint-disable-line react-hooks/set-state-in-effect
      setDialogSize(() => ({ width: defaultWidth, height: defaultHeight }));
    }
    prevOpenRef.current = open;
  }, [open, defaultWidth, defaultHeight]);

  // Global pointer listeners for dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const s = dragStartRef.current;
      setDialogPos({ x: s.posX + e.clientX - s.mouseX, y: s.posY + e.clientY - s.mouseY });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  // Global pointer listeners for resizing
  useEffect(() => {
    if (!resizeEdge) return;
    const onMove = (e: PointerEvent) => {
      const s = resizeStartRef.current;
      const dx = e.clientX - s.mouseX;
      const dy = e.clientY - s.mouseY;
      let newW = s.w, newH = s.h, newX = s.posX, newY = s.posY;

      if (resizeEdge.includes("e")) newW = s.w + dx;
      if (resizeEdge.includes("w")) { newW = s.w - dx; newX = s.posX + dx; }
      if (resizeEdge.includes("s")) newH = s.h + dy;
      if (resizeEdge.includes("n")) { newH = s.h - dy; newY = s.posY + dy; }

      if (newW < 360) { newW = 360; if (resizeEdge.includes("w")) newX = s.posX + s.w - 360; }
      if (newH < 300) { newH = 300; if (resizeEdge.includes("n")) newY = s.posY + s.h - 300; }

      setDialogSize({ width: newW, height: newH });
      setDialogPos({ x: newX, y: newY });
    };
    const onUp = () => setResizeEdge(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeEdge]);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: dialogPos.x, posY: dialogPos.y };
    setIsDragging(true);
  }, [dialogPos]);

  const onEdgeResizeStart = useCallback((e: React.PointerEvent, edge: string) => {
    e.stopPropagation();
    resizeStartRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      w: dialogSize.width, h: dialogSize.height,
      posX: dialogPos.x, posY: dialogPos.y,
    };
    setResizeEdge(edge);
  }, [dialogSize, dialogPos]);

  const dialogStyle: React.CSSProperties = {
    width: dialogSize.width,
    height: dialogSize.height,
    maxWidth: "none",
    maxHeight: "none",
    transform: `translate(calc(-50% + ${dialogPos.x}px), calc(-50% + ${dialogPos.y}px))`,
  };

  return { dialogStyle, onDragStart, onEdgeResizeStart };
}

/** Renders the 8 edge/corner resize handles for a draggable dialog. */
export function ResizeHandles({
  onEdgeResizeStart,
}: {
  onEdgeResizeStart: (e: React.PointerEvent, edge: string) => void;
}) {
  return (
    <>
      {/* Edge resize handles */}
      <div className="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize" onPointerDown={(e) => onEdgeResizeStart(e, "n")} />
      <div className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize" onPointerDown={(e) => onEdgeResizeStart(e, "s")} />
      <div className="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize" onPointerDown={(e) => onEdgeResizeStart(e, "w")} />
      <div className="absolute right-0 top-3 bottom-3 w-1.5 cursor-e-resize" onPointerDown={(e) => onEdgeResizeStart(e, "e")} />
      {/* Corner resize handles */}
      <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onPointerDown={(e) => onEdgeResizeStart(e, "nw")} />
      <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onPointerDown={(e) => onEdgeResizeStart(e, "ne")} />
      <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onPointerDown={(e) => onEdgeResizeStart(e, "sw")} />
      <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onPointerDown={(e) => onEdgeResizeStart(e, "se")} />
    </>
  );
}
