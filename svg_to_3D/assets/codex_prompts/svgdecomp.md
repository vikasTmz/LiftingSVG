# SVG Decomposition Instructions


visualize_svg.py is a python script an agent like yourself wrote a while back that takes an svg file, either containing a static scene/object or dynamic scene (like an animation), as input and
 renders a tiled image with the SVG as a clean composite followed by isolated layers with Bézier controls overlaid. If it is an animation, a video is output.

I want you to modify this script. The new script should take the same input i.e. an svg file. Create new saving functions that output the following:

1. Save all the individual layers seperately as an svg file, with filenames as <input svg filename>_layer<depth order ID>.svg. For each layer, make the background transparent if it doesn't have one.
2. Next save all the invidual layers separately as an svg file and also visualize the control points, anchors, and handles. The content of the layers should have less than %100 opacity (please determine an approriate value) so that control points etc, that you overlay is visible. Name these files <input svg filename>_layer<depth order ID>_withCPs.svg
3. Finally, save all the invidual layers separately as an svg file (like step 1) and also add a piece of code that adds a placeholder tile name for the layer on the top-left and the layer id on the top-right.
Then, add a placeholder description on the bottom-left. Choose appropriate font sizes for the title, layer id, and description. The placeholder text should say "tbd"; I will fill it in later manually. Name these files  <input svg filename>_layer<depth order ID>_withText.svg. You shouldn't visualize contrl points in them.

Use "/Users/vthamizh/Documents/Personal_website/vikasTmz.github.io/svg_to_3D/input_svgs/bird_flying.svg" as your test. Save them all to the output directory "/Users/vthamizh/Documents/Personal_website/vikasTmz.github.io/svg_to_3D/input_svgs/bird_flying".


Thanks! Two more fixes:

1. If a single layer has multiple elements, put them all in the same file, don't save them to separate files. I realized I instructed you to do that, but now there are too many layers for an input svg.
2. For the three variants that you save, can you also save them in canonical pose or normalized coordinates? That is normalizes all the elements in a layers such that is large and centered in the svg file. So now in total there should be 6 variants.
