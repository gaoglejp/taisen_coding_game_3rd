"use client";

import { useEffect, useRef } from "react";
import * as Blockly from "blockly";
import {
  defineStrategyBlocks,
  STRATEGY_TOOLBOX,
  DEFAULT_WORKSPACE_STATE,
  workspaceToStrategy,
} from "@/lib/strategy-blocks";
import type { Strategy } from "@/lib/match-simulator";

defineStrategyBlocks();

const STRATEGY_THEME = Blockly.Theme.defineTheme("tankStrategy", {
  name: "tankStrategy",
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: "#fffdfa",
    toolboxBackgroundColour: "#dddddd",
    toolboxForegroundColour: "#1f2330",
    flyoutBackgroundColour: "#f9fafb",
    flyoutOpacity: 0.96,
    scrollbarColour: "#9ca3af",
    scrollbarOpacity: 0.7,
    insertionMarkerColour: "#f59e0b",
    insertionMarkerOpacity: 0.35,
    selectedGlowColour: "#fbbf24",
    selectedGlowOpacity: 0.85,
  },
  fontStyle: {
    family: '"Noto Sans JP", "Yu Gothic", "Hiragino Sans", Arial, sans-serif',
    weight: "700",
    size: 16,
  },
});

interface Props {
  onChange?: (strategy: Strategy, state: string) => void;
  readOnly?: boolean;
  initialState?: object | null;
}

export default function BlocklyEditor({ onChange, readOnly = false, initialState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  // Read once on mount — changing the seed after init would clobber edits.
  const initialStateRef = useRef(initialState);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const workspace = Blockly.inject(container, {
      toolbox: STRATEGY_TOOLBOX,
      readOnly,
      renderer: "zelos",
      theme: STRATEGY_THEME,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1 },
      grid: { spacing: 24, length: 3, colour: "#e7e2d4", snap: true },
      scrollbars: false,
      move: { scrollbars: false, drag: true, wheel: true },
    });

    try {
      Blockly.serialization.workspaces.load(initialStateRef.current ?? DEFAULT_WORKSPACE_STATE, workspace);
      workspace.scroll(0, 0);
    } catch {
      // Malformed seed — leave the workspace empty rather than crash.
    }

    const emit = () => {
      const cb = onChangeRef.current;
      if (!cb) return;
      const strategy = workspaceToStrategy(workspace);
      const state = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
      cb(strategy, state);
    };

    const listener = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return;
      emit();
    };
    workspace.addChangeListener(listener);
    emit();

    const handleResize = () => Blockly.svgResize(workspace);
    window.addEventListener("resize", handleResize);
    // Blockly measures the container on inject; if it mounted before layout
    // settled the canvas can be 0-sized, so nudge a resize on the next frame.
    const raf = requestAnimationFrame(() => {
      handleResize();
      workspace.scroll(0, 0);
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      workspace.removeChangeListener(listener);
      workspace.dispose();
    };
  }, [readOnly]);

  return (
    <div className="taisen-blockly-editor" style={{ width: "100%", height: "100%" }}>
      <style>{`
        .taisen-blockly-editor .blocklyToolboxDiv {
          border-right: 1px solid #d6d3ca;
        }

        .taisen-blockly-editor .blocklyTreeRow,
        .taisen-blockly-editor .blocklyToolboxCategory {
          min-height: 37px;
          padding-inline-end: 18px;
        }

        .taisen-blockly-editor .blocklyTreeLabel,
        .taisen-blockly-editor .blocklyToolboxCategoryLabel {
          color: #1f2330;
          font-size: 22px;
          font-weight: 800;
          line-height: 1.15;
        }

        .taisen-blockly-editor .blocklyFlyoutBackground {
          stroke: #e5e7eb;
          stroke-width: 1px;
        }

        .taisen-blockly-editor .blocklyMainWorkspaceScrollbar,
        .taisen-blockly-editor .blocklyFlyoutScrollbar {
          display: none;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
