
## Practical Considerations

</br>

### Can GPT6 *one-shot* this?

</br>

In our preliminary experiments, we observed GPT6 Astra can solve - to a reasonable extent - the the task of lifting an input SVG to a structured, editable 3D scene, given just a simple prompt. The results, while only qualitatively evaluated, are incredible to say the least, specifically the reconstruction quality, semantic structure, parametric geometry, and image-based similarity. Yet, 
- how do we improve the results,
- incorporate user feedback and desires not expressible by text,
- and reduce token usage.



### Persistent Representation and DSLs

<!-- <figure class="reconstruction-graph" data-reconstruction-graph="flying-bird">
  <img src="../assets/diagrams/flying-bird-graph.svg" alt="Persistent graph for the flying bird: source SVG correspondence, semantic parts, editable wing geometry and pose, execution outputs, and evaluation feedback." width="1080" height="828" loading="lazy">
  <figcaption>A proposed persistent representation for the flying bird. SVG layer names come from the source artwork; the 3D constructions and checks are illustrative. Arrows distinguish hierarchy, correspondence, and downstream use. The front wing is expanded to show its editable records.</figcaption>
</figure> -->

We maintain the reconstruction as a persistent graph of geometric entities, semantic parts, parameters, and constraints, and optionally, with explicit correspondence to the source SVG. This graph would provide shared state for the agent i.e. a **editable memory**, and its tools across iterations. Different relations would describe part hierarchies, geometric connectivity, articulation, and construction dependencies. Named parameters exposes properties such as radii, control points, thicknesses, and joint angles, while constraints would record their targets, tolerances, and whether they express requirements or inferred preferences. Persistent identifiers and construction history would let feedback and user edits refer to the same parts across agent revisions, with explicit remapping when geometry splits or merges.

DSL defines operations for constructing, querying, and editing this graph. Local edits could trigger rebuilding and evaluation of only the affected dependencies, while versioned state would support rollback and prevent stale feedback from guiding later revisions. The research question is whether this explicit structure improves reconstruction quality and reduces context size, token usage, and execution time.

<!-- REVIEW: The graph idea is useful; sharpen what makes it a language.

What you currently describe is principally a persistent scene representation, or intermediate representation (IR). A DSL adds defined construction, query, and editing operations with execution semantics. It can be a small Python API or a declarative schema; a new textual syntax is optional. The useful research question is whether an SVG-aware language makes the required representations and correspondences easier to construct, inspect, and revise.

"A domain-specific language could represent the reconstruction as a persistent graph of geometric entities, semantic parts, parameters, and constraints, with explicit links to the source SVG. Programs would construct and edit this graph through named operations, while a geometry backend would evaluate curves, surfaces, topology, and rendering. The graph would provide shared state for the agent and its tools, enabling local queries and edits without regenerating the entire scene.


The language should distinguish semantic containment, geometric connectivity, articulation, construction dependencies, and SVG correspondence. Constraints would reference stable entities and specify their coordinate frames, tolerances, and whether they are requirements or inferred preferences. Generated features would retain their construction history and source associations, allowing evaluation results and user edits to refer to the same parts across revisions."

Concrete design ideas to explore:

1. Typed entities and relations. Separate curves, surfaces, solids, materials, frames, joints, parameters, and constraints. A part hierarchy is not the same graph as B-rep adjacency, and an articulation edge is not automatically a surface attachment. Store them as distinct relation types. Let correspondence link SVG subpaths or regions to multiple entities or view-dependent feature rules.

2. Persistent IDs and provenance. Separate semantic IDs from transient kernel face indices. Record which operation generated each face, edge, and projected contour. Splits, merges, and topology changes need explicit remapping or an unresolved-reference diagnostic; merely assigning an ID does not solve persistence. Track inferred hidden geometry separately from geometry supported by observed SVG features.

3. Parameters with units and frames. Expose radii, control points, thicknesses, local transforms, and joint angles as named parameters. Declare dependencies such as shared radii or mirrored geometry so they remain satisfied by construction. Distinguish canonical shape from articulated pose.

4. SVG-aware construction and correspondence. Candidate operations include fitting a 3D curve to an SVG path under a camera, lofting sections, sweeping a profile, constructing a surface patch, and binding a path to a silhouette generator. Each operation must expose its assumptions: fitting one projected path does not uniquely determine depth, and a silhouette is not normally a fixed material curve on a surface.

5. Declarative constraints and bounded solving. Store relation type, target IDs, parameters, hard/soft status, tolerance, and origin (user requirement, geometric rule, or inferred hypothesis). Define exactly which parameters a solve may change; otherwise it may satisfy a shape relation by moving the camera. Report residuals and conflicts, with rollback when a proposed repair breaks another requirement.

6. Local queries and transactional edits. Support operations such as querying a part's constraints or SVG links, changing a parameter, replacing a surface construction, and re-evaluating the affected dependency subgraph. A patch should carry an expected scene revision and either commit consistently or return a failure. Persisted graph state is an external working memory, not a claim about the model's internal memory.

7. Multiple interpretations. Allow competing hypotheses for an ambiguous crossing, attachment, or symmetry relation before committing to one scene. Include the supporting evidence and a hypothesis status; do not treat model-generated confidence values as calibrated probabilities.

An illustrative interface, not implemented code, could look like:

    scene.set_parameter("wheel.radius", value=0.4, units="scene_units")
    scene.bind_svg("wheel_outline", target="wheel", feature="silhouette", camera="reference")
    scene.add_constraint("coaxial", targets=["wheel.axis", "axle.axis"], mode="hard")
    scene.check("forbidden_overlap", targets=["wheel", "frame"], policy="assembly_contacts")

These operations assume the named entities and contact policy already exist. The implementation must define how they resolve to actual geometry, how edits invalidate renderings and feedback, and how silhouette associations survive visibility changes.

Start with a small typed Python API and serialized graph over an existing geometry backend. CadQuery already demonstrates tagged sketch entities, constraints, and construction operations such as extrude, sweep, and loft; its documented sketch solver has a restricted, experimental scope, so it should not be assumed to handle arbitrary 3D surface constraints. See https://cadquery.readthedocs.io/en/latest/sketch.html

The proposed contribution would be the SVG correspondence, semantic structure, constraint policies, and reliable incremental edits layered over those geometric capabilities. Keep an explicit escape mechanism for geometry the initial language cannot express, while recording its parameters and provenance. A compact DSL can reduce repeated code, but an overly narrow one can force inappropriate geometry or increase repair work; compare it with ordinary Python using the same backend and evaluations.


REVIEW: State observed capability separately from proposed improvements.


Useful harness additions include persistent entity IDs, versioned scene snapshots, incremental rebuilding, cached renders and evaluations, and targeted feedback on changed parts. For feedback beyond prose, let users select an SVG path or 3D part, drag a handle, mark a contact region, or specify a symmetry plane. Store these interactions as explicit constraints associated with IDs.

To test benefit, compare the same tasks and model settings with: (1) the existing workflow, (2) added checks, (3) checks plus solver-assisted repairs, and (4) the proposed structured language. Repeat stochastic runs and report quality alongside tokens, elapsed time, and tool calls. Any token savings from structured queries or compact edits are hypotheses to measure, including the cost of tool schemas and feedback.
-->

### Execution Outputs

Execution outputs o^(k) include the parametric scene, its correspondence records, rendered views, and execution diagnostics. Evaluation feedback e^(k) assesses these artifacts through appearance comparisons, geometric checks, and correspondence checks.

<!-- REVIEW: Suggested text and concrete tool interface.

"  Although a collision Boolean is technically a tool output, we classify it as evaluation feedback because it assesses a requirement of the scene."

Useful inspection outputs include reference-camera renders, silhouette and part-ID passes, selected novel views, and local frames or control curves. These can make failures visible without requiring the agent to repeatedly inspect the entire scene. A novel view supplies diagnostic evidence, not a ground-truth target for hidden geometry.

Prefer structured feedback over an unlabelled scalar. An illustrative record is:
{check: "forbidden_overlap", entities: ["wheel", "frame"], status: "fail", scene_revision: 12, witness_region: "...", tolerance: "..."}

When possible, add a magnitude with units and a visualization. Keep validity failure, solver failure, and "not evaluated" distinct. Associate feedback with the exact scene revision and invalidate affected results after edits; stale checks should not be mistaken for evidence about the updated scene.
-->

<!-- 
## Execution outputs and evaluation feedback
 -->

### Constraints and Regularization

Geometric checks provide explicit feedback on relations such as symmetry, parallelism, orthogonality, smooth curve joins, and unwanted interpenetration. Each check applies to identified scene entities and returns a result together with the affected parts and relevant measurements. Explicitly defining constraints and regularization can steer the agents output to our requirements. These are expressed as programs the agent will be provided as input and can invoke and get scalar or vector outputs that are appended to $e^{(k)}$.

<!-- 
| Candidate | Where it can help | What must be specified or inferred |
| --- | --- | --- |
| Local symmetry | Repeated or approximately mirrored parts, symmetric cross-sections | Which neighborhoods correspond, the reflection plane or axis, and the coordinate frame. Articulated parts can be symmetric in their local/rest frames while having different poses. Use a soft preference for inferred symmetry; stylized or deliberately asymmetric parts should remain possible. |
| Parallelism / orthogonality | Wheel axes, frame members, planar faces, mechanical assemblies | Constrain named 3D axes, directions, or normals. Perspective does not preserve parallelism in general, and projection does not preserve right angles in general. Apparent 2D alignment is evidence for a hypothesis, not sufficient proof of a 3D relation. |
| Tangent orthogonality at intersections | Curve networks intended to describe orthogonal surface directions or known perpendicular connections | First determine whether the curves truly meet in 3D. A crossing in the SVG may instead be occlusion or a decorative mark. A real intersection alone does not imply perpendicular tangents. Apply this only to selected intersections with supporting geometric or semantic evidence. |
| Tangent parallelism / continuity | Smooth joins between curve segments and aligned directions at selected points | For a smooth join, enforce endpoint coincidence as well as aligned tangents. Parallel tangents at distant points do not establish a join. Geometric tangent continuity (G1) does not require equal derivative magnitudes; parametric C1 continuity does. Neither condition should be imposed across an intended corner. |
| Avoiding interpenetration | Separate rigid parts and self-intersecting surfaces | Identify forbidden overlaps, permitted contact, intended unions, and attachment regions. Solid-volume overlap, surface intersection, and curve clearance require different checks. Curves and open sheets need an explicit thickness or intersection policy if they represent physical parts. | -->

<!-- REVIEW: Feasibility, ambiguity, and suggested elaboration.

For example, SolveSpace documents symmetry, perpendicularity, and parallel/tangent constraints, including the distinction between constraints in 3D and constraints on a workplane projection: https://solvespace.com/ref.pl


Open CASCADE provides minimum-distance queries with witness points and containment information, and Boolean intersection operations; these are ingredients rather than a complete collision policy:
- https://occt3d.com/dev/doc/refman/html/class_b_rep_extrema___dist_shape_shape.html
- https://github.com/Open-Cascade-SAS/OCCT/wiki/boolean_operations

For articulated scenes, collision checks must also specify the pose or motion interval. Checking sampled poses is useful but does not guarantee collision-free motion between them.

Separate three operations in the prose: a checker measures a relation, a regularizer assigns a penalty, and a solver or construction rule enforces it. Appending a measurement to e^(k) supplies feedback but does not guarantee enforcement. Hard requirements can restrict B_valid; uncertain inferred relations can contribute to E_prior. This fits the existing formulation without restoring the separate edit-loss term removed earlier.

-->



<!-- ###  Harness and Tools -->
