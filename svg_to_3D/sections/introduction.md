# Lifting SVGs to *3D*

Vector graphics describe images using parametric curves and geometric primitives. They provide compact, resolution-independent representations with directly editable shapes, making them useful for illustration, design, and animation.

These representations describe an image, but generally do not specify the 3D scene behind it. What would the depicted object look like from another viewpoint? How would its shadows change under a moving light? What shape might its unseen parts have? Answering these questions requires inferring geometry and appearance beyond what the SVG explicitly contains.

In this post, we explore using GPT-6 as a coding agent to lift SVGs into structured, editable 3D scenes. Our target representation consists of parametric surfaces, B-rep faces and edges, 3D curves, and analytic primitives organized into semantic parts and a scene graph. We also seek explicit correspondences between SVG elements and the 3D entities or rendering features they describe, so that supported edits can propagate in either direction. 
