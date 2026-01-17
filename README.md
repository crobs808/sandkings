# Sandkings

A web-based survival game inspired by George R.R. Martin's "Sandkings" short story. Watch four insectoid colonies grow, compete for resources, and battle each other in a sealed tank environment. 

(Playable demo: https://corusa.com/public/sandkings)

## Features

### Interactive Tools
- **✋ Hand** - Poke and disturb sandkings (they don't like it!)
- **👊 Grab** - Click and drag to pick up individual sandkings and move them around the tank (15px range)
- **🍖 Scraps** - Drag to drop basic table scraps (low nutrition, size scales with sandking age)
- **🥩 Meat** - Drag to drop fresh meat (more nutritious, size scales with sandking age)
- **🦎 Live Food** - Drag to drop live prey (lizards) that flee and struggle - sandkings must hunt them! (best nutrition + reduces hostility)
- **🥓 Treat** - Click to give special treats to a specific colony (costs 5 food supply)
- **🕷️ Spider** - Drag to place a deadly spider enemy - all colonies will unite to fight it! (falls with gravity and bounces)
- **💧 Spray** - Spray water on sand - creates wet spots that darken and slow mobiles by 50% like mud, annoys colonies
- **👁️ Observe** - Click near a colony to get detailed information (popup shows stats, allies/enemies, sizes in mm)
- **👆 Tap** - Tap on the glass to startle all sandkings (disperses them, increases agitation and hostility, they must regroup over 4-5 seconds)

### Environmental Controls
- **Heat Slider** (0-100°) - Control temperature with real-time value display (higher heat = faster growth & hunger, extreme heat = increased aggression)
- **Humidity Slider** (0-100%) - Control moisture with real-time value display (optimal at ~40%, too dry or wet = stress)
- **Weather Presets**:
  - ☁️ **Cloudy** - Cool & Moderate (30° / 50%)
  - ☀️ **Sunny** - Hot & Dry (85° / 20%)
  - 🌧️ **Rainy** - Warm & Humid (55° / 80%)

### Additional Features
- **Auto Feed** - Toggle automatic feeding to keep colonies sustained
- **Sound Control** - Mute/unmute population-scaled ambient sounds and effects
- **Highlight Fights** - Checkbox to show magnified 2.5x zoom view of active battles

### Gameplay Mechanics
- **Four Colonies**: Red, White, Black, Orange - each builds elaborate castles in corner positions
- **Progressive Growth**: Sandkings grow from 1mm to 15mm over 365 game days
- **Warfare System**: Hungry/hostile colonies attack each other with visual battles and magnifier option
- **Spider Threat**: All colonies unite against common threat!
- **Sound System**: Population-scaled ambient sounds with glass tap effects (can be muted)
- **Physics System**: Items fall with gravity and bounce when dropped, food sizes scale with colony age
- **Wet Spots**: Spray creates mud-like areas that slow movement by 50% and darken sand
- **Agitation System**: Tapping disperses colonies with cumulative stress effects
- **Diplomacy**: Colonies form alliances and rivalries visible in Observe panel

## How to Play

1. Open `index.html` in a web browser
2. Select tools from the toolbar to interact
3. **Grab tool** - Click on a sandking, hold, and drag to move it (15px detection range)
4. **Live Food (🦎)** - Click, hold, and drag into tank (it will flee and struggle until overwhelmed!)
5. **Spray Tool (💧)** - Click to create wet spots that slow mobiles and darken sand
6. **Tap Glass (👆)** - Click to startle all colonies (they freeze for 1 second, then scatter and regroup)
7. Feed colonies to keep them alive and reduce hostility
8. Adjust environmental controls or use weather presets for quick climate changes
9. Use Observe tool near castles to see detailed stats, allies, and enemies

## Tips

- Live food (🦎) must be **dragged** like other food types - click, hold, and drag it into the tank
- Food sizes automatically scale with your sandkings' age - early game food is tiny, late game food is larger
- Release a spider to see all colonies temporarily unite against the common threat
- Use grab tool to relocate sandkings to different areas or separate fighting mobiles
- Spray water strategically to slow down attacking forces or create barriers
- Tap the glass repeatedly to cause chaos, but beware - excessive tapping increases hostility significantly
- Well-fed colonies carve adoring faces in their castles; starved colonies create grotesque ones
- Use weather presets for quick environment changes: Cloudy for calm, Sunny for aggression, Rainy for growth
- Enable "Highlight Fights" to see magnified battle views when combat occurs
- Check the Observe panel to see which colonies are allied or enemies with each other
