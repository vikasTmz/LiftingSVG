# Formulation

<br>

Operations that depend on depth, surface orientation, viewpoint, lighting, or physical spatial relationships are natural in 3D. These operations are not instrinsic to vector graphics. An SVG can imitate many 3D effects if you precompute them, but it does not possess the underlying 3D scene needed to recompute them generically. 

Let us start with a general formulation, which treats the 2D vector graphic as an **observation** of an unknown 3D parametric scene, without assuming what any 2D curve “means”:

\[
\boxed{
\text{3D scene}
\xrightarrow{\text{curve/feature generation}}
\text{3D geometric features}
\xrightarrow{\text{projection + visibility}}
\text{2D image-space geometry}
\xrightarrow{\text{stylization}}
\text{SVG}
}
\]

The SVG-to-3D lifting problem is to approximately invert this pipeline.

Let
- \(G=\{g_i\}\) is the SVG representation, consisting of paths, primitives, filled regions, groups, colors, strokes, and other vector elements.
- \(\mathcal S=\{S_k\}\) is the unknown 3D scene: parametric surfaces, B-rep faces and edges, 3D curves, analytic primitives, materials, object transforms, etc.
- \(\theta\): camera/view parameters,
- \(Z=\{z_i\}\) specifies which geometric phenomena should generate SVG elements and what their roles are. For example,

\[
z_i\in
\{
\text{boundary},
\text{silhouette},
\text{shading effects},
\text{feature curve},
\text{intersections},
\ldots
\}.
\]

- \(\mathcal R(\mathcal S,\theta,Z)\): rendering operator producing 2D vector geometry,
- \(\mathcal A_\phi\): artistic/stylization operator with parameters \(\phi\). Some objects and operations performed on those objects are unique to SVGs and vice versa. 

Then the forward model is
\[
G \approx
\mathcal A_\phi
\left(
\mathcal R(\mathcal S,\theta,Z)
\right).
\]

The lifting problem is therefore

\[

\mathcal S^*,\theta^*,Z^*,\phi^*
=
\arg\min_{\mathcal S,\theta,Z,\phi}
D\!\left(
G,\,
\mathcal A_\phi(\mathcal R(\mathcal S,\theta,Z))
\right)
+
E_{\mathrm{prior}}(\mathcal S,Z).
\]

Here \(D\) measures how closely the reconstructed 3D scene reproduces the SVG, while \(E_{\mathrm{prior}}\) favors plausible or simple 3D explanations.
Note, \(Z\) is not fixed. An SVG path might correspond to a 3D boundary, silhouette, intersection curve, surface feature, texture/material boundary, or even a purely artistic stroke. \(\mathcal A_\phi\)

<!-- 
with the **meaning of each SVG element inferred rather than assumed**. This separates the problem nicely into **3D geometry \(X\)**, **view \(\theta\)**, **correspondence \(M\)**, and **artistic interpretation \(\Delta\)**. -->
</br>

### Coding agents approach

GPT-6 Astra presumably solves this problem as a graphics-program synthesis agent with an execution/rendering feedback loop.

Let the agent generate an executable graphics program \(\Gamma=(\gamma_1,\ldots,\gamma_m)\), where the \(\gamma_i\) are program statements that construct geometry, hierarchy, materials, animation, constraints, etc. A compiler/interpreter \(\mathcal C\) executes the program: \( s_\Gamma = \mathcal C(\Gamma) \), where \(s_\Gamma\) is the resulting geometric scene state: curves, surfaces, primitives, topology, hierarchy, transforms, animation, and so on. That state can then be rendered: \(I_\Gamma = \mathcal R(s_\Gamma,\theta) \).

The agent can evaluate either the scene state itself or its rendered output:

\[
L(\Gamma;G)
=
\lambda_{\mathrm{img}}
D_{\mathrm{img}}(G,I_\Gamma)
+
\lambda_{\mathrm{geom}}
D_{\mathrm{geom}}(G,s_\Gamma)
+
E.
\]

Here:
- \(D_{\mathrm{img}}\): a metric that measures agreement between the SVG and rendered result,
- \(D_{\mathrm{geom}}\): a metric that measures agreement in geometry, primitives, topology, hierarchy, correspondence, motion, etc.,

Then the lifting problem becomes

\[
\Gamma^*
=
\arg\min_{\Gamma}
L(\Gamma;G),
\qquad
s^*=\mathcal C(\Gamma^*).
\]

But for an agent, it is more useful to express this as an iterative loop:

\[
\Gamma^{(k+1)}
=
\mathcal A_\psi
\left(
G,\,
\Gamma^{(k)},\,
s^{(k)},\,
I^{(k)},\,
e^{(k)}
\right)
\]
, with 
\(e^{(k)} = \mathcal E \left( G,s^{(k)},I^{(k)} \right)\) the feedback or evaluation signal.

Unsurprisingly, most of these terms and the process through which they are computed are unknown.