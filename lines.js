// Alberts Sprüche – ein Array pro Trigger. Einfach Zeilen ergänzen.
// Platzhalter: {ort} wird durch den Checkpoint-Namen ersetzt.
// Verdrahtet: start, motor, aufholen, checkpoint, hit_*, marko_stürzt, ebike, abkuerzung, sehrSchnell, gebremst, strava, garmin, fakeSieg.
// apokalypse und ende folgen in späteren Schritten.
const LINES = {
  start: [
    "Na, Marko? Schon müde?",
    "Ich warte oben. Mit Kaffee.",
    "Locker bleiben. Ich fahr eh nur Grundlage.",
    "Unter 40? Klar. Ganz bestimmt.",
    "Hast du dein Rad heute aufgepumpt? Sieht nicht so aus.",
  ],
  aufholen: [
    "Ach, ist das dein Maximum?",
    "Süß, dass du's versuchst.",
    "Ich roll hier nur aus.",
    "Fast! ...Nee, doch nicht.",
    "Willst du ein Gel? Oder zwei?",
    "Ich hab noch nicht mal geschaltet.",
  ],
  checkpoint: [
    "{ort}! War schon vor 'ner Minute hier.",
    "Willkommen in {ort}. Ich hab dir Staub dagelassen.",
    "{ort}. Strava sagt: ich bin schneller.",
    "{ort}! Hab grad 'nen KOM geholt. Nebenbei.",
  ],
  hit_cow: [
    "Die Kuh war zuerst da. Und sie hat Vorfahrt.",
  ],
  hit_hiker: [
    "Das ist ein Wanderweg. Äh, Radweg. Egal.",
  ],
  hit_pothole: [
    "Schlagloch! Stand auf Komoot. Rot markiert.",
  ],
  marko_stürzt: [
    "Umleitung heißt Umleitung. Schild lesen!",
  ],
  ebike: [
    "Überhol bloß keinen Opa. Der hat Rückenwind. Elektrisch.",
  ],
  motor: [
    "Das ist nur mein Herz.",
  ],
  abkuerzung: [
    "Ich warte oben. Mit Kaffee.",
  ],
  gust: [
    "Seitenwind? Ich spür nichts.",
    "Links ist jetzt rechts. Willkommen im Leben.",
  ],
  ebike_albert: [
    "Das ist nur mein Herz.",
    "Rückenwind oder Steckdose?",
    "Ich hab nichts gesehen. Alle haben es gesehen.",
  ],
  puls: [
    "Puls: Albert lacht.",
  ],
  garmin: [
    "Ohne Garmin zählt's nicht. Sagt man.",
  ],
  fakeSieg: [
    "Netter Versuch. Die Uhr läuft anders.",
  ],
  gebremst: [
    "Hab ich gesehen. Alle haben es gesehen.",
    "Das kommt auf Strava. Mit Zeitlupe.",
  ],
  sehrSchnell: [
    "Das ist nur mein Herz. *surrrrr*",
    "Rückenwind. Ganz natürlicher Rückenwind.",
  ],
  apokalypse: [
    "Ist das ein Meteor? Egal, Segment läuft.",
  ],
  ende: [
    "Ich warte oben. Mit Kaffee.",
    "Nächstes Mal vielleicht. Oder nie.",
  ],
};

// Peinliche Toast-Kommentare beim Umschalten des E-Bike-Modus (mitten im Bild)
const ebike_lines = {
  aus: [
    "Motor aus. Zu spät, wir haben's gesehen.",
    "Aus. Als hättest du je Motor gehabt.",
    "Jetzt wieder Beine.",
  ],
  eco: [
    "ECO. Wie dein Ehrgeiz.",
    "Eco-Modus: für Spaziergänge und Marko.",
    "Der Motor fragt: wirklich?",
  ],
  tour: [
    "TOUR. Du fährst Tour, Albert fährt Rennen.",
    "Tourenmodus. Brötchentüte nicht vergessen.",
  ],
  sport: [
    "SPORT. Das Wort ist hier sehr großzügig.",
    "Sport? Mit Steckdose?",
  ],
  turbo: [
    "TURBO. Kevin hat es gesehen.",
    "Strava hat deinen Stolz gesperrt.",
    "Dein Fahrradladen schämt sich für dich.",
  ],
  leer: [
    "Akku leer. Wie dein Selbstvertrauen.",
  ],
};
