# Question

I need you help summarizing, explaining, and formalizing exisiting papers and new ideas.



We explore the problem of  **\*\*graphics-program synthesis\*\***: a coding agent constructs an executable scene, runs it, inspects available outputs and diagnostics, and revises the program.



\
Let the agent generate an executable graphics program $\Gamma=(\gamma_1,\ldots,\gamma_m)$, where the $\gamma_i$ are program statements that construct geometry, hierarchy, materials, animation, constraints, etc. A compiler/interpreter $\mathcal C$ executes the program: $ s\_\Gamma = \mathcal C(\Gamma) $, where $s\_\Gamma$ is the resulting geometric scene state: curves, surfaces, primitives, topology, hierarchy, transforms, animation, and so on. That state can then be rendered: $I\_\Gamma = \mathcal R(s\_\Gamma,\theta) $.\
\
The program-level problem uses the same objective:\
\
$$\
\Gamma^\*\in\
\arg\min\_{\Gamma:\\,\mathcal C(\Gamma)\in\mathcal B\_{\mathrm{valid}}}\
\mathcal L(\mathcal C(\Gamma);G)\
$$\
\
Operationally, let $o^{(k)}$ contain the execution result, available renderings, and diagnostics for program $\Gamma^{(k)}$, including execution failures. The agent revises it through\
\
$$\
\Gamma^{(k+1)}\
\=\mathcal U\_\psi\\!\left(\
G, \\{ \Gamma^{(k)},o^{(k)},e^{(k)} \\}\
\right),\
$$\
\
where $e^{(k)}$ is the evaluation feedback and $\mathcal U\_\psi$ denotes the revision procedure or the program generation policy. Feedback may include appearance comparisons, validity checks, and correspondence checks. For GPT6 and other proprietary models, $\mathcal U\_\psi$ is not observable. The revision process may involve internal assessments that are not exposed to the user, but we can guide it by augmenting $e^{(k)}$ with explicit evaluation signals. Current research efforts seek to improve the observable quantities like $\mathcal C$ (the harness), $\Gamma$ (the DSL), and $\mathcal R$ (the tools).\


Now, I need you to compare and examine these four papers:

1. BricBench: [https://arxiv.org/pdf/2610.12452](https://arxiv.org/pdf/2610.12452)
2. VIGA: [https://arxiv.org/pdf/2601.11109](https://arxiv.org/pdf/2601.11109)
3. 3DCodeVerse: [https://arxiv.org/pdf/2601.11109](https://arxiv.org/pdf/2601.11109)
4. 4DCodeBench: [https://arxiv.org/pdf/2610.03715](https://arxiv.org/pdf/2610.03715)



on the following quantities:

- what are $\mathcal C$, $\Gamma$, and $\mathcal R$?
- what are  $o^{(k)}$ and $e^{(k)}$?
- what constraints and regularization terms do these papers define, if at all?
- what data-structures and graphs are used to solve the task?
- how is memory and context managed by the author? or they let the agent handle everything?
- are there additional harness and tools defined and used?



Use tables for comparison where possible. Please keep your answer briefly and clear. Use mathematical notations when possible.

# Answer

Yes. A useful way to view these papers is that they occupy different points on the spectrum from **“give a coding agent an engine”** to **“engineer a full closed-loop synthesis harness.”**

One correction first: the link you gave for **3DCodeVerse** is VIGA again. The actual 3DCodeVerse paper is **arXiv:2610.22341**. :chatgpt-content-reference{index="0"}

### 1. Mapping to your \(\mathcal C,\Gamma,\mathcal R\) formulation

| Paper | \(\Gamma\): graphics program | \(\mathcal C\): execution | \(\mathcal R\): rendering |
|---|---|---|---|
| **BrickBench** | Python `build.py` using BrickAgent; output is an LDraw assembly / `.mpd`. | Python + BrickAgent/LDraw. Produces an assembly \(s_\Gamma=\{(\text{part},\text{color},T)\}\). | BrickAgent arbitrary-view renderer during construction; BrickNet renderer with 8 canonical views for evaluation. :chatgpt-content-reference{index="1"} |
| **VIGA** | Iteratively updated program \(p_t\), mainly **Blender Python** for 3D tasks. | \(\operatorname{exec}(p_t)\) inside the graphics engine, producing state \(s_t\). | Blender rendering plus actively chosen camera views. The same framework can swap the backend, e.g. PowerPoint for 2D. :chatgpt-content-reference{index="2"} |
| **3DCodeVerse** | \(f^{(t)}\): standalone executable code. Backends include Blender Python, CadQuery, Three.js, URDF+Blender, GLSL, OpenGL. | Explicitly \((a,\ell)=E_e(f)\), where \(a\) is the artifact and \(\ell\) execution feedback. Thus your \(\mathcal C\approx E_e\). | Runtime-specific deterministic renderer \(R_e(a)\), including multi-view rigs, articulation poses, graphics frames, etc. :chatgpt-content-reference{index="3"} |
| **4DCodeBench** | Literally uses your notation: \(\Gamma=(\gamma_1,\ldots,\gamma_m)\), constructing \(s_\Gamma(t)\). | Simulator-agnostic: Python/Blender/Taichi/Warp/custom solvers, etc. | Explicitly \(\hat x_k=\mathcal R_\Gamma(s_\Gamma(k/r))\), with final rendering done in Blender. :chatgpt-content-reference{index="4"} |

Interestingly, **4DCodeBench's formalization is almost exactly the one you wrote**.

---

### 2. What correspond to \(o^{(k)}\) and \(e^{(k)}\)?

| Paper | \(o^{(k)}\): observable execution state | \(e^{(k)}\): feedback used for revision |
|---|---|---|
| **BrickBench** | renders, measurements, part-search results, execution errors, validator diagnostics identifying offending parts. | Mainly agent interpretation of these observations. BrickAgent explicitly reports connectivity/collision/stability failures. **VQA/ELO are post-hoc**, not normally fed into the agent loop. :chatgpt-content-reference{index="5"} |
| **VIGA** | rendered state \(s_t\), active observation trajectory \(\tau_t^{obs}\), scene queries, execution errors. | Explicit visual discrepancy feedback: \[f_t=\mathcal A(s_g^*,s_t,\tau_t^{obs},M_t).\] This becomes the instruction for the next code edit. :chatgpt-content-reference{index="6"} |
| **3DCodeVerse** | Almost exactly your definition: \[\boxed{o^{(t)}=(\ell^{(t)},\,M_e(a^{(t)}),\,R_e(a^{(t)}))}\] = logs + geometric measurements + renders. | VLM judge \(j^{(t)}\) gives defects/scores/revisions; everything is converted into prioritized repair tasks \(\Delta^{(t)}\), then \[f^{(t+1)}=A_{\rm code}(c,P,f^{(t)},\Delta^{(t)};e).\] :chatgpt-content-reference{index="7"} |
| **4DCodeBench** | Whatever the native coding agent chooses to inspect: program output, rendered frames/video, shell logs, and the public format checker. | **No benchmark-defined in-loop evaluator.** The benchmark evaluates the final submission; agents perform their own render-and-compare reasoning. The paper explicitly identifies intermediate-feedback study as future work. :chatgpt-content-reference{index="8"} |

So in terms of your model,

\[
\textbf{3DCodeVerse}
\]

is the cleanest explicit implementation of your

\[
\Gamma^{(k)}
\rightarrow \mathcal C
\rightarrow o^{(k)}
\rightarrow e^{(k)}
\rightarrow\mathcal U_\psi
\rightarrow\Gamma^{(k+1)}.
\]

---

### 3. Constraints and regularization

A key distinction is that these works mostly use **hard constraints/checkers and evaluator penalties**, not classical differentiable regularization terms.

| Paper | Constraints | Regularization / objective-like penalties |
|---|---|---|
| **BrickBench** | Connector compatibility/alignment; no collisions; stability under gravity; part-count/inventory constraints. Stability requires motion \(\le3\) LDraw units in PyBullet. :chatgpt-content-reference{index="9"} | **No explicit regularizer.** Validity is essentially \(1[s\in\mathcal B_{\rm valid}]\); VQA and ELO are evaluation metrics. |
| **VIGA** | No general geometric feasibility set is defined. Executability and engine-specific physics provide implicit constraints. | **No explicit regularization term.** Photometric Loss, N-CLIP and VLM score are benchmark metrics, not gradient losses used by VIGA's revision loop. :chatgpt-content-reference{index="10"} |
| **3DCodeVerse** | Strongest constraint system: dimensions, attachment/contact, collision, support, kinematics, joint/frame consistency, temporal behavior, triangle budgets, grounding, must/must-not acceptance criteria. Some canonical dimensions use \(\pm5\%\). :chatgpt-content-reference{index="11"} | Uses **rubric weights + defect penalties + hard score caps**. Schematically: \[S_t\approx \min\!\left(\sum_i w_i q_i-P_{\rm defect},\,C_{\rm gates}\right).\] This behaves like penalty regularization, but is not differentiable optimization. :chatgpt-content-reference{index="12"} |
| **4DCodeBench** | Executability/output-format constraints: correct FPS/resolution/frame count, valid camera/meshes/dynamics, synchronized timeline, deterministic `build.sh`, no reference access during execution. :chatgpt-content-reference{index="13"} | **No regularizer and no required physics model.** Post-hoc metrics measure DINO similarity, dynamic IoU, depth, flow, Track2D, 3D geometry and 3D dynamics. Mesh manifoldness/self-intersection/interpenetration are diagnostics, not the optimization objective. :chatgpt-content-reference{index="14"} |

Thus I would avoid calling most of these terms \(\mathcal L_{\rm reg}\). They are better represented as

\[
\boxed{
\mathcal B_{\rm valid}
=
\{s:C_1(s)=\cdots=C_n(s)=1\}
}
\]

plus a separate quality evaluator.

---

### 4. Special data structures / graphs

| Paper | Important representations |
|---|---|
| **BrickBench** | **Part connectivity graph** \(G_{\rm brick}=(V,E)\), with parts as nodes and compatible aligned connectors as edges; connected components are simulated separately. Also a **DSG question dependency graph** for semantic evaluation. Connector records contain type/subtype/polarity/local frame. :chatgpt-content-reference{index="15"} |
| **VIGA** | No special graph introduced. The important structure is the **multimodal trajectory memory** \(M_t\): plans + code + feedback + rendered observations. |
| **3DCodeVerse** | Major contribution: a **task DAG** \[G=(V,E),\] where nodes are coding/assembly tasks and edges encode prerequisites. Also uses kinematic trees for articulated objects, attachment topology, file-ownership scopes, and connected components of overlapping repair tasks. :chatgpt-content-reference{index="16"} |
| **4DCodeBench** | No special task graph. The important representation is an explicit **4D world**: per-frame triangle meshes plus persistent particle trajectories: \[\text{pos}\in\mathbb R^{F\times N\times3},\] IDs, optional face/tet connectivity, and camera matrices \(K,E\). :chatgpt-content-reference{index="17"} |

---

### 5. Memory / context management

This is where the papers differ most.

**BrickBench:** essentially delegates memory to the underlying coding agent (Codex/Claude Code). BrickAgent supplies persistent files, scene state, tools, and diagnostics, but the paper introduces no explicit memory algorithm. :chatgpt-content-reference{index="18"}

**VIGA:** explicitly engineers memory:

\[
M_{t+1}
=
\operatorname{Tail}_L
\big(M_t\cup\{p_t,f_t,\text{observations}\}\big).
\]

Only the most recent \(L\) iterations are retained. The current full program acts as a compressed symbolic representation of older successful edits, so stale reasoning can be discarded. :chatgpt-content-reference{index="19"}

**3DCodeVerse:** manages context primarily through **structural decomposition**, rather than a single long memory:
- file-scoped sub-agent sessions;
- attachment subtrees;
- file-disjoint repair sessions;
- Git commits/journal per round;
- context reset on structurally invalid plans;
- bounded tool payloads.

This is arguably the most deliberate **context-engineering system** of the four. :chatgpt-content-reference{index="20"}

**4DCodeBench:** deliberately leaves this to each native coding harness. Codex, Claude Code, Antigravity, etc. retain/compact their own contexts; the benchmark records context statistics but does not impose a memory strategy. :chatgpt-content-reference{index="21"}

---

### 6. Harness/tooling spectrum

I would summarize the four as:

\[
\boxed{
\begin{array}{ccl}
\text{4DCodeBench}
&:&
\text{minimal harness; agent does most reasoning}\\[2mm]
\text{BrickBench}
&:&
\text{domain-specific construction + validator tools}\\[2mm]
\text{VIGA}
&:&
\text{explicit observe/edit loop + engineered memory}\\[2mm]
\text{3DCodeVerse}
&:&
\text{planner + DAG + tools + gates + VLM judge + repair agents}
\end{array}}
\]

Their notable tools are:

- **BrickBench:** `find`, connector placement, measurement, mirroring, subassemblies, arbitrary-view rendering, collision/connectivity/stability checker. :chatgpt-content-reference{index="22"}
- **VIGA:** `set_camera`, `investigate`, `set_keyframe`, `get_scene_info`, `initialize_view`, `execute_code`, `undo_action`, etc.; importantly observation and modification APIs are separated. :chatgpt-content-reference{index="23"}
- **3DCodeVerse:** build/export/render wrappers, ~16 spatial tools per track, collision/contact/IoU/distance checks, joint sweeps, deterministic gates, 14-view rigs, VLM judge and fix agents. :chatgpt-content-reference{index="24"}
- **4DCodeBench:** mostly generic coding infrastructure: shell/image viewing, Blender, FFmpeg, Taichi, Warp, Trimesh and a public structural checker. The actual benchmark scorer is deliberately unavailable to the agent. :chatgpt-content-reference{index="25"}

The clearest conceptual distinction for your framework is therefore:

\[
\boxed{
\text{research can improve }
\underbrace{\Gamma}_{\text{representation/DSL}},
\quad
\underbrace{\mathcal C}_{\text{execution + deterministic checks}},
\quad
\underbrace{\mathcal R}_{\text{inspection interface}},
\quad
\underbrace{e^{(k)}}_{\text{explicit evaluator}},
\quad
\underbrace{M_k}_{\text{context/memory}}.
}
\]

**BrickBench mainly strengthens \(\mathcal C\) and domain tools; VIGA strengthens \(\mathcal R\), \(e^{(k)}\), and \(M_k\); 3DCodeVerse engineers essentially the entire loop; 4DCodeBench intentionally keeps the loop relatively unconstrained so it can measure what existing coding agents naturally do.**