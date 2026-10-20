# The Inverse Mapping

<br>

Mapping 3D scenes back to vector graphics—3D vectorization—is also a challenging problem. As we develop methods for lifting SVGs into 3D, we also want a way to convert the resulting scenes back into editable SVGs.

Ideally, edits in either representation would carry over to the other: changes to the 3D scene would update the SVG, and edits to the SVG would update its 3D counterpart. However, some edits have no unique counterpart in the other representation, making a consistent two-way mapping difficult.
