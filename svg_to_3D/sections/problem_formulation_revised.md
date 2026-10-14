# Formulation

## General problem formulation

We treat an SVG as a structured observation of an unknown 3D scene. Our goal is to infer an **editable parametric scene with semantic structure and explicit correspondence to the source SVG**, so that supported edits can propagate in either direction. A single drawing admits many interpretations; we seek a plausible, controllable reconstruction that matches the source view and behaves coherently under those edits.

Let $G$ denote the SVG document, retaining element identities, geometry, styles, grouping, transforms, compositing order, and supported clipping and masking. Let $\mathcal S$ denote the scene: parametric surfaces, boundary-representation (B-rep) faces and edges, 3D curves, and analytic primitives, together with topology, materials, semantic parts, a scene graph, and editing parameters and constraints. SVG groups provide clues to this organization but need not correspond to physical parts.

These explicit constructions form the editable representation; tessellation may be used for rendering. Open surfaces and standalone curves are allowed, while components declared to be solids must satisfy the corresponding validity requirements. We collect the unknowns into

$$
B=(\mathcal S,\theta,\ell,Z,M,\phi),
$$

where $\theta$ is the reference camera, $\ell$ specifies lighting, $Z$ assigns feature roles, $M$ records correspondence, and $\phi$ controls stylization. The admissible class $\mathcal B_{\mathrm{valid}}$ enforces representation, topology, correspondence consistency, and stylization bounds. Coordinate and scale conventions are fixed; supplied camera or lighting settings are held constant.

Feature roles $Z$ are inferred: an SVG path, subpath, or region may depict a boundary, silhouette, surface feature, material transition, shading, shadow, or artistic mark. Correspondence $M$ links these observations to scene entities or generating rules, including parameter bindings and conditions such as visibility. Associations may be partial and many-to-many. Unseen geometry may lack an observed counterpart, while artistic marks may become surface decorations or bounded view-specific overlays.

For example, a smooth surface's silhouette changes with the camera. Its SVG contour should therefore link to the parent surface and a view-dependent extraction rule, rather than a permanent 3D curve. This preserves the underlying association even when visible segments split, merge, or disappear.

The forward model is

$$
\widehat G(B)
=\mathcal A_\phi\!\left(
\mathcal R_{\mathrm{vec}}(\mathcal S,\theta,\ell;Z)
\right).
$$

Here $\mathcal R_{\mathrm{vec}}$ generates projected vector features and regions, accounting for visibility, materials, and lighting. The operator $\mathcal A_\phi$ produces a structured SVG through permitted simplification, stroke treatment, and artistic displacement. Both retain provenance linking generated elements to their scene entities and rules. Complex appearance may require vector approximation. Stylization is restricted and penalized so that it cannot reproduce the drawing independently of the scene.

Correspondence is intended to let SVG edits update the associated 3D parts and let scene edits update the SVG, preserving semantic identity wherever possible. Such updates depend on assumptions about how edits should be interpreted. For this initial formulation, we leave those assumptions implicit and defer the precise rules and evaluation of edit propagation to later work.

We focus on reconstructing the scene and its correspondence through the conceptual objective

$$
\begin{aligned}
\mathcal L(B;G)
={}&\lambda_{\mathrm{img}}
D_{\mathrm{img}}\!\left(\rho(G),\rho(\widehat G(B))\right)\\
&+\lambda_{\mathrm{corr}}E_{\mathrm{corr}}(G,B)\\
&+\lambda_{\mathrm{prior}}E_{\mathrm{prior}}(\mathcal S,Z,M)
+\lambda_{\mathrm{style}}E_{\mathrm{style}}(\phi),
\end{aligned}
$$

with

$$
B^*\in\arg\min_{B\in\mathcal B_{\mathrm{valid}}}
\mathcal L(B;G).
$$

The nonnegative weights balance four criteria:

- **Appearance:** $D_{\mathrm{img}}$ compares the SVGs rasterized by $\rho$ under common settings.
- **Correspondence:** $E_{\mathrm{corr}}$ measures how closely each SVG feature matches the projected 3D feature assigned to it by the correspondence $M$. For example, a path interpreted as a silhouette should match the visible outline of its linked surface from the reference camera. The term penalizes mismatches and SVG features left unexplained.
- **Plausibility:** $E_{\mathrm{prior}}$ expresses assumptions such as smoothness, symmetry, part attachments, and economical constructions.
- **Stylization:** $E_{\mathrm{style}}$ penalizes the amount and complexity of artistic adjustments applied by $\mathcal A_\phi$, such as shifting projected curves or adding view-specific strokes. This encourages the reconstructed scene to account for the drawing, with stylization providing limited adjustments to its appearance.

Source-view agreement alone is insufficient: even flat parametric patches can reproduce a drawing. Modeling assumptions must reflect the intended use, and additional viewpoints help expose implausible geometry. They cannot establish the correctness of unseen surfaces without further evidence. The objective separates observable agreement from modeling assumptions; its losses must be instantiated for each experiment.

## Reinterpretation with coding agents

We explore the problem through **graphics-program synthesis**: a coding agent constructs an executable scene, runs it, inspects available outputs and diagnostics, and revises the program.

Let $\Gamma$ be the generated program and $\mathcal C$ its execution environment. Execution produces $B_\Gamma=\mathcal C(\Gamma)$, including the editable scene, correspondence metadata, and rendering settings. The program-level problem uses the same objective:

$$
\Gamma^*\in
\arg\min_{\Gamma:\,\mathcal C(\Gamma)\in\mathcal B_{\mathrm{valid}}}
\mathcal L(\mathcal C(\Gamma);G)
+\lambda_{\mathrm{prog}}\Omega(\Gamma),
$$

where $\Omega$ optionally penalizes program complexity. This searches the admissible constructions expressible in the chosen environment; generating code alone does not guarantee the required representation or editability.

Operationally, let $o^{(k)}$ contain the execution result, available renderings, and diagnostics for program $\Gamma^{(k)}$, including execution failures. The agent revises it through

$$
\Gamma^{(k+1)}
=\mathcal U_\psi\!\left(
G,\Gamma^{(k)},o^{(k)},e^{(k)}
\right),
$$

where $e^{(k)}$ is the evaluation feedback actually supplied and $\mathcal U_\psi$ denotes the revision procedure. Feedback may include appearance comparisons, validity checks, and correspondence checks. Each experiment should state which were used.

Raster previews can support inspection, while vector regeneration and bidirectional editing require separate outputs and checks. The objective specifies the desired result; it does not imply that GPT-6 internally computes these losses or that the revision loop converges to an optimum.
