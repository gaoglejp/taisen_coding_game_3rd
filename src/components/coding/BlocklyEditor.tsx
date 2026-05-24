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
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1 },
      grid: { spacing: 24, length: 3, colour: "#e7e2d4", snap: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });

    try {
      Blockly.serialization.workspaces.load(initialStateRef.current ?? DEFAULT_WORKSPACE_STATE, workspace);
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
    const raf = requestAnimationFrame(handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      workspace.removeChangeListener(listener);
      workspace.dispose();
    };
  }, [readOnly]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
