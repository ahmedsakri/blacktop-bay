"""Build the CC0 MakeHuman spectator assets using Blender 4.5 + MPFB 2.0.17.

Blender --background --python scripts/prepare-spectator-assets.py -- \
  --mpfb /path/to/mpfb2/src --assets /path/to/makehuman_system_assets \
  --output public/assets/crowd --variant 0

The exporter is an offline authoring tool. MPFB code is not included in the game.
See public/assets/crowd/SOURCES.json for source versions and asset licensing.
"""
import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Vector, kdtree

parser = argparse.ArgumentParser()
parser.add_argument('--mpfb', required=True)
parser.add_argument('--assets', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--variant', type=int, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
VARIANTS = [
    ('spectator-blue-shirt', 1, 'caucasian', 'short01', 'male_casualsuit01', 'shoes01', .50, .36, 'young'),
    ('spectator-light-tee', 1, 'african', 'short02', 'male_casualsuit06', 'shoes02', .61, .52, 'middleage'),
    ('spectator-striped-shirt', 1, 'asian', 'short04', 'male_casualsuit03', 'shoes01', .47, .63, 'middleage'),
    ('spectator-olive-jacket', 0, 'african', 'braid01', 'male_casualsuit05', 'shoes02', .56, .52, 'middleage'),
    ('spectator-wine-blouse', 0, 'caucasian', 'bob02', 'female_elegantsuit01', 'shoes03', .56, .66, 'old'),
    ('spectator-sport', 0, 'asian', 'ponytail01', 'female_sportsuit01', 'shoes02', .50, .36, 'young'),
]
name, gender, ancestry, hair_name, outfit, shoes, weight, age, skin_age = VARIANTS[args.variant]
os.makedirs(args.output, exist_ok=True)
scratch = '/tmp/camber-mpfb-user'
os.makedirs(scratch, exist_ok=True)
sys.path.insert(0, args.mpfb)
bpy.utils.extension_path_user = lambda package, *a, **kw: scratch
import mpfb
mpfb.get_preference = lambda key: {'mpfb_user_data': scratch, 'mpfb_second_root': args.assets,
                                 'mpfb_shelf_label': 'MPFB'}.get(key)
mpfb.register()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
from mpfb.services.assetservice import AssetService
from mpfb.services.exportservice import ExportService
from mpfb.entities.objectproperties import HumanObjectProperties

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
h = HumanService.create_human()
props = dict(gender=gender, age=age, muscle=.43 if age>.5 else .48, weight=weight, african=.05, asian=.05, caucasian=.05)
props[ancestry] = .90
for prop, value in props.items():
    HumanObjectProperties.set_value(prop, value, entity_reference=h)
TargetService.reapply_macro_details(h)
skin_name = skin_age + '_' + ancestry + ('_male' if gender else '_female') + '.mhmat'
HumanService.set_character_skin(AssetService.find_asset_absolute_path(skin_name, asset_subdir='skins'), h, skin_type='GAMEENGINE')
HumanService.add_builtin_rig(h, 'game_engine')
for sub, asset, kind in [('eyes', 'low-poly', 'Eyes'), ('eyebrows', 'eyebrow001', 'Eyebrows'),
                         ('hair', hair_name, 'Hair'), ('clothes', outfit, 'Clothes'), ('clothes', shoes, 'Clothes')]:
    path = AssetService.find_asset_absolute_path(asset + '.mhclo', asset_subdir=sub)
    if not path:
        raise ValueError('Missing CC0 source asset: ' + asset)
    HumanService.add_mhclo_asset(path, h, asset_type=kind, material_type='GAMEENGINE')

# Capture the authored facial target displacements before topology optimisation.
# Coordinates are captured at the fitted macro shape, not at an unrelated base face.
current = h.shape_key_add(name='FittedFace', from_mix=True)
face_points = [point.co.copy() for point in current.data]
h.shape_key_remove(current)
base = h.data.shape_keys.key_blocks[0]
expressions = {}
for label, files in [('Cheer', ['mouth-open']), ('Blink', ['eye-left-closure', 'eye-right-closure'])]:
    deltas = [Vector((0, 0, 0)) for _ in face_points]
    for unit in files:
        path = os.path.join(args.mpfb, 'mpfb/data/targets/expression/units', ancestry, unit + '.target.gz')
        key = TargetService.load_target(h, path, name=unit, weight=0)
        for i, point in enumerate(key.data):
            deltas[i] += point.co - base.data[i].co
        h.shape_key_remove(key)
    expressions[label] = deltas
tree = kdtree.KDTree(len(face_points))
for i, point in enumerate(face_points):
    tree.insert(h.matrix_world @ point, i)
tree.balance()

ExportService.bake_modifiers_remove_helpers(h, bake_masks=True, bake_subdiv=False, remove_helpers=True)
for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    if obj.data.shape_keys:
        TargetService.bake_targets(obj)
    for modifier in list(obj.modifiers):
        if modifier.type == 'SUBSURF':
            obj.modifiers.remove(modifier)
        elif modifier.type == 'MASK':
            bpy.ops.object.modifier_apply(modifier=modifier.name)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
hair = [o for o in meshes if hair_name in o.name or 'eyebrow' in o.name]
solids = [o for o in meshes if o not in hair]
for obj in meshes:
    for material in obj.data.materials:
        for node in material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value = 0
                if obj in solids:
                    for link in list(node.inputs['Alpha'].links):
                        material.node_tree.links.remove(link)
                    node.inputs['Alpha'].default_value = 1
        if obj in hair:
            material.surface_render_method = 'DITHERED'

bpy.ops.object.select_all(action='DESELECT')
for obj in solids:
    obj.select_set(True)
bpy.context.view_layer.objects.active = h
bpy.ops.object.join()
body = bpy.context.object
body.name = 'Spectator_body'
old_uv = body.data.uv_layers.active.name
for material in body.data.materials:
    uv = material.node_tree.nodes.new('ShaderNodeUVMap')
    uv.uv_map = old_uv
    for node in list(material.node_tree.nodes):
        if node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
            material.node_tree.links.new(uv.outputs['UV'], node.inputs['Vector'])
triangles = sum(len(p.vertices) - 2 for p in body.data.polygons)
decimate = body.modifiers.new('Bounded close spectator topology', 'DECIMATE')
decimate.ratio = min(1, 10500 / triangles)
bpy.ops.object.modifier_apply(modifier=decimate.name)
body.data.uv_layers.new(name='SpectatorAtlas')
body.data.uv_layers.active_index = len(body.data.uv_layers) - 1
body.data.uv_layers.active.active_render = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.007)
bpy.ops.object.mode_set(mode='OBJECT')
atlas = bpy.data.images.new(name + '-albedo', 1024, 1024, alpha=False)
atlas.colorspace_settings.name = 'sRGB'
for material in body.data.materials:
    node = material.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = atlas
    node.select = True
    material.node_tree.nodes.active = node
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 1
bpy.context.scene.render.threads_mode = 'FIXED'
bpy.context.scene.render.threads = 4
bpy.context.scene.render.bake.use_pass_direct = False
bpy.context.scene.render.bake.use_pass_indirect = False
bpy.context.scene.render.bake.use_pass_color = True
bpy.context.scene.render.bake.margin = 8
bpy.ops.object.bake(type='DIFFUSE')
atlas.filepath_raw = '/tmp/' + name + '-atlas.jpg'
atlas.file_format = 'JPEG'
atlas.save()
atlas.pack()
material = bpy.data.materials.new('Skin_and_cloth_atlas')
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .83
image_node = material.node_tree.nodes.new('ShaderNodeTexImage')
image_node.image = atlas
material.node_tree.links.new(image_node.outputs['Color'], bsdf.inputs['Base Color'])
body.data.materials.clear()
body.data.materials.append(material)
for polygon in body.data.polygons:
    polygon.material_index = 0
for uv in list(body.data.uv_layers):
    if uv.name != 'SpectatorAtlas':
        body.data.uv_layers.remove(uv)

# Transfer the two sparse, CC0 expression targets to the reduced topology.
# Nearby clothing/eyes have zero source displacements; the small tolerance avoids
# pulling hair, shoes or collars with a facial target.
body.shape_key_add(name='Basis')
linear = h.matrix_world.to_3x3()
inverse = body.matrix_world.inverted().to_3x3()
for label, deltas in expressions.items():
    key = body.shape_key_add(name=label)
    for i, vertex in enumerate(body.data.vertices):
        closest, index, distance = tree.find(body.matrix_world @ vertex.co)
        if distance < .016 and deltas[index].length > 0:
            key.data[i].co += inverse @ (linear @ deltas[index])

# Hair cards retain alpha cutouts. They share a fixed small topology/texture budget.
bpy.ops.object.select_all(action='DESELECT')
for obj in hair:
    obj.select_set(True)
bpy.context.view_layer.objects.active = hair[0]
bpy.ops.object.join()
hair_obj = bpy.context.object
hair_obj.name = 'Spectator_hair'
triangles = sum(len(p.vertices) - 2 for p in hair_obj.data.polygons)
if triangles > 3600:
    decimate = hair_obj.modifiers.new('Hair silhouette budget', 'DECIMATE')
    decimate.ratio = 3600 / triangles
    bpy.ops.object.modifier_apply(modifier=decimate.name)
for image in bpy.data.images:
    if image != atlas and (image.size[0] > 512 or image.size[1] > 512):
        image.scale(512, 512)
    if image.source == 'FILE':
        image.pack()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(args.output, name + '.glb'), export_format='GLB',
                          export_apply=False, export_animations=False, export_image_format='AUTO', export_jpeg_quality=88)
print('CAMBER_SPECTATOR_DONE', name)
