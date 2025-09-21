from __future__ import annotations
import os
import shlex
import subprocess
import re
from typing import Dict, Any, List, Tuple, Callable


def _percent_px(expr: str) -> str:
    # ffmpeg supports expressions using main_w/main_h; caller should pass expressions
    return expr


def render_with_overlays(
    *,
    input_path: str,
    output_path: str,
    meta: Dict[str, Any],
    assets: Dict[str, str],
    progress_cb: Callable[[float, str | None], None] | None = None,
) -> None:
    """
    Build an ffmpeg command that layers overlays on top of the base video.
    - Positions and sizes are provided as percentages (0-100) relative to base video (main_w/main_h)
    - Timing is in seconds
    - Supported overlay types: text, image, video
    - Sticker is treated like text (emoji) for now
    """
    overlays: List[Dict[str, Any]] = meta.get("overlays", [])

    # Inputs: base video (index 0) + one input per non-text overlay (image/video)
    input_args: List[str] = ["-i", input_path]
    input_map: List[Tuple[int, Dict[str, Any]]] = []  # (ff_input_index, overlay)

    # Collect non-text overlays to add as inputs
    for ov in overlays:
        if ov["type"] in ("image", "video"):
            content = ov.get("content", "")
            # If content is provided as an asset filename key, resolve to saved path
            asset_path = assets.get(content) or content
            input_args += ["-i", asset_path]
            input_map.append((len(input_map) + 1, ov))  # since 0 is base, next are 1..N

    # Start building filter_complex
    filter_parts: List[str] = []
    last_label = "[0:v]"  # start from base video
    chain_index = 0

    # Helper to advance the chain with a new video label
    def next_label() -> str:
        nonlocal chain_index
        chain_index += 1
        return f"[v{chain_index}]"

    # Build lookup by id -> ff input index and original overlay
    id_to_input_index: Dict[str, int] = {}
    for ff_idx, ov in input_map:
        id_to_input_index[ov["id"]] = ff_idx

    for ov in overlays:
        ov_type = ov.get("type")
        pos = ov.get("position", {"x": 0, "y": 0})
        size = ov.get("size", {"width": 100, "height": 100})
        timing = ov.get("timing", {"start": 0, "end": 1e9})
        start = float(timing.get("start", 0))
        end = float(timing.get("end", start))
        enable = f"enable='between(t,{start},{end})'"
        
        # Calculate position and size as percentages of main video
        x_percent = float(pos.get('x', 0)) / 100.0
        y_percent = float(pos.get('y', 0)) / 100.0
        w_percent = float(size.get('width', 100)) / 100.0
        h_percent = float(size.get('height', 100)) / 100.0

        if ov_type in ("text", "sticker"):
            # Direct text overlay approach - much simpler and more reliable
            text = ov.get("content", "")
            # Properly escape text for ffmpeg
            safe_text = text.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:").replace("%", "\\%")
            
            # Calculate font size based on desired height
            # Use a reasonable base font size that scales with the video
            fontsize_expr = f"main_h*{h_percent}*0.8"  # 80% of the allocated height
            
            # Position calculations
            x_expr = f"main_w*{x_percent}"
            y_expr = f"main_h*{y_percent}"
            
            # Create text overlay filter
            text_filter = (
                f"{last_label}drawtext="
                f"text='{safe_text}':"
                f"fontsize={fontsize_expr}:"
                f"fontcolor=white:"
                f"borderw=2:"
                f"bordercolor=black@0.8:"
                f"x={x_expr}:"
                f"y={y_expr}:"
                f"{enable}"
            )
            
            new_label = next_label()
            filter_parts.append(f"{text_filter}{new_label}")
            last_label = new_label

        elif ov_type in ("image", "video"):
            ff_idx = id_to_input_index.get(ov["id"])
            if ff_idx is None:
                continue
                
            src_label = f"[{ff_idx}:v]"
            
            # For videos, reset PTS to avoid timing issues
            if ov_type == "video":
                pts_label = f"[pts{chain_index}]"
                filter_parts.append(f"{src_label}setpts=PTS-STARTPTS{pts_label}")
                src_label = pts_label
            
            # Calculate exact pixel dimensions based on main video
            target_w_expr = f"main_w*{w_percent}"
            target_h_expr = f"main_h*{h_percent}"
            x_expr = f"main_w*{x_percent}"
            y_expr = f"main_h*{y_percent}"
            
            # Scale the overlay to exact dimensions, ignoring aspect ratio if needed
            # This ensures consistent sizing regardless of source video properties
            scaled_label = f"[scaled{chain_index}]"
            base_ref_label = f"[base{chain_index}]"
            
            # Use scale2ref to access main_w and main_h, but force exact dimensions
            scale_filter = f"{src_label}{last_label}scale2ref=w={target_w_expr}:h={target_h_expr}:flags=bilinear{scaled_label}{base_ref_label}"
            filter_parts.append(scale_filter)
            
            # Overlay at specified position
            overlay_filter = f"{base_ref_label}{scaled_label}overlay=x={x_expr}:y={y_expr}:{enable}"
            new_label = next_label()
            filter_parts.append(f"{overlay_filter}{new_label}")
            last_label = new_label

        else:
            # unsupported overlay type; skip
            continue

    # Assemble filter_complex
    filter_complex = ";".join(filter_parts) if filter_parts else None

    # Build full command
    cmd: List[str] = ["ffmpeg", "-y"]
    cmd += input_args
    if filter_complex:
        cmd += [
            "-filter_complex", filter_complex, 
            "-map", last_label, 
            "-map", "0:a?", 
            "-c:v", "libx264", 
            "-preset", "medium",  # Better quality/speed balance
            "-crf", "23",         # Good quality
            "-c:a", "aac", 
            "-shortest"
        ]
    else:
        # no overlays; pass-through reencode
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac"]
    cmd += [output_path]

    if progress_cb:
        progress_cb(0.2, "Invoking ffmpeg")

    # Try to fetch input duration via ffprobe for better progress reporting
    duration_seconds: float | None = None
    try:
        probe = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=duration",
                "-of", "default=nokey=1:noprint_wrappers=1", input_path,
            ],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        if probe.returncode == 0:
            # Some files return multiple lines; take the max numeric value
            vals = []
            for line in probe.stdout.splitlines():
                try:
                    vals.append(float(line.strip()))
                except Exception:
                    pass
            if vals:
                duration_seconds = max(vals)
    except Exception:
        duration_seconds = None

    # Run ffmpeg and stream stderr for time= updates
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    time_re = re.compile(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d+)")
    try:
        if proc.stderr is not None:
            for line in proc.stderr:
                # Parse progress time
                m = time_re.search(line)
                if m and duration_seconds and progress_cb:
                    hh, mm, ss, ms = m.groups()
                    current = int(hh) * 3600 + int(mm) * 60 + int(ss) + float(f"0.{ms}")
                    ratio = max(0.0, min(1.0, current / duration_seconds))
                    # Map into 0.2..0.95 window
                    progress_cb(0.2 + ratio * 0.75, "Rendering")
        proc.wait()
    finally:
        if proc.stdout:
            proc.stdout.close()
        if proc.stderr:
            proc.stderr.close()

    if proc.returncode != 0:
        # Attempt to read last stderr output for context (already consumed in loop, so re-run minimal command is expensive).
        # Instead, signal generic failure.
        raise RuntimeError("ffmpeg failed (see server logs for details)")

    if progress_cb:
        # Bump to 0.99 to indicate finalization before job manager marks completed at 1.0
        progress_cb(0.99, "Finalizing")