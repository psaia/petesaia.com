const KEY_NOTES = {
  r: 82,
  g: 71,
  b: 66
};

const KEY_PITCH = {
  up: 38,
  down: 40
};

const KEY_RECORDER = {
  undo: 85
};

class AudioTrack {
  constructor(audio) {
    this.audio = audio;
  }
  loopEndlessly() {
    this.audio.addEventListener("ended", () => {
      this.audio.currentTime = 0;
      this.audio.play();
    });
    this.audio.play();
    return this;
  }
  kill() {
    this.audio.pause();
  }
}

class Recorder {
  constructor() {
    this.tracks = [];
    this._currentRecordData = [];
    this.recording = false;
    this.mediaRecorder = null;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.addEventListener("dataavailable", event => {
        this._currentRecordData.push(event.data);
      });

      this.mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(this._currentRecordData);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.tracks.push(new AudioTrack(audio).loopEndlessly());
        this._currentRecordData = [];
      });
    });
  }
  record() {
    this.mediaRecorder.start();
    this.recording = true;
  }
  save() {
    this.mediaRecorder.stop();
    this.recording = false;
  }
  silence() {
    this.tracks.forEach(track => track.audio.pause());
  }
  unsilence() {
    this.tracks.forEach(track => track.audio.play());
  }
  removeLast() {
    if (this.tracks.length) {
      this.tracks[this.tracks.length - 1].kill();
      this.tracks.pop();
    }
  }
}

class ImageProcessor {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
  }
  data(video, w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.context.clearRect(0, 0, w, h);
    this.context.drawImage(video, 0, 0, w, h);
    return this.context.getImageData(0, 0, w, h);
  }
}

class VibrationController {
  constructor(context) {
    this.context = context;
    this.oscillator = context.createOscillator();
    this.gainNode = context.createGain();
  }
  start(hz) {
    this.oscillator.type = "sawtooth";
    this.oscillator.frequency.value = hz;
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);
    this.oscillator.start();
  }
  gain(val) {
    this.gainNode.gain.exponentialRampToValueAtTime(
      val,
      this.context.currentTime + 0.000001
    );
  }
  hz(hz) {
    if (hz && !isNaN(hz)) {
      this.oscillator.frequency.value = hz;
    }
  }
}

class Composer {
  constructor(iProcessor, vibration, recorder) {
    this.iProcessor = iProcessor;
    this.vibration = vibration;
    this.recorder = recorder;
    this.note = KEY_NOTES.r;
    this.pitch = 15;
  }
  setNote(note) {
    this.note = note;
  }
  setPitch(pitchDirection) {
    if (KEY_PITCH.up === pitchDirection) {
      this.pitch += 1;
    } else {
      if (this.pitch > 1) {
        this.pitch -= 1;
      }
    }
  }
  toggleRecord() {
    if (this.recorder.recording) {
      this.recorder.save();
    } else {
      this.recorder.record();
    }
  }
  removeLastTrack() {
    this.recorder.removeLast();
  }
  run() {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.vibration.start(100);

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { width: window.innerWidth, height: window.innerHeight }
      })
      .then(stream => {
        video.style = "display:none";
        video.srcObject = stream;
      })
      .catch(console.error);

    document.body.appendChild(canvas);

    const capture = () => {
      const image = this.iProcessor.data(
        video,
        window.innerWidth,
        window.innerHeight
      );

      let rTotal = 0;
      let gTotal = 0;
      let bTotal = 0;

      const len = image.data.length;

      for (let i = 0; i < len; i += 4) {
        rTotal += image.data[i];
        gTotal += image.data[i + 1];
        bTotal += image.data[i + 2];

        if (this.note === KEY_NOTES.r) {
          image.data[i + 1] = 0;
          image.data[i + 2] = 0;
        } else if (this.note === KEY_NOTES.g) {
          image.data[i] = 0;
          image.data[i + 2] = 0;
        } else {
          image.data[i] = 0;
          image.data[i + 1] = 0;
        }
      }

      switch (this.note) {
        case KEY_NOTES.r:
          this.vibration.hz((rTotal / len) * this.pitch);
          break;
        case KEY_NOTES.g:
          this.vibration.hz((gTotal / len) * this.pitch);
          break;
        case KEY_NOTES.b:
          this.vibration.hz((bTotal / len) * this.pitch);
          break;
      }

      context.putImageData(image, 0, 0);
      window.requestAnimationFrame(capture);
    };

    capture();
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("go");
  btn.addEventListener(
    "click",
    function() {
      btn.style.display = "none";

      const vController = new VibrationController(new AudioContext());
      const recorder = new Recorder();

      const composer = new Composer(
        new ImageProcessor(),
        vController,
        recorder
      );

      composer.run();

      setTimeout(() => {
        document.addEventListener(
          "click",
          function() {
            // Silence all other sounds when recording.
            if (recorder.recording) {
              vController.gain(1);
              recorder.unsilence();
            } else {
              vController.gain(0.0001);
              recorder.silence();
            }
            composer.toggleRecord();
          },
          false
        );
      }, 100);

      document.addEventListener(
        "keydown",
        function(event) {
          if (Object.values(KEY_NOTES).indexOf(event.keyCode) !== -1) {
            composer.setNote(event.keyCode);
          }

          if (Object.values(KEY_PITCH).indexOf(event.keyCode) !== -1) {
            composer.setPitch(event.keyCode);
          }

          if (event.keyCode === KEY_RECORDER.undo) {
            composer.removeLastTrack();
          }
        },
        false
      );
    },
    false
  );
});
