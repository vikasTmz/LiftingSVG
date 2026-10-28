# Formulation

<br>

<!-- Operations that depend on depth, surface orientation, viewpoint, lighting, or physical spatial relationships are natural in 3D. These operations are not instrinsic to vector graphics. An SVG can imitate many 3D effects if you precompute them, but it does not possess the underlying 3D scene needed to recompute them generically.  -->

We treat an SVG as a structured observation of an unknown 3D scene. Our goal is to infer an **editable parametric scene with semantic structure and explicit correspondence to the source SVG**, so that supported edits can propagate in either direction. A single drawing admits many interpretations; we seek a plausible, controllable reconstruction that matches the source view and behaves coherently under those edits.

Let $G$ denote the SVG document, retaining element identities, geometry, styles, grouping, transforms, compositing order, and supported clipping and masking. Let $\mathcal S$ denote the scene: parametric surfaces, boundary-representation (B-rep) faces and edges, 3D curves, and analytic primitives, together with topology, materials, semantic parts, a scene graph, and editing parameters and constraints. SVG groups provide clues to this organization but need not correspond to physical parts.

Given an SVG $G$ as input, we wish to estimate:
$$
B=(\mathcal S,\theta,\ell,Z,M,\phi),
$$

where
- $\theta$ is the reference camera,
- $\ell$ specifies lighting,
- $Z$ assigns feature roles,
- $M$ records correspondence, and
- $\phi$ controls stylization.

The admissible class $\mathcal B_{\mathrm{valid}}$ enforces representation, topology, correspondence consistency, and stylization bounds.


<!-- $Z=\{z_i\}$ specifies which geometric phenomena should generate SVG elements and what their roles are. For example,

$$
z_i\in
\{
\text{boundary},
\text{silhouette},
\text{shading effects},
\text{feature curve},
\text{intersections},
\ldots
\}.
$$ -->

<!-- Note, $Z$ is not fixed. An SVG path might correspond to a 3D boundary, silhouette, intersection curve, surface feature, texture/material boundary, or even a purely artistic stroke. -->

<!-- Feature roles $Z$ are inferred: an SVG path, subpath, or region may depict a boundary, silhouette, surface feature, material transition, shading, shadow, or artistic mark. Correspondence $M$ links these observations to scene entities or generating rules, including parameter bindings and conditions such as visibility. Associations may be partial and many-to-many. Unseen geometry may lack an observed counterpart, while artistic marks may become surface decorations or bounded view-specific overlays. -->


The forward model is

$$
\widehat G(B)
=\mathcal A_\phi\!\left(
\mathcal R_{\mathrm{vec}}(\mathcal S,\theta,\ell;Z)
\right).
$$

Here $\mathcal R_{\mathrm{vec}}$ generates projected vector features and regions, accounting for visibility, materials, and lighting. It determines what the 3D scene produces in the image: projected shapes, visible silhouettes, material boundaries, shading regions, and shadows, given the camera and lighting. The operator $\mathcal A_\phi$  determines how those results are drawn in the SVG: stroke widths, curve simplification, stylized colors, or small artistic displacements.

Correspondence is intended to let SVG edits update the associated 3D parts and let scene edits update the SVG, preserving semantic identity wherever possible. Such updates depend on assumptions about how edits should be interpreted. For this initial formulation, we leave those assumptions implicit and defer the precise rules and evaluation of edit propagation to later work.

<!-- Across a collection of SVGs, we can express the objective as an expected reconstruction loss. Let $p_{\mathrm{data}}(G)$ describe the input SVG distribution and let $F$ be a reconstruction procedure that maps each SVG to an admissible scene bundle $B=F(G)$. Then

$$
\mathcal J(F)
=\mathbb E_{G\sim p_{\mathrm{data}}}
\left[\mathcal L(F(G);G)\right].
$$

This expectation averages reconstruction quality over input SVGs. For a finite collection, it can be estimated by the average loss across those inputs. -->
For an individual SVG $G$ and candidate reconstruction $B$, the loss is

$$
\begin{aligned}
\mathcal L(B;G)
={}&\lambda_{\mathrm{img}}
D_{\mathrm{img}}\!\left(\rho(G),\rho(\widehat G(B))\right)
+\lambda_{\mathrm{corr}}E_{\mathrm{corr}}(G,B)\\
&+\lambda_{\mathrm{prior}}E_{\mathrm{prior}}(\mathcal S,Z,M)
+\lambda_{\mathrm{style}}E_{\mathrm{style}}(\phi),
\end{aligned}
$$

with

$$
B^*\in\arg\min_{B\in\mathcal B_{\mathrm{valid}}}
\mathcal L(B;G).
$$

- $D_{\mathrm{img}}$ compares the SVGs rasterized by $\rho$.
- $E_{\mathrm{corr}}$ measures how closely each SVG feature matches the projected 3D feature assigned to it by the correspondence M.
- $E_{\mathrm{prior}}$ favors plausible 3D reconstruction.
- $E_{\mathrm{style}}$.



<!-- 
The objective separates observable agreement from modeling assumptions; its losses must be instantiated for each experiment. -->

</br>

## Coding agents approach

</br>

We explore the problem through **graphics-program synthesis**: a coding agent constructs an executable scene, runs it, inspects available outputs and diagnostics, and revises the program.

Let the agent generate an executable graphics program $\Gamma=(\gamma_1,\ldots,\gamma_m)$, where the $\gamma_i$ are program statements that construct geometry, hierarchy, materials, animation, constraints, etc. A compiler/interpreter $\mathcal C$ executes the program: $ s_\Gamma = \mathcal C(\Gamma) $, where $s_\Gamma$ is the resulting geometric scene state: curves, surfaces, primitives, topology, hierarchy, transforms, animation, and so on. That state can then be rendered: $I_\Gamma = \mathcal R(s_\Gamma,\theta) $.

The program-level problem uses the same objective:

$$
\Gamma^*\in
\arg\min_{\Gamma:\,\mathcal C(\Gamma)\in\mathcal B_{\mathrm{valid}}}
\mathcal L(\mathcal C(\Gamma);G)
$$

Operationally, let $o^{(k)}$ contain the execution result, available renderings, and diagnostics for program $\Gamma^{(k)}$, including execution failures. The agent revises it through

$$
\Gamma^{(k+1)}
=\mathcal U_\psi\!\left(
G, \{ \Gamma^{(k)},o^{(k)},e^{(k)} \}
\right),
$$

where $e^{(k)}$ is the evaluation feedback actually supplied and $\mathcal U_\psi$ denotes the revision procedure or the program generation policy. Feedback may include appearance comparisons, validity checks, and correspondence checks. For GPT6 (and other proprietary models), quantities like $\mathcal U_\psi$, $e^{(k)}$, are unkown. Thus, current research efforts seek to improve $\mathcal C$ (the harness), $\Gamma$ (the DSL), and $\mathcal R$ (the tools).
