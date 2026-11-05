# The Bridge Everyone Leaned On - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `sfx_gen.py` / `instruments.py`, placed by `sfx.py` / `music.py`, mixed by `mix.py`.
Voice = `voice/voice.wav`, gain only (no EQ, no compression, no pitch).

## Files
| file | content |
|---|---|
| `mix.wav` | final mix, 48 kHz, stereo, 24-bit, 2,880,000 samples = 60.000 s |
| `stem_voice.wav` / `stem_music.wav` / `stem_sfx.wav` | stems at mix gain (they sum to the mix before the master limiter) |

## Master loudness (own BS.1770-4 meter)
- Integrated **-15.0 LUFS**, true peak **-1.2 dBTP**, LRA 1.5 LU, max momentary -11.3 LUFS, max short-term -13.8 LUFS
- Stems: voice -15.1 LUFS, music -25.5 LUFS, sfx -30.9 LUFS (voice gain +6.60 dB, same gain on every stem)
- Master limiter (4x oversampled look-ahead, ceiling -1.2 dBTP): max gain reduction 1.34 dB, active (>0.1 dB) on 2.57 % of samples, >0.5 dB on 0.61 %

ffmpeg ebur128 cross-check:
```
Summary:
  Integrated loudness:
    I:         -15.0 LUFS
    Threshold: -25.3 LUFS
  Loudness range:
    LRA:         1.5 LU
    Threshold: -35.2 LUFS
    LRA low:   -15.9 LUFS
    LRA high:  -14.4 LUFS
  True peak:
    Peak:       -1.2 dBFS
```

## Voice on top: per-section loudness (LUFS, integrated per stem, at mix gain)
bed = music + sfx. margin = voice - bed (integrated over the section). speech median / p10 = median and 10th percentile of the 400 ms momentary margin (voice - bed) over windows centred on spoken words.

| section (shots) | time s | voice | music | sfx | bed | margin LU | speech median LU | speech p10 LU |
|---|---|---|---|---|---|---|---|---|
| hook (1) | 0.00-5.83 | -15.0 | -24.8 | -31.2 | -23.9 | 8.9 | 8.8 | 5.3 |
| town (2) | 5.83-13.30 | -15.3 | -27.3 | -33.4 | -26.3 | 11.0 | 10.5 | 6.5 |
| fill (3) | 13.30-18.13 | -15.0 | -24.0 | -32.2 | -23.3 | 8.3 | 8.2 | 1.9 |
| rush (4) | 18.13-22.53 | -15.1 | -24.9 | -29.1 | -23.5 | 8.4 | 8.3 | 4.4 |
| sway (5) | 22.53-25.27 | -14.6 | -25.5 | -24.7 | -22.7 | 8.1 | 7.1 | 2.6 |
| luckily (6) | 25.27-27.03 | -14.2 | -23.5 | -33.0 | -23.2 | 8.9 | 7.2 | 2.3 |
| owners (7) | 27.03-29.27 | -14.4 | -26.0 | -38.0 | -27.1 | 12.7 | 18.6 | 8.8 |
| explain (8) | 29.27-38.27 | -15.2 | -26.7 | -36.3 | -26.3 | 11.1 | 10.7 | 7.8 |
| rowboat (9) | 38.27-43.97 | -15.0 | -26.0 | -30.9 | -24.8 | 9.7 | 9.6 | 4.7 |
| edge (10) | 43.97-47.33 | -14.8 | -27.2 | -34.6 | -26.5 | 11.8 | 10.8 | 6.0 |
| rebuilt (11-12) | 47.33-52.83 | -15.2 | -25.1 | -31.9 | -24.5 | 9.3 | 8.3 | 4.8 |
| today (13) | 52.83-60.00 | -14.8 | -24.6 | -32.1 | -24.0 | 9.2 | 10.3 | 5.5 |

## Music map (original regatta march, Bb major, 120 bpm)
Music target per section, LU under the voice (after a -3 dB speech duck keyed from words.json): hook -9.5, story -10.5, race -9.5, sway -11.0, relief -9.0, explain -11.5, rowboat -11.0, callback -12.5, rebuild -10.0, today -11.0, end -8.0. Applied section gains (dB): hook -11.5, story -10.7, race -13.5, sway -9.4, relief -6.2, explain -11.0, rowboat -10.3, callback -9.8, rebuild -11.4, today -13.1, end -4.9, deadpan -6.2.

Rides (music only, dB): 4.40-5.60 s -2.0, 21.30-22.00 s -2.0 - so quiet sentence-final words stay on top.

| time s | frame | music |
|---|---|---|
| 0.00 | 0 | hook: regatta theme bars 1-2 tutti (fife, glock, tuba/after-beats, snare) |
| 4.00 | 120 | the band droops: tuba sinks chromatically under 'The bridge was not thrilled about it.' |
| 5.83 | 175 | Bb button + clash exactly on the white flash (frame 175) |
| 6.25 | 188 | story: theme bars 1-4, light (glock + fife, tuba on 1/3, horns on 2/4) |
| 14.25 | 428 | full band, theme bars 5-6 with cornet as the footpaths fill; Eb-F7 turnaround on 'every last gap' |
| 18.25 | 548 | race: theme on cornet, bouncing tuba octaves, snare drive (boats appear 18.13, rush 20.8) |
| 22.50 | 675 | DEAD STOP on 'The chains creak' - only the chains are heard |
| 23.45 | 704 | sway: timpani + low brass wobbling with the deck, dim7 pad |
| 25.27 | 758 | relief: warm Bb chord + glock tag on 'Luckily, the bridge held.' |
| 28.68 | 860 | silence for the deadpan, then a tuba 'wah-wah-wah-waaah' after 'watching too.' |
| 29.40 | 882 | golden explanation: warm pad Bb - Eb - F - Gm, vibes pendulum |
| 36.06 | 1082 | tuba slides down on 'pushed down', glock run up on 'lifts' |
| 38.30 | 1149 | rowing boat: rocking 6/8 music box + pizzicato, the tune climbs as they lean |
| 43.11 | 1293 | cut on 'tips': timpani + cymbal splash |
| 44.00 | 1320 | callback: low F7sus pad, slow timpani |
| 47.50 | 1425 | rebuild: soft march |
| 49.42 | 1483 | 1887 fanfare (Bb stab + cymbal + timpani) on 'a stronger one opened', full band bars 3-4 |
| 53.00 | 1590 | today: relaxed swung version, vibes melody, walking pizzicato bass, brushes |
| 56.42 | 1693 | DEAD STOP just before 'Cracks.' |
| 57.35 | 1720 | two deadpan low notes (F, Bb) after the crack; rings out under the crane |

## SFX events
Level convention: every EVENT has a naive level (LU vs the voice stem, as the event's max momentary loudness); applied = naive - 6 dB (standard mix rule) + distance/intensity offsets. BEDS are integrated loudness, not reduced. 'mix LUFS' = the event's max momentary loudness in the final mix (voice stem = -15.1 LUFS integrated). Oar sounds also get a camera-distance gain and low-pass.

| # | time s | frame | cue | what | naive LU | applied LU | mix LUFS | pan |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.0 | amb_day (bed, integrated) | race day by the river: breeze, river, sparrows, tower flags (shots 1-7) | -29 | -29.0 | -44.1 | +0.00 |
| 2 | 0.000 | 0.0 | crowd_hook | packed deck in the flash-forward: 'whoa's as it sways, nervous murmur | -10 | -16.0 | -31.2 | +0.00 |
| 3 | 0.067 | 2.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 1, 16 m) | -12 | -26.4 | -41.9 | -0.25 |
| 4 | 1.200 | 36.0 | whoas_hook | crowd 'whoa!' as the deck swings (hook) | -9 | -15.0 | -30.1 | +0.00 |
| 5 | 1.450 | 43.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 1, 25 m) | -12 | -29.3 | -44.9 | +0.25 |
| 6 | 1.733 | 52.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 1, 23 m) | -12 | -28.7 | -44.4 | -0.25 |
| 7 | 3.117 | 93.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 1, 31 m) | -12 | -30.5 | -46.2 | +0.25 |
| 8 | 3.400 | 102.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 1, 31 m) | -12 | -30.4 | -46.3 | -0.25 |
| 9 | 3.833 | 115.0 | whoosh_cam | camera cut up to the chain | -13 | -19.0 | -34.1 | +0.00 |
| 10 | 4.783 | 143.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 1, 38 m) | -12 | -34.0 | -49.8 | +0.25 |
| 11 | 5.067 | 152.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 1, 38 m) | -12 | -34.0 | -49.9 | -0.25 |
| 12 | 5.833 | 175.0 | flash_whoosh | reverse swell into the white flash (frame 175) + soft low whoomp | -5 | -11.0 | -26.1 | +0.00 |
| 13 | 5.833 | 175.0 | town_murmur | townsfolk on both banks waiting for the race (shot 2) | -14 | -20.0 | -35.2 | +0.00 |
| 14 | 6.383 | 191.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 2, 116 m) | -12 | -34.0 | -50.6 | +0.25 |
| 15 | 6.667 | 200.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 2, 106 m) | -12 | -34.0 | -50.6 | -0.25 |
| 16 | 8.050 | 241.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 2, 109 m) | -12 | -34.0 | -50.5 | +0.25 |
| 17 | 8.333 | 250.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 2, 99 m) | -12 | -34.0 | -50.6 | -0.25 |
| 18 | 9.717 | 291.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 2, 103 m) | -12 | -34.0 | -50.3 | +0.25 |
| 19 | 10.000 | 300.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 2, 92 m) | -12 | -34.0 | -50.5 | -0.25 |
| 20 | 10.180 | 305.4 | bank_cheer | banks cheer the crews on 'the best free seat' | -9 | -15.0 | -30.3 | +0.00 |
| 21 | 11.167 | 335.0 | whoosh_cam | camera cut down to the crews | -13 | -19.0 | -34.1 | +0.00 |
| 22 | 11.383 | 341.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 2, 24 m) | -12 | -28.9 | -44.7 | +0.25 |
| 23 | 11.633 | 349.0 | cox_call | cox calling the stroke (far) | -18 | -24.0 | -39.6 | +0.40 |
| 24 | 11.667 | 350.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 2, 14 m) | -12 | -25.7 | -41.3 | -0.25 |
| 25 | 11.833 | 355.0 | cox_call | cox calling the stroke (far) | -18 | -24.0 | -39.5 | -0.40 |
| 26 | 13.050 | 391.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 2, 24 m) | -12 | -28.9 | -44.6 | +0.25 |
| 27 | 13.090 | 392.7 | deck_murmur | the deck fills: murmur swelling from a handful of voices to a packed crowd (shot 3) | -12 | -18.0 | -33.2 | +0.00 |
| 28 | 14.300 | 429.0 | crowd_steps | crowd footsteps on the planks: footpaths fill | -14 | -20.0 | -35.1 | +0.00 |
| 29 | 15.730 | 471.9 | crowd_steps | crowd footsteps on the planks: then the road | -12 | -18.0 | -33.1 | +0.00 |
| 30 | 15.800 | 474.0 | whoosh_cam | camera drop to deck level | -13 | -19.0 | -34.1 | +0.00 |
| 31 | 16.610 | 498.3 | crowd_steps | crowd footsteps on the planks: every last gap | -11 | -17.0 | -32.1 | +0.00 |
| 32 | 18.030 | 540.9 | race_murmur | crowd excited as the boats appear (shot 4) | -10 | -16.0 | -31.2 | +0.00 |
| 33 | 18.333 | 550.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 4, 41 m) | -12 | -32.2 | -48.2 | -0.25 |
| 34 | 19.717 | 591.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 4, 42 m) | -12 | -32.4 | -48.5 | +0.25 |
| 35 | 20.000 | 600.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 4, 34 m) | -12 | -31.0 | -46.8 | -0.25 |
| 36 | 20.600 | 618.0 | whoosh_cam | camera cut onto the deck for the rush | -13 | -19.0 | -34.1 | +0.00 |
| 37 | 20.650 | 619.5 | rush | twelve thousand people rush to one rail: running feet, hurrahs, 'there they are!' | -4 | -10.0 | -25.1 | +0.00 |
| 38 | 21.383 | 641.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 4, 27 m) | -12 | -29.6 | -45.4 | +0.25 |
| 39 | 21.400 | 642.0 | rush_cheer | cheering at the upstream rail | -8 | -14.0 | -29.2 | +0.00 |
| 40 | 21.667 | 650.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 4, 15 m) | -12 | -26.1 | -41.6 | -0.25 |
| 41 | 22.410 | 672.3 | chain_creak | 'The chains creak': long iron groan + timber creak (crowd goes quiet) | -2 | -8.0 | -23.1 | -0.35 |
| 42 | 23.050 | 691.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 5, 10 m) | -12 | -23.6 | -38.9 | +0.25 |
| 43 | 23.333 | 700.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 5, 14 m) | -12 | -25.7 | -41.1 | -0.25 |
| 44 | 23.389 | 701.7 | sway_creak | the deck swings (0.95 Hz): creak + chain groan at each extreme (sway 0.21) | -6 | -16.1 | -32.3 | +0.30 |
| 45 | 23.400 | 702.0 | whoosh_cam | camera cut to the end-on wide | -13 | -19.0 | -34.1 | +0.00 |
| 46 | 23.680 | 710.4 | sway_groan | chains groaning through the sway | -7 | -13.0 | -28.1 | -0.30 |
| 47 | 23.880 | 716.4 | whoas | crowd: 'whoa!' as the deck swings under them | -6 | -12.0 | -27.1 | +0.00 |
| 48 | 23.916 | 717.5 | sway_creak | the deck swings (0.95 Hz): creak + chain groan at each extreme (sway 0.55) | -6 | -13.6 | -29.8 | -0.30 |
| 49 | 24.442 | 733.3 | sway_creak | the deck swings (0.95 Hz): creak + chain groan at each extreme (sway 0.99) | -6 | -12.0 | -28.2 | +0.30 |
| 50 | 24.717 | 741.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 5, 53 m) | -12 | -33.7 | -49.8 | +0.25 |
| 51 | 24.968 | 749.1 | sway_creak | the deck swings (0.95 Hz): creak + chain groan at each extreme (sway 0.81) | -6 | -12.5 | -28.7 | -0.30 |
| 52 | 25.000 | 750.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 5, 42 m) | -12 | -32.3 | -48.2 | -0.25 |
| 53 | 25.870 | 776.1 | relief_cheer | relief: the crowd cheers the crews rowing away (shot 6) | -10 | -16.0 | -31.3 | +0.00 |
| 54 | 26.383 | 791.5 | oar_catch | Cambridge: eight blades bite the water + drive swish (shot 6, 22 m) | -12 | -28.4 | -44.1 | +0.25 |
| 55 | 26.667 | 800.0 | oar_catch | Oxford: eight blades bite the water + drive swish (shot 6, 26 m) | -12 | -29.4 | -45.1 | -0.25 |
| 56 | 28.000 | 840.0 | whoosh_cam | camera push to the owners | -13 | -19.0 | -34.1 | +0.00 |
| 57 | 29.100 | 873.0 | amb_golden (bed, integrated) | golden-hour calm: soft breeze, blackbirds, crickets, distant river (shots 8-10) | -29 | -29.0 | -44.1 | +0.00 |
| 58 | 29.267 | 878.0 | whoosh_xfade | crossfade to golden light | -13 | -19.0 | -34.1 | +0.00 |
| 59 | 31.633 | 949.0 | whoosh_cam | camera closer, end-on | -13 | -19.0 | -34.1 | +0.00 |
| 60 | 34.330 | 1029.9 | group_steps | the small crowd shuffles to one side | -12 | -18.0 | -33.1 | +0.00 |
| 61 | 36.010 | 1080.3 | tilt_creak | deck tilting down on the loaded side: long low timber creak | -8 | -14.0 | -29.1 | +0.30 |
| 62 | 37.360 | 1120.8 | lift_creak | the other side lifts: chain strain (higher creak) | -12 | -18.0 | -33.1 | -0.30 |
| 63 | 38.100 | 1143.0 | amb_water (bed, integrated) | close water around the rowing boat: lapping, sloshes, drips (shot 9) | -24 | -24.0 | -39.1 | +0.00 |
| 64 | 38.267 | 1148.0 | whoosh_xfade | crossfade to the rowing boat | -13 | -19.0 | -34.1 | +0.00 |
| 65 | 38.400 | 1152.0 | boat_knock | rowing boat rocking: wooden knock + water slap on the hull | -15 | -21.0 | -36.1 | +0.10 |
| 66 | 39.250 | 1177.5 | boat_knock | rowing boat rocking: wooden knock + water slap on the hull | -15 | -21.0 | -36.1 | +0.10 |
| 67 | 39.730 | 1191.9 | lean_creak | everyone leans over one side: thwart creak + boat dips | -10 | -16.0 | -31.1 | -0.20 |
| 68 | 40.900 | 1227.0 | boat_knock | rowing boat rocking: wooden knock + water slap on the hull | -15 | -21.0 | -36.1 | +0.10 |
| 69 | 41.167 | 1235.0 | whoosh_cam | camera closer on the boat | -13 | -19.0 | -34.1 | +0.00 |
| 70 | 41.700 | 1251.0 | boat_knock | rowing boat rocking: wooden knock + water slap on the hull | -15 | -21.0 | -36.1 | +0.10 |
| 71 | 42.450 | 1273.5 | boat_knock | rowing boat rocking: wooden knock + water slap on the hull | -15 | -21.0 | -36.1 | +0.10 |
| 72 | 43.090 | 1292.7 | tip_splash | 'now it tips': the low gunwale ships water - slap + splash + 'whoa!'s | -2 | -8.0 | -23.1 | -0.25 |
| 73 | 43.830 | 1314.9 | hat_plop | top hat lands in the water: plop + bubbles | -12 | -18.0 | -33.1 | -0.35 |
| 74 | 43.967 | 1319.0 | whoosh_xfade | crossfade back to the loaded edge | -13 | -19.0 | -34.1 | +0.00 |
| 75 | 43.980 | 1319.4 | edge_murmur | nervous murmur on the loaded edge | -16 | -22.0 | -37.2 | +0.00 |
| 76 | 44.080 | 1322.4 | edge_groan | loaded edge again: slow chain groan under the crowd | -12 | -18.0 | -33.1 | -0.30 |
| 77 | 47.200 | 1416.0 | amb_town (bed, integrated) | town day air: breeze, sparrows, bunting, river (shots 11-12) | -29 | -29.0 | -44.1 | +0.00 |
| 78 | 47.333 | 1420.0 | whoosh_xfade | crossfade to the empty piers | -13 | -19.0 | -34.1 | +0.00 |
| 79 | 49.120 | 1473.6 | opening_cheer | 1887: the new bridge opens - hurrahs, applause swell | -8 | -14.0 | -29.2 | +0.00 |
| 80 | 49.267 | 1478.0 | whoosh_xfade | dissolve: the new bridge on the same piers | -13 | -19.0 | -34.1 | +0.00 |
| 81 | 49.570 | 1487.1 | opening_steps | the first crowd strolls onto the new bridge | -15 | -21.0 | -36.1 | +0.00 |
| 82 | 52.750 | 1582.5 | amb_today (bed, integrated) | today: breeze, river, a far city hum (shot 13) | -28 | -28.0 | -43.1 | +0.00 |
| 83 | 52.800 | 1584.0 | today_steps | today: people strolling across, out of step | -15 | -21.0 | -36.1 | +0.00 |
| 84 | 52.833 | 1585.0 | whoosh_xfade | crossfade to today | -13 | -19.0 | -34.1 | +0.00 |
| 85 | 53.050 | 1591.5 | today_murmur | today: light chatter on the footways | -18 | -24.0 | -39.2 | +0.00 |
| 86 | 54.000 | 1620.0 | whoosh_cam | camera cut to the barrier | -13 | -19.0 | -34.1 | +0.00 |
| 87 | 54.750 | 1642.5 | bike_bell | a bicycle bell at the barrier (the road is shut, the footway is not) | -14 | -20.0 | -35.1 | +0.35 |
| 88 | 56.510 | 1695.3 | crack | 'Cracks.': sharp masonry crack + grit trickle (on the kick) | -2 | -8.0 | -23.1 | -0.10 |
| 89 | 57.700 | 1731.0 | whoosh_cam | camera crane out, ending | -13 | -19.0 | -34.1 | +0.00 |
