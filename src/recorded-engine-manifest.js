// Licensed recording derivatives. Full provenance: public/assets/audio/ENGINE-SOURCES.json.
// Every game-car mapping below is an authored proxy, not a model-authentic recording claim.
export const ENGINE_RECORDINGS = Object.freeze({
  "ferrari-355": {
    "id": "ferrari-355",
    "file": "ferrari-355-v1.wav",
    "bytes": 199244,
    "sha256": "377562a8fec7435132b08ff030913256bc67390984c8c02f1dd4e7bca66744ed",
    "duration": 4.15,
    "sampleRate": 24000,
    "sourceFile": "ferrari-43484.mp3",
    "sourceSha256": "8256a64d2e6ac8160edbcc4191a7fc5e13614e556e4493eaf2b47b12b0a94412",
    "layers": [
      {
        "start": 0.0,
        "end": 1.4,
        "rev": 0.1,
        "sourceStart": 1.2,
        "sourceDuration": 1.5
      },
      {
        "start": 1.4,
        "end": 2.8,
        "rev": 0.55,
        "sourceStart": 5.1,
        "sourceDuration": 1.5
      },
      {
        "start": 2.8,
        "end": 4.15,
        "rev": 0.95,
        "sourceStart": 8.55,
        "sourceDuration": 1.45
      }
    ],
    "url": "/assets/audio/engines/ferrari-355-v1.wav?v=377562a8fec74351"
  },
  "porsche-911": {
    "id": "porsche-911",
    "file": "porsche-911-v1.wav",
    "bytes": 194444,
    "sha256": "65e3916dbe2ecadd355115c19f60fa7edff6c381db247752aa0f515f68e81865",
    "duration": 4.05,
    "sampleRate": 24000,
    "sourceFile": "porsche-55727.mp3",
    "sourceSha256": "2387d2c74a32f3bd9ff773fe33d3dd6a04a05708ab92ad17d85e88917d43b735",
    "layers": [
      {
        "start": 0.0,
        "end": 1.3,
        "rev": 0.1,
        "sourceStart": 0.15,
        "sourceDuration": 1.4
      },
      {
        "start": 1.3,
        "end": 2.65,
        "rev": 0.55,
        "sourceStart": 4.35,
        "sourceDuration": 1.45
      },
      {
        "start": 2.65,
        "end": 4.05,
        "rev": 0.95,
        "sourceStart": 2.25,
        "sourceDuration": 1.5
      }
    ],
    "url": "/assets/audio/engines/porsche-911-v1.wav?v=65e3916dbe2ecadd"
  },
  "mustang-idle": {
    "id": "mustang-idle",
    "file": "mustang-idle-v1.wav",
    "bytes": 96044,
    "sha256": "ffa4bd4561bdd87b388e2b3948187136a858347e50f08687d5d66319a0f687af",
    "duration": 2.0,
    "sampleRate": 24000,
    "sourceFile": "mustang-119449.mp3",
    "sourceSha256": "90e680126daf75faa10a48df001e96808ab27ae384cf43257c8429130ca924c8",
    "layers": [
      {
        "start": 0.0,
        "end": 2.0,
        "rev": 0.1,
        "sourceStart": 4.0,
        "sourceDuration": 2.1
      }
    ],
    "url": "/assets/audio/engines/mustang-idle-v1.wav?v=ffa4bd4561bdd87b"
  },
  "aston-acceleration": {
    "id": "aston-acceleration",
    "file": "aston-acceleration-v1.wav",
    "bytes": 96140,
    "sha256": "9024c1e9587a7e0694478ac0bbca9635c8558042ecb1320b2996619c09fafc92",
    "duration": 2.002,
    "sampleRate": 24000,
    "sourceFile": "aston-0600.wav",
    "sourceSha256": "e63e3160ba88112e6d8f78bb89413078b28701b80c79541147b9d7a02d201fe0",
    "layers": [
      {
        "start": 0.0,
        "end": 1.001,
        "rev": 0.15,
        "sourceStart": 0.2,
        "sourceDuration": 1.1
      },
      {
        "start": 1.001,
        "end": 2.002,
        "rev": 0.8,
        "sourceStart": 1.4,
        "sourceDuration": 1.1
      }
    ],
    "url": "/assets/audio/engines/aston-acceleration-v1.wav?v=9024c1e9587a7e06"
  }
});
export const RECORDING_CARS = Object.freeze({
  "mclaren-570s": "ferrari-355",
  "mclaren-senna": "ferrari-355",
  "mclaren-p1-gtr": "ferrari-355",
  "ferrari-458-italia": "ferrari-355",
  "mclaren-650s-gt3": "ferrari-355",
  "koenigsegg-one-1": "ferrari-355",
  "porsche-930-turbo": "porsche-911",
  "porsche-911-gt3": "porsche-911",
  "maserati-mc-stradale": "mustang-idle",
  "mercedes-amg-gt": "mustang-idle",
  "aston-martin-one-77": "aston-acceleration"
});
