# Marko am Schauinsland

Gamejam-Spiel (HTML5 Canvas + Vanilla JS, keine Dependencies, kein Build).
Marko fährt mit dem Rennrad von Freiburg auf den Schauinsland und will unter 40 Minuten bleiben.
Spoiler: Das klappt nie. Bei 40:00 geht die Welt unter.

## Lokal testen

```bash
cd gamejam-endoftheworld
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Für den Test auf dem Handy im selben WLAN:
`http://<IP-deines-Rechners>:8000`.

## Steuerung

| Aktion  | Taste |
|---------|-------|
| Treten  | **A / D** abwechselnd (gleiche Taste mehrfach zählt nicht) |
| Lenken  | **← / →** (Kurven drücken nach außen, abseits der Straße bremst) |
| E-Bike  | **Leertaste** oder **E** schaltet durch: AUS, ECO, TOUR, SPORT, TURBO (+8/15/25/35 % Tempo, der Guard cappt trotzdem). Akku je Modus unterschiedlich schnell leer (TURBO ~5 s), lädt in AUS nach. Jedes Umschalten: peinlicher Toast (`ebike_lines` in `lines.js`), Beep, Albert grinst und lästert. Der Balken PEINLICH füllt sich; bei 100 % erkennt Strava das E-Bike: +0:30, Screenshake (einmal pro Run) |
| Flow    | Sauberes, schnelles A/D-Wechseln füllt den FLOW-Balken; ab 60 % +5 % Tempo (der Guard gilt weiter), falsche Taste oder zu langsam bricht ihn ab |
| Neustart | **R** (Bestzeit liegt in localStorage, nie unter 40:01) |
| Ton     | M |

Touch ist vorerst nicht belegt. Zweimal dieselbe Seite zählt nicht (und kostet Trittfrequenz).

## Dateien

- `index.html`: Einstieg; zwei übereinanderliegende Canvases (Pixel-Ebene 320×180 + Text-Ebene in voller Auflösung)
- `game.js`: Loop (fixed timestep 60 Hz), State Machine, Physik, Albert, Rendering, Sound
- `lines.js`: Alberts Sprüche, ein Array pro Trigger. Einfach Zeilen ergänzen; `{ort}` = Checkpoint-Name
- `style.css`: Skalierung, `image-rendering: pixelated`
- `assets/`: später die PNG-Sprites

## Sprites austauschen

Alles wird über `drawSprite(name, x, y, opts)` gezeichnet (Anker: **unten mittig**,
Räder auf Straßenhöhe). Welche PNGs geladen werden, steht im Manifest `ASSET_FILES`
oben in `game.js`. Das Spiel zeigt einen Lade-Balken (Zustand `LOADING`) und startet
erst, wenn alle PNGs geladen sind (oder ihr Laden fehlgeschlagen ist).

- Billboards (je 64×64, Boden unten mittig, Frame-Größe immer aus `img.height`):
  `albert_back`, `ebike_back`, `hiker_back`, `cow_front`, `sign_front`, `kevin_back`.
  Sie werden in der Pseudo-3D-Straße nach Entfernung skaliert (nearest neighbor).
- Das Schlagloch ist nie ein PNG, sondern eine per Code gezeichnete, perspektivisch skalierte Ellipse.
- Die alten Seitenansicht-Sprites (`marko_*`, `albert_ride`, `cow`, `hiker`, `kevin` ...) werden nicht mehr geladen.

Fehlt ein PNG, zeichnet `drawBillboard` ersatzweise eine farbige Box.

## Sound

Alles per WebAudio, keine Dateien, Start erst nach der ersten Eingabe: Chiptune-Loop (`Music`: Bass, Arpeggio, Kick),
der mit dem Fortschritt schneller und verzerrter wird; Tretklicken, Wind (nach Tempo), E-Bike-Surren (nach Modus),
Grollen in der Apokalypse, Fanfare beim Fake-Sieg. M = Ton aus/an.

## Pseudo-3D

Blick vom Lenker (Marko selbst ist nie zu sehen, nur Lenker und Vorderrad per Code). Bildzeile `y` unter dem
Horizont `HOR` entspricht der Entfernung `d = CAM_H * FOCAL / (y - HOR)`; Kurven (`curveAt`) verschieben die
Straße seitlich. Alles in Sichtmetern (`VIS` = 0,5 × Streckenmeter). Hindernisse (Kuh, Wanderer, Schlagloch, Schild)
liegen in Markos Spur: Ausweichen (`OBSTACLE_HALF`) oder Tempo- und Zeitstrafe. Der E-Bike-Opa fährt vor
Marko und überholt nie.

## Wie die Unmöglichkeit funktioniert

- 90 s Realzeit = 40 Spielminuten (`REAL_DURATION`, `GAME_DURATION`).
- Markos Höchsttempo (`MARKO_VMAX`) würde eigentlich für ca. 36:30 reichen, aber eine unsichtbare
  „Gegenwind-Linie“ (`GUARD_ARRIVAL`) kommt frühestens bei 40:01 oben an, und Marko kann sie nicht überholen.
  Wer richtig reintritt (ab ca. 5,5 Tritten pro Sekunde), landet auf der Linie: hochgerechnet 40:01.
  Ca. 5 Tritte pro Sekunde ergeben ~41:00, ca. 4 Tritte ~45:00.
- Albert (`updateAlbert`) hält per Rubber-Banding 3–8 Spielsekunden Abstand, lässt Marko alle 12–20 s
  fast herankommen (bis ca. 0,6–1 s) und zieht dann weg. Ab 90 % der Strecke fährt er auf seine 38:30 ins Ziel.
  Überholen ist hart ausgeschlossen (`GAP_MIN`).

## Stand

Schritt 1: Gerüst, Loop, State Machine (`TITLE`, `PLAY`, `FAKE_WIN`, `APOCALYPSE`, `GAMEOVER`), Steuerung,
Parallax, Timer, Fortschrittsbalken, Albert mit Sprechblasen (Trigger: Start, Aufholen, Checkpoints).
`FAKE_WIN` und `APOCALYPSE` sind noch leere Durchreichen zum Endbildschirm.

Schritt 3: Rage-Bait-Mechaniken, jede einmal pro Run, an festen Streckenpunkten (Konstanten oben in `game.js`):

| # | Position | Mechanik |
|---|----------|----------|
| 1 | 25 % | Fake-Abkürzung: Schild "Abkürzung -2 Min". Wer davor **springt**, biegt ab: Sackgasse, +3 Min Standzeit, Albert: "Ich warte oben. Mit Kaffee." |
| 2 | 40 % | Rückenwind-Pickup: 3 s Boost (x1,6), dann 4 s Gegenwind (x0,5) |
| 3 | 58 % | Seitenwind-Böe: Lenkung 3 s vertauscht (links = rechts) |
| 4 | 82 % | Garmin-Akku sinkt auf 1 %, dann 1 s schwarzer Bildschirm |
| 5 | oben | Fake-Sieg (State `FAKE_WIN`): ab 39:52 und >96,5 % der Strecke Konfetti + "NEUE BESTZEIT!", dann springt der Timer auf 40:01 |
| 6 | Ziel | Der Zielbogen rückt scheinbar weg, je näher man kommt |

Das Ergebnis (`finishRace`) wird auf 40:01 bis 41:30 begrenzt (`MAX_RESULT`).

## Deploy auf GitHub Pages

Repo pushen → Settings → Pages → Branch `main`, Ordner `/ (root)`. Fertig.
