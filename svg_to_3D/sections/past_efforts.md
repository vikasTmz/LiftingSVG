# Past Efforts

</br>

This problem of lifting 2D vector graphics to 3D has been explored in the past, including works like [2.5D Cartoon Models](http://www.alecrivers.com/2.5dcartoonmodels/), [True2Form](https://www-sop.inria.fr/reves/Basilic/2014/XCSBMS14/), and [Adobe's Project Turntable](https://research.adobe.com/news/turntable-and-project-turn-style-a-fresh-spin-on-your-original-art/).


### *Can't this problem be solved with existing 3D priors?*

Current 3D foundation models like [Trellis2.0](https://microsoft.github.io/TRELLIS.2/), [Sparc3D](https://sparc3d.org/), and [Tripo](https://www.tripo3d.ai/) allow us to sample high-fidelity geometry conditioned on an input image. While they produce impressive results and continue to improve at rapid rates, there are limitations in leveraging them to solve the lifting problem:
- They model shapes as either meshes, implicit fields, or some custom data structure. Converting these shape representations to editable, structured 3D shapes is a hard challenge.
- Their generative models are conditioned on image tokens (for example, DinoV3 features). These tokenziers are not trained to encode SVGs. In our formulation, we want the 3D reconstruction to be guided by the SVG structure.
- Their outputs primarily facilitates novel-view-synthesis. Yet, having editable, structured 3D shapes offers many more applications.
- Mapping back to the SVG domain requires intermediate rasterization, which ignores the structure, heirarchy, and toplogy information contained in the 3D representation.

Foundation models that model 3D worlds implicitly like video generative models and multi-view image generative models, similarly, suffer from the same drawbacks.


### *Do we assume a SVG parameterization?*

The input to this problem is an SVG image, static or dynamic, created by a human or an AI agent. This SVG image may have arbitrary parameterization, either decided by the artist or the output of a black-box process within the AI agent. The big challenge in vectorization algorithms -- generative or heuristic-based -- is deciding what parameterization to choose when creating/ generating the vector graphics. This is still an unsolved problem. One of the motivations of this project is to sidestep this question; we assume this decision was made by a different process and instead, focus on an equally challenging, yet under-explored problem.