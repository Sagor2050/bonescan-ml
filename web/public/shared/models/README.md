# Skeleton model

`skeleton.glb` is the standard adult skeleton that BoneScan shows. It holds
the 126 bones of the arms, legs, hands, feet, shoulders, and pelvis. It is not
a model of any patient's own bones.

## Where it came from

The model comes from **Z-Anatomy**, a free 3D atlas of human anatomy.

- Site: <https://www.z-anatomy.com>
- Repository: <https://github.com/Z-Anatomy/Models-of-human-anatomy>
- File used: [`Z-Anatomy.zip`](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/Z-Anatomy.zip)
- Downloaded: 2026-11-03
- Version: repository commit `bb293be456f6d2245191f37752d14ec76894740d`
  (2024-06-07). This is the last commit that changed `Z-Anatomy.zip` before
  the download.

Z-Anatomy's own models are built from **BodyParts3D**, from The Database
Center for Life Science. Z-Anatomy asks anyone who uses its content to credit
both projects.

## License

Z-Anatomy releases its content under the
[Creative Commons Attribution-ShareAlike 4.0 International license (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
Its [`License.txt`](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt)
also names BodyParts3D as "CC-BY-SA 2.1 Japan".

`skeleton.glb` is an edited copy, so it is shared under the same license,
CC BY-SA 4.0. This applies to the model file only. It does not describe the
license of the rest of this repository.

This note records what Z-Anatomy says. It is not legal advice. Issue #40
covers how the license applies to the app.

Credit lines that Z-Anatomy asks for:

- "BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan"
  (<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>)
- "Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0"

## What we changed

These steps are the account of the person who prepared the model. They did the
work in Blender, starting from the Z-Anatomy application template.

1. **Kept only the skeletal system.** Deleted every other collection:
   muscular insertions, joints, muscles, cardiovascular system, lymphoid
   organs, nervous system and sense organs, visceral systems, regions of the
   body, reference lines, planes and movements, cross-section planes, and the
   helper and camera objects.
2. **Removed bones we do not cover.** Inside the skeletal system, deleted the
   cranium, auditory ossicles, extracranial bones of the head, nasal
   cartilages, ear cartilages, laryngeal cartilages, teeth, axial skeleton,
   thoracic skeleton, and vertebral column. This kept the bones of the upper
   limb and lower limb, which are the 126 bones in `bones.json`. Some
   collections that sound like they hold bones, such as "appendicular
   skeleton", held only text or lines and no meshes.
3. **Flattened the structure.** Every mesh was unparented with its position
   in the world kept as it was. The group and label objects were deleted.
4. **Renamed every mesh** from Z-Anatomy's form (such as `Talus.l` and
   `Talus.r`) to its `bones.json` id (such as `talus_left`).
5. **Left the meshes and pose as they were.** We did not reduce triangles,
   because the count was already far under our 250,000 limit, and reducing
   them would have made lighting look worse and made textures harder to add
   later. The pose was not changed.
6. **Exported** with Blender's default glTF 2.0 settings.

We also set the marker points in `web/public/shared/bones.json` from the
final model's coordinates. That is a change to `bones.json`, not to this file.

### Shared mesh data for left and right

The file has 126 bone nodes but only 63 meshes. Each mesh is used by one
`_right` node and one `_left` node. The `_left` node flips it with a negative
scale. So the two bones of a pair share the same shape data, and the left
bone is a mirrored copy of the right bone.

The person who prepared the model did not add any mirroring and saw separate
left and right meshes in Blender. We have not found out whether the sharing
was already in the Z-Anatomy file or came from the export. This is recorded so
nobody assumes the left and right bones were modeled separately.

## Measurements

Measured on 2026-11-07, at repository commit `df6546f`.

| Item | Value |
| --- | --- |
| Bone nodes | 126 |
| Meshes | 63 (each used by two nodes) |
| Triangles in the meshes | 70,816 |
| Triangles drawn (counting each node) | 141,632 |
| File size | 1,456,956 bytes (about 1.4 MB) |

The person who prepared the model remembered about 77,000 triangles. The file
measures 70,816 per set of meshes. The difference has no known cause, and the
measured value is the one to rely on.

To check again, run this from `web/`:

```sh
npm run check:model
```

It confirms that every bone in `bones.json` is in the model, that left and
right sit on the correct sides, and that the model stays under 250,000
triangles.
