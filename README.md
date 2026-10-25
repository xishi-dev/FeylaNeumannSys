# Feyla · Neumann.sys

A personal profile site for Feyla, styled as the terminal of Neumann, the cyber queen of the Forest of the Greats from *Petals of Reincarnation*.
Neumann's AI copy opens Feyla's secret files: profile, firewall, food cache, encrypted personality, a relationship lock that denies every request, and open ports.

## Run locally

```bash
npx http-server . -p 5174 -c-1
```

Then open http://localhost:5174.

## How it is built

- Plain HTML, CSS and JavaScript, no build step
- [GSAP](https://gsap.com/) (ScrollTrigger, Draggable) and [Lenis](https://lenis.darkroom.engineering/) for motion and smooth scrolling
- Rose petals are drawn on a canvas; UI sounds are synthesized with the Web Audio API (`js/sound.js`), and the soundtrack runs through a lowpass filter for muffled moments
- `assets/img/hd` holds AI upscales (Real-ESRGAN) as 1920px and 3840px WebP, swapped in after the small image paints

## Credits

Neumann artwork from the anime *Petals of Reincarnation* (มหาศึกวีรชนข้ามภพ) belongs to its rights holders.
Soundtrack: "Muse" by Isabel LaRosa.
