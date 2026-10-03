# Blue Engraving assets

`engraving-cat-astronaut.png` is an AI-generated original lunar scene created with the built-in imagegen tool. The initial generation used a text prompt only, with no source screenshot or external artwork as an image reference. A second imagegen pass resized and repositioned the generated cat to keep its full body visible in a shallow footer. The previous horseback landscape is no longer packaged.

The scene contains a cat astronaut, lunar craters and a trail of paw prints. Its transparent sky blends into the page. `engraving-grain.svg` is a static procedural print texture. Both assets are packaged locally and have no text or interactive meaning.

Final prompt, including the targeted composition adjustment:

```text
Use case: illustration-story.
Asset type: original decorative panoramic footer illustration for a browser bookmark workspace, aspect ratio 3:1, intended display width 1280px and height 250px, also center-cropped on mobile.
Primary request: a charming CAT ASTRONAUT exploring the moon, in a refined antique copperplate engraving / woodcut print style. Create a completely new scene and composition, no source/reference images.
Scene/backdrop: sweeping low lunar crater rims and rippled moon dust across the full width; a large shallow crater in the left foreground, small etched rocks on the right, a winding trail of little paw-shaped boot prints leading toward the center. Quiet and playful space exploration.
Subject: one clearly recognizable cat with whiskers and pointed ears visible inside a round glass space helmet, walking upright in a compact vintage spacesuit with a small backpack, around the horizontal center. The cat's face is warm and curious, anatomically coherent paws/boots, no oversized mascot head. The cat astronaut is the visual focus and occupies about 35 percent of the illustration's total height; keep the entire character inside the central 25 percent of image width so it survives mobile cropping.
Style/medium: fine hand-etched linework, dense delicate crosshatching, irregular engraved strokes, nostalgic illustrated astronomical atlas. Charming but sophisticated, flat two-ink print, not 3D and not a modern cartoon.
Color palette: exactly two colors, dark royal blue ink #163d76 and warm cream paper #f8ebcf. Moon surface and spacesuit have opaque cream paper fill, with blue ink hatch lines. No additional colors.
Composition/framing: a very wide continuous lunar ground strip, terrain fills approximately the bottom 75 percent; low irregular horizon, transparent sky above it. Keep the cat entirely in the ground strip, with its helmet just below the tallest crater ridge. No floating sky objects. Lunar terrain continues through all left, right and bottom edges. Balanced asymmetrical terrain with a shallow diagonal crater arc, not a mountain landscape.
Constraints: sky must be genuinely transparent alpha, preserve opaque cream fills within the moon surface and subject, no white or blue background rectangle, no outer frame, no text, no logos, no lettering, no watermark, no real mission insignia, no existing fictional characters. No horses, riders, cowboys, trees, grass, Earth landscapes, gradients, glows or shadows. This is a fresh original lunar cat scene, not a redraw of an existing scene.
Final targeted edit: preserve the lunar terrain, craters, two-ink colors, etched style, overall 3:1 canvas and transparent sky. Change ONLY the cat astronaut's size and position: reduce the entire cat astronaut uniformly to about 60 percent of its present size, with its helmet near image y=300/683 and its boots near y=550/683. Keep it horizontally centered, full anatomy, no extra characters. Reconstruct the exposed lunar ground naturally and retain the paw-print trail leading to its boots. This leaves the whole cat inside the central lower lunar band so the entire figure survives a shallow center crop for a website footer. No other compositional changes.
```

## Paw-print direction correction

A final built-in imagegen edit reversed the paw-print orientation so the toe pads point along the cat's forward travel direction. The accepted cat astronaut and lunar composition were retained.

```text
Use case: precise-object-edit.
Input image: the accepted blue-and-cream engraved lunar cat astronaut footer. Edit this exact image, do not redesign or recreate it.
Primary request: correct ONLY the orientation of the existing paw-shaped footprints. The cat is walking from the background on the upper left toward the foreground on the lower right. The small toe pads of every paw print must point down-and-right, along that forward travel direction, and the large central paw pad must sit behind the toe pads, on the up-and-left side. The footprints currently face back along the trail; reverse each footprint in place approximately 180 degrees so the toes point forward toward the cat and foreground.
Preserve the exact existing trail positions, spacing, number, scale and perspective. Alter only the internal orientation of each paw-print impression. Match the same dark blue etched ink appearance and cream lunar soil.
Absolute invariants: keep the cat astronaut, its face, ears, whiskers, pose, helmet, suit, backpack, tail, feet, size and position exactly unchanged. Keep every crater, rock, hatch texture, horizon, palette, composition, canvas dimensions and transparent sky unchanged. No extra footprints, no extra objects, no text, no logos, no watermark. Preserve alpha transparency.
```
