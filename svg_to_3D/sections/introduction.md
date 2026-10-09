# Lifting SVGs to *3D*

Vector graphics represent images using parametric curves and geometric primitives. They are compact, resolution independent, and easy to edit, making them well suited to model smooth, continuous shapes. These properties make them widely used on the web and in design software for shape editing and animation.

SVGs support a wide range of edits, but what if we want to change the camera viewpoint, adjust the lighting and cast shadows, or reveal hidden/occluded structures? These are natively impossible. In this blog post, we experiment with GPT-6 Astra to lift SVGs into 3D in a principled manner and exlpore the new possibilities this opens up.
