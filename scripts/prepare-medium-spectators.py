"""Derive lightweight CC0 crowd geometry from the shipped MakeHuman adults.

Blender --background --python scripts/prepare-medium-spectators.py -- public/assets/crowd
Texture-free GLBs share the already loaded near-person atlases at runtime. This
does not introduce another art source or another copy of the image downloads.
Run scripts/bake-crowd-motion.mjs afterwards to rebuild the small bone palettes.
"""
import bpy
import os
import re
import sys
import numpy as np

directory = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
for name in ['blue-shirt', 'light-tee', 'striped-shirt', 'denim', 'summer', 'sport']:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(directory, 'spectator-' + name + '.glb'))
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            continue
        bpy.context.view_layer.objects.active = obj
        if obj.data.shape_keys:
            obj.shape_key_clear()
        count = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        body = any('Skin_and_cloth_atlas' in m.name for m in obj.data.materials)
        target = 1950 if body else 500
        if body:
            atlas = next(n.image for m in obj.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE')
            width, height = atlas.size[:]
            pixels = np.empty(width * height * 4, dtype=np.float32)
            atlas.pixels.foreach_get(pixels)
            pixels = pixels.reshape((height, width, 4))
            uv = obj.data.uv_layers.active.data
            sums = np.zeros(len(obj.data.vertices), dtype=np.float32)
            samples = np.zeros(len(obj.data.vertices), dtype=np.float32)
            # The atlas contains photographic garment detail. Hue selection is
            # limited to blue fabric below the neck; warm skin, eyes, hair and
            # shoes retain their source colour. Two neutral/red shirts also use
            # a conservative interior torso mask, away from arms and neckline.
            for loop in obj.data.loops:
                u, v = uv[loop.index].uv
                red, green, blue = pixels[min(height - 1, max(0, int(v * height))), min(width - 1, max(0, int(u * width))), :3]
                point = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
                cool = blue > red * 1.10 and blue > green * .97 and blue > .014
                torso = abs(point.x) < .175 and .93 < point.z < 1.285
                neutral = name == 'light-tee' and torso
                red_shirt = name == 'striped-shirt' and torso
                cloth = point.z < 1.36 and (cool or neutral or red_shirt)
                sums[loop.vertex_index] += float(cloth)
                samples[loop.vertex_index] += 1
            mask = obj.data.attributes.new(name='_CROWD_GARMENT', type='FLOAT', domain='POINT')
            mask.data.foreach_set('value', sums / np.maximum(samples, 1))
        if count > target:
            mod = obj.modifiers.new('Medium-distance silhouette', 'DECIMATE')
            mod.ratio = target / count
            mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        # These IDs let the runtime reuse each original skin/garment/hair map.
        for material in obj.data.materials:
            material.name = re.sub(r'\.\d{3}$', '', material.name)
            for node in list(material.node_tree.nodes):
                if node.type == 'TEX_IMAGE':
                    material.node_tree.nodes.remove(node)
    bpy.ops.export_scene.gltf(filepath=os.path.join(directory, 'spectator-' + name + '-crowd.glb'),
                              export_format='GLB', export_apply=False,
                              export_animations=False, export_materials='EXPORT', export_attributes=True)
    print('CAMBER_MEDIUM_DONE', name)
