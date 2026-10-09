# Vectorization and Blender Scene Gen Instructions

Here's a challenge for you.  In "outputs/vector_graphics/flying_bird/flying_bird.svg", is an svg file of a bird flying by flapping it's wings. There is subtle motion in it's tail and head. There is also a video "outputs/vector_graphics/flying_bird/flying_bird.mp4" containing the each layer rasterized and the control points and handles visualized (for your reference).

While the SVG animation and shapes are great, the layer decomposition could be improved. Observing "outputs/vector_graphics/flying_bird/flying_bird.mp4" in detail, one can see many redundant layers, especially for the wings of the bird. Some layers, like for the body of the bird, are all combined into one when they could be split into different semantic layers. 

The task for you is to re-compose this svg such that it has better semantic layer decomposition while mainting all the shapes and animations exactly as is. The final decomposition should not have too few layers (like 2-3) or too many layers (like more than 16). Save the results in the same folder, under a new name.

-----------------

Amazing! Great job! Here's a new challenge for you. You are a highly intelligent and competent agent.

A week ago, another agent transformed (or lifted) the original svg "outputs/vector_graphics/flying_bird/flying_bird.svg" to 3D by creating a blender scene. The agent convert the 2D bird animation to 3D, but kept the 2D vector graphics style. The idea is that in Blender, I can now change camera view and see this animation from different view point. They also used "outputs/vector_graphics/flying_bird/flying_bird.mp4" as reference.

Their output is in "outputs/flying_bird_3d/flying_bird.blend". While everything look good on first glance, a lot of improvements can be made:
1. They used the old svg file and video as reference.
2. Certain parts aren't aligned correctly in 3D. See the wings and crest.

Can you improve upon "outputs/flying_bird_3d/flying_bird.blend" given your new svg decomposition in "vector_graphics/flying_bird/flying_bird_semantic.svg" and the reference video "vector_graphics/flying_bird/flying_bird_semantic.mp4"? You should preserve all the motions you see in the SVG file in the Blender scene, while addresing the suggestions I provided. Use procedural/generated geometry where practical. Use NURBS or parametric curves and surfaces where practical. Do not permanently apply modifiers unless necessary.