# Shared palette

Every sheet under `tools/sprites`, `tools/tiles` and `tools/ui` should pick its colors from this
list (32 colors, SNES-ish). A sheet maps its own single-character keys to these hexes in its
`palette:` block; the generator does not care which letter you use, only that it is declared.
Keep each sprite sheet at 16 opaque colors or fewer (`docs/ARCHITECTURE.md` section 11); tilesets
and the UI atlas may use up to 32.

| Name | Hex | Use |
|---|---|---|
| outline | `#141018` | **Every outline**, pupils, mouths, soles. Never use pure black. |
| white | `#f8f8f8` | Eye whites, glints, window border, cursor |
| gray_light | `#c8ccd4` | Slime highlight (Phoenix), studs, concrete highlight, inner window border |
| gray_mid | `#9aa0a8` | Phoenix slime base, sidewalk base |
| gray_dark | `#5c6068` | Slime shadow (Phoenix), hoodie highlight, concrete joints, metal |
| shadow | `#30303c` | Asphalt, trash bags, hoodie base, deepest neutral shadow |
| snow_light | `#e8f0ff` | Snow base |
| snow | `#bcd0ec` | Snow texture dots, snow mid-tone |
| snow_shadow | `#8ca4cc` | Snowbank shadow faces, dim glow for deflated slime |
| slush | `#6c7890` | Dirty snow, slush puddles, pavement grime |
| pink | `#ff5fd2` | Lucky's slime base, neon signs, pothole glow, meter |
| pink_light | `#ff9ae6` | Lucky's highlight |
| pink_dark | `#b0308c` | Lucky's shadow, dark neon |
| green | `#39ff8a` | Slime glow accents, neon, street-sign face, poison icon |
| green_dark | `#1c8c48` | Shaded slime green, dumpster shadow, poison shade |
| cyan | `#40e0f0` | Glass glints, cosmic signal effects |
| eternity | `#1c0c2c` | Purple-black: The Eternity, night glass, Lucky's belt/boots, hoodie shadow |
| navy | `#142050` | Dialogue window fill, dark window glass |
| denim | `#3c5c9c` | Jeans, window-frame light line, lit-glass blue |
| denim_dark | `#24386c` | Jeans shadow, window fill shadow line |
| skin | `#f0c8a0` | Human skin (Ryan, Brian) |
| skin_shadow | `#c89060` | Human skin shadow, Bajonka's inner ear |
| brown | `#7c4c2c` | Hair, wood, fence rails |
| brown_dark | `#48281c` | Wood shadow, dive-bar door |
| brick | `#a84838` | Brick base |
| brick_dark | `#6c2828` | Mortar, brick shadow |
| brick_light | `#cc6c50` | Brick highlight |
| yellow | `#f8d820` | Road lines, lit windows, lamp light, dazed stars |
| orange | `#e88830` | Warm light falloff, Bajonka's coat, rage highlight |
| red | `#d83030` | EJECT button, Lucky rage base, billboard heart |
| dumpster_green | `#3c8c40` | Dumpsters, street signs |
| cream | `#f0dcb0` | Bajonka's muzzle/legs, warm paper |

## Conventions

- Outline everything that is a *thing* (characters, props) with `outline`; ground tiles have no
  outline so they tile seamlessly.
- Light comes from the top-left: highlight on the upper-left of a shape, shadow on the lower-right.
- One highlight tone and one shadow tone per material is enough at 16 px.
- Lucky's mood variants are palette swaps of the same drawing (`lucky_rage`, `lucky_deflated`),
  declared with `variant:` lines in `tools/sprites/lucky.txt`, not runtime tinting.
