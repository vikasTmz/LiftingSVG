I have a new task unrelated to the website building. Keep that aside for now, we will re-visit it later.

In the project /Users/vthamizh/.codex/.chatgpt-projects/g-p-6aa05a45227c819181822dfaa3d849e6/outputs/flying_bird_3d, I want you to update render_preview.py with the following functionality:

currently the below lines
"""
for camera,label in [('CAM 01 • original side view','side'),('CAM 02 • three-quarter','orbit')]:
 s.camera=bpy.data.objects[camera];out=O/f'{label}_frames';out.mkdir(exist_ok=True)
 for f in range(1,61,2):
  s.frame_set(f);s.render.filepath=str(out/f'{(f-1)//2:03}.png');bpy.ops.render.render(write_still=True)
print('Verified all 60 animation frames; rendered both camera previews.')
"""

renders the animation from fixed camera location. I want to instead render the animation in a turn-table style camera motion (the camera orbits the object). The orbit can be more elliposid-like than circular.
In addition to the default render, I also wish to render the wireframes, with X-ray off for the first half and then X-ray on for the second half of the orbit.

you don't have to render all the frames in blender. just write the script, do some quick verifications, and then I will run the script to render the frames offline. Give me the cli command to do this and also the command to convert the frames to mp4 and mkv.