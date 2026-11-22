# India: The Full Story — episode pipeline

Faceless YouTube channel: Indian history in chronological order, 3–5 min episodes, uploads every Monday and Thursday.

## Style (locked)
Cinematic: near-black/brown background, gold #E3B45F, cream #F3E6CC, letterbox bars, dust particles, glowing gold map outline,
Playfair Display (titles) + Inter Bold (labels), channel name top-left in letterbox, episode name top-right, subtitles in bottom bar.
Narrator: Kokoro `am_onyx`, speed 0.9, then ffmpeg chain in voice_gen notes (pitch x0.93, bass +3 dB, compressor, light echo). Loudness -14 LUFS.

## Build an episode (from /pipeline)
1. `npm i @napi-rs/canvas world-atlas topojson-client d3-geo @fontsource/inter @fontsource/playfair-display`
2. Voice model (GitHub release): kokoro-v1.0.onnx + voices-v1.0.bin from thewh1teagle/kokoro-onnx `model-files-v1.0`; `pip install kokoro-onnx soundfile`.
3. Write `script.json` (one narration line per scene) — accuracy checked against NCERT / standard texts; contested points presented neutrally.
4. `python3 voice_gen.py` → narr_raw.wav + timings.json; apply the ffmpeg voice chain → narr.wav.
5. Edit the scene table `S` in ep1.mjs (map camera, marks, overlays, quiz) for the new episode; render 4 chunks in parallel; concat.
6. Music bed + `python3 add_voice.py narr.wav` → final MP4. Captions SRT from segments.json.
7. Commit MP4 to `episodes/epNN/epNN.mp4` (public raw URL is used by the YouTube upload step).

From Episode 2 on: short 5–8 s branded sting instead of Episode 1's long series intro.
Map is a stylised subcontinent outline; check against Survey of India before any episode that shows modern borders.

## Thumbnail (every episode)
Formula agreed 22 Nov 2026: dark-and-gold cinematic look; one large painted hero image or collage (artefacts / ruler / battle) in warm golden light;
3–4 words of huge bold text (gold + white, question or promise); small gold "EP N" badge top-left; no clutter. 1280×720 JPG.
Made in Canva: generate-image for the painted art (leave left third darker for text), then create-design "YouTube Thumbnail" with the art + text, export JPG.
Episode 1: "HOW DO WE KNOW?" over Indus seal, Ashoka lion capital, punch-marked coin, Bhimbetka rock art (Canva design DAHbo61inNM).
Check any map in the art: AI maps of India are often wrong — avoid or keep it a soft glow.
