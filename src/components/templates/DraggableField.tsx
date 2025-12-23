import { useState, useRef, useEffect, useCallback } from "react";
import { Type, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableFieldProps {
  field: {
    field_key: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    font_size: number;
    field_source: "standard" | "custom" | "system";
  };
  label: string;
  isSelected: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onSelect: () => void;
  onUpdate: (updates: { x?: number; y?: number; width?: number; height?: number }) => void;
  onDelete: () => void;
}

const MIN_WIDTH = 40;
const MIN_HEIGHT = 20;

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

export function DraggableField({
  field,
  label,
  isSelected,
  containerRef,
  onSelect,
  onUpdate,
  onDelete,
}: DraggableFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });

  const width = field.width || 100;
  const height = field.height || 24;

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    // Check if clicking on a resize handle
    const target = e.target as HTMLElement;
    if (target.dataset.handle) {
      setIsResizing(true);
      setResizeHandle(target.dataset.handle as ResizeHandle);
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialPos({ x: field.x, y: field.y });
      setInitialSize({ width, height });
      return;
    }

    // Start dragging
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: field.x, y: field.y });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        let newX = initialPos.x + deltaX;
        let newY = initialPos.y + deltaY;

        // Constrain to container bounds
        newX = Math.max(0, Math.min(newX, containerRect.width - width));
        newY = Math.max(0, Math.min(newY, containerRect.height - height));

        onUpdate({ x: Math.round(newX), y: Math.round(newY) });
      }

      if (isResizing && resizeHandle) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        let newX = initialPos.x;
        let newY = initialPos.y;
        let newWidth = initialSize.width;
        let newHeight = initialSize.height;

        // Handle resize based on which handle is being dragged
        switch (resizeHandle) {
          case "e":
            newWidth = Math.max(MIN_WIDTH, initialSize.width + deltaX);
            break;
          case "w":
            newWidth = Math.max(MIN_WIDTH, initialSize.width - deltaX);
            newX = initialPos.x + (initialSize.width - newWidth);
            break;
          case "s":
            newHeight = Math.max(MIN_HEIGHT, initialSize.height + deltaY);
            break;
          case "n":
            newHeight = Math.max(MIN_HEIGHT, initialSize.height - deltaY);
            newY = initialPos.y + (initialSize.height - newHeight);
            break;
          case "se":
            newWidth = Math.max(MIN_WIDTH, initialSize.width + deltaX);
            newHeight = Math.max(MIN_HEIGHT, initialSize.height + deltaY);
            break;
          case "sw":
            newWidth = Math.max(MIN_WIDTH, initialSize.width - deltaX);
            newHeight = Math.max(MIN_HEIGHT, initialSize.height + deltaY);
            newX = initialPos.x + (initialSize.width - newWidth);
            break;
          case "ne":
            newWidth = Math.max(MIN_WIDTH, initialSize.width + deltaX);
            newHeight = Math.max(MIN_HEIGHT, initialSize.height - deltaY);
            newY = initialPos.y + (initialSize.height - newHeight);
            break;
          case "nw":
            newWidth = Math.max(MIN_WIDTH, initialSize.width - deltaX);
            newHeight = Math.max(MIN_HEIGHT, initialSize.height - deltaY);
            newX = initialPos.x + (initialSize.width - newWidth);
            newY = initialPos.y + (initialSize.height - newHeight);
            break;
        }

        // Constrain to container bounds
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.min(newWidth, containerRect.width - newX);
        newHeight = Math.min(newHeight, containerRect.height - newY);

        onUpdate({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        });
      }
    },
    [isDragging, isResizing, resizeHandle, dragStart, initialPos, initialSize, width, height, containerRef, onUpdate]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        onDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelected, onDelete]);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const getSourceColor = () => {
    switch (field.field_source) {
      case "system":
        return "border-info bg-info/20";
      case "custom":
        return "border-warning bg-warning/20";
      default:
        return "border-primary bg-primary/10";
    }
  };

  return (
    <div
      ref={fieldRef}
      className={cn(
        "absolute border-2 rounded flex items-center justify-center overflow-hidden",
        isSelected ? "border-accent bg-accent/20 z-50" : cn(getSourceColor(), "hover:border-accent z-10"),
        isDragging && "cursor-grabbing",
        !isDragging && !isResizing && "cursor-grab"
      )}
      style={{
        left: field.x,
        top: field.y,
        width,
        height,
        fontSize: Math.min(field.font_size, height - 4),
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Field content */}
      <div className="flex items-center gap-1 px-1 pointer-events-none select-none truncate">
        <Type className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>

      {/* Resize handles - only show when selected */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            data-handle="nw"
            className="absolute -left-1 -top-1 w-3 h-3 bg-accent border border-accent-foreground rounded-sm cursor-nw-resize"
          />
          <div
            data-handle="ne"
            className="absolute -right-1 -top-1 w-3 h-3 bg-accent border border-accent-foreground rounded-sm cursor-ne-resize"
          />
          <div
            data-handle="se"
            className="absolute -right-1 -bottom-1 w-3 h-3 bg-accent border border-accent-foreground rounded-sm cursor-se-resize"
          />
          <div
            data-handle="sw"
            className="absolute -left-1 -bottom-1 w-3 h-3 bg-accent border border-accent-foreground rounded-sm cursor-sw-resize"
          />

          {/* Edge handles */}
          <div
            data-handle="n"
            className="absolute left-1/2 -translate-x-1/2 -top-1 w-4 h-2 bg-accent border border-accent-foreground rounded-sm cursor-n-resize"
          />
          <div
            data-handle="s"
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-4 h-2 bg-accent border border-accent-foreground rounded-sm cursor-s-resize"
          />
          <div
            data-handle="e"
            className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-4 bg-accent border border-accent-foreground rounded-sm cursor-e-resize"
          />
          <div
            data-handle="w"
            className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-4 bg-accent border border-accent-foreground rounded-sm cursor-w-resize"
          />
        </>
      )}
    </div>
  );
}
