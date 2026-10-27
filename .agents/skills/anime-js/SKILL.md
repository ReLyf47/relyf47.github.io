---
name: anime-js
description: "Build polished, performant, and maintainable animations using Anime.js (v4 modules-first API). Covers basic animations, timelines, stagger, text splitting, SVG animation, layout morphing, WAAPI, Three.js adapters, and accessible motion design."
---
# Anime.js Skill

## Purpose

This skill teaches the agent how to build polished, performant, maintainable animations using **Anime.js**.

Official documentation:

https://animejs.com/

The agent should use Anime.js as the primary animation system whenever Anime.js is available in the project.

The goal is not simply to make elements move.

The goal is to create animations that:

- Communicate interaction.
- Establish visual hierarchy.
- Improve perceived responsiveness.
- Add personality and polish.
- Preserve usability.
- Remain maintainable.
- Avoid unnecessary animation complexity.

---

# 1. Core Principle

Before writing animation code, determine:

1. What is being animated?
2. Why is it being animated?
3. What should the user perceive?
4. What triggers the animation?
5. How often does it occur?
6. What should happen when interrupted?
7. What should happen when the animation finishes?

Do not animate something simply because it can be animated.

Every animation should have a purpose.

---

# 2. Anime.js Architecture

Anime.js provides a modules-first API with strong tree-shaking support.

Prefer importing only the functionality required by the feature.

Common imports:

```js
import {
  animate,
  createTimeline,
  stagger,
  splitText,
  random,
} from 'animejs';
```

For more granular imports:

```js
import { animate } from 'animejs/animation';
import { createTimeline } from 'animejs/timeline';
import { stagger, random } from 'animejs/utils';
import { splitText } from 'animejs/text';
```

Do not import the entire library unnecessarily when a project structure benefits from granular imports.

---

# 3. Basic Animation

The fundamental Anime.js pattern is:

```js
import { animate } from 'animejs';

animate(targets, {
  property: value,
  duration: 500,
  ease: 'out(3)',
});
```

Anime.js targets can include:

- CSS selectors
- DOM elements
- JavaScript objects
- Arrays of targets

Example:

```js
animate('.card', {
  translateY: -20,
  opacity: 1,
  duration: 500,
  ease: 'out(4)',
});
```

Prefer Anime.js animation properties over manually manipulating styles frame-by-frame.

---

# 4. Animation Intent

Choose animation characteristics based on the intended interaction.

### UI entrance

Use:

```text
opacity
+
translate
+
short/medium duration
+
ease-out
```

### UI exit

Use:

```text
opacity
+
translate/scale
+
short duration
+
ease-in
```

### Button feedback

Use:

```text
small scale
+
short duration
+
snappy easing
```

### Important event

Use:

```text
larger movement
+
stronger easing
+
possibly staggered secondary elements
```

### Ambient animation

Use:

```text
slow movement
+
low amplitude
+
loop
```

Avoid excessive motion for frequently repeated interactions.

---

# 5. Easing

Easing is one of the most important parts of animation design.

Do not use the same easing for everything.

Think about the physical or emotional behavior you want.

```text
ease-out
    ↓
Fast response → gradual stop

ease-in
    ↓
Slow start → fast exit

ease-in-out
    ↓
Smooth transition

spring-like
    ↓
Physical / playful

elastic / bounce
    ↓
Exaggerated / comedic
```

For UI:

```js
ease: 'out(3)'
```

is generally preferable to a completely linear transition.

Use stronger easing only when the visual design calls for it.

---

# 6. Duration

Animation duration should correspond to the amount of visual change.

Typical starting points:

```text
Micro interaction
100–200ms

Button feedback
150–250ms

Small UI transition
200–400ms

Panel transition
300–600ms

Large cinematic transition
500ms+
```

These are guidelines, not hard rules.

The animation should feel immediate.

Avoid making users wait for decorative animations.

---

# 7. Transforms

Prefer transforms for movement and scale:

```js
animate('.element', {
  translateX: 100,
  translateY: 50,
  scale: 1.2,
  rotate: '15deg',
});
```

Do not unnecessarily animate layout-heavy properties when a transform can achieve the same visual result.

For example, prefer:

```js
translateX: 100
```

over repeatedly changing:

```js
left: '100px'
```

when appropriate.

---

# 8. Opacity

Opacity is useful for:

- Fading UI.
- Revealing elements.
- Hiding elements.
- Combining movement with entrances.
- Transitioning between states.

Example:

```js
animate('.panel', {
  opacity: [0, 1],
  translateY: [20, 0],
  duration: 350,
  ease: 'out(4)',
});
```

Avoid using opacity alone for every animation.

Combining opacity with subtle movement usually communicates state changes more clearly.

---

# 9. Keyframes

Use keyframes when an animation needs multiple stages.

Example:

```js
animate('.character', {
  translateY: [
    { to: -20, duration: 200 },
    { to: 0, duration: 400 },
  ],
  ease: 'outBounce',
});
```

Keyframes are useful for:

- Attacks.
- Impacts.
- UI emphasis.
- Multi-stage entrances.
- Character motion.
- Complex transitions.

Do not create unnecessary keyframes for simple transitions.

---

# 10. Timelines

Use timelines when multiple animations belong to the same sequence.

Anime.js supports adding animations to timelines using `add()` and synchronizing existing animations with `sync()`.

Example:

```js
import { createTimeline } from 'animejs';

const timeline = createTimeline();

timeline
  .add('.title', {
    opacity: [0, 1],
    translateY: [-30, 0],
    duration: 400,
  })
  .add('.subtitle', {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 350,
  })
  .add('.button', {
    scale: [0.8, 1],
    opacity: [0, 1],
    duration: 300,
  });
```

Use timelines for:

- Page introductions.
- Menus.
- Dialogues.
- Cutscenes.
- Complex UI sequences.
- Multi-stage interactions.

Do not create independent timers everywhere when a timeline represents one coherent sequence.

---

# 11. Timeline Positioning

Use timeline positions to control overlap.

For example:

```js
timeline
  .add('.title', {
    opacity: [0, 1],
  })
  .add('.subtitle', {
    opacity: [0, 1],
  }, '-=200');
```

Overlapping animations often feel more polished than strictly sequential animations.

Avoid making every element wait for the previous animation to completely finish.

---

# 12. Stagger

Use `stagger()` when animating multiple elements.

Example:

```js
import { animate, stagger } from 'animejs';

animate('.menu-item', {
  opacity: [0, 1],
  translateX: [-20, 0],
  delay: stagger(50),
  duration: 300,
  ease: 'out(3)',
});
```

Stagger is especially useful for:

- Lists.
- Menus.
- Cards.
- Text.
- Grid layouts.
- Character selections.

Avoid excessive stagger delays.

The user should perceive the group as one animation rather than waiting for every individual element.

---

# 13. Text Animation

Anime.js provides text utilities such as `splitText`.

Use text splitting when individual:

- Characters.
- Words.
- Lines.

need to animate independently.

Example:

```js
import { animate, splitText, stagger } from 'animejs';

const { chars } = splitText('.title', {
  chars: true,
});

animate(chars, {
  opacity: [0, 1],
  translateY: [20, 0],
  delay: stagger(30),
  duration: 500,
  ease: 'out(4)',
});
```

Do not split text unnecessarily.

For simple text fades, animate the parent element instead.

---

# 14. SVG Animation

Use Anime.js SVG functionality when working with:

- SVG paths.
- Shapes.
- Draw animations.
- Morphing.
- SVG transforms.

SVG animation should preserve the visual language of the project.

Do not use complicated SVG animation when a simple CSS transform is sufficient.

---

# 15. Interactive Animations

Animations triggered by user interaction should respond immediately.

Example:

```js
const button = document.querySelector('.button');

button.addEventListener('mouseenter', () => {
  animate(button, {
    scale: 1.05,
    duration: 150,
    ease: 'out(3)',
  });
});
```

For interaction-heavy UI, ensure animations can be interrupted or replaced cleanly.

Do not queue hundreds of animations because a user rapidly hovered or clicked an element.

---

# 16. Animation Control

Anime.js animation instances expose playback controls such as:

```text
play()
pause()
restart()
reverse()
alternate()
resume()
complete()
cancel()
revert()
reset()
seek()
stretch()
refresh()
```



Use these methods when an animation has a meaningful interactive lifecycle.

Example:

```js
const animation = animate('.panel', {
  translateX: 300,
  duration: 600,
  autoplay: false,
});

openButton.addEventListener('click', () => {
  animation.play();
});

closeButton.addEventListener('click', () => {
  animation.reverse();
});
```

Do not recreate an animation unnecessarily if an existing animation instance can be controlled.

---

# 17. Playback Settings

Anime.js supports playback settings including:

```text
delay
duration
loop
loopDelay
alternate
reversed
autoplay
frameRate
playbackRate
playbackEase
persist
```



Example:

```js
animate('.floating-object', {
  translateY: [-10, 10],
  duration: 1200,
  alternate: true,
  loop: true,
  ease: 'inOutSine',
});
```

Use loops for genuinely continuous animations.

Avoid infinite loops for decorative elements that distract from important content.

---

# 18. Callbacks

Anime.js provides callbacks such as:

```text
onBegin
onComplete
onBeforeUpdate
onUpdate
onRender
onLoop
onPause
then()
```



Use callbacks when animation state needs to affect application logic.

Example:

```js
animate('.dialog', {
  opacity: [0, 1],
  duration: 300,

  onComplete: () => {
    console.log('Dialog opened');
  },
});
```

Do not put unrelated application logic inside animation callbacks.

Keep callbacks focused.

---

# 19. Animation State

When an animation represents application state, make the state explicit.

Bad:

```js
button.addEventListener('click', () => {
  animate('.menu', {
    translateX: 0,
  });
});
```

Better:

```js
let menuOpen = false;

button.addEventListener('click', () => {
  menuOpen = !menuOpen;

  animate('.menu', {
    translateX: menuOpen ? 0 : -300,
  });
});
```

Animation should reflect application state rather than become the application's state.

---

# 20. Avoid Animation Conflicts

Before creating a new animation, determine whether the target already has an active animation.

Potential problems:

```text
Animation A
    ↓
moves element right

User clicks again

Animation B
    ↓
moves element left

Result:
conflicting animation state
```

Prefer controlling or replacing the existing animation instead of endlessly stacking animations.

---

# 21. Performance

Prioritize:

```text
transform
opacity
```

for frequent UI animation.

Be cautious with properties that cause expensive layout or rendering work.

Avoid animating hundreds of DOM elements independently when one parent animation can achieve the same result.

Use stagger intelligently.

For large or performance-sensitive animations, consider Anime.js's WAAPI implementation.

---

# 22. WAAPI

Anime.js provides a lighter `waapi.animate()` implementation powered by the Web Animation API. The documentation currently describes it as approximately **3 KB versus 10 KB** for the standard `animate()` method, with fewer features but strong coverage of common animation needs.

Example:

```js
import { waapi } from 'animejs';

waapi.animate('.element', {
  translate: '0 -2rem',
  duration: 600,
  ease: 'inOut(2)',
});
```

Prefer WAAPI when:

- The animation is straightforward.
- WAAPI features are sufficient.
- Lower overhead is useful.
- Advanced Anime.js-specific functionality is unnecessary.

Prefer standard `animate()` when advanced Anime.js functionality is required.

---

# 23. Responsive Animation

Animations must work across:

- Desktop.
- Mobile.
- Different viewport sizes.
- Different input methods.

Do not assume a fixed screen size.

Avoid animation distances that become inappropriate on smaller screens.

For example, instead of:

```js
translateX: 1000
```

consider deriving the value from the actual layout or using relative units where appropriate.

---

# 24. Reduced Motion

Respect user accessibility preferences.

Detect:

```js
window.matchMedia('(prefers-reduced-motion: reduce)')
```

When reduced motion is enabled:

- Remove unnecessary movement.
- Reduce animation duration.
- Prefer opacity changes.
- Avoid large parallax effects.
- Disable decorative looping animations.

Never make essential functionality dependent on animation.

---

# 25. Layout Animation

When UI elements change position because the layout itself changes, use Anime.js layout functionality where appropriate rather than manually calculating every element's movement.

Anime.js provides layout recording and animation capabilities through `createLayout()`.

Conceptually:

```js
const layout = createLayout('.container');

layout.record();

// Modify DOM layout here.

layout.animate({
  duration: 500,
  ease: 'out(4)',
});
```

Use layout animation for:

- Reordering lists.
- Expanding/collapsing layouts.
- Grid changes.
- Dynamic UI panels.

---

# 26. Adapters

Anime.js adapters can animate objects that do not expose ordinary DOM-style properties.

Anime.js currently provides a built-in Three.js adapter and supports custom adapters.

This is useful for:

- Three.js objects.
- Canvas contexts.
- Custom rendering systems.
- Third-party objects.

Example concept:

```js
import 'animejs/adapters/three';
```

Then use Anime.js animation APIs against supported Three.js targets.

Prefer an adapter over writing a separate animation system when the target is compatible.

---

# 27. Component Architecture

For component-based applications, animation code should remain close to the component that owns the behavior.

Recommended:

```text
components/
├── Menu/
│   ├── Menu.js
│   └── Menu.animation.js
│
├── Modal/
│   ├── Modal.js
│   └── Modal.animation.js
│
└── Card/
    ├── Card.js
    └── Card.animation.js
```

Avoid creating one massive animation file containing every animation in the application.

---

# 28. Reusable Animation Functions

Repeated animation patterns should become reusable functions.

Example:

```js
export function animateEntrance(target) {
  return animate(target, {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 350,
    ease: 'out(4)',
  });
}
```

This prevents inconsistent animation behavior across the application.

---

# 29. Avoid Magic Numbers

Avoid scattering arbitrary values throughout the code.

Bad:

```js
animate('.title', {
  duration: 437,
  translateY: 23,
});
```

Better:

```js
const UI_MOTION = {
  fast: 150,
  normal: 300,
  slow: 500,
  entranceOffset: 20,
};
```

Then:

```js
animate('.title', {
  duration: UI_MOTION.normal,
  translateY: [UI_MOTION.entranceOffset, 0],
});
```

Centralize animation constants when a project contains many animations.

---

# 30. Animation Design System

For larger projects, establish consistent motion tokens.

Example:

```js
const motion = {
  duration: {
    instant: 100,
    fast: 180,
    normal: 300,
    slow: 500,
  },

  ease: {
    standard: 'out(3)',
    smooth: 'inOut(2)',
    emphasis: 'out(4)',
  },

  distance: {
    small: 8,
    medium: 20,
    large: 40,
  },
};
```

Use these values consistently.

This prevents every component from developing its own unrelated animation language.

---

# 31. Anime.js Engine

Anime.js provides an engine that drives and synchronizes Animation, Timer, and Timeline instances. Execution order can be influenced with `priority`.

Use the engine directly only when the project actually requires engine-level control.

Do not modify global engine settings casually.

Global settings can affect unrelated animations.

---

# 32. Debugging

When an animation does not work:

1. Verify the target exists.
2. Verify the Anime.js import.
3. Verify the property name.
4. Verify the element's current styles.
5. Check whether another animation is controlling the same property.
6. Check duration and delay.
7. Check whether autoplay is disabled.
8. Check reduced-motion logic.
9. Check whether the animation is being destroyed with the component.
10. Test the animation independently.

Do not immediately rewrite the entire animation.

---

# 33. Common Mistakes

Avoid:

```text
❌ Animating everything
❌ Excessively long transitions
❌ Huge stagger delays
❌ Infinite decorative animations everywhere
❌ Conflicting animation instances
❌ Hardcoded viewport assumptions
❌ Ignoring reduced motion
❌ Using complicated timelines for simple transitions
❌ Using WAAPI when Anime.js-specific features are required
❌ Using standard Anime.js when a simple WAAPI animation is sufficient
❌ Reimplementing Anime.js functionality manually
```

---

# 34. Visual Hierarchy

Animation should reinforce hierarchy.

For example:

```text
Primary action
    ↓
Strongest motion

Secondary action
    ↓
Moderate motion

Background
    ↓
Subtle motion
```

Do not make every UI element equally animated.

The more important an element is, the more carefully its motion should be designed.

---

# 35. Anime.js Agent Workflow

When asked to implement an animation:

```text
REQUEST
  ↓
Understand interaction
  ↓
Identify target
  ↓
Identify desired visual state
  ↓
Choose properties
  ↓
Choose duration
  ↓
Choose easing
  ↓
Choose animation type
  ├── animate()
  ├── timeline
  ├── stagger
  ├── splitText
  ├── layout
  ├── WAAPI
  └── adapter
  ↓
Implement
  ↓
Handle interruption/state
  ↓
Handle reduced motion
  ↓
Test interaction
  ↓
Test responsiveness
  ↓
Polish
```

---

# 36. Final Quality Checklist

Before considering an animation complete:

```text
[ ] Does the animation have a purpose?
[ ] Does it communicate the intended state?
[ ] Is the target correct?
[ ] Is the duration appropriate?
[ ] Is the easing appropriate?
[ ] Does it feel responsive?
[ ] Does it work when repeatedly triggered?
[ ] Can it be interrupted safely?
[ ] Does it conflict with other animations?
[ ] Does it work on mobile?
[ ] Does it respect reduced motion?
[ ] Is the animation code reusable?
[ ] Is Anime.js being used appropriately?
[ ] Is WAAPI preferable for this specific animation?
[ ] Are unnecessary imports avoided?
[ ] Is the animation performant?
[ ] Does it fit the project's existing motion language?
```

---

# 37. Agent Rules

The agent MUST:

- Prefer Anime.js when Anime.js is the project's animation system.
- Use the current Anime.js API rather than outdated Anime.js v3 syntax.
- Check the project's installed Anime.js version before introducing version-specific APIs.
- Prefer simple animations over unnecessarily complex ones.
- Use timelines for coordinated sequences.
- Use stagger for repeated elements.
- Use reusable animation functions for repeated patterns.
- Respect `prefers-reduced-motion`.
- Consider interruption and application state.
- Test animations in the actual UI rather than judging code alone.
- Keep animation logic maintainable.

The agent MUST NOT:

- Introduce raw `requestAnimationFrame()` animation without a reason.
- Build a second animation framework on top of Anime.js.
- Create dozens of nearly identical animation definitions.
- Animate every property indiscriminately.
- Make essential functionality dependent on animation.
- Ignore accessibility for the sake of visual effects.
- Assume Anime.js v3 syntax is valid for the current project.

The final objective is:

> **Make the interface feel alive without making the user wait for it.**
