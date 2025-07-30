## Aspect Ratio Management in VOTE and SWIPE Pages

This document provides a comprehensive overview of how we achieved and managed a stable 3:4 aspect ratio for cards in both the VOTE and SWIPE pages, including the challenges faced and solutions implemented.

### Challenges

- **Maintaining aspect ratio:** Ensuring cards maintain a consistent 3:4 aspect ratio across different screen orientations and grid layouts.
- **Handling different layouts:** Both pages require specific considerations due to their unique layout constraints.
- **Responsive design:** The application needed to adapt gracefully between portrait and landscape modes.

### SWIPE Page

**Objective:**
Maintain a 3:4 aspect ratio for the swipe card while ensuring it fits within the designated grid area.

**Approach:**
- Use `aspect-ratio: 3 / 4` CSS property to enforce the aspect ratio.
- Adjust dimensions based on orientation:
  - **Portrait Mode:** Constrained by width (`width: 100%`); height calculated.
  - **Landscape Mode:** Constrained by height (`height: 100%`); width calculated.

```css
.swipe-grid .card-container {
  aspect-ratio: 3 / 4;
  align-self: center;
  justify-self: center;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}
@media (orientation: portrait) {
  .swipe-grid .card-container {
    width: 100%;
    height: auto;
  }
}
@media (orientation: landscape) {
  .swipe-grid .card-container {
    height: 100%;
    width: auto;
  }
}
```

### VOTE Page

**Objective:**
Ensure both cards maintain a 3:4 aspect ratio while accommodating dual-card layout constraints.

**Approach:**
- Use `aspect-ratio: 3 / 4` CSS property to enforce the aspect ratio.
- Adjust dimensions based on orientation:
  - **Portrait Mode:** Constrained by height (`height: 100%`); width calculated.
  - **Landscape Mode:** Constrained by height (`height: 100%`); width calculated to fit side-by-side layout.

```css
.vote-grid .card-container {
  aspect-ratio: 3 / 4;
  align-self: center;
  justify-self: center;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}
@media (orientation: portrait) {
  .vote-grid .card-container {
    height: 100%;
    width: auto;
  }
}
@media (orientation: landscape) {
  .vote-grid .card-container {
    height: 100%;
    width: auto;
  }
}
```

### Summary

Both the SWIPE and VOTE pages now maintain a consistent 3:4 aspect ratio across all orientations. By relying on CSS properties like `aspect-ratio`, we ensured that the cards are visually uniform, responsive, and adaptive to various screen sizes. The deliberate constraint on dimensions allowed for a seamless visual experience, regardless of device orientation.
