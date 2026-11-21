# Agent instructions: lift an SVG into an editable 3D scene

Given `INPUT_SVG`, reconstruct an editable 3D scene with persistent memory that subsequent agents can inspect and modify. **The primary deliverable is `OUTPUT_DIR/scene.blend`, a complete, editable Blender scene.** Deliver its construction code, SVG correspondence, evaluated results, and a web view of the actual memory graph as supporting artifacts. Follow user requirements and reuse project tools. Work in `OUTPUT_DIR` (default: `outputs/<input-stem>/`); preserve the source SVG.

**Software environment and access.**

Use the installed Blender executable at `/Applications/Blender.app/Contents/MacOS/Blender`. Build, inspect, save, and render scenes through Blender's Python API (`bpy`) in background mode. Blender 5.0.1 is installed on this machine; record the version actually used. Implement `build_scene.py` to accept the arguments after `--`; for example, with `INPUT_SVG` and `OUTPUT_DIR` set to resolved paths:

```sh
"/Applications/Blender.app/Contents/MacOS/Blender" \
  --background --python-exit-code 1 \
  --python "$OUTPUT_DIR/build_scene.py" -- \
  --input "$INPUT_SVG" --output "$OUTPUT_DIR"
```

The build script must explicitly save `scene.blend`, for example with `bpy.ops.wm.save_as_mainfile(filepath=...)`. Preserve editable curves, surfaces, parameters, modifiers, and node constructions where applicable. Package external parametric/B-rep sources and rebuild bindings when Blender stores only their display geometry.

You may create a task-local Python environment for SVG parsing, graph operations, geometry helpers, and validation if needed:

```sh
mkdir -p "$OUTPUT_DIR"
python3 -m venv "$OUTPUT_DIR/.venv"
# Create requirements.txt with the dependencies actually needed, then install:
"$OUTPUT_DIR/.venv/bin/python" -m pip install -r "$OUTPUT_DIR/requirements.txt"
```

Reuse a suitable existing environment when available; record dependency versions. Blender uses its own Python interpreter: run `bpy` scripts through Blender, and do not assume packages in the virtual environment are available inside it. Exchange data through files or explicit interfaces.

**The computer screen cannot be used.** Do not open or control GUI applications, interact with a desktop browser, or capture desktop screenshots. Use command-line tools and headless execution. Inspect saved render images, exported geometry, and machine-readable diagnostics; validate the web graph with headless browser automation when available.

**1. Define the reconstruction.**

Let $G$ be the source SVG. Infer

$$
B=(\mathcal S,\theta,\ell,Z,M,\phi),\qquad B_\Gamma=\mathcal C(\Gamma),
$$

where $\mathcal S$ contains geometry, topology, semantic parts, materials, transforms, and editable parameters; $\theta$ is the reference camera; $\ell$ is lighting; $Z$ assigns SVG feature roles; $M$ records correspondence; and $\phi$ specifies bounded stylization. $\Gamma$ is executable construction code and $\mathcal C$ is its execution environment.

Retain explicit curves, parametric surfaces, analytic primitives, and applicable B-rep topology as authoritative geometry, with meaningful parameters and construction history. Tessellation is permitted for rendering; a mesh-only result or a flat image on a plane is insufficient.

Seek an admissible scene with low conceptual loss:

$$
\begin{aligned}
\mathcal L(B;G)={}&\lambda_{\mathrm{img}}D_{\mathrm{img}}(\rho(G),\rho(\widehat G(B)))
+\lambda_{\mathrm{corr}}E_{\mathrm{corr}}(G,B)\\
&+\lambda_{\mathrm{prior}}E_{\mathrm{prior}}(\mathcal S,Z,M)
+\lambda_{\mathrm{style}}E_{\mathrm{style}}(\phi),\\
\widehat G(B)={}&\mathcal A_\phi(\mathcal R_{\mathrm{vec}}(\mathcal S,\theta,\ell;Z)).
\end{aligned}
$$

These terms assess appearance, correspondence, geometric plausibility, and artistic adjustments. Define the measurements actually used; do not invent scores for unimplemented terms. If only raster rendering is available, compare that output with $\rho(G)$ and explicitly mark vector regeneration as unimplemented. Limit stylization so it cannot conceal an incorrect scene.

**2. Inspect the input and record assumptions.**

- Render and parse $G$: retain IDs, transforms, paint order, styles, clipping, and animation. Assign stable references to anonymous elements. Identify semantic parts; SVG groups need not be physical parts.
- Classify relevant paths or regions as boundaries, silhouettes, material features, shadows, or artistic marks. Store uncertain interpretations as hypotheses. Hidden shape is inferred; projected crossings do not establish 3D intersections.
- Record units, axes, camera model, reference view, and depth assumptions. For animated SVGs, inspect representative poses and preserve timing, motion, and part identities.
- Translate user instructions, selections, and dragged handles into requirements or preferences attached to entity IDs. Record origin, priority, tolerances, and permitted changes. Clarify blocking conflicts while continuing independent work.
- Save evaluation settings, acceptance tolerances, and any supplied resource budget before iterating. Do not loosen criteria merely to declare success.

**3. Create operational persistent memory.**

Use a typed, versioned JSON graph $\mathcal H$ with schema validation and a small query/edit API. Implement only needed operations. Reference large assets externally; keep web layout separate from scene geometry.

Minimum records:

| Record | Required contents |
| --- | --- |
| Scene | Schema version, revision, source path/hash, units, axes, references to the components of $B$. |
| Entity | Stable ID, type, semantic label, parameters with units/frames, executable construction or geometry reference, provenance. Types include parts, curves, surfaces, solids, materials, frames, joints, and parameters. |
| Relation | Stable ID, relation type, named participants. Distinguish containment, geometric connectivity, articulation, material binding, construction dependency, and correspondence. |
| Constraint | Relation, target IDs, frame, hard/soft status, tolerance or weight, origin, permitted variables, evaluator identifier. |
| Evaluation | Check ID, evaluated revision and input hashes, evaluator version/settings, status, measurements, affected entities, diagnostic/artifact references. |

Validate references and topology. Construction dependencies need an executable order; constraints may contain cycles. Preserve IDs across parameter changes; remap splits/merges or report unresolved references.

Make $M$ operational: link SVG elements/subpaths to scene entities, feature roles, and parameter bindings or generating rules. Support partial, many-to-many associations and identify unexplained source features. Bind silhouettes to a surface and view-dependent extraction rule. Mark inferred geometry separately from observed evidence.

Graph parameters must drive $\Gamma$, whose output uses the same entity IDs. Version construction changes with the graph so saved code and memory reproduce the scene.

**4. Construct, evaluate, and revise.**

Start with part arrangement and coarse shape; then refine surfaces, attachments, appearance, and motion. Keep the reference camera fixed during local shape edits unless the camera hypothesis is explicitly being revised.

Use $o^{(k)}$ for execution outputs: scene snapshots, renders, bindings, and diagnostics. Use $e^{(k)}$ for assessments: appearance discrepancies, correspondence errors, and geometric checks. A collision Boolean is evaluation feedback; include the offending IDs and, when available, magnitude and witness geometry. Distinguish `pass`, `fail`, `unknown`, and `not_evaluated`.

Apply symmetry, parallelism, orthogonality, and tangent regularity selectively. Smooth joins require position agreement as well as compatible tangents. Define allowed attachment/contact regions before penalizing overlap. Specify thickness/intersection policies for curves and sheets. For motion, record checked poses or intervals; sampled checks do not certify the entire trajectory. Use constrained construction or solving for hard requirements; use soft penalties for uncertain regularities.

The following is workflow pseudocode; implement or adapt these interfaces:

```python
memory = load_or_initialize(INPUT_SVG, OUTPUT_DIR)
baseline = execute_and_evaluate(memory)  # returns diagnostics even on failure
while not acceptance_met(memory, baseline):
    honor_user_updates(memory)
    task = choose_failure_or_unresolved_hypothesis(memory, baseline)
    context = memory.query(task.entity_ids, relevant_relations=True,
                           fields=task.required_fields)
    candidate = propose_local_edit(context, task, base_revision=memory.revision)
    validate_schema_references_and_edit_scope(candidate)
    outputs = execute(candidate, rebuild=affected_dependencies(candidate))
    feedback = evaluate(outputs, checks=affected_checks(candidate))
    if acceptable_progress(candidate, feedback, baseline):
        memory.commit(candidate, outputs, feedback)  # atomic new revision
        baseline = memory.current_evaluations()  # include unaffected valid checks
    else:
        record_rejected_attempt(candidate, feedback)  # preserve accepted state
    checkpoint(memory, next_action=True)
    if supplied_budget_exhausted() or genuinely_blocked():
        mark_incomplete_with_reason(); break
final_evaluation = rebuild_and_validate_selected_revision(memory)
export_deliverables(memory, final_evaluation)
```

Prioritize hard requirements and user intent. Preserve the best recoverable state and remaining failures. On a plateau, reconsider geometry, feature roles, or depth assumptions. Report conflicting constraints rather than silently dropping them.

**5. Keep context and execution efficient.**

Checkpoint the accepted revision, assumptions, failures, rejected hypotheses, and next action. Resume from that summary and relevant subgraphs. Query selected fields and bounded neighborhoods; retrieve full geometry or logs only when needed.

Cache builds, renders, and checks by dependency hashes, settings, and tool versions; invalidate affected results after edits. Use cheap checks and low-resolution previews before final validation. Record iterations, tool calls, runtime, and available token usage; claim savings only with a comparison.

**6. Verify and deliver.**

Rebuild the selected revision from saved state. Reopen the saved `scene.blend` in a fresh background Blender process and confirm it renders without missing dependencies. Inspect saved reference-view and novel-view images; verify required constraints, correspondence coverage, and animation where applicable. Demonstrate one representative parameter edit followed by rebuilding and updated evaluation, then restore or retain it explicitly. General bidirectional SVG editing may remain future work; report exactly what propagation is implemented. Unknown required checks prevent an unqualified success claim.

Deliver under `OUTPUT_DIR`:

- **`scene.blend` — the main deliverable:** editable parts, materials, camera, lighting, and any required animation, with stable IDs linked to the persistent graph. Pack supported external assets or include them with resolvable relative paths.
- `scene.json`, its schema, referenced geometry, and executable construction/query/edit tools, with dependency versions and exact rebuild commands.
- Revision history/checkpoint, reference and novel-view renders, evaluation results, and a short report of achieved requirements, assumptions, failures, and unevaluated capabilities.
- `web/index.html` and its assets: a browsable graph generated from the delivered scene records, with typed relationship filters and node details for parameters, correspondence, constraints, and revision-specific feedback. Keep presentation in a separate layout file. Verify with headless browser automation, or report that verification as unavailable, and provide its local serving command; publication is not required.

The web graph must reflect the reconstructed scene and actual recorded evaluations, rather than manually authored illustrative claims. Complete the reconstruction and its artifacts; an architectural plan or graph illustration alone is insufficient.
