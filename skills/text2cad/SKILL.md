---
name: "Text to CAD"
description: "Use when the user provides a natural language description of a 3D object or mechanical part and wants to generate a CAD model. Converts the description into CadQuery Python code, automatically detects or sets up the CadQuery environment, executes the script, and produces STL and STEP output files."
allowed-tools: []
---

# Text to CAD (CadQuery)

This skill converts a natural language description of a 3D object into a fully functional CadQuery Python script, executes it, and delivers STL + STEP files. The workflow is designed to handle everything from simple primitives ("a cube with rounded edges") to complex mechanical assemblies ("a flanged bearing housing with bolt holes").

## Phase 0: Environment Detection & Setup

Before generating any model, **automatically detect a working CadQuery environment**. Follow this sequence -- stop at the first success:

1. **Check if `cadquery` is already importable**:
   ```bash
   python -c "import cadquery; print(cadquery.__version__)"
   ```
   If this succeeds, use `python` directly as the interpreter.

2. **Search for conda/mamba environments that have cadquery**:
   ```bash
   conda env list
   ```
   For each environment found, test:
   ```bash
   conda run -n <env_name> python -c "import cadquery; print(cadquery.__version__)"
   ```
   If one succeeds, use `conda run -n <env_name> python` as the interpreter.

3. **Search for virtual environments in the working directory or common locations** (`.venv`, `venv`, `env`):
   ```bash
   # Linux/macOS
   .venv/bin/python -c "import cadquery; print(cadquery.__version__)"
   # Windows
   .venv/Scripts/python -c "import cadquery; print(cadquery.__version__)"
   ```

4. **If no environment found, install cadquery**:
   - Preferred: `pip install cadquery` (in current Python)
   - Fallback: `conda install -c conda-forge cadquery` (if conda is available)
   - Confirm installation succeeded before proceeding.

5. **Cache the result**: Once a working interpreter command is found, reuse it for all subsequent executions in this session. Store it as `CADQUERY_PYTHON` (e.g., `python`, `conda run -n myenv python`, `.venv/bin/python`).

If all attempts fail, inform the user and provide manual installation instructions:
```
pip install cadquery
# or
conda install -c conda-forge cadquery
```

---

## Phase 1: Requirement Analysis & Clarification

When the user provides a natural language description:

1. **Parse the description** to extract:
   - **Geometry type**: primitive (box, cylinder, sphere), composite, or assembly
   - **Dimensions**: explicit measurements (mm by default) or relative sizing
   - **Features**: holes, fillets, chamfers, patterns, text, threads, etc.
   - **Spatial relationships**: positions, alignments, symmetry
   - **Material/functional hints**: load-bearing, aesthetic, printable, etc.

2. **Fill in missing details intelligently**:
   - If no units specified -> assume millimeters (mm)
   - If no dimensions specified -> infer reasonable engineering defaults based on the object type
   - If ambiguous geometry -> choose the most common/standard engineering interpretation
   - If "printable" mentioned -> ensure manifold geometry, add appropriate tolerances

3. **Confirm understanding** (brief, 2-3 sentences):
   - Summarize what you will model
   - State key dimensions and features
   - Note any assumptions made
   - Ask the user to confirm or adjust before proceeding

---

## Phase 2: Code Generation

Generate a complete, self-contained CadQuery Python script following these **mandatory rules**:

### Code Structure Template

```python
"""
CadQuery Model: {model_name}
Description: {user_description}
Generated dimensions: {key_dimensions}
Units: millimeters (mm)
"""

import cadquery as cq
import os

# ============================================================
# Parameters (easy to modify)
# ============================================================
# Group all dimensional parameters at the top for easy tweaking
PARAM_NAME = value  # description, unit

# ============================================================
# Output Configuration
# ============================================================
# Output to an "output" folder relative to this script's location.
# The user can override OUTPUT_DIR if they prefer a different path.
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
MODEL_NAME = "{model_name}"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# Model Construction
# ============================================================
# Build the model step by step with comments explaining each operation

result = (
    cq.Workplane("XY")
    .box(...)
    # ... operations ...
)

# ============================================================
# Export
# ============================================================
step_path = os.path.join(OUTPUT_DIR, f"{MODEL_NAME}.step")
stl_path = os.path.join(OUTPUT_DIR, f"{MODEL_NAME}.stl")

cq.exporters.export(result, step_path)
cq.exporters.export(result, stl_path)

print(f"Model '{MODEL_NAME}' generated successfully!")
print(f"   STEP: {step_path}")
print(f"   STL:  {stl_path}")

# Print bounding box for verification
bb = result.val().BoundingBox()
print(f"   Bounding Box: {bb.xlen:.2f} x {bb.ylen:.2f} x {bb.zlen:.2f} mm")
```

### CadQuery API Best Practices

**Primitives & Basic Shapes:**
- `cq.Workplane("XY").box(length, width, height)` -- centered box
- `cq.Workplane("XY").cylinder(height, radius)` -- centered cylinder
- `cq.Workplane("XY").sphere(radius)` -- sphere
- `cq.Workplane("XY").wedge(dx, dy, dz, xmin, zmin, xmax, zmax)` -- wedge/prism

**2D Sketch -> 3D Extrusion (most versatile pattern):**
```python
result = (
    cq.Workplane("XY")
    .moveTo(x, y).lineTo(...).lineTo(...).close()  # sketch profile
    .extrude(height)  # or .revolve(angleDegrees, axisStart, axisEnd)
)
```

**Feature Operations:**
- `.fillet(radius)` -- round all edges (use with `.edges("|Z")` etc. for selective)
- `.chamfer(distance)` -- chamfer edges
- `.hole(diameter, depth=None)` -- through or blind hole at center
- `.cboreHole(diameter, cboreDiameter, cboreDepth)` -- counterbore hole
- `.cskHole(diameter, cskDiameter, cskAngle)` -- countersink hole
- `.shell(thickness)` -- hollow out (negative = inward)

**Face/Edge Selection (critical for targeted operations):**
- `.faces(">Z")` -- topmost face in Z
- `.faces("<Z")` -- bottommost face in Z
- `.edges("|Z")` -- edges parallel to Z
- `.edges(">Z")` -- topmost edges in Z
- `.edges("%Circle")` -- circular edges
- `.faces("+Z")` -- faces with normal pointing in +Z direction

**Boolean Operations:**
- `.cut(other_shape)` -- subtract
- `.union(other_shape)` -- add
- `.intersect(other_shape)` -- intersection

**Patterns & Arrays:**
- `.pushPoints([(x1,y1), (x2,y2), ...])` -- place features at points
- `.rarray(xSpacing, ySpacing, xCount, yCount)` -- rectangular array
- `.polarArray(radius, startAngle, angle, count)` -- circular array

**Advanced:**
- `.sweep(path)` -- sweep a profile along a path
- `.loft()` -- loft between profiles
- `.twistExtrude(height, angleDegrees)` -- helical extrusion
- `.text("text", fontsize, distance)` -- embossed/engraved text
- `.mirror("XY")` -- mirror about a plane
- `.translate((x, y, z))` -- move
- `.rotate((0,0,0), (0,0,1), angleDeg)` -- rotate

**Multi-body / Assembly Pattern:**
```python
part_a = cq.Workplane("XY").box(10, 10, 10)
part_b = cq.Workplane("XY").transformed(offset=(20, 0, 0)).cylinder(10, 5)
result = part_a.union(part_b)
```

### Code Quality Rules

1. **All parameters at the top** -- no magic numbers in the modeling section
2. **Descriptive variable names** -- `flange_diameter`, not `d1`
3. **Step-by-step comments** -- explain what each operation does in context
4. **Build incrementally** -- complex models should be built in logical stages
5. **Selective fillet/chamfer** -- use face/edge selectors, not blanket `.fillet()` which often fails
6. **Error-safe ordering**: fillet/chamfer operations MUST come AFTER all boolean cuts/unions. Fillets on edges that get modified by later booleans will crash
7. **Manifold geometry** -- ensure the result is a valid solid (no self-intersections)
8. **Reasonable tolerances** -- if parts need to fit together, add 0.1-0.2mm clearance

### Common Pitfalls to AVOID

- `.fillet()` with radius >= smallest edge length -> crash. Always use conservative radii.
- `.shell()` on complex geometry with thin walls -> often fails. Keep wall thickness reasonable.
- Chaining too many operations without `.clean()` -> geometry corruption. Add `.clean()` after complex booleans.
- Forgetting that `.box()` and `.cylinder()` are centered by default.
- Using `.faces(">Z").fillet()` when there are multiple faces at the same Z height -> ambiguous selection.
- Applying `.fillet()` before `.cut()` -- fillet edges may be destroyed by the cut.

---

## Phase 3: Execution

1. **Determine the working directory**: Use the user's current working directory (or a temporary directory) to write the script. Write the script to `{working_dir}/{model_name}.py`.
2. **Execute** using the interpreter found in Phase 0:
   ```bash
   {CADQUERY_PYTHON} {working_dir}/{model_name}.py
   ```
   Where `{CADQUERY_PYTHON}` is the cached interpreter command from environment detection.
3. **Set timeout** to 60 seconds (complex models may take time)

---

## Phase 4: Auto-Debug (up to 5 attempts)

If execution fails, follow this diagnostic protocol:

| Error Type | Diagnosis | Fix Strategy |
|---|---|---|
| `Standard_ConstructionError` | Fillet/chamfer radius too large | Reduce radius to 50% of smallest adjacent edge |
| `BRep_API: not done` | Boolean operation failed | Add `.clean()` before boolean; simplify geometry |
| `StdFail_NotDone` | Impossible geometric operation | Re-order operations; split into sub-steps |
| `ValueError: No wire found` | Unclosed sketch profile | Ensure `.close()` is called; check `.lineTo()` endpoints |
| `Selector found no objects` | Face/edge selector matched nothing | Use simpler selectors; print available faces/edges for debugging |
| `ModuleNotFoundError` | Missing package | Install via `pip install {package}` using the detected interpreter's environment, then retry. If cadquery itself is missing, re-run Phase 0 |
| `MemoryError` or timeout | Model too complex | Reduce polygon count; simplify fillets |

**Debug approach:**
1. Read the full traceback
2. Identify the exact failing CadQuery operation
3. Apply the targeted fix from the table above
4. If unclear, add diagnostic prints: `print(result.faces().vals())` to inspect geometry state
5. Rebuild and re-execute

---

## Phase 5: Result Verification & Delivery

After successful execution:

1. **Verify output files exist** and have non-zero size
2. **Report to user**:
   - Confirmation of success
   - Bounding box dimensions (X x Y x Z mm)
   - File paths (STEP and STL)
   - Brief description of modeling approach
   - Suggestions for modifications (optional parameters to tweak)

3. **Offer follow-up options**:
   - "Want me to adjust any dimensions?"
   - "Need additional features (holes, fillets, text)?"
   - "Want to generate a variant or assembly?"
   - "Need the code explained step by step?"

---

## Phase 6: Iterative Refinement

If the user requests changes:
1. **Read the existing script** to understand current state
2. **Apply targeted modifications** -- don't regenerate from scratch unless major restructuring is needed
3. **Re-execute and verify** with the same pipeline
4. **Show diff** -- briefly describe what changed

---

## Mechanical Parts Library (reference patterns)

**Bolt/Screw:**
```python
head = cq.Workplane("XY").cylinder(head_height, head_radius)
shaft = cq.Workplane("XY").workplane(offset=-head_height).cylinder(shaft_length, shaft_radius)
result = head.union(shaft)
```

**Gear (simplified profile):**
```python
result = (
    cq.Workplane("XY")
    .circle(outer_radius)
    .extrude(thickness)
    .faces(">Z")
    .workplane()
    .hole(bore_diameter)
    .faces(">Z")
    .workplane()
    .polarArray(pitch_radius, 0, 360, num_teeth)
    .rect(tooth_width, tooth_height)
    .cutThruAll()
)
```

**Enclosure/Box with lid:**
```python
body = cq.Workplane("XY").box(L, W, H).edges("|Z").fillet(corner_r).shell(-wall)
lid = cq.Workplane("XY").workplane(offset=H/2).box(L, W, lid_h).edges("|Z").fillet(corner_r)
```

**Pipe/Tube:**
```python
result = (
    cq.Workplane("XY")
    .circle(outer_radius)
    .circle(inner_radius)  # concentric circle creates annular profile
    .extrude(length)
)
```

**Flange:**
```python
result = (
    cq.Workplane("XY")
    .circle(flange_radius).extrude(flange_thickness)
    .faces(">Z").workplane()
    .circle(pipe_radius).extrude(pipe_length)
    .faces("<Z").workplane()
    .pushPoints(bolt_hole_positions)
    .hole(bolt_hole_diameter)
    .faces("<Z").workplane()
    .hole(bore_diameter)
)
```

---

## Quality Checklist (verify before delivering)

- [ ] Script runs without errors
- [ ] Both STL and STEP files generated with non-zero size
- [ ] Bounding box matches expected dimensions (within 1%)
- [ ] All user-specified features present
- [ ] Parameters are clearly labeled and at the top of the script
- [ ] Code is well-commented and readable
- [ ] Fillets/chamfers applied AFTER all boolean operations
- [ ] No magic numbers in modeling section

---

## Response Language

Always respond in the **same language as the user's message**. If the user writes in Chinese, respond in Chinese. If in English, respond in English.
