Here's a challenge for you. You are a highly intelligent and competent agent, fluent in SVG generation, decomposition, and editing.

In "outputs/vector_graphics/character_throwing_basketball/character_throwing_basketball.svg", is a native SVG animation of a character walking and dribbling a basketball, then shooting the basketball. There is also a video "outputs/vector_graphics/character_throwing_basketball/character_throwing_basketball.mp4" containing the each layer rasterized and the control points and handles visualized (for your reference).

While the SVG animation and shapes are great, I want the svg to be improved in the following ways:

1. The layer decomposition could be improved. Observing "outputs/vector_graphics/character_throwing_basketball/character_throwing_basketball.mp4" in detail, one can see many redundant layers. The task for you is to re-compose this svg such that it has better semantic layer decomposition while mainting all the shapes and animations exactly as is. The final decomposition should not have too few layers (like 2-3) or too many layers (like more than 16). Save the results in the same folder, under a new name.

2. The animation currently doesn't loop. Please fix that.
